use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, TransferChecked};

use crate::constants::*;
use crate::errors::AutoShieldError;
use crate::events::{
    AssessorPaid, FipeUpdated, InstallmentPaid, PolicyCancelled, PolicyInspected, PolicyPurchased, PolicySettled,
    PolicyTransferred,
};
use crate::pricing;
use crate::state::{CoverageTier, DeductibleOption, Policy, PolicyStatus, Pool, VehicleRecord, ACCOUNT_VERSION};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct PurchasePolicyArgs {
    /// Nonce escolhido pelo cliente para derivar o PDA da apolice.
    pub nonce: u64,
    /// sha256 da placa normalizada (maiusculas, so letras e digitos). A placa em
    /// texto nao e enviada; a vistoria confere se o hash bate com o documento.
    pub plate_hash: [u8; 32],
    pub model: String,
    pub year: u16,
    pub vehicle_value: u64,
    pub tier: CoverageTier,
    pub duration_days: u16,
    /// 1 = a vista; ate 12 parcelas, cada uma cobrindo ao menos 30 dias.
    pub installments: u8,
    /// Protecao contra slippage: premio total maximo aceito pelo usuario.
    pub max_premium: u64,
    /// Percentual da FIPE coberto: 90, 100 ou 110.
    pub fipe_pct: u8,
    pub deductible_option: DeductibleOption,
    /// Codigo FIPE e ano, para o oraculo atualizar o valor mes a mes (opcional).
    pub fipe_code: String,
}

/// Contabiliza um pagamento de premio (a vista ou parcela): separa a taxa do
/// protocolo e o cashback reservado; o restante fica com os LPs.
fn account_payment(pool: &mut Pool, policy: &mut Policy, amount: u64) -> Result<()> {
    let fee = u64::try_from(
        (amount as u128) * pool.params.protocol_fee_bps as u128 / BPS_DENOMINATOR as u128,
    )
    .map_err(|_| AutoShieldError::MathOverflow)?;
    // Depois de um sinistro pago, o motorista nao acumula mais cashback.
    let cashback = if policy.had_paid_claim {
        0
    } else {
        u64::try_from((amount as u128) * pool.params.cashback_bps as u128 / BPS_DENOMINATOR as u128)
            .map_err(|_| AutoShieldError::MathOverflow)?
    };
    pool.treasury_accrued = pool
        .treasury_accrued
        .checked_add(fee)
        .ok_or(AutoShieldError::MathOverflow)?;
    pool.total_protocol_fees = pool.total_protocol_fees.saturating_add(fee);
    pool.reserved_cashback = pool
        .reserved_cashback
        .checked_add(cashback)
        .ok_or(AutoShieldError::MathOverflow)?;
    pool.total_premiums = pool.total_premiums.saturating_add(amount);
    policy.protocol_fees_paid = policy.protocol_fees_paid.saturating_add(fee);
    policy.cashback_amount = policy.cashback_amount.saturating_add(cashback);
    policy.premium_paid = policy
        .premium_paid
        .checked_add(amount)
        .ok_or(AutoShieldError::MathOverflow)?;
    policy.installments_paid += 1;
    Ok(())
}

fn split(pool: &Pool, amount: u64) -> (u64, u64) {
    let fee = (amount as u128 * pool.params.protocol_fee_bps as u128 / BPS_DENOMINATOR as u128) as u64;
    let cashback = (amount as u128 * pool.params.cashback_bps as u128 / BPS_DENOMINATOR as u128) as u64;
    (fee, cashback)
}

