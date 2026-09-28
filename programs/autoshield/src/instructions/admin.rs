use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::constants::*;
use crate::errors::AutoShieldError;
use crate::events::PoolInitialized;
use crate::state::{Pool, PoolParams};

#[derive(Accounts)]
pub struct InitializePool<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + Pool::INIT_SPACE,
        seeds = [POOL_SEED],
        bump
    )]
    pub pool: Account<'info, Pool>,

    pub stable_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = authority,
        seeds = [VAULT_SEED, pool.key().as_ref()],
        bump,
        token::mint = stable_mint,
        token::authority = pool,
    )]
    pub vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn initialize_pool(
    ctx: Context<InitializePool>,
    params: PoolParams,
    assessors: Vec<Pubkey>,
    approval_threshold: u8,
) -> Result<()> {
    require!(params.validate(), AutoShieldError::InvalidParameter);
    validate_assessors(&assessors, approval_threshold)?;

    let pool = &mut ctx.accounts.pool;
    pool.authority = ctx.accounts.authority.key();
    pool.stable_mint = ctx.accounts.stable_mint.key();
    pool.vault = ctx.accounts.vault.key();
    pool.total_shares = 0;
    pool.total_active_coverage = 0;
    pool.reserved_cashback = 0;
    pool.pending_claims = 0;
    pool.total_premiums = 0;
    pool.total_claims_paid = 0;
    pool.total_cashback_paid = 0;
    pool.policy_count = 0;
    pool.claim_count = 0;
    pool.active_policies = 0;
    pool.params = params;
    pool.assessors = assessors;
    pool.approval_threshold = approval_threshold;
    pool.paused = false;
    pool.bump = ctx.bumps.pool;
    pool.vault_bump = ctx.bumps.vault;

    emit!(PoolInitialized {
        pool: pool.key(),
        authority: pool.authority,
        stable_mint: pool.stable_mint,
    });
    Ok(())
}

#[derive(Accounts)]
pub struct AdminAction<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [POOL_SEED],
        bump = pool.bump,
        has_one = authority @ AutoShieldError::Unauthorized
    )]
    pub pool: Account<'info, Pool>,
}

pub fn update_params(ctx: Context<AdminAction>, params: PoolParams) -> Result<()> {
    require!(params.validate(), AutoShieldError::InvalidParameter);
    ctx.accounts.pool.params = params;
    Ok(())
}

pub fn set_assessors(
    ctx: Context<AdminAction>,
    assessors: Vec<Pubkey>,
    approval_threshold: u8,
) -> Result<()> {
    validate_assessors(&assessors, approval_threshold)?;
    let pool = &mut ctx.accounts.pool;
    pool.assessors = assessors;
    pool.approval_threshold = approval_threshold;
    Ok(())
}

pub fn set_paused(ctx: Context<AdminAction>, paused: bool) -> Result<()> {
    ctx.accounts.pool.paused = paused;
    Ok(())
}

pub fn transfer_authority(ctx: Context<AdminAction>, new_authority: Pubkey) -> Result<()> {
    ctx.accounts.pool.authority = new_authority;
    Ok(())
}

fn validate_assessors(assessors: &[Pubkey], threshold: u8) -> Result<()> {
    require!(
        !assessors.is_empty() && assessors.len() <= MAX_ASSESSORS,
        AutoShieldError::InvalidParameter
    );
    require!(
        threshold > 0 && (threshold as usize) <= assessors.len(),
        AutoShieldError::InvalidParameter
    );
    for (i, a) in assessors.iter().enumerate() {
        require!(
            !assessors[..i].contains(a),
            AutoShieldError::InvalidParameter
        );
    }
    Ok(())
}
