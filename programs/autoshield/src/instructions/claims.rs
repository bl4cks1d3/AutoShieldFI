use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, TransferChecked};

use crate::constants::*;
use crate::errors::AutoShieldError;
use crate::events::{AssessorPaid, ClaimFiled, ClaimPaid, ClaimVoted};
use crate::state::{Claim, ClaimKind, ClaimStatus, Policy, PolicyStatus, Pool, VehicleRecord, ACCOUNT_VERSION};

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
    pub policy: Box<Account<'info, Policy>>,

    #[account(
        init,
        payer = owner,
        space = 8 + Claim::INIT_SPACE,
        seeds = [CLAIM_SEED, policy.key().as_ref(), &[policy.claims_filed]],
        bump
    )]
    pub claim: Box<Account<'info, Claim>>,

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
    // Parcelado: so ha cobertura enquanto as parcelas estiverem em dia.
    require!(now <= policy.paid_until(), AutoShieldError::PolicyLapsed);
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
    claim.version = ACCOUNT_VERSION;
    claim.policy = policy.key();
    claim.claimant = policy.owner;
    claim.pool = pool_key;
    claim.id = claim_id;
    claim.index = index;
    claim.kind = args.kind;
    claim.original_kind = args.kind;
    claim.reclassified = false;
    claim.total_loss = false;
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
    #[account(mut)]
    pub assessor: Signer<'info>,

    #[account(mut, seeds = [POOL_SEED], bump = pool.bump, has_one = vault, has_one = stable_mint)]
    pub pool: Account<'info, Pool>,

    pub stable_mint: Account<'info, Mint>,

    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,

    #[account(mut, has_one = pool, address = claim.policy)]
    pub policy: Box<Account<'info, Policy>>,

    #[account(mut, has_one = pool, has_one = policy)]
    pub claim: Box<Account<'info, Claim>>,

    /// Recebe a remuneracao pelo voto (paga da tesouraria do protocolo).
    #[account(
        init_if_needed,
        payer = assessor,
        associated_token::mint = stable_mint,
        associated_token::authority = assessor,
    )]
    pub assessor_token: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

/// `reclassify`: ao aprovar, o avaliador pode corrigir o tipo do sinistro
/// (ex.: "roubo" declarado que na verdade e dano parcial, sujeito a franquia).
pub fn vote_claim(
    ctx: Context<VoteClaim>,
    approve: bool,
    reclassify: Option<ClaimKind>,
) -> Result<()> {
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

    if let (true, Some(kind)) = (approve, reclassify) {
        require!(
            ctx.accounts.policy.tier.covers(kind),
            AutoShieldError::ClaimTypeNotCovered
        );
        if claim.kind != kind {
            claim.kind = kind;
            claim.reclassified = true;
        }
    }
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

    // Remuneracao por voto, limitada ao saldo da tesouraria do protocolo.
    let reward = ctx
        .accounts
        .pool
        .params
        .vote_reward
        .min(ctx.accounts.pool.treasury_accrued);
    if reward > 0 {
        let bump = ctx.accounts.pool.bump;
        let signer_seeds: &[&[&[u8]]] = &[&[POOL_SEED, &[bump]]];
        token::transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.vault.to_account_info(),
                    mint: ctx.accounts.stable_mint.to_account_info(),
                    to: ctx.accounts.assessor_token.to_account_info(),
                    authority: ctx.accounts.pool.to_account_info(),
                },
                signer_seeds,
            ),
            reward,
            ctx.accounts.stable_mint.decimals,
        )?;
        let pool = &mut ctx.accounts.pool;
        pool.treasury_accrued -= reward;
        pool.total_assessor_rewards = pool.total_assessor_rewards.saturating_add(reward);
        emit!(AssessorPaid {
            assessor,
            amount: reward,
            kind: 1,
        });
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
    pub policy: Box<Account<'info, Policy>>,

    #[account(mut, has_one = pool, has_one = policy)]
    pub claim: Box<Account<'info, Claim>>,
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
    pub policy: Box<Account<'info, Policy>>,

    #[account(mut, has_one = pool, has_one = policy, has_one = claimant)]
    pub claim: Box<Account<'info, Claim>>,

    /// Registro do veiculo: liberado quando a perda total encerra a apolice.
    #[account(mut, seeds = [VEHICLE_SEED, policy.plate_hash.as_ref()], bump = vehicle.bump)]
    pub vehicle: Account<'info, VehicleRecord>,

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

    // Perda total (roubo/furto ou dano a partir de 75% do valor coberto): paga a
    // cobertura restante, que acompanha a FIPE vigente (atualizada pelo oraculo),
    // sem franquia, e encerra a apolice. Danos parciais descontam a franquia.
    let total_loss = policy.is_total_loss(claim.kind, claim.amount_requested);
    let payout = if total_loss {
        policy.remaining_coverage()
    } else {
        claim
            .amount_requested
            .saturating_sub(policy.deductible)
            .min(policy.remaining_coverage())
    };
    // Paga somente com o patrimonio dos LPs: nunca com cashback reservado,
    // taxas de vistoria ou receita do protocolo. Sem liquidez, a transacao
    // falha e o sinistro continua Aprovado ate haver saldo (sem pagar pela metade).
    require!(
        payout <= ctx.accounts.pool.net_assets(ctx.accounts.vault.amount),
        AutoShieldError::InsufficientLiquidityForClaim
    );
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
    if forfeit_cashback {
        ctx.accounts.policy.cashback_amount = 0;
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
    if total_loss {
        // Veiculo indenizado integralmente: a apolice termina e a placa fica livre.
        let leftover = policy.remaining_coverage();
        let policy_key = policy.key();
        policy.status = PolicyStatus::Settled;
        policy.pending_owner = Pubkey::default();
        let pool = &mut ctx.accounts.pool;
        pool.total_active_coverage = pool.total_active_coverage.saturating_sub(leftover);
        pool.active_policies = pool.active_policies.saturating_sub(1);
        let vehicle = &mut ctx.accounts.vehicle;
        if vehicle.active_policy == policy_key {
            vehicle.active_policy = Pubkey::default();
        }
    }

    let claim = &mut ctx.accounts.claim;
    claim.status = ClaimStatus::Paid;
    claim.total_loss = total_loss;
    claim.payout_amount = payout;
    claim.resolved_ts = now;

    emit!(ClaimPaid {
        claim: claim.key(),
        claimant: claim.claimant,
        payout,
    });
    Ok(())
}

/// Fecha um sinistro resolvido (pago ou recusado) e devolve o aluguel ao titular.
#[derive(Accounts)]
pub struct CloseClaim<'info> {
    pub caller: Signer<'info>,

    #[account(
        mut,
        close = claimant,
        has_one = claimant,
        constraint = matches!(claim.status, ClaimStatus::Paid | ClaimStatus::Rejected)
            @ AutoShieldError::AccountNotClosable
    )]
    pub claim: Box<Account<'info, Claim>>,

    /// CHECK: recebe o aluguel; validado via has_one.
    #[account(mut)]
    pub claimant: UncheckedAccount<'info>,
}

pub fn close_claim(_ctx: Context<CloseClaim>) -> Result<()> {
    Ok(())
}
