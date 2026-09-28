use anchor_lang::prelude::*;

use crate::constants::*;

/// Pool de risco mutualista. Os provedores de liquidez (stakers) aportam capital
/// que garante as coberturas; os premios pagos pelos motoristas remuneram esse capital.
#[account]
#[derive(InitSpace)]
pub struct Pool {
    pub authority: Pubkey,
    pub stable_mint: Pubkey,
    pub vault: Pubkey,
    /// Total de cotas emitidas aos provedores de liquidez.
    pub total_shares: u64,
    /// Soma dos limites de cobertura das apolices ativas.
    pub total_active_coverage: u64,
    /// Cashback reservado para devolucao a motoristas sem sinistro.
    pub reserved_cashback: u64,
    /// Soma dos valores solicitados em sinistros pendentes/aprovados ainda nao pagos.
    pub pending_claims: u64,
    pub total_premiums: u64,
    pub total_claims_paid: u64,
    pub total_cashback_paid: u64,
    pub policy_count: u64,
    pub claim_count: u64,
    pub active_policies: u64,
    pub params: PoolParams,
    #[max_len(MAX_ASSESSORS)]
    pub assessors: Vec<Pubkey>,
    pub approval_threshold: u8,
    pub paused: bool,
    pub bump: u8,
    pub vault_bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq, InitSpace)]
pub struct PoolParams {
    /// Taxa anual base sobre o valor FIPE (bps). Ex: 350 = 3,5% ao ano.
    pub base_rate_bps: u16,
    /// Parte do premio devolvida ao motorista se nao houver sinistro (bps).
    pub cashback_bps: u16,
    /// Colateral minimo exigido sobre a cobertura ativa total (bps).
    pub min_collateral_bps: u16,
    /// Carencia minima entre deposito e saque de liquidez (segundos).
    pub withdraw_cooldown_secs: i64,
    /// Janela de votacao dos avaliadores (segundos).
    pub claim_voting_secs: i64,
    /// Duracao de um "dia" de apolice em segundos. 86400 em producao;
    /// valores menores permitem demonstrar o ciclo completo em devnet.
    pub seconds_per_day: i64,
    /// Carencia entre a contratacao e o primeiro sinistro aceito (segundos).
    /// Evita contratar a apolice depois que o evento ja aconteceu.
    pub claim_waiting_secs: i64,
    /// Habilita o faucet de token de teste (somente devnet/localnet).
    pub faucet_enabled: bool,
}

impl PoolParams {
    pub fn validate(&self) -> bool {
        self.base_rate_bps > 0
            && self.base_rate_bps <= 5_000
            && self.cashback_bps <= 5_000
            && self.min_collateral_bps > 0
            && self.min_collateral_bps <= 10_000
            && self.withdraw_cooldown_secs >= 0
            && self.claim_voting_secs > 0
            && self.seconds_per_day > 0
            && self.seconds_per_day <= 86_400
            && self.claim_waiting_secs >= 0
    }
}

impl Pool {
    /// Patrimonio liquido pertencente aos provedores de liquidez.
    pub fn net_assets(&self, vault_balance: u64) -> u64 {
        vault_balance.saturating_sub(self.reserved_cashback)
    }

    /// Capital minimo que precisa permanecer no pool.
    pub fn required_capital(&self, active_coverage: u64) -> Option<u64> {
        let collateral = (active_coverage as u128)
            .checked_mul(self.params.min_collateral_bps as u128)?
            .checked_div(BPS_DENOMINATOR as u128)?;
        u64::try_from(collateral)
            .ok()?
            .checked_add(self.pending_claims)
    }

    pub fn is_assessor(&self, key: &Pubkey) -> bool {
        self.assessors.iter().any(|a| a == key)
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq, InitSpace)]
pub enum CoverageTier {
    /// Roubo/furto e eventos da natureza.
    Basic,
    /// Basico + colisao.
    Standard,
    /// Completo: Standard + terceiros + outros eventos.
    Premium,
}

impl CoverageTier {
    /// Multiplicador de risco em percentual.
    pub fn multiplier_pct(&self) -> u64 {
        match self {
            CoverageTier::Basic => 60,
            CoverageTier::Standard => 100,
            CoverageTier::Premium => 140,
        }
    }

