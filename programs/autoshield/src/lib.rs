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

    pub fn set_oracle(ctx: Context<AdminAction>, oracle: Pubkey) -> Result<()> {
        instructions::admin::set_oracle(ctx, oracle)
    }

    pub fn set_risk_params(
        ctx: Context<AdminAction>,
        junior_weight_bps: u16,
        min_assessor_bond: u64,
        slash_bps: u16,
    ) -> Result<()> {
        instructions::admin::set_risk_params(ctx, junior_weight_bps, min_assessor_bond, slash_bps)
    }

    pub fn set_bonus_days(ctx: Context<AdminAction>, days: u16) -> Result<()> {
        instructions::admin::set_bonus_days(ctx, days)
    }

    /// Credencia uma oficina para receber indenizacoes de danos parciais.
    pub fn register_shop(ctx: Context<RegisterShop>, wallet: Pubkey, name: String, city: String) -> Result<()> {
        instructions::admin::register_shop(ctx, wallet, name, city)
    }

    pub fn set_shop_active(ctx: Context<SetShopActive>, active: bool) -> Result<()> {
        instructions::admin::set_shop_active(ctx, active)
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

    pub fn request_withdrawal(ctx: Context<RequestWithdrawal>, shares: u64) -> Result<()> {
        instructions::liquidity::request_withdrawal(ctx, shares)
    }

    /// Classe junior (primeira perda): aporte, pedido de saque e saque.
    pub fn deposit_junior(ctx: Context<DepositLiquidity>, amount: u64) -> Result<()> {
        instructions::liquidity::deposit_junior(ctx, amount)
    }

    pub fn request_junior_withdrawal(ctx: Context<RequestWithdrawal>, shares: u64) -> Result<()> {
        instructions::liquidity::request_junior_withdrawal(ctx, shares)
    }

    pub fn withdraw_junior(ctx: Context<WithdrawLiquidity>, shares: u64) -> Result<()> {
        instructions::liquidity::withdraw_junior(ctx, shares)
    }

    /// Garantia dos avaliadores.
    pub fn post_bond(ctx: Context<AssessorBond>, amount: u64) -> Result<()> {
        instructions::bond::post_bond(ctx, amount)
    }

    pub fn withdraw_bond(ctx: Context<AssessorBond>, amount: u64) -> Result<()> {
        instructions::bond::withdraw_bond(ctx, amount)
    }

    pub fn close_position(ctx: Context<ClosePosition>) -> Result<()> {
        instructions::liquidity::close_position(ctx)
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

    pub fn close_policy(ctx: Context<ClosePolicy>) -> Result<()> {
        instructions::policy::close_policy(ctx)
    }

    pub fn settle_policy(ctx: Context<SettlePolicy>) -> Result<()> {
        instructions::policy::settle_policy(ctx)
    }

    /// Arrependimento (7 dias, devolucao integral) ou cancelamento proporcional.
    pub fn cancel_policy(ctx: Context<CancelPolicy>) -> Result<()> {
        instructions::policy::cancel_policy(ctx)
    }

    /// Venda do veiculo: o titular indica o comprador...
    pub fn propose_transfer(ctx: Context<ProposeTransfer>, new_owner: Pubkey) -> Result<()> {
        instructions::policy::propose_transfer(ctx, new_owner)
    }

    /// ...e o comprador aceita.
    pub fn accept_transfer(ctx: Context<AcceptTransfer>) -> Result<()> {
        instructions::policy::accept_transfer(ctx)
    }

    /// Oraculo atualiza o valor FIPE (cobertura acompanha a tabela mes a mes).
    pub fn update_policy_fipe(ctx: Context<UpdatePolicyFipe>, vehicle_value: u64) -> Result<()> {
        instructions::policy::update_policy_fipe(ctx, vehicle_value)
    }

    // ---------- sinistros ----------

    pub fn file_claim(ctx: Context<FileClaim>, args: FileClaimArgs) -> Result<()> {
        instructions::claims::file_claim(ctx, args)
    }

    pub fn vote_claim(
        ctx: Context<VoteClaim>,
        approve: bool,
        reclassify: Option<state::ClaimKind>,
    ) -> Result<()> {
        instructions::claims::vote_claim(ctx, approve, reclassify)
    }

    pub fn expire_claim(ctx: Context<ExpireClaim>) -> Result<()> {
        instructions::claims::expire_claim(ctx)
    }

    /// Recurso contra sinistro recusado (uma vez, ate 7 dias apos a recusa).
    pub fn appeal_claim(ctx: Context<AppealClaim>) -> Result<()> {
        instructions::claims::appeal_claim(ctx)
    }

    /// Liquida votos de um sinistro encerrado: reputacao e garantia.
    pub fn settle_vote(ctx: Context<SettleVote>, assessor: Pubkey) -> Result<()> {
        instructions::claims::settle_vote(ctx, assessor)
    }

    /// Valor recuperado de perda total (salvado ou veiculo recuperado).
    pub fn record_salvage(ctx: Context<RecordSalvage>, amount: u64) -> Result<()> {
        instructions::claims::record_salvage(ctx, amount)
    }

    pub fn close_claim(ctx: Context<CloseClaim>) -> Result<()> {
        instructions::claims::close_claim(ctx)
    }

    pub fn pay_claim(ctx: Context<PayClaim>) -> Result<()> {
        instructions::claims::pay_claim(ctx)
    }
}
