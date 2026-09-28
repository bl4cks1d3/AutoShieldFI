use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, TransferChecked};

use crate::constants::*;
use crate::errors::AutoShieldError;
use crate::events::{PolicyPurchased, PolicySettled};
use crate::pricing;
use crate::state::{CoverageTier, Policy, PolicyStatus, Pool};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct PurchasePolicyArgs {
    /// Nonce escolhido pelo cliente para derivar o PDA da apolice.
    pub nonce: u64,
    pub plate: String,
    pub model: String,
    pub year: u16,
    pub vehicle_value: u64,
    pub tier: CoverageTier,
    pub duration_days: u16,
    /// Protecao contra slippage: premio maximo aceito pelo usuario.
    pub max_premium: u64,
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
    pub policy: Account<'info, Policy>,

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
    require!(args.vehicle_value > 0, AutoShieldError::InvalidVehicleValue);
    require!(
        !args.plate.is_empty() && args.plate.len() <= MAX_PLATE_LEN,
        AutoShieldError::StringTooLong
    );
    require!(args.model.len() <= MAX_MODEL_LEN, AutoShieldError::StringTooLong);
    require!(
        (1950..=2100).contains(&args.year),
        AutoShieldError::InvalidParameter
    );

    let quote = pricing::quote(&pool.params, args.vehicle_value, args.tier, args.duration_days)
        .ok_or(AutoShieldError::MathOverflow)?;
    require!(quote.premium > 0, AutoShieldError::InvalidVehicleValue);
    require!(quote.premium <= args.max_premium, AutoShieldError::InvalidParameter);

    // Solvencia: apos receber o premio, o patrimonio dos provedores precisa
    // cobrir o colateral minimo sobre toda a cobertura ativa (incluindo a nova).
    let vault_after = ctx
        .accounts
        .vault
        .amount
        .checked_add(quote.premium)
        .ok_or(AutoShieldError::MathOverflow)?;
    let reserved_after = pool
        .reserved_cashback
        .checked_add(quote.cashback)
        .ok_or(AutoShieldError::MathOverflow)?;
    let coverage_after = pool
        .total_active_coverage
        .checked_add(quote.coverage_limit)
        .ok_or(AutoShieldError::MathOverflow)?;
    let required = pool
        .required_capital(coverage_after)
        .ok_or(AutoShieldError::MathOverflow)?;
    require!(
        vault_after.saturating_sub(reserved_after) >= required,
        AutoShieldError::InsufficientPoolCapital
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
        quote.premium,
        ctx.accounts.stable_mint.decimals,
    )?;

    let now = Clock::get()?.unix_timestamp;
    let duration_secs = (args.duration_days as i64)
        .checked_mul(pool.params.seconds_per_day)
        .ok_or(AutoShieldError::MathOverflow)?;
    let policy_id = pool.policy_count;
    let pool_key = pool.key();

    let policy = &mut ctx.accounts.policy;
    policy.owner = ctx.accounts.owner.key();
    policy.pool = pool_key;
    policy.id = policy_id;
    policy.nonce = args.nonce;
    policy.plate = args.plate.to_uppercase();
    policy.model = args.model;
    policy.year = args.year;
    policy.vehicle_value = args.vehicle_value;
    policy.tier = args.tier;
    policy.duration_days = args.duration_days;
    policy.premium_paid = quote.premium;
    policy.coverage_limit = quote.coverage_limit;
    policy.deductible = quote.deductible;
    policy.cashback_amount = quote.cashback;
    policy.start_ts = now;
    policy.end_ts = now
        .checked_add(duration_secs)
        .ok_or(AutoShieldError::MathOverflow)?;
    policy.status = PolicyStatus::Active;
    policy.claims_filed = 0;
    policy.has_open_claim = false;
    policy.had_paid_claim = false;
    policy.total_paid_out = 0;
    policy.cashback_redeemed = false;
    policy.bump = ctx.bumps.policy;

    let pool = &mut ctx.accounts.pool;
    pool.total_active_coverage = coverage_after;
    pool.reserved_cashback = reserved_after;
    pool.total_premiums = pool
        .total_premiums
        .checked_add(quote.premium)
        .ok_or(AutoShieldError::MathOverflow)?;
    pool.policy_count += 1;
    pool.active_policies += 1;

    emit!(PolicyPurchased {
        policy: policy.key(),
        owner: policy.owner,
        id: policy.id,
        tier: policy.tier,
        premium: policy.premium_paid,
        coverage_limit: policy.coverage_limit,
        end_ts: policy.end_ts,
    });
    Ok(())
}

/// Encerra uma apolice vencida. Qualquer pessoa pode acionar (crank).
/// Se nao houve sinistro pago, o cashback e devolvido ao motorista.
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
    pub policy: Account<'info, Policy>,

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
    let policy = &ctx.accounts.policy;
    require!(
        policy.status == PolicyStatus::Active,
        AutoShieldError::PolicyNotActive
    );
    require!(now > policy.end_ts, AutoShieldError::PolicyStillActive);
    require!(
        !policy.has_open_claim,
        AutoShieldError::OpenClaimBlocksSettlement
    );

    let pay_cashback = !policy.had_paid_claim && policy.cashback_amount > 0;
    let cashback = if pay_cashback { policy.cashback_amount } else { 0 };
    let remaining = policy.remaining_coverage();

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
    if pay_cashback {
        pool.reserved_cashback = pool.reserved_cashback.saturating_sub(cashback);
        pool.total_cashback_paid = pool
            .total_cashback_paid
            .checked_add(cashback)
            .ok_or(AutoShieldError::MathOverflow)?;
    }

    let policy = &mut ctx.accounts.policy;
    policy.status = PolicyStatus::Settled;
    policy.cashback_redeemed = pay_cashback;

    emit!(PolicySettled {
        policy: policy.key(),
        owner: policy.owner,
        cashback_paid: cashback,
    });
    Ok(())
}