#[derive(Accounts)]
#[instruction(args: PurchasePolicyArgs)]
pub struct PurchasePolicy<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(mut, seeds = [POOL_SEED], bump = pool.bump, has_one = vault, has_one = stable_mint)]
    pub pool: Account<'info, Pool>,

    pub stable_mint: Account<'info, Mint>,

    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = stable_mint,
        token::authority = owner,
    )]
    pub owner_token: Account<'info, TokenAccount>,

    #[account(
        init,
        payer = owner,
        space = 8 + Policy::INIT_SPACE,
        seeds = [POLICY_SEED, owner.key().as_ref(), args.nonce.to_le_bytes().as_ref()],
        bump
    )]
    pub policy: Box<Account<'info, Policy>>,

    #[account(
        init_if_needed,
        payer = owner,
        space = 8 + VehicleRecord::INIT_SPACE,
        seeds = [VEHICLE_SEED, args.plate_hash.as_ref()],
        bump
    )]
    pub vehicle: Account<'info, VehicleRecord>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn purchase_policy(ctx: Context<PurchasePolicy>, args: PurchasePolicyArgs) -> Result<()> {
    let pool = &ctx.accounts.pool;
    require!(!pool.paused, AutoShieldError::Paused);
    require!(
        (MIN_POLICY_DAYS..=MAX_POLICY_DAYS).contains(&args.duration_days),
        AutoShieldError::InvalidDuration
    );
    require!(
        args.installments >= 1
            && args.installments <= MAX_INSTALLMENTS
            && args.duration_days >= MIN_DAYS_PER_INSTALLMENT * args.installments as u16,
        AutoShieldError::InvalidInstallments
    );
    require!(
        args.vehicle_value >= pool.params.min_vehicle_value,
        AutoShieldError::InvalidVehicleValue
    );
    require!(args.plate_hash != [0u8; 32], AutoShieldError::PlateHashMismatch);
    // Um veiculo com apolice ja vistoriada e ativa nao pode ser segurado de novo.
    // A trava so acontece na vistoria aprovada: contratar a placa de outra pessoa
    // nao bloqueia o dono real.
    require!(
        ctx.accounts.vehicle.active_policy == Pubkey::default(),
        AutoShieldError::VehicleAlreadyInsured
    );
    require!(args.model.len() <= MAX_MODEL_LEN, AutoShieldError::StringTooLong);
    require!(args.fipe_code.len() <= MAX_FIPE_CODE_LEN, AutoShieldError::StringTooLong);
    require!(FIPE_PCT_OPTIONS.contains(&args.fipe_pct), AutoShieldError::InvalidFipePct);
    require!(
        (1950..=2100).contains(&args.year),
        AutoShieldError::InvalidParameter
    );

    let quote = pricing::quote(
        &pool.params,
        args.vehicle_value,
        args.tier,
        args.duration_days,
        args.fipe_pct,
        args.deductible_option,
    )
    .ok_or(AutoShieldError::MathOverflow)?;
    require!(
        quote.premium >= args.installments as u64,
        AutoShieldError::InvalidVehicleValue
    );
    require!(quote.premium <= args.max_premium, AutoShieldError::InvalidParameter);

    let first_installment = if args.installments == 1 {
        quote.premium
    } else {
        quote.premium / args.installments as u64
    };
    let inspection_fee = pool.params.inspection_fee;

    // Solvencia: apos receber a 1a parcela, o patrimonio dos LPs precisa cobrir
    // o colateral minimo sobre toda a cobertura ativa (incluindo a nova).
    let (fee, cashback) = split(pool, first_installment);
    let nav_after = pool
        .net_assets(ctx.accounts.vault.amount)
        .checked_add(first_installment - fee - cashback)
        .ok_or(AutoShieldError::MathOverflow)?;
    let coverage_after = pool
        .total_active_coverage
        .checked_add(quote.coverage_limit)
        .ok_or(AutoShieldError::MathOverflow)?;
    let required = pool
        .required_capital(coverage_after)
        .ok_or(AutoShieldError::MathOverflow)?;
    require!(nav_after >= required, AutoShieldError::InsufficientPoolCapital);
    // Limite de exposicao: nenhuma apolice isolada pode concentrar risco demais.
    require!(
        (quote.coverage_limit as u128) * (BPS_DENOMINATOR as u128)
            <= (nav_after as u128) * (pool.params.max_policy_coverage_bps as u128),
        AutoShieldError::ExposureLimit
    );

    token::transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.owner_token.to_account_info(),
                mint: ctx.accounts.stable_mint.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.owner.to_account_info(),
            },
        ),
        first_installment
            .checked_add(inspection_fee)
            .ok_or(AutoShieldError::MathOverflow)?,
        ctx.accounts.stable_mint.decimals,
    )?;

    let now = Clock::get()?.unix_timestamp;
    let duration_secs = (args.duration_days as i64)
        .checked_mul(pool.params.seconds_per_day)
        .ok_or(AutoShieldError::MathOverflow)?;
    let policy_id = pool.policy_count;
    let pool_key = pool.key();
    let claims_allowed_from = now
        .checked_add(pool.params.claim_waiting_secs)
        .ok_or(AutoShieldError::MathOverflow)?;

    let policy = &mut ctx.accounts.policy;
    policy.version = ACCOUNT_VERSION;
    policy.owner = ctx.accounts.owner.key();
    policy.pool = pool_key;
    policy.id = policy_id;
    policy.nonce = args.nonce;
    policy.plate_hash = args.plate_hash;
    policy.model = args.model;
    policy.year = args.year;
    policy.vehicle_value = args.vehicle_value;
    policy.tier = args.tier;
    policy.duration_days = args.duration_days;
    policy.premium_total = quote.premium;
    policy.installments = args.installments;
    policy.installment_period = duration_secs / args.installments as i64;
    policy.coverage_limit = quote.coverage_limit;
    policy.deductible = quote.deductible;
    policy.inspection_fee = inspection_fee;
    policy.start_ts = now;
    policy.end_ts = now
        .checked_add(duration_secs)
        .ok_or(AutoShieldError::MathOverflow)?;
    policy.status = PolicyStatus::Active;
    policy.inspector = Pubkey::default();
    policy.claims_allowed_from = claims_allowed_from;
    policy.fipe_pct = args.fipe_pct;
    policy.deductible_option = args.deductible_option;
    policy.fipe_code = args.fipe_code;
    policy.fipe_updated_ts = now;
    policy.pending_owner = Pubkey::default();
    policy.bump = ctx.bumps.policy;

    let vehicle = &mut ctx.accounts.vehicle;
    if vehicle.plate_hash == [0u8; 32] {
        vehicle.version = ACCOUNT_VERSION;
        vehicle.plate_hash = args.plate_hash;
        vehicle.bump = ctx.bumps.vehicle;
    }

    let pool = &mut ctx.accounts.pool;
    account_payment(pool, policy, first_installment)?;
    pool.pending_inspection_fees = pool
        .pending_inspection_fees
        .checked_add(inspection_fee)
        .ok_or(AutoShieldError::MathOverflow)?;
    pool.total_active_coverage = coverage_after;
    pool.policy_count += 1;
    pool.active_policies += 1;

    emit!(PolicyPurchased {
        policy: policy.key(),
        owner: policy.owner,
        id: policy.id,
        tier: policy.tier,
        premium: policy.premium_total,
        coverage_limit: policy.coverage_limit,
        end_ts: policy.end_ts,
    });
    Ok(())
}

