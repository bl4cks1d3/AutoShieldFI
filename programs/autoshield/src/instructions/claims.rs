use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, TransferChecked};

use crate::constants::*;
use crate::errors::AutoShieldError;
use crate::events::{AssessorPaid, ClaimAppealed, ClaimFiled, ClaimPaid, ClaimVoted, SalvageRecorded, VoteSettled};
use crate::state::{
    draw_panel, AssessorRecord, Claim, ClaimKind, ClaimStatus, DriverRecord, Policy, PolicyStatus, Pool, RepairShop,
    VehicleRecord, ACCOUNT_VERSION,
};
use anchor_lang::solana_program::hash::hashv;

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

    /// Oficina credenciada escolhida para o reparo (opcional).
    pub repair_shop: Option<Account<'info, RepairShop>>,

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
    let repair_shop = match &ctx.accounts.repair_shop {
        Some(shop) => {
            require!(shop.active, AutoShieldError::RepairShopInactive);
            shop.wallet
        }
        None => Pubkey::default(),
    };

    // Painel sorteado: com comite maior que quorum + 1, so parte dele julga o caso.
    let slot = Clock::get()?.slot;
    let seed = hashv(&[ctx.accounts.claim.key().as_ref(), &slot.to_le_bytes(), &now.to_le_bytes()]).to_bytes();
    let pool = &ctx.accounts.pool;
    let t = pool.approval_threshold as usize;
    let panel_size = if pool.assessors.len() > t + 1 { t + 1 } else { pool.assessors.len() };
    let panel = draw_panel(&pool.assessors, panel_size, seed);

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
    claim.repair_shop = repair_shop;
    claim.appealed = false;
    claim.appeal_voters = Vec::new();
    claim.appeal_ts = 0;
    claim.panel = panel;
    claim.vote_bits = 0;
    claim.appeal_vote_bits = 0;
    claim.settled_bits = 0;
    claim.appeal_settled_bits = 0;
    claim.salvage_recovered = 0;
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

    /// Garantia e reputacao do avaliador.
    #[account(
        init_if_needed,
        payer = assessor,
        space = 8 + AssessorRecord::INIT_SPACE,
        seeds = [ASSESSOR_SEED, assessor.key().as_ref()],
        bump
    )]
    pub assessor_record: Box<Account<'info, AssessorRecord>>,

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
    require!(
        ctx.accounts.assessor_record.bond >= pool.min_assessor_bond,
        AutoShieldError::InsufficientBond
    );

    let appeal = ctx.accounts.claim.status == ClaimStatus::Appealed;
    let panel_len = ctx.accounts.claim.panel.len();
    if !appeal && panel_len > 0 {
        require!(ctx.accounts.claim.panel.contains(&assessor), AutoShieldError::NotOnPanel);
    }
    // No recurso votam so os avaliadores que nao votaram na primeira rodada;
    // o quorum se ajusta a quantos estao aptos.
    let (threshold, max_rejections) = if appeal {
        let eligible = ctx.accounts.claim.appeal_eligible(pool);
        let t = pool.approval_threshold.min(eligible).max(1);
        (t, eligible.saturating_sub(t))
    } else {
        let t = pool.approval_threshold;
        let judges = if panel_len > 0 { panel_len as u8 } else { pool.assessors.len() as u8 };
        (t, judges.saturating_sub(t))
    };
    let claim = &mut ctx.accounts.claim;
    require!(
        claim.status == ClaimStatus::Pending || appeal,
        AutoShieldError::ClaimNotPending
    );
    require!(now <= claim.voting_deadline, AutoShieldError::VotingClosed);
    if claim.voters.contains(&assessor) {
        return if appeal {
            err!(AutoShieldError::AppealConflict)
        } else {
            err!(AutoShieldError::AlreadyVoted)
        };
    }
    require!(
        !claim.appeal_voters.contains(&assessor),
        AutoShieldError::AlreadyVoted
    );
    require!(
        claim.voters.len() < MAX_ASSESSORS && claim.appeal_voters.len() < MAX_ASSESSORS,
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
    // Guarda o sentido de cada voto (bit i = aprovou) para liquidar a reputacao depois.
    if appeal {
        if approve {
            claim.appeal_vote_bits |= 1 << claim.appeal_voters.len();
        }
        claim.appeal_voters.push(assessor);
    } else {
        if approve {
            claim.vote_bits |= 1 << claim.voters.len();
        }
        claim.voters.push(assessor);
    }
    if approve {
        claim.approvals += 1;
    } else {
        claim.rejections += 1;
    }

    let record = &mut ctx.accounts.assessor_record;
    if record.assessor == Pubkey::default() {
        record.version = ACCOUNT_VERSION;
        record.assessor = assessor;
        record.bump = ctx.bumps.assessor_record;
    }
    record.votes = record.votes.saturating_add(1);

    let claim = &mut ctx.accounts.claim;
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
        matches!(claim.status, ClaimStatus::Pending | ClaimStatus::Appealed),
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

    /// Quem recebe: a oficina credenciada (danos parciais com oficina escolhida)
    /// ou o proprio motorista. CHECK: validado no handler.
    pub payee: UncheckedAccount<'info>,

    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = stable_mint,
        associated_token::authority = payee,
    )]
    pub payee_token: Box<Account<'info, TokenAccount>>,

    /// Historico do motorista: sinistro indenizado desce uma classe de bonus.
    #[account(
        init_if_needed,
        payer = payer,
        space = 8 + DriverRecord::INIT_SPACE,
        seeds = [DRIVER_SEED, claimant.key().as_ref()],
        bump
    )]
    pub driver: Box<Account<'info, DriverRecord>>,

    /// Oficina que recebe (so quando o sinistro escolheu uma); atualiza as estatisticas.
    #[account(mut)]
    pub repair_shop: Option<Box<Account<'info, RepairShop>>>,

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
    // Danos parciais com oficina credenciada: paga direto a oficina.
    let to_shop = !total_loss && claim.repair_shop != Pubkey::default();
    let expected_payee = if to_shop { claim.repair_shop } else { claim.claimant };
    require!(ctx.accounts.payee.key() == expected_payee, AutoShieldError::InvalidPayee);
    if to_shop {
        let shop = ctx.accounts.repair_shop.as_ref().ok_or(AutoShieldError::InvalidPayee)?;
        require!(shop.wallet == claim.repair_shop, AutoShieldError::InvalidPayee);
    }

    if payout > 0 {
        let bump = ctx.accounts.pool.bump;
        let signer_seeds: &[&[&[u8]]] = &[&[POOL_SEED, &[bump]]];
        token::transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.vault.to_account_info(),
                    mint: ctx.accounts.stable_mint.to_account_info(),
                    to: ctx.accounts.payee_token.to_account_info(),
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
    // Classe junior absorve a perda primeiro.
    pool.absorb_loss(payout);
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

    if payout > 0 {
        let days_per_class = ctx.accounts.pool.bonus_days();
        let claimant = ctx.accounts.claimant.key();
        let driver = &mut ctx.accounts.driver;
        if driver.owner == Pubkey::default() {
            driver.version = ACCOUNT_VERSION;
            driver.owner = claimant;
            driver.bump = ctx.bumps.driver;
        }
        driver.register_paid_claim(days_per_class);
    }
    if let (true, Some(shop)) = (to_shop, ctx.accounts.repair_shop.as_mut()) {
        shop.claims_paid = shop.claims_paid.saturating_add(1);
        shop.total_received = shop.total_received.saturating_add(payout);
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

/// Recurso contra sinistro recusado: o motorista pede nova analise uma unica
/// vez, ate APPEAL_WINDOW_DAYS dias apos a recusa. A nova votacao e feita por
/// avaliadores que nao votaram na primeira rodada.
#[derive(Accounts)]
pub struct AppealClaim<'info> {
    pub owner: Signer<'info>,

    #[account(mut, seeds = [POOL_SEED], bump = pool.bump)]
    pub pool: Account<'info, Pool>,

    #[account(mut, has_one = pool, has_one = owner @ AutoShieldError::Unauthorized, address = claim.policy)]
    pub policy: Box<Account<'info, Policy>>,

    #[account(mut, has_one = pool, has_one = policy)]
    pub claim: Box<Account<'info, Claim>>,
}

pub fn appeal_claim(ctx: Context<AppealClaim>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let pool = &ctx.accounts.pool;
    let claim = &ctx.accounts.claim;
    let policy = &ctx.accounts.policy;
    require!(claim.status == ClaimStatus::Rejected, AutoShieldError::ClaimNotRejected);
    require!(!claim.appealed, AutoShieldError::AlreadyAppealed);
    require!(
        now <= claim
            .resolved_ts
            .saturating_add(APPEAL_WINDOW_DAYS.saturating_mul(pool.params.seconds_per_day)),
        AutoShieldError::AppealWindowClosed
    );
    require!(policy.status == PolicyStatus::Active, AutoShieldError::PolicyNotActive);
    require!(!policy.has_open_claim, AutoShieldError::ClaimAlreadyOpen);
    require!(claim.appeal_eligible(pool) > 0, AutoShieldError::NoAppealAssessors);

    let voting_deadline = now
        .checked_add(pool.params.claim_voting_secs)
        .ok_or(AutoShieldError::MathOverflow)?;
    let amount = claim.amount_requested;

    let pool = &mut ctx.accounts.pool;
    pool.pending_claims = pool
        .pending_claims
        .checked_add(amount)
        .ok_or(AutoShieldError::MathOverflow)?;
    ctx.accounts.policy.has_open_claim = true;

    let claim = &mut ctx.accounts.claim;
    claim.status = ClaimStatus::Appealed;
    claim.appealed = true;
    claim.appeal_ts = now;
    claim.approvals = 0;
    claim.rejections = 0;
    claim.voting_deadline = voting_deadline;
    claim.resolved_ts = 0;

    emit!(ClaimAppealed {
        claim: claim.key(),
        claimant: claim.claimant,
        voting_deadline,
    });
    Ok(())
}

/// Liquida os votos de um avaliador num sinistro com resultado definitivo:
/// voto de acordo com o resultado conta como acerto; contra, perde parte da
/// garantia (vai para a tesouraria). Qualquer pessoa pode acionar (crank).
#[derive(Accounts)]
#[instruction(assessor: Pubkey)]
pub struct SettleVote<'info> {
    pub caller: Signer<'info>,

    #[account(mut, seeds = [POOL_SEED], bump = pool.bump)]
    pub pool: Account<'info, Pool>,

    #[account(mut, has_one = pool)]
    pub claim: Box<Account<'info, Claim>>,

    #[account(mut, seeds = [ASSESSOR_SEED, assessor.as_ref()], bump = assessor_record.bump)]
    pub assessor_record: Box<Account<'info, AssessorRecord>>,
}

