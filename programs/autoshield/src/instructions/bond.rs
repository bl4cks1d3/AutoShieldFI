use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, TransferChecked};

use crate::constants::*;
use crate::errors::AutoShieldError;
use crate::state::{AssessorRecord, Pool, ACCOUNT_VERSION};

/// Garantia dos avaliadores: fica no cofre, fora do patrimonio dos LPs, e pode
/// ser parcialmente perdida por votos contra o resultado final.
#[derive(Accounts)]
pub struct AssessorBond<'info> {
    #[account(mut)]
    pub assessor: Signer<'info>,

    #[account(mut, seeds = [POOL_SEED], bump = pool.bump, has_one = vault, has_one = stable_mint)]
    pub pool: Account<'info, Pool>,

    pub stable_mint: Account<'info, Mint>,

    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,

    #[account(mut, token::mint = stable_mint, token::authority = assessor)]
    pub assessor_token: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = assessor,
        space = 8 + AssessorRecord::INIT_SPACE,
        seeds = [ASSESSOR_SEED, assessor.key().as_ref()],
        bump
    )]
    pub assessor_record: Box<Account<'info, AssessorRecord>>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn post_bond(ctx: Context<AssessorBond>, amount: u64) -> Result<()> {
    require!(amount > 0, AutoShieldError::ZeroAmount);
    token::transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.assessor_token.to_account_info(),
                mint: ctx.accounts.stable_mint.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.assessor.to_account_info(),
            },
        ),
        amount,
        ctx.accounts.stable_mint.decimals,
    )?;
    let assessor = ctx.accounts.assessor.key();
    let record = &mut ctx.accounts.assessor_record;
    if record.assessor == Pubkey::default() {
        record.version = ACCOUNT_VERSION;
        record.assessor = assessor;
        record.bump = ctx.bumps.assessor_record;
    }
    record.bond = record.bond.checked_add(amount).ok_or(AutoShieldError::MathOverflow)?;
    let pool = &mut ctx.accounts.pool;
    pool.assessor_bonds = pool.assessor_bonds.checked_add(amount).ok_or(AutoShieldError::MathOverflow)?;
    Ok(())
}

/// Retira garantia. Enquanto for do comite, o avaliador precisa manter o minimo.
pub fn withdraw_bond(ctx: Context<AssessorBond>, amount: u64) -> Result<()> {
    require!(amount > 0, AutoShieldError::ZeroAmount);
    let assessor = ctx.accounts.assessor.key();
    let pool = &ctx.accounts.pool;
    let record = &ctx.accounts.assessor_record;
    require!(record.bond >= amount, AutoShieldError::InsufficientBond);
    if pool.is_assessor(&assessor) {
        require!(record.bond - amount >= pool.min_assessor_bond, AutoShieldError::InsufficientBond);
    }
    let signer_seeds: &[&[&[u8]]] = &[&[POOL_SEED, &[pool.bump]]];
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
        amount,
        ctx.accounts.stable_mint.decimals,
    )?;
    ctx.accounts.assessor_record.bond -= amount;
    let pool = &mut ctx.accounts.pool;
    pool.assessor_bonds = pool.assessor_bonds.saturating_sub(amount);
    Ok(())
}