#[derive(Accounts)]
pub struct PayInstallment<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(mut, seeds = [POOL_SEED], bump = pool.bump, has_one = vault, has_one = stable_mint)]
    pub pool: Account<'info, Pool>,

    pub stable_mint: Account<'info, Mint>,

    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,

    #[account(mut, token::mint = stable_mint, token::authority = owner)]
    pub owner_token: Account<'info, TokenAccount>,

    #[account(mut, has_one = pool, has_one = owner @ AutoShieldError::Unauthorized)]
    pub policy: Box<Account<'info, Policy>>,

    pub token_program: Program<'info, Token>,
}

/// Paga a proxima parcela. So e aceita ate o fim da tolerancia: depois disso a
/// apolice caducou (evita pagar so depois do acidente).
pub fn pay_installment(ctx: Context<PayInstallment>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let grace = ctx.accounts.pool.params.installment_grace_secs;
    let policy = &ctx.accounts.policy;
    require!(
        policy.status == PolicyStatus::Active,
        AutoShieldError::PolicyNotActive
    );
    require!(!policy.fully_paid(), AutoShieldError::AlreadyFullyPaid);
    require!(!policy.is_lapsed(now, grace), AutoShieldError::PolicyLapsed);
    let amount = policy.next_installment_amount();

    token::transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.owner_token.to_account_info(),
                mint: ctx.accounts.stable_mint.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.owner.to_account_info(),
            },
        ),
        amount,
        ctx.accounts.stable_mint.decimals,
    )?;

    let pool = &mut ctx.accounts.pool;
    let policy = &mut ctx.accounts.policy;
    account_payment(pool, policy, amount)?;

    emit!(InstallmentPaid {
        policy: policy.key(),
        owner: policy.owner,
        number: policy.installments_paid,
        amount,
        paid_until: policy.paid_until(),
    });
    Ok(())
}