pub fn settle_vote(ctx: Context<SettleVote>, assessor: Pubkey) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let spd = ctx.accounts.pool.params.seconds_per_day;
    let outcome = ctx.accounts.claim.final_outcome(now, spd).ok_or(AutoShieldError::ClaimNotFinal)?;
    let slash_bps = ctx.accounts.pool.slash_rate_bps();

    // Votos do avaliador ainda nao liquidados (primeira rodada e recurso).
    let claim = &mut ctx.accounts.claim;
    let mut votes: Vec<bool> = Vec::new();
    if let Some(i) = claim.voters.iter().position(|v| *v == assessor) {
        if claim.settled_bits & (1 << i) == 0 {
            votes.push(claim.vote_bits & (1 << i) != 0);
            claim.settled_bits |= 1 << i;
        }
    }
    if let Some(i) = claim.appeal_voters.iter().position(|v| *v == assessor) {
        if claim.appeal_settled_bits & (1 << i) == 0 {
            votes.push(claim.appeal_vote_bits & (1 << i) != 0);
            claim.appeal_settled_bits |= 1 << i;
        }
    }
    require!(!votes.is_empty(), AutoShieldError::NothingToSettle);

    let claim_key = claim.key();
    let record = &mut ctx.accounts.assessor_record;
    let mut slashed_total = 0u64;
    for approved in votes {
        if approved == outcome {
            record.correct_votes = record.correct_votes.saturating_add(1);
        } else {
            record.wrong_votes = record.wrong_votes.saturating_add(1);
            let slash = (record.bond as u128 * slash_bps as u128 / BPS_DENOMINATOR as u128) as u64;
            record.bond -= slash;
            record.slashed = record.slashed.saturating_add(slash);
            slashed_total += slash;
        }
    }
    let pool = &mut ctx.accounts.pool;
    pool.assessor_bonds = pool.assessor_bonds.saturating_sub(slashed_total);
    pool.treasury_accrued = pool.treasury_accrued.saturating_add(slashed_total);

    emit!(VoteSettled {
        claim: claim_key,
        assessor,
        slashed: slashed_total,
    });
    Ok(())
}

