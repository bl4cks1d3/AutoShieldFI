use anchor_lang::prelude::*;

use crate::constants::*;

/// Versao atual do layout das contas. Campos novos devem consumir `_reserved`
/// e incrementar esta versao, sem quebrar contas ja criadas.
pub const ACCOUNT_VERSION: u8 = 1;

/// Pool de risco mutualista. Os provedores de liquidez (stakers) aportam capital
/// que garante as coberturas; os premios pagos pelos motoristas remuneram esse capital.
#[account]
#[derive(InitSpace)]
pub struct Pool {
    pub version: u8,
    pub authority: Pubkey,
    pub stable_mint: Pubkey,
    pub vault: Pubkey,
    /// Total de cotas emitidas (inclui as cotas "mortas" do primeiro aporte).
    pub total_shares: u64,
    /// Soma das coberturas restantes das apolices ativas.
    pub total_active_coverage: u64,
    /// Cashback reservado para devolucao a motoristas sem sinistro.
    pub reserved_cashback: u64,
    /// Soma dos valores solicitados em sinistros pendentes/aprovados ainda nao pagos.
    pub pending_claims: u64,
    /// Taxa do protocolo acumulada no cofre (receita, fora do patrimonio dos LPs).
    pub treasury_accrued: u64,
    /// Taxas de vistoria pagas pelos motoristas e ainda nao repassadas ao avaliador.
    pub pending_inspection_fees: u64,
    pub total_premiums: u64,
    pub total_claims_paid: u64,
    pub total_cashback_paid: u64,
    pub total_protocol_fees: u64,
    pub total_assessor_rewards: u64,
    pub policy_count: u64,
    pub claim_count: u64,
    pub active_policies: u64,
    pub params: PoolParams,
    #[max_len(MAX_ASSESSORS)]
    pub assessors: Vec<Pubkey>,
    pub approval_threshold: u8,
    pub paused: bool,
    /// Governanca com timelock: mudancas propostas so valem apos `*_eta`.
    pub pending_params: Option<PoolParams>,
    pub pending_params_eta: i64,
    #[max_len(MAX_ASSESSORS)]
    pub pending_assessors: Vec<Pubkey>,
    pub pending_threshold: u8,
    pub pending_assessors_eta: i64,
    /// Transferencia de autoridade em dois passos (proposta + aceite).
    pub pending_authority: Pubkey,
    pub bump: u8,
    pub vault_bump: u8,
    pub _reserved: [u8; 128],
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq, InitSpace)]
pub struct PoolParams {
    /// Taxa anual base sobre o valor FIPE (bps). Ex: 350 = 3,5% ao ano.
    pub base_rate_bps: u16,
    /// Parte do premio devolvida ao motorista se nao houver sinistro (bps).
    pub cashback_bps: u16,
    /// Parte do premio que fica com o protocolo (bps).
    pub protocol_fee_bps: u16,
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
    pub claim_waiting_secs: i64,
    /// Tolerancia para pagar uma parcela vencida antes da apolice caducar (segundos).
    pub installment_grace_secs: i64,
    /// Atraso minimo entre propor e aplicar mudancas de governanca (segundos).
    pub governance_delay_secs: i64,
    /// Taxa de vistoria paga pelo motorista na contratacao; vai para o avaliador,
    /// mesmo se a vistoria for recusada (desestimula contratacoes abusivas).
    pub inspection_fee: u64,
    /// Remuneracao por voto em sinistro, paga da tesouraria do protocolo.
    pub vote_reward: u64,
    /// Valor FIPE minimo aceito.
    pub min_vehicle_value: u64,
    /// Habilita o faucet de token de teste (somente devnet/localnet).
    pub faucet_enabled: bool,
}

impl PoolParams {
    pub fn validate(&self) -> bool {
        self.base_rate_bps > 0
            && self.base_rate_bps <= 5_000
            && self.cashback_bps <= 5_000
            && self.protocol_fee_bps <= 3_000
            && (self.cashback_bps as u32 + self.protocol_fee_bps as u32) < 10_000
            && self.min_collateral_bps > 0
            && self.min_collateral_bps <= 10_000
            && self.withdraw_cooldown_secs >= 0
            && self.claim_voting_secs > 0
            && self.seconds_per_day > 0
            && self.seconds_per_day <= 86_400
            && self.claim_waiting_secs >= 0
            && self.installment_grace_secs >= 0
            && self.governance_delay_secs >= 0
            && self.min_vehicle_value > 0
    }
}

impl Pool {
    /// Valores no cofre que pertencem a terceiros (motoristas, protocolo, avaliadores).
    pub fn liabilities(&self) -> u64 {
        self.reserved_cashback
            .saturating_add(self.treasury_accrued)
            .saturating_add(self.pending_inspection_fees)
    }