/// Encerra uma apolice vencida ou caducada. Qualquer pessoa pode acionar (crank).
/// Cashback so e pago se a vigencia terminou, todas as parcelas foram pagas e
/// nao houve sinistro indenizado; caso contrario, volta aos LPs.
#[derive(Accounts)]
pub struct SettlePolicy<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(mut, seeds = [POOL_SEED], bump = pool.bump, has_one = vault, has_one = stable_mint)]
    pub pool: Account<'info, Pool>,

    pub stable_mint: Account<'info, Mint>,

    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,

    #[account(mut, has_one = pool, has_one = owner)]
    pub policy: Box<Account<'info, Policy>>,

    #[account(mut, seeds = [VEHICLE_SEED, policy.plate_hash.as_ref()], bump = vehicle.bump)]
    pub vehicle: Account<'info, VehicleRecord>,

    /// CHECK: validado via has_one na apolice.
    pub owner: UncheckedAccount<'info>,

    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = stable_mint,
        associated_token::authority = owner,
    )]
    pub owner_token: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn settle_policy(ctx: Context<SettlePolicy>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let grace = ctx.accounts.pool.params.installment_grace_secs;
    let policy = &ctx.accounts.policy;
    require!(
        policy.status == PolicyStatus::Active,
        AutoShieldError::PolicyNotActive
    );
    let ended = now > policy.end_ts;
    let lapsed = policy.is_lapsed(now, grace);
    require!(ended || lapsed, AutoShieldError::PolicyStillActive);
    require!(
        !policy.has_open_claim,
        AutoShieldError::OpenClaimBlocksSettlement
    );

    let cashback = policy.cashback_amount;
    let pay_cashback =
        ended && policy.fully_paid() && !policy.had_paid_claim && policy.inspected && cashback > 0;
    let remaining = policy.remaining_coverage();
    let unused_fee = if policy.inspected {
        0
    } else {
        policy.inspection_fee.saturating_sub(policy.inspection_fee_paid)
    };

    if pay_cashback {
        let bump = ctx.accounts.pool.bump;
        let signer_seeds: &[&[&[u8]]] = &[&[POOL_SEED, &[bump]]];
        token::transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.vault.to_account_info(),
                    mint: ctx.accounts.stable_mint.to_account_info(),
                    to: ctx.accounts.owner_token.to_account_info(),
                    authority: ctx.accounts.pool.to_account_info(),
                },
                signer_seeds,
            ),
            cashback,
            ctx.accounts.stable_mint.decimals,
        )?;
    }

    let pool = &mut ctx.accounts.pool;
    pool.total_active_coverage = pool.total_active_coverage.saturating_sub(remaining);
    pool.active_policies = pool.active_policies.saturating_sub(1);
    // Cashback pago ou revertido aos LPs: em ambos os casos deixa de ser reservado.
    pool.reserved_cashback = pool.reserved_cashback.saturating_sub(cashback);
    if pay_cashback {
        pool.total_cashback_paid = pool.total_cashback_paid.saturating_add(cashback);
    }
    // Apolice nunca vistoriada: a taxa de vistoria vira receita do protocolo.
    if unused_fee > 0 {
        pool.pending_inspection_fees = pool.pending_inspection_fees.saturating_sub(unused_fee);
        pool.treasury_accrued = pool.treasury_accrued.saturating_add(unused_fee);
    }

    let policy = &mut ctx.accounts.policy;
    policy.status = PolicyStatus::Settled;
    policy.cashback_redeemed = pay_cashback;
    if !pay_cashback {
        policy.cashback_amount = 0;
    }
    let policy_key = policy.key();
    let vehicle = &mut ctx.accounts.vehicle;
    if vehicle.active_policy == policy_key {
        vehicle.active_policy = Pubkey::default();
    }

    emit!(PolicySettled {
        policy: policy_key,
        owner: ctx.accounts.policy.owner,
        cashback_paid: if pay_cashback { cashback } else { 0 },
    });
    Ok(())
}

