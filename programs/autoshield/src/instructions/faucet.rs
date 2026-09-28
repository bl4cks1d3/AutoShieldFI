use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, MintTo, Token, TokenAccount};

use crate::constants::*;
use crate::errors::AutoShieldError;
use crate::state::Pool;

/// Cria o token estavel de teste (tBRL) usado em devnet/localnet.
/// A autoridade de emissao e um PDA do programa, liberado pelo faucet.
#[derive(Accounts)]
pub struct InitTestMint<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        init,
        payer = payer,
        seeds = [TEST_MINT_SEED],
        bump,
        mint::decimals = TEST_MINT_DECIMALS,
        mint::authority = mint_authority,
    )]
    pub test_mint: Account<'info, Mint>,

    /// CHECK: PDA usado apenas como autoridade de emissao.
    #[account(seeds = [MINT_AUTH_SEED], bump)]
    pub mint_authority: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn init_test_mint(_ctx: Context<InitTestMint>) -> Result<()> {
    Ok(())
}

#[derive(Accounts)]
pub struct Faucet<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(seeds = [POOL_SEED], bump = pool.bump)]
    pub pool: Account<'info, Pool>,

    #[account(
        mut,
        seeds = [TEST_MINT_SEED],
        bump,
        address = pool.stable_mint @ AutoShieldError::InvalidParameter
    )]
    pub test_mint: Account<'info, Mint>,

    /// CHECK: PDA usado apenas como autoridade de emissao.
    #[account(seeds = [MINT_AUTH_SEED], bump)]
    pub mint_authority: UncheckedAccount<'info>,

    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = test_mint,
        associated_token::authority = user,
    )]
    pub user_token: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn faucet(ctx: Context<Faucet>, amount: u64) -> Result<()> {
    require!(ctx.accounts.pool.params.faucet_enabled, AutoShieldError::Unauthorized);
    require!(amount > 0, AutoShieldError::ZeroAmount);
    require!(amount <= FAUCET_MAX_PER_CALL, AutoShieldError::FaucetLimit);

    let bump = ctx.bumps.mint_authority;
    let signer_seeds: &[&[&[u8]]] = &[&[MINT_AUTH_SEED, &[bump]]];
    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.test_mint.to_account_info(),
                to: ctx.accounts.user_token.to_account_info(),
                authority: ctx.accounts.mint_authority.to_account_info(),
            },
            signer_seeds,
        ),
        amount,
    )
}