    /// Patrimonio liquido pertencente aos provedores de liquidez.
    pub fn net_assets(&self, vault_balance: u64) -> u64 {
        vault_balance.saturating_sub(self.liabilities())
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
    /// Encerrada (vencida, ou caducada por parcela em atraso).
    Settled,
    /// Recusada na vistoria: premio devolvido integralmente.
    Cancelled,
}

#[account]
#[derive(InitSpace)]
pub struct Policy {
    pub version: u8,
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
    /// Premio total da vigencia (soma de todas as parcelas).
    pub premium_total: u64,
    /// Quanto do premio ja foi pago.
    pub premium_paid: u64,
    pub installments: u8,
    pub installments_paid: u8,
    /// Intervalo entre parcelas (segundos).
    pub installment_period: i64,
    pub coverage_limit: u64,
    pub deductible: u64,
    /// Cashback reservado ate agora (cresce a cada parcela paga).
    pub cashback_amount: u64,
    /// Taxa do protocolo ja cobrada desta apolice (estornada se a vistoria for recusada).
    pub protocol_fees_paid: u64,
    pub inspection_fee: u64,
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
    pub _reserved: [u8; 64],
}

impl Policy {
    pub fn remaining_coverage(&self) -> u64 {
        self.coverage_limit.saturating_sub(self.total_paid_out)
    }

    /// Instante ate o qual a cobertura esta paga.
    pub fn paid_until(&self) -> i64 {
        if self.installments_paid >= self.installments {
            return self.end_ts;
        }
        self.start_ts
            .saturating_add(self.installment_period.saturating_mul(self.installments_paid as i64))
    }

    pub fn fully_paid(&self) -> bool {
        self.installments_paid >= self.installments
    }

    /// Valor da proxima parcela (a ultima absorve o resto da divisao).
    pub fn next_installment_amount(&self) -> u64 {
        if self.fully_paid() {
            return 0;
        }
        let base = self.premium_total / self.installments as u64;
        if self.installments_paid + 1 == self.installments {
            self.premium_total.saturating_sub(self.premium_paid)
        } else {
            base
        }
    }

    /// Parcela vencida alem da tolerancia: a apolice caducou.
    pub fn is_lapsed(&self, now: i64, grace: i64) -> bool {
        !self.fully_paid() && now > self.paid_until().saturating_add(grace)
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
    pub version: u8,
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
    pub _reserved: [u8; 64],
}

/// Registro unico por veiculo (placa): garante no maximo uma apolice ativa e
/// vistoriada, impedindo segurar o mesmo carro varias vezes.
#[account]
#[derive(InitSpace)]
pub struct VehicleRecord {
    pub version: u8,
    pub plate_hash: [u8; 32],
    /// Apolice vistoriada e ativa; `Pubkey::default()` quando livre.
    pub active_policy: Pubkey,
    pub policies_count: u32,
    pub bump: u8,
    pub _reserved: [u8; 32],
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
    pub version: u8,
    pub owner: Pubkey,
    pub pool: Pubkey,
    pub shares: u64,
    pub total_deposited: u64,
    pub total_withdrawn: u64,
    pub last_deposit_ts: i64,
    pub bump: u8,
    pub _reserved: [u8; 32],
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn plate_normalization_blocks_trivial_duplicates() {
        assert_eq!(normalize_plate("abc-1d23"), "ABC1D23");
        assert_eq!(normalize_plate(" ABC 1D23 "), "ABC1D23");
        assert_eq!(normalize_plate("abc1d23"), normalize_plate("ABC-1D23"));
    }

    fn policy(total: u64, n: u8, paid: u8) -> Policy {
        Policy {
            version: ACCOUNT_VERSION,
            owner: Pubkey::default(),
            pool: Pubkey::default(),
            id: 0,
            nonce: 0,
            plate: String::new(),
            plate_hash: [0; 32],
            model: String::new(),
            year: 2020,
            vehicle_value: 0,
            tier: CoverageTier::Basic,
            duration_days: 360,
            premium_total: total,
            premium_paid: total / n as u64 * paid as u64,
            installments: n,
            installments_paid: paid,
            installment_period: 30,
            coverage_limit: 0,
            deductible: 0,
            cashback_amount: 0,
            protocol_fees_paid: 0,
            inspection_fee: 0,
            start_ts: 1_000,
            end_ts: 1_000 + 30 * n as i64,
            status: PolicyStatus::Active,
            claims_filed: 0,
            has_open_claim: false,
            had_paid_claim: false,
            total_paid_out: 0,
            cashback_redeemed: false,
            inspected: true,
            inspector: Pubkey::default(),
            claims_allowed_from: 0,
            bump: 0,
            _reserved: [0; 64],
        }
    }

    #[test]
    fn installments_schedule() {
        let p = policy(1_000, 12, 1);
        assert_eq!(p.paid_until(), 1_030);
        assert_eq!(p.next_installment_amount(), 83);
        assert!(!p.is_lapsed(1_030, 0));
        assert!(p.is_lapsed(1_031, 0));
        assert!(!p.is_lapsed(1_035, 5));
        // a ultima parcela absorve o resto: 11 x 83 = 913, ultima = 87
        let last = policy(1_000, 12, 11);
        assert_eq!(last.next_installment_amount(), 1_000 - 913);
        let full = policy(1_000, 12, 12);
        assert!(full.fully_paid());
        assert_eq!(full.paid_until(), full.end_ts);
        assert!(!full.is_lapsed(99_999, 0));
    }
}