/// Vistoria previa feita por um avaliador, que recebe a taxa de vistoria em
/// qualquer resultado. Aprovada: trava a placa e libera sinistros apos a
/// carencia. Recusada (valor FIPE inflado, veiculo de outra pessoa, danos
/// previos): cancela a apolice e devolve o premio pago (sem a taxa de vistoria).
#[derive(Accounts)]
pub struct InspectPolicy<'info> {
    #[account(mut)]
    pub assessor: Signer<'info>,

    #[account(mut, seeds = [POOL_SEED], bump = pool.bump, has_one = vault, has_one = stable_mint)]
    pub pool: Account<'info, Pool>,

    pub stable_mint: Account<'info, Mint>,

    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,

    #[account(mut, has_one = pool, has_one = owner)]
    pub policy: Box<Account<'info, Policy>>,

    #[account(mut, seeds = [VEHICLE_SEED, policy.plate_hash.as_ref()], bump = vehicle.bump)]
    pub vehicle: Account<'info, VehicleRecord>,

    /// CHECK: validado via has_one na apolice.
    pub owner: UncheckedAccount<'info>,

    #[account(
        init_if_needed,
        payer = assessor,
        associated_token::mint = stable_mint,
        associated_token::authority = owner,
    )]
    pub owner_token: Account<'info, TokenAccount>,

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

fn vault_transfer<'info>(
    token_program: &Program<'info, Token>,
    vault: &Account<'info, TokenAccount>,
    mint: &Account<'info, Mint>,
    to: &Account<'info, TokenAccount>,
    pool: &Account<'info, Pool>,
    amount: u64,
) -> Result<()> {
    if amount == 0 {
        return Ok(());
    }
    let signer_seeds: &[&[&[u8]]] = &[&[POOL_SEED, &[pool.bump]]];
    token::transfer_checked(
        CpiContext::new_with_signer(
            token_program.to_account_info(),
            TransferChecked {
                from: vault.to_account_info(),
                mint: mint.to_account_info(),
                to: to.to_account_info(),
                authority: pool.to_account_info(),
            },
            signer_seeds,
        ),
        amount,
        mint.decimals,
    )
}

pub fn inspect_policy(ctx: Context<InspectPolicy>, approve: bool) -> Result<()> {
    let assessor = ctx.accounts.assessor.key();
    let pool = &ctx.accounts.pool;
    let policy = &ctx.accounts.policy;
    require!(pool.is_assessor(&assessor), AutoShieldError::NotAssessor);
    require!(policy.owner != assessor, AutoShieldError::AssessorConflict);
    require!(
        policy.status == PolicyStatus::Active,
        AutoShieldError::PolicyNotActive
    );
    require!(!policy.inspected, AutoShieldError::AlreadyInspected);
    require!(!policy.has_open_claim, AutoShieldError::ClaimAlreadyOpen);
    require!(
        !policy.inspection_voters.contains(&assessor),
        AutoShieldError::AlreadyVoted
    );
    require!(
        policy.inspection_voters.len() < MAX_ASSESSORS,
        AutoShieldError::InvalidParameter
    );

    let quorum = pool.inspection_quorum();
    let max_rejections = (pool.assessors.len() as u8).saturating_sub(quorum);
    let approvals = policy.inspection_approvals + approve as u8;
    let rejections = policy.inspection_rejections + (!approve) as u8;
    let approved = approvals >= quorum;
    let rejected = !approved && rejections > max_rejections;
    if approved {
        require!(
            ctx.accounts.vehicle.active_policy == Pubkey::default(),
            AutoShieldError::VehicleAlreadyInsured
        );
    }

    // Cada voto recebe uma fracao da taxa de vistoria (taxa / quorum).
    let fee_left = policy.inspection_fee.saturating_sub(policy.inspection_fee_paid);
    let share = (policy.inspection_fee / quorum as u64).min(fee_left);
    let refund = if rejected { policy.premium_paid } else { 0 };
    vault_transfer(
        &ctx.accounts.token_program,
        &ctx.accounts.vault,
        &ctx.accounts.stable_mint,
        &ctx.accounts.assessor_token,
        &ctx.accounts.pool,
        share,
    )?;
    vault_transfer(
        &ctx.accounts.token_program,
        &ctx.accounts.vault,
        &ctx.accounts.stable_mint,
        &ctx.accounts.owner_token,
        &ctx.accounts.pool,
        refund,
    )?;

    let policy_key = ctx.accounts.policy.key();
    let pool = &mut ctx.accounts.pool;
    let policy = &mut ctx.accounts.policy;
    pool.pending_inspection_fees = pool.pending_inspection_fees.saturating_sub(share);
    pool.total_assessor_rewards = pool.total_assessor_rewards.saturating_add(share);
    policy.inspection_fee_paid = policy.inspection_fee_paid.saturating_add(share);
    policy.inspection_voters.push(assessor);
    policy.inspection_approvals = approvals;
    policy.inspection_rejections = rejections;
    policy.inspector = assessor;

    if approved || rejected {
        // Sobra da taxa (votos que nao chegaram a ser necessarios) vira receita.
        let leftover = policy.inspection_fee.saturating_sub(policy.inspection_fee_paid);
        pool.pending_inspection_fees = pool.pending_inspection_fees.saturating_sub(leftover);
        pool.treasury_accrued = pool.treasury_accrued.saturating_add(leftover);
        policy.inspection_fee_paid = policy.inspection_fee;
    }

    if approved {
        policy.inspected = true;
        let vehicle = &mut ctx.accounts.vehicle;
        vehicle.active_policy = policy_key;
        vehicle.policies_count = vehicle.policies_count.saturating_add(1);
    } else if rejected {
        // Estorna tudo o que esta apolice gerou na contabilidade do pool.
        pool.total_active_coverage = pool
            .total_active_coverage
            .saturating_sub(policy.remaining_coverage());
        pool.reserved_cashback = pool.reserved_cashback.saturating_sub(policy.cashback_amount);
        pool.treasury_accrued = pool.treasury_accrued.saturating_sub(policy.protocol_fees_paid);
        pool.total_protocol_fees = pool.total_protocol_fees.saturating_sub(policy.protocol_fees_paid);
        pool.total_premiums = pool.total_premiums.saturating_sub(policy.premium_paid);
        pool.active_policies = pool.active_policies.saturating_sub(1);
        policy.status = PolicyStatus::Cancelled;
        policy.cashback_amount = 0;
    }

    if share > 0 {
        emit!(AssessorPaid {
            assessor,
            amount: share,
            kind: 0,
        });
    }
    if approved || rejected {
        emit!(PolicyInspected {
            policy: policy_key,
            inspector: assessor,
            approved,
        });
    }
    Ok(())
}

