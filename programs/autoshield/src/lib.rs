//! AutoShieldFI - protecao veicular descentralizada na Solana.
//!
//! Fluxo:
//! 1. Provedores de liquidez depositam stablecoin no pool de risco e recebem cotas.
//! 2. Motoristas contratam apolices pagando um premio calculado on-chain.
//! 3. Em caso de sinistro, o motorista abre um pedido que e votado por avaliadores.
//! 4. Sinistros aprovados sao pagos direto do cofre do pool.
//! 5. Ao fim da vigencia sem sinistro, parte do premio volta ao motorista (cashback).
#![allow(unexpected_cfgs)]
#![allow(deprecated)]

use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod events;
pub mod instructions;
pub mod pricing;
pub mod state;

use instructions::*;
use state::PoolParams;

declare_id!("GPnGSA7KH3vqnF1KfzHGzQNvnEBVD3XRfCayEBhQsuRC");

#[program]
pub mod autoshield {
    use super::*;

    // ---------- administracao ----------

    pub fn initialize_pool(
        ctx: Context<InitializePool>,
        params: PoolParams,
        assessors: Vec<Pubkey>,
        approval_threshold: u8,
    ) -> Result<()> {
        instructions::admin::initialize_pool(ctx, params, assessors, approval_threshold)
    }

    /// Governanca com timelock: propor, aguardar `governance_delay_secs`, aplicar.
    pub fn propose_params(ctx: Context<AdminAction>, params: PoolParams) -> Result<()> {
        instructions::admin::propose_params(ctx, params)
    }

    pub fn apply_params(ctx: Context<ApplyGovernance>) -> Result<()> {
        instructions::admin::apply_params(ctx)
    }

    pub fn propose_assessors(
        ctx: Context<AdminAction>,
        assessors: Vec<Pubkey>,
        approval_threshold: u8,
    ) -> Result<()> {
        instructions::admin::propose_assessors(ctx, assessors, approval_threshold)
    }

    pub fn apply_assessors(ctx: Context<ApplyGovernance>) -> Result<()> {
        instructions::admin::apply_assessors(ctx)
    }

    pub fn cancel_pending(ctx: Context<AdminAction>) -> Result<()> {
        instructions::admin::cancel_pending(ctx)
    }

    pub fn set_paused(ctx: Context<AdminAction>, paused: bool) -> Result<()> {
        instructions::admin::set_paused(ctx, paused)
    }

    pub fn propose_authority(ctx: Context<AdminAction>, new_authority: Pubkey) -> Result<()> {
        instructions::admin::propose_authority(ctx, new_authority)
    }

    pub fn accept_authority(ctx: Context<AcceptAuthority>) -> Result<()> {
        instructions::admin::accept_authority(ctx)
    }

    pub fn withdraw_treasury(ctx: Context<WithdrawTreasury>, amount: u64) -> Result<()> {
        instructions::admin::withdraw_treasury(ctx, amount)
    }

    // ---------- token de teste ----------

    pub fn init_test_mint(ctx: Context<InitTestMint>) -> Result<()> {
        instructions::faucet::init_test_mint(ctx)
    }

    pub fn faucet(ctx: Context<Faucet>, amount: u64) -> Result<()> {
        instructions::faucet::faucet(ctx, amount)
    }

    // ---------- liquidez (staking) ----------

    pub fn deposit_liquidity(ctx: Context<DepositLiquidity>, amount: u64) -> Result<()> {
        instructions::liquidity::deposit_liquidity(ctx, amount)
    }

    pub fn withdraw_liquidity(ctx: Context<WithdrawLiquidity>, shares: u64) -> Result<()> {
        instructions::liquidity::withdraw_liquidity(ctx, shares)
    }

    // ---------- apolices ----------

    pub fn purchase_policy(ctx: Context<PurchasePolicy>, args: PurchasePolicyArgs) -> Result<()> {
        instructions::policy::purchase_policy(ctx, args)
    }

    pub fn pay_installment(ctx: Context<PayInstallment>) -> Result<()> {
        instructions::policy::pay_installment(ctx)
    }

    pub fn inspect_policy(ctx: Context<InspectPolicy>, approve: bool) -> Result<()> {
        instructions::policy::inspect_policy(ctx, approve)
    }

    pub fn settle_policy(ctx: Context<SettlePolicy>) -> Result<()> {
        instructions::policy::settle_policy(ctx)
    }

    // ---------- sinistros ----------

    pub fn file_claim(ctx: Context<FileClaim>, args: FileClaimArgs) -> Result<()> {
        instructions::claims::file_claim(ctx, args)
    }

    pub fn vote_claim(ctx: Context<VoteClaim>, approve: bool) -> Result<()> {
        instructions::claims::vote_claim(ctx, approve)
    }

    pub fn expire_claim(ctx: Context<ExpireClaim>) -> Result<()> {
        instructions::claims::expire_claim(ctx)
    }

    pub fn pay_claim(ctx: Context<PayClaim>) -> Result<()> {
        instructions::claims::pay_claim(ctx)
    }
}