    pub fn covers(&self, kind: ClaimKind) -> bool {
        match (self, kind) {
            (_, ClaimKind::Theft) | (_, ClaimKind::NaturalEvent) => true,
            (CoverageTier::Standard | CoverageTier::Premium, ClaimKind::Collision) => true,
            (CoverageTier::Premium, ClaimKind::ThirdParty | ClaimKind::Other) => true,
            _ => false,
        }
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq, InitSpace)]
pub enum PolicyStatus {
    Active,
    /// Encerrada apos a vigencia (com ou sem sinistro pago).
    Settled,
    /// Recusada na vistoria: premio devolvido integralmente.
    Cancelled,
}

#[account]
#[derive(InitSpace)]
pub struct Policy {
    pub owner: Pubkey,
    pub pool: Pubkey,
    pub id: u64,
    pub nonce: u64,
    #[max_len(MAX_PLATE_LEN)]
    pub plate: String,
    /// sha256 da placa normalizada: chave do registro unico do veiculo.
    pub plate_hash: [u8; 32],
    #[max_len(MAX_MODEL_LEN)]
    pub model: String,
    pub year: u16,
    /// Valor FIPE em unidades do token (6 casas decimais).
    pub vehicle_value: u64,
    pub tier: CoverageTier,
    pub duration_days: u16,
    pub premium_paid: u64,
    pub coverage_limit: u64,
    pub deductible: u64,
    pub cashback_amount: u64,
    pub start_ts: i64,
    pub end_ts: i64,
    pub status: PolicyStatus,
    pub claims_filed: u8,
    pub has_open_claim: bool,
    /// Verdadeiro se algum sinistro foi pago (perde o cashback).
    pub had_paid_claim: bool,
    pub total_paid_out: u64,
    pub cashback_redeemed: bool,
    /// Vistoria previa feita por um avaliador (exigida antes de sinistros).
    pub inspected: bool,
    pub inspector: Pubkey,
    /// Primeiro instante em que um sinistro e aceito (inicio + carencia).
    pub claims_allowed_from: i64,
    pub bump: u8,
}

impl Policy {
    pub fn remaining_coverage(&self) -> u64 {
        self.coverage_limit.saturating_sub(self.total_paid_out)
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq, InitSpace)]
pub enum ClaimKind {
    Theft,
    Collision,
    ThirdParty,
    NaturalEvent,
    Other,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq, InitSpace)]
pub enum ClaimStatus {
    Pending,
    Approved,
    Rejected,
    Paid,
}

#[account]
#[derive(InitSpace)]
pub struct Claim {
    pub policy: Pubkey,
    pub claimant: Pubkey,
    pub pool: Pubkey,
    pub id: u64,
    pub index: u8,
    pub kind: ClaimKind,
    pub amount_requested: u64,
    pub payout_amount: u64,
    #[max_len(MAX_DESCRIPTION_LEN)]
    pub description: String,
    /// URI das evidencias (IPFS/Arweave) ou hash sha256 das fotos.
    #[max_len(MAX_URI_LEN)]
    pub evidence_uri: String,
    pub status: ClaimStatus,
    pub approvals: u8,
    pub rejections: u8,
    #[max_len(MAX_ASSESSORS)]
    pub voters: Vec<Pubkey>,
    pub created_ts: i64,
    pub voting_deadline: i64,
    pub resolved_ts: i64,
    pub bump: u8,
}

/// Registro unico por veiculo (placa): garante no maximo uma apolice ativa,
/// impedindo segurar o mesmo carro varias vezes para multiplicar a indenizacao.
#[account]
#[derive(InitSpace)]
pub struct VehicleRecord {
    pub plate_hash: [u8; 32],
    /// Apolice ativa atual; `Pubkey::default()` quando livre.
    pub active_policy: Pubkey,
    pub policies_count: u32,
    pub bump: u8,
}

/// Normaliza a placa: maiusculas, apenas letras e digitos ASCII.
pub fn normalize_plate(plate: &str) -> String {
    plate
        .chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .map(|c| c.to_ascii_uppercase())
        .collect()
}

/// Posicao de um provedor de liquidez (staker) no pool.
#[account]
#[derive(InitSpace)]
pub struct StakePosition {
    pub owner: Pubkey,
    pub pool: Pubkey,
    pub shares: u64,
    pub total_deposited: u64,
    pub total_withdrawn: u64,
    pub last_deposit_ts: i64,
    pub bump: u8,
}

#[cfg(test)]
mod tests {
    use super::normalize_plate;

    #[test]
    fn plate_normalization_blocks_trivial_duplicates() {
        assert_eq!(normalize_plate("abc-1d23"), "ABC1D23");
        assert_eq!(normalize_plate(" ABC 1D23 "), "ABC1D23");
        assert_eq!(normalize_plate("abc1d23"), normalize_plate("ABC-1D23"));
    }
}