/// Registra o valor recuperado de um sinistro de perda total: venda do salvado
/// ou recuperacao do veiculo roubado. O dinheiro entra no cofre e volta aos LPs.
#[derive(Accounts)]
pub struct RecordSalvage<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [POOL_SEED],
        bump = pool.bump,
        has_one = authority @ AutoShieldError::Unauthorized,
        has_one = vault,
        has_one = stable_mint
    )]
    pub pool: Account<'info, Pool>,

    pub stable_mint: Account<'info, Mint>,

    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,

    #[account(mut, token::mint = stable_mint, token::authority = authority)]
    pub source: Account<'info, TokenAccount>,

    #[account(mut, has_one = pool)]
    pub claim: Box<Account<'info, Claim>>,

    pub token_program: Program<'info, Token>,
}

pub fn record_salvage(ctx: Context<RecordSalvage>, amount: u64) -> Result<()> {
    require!(amount > 0, AutoShieldError::ZeroAmount);
    require!(
        ctx.accounts.claim.status == ClaimStatus::Paid && ctx.accounts.claim.total_loss,
        AutoShieldError::NotTotalLoss
    );
    let nav_before = ctx.accounts.pool.net_assets(ctx.accounts.vault.amount);
    token::transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.source.to_account_info(),
                mint: ctx.accounts.stable_mint.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.authority.to_account_info(),
            },
        ),
        amount,
        ctx.accounts.stable_mint.decimals,
    )?;
    let pool = &mut ctx.accounts.pool;
    pool.total_salvage = pool.total_salvage.saturating_add(amount);
    pool.credit_lp_income(amount, nav_before);
    let claim = &mut ctx.accounts.claim;
    claim.salvage_recovered = claim.salvage_recovered.saturating_add(amount);
    emit!(SalvageRecorded {
        claim: claim.key(),
        amount,
    });
    Ok(())
}