/// Fecha uma apolice encerrada ou cancelada e devolve o aluguel (SOL) ao titular.
#[derive(Accounts)]
pub struct ClosePolicy<'info> {
    pub caller: Signer<'info>,

    #[account(
        mut,
        close = owner,
        has_one = owner,
        constraint = policy.status != PolicyStatus::Active @ AutoShieldError::AccountNotClosable,
        constraint = !policy.has_open_claim @ AutoShieldError::AccountNotClosable
    )]
    pub policy: Box<Account<'info, Policy>>,

    /// CHECK: recebe o aluguel; validado via has_one.
    #[account(mut)]
    pub owner: UncheckedAccount<'info>,
}

pub fn close_policy(_ctx: Context<ClosePolicy>) -> Result<()> {
    Ok(())
}

// ---------------------------------------------------------------------------
// Cancelamento pelo titular

#[derive(Accounts)]
pub struct CancelPolicy<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(mut, seeds = [POOL_SEED], bump = pool.bump, has_one = vault, has_one = stable_mint)]
    pub pool: Account<'info, Pool>,

    pub stable_mint: Account<'info, Mint>,

    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,

    #[account(mut, has_one = pool, has_one = owner @ AutoShieldError::Unauthorized)]
    pub policy: Box<Account<'info, Policy>>,

    #[account(mut, seeds = [VEHICLE_SEED, policy.plate_hash.as_ref()], bump = vehicle.bump)]
    pub vehicle: Account<'info, VehicleRecord>,

    #[account(
        init_if_needed,
        payer = owner,
        associated_token::mint = stable_mint,
        associated_token::authority = owner,
    )]
    pub owner_token: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

