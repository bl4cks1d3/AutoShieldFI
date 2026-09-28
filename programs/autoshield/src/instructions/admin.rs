use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, TransferChecked};

use crate::constants::*;
use crate::errors::AutoShieldError;
use crate::events::{GovernanceChangeApplied, GovernanceChangeProposed, PoolInitialized, TreasuryWithdrawn};
use crate::program::Autoshield;
use crate::state::{Pool, PoolParams, ACCOUNT_VERSION};

/// Somente a autoridade de upgrade do programa pode criar o pool. Sem isso,
/// qualquer pessoa poderia inicializa-lo logo apos o deploy e tomar o controle.
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

    #[account(constraint = program.programdata_address()? == Some(program_data.key()) @ AutoShieldError::Unauthorized)]
    pub program: Program<'info, Autoshield>,

    #[account(constraint = program_data.upgrade_authority_address == Some(authority.key()) @ AutoShieldError::Unauthorized)]
    pub program_data: Account<'info, ProgramData>,

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
    pool.version = ACCOUNT_VERSION;
    pool.authority = ctx.accounts.authority.key();
    pool.stable_mint = ctx.accounts.stable_mint.key();
    pool.vault = ctx.accounts.vault.key();
    pool.params = params;
    pool.assessors = assessors;
    pool.approval_threshold = approval_threshold;
    pool.paused = false;
    pool.pending_params = None;
    pool.pending_assessors = Vec::new();
    pool.pending_authority = Pubkey::default();
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

/// Qualquer pessoa pode aplicar uma mudanca cujo timelock ja expirou.
#[derive(Accounts)]
pub struct ApplyGovernance<'info> {
    pub caller: Signer<'info>,

    #[account(mut, seeds = [POOL_SEED], bump = pool.bump)]
    pub pool: Account<'info, Pool>,
}

pub fn propose_params(ctx: Context<AdminAction>, params: PoolParams) -> Result<()> {
    require!(params.validate(), AutoShieldError::InvalidParameter);
    let now = Clock::get()?.unix_timestamp;
    let pool = &mut ctx.accounts.pool;
    let eta = now
        .checked_add(pool.params.governance_delay_secs)
        .ok_or(AutoShieldError::MathOverflow)?;
    pool.pending_params = Some(params);
    pool.pending_params_eta = eta;
    emit!(GovernanceChangeProposed { kind: 0, eta });
    Ok(())
}

pub fn apply_params(ctx: Context<ApplyGovernance>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let pool = &mut ctx.accounts.pool;
    let params = pool.pending_params.ok_or(AutoShieldError::NoPendingChange)?;
    require!(now >= pool.pending_params_eta, AutoShieldError::TimelockActive);
    pool.params = params;
    pool.pending_params = None;
    pool.pending_params_eta = 0;
    emit!(GovernanceChangeApplied { kind: 0 });
    Ok(())
}

pub fn propose_assessors(
    ctx: Context<AdminAction>,
    assessors: Vec<Pubkey>,
    approval_threshold: u8,
) -> Result<()> {
    validate_assessors(&assessors, approval_threshold)?;
    let now = Clock::get()?.unix_timestamp;
    let pool = &mut ctx.accounts.pool;
    let eta = now
        .checked_add(pool.params.governance_delay_secs)
        .ok_or(AutoShieldError::MathOverflow)?;
    pool.pending_assessors = assessors;
    pool.pending_threshold = approval_threshold;
    pool.pending_assessors_eta = eta;
    emit!(GovernanceChangeProposed { kind: 1, eta });
    Ok(())
}

pub fn apply_assessors(ctx: Context<ApplyGovernance>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let pool = &mut ctx.accounts.pool;
    require!(!pool.pending_assessors.is_empty(), AutoShieldError::NoPendingChange);
    require!(now >= pool.pending_assessors_eta, AutoShieldError::TimelockActive);
    pool.assessors = std::mem::take(&mut pool.pending_assessors);
    pool.approval_threshold = pool.pending_threshold;
    pool.pending_threshold = 0;
    pool.pending_assessors_eta = 0;
    emit!(GovernanceChangeApplied { kind: 1 });
    Ok(())
}

pub fn cancel_pending(ctx: Context<AdminAction>) -> Result<()> {
    let pool = &mut ctx.accounts.pool;
    pool.pending_params = None;
    pool.pending_params_eta = 0;
    pool.pending_assessors = Vec::new();
    pool.pending_threshold = 0;
    pool.pending_assessors_eta = 0;
    pool.pending_authority = Pubkey::default();
    Ok(())
}

/// Pausa e imediata (emergencia); bloqueia contratacoes e aportes.
pub fn set_paused(ctx: Context<AdminAction>, paused: bool) -> Result<()> {
    ctx.accounts.pool.paused = paused;
    Ok(())
}

/// Passo 1: a autoridade atual propoe a nova.
pub fn propose_authority(ctx: Context<AdminAction>, new_authority: Pubkey) -> Result<()> {
    ctx.accounts.pool.pending_authority = new_authority;
    Ok(())
}

#[derive(Accounts)]
pub struct AcceptAuthority<'info> {
    pub new_authority: Signer<'info>,

    #[account(mut, seeds = [POOL_SEED], bump = pool.bump)]
    pub pool: Account<'info, Pool>,
}

/// Passo 2: a nova autoridade assina e aceita (evita perder o controle por
/// uma chave digitada errada).
pub fn accept_authority(ctx: Context<AcceptAuthority>) -> Result<()> {
    let pool = &mut ctx.accounts.pool;
    require!(
        pool.pending_authority != Pubkey::default()
            && pool.pending_authority == ctx.accounts.new_authority.key(),
        AutoShieldError::NotPendingAuthority
    );
    pool.authority = pool.pending_authority;
    pool.pending_authority = Pubkey::default();
    Ok(())
}

#[derive(Accounts)]
pub struct WithdrawTreasury<'info> {
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

    #[account(mut, token::mint = stable_mint)]
    pub destination: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

/// Saca a receita do protocolo. Nunca toca no patrimonio dos LPs, no cashback
/// reservado nem nas taxas de vistoria pendentes.
pub fn withdraw_treasury(ctx: Context<WithdrawTreasury>, amount: u64) -> Result<()> {
    require!(amount > 0, AutoShieldError::ZeroAmount);
    require!(
        amount <= ctx.accounts.pool.treasury_accrued,
        AutoShieldError::InsufficientTreasury
    );
    let bump = ctx.accounts.pool.bump;
    let signer_seeds: &[&[&[u8]]] = &[&[POOL_SEED, &[bump]]];
    token::transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.vault.to_account_info(),
                mint: ctx.accounts.stable_mint.to_account_info(),
                to: ctx.accounts.destination.to_account_info(),
                authority: ctx.accounts.pool.to_account_info(),
            },
            signer_seeds,
        ),
        amount,
        ctx.accounts.stable_mint.decimals,
    )?;
    ctx.accounts.pool.treasury_accrued -= amount;
    emit!(TreasuryWithdrawn {
        destination: ctx.accounts.destination.key(),
        amount,
    });
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
