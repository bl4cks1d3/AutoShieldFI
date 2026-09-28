use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, TransferChecked};

use crate::constants::*;
use crate::errors::AutoShieldError;
use crate::events::{ClaimFiled, ClaimPaid, ClaimVoted};
use crate::state::{Claim, ClaimKind, ClaimStatus, Policy, PolicyStatus, Pool};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct FileClaimArgs {
    pub kind: ClaimKind,
    pub amount: u64,
    pub description: String,
    pub evidence_uri: String,
}

#[derive(Accounts)]
pub struct FileClaim<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(mut, seeds = [POOL_SEED], bump = pool.bump)]
    pub pool: Account<'info, Pool>,

    #[account(
        mut,
        has_one = pool,
        has_one = owner @ AutoShieldError::Unauthorized
    )]
    pub policy: Account<'info, Policy>,

    #[account(
        init,
        payer = owner,
        space = 8 + Claim::INIT_SPACE,
        seeds = [CLAIM_SEED, policy.key().as_ref(), &[policy.claims_filed]],
        bump
    )]
    pub claim: Account<'info, Claim>,

    pub system_program: Program<'info, System>,
}

pub fn file_claim(ctx: Context<FileClaim>, args: FileClaimArgs) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let policy = &ctx.accounts.policy;
    require!(
        policy.status == PolicyStatus::Active,
        AutoShieldError::PolicyNotActive
    );
    require!(
        now >= policy.start_ts && now <= policy.end_ts,
        AutoShieldError::OutsideCoveragePeriod
    );
    require!(policy.inspected, AutoShieldError::PolicyNotInspected);
    require!(
        now >= policy.claims_allowed_from,
        AutoShieldError::ClaimWaitingPeriod
    );
    require!(!policy.has_open_claim, AutoShieldError::ClaimAlreadyOpen);
    require!(policy.claims_filed < u8::MAX, AutoShieldError::InvalidParameter);
    require!(
        policy.tier.covers(args.kind),
        AutoShieldError::ClaimTypeNotCovered
    );
    require!(args.amount > 0, AutoShieldError::ZeroAmount);
    require!(
        args.amount <= policy.remaining_coverage(),
        AutoShieldError::ClaimExceedsCoverage
    );
    require!(
        args.description.len() <= MAX_DESCRIPTION_LEN,
        AutoShieldError::StringTooLong
    );
    require!(
        args.evidence_uri.len() <= MAX_URI_LEN,
        AutoShieldError::StringTooLong
    );

    let pool = &mut ctx.accounts.pool;
    let claim_id = pool.claim_count;
    pool.claim_count += 1;
    pool.pending_claims = pool
        .pending_claims
        .checked_add(args.amount)
        .ok_or(AutoShieldError::MathOverflow)?;
    let voting_deadline = now
        .checked_add(pool.params.claim_voting_secs)
        .ok_or(AutoShieldError::MathOverflow)?;
    let pool_key = pool.key();

    let policy = &mut ctx.accounts.policy;
    let index = policy.claims_filed;
    policy.claims_filed += 1;
    policy.has_open_claim = true;

    let claim = &mut ctx.accounts.claim;
    claim.policy = policy.key();
    claim.claimant = policy.owner;
    claim.pool = pool_key;
    claim.id = claim_id;
    claim.index = index;
    claim.kind = args.kind;
    claim.amount_requested = args.amount;
    claim.payout_amount = 0;
    claim.description = args.description;
    claim.evidence_uri = args.evidence_uri;
    claim.status = ClaimStatus::Pending;
    claim.approvals = 0;
    claim.rejections = 0;
    claim.voters = Vec::new();
    claim.created_ts = now;
    claim.voting_deadline = voting_deadline;
    claim.resolved_ts = 0;
    claim.bump = ctx.bumps.claim;

    emit!(ClaimFiled {
        claim: claim.key(),
        policy: claim.policy,
        claimant: claim.claimant,
        kind: claim.kind,
        amount: claim.amount_requested,
    });
    Ok(())
}

#[derive(Accounts)]
pub struct VoteClaim<'info> {
    pub assessor: Signer<'info>,

    #[account(mut, seeds = [POOL_SEED], bump = pool.bump)]
    pub pool: Account<'info, Pool>,

    #[account(mut, has_one = pool, address = claim.policy)]
    pub policy: Account<'info, Policy>,

    #[account(mut, has_one = pool, has_one = policy)]
    pub claim: Account<'info, Claim>,
}

pub fn vote_claim(ctx: Context<VoteClaim>, approve: bool) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let assessor = ctx.accounts.assessor.key();
    let pool = &ctx.accounts.pool;
    require!(pool.is_assessor(&assessor), AutoShieldError::NotAssessor);
    require!(
        ctx.accounts.claim.claimant != assessor,
        AutoShieldError::AssessorConflict
    );

    let claim = &mut ctx.accounts.claim;
    require!(
        claim.status == ClaimStatus::Pending,
        AutoShieldError::ClaimNotPending
    );
    require!(now <= claim.voting_deadline, AutoShieldError::VotingClosed);
    require!(
        !claim.voters.contains(&assessor),
        AutoShieldError::AlreadyVoted
    );
    require!(
        claim.voters.len() < MAX_ASSESSORS,
        AutoShieldError::InvalidParameter
    );

    claim.voters.push(assessor);
    if approve {
        claim.approvals += 1;
    } else {
        claim.rejections += 1;
    }

    let threshold = pool.approval_threshold;
    let max_rejections = (pool.assessors.len() as u8).saturating_sub(threshold);
    if claim.approvals >= threshold {
        claim.status = ClaimStatus::Approved;
        claim.resolved_ts = now;
    } else if claim.rejections > max_rejections {
        claim.status = ClaimStatus::Rejected;
        claim.resolved_ts = now;
        let amount = claim.amount_requested;
        let pool = &mut ctx.accounts.pool;
        pool.pending_claims = pool.pending_claims.saturating_sub(amount);
        ctx.accounts.policy.has_open_claim = false;
    }

    emit!(ClaimVoted {
        claim: ctx.accounts.claim.key(),
        assessor,
        approve,
        status: ctx.accounts.claim.status,
    });
    Ok(())
}