/// Cancela a apolice a pedido do titular.
///
/// - Arrependimento (CDC art. 49): ate 7 dias da contratacao e sem sinistro,
///   devolve tudo o que foi pago (premio e taxa de vistoria).
/// - Depois disso: devolve o premio pago e ainda nao usado (proporcional ao
///   tempo restante), sem a taxa do protocolo. Com sinistro ja indenizado nao
///   ha devolucao. O cashback acumulado e perdido.
pub fn cancel_policy(ctx: Context<CancelPolicy>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let pool = &ctx.accounts.pool;
    let policy = &ctx.accounts.policy;
    require!(policy.status == PolicyStatus::Active, AutoShieldError::PolicyNotActive);
    require!(!policy.has_open_claim, AutoShieldError::ClaimAlreadyOpen);

    let cooling_end = policy
        .start_ts
        .saturating_add(COOLING_OFF_DAYS.saturating_mul(pool.params.seconds_per_day));
    let cooling_off = now <= cooling_end && policy.claims_filed == 0;
    let unpaid_inspection = policy.inspection_fee.saturating_sub(policy.inspection_fee_paid);

    let refund = if cooling_off {
        policy
            .premium_paid
            .checked_add(policy.inspection_fee)
            .ok_or(AutoShieldError::MathOverflow)?
    } else if policy.had_paid_claim {
        0
    } else {
        let duration = policy.end_ts.saturating_sub(policy.start_ts).max(1) as u128;
        let elapsed = now.clamp(policy.start_ts, policy.end_ts).saturating_sub(policy.start_ts) as u128;
        let earned = u64::try_from(policy.premium_total as u128 * elapsed / duration)
            .map_err(|_| AutoShieldError::MathOverflow)?;
        let unused = policy.premium_paid.saturating_sub(earned) as u128;
        u64::try_from(
            unused * (BPS_DENOMINATOR - pool.params.protocol_fee_bps as u64) as u128 / BPS_DENOMINATOR as u128,
        )
        .map_err(|_| AutoShieldError::MathOverflow)?
    };

    vault_transfer(
        &ctx.accounts.token_program,
        &ctx.accounts.vault,
        &ctx.accounts.stable_mint,
        &ctx.accounts.owner_token,
        &ctx.accounts.pool,
        refund,
    )?;

    let policy_key = ctx.accounts.policy.key();
    let pool = &mut ctx.accounts.pool;
    let policy = &mut ctx.accounts.policy;
    pool.total_active_coverage = pool.total_active_coverage.saturating_sub(policy.remaining_coverage());
    pool.active_policies = pool.active_policies.saturating_sub(1);
    pool.reserved_cashback = pool.reserved_cashback.saturating_sub(policy.cashback_amount);
    pool.pending_inspection_fees = pool.pending_inspection_fees.saturating_sub(unpaid_inspection);
    if cooling_off {
        // Estorna o que a apolice gerou; a parte da taxa de vistoria ja paga ao
        // avaliador e absorvida pelo patrimonio dos LPs.
        pool.treasury_accrued = pool.treasury_accrued.saturating_sub(policy.protocol_fees_paid);
        pool.total_protocol_fees = pool.total_protocol_fees.saturating_sub(policy.protocol_fees_paid);
        pool.total_premiums = pool.total_premiums.saturating_sub(policy.premium_paid);
    } else if unpaid_inspection > 0 {
        // Vistoria que nao chegou a acontecer: a taxa vira receita do protocolo.
        pool.treasury_accrued = pool.treasury_accrued.saturating_add(unpaid_inspection);
    }
    policy.inspection_fee_paid = policy.inspection_fee;
    policy.cashback_amount = 0;
    policy.pending_owner = Pubkey::default();
    policy.status = PolicyStatus::CancelledByOwner;

    let vehicle = &mut ctx.accounts.vehicle;
    if vehicle.active_policy == policy_key {
        vehicle.active_policy = Pubkey::default();
    }

    emit!(PolicyCancelled {
        policy: policy_key,
        owner: policy.owner,
        refund,
        cooling_off,
    });
    Ok(())
}

// ---------------------------------------------------------------------------
// Transferencia na venda do veiculo (proposta do titular + aceite do comprador)

#[derive(Accounts)]
pub struct ProposeTransfer<'info> {
    pub owner: Signer<'info>,

    #[account(mut, has_one = owner @ AutoShieldError::Unauthorized)]
    pub policy: Box<Account<'info, Policy>>,
}

