use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, TransferChecked};

use crate::constants::*;
use crate::errors::AutoShieldError;
use crate::events::{LiquidityDeposited, LiquidityWithdrawn};
use crate::state::{Pool, StakePosition, ACCOUNT_VERSION};

#[derive(Accounts)]
pub struct DepositLiquidity<'info> {
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
        init_if_needed,
        payer = owner,
        space = 8 + StakePosition::INIT_SPACE,
        seeds = [STAKE_SEED, pool.key().as_ref(), owner.key().as_ref()],
        bump
    )]
    pub position: Account<'info, StakePosition>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn deposit_liquidity(ctx: Context<DepositLiquidity>, amount: u64) -> Result<()> {
    require!(amount > 0, AutoShieldError::ZeroAmount);
    let pool = &ctx.accounts.pool;
    require!(!pool.paused, AutoShieldError::Paused);

    let nav = pool.net_assets(ctx.accounts.vault.amount);
    let first = pool.total_shares == 0;
    // No primeiro aporte, DEAD_SHARES ficam sem dono para sempre: a cota nunca
    // mais parte de zero e doacoes diretas ao cofre nao distorcem o preco.
    let shares = if first {
        require!(amount >= MIN_FIRST_DEPOSIT, AutoShieldError::FirstDepositTooSmall);
        amount - DEAD_SHARES
    } else {
        require!(nav > 0, AutoShieldError::InsufficientPoolCapital);
        u64::try_from(
            (amount as u128)
                .checked_mul(pool.total_shares as u128)
                .ok_or(AutoShieldError::MathOverflow)?
                / nav as u128,
        )
        .map_err(|_| AutoShieldError::MathOverflow)?
    };
    require!(shares > 0, AutoShieldError::ZeroAmount);

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

    let now = Clock::get()?.unix_timestamp;
    let position = &mut ctx.accounts.position;
    if position.owner == Pubkey::default() {
        position.version = ACCOUNT_VERSION;
        position.owner = ctx.accounts.owner.key();
        position.pool = ctx.accounts.pool.key();
        position.bump = ctx.bumps.position;
    }
    position.shares = position
        .shares
        .checked_add(shares)
        .ok_or(AutoShieldError::MathOverflow)?;
    position.total_deposited = position
        .total_deposited
        .checked_add(amount)
        .ok_or(AutoShieldError::MathOverflow)?;
    position.last_deposit_ts = now;

    let pool = &mut ctx.accounts.pool;
    let minted_total = if first { amount } else { shares };
    pool.total_shares = pool
        .total_shares
        .checked_add(minted_total)
        .ok_or(AutoShieldError::MathOverflow)?;

    emit!(LiquidityDeposited {
        owner: position.owner,
        amount,
        shares,
    });
    Ok(())
}

#[derive(Accounts)]
pub struct WithdrawLiquidity<'info> {
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
        mut,
        seeds = [STAKE_SEED, pool.key().as_ref(), owner.key().as_ref()],
        bump = position.bump,
        has_one = owner @ AutoShieldError::Unauthorized
    )]
    pub position: Account<'info, StakePosition>,

    pub token_program: Program<'info, Token>,
}

pub fn withdraw_liquidity(ctx: Context<WithdrawLiquidity>, shares: u64) -> Result<()> {
    require!(shares > 0, AutoShieldError::ZeroAmount);
    let now = Clock::get()?.unix_timestamp;
    let position = &ctx.accounts.position;
    let pool = &ctx.accounts.pool;
    require!(position.shares >= shares, AutoShieldError::InsufficientShares);
    require!(
        now >= position
            .last_deposit_ts
            .saturating_add(pool.params.withdraw_cooldown_secs),
        AutoShieldError::WithdrawCooldown
    );

    let nav = pool.net_assets(ctx.accounts.vault.amount);
    let amount = u64::try_from(
        (shares as u128)
            .checked_mul(nav as u128)
            .ok_or(AutoShieldError::MathOverflow)?
            / pool.total_shares as u128,
    )
    .map_err(|_| AutoShieldError::MathOverflow)?;
    require!(amount > 0, AutoShieldError::ZeroAmount);

    let required = pool
        .required_capital(pool.total_active_coverage)
        .ok_or(AutoShieldError::MathOverflow)?;
    require!(
        nav.saturating_sub(amount) >= required,
        AutoShieldError::WithdrawBreaksSolvency
    );

    let signer_seeds: &[&[&[u8]]] = &[&[POOL_SEED, &[pool.bump]]];
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
        amount,
        ctx.accounts.stable_mint.decimals,
    )?;

    let position = &mut ctx.accounts.position;
    position.shares -= shares;
    position.total_withdrawn = position
        .total_withdrawn
        .checked_add(amount)
        .ok_or(AutoShieldError::MathOverflow)?;
    let pool = &mut ctx.accounts.pool;
    pool.total_shares -= shares;

    emit!(LiquidityWithdrawn {
        owner: position.owner,
        amount,
        shares,
    });
    Ok(())
}