/// Rejeita um sinistro que nao atingiu o quorum dentro da janela de votacao.
#[derive(Accounts)]
pub struct ExpireClaim<'info> {
    pub caller: Signer<'info>,

    #[account(mut, seeds = [POOL_SEED], bump = pool.bump)]
    pub pool: Account<'info, Pool>,

    #[account(mut, has_one = pool, address = claim.policy)]
    pub policy: Account<'info, Policy>,

    #[account(mut, has_one = pool, has_one = policy)]
    pub claim: Account<'info, Claim>,
}

pub fn expire_claim(ctx: Context<ExpireClaim>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let claim = &mut ctx.accounts.claim;
    require!(
        claim.status == ClaimStatus::Pending,
        AutoShieldError::ClaimNotPending
    );
    require!(now > claim.voting_deadline, AutoShieldError::VotingStillOpen);
    claim.status = ClaimStatus::Rejected;
    claim.resolved_ts = now;
    let pool = &mut ctx.accounts.pool;
    pool.pending_claims = pool.pending_claims.saturating_sub(claim.amount_requested);
    ctx.accounts.policy.has_open_claim = false;
    Ok(())
}

/// Paga um sinistro aprovado. Qualquer pessoa pode acionar; os fundos vao
/// sempre para o titular da apolice.
#[derive(Accounts)]
pub struct PayClaim<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(mut, seeds = [POOL_SEED], bump = pool.bump, has_one = vault, has_one = stable_mint)]
    pub pool: Account<'info, Pool>,

    pub stable_mint: Account<'info, Mint>,

    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,

    #[account(mut, has_one = pool, address = claim.policy)]
    pub policy: Account<'info, Policy>,

    #[account(mut, has_one = pool, has_one = policy, has_one = claimant)]
    pub claim: Account<'info, Claim>,

    /// CHECK: validado via has_one no sinistro.
    pub claimant: UncheckedAccount<'info>,

    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = stable_mint,
        associated_token::authority = claimant,
    )]
    pub claimant_token: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn pay_claim(ctx: Context<PayClaim>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let claim = &ctx.accounts.claim;
    let policy = &ctx.accounts.policy;
    require!(
        claim.status == ClaimStatus::Approved,
        AutoShieldError::ClaimNotApproved
    );

    // Roubo/furto e eventos da natureza (perda total) sao indenizados
    // integralmente; danos parciais descontam a franquia.
    let deductible = match claim.kind {
        ClaimKind::Theft | ClaimKind::NaturalEvent => 0,
        _ => policy.deductible,
    };
    let payout = claim
        .amount_requested
        .saturating_sub(deductible)
        .min(policy.remaining_coverage())
        .min(ctx.accounts.vault.amount);
    let requested = claim.amount_requested;

    if payout > 0 {
        let bump = ctx.accounts.pool.bump;
        let signer_seeds: &[&[&[u8]]] = &[&[POOL_SEED, &[bump]]];
        token::transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.vault.to_account_info(),
                    mint: ctx.accounts.stable_mint.to_account_info(),
                    to: ctx.accounts.claimant_token.to_account_info(),
                    authority: ctx.accounts.pool.to_account_info(),
                },
                signer_seeds,
            ),
            payout,
            ctx.accounts.stable_mint.decimals,
        )?;
    }

    let forfeit_cashback = payout > 0 && !ctx.accounts.policy.had_paid_claim;
    let cashback = ctx.accounts.policy.cashback_amount;

    let pool = &mut ctx.accounts.pool;
    pool.pending_claims = pool.pending_claims.saturating_sub(requested);
    pool.total_active_coverage = pool.total_active_coverage.saturating_sub(payout);
    pool.total_claims_paid = pool
        .total_claims_paid
        .checked_add(payout)
        .ok_or(AutoShieldError::MathOverflow)?;
    if forfeit_cashback {
        // O cashback nao utilizado volta a pertencer aos provedores de liquidez.
        pool.reserved_cashback = pool.reserved_cashback.saturating_sub(cashback);
    }

    let policy = &mut ctx.accounts.policy;
    policy.has_open_claim = false;
    policy.total_paid_out = policy
        .total_paid_out
        .checked_add(payout)
        .ok_or(AutoShieldError::MathOverflow)?;
    if payout > 0 {
        policy.had_paid_claim = true;
    }

    let claim = &mut ctx.accounts.claim;
    claim.status = ClaimStatus::Paid;
    claim.payout_amount = payout;
    claim.resolved_ts = now;

    emit!(ClaimPaid {
        claim: claim.key(),
        claimant: claim.claimant,
        payout,
    });
    Ok(())
}