/// `new_owner = Pubkey::default()` cancela uma transferencia proposta.
pub fn propose_transfer(ctx: Context<ProposeTransfer>, new_owner: Pubkey) -> Result<()> {
    let policy = &mut ctx.accounts.policy;
    require!(policy.status == PolicyStatus::Active, AutoShieldError::PolicyNotActive);
    require!(new_owner != policy.owner, AutoShieldError::InvalidParameter);
    policy.pending_owner = new_owner;
    Ok(())
}

#[derive(Accounts)]
pub struct AcceptTransfer<'info> {
    pub new_owner: Signer<'info>,

    #[account(mut)]
    pub policy: Box<Account<'info, Policy>>,
}

/// O comprador aceita: a apolice (com cobertura e cashback acumulado) passa a ser dele.
pub fn accept_transfer(ctx: Context<AcceptTransfer>) -> Result<()> {
    let signer = ctx.accounts.new_owner.key();
    let policy = &mut ctx.accounts.policy;
    require!(
        policy.pending_owner != Pubkey::default() && policy.pending_owner == signer,
        AutoShieldError::NotPendingOwner
    );
    require!(policy.status == PolicyStatus::Active, AutoShieldError::PolicyNotActive);
    require!(!policy.has_open_claim, AutoShieldError::ClaimAlreadyOpen);
    let from = policy.owner;
    policy.owner = signer;
    policy.pending_owner = Pubkey::default();
    emit!(PolicyTransferred {
        policy: policy.key(),
        from,
        to: signer,
    });
    Ok(())
}

// ---------------------------------------------------------------------------
// Atualizacao do valor FIPE (oraculo)

#[derive(Accounts)]
pub struct UpdatePolicyFipe<'info> {
    pub oracle: Signer<'info>,

    #[account(
        mut,
        seeds = [POOL_SEED],
        bump = pool.bump,
        has_one = oracle @ AutoShieldError::NotOracle,
        has_one = vault
    )]
    pub pool: Account<'info, Pool>,

    pub vault: Account<'info, TokenAccount>,

    #[account(mut, has_one = pool)]
    pub policy: Box<Account<'info, Policy>>,
}

/// Atualiza o valor FIPE de uma apolice ativa (rodado mensalmente pelo
/// servico de precos): cobertura e franquia acompanham a tabela, e a
/// indenizacao por perda total usa o valor vigente na data do sinistro.
/// Cada atualizacao pode variar no maximo 20%.
pub fn update_policy_fipe(ctx: Context<UpdatePolicyFipe>, vehicle_value: u64) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let policy = &ctx.accounts.policy;
    require!(policy.status == PolicyStatus::Active, AutoShieldError::PolicyNotActive);
    require!(!policy.has_open_claim, AutoShieldError::ClaimAlreadyOpen);
    require!(vehicle_value > 0, AutoShieldError::InvalidVehicleValue);
    let old = policy.vehicle_value as u128;
    let diff = (vehicle_value as u128).abs_diff(old);
    require!(
        diff * (BPS_DENOMINATOR as u128) <= old * (MAX_FIPE_CHANGE_BPS as u128),
        AutoShieldError::FipeChangeTooLarge
    );

    let coverage = pricing::coverage_for(vehicle_value, policy.fipe_pct).ok_or(AutoShieldError::MathOverflow)?;
    let deductible =
        pricing::deductible_for(coverage, policy.deductible_option).ok_or(AutoShieldError::MathOverflow)?;
    let old_remaining = policy.remaining_coverage();
    let new_remaining = coverage.saturating_sub(policy.total_paid_out);

    let pool = &ctx.accounts.pool;
    let coverage_after = pool
        .total_active_coverage
        .saturating_sub(old_remaining)
        .checked_add(new_remaining)
        .ok_or(AutoShieldError::MathOverflow)?;
    if new_remaining > old_remaining {
        let required = pool.required_capital(coverage_after).ok_or(AutoShieldError::MathOverflow)?;
        require!(
            pool.net_assets(ctx.accounts.vault.amount) >= required,
            AutoShieldError::InsufficientPoolCapital
        );
    }

    ctx.accounts.pool.total_active_coverage = coverage_after;
    let policy = &mut ctx.accounts.policy;
    policy.vehicle_value = vehicle_value;
    policy.coverage_limit = coverage;
    policy.deductible = deductible;
    policy.fipe_updated_ts = now;
    emit!(FipeUpdated {
        policy: policy.key(),
        vehicle_value,
        coverage_limit: coverage,
    });
    Ok(())
}
