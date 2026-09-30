use anchor_lang::prelude::*;

use crate::constants::*;

/// Versao atual do layout das contas. Campos novos devem consumir `_reserved`
/// e incrementar esta versao, sem quebrar contas ja criadas.
pub const ACCOUNT_VERSION: u8 = 2;

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
    /// Carteira do servico que atualiza o valor FIPE das apolices (oraculo).
    pub oracle: Pubkey,
    pub bump: u8,
    pub vault_bump: u8,
    /// Dias de cobertura sem sinistro para subir uma classe de bonus (0 = 365).
    /// Ocupa bytes que eram reservados: o layout do pool nao muda.
    pub bonus_days_per_class: u16,
    /// Cotas da classe junior (primeira perda). As cotas de `total_shares` sao senior.
    pub junior_shares: u64,
    /// Parte do patrimonio dos LPs que pertence a classe junior.
    pub junior_capital: u64,
    /// Peso da classe junior na divisao dos premios por real aportado (0 = 20.000 = 2x).
    pub junior_weight_bps: u16,
    /// Garantias depositadas pelos avaliadores (fora do patrimonio dos LPs).
    pub assessor_bonds: u64,
    /// Garantia minima para votar e vistoriar (0 = nao exigida).
    pub min_assessor_bond: u64,
    /// Parte da garantia perdida por voto contra o resultado final (0 = 1.000 = 10%).
    pub slash_bps: u16,
    /// Total recuperado com salvados e veiculos roubados encontrados.
    pub total_salvage: u64,
    pub _reserved: [u8; 82],
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
    /// Votos de avaliadores necessarios para aprovar uma vistoria.
    pub inspection_threshold: u8,
    /// Aviso previo entre pedir e executar um saque de liquidez (segundos).
    /// Durante o aviso as cotas continuam expostas aos sinistros.
    pub withdraw_notice_secs: i64,
    /// Cobertura maxima de uma apolice em relacao ao patrimonio do pool (bps;
    /// pode passar de 10.000 = 100% porque o colateral e fracionario).
    pub max_policy_coverage_bps: u32,
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
            && self.inspection_threshold > 0
            && (self.inspection_threshold as usize) <= MAX_ASSESSORS
            && self.withdraw_notice_secs >= 0
            && self.max_policy_coverage_bps > 0
            && self.max_policy_coverage_bps <= 100_000
    }
}

impl Pool {
    /// Valores no cofre que pertencem a terceiros (motoristas, protocolo, avaliadores).
    pub fn liabilities(&self) -> u64 {
        self.reserved_cashback
            .saturating_add(self.treasury_accrued)
            .saturating_add(self.pending_inspection_fees)
            .saturating_add(self.assessor_bonds)
    }

    /// Capital da classe junior (nunca maior que o patrimonio).
    pub fn junior_nav(&self, nav: u64) -> u64 {
        self.junior_capital.min(nav)
    }

    /// Capital da classe senior: o patrimonio que nao e da junior.
    pub fn senior_nav(&self, nav: u64) -> u64 {
        nav.saturating_sub(self.junior_capital)
    }

    pub fn junior_weight(&self) -> u64 {
        if self.junior_weight_bps == 0 {
            DEFAULT_JUNIOR_WEIGHT_BPS
        } else {
            self.junior_weight_bps as u64
        }
    }

    pub fn slash_rate_bps(&self) -> u64 {
        if self.slash_bps == 0 {
            DEFAULT_SLASH_BPS
        } else {
            self.slash_bps as u64
        }
    }

    /// Parte de uma receita dos LPs (premio ou salvado) que cabe a junior: o
    /// capital junior pesa `junior_weight` vezes mais que o senior.
    pub fn junior_share_of(&self, amount: u64, nav: u64) -> u64 {
        let j = self.junior_nav(nav) as u128 * self.junior_weight() as u128 / BPS_DENOMINATOR as u128;
        let s = self.senior_nav(nav) as u128;
        if j == 0 {
            return 0;
        }
        (amount as u128 * j / (j + s)) as u64
    }

    /// Receita dos LPs: credita a parte da junior.
    pub fn credit_lp_income(&mut self, amount: u64, nav_before: u64) {
        let part = self.junior_share_of(amount, nav_before);
        self.junior_capital = self.junior_capital.saturating_add(part);
    }

    /// Perda de sinistro: a junior absorve primeiro, ate zerar.
    pub fn absorb_loss(&mut self, amount: u64) {
        self.junior_capital = self.junior_capital.saturating_sub(amount);
    }

    /// Estorno (reembolso) que nao e perda de risco: sai das duas classes na
    /// proporcao do capital.
    pub fn reduce_pro_rata(&mut self, amount: u64, nav_before: u64) {
        if nav_before == 0 {
            return;
        }
        let part = (amount as u128 * self.junior_nav(nav_before) as u128 / nav_before as u128) as u64;
        self.junior_capital = self.junior_capital.saturating_sub(part);
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

    pub fn bonus_days(&self) -> u32 {
        if self.bonus_days_per_class == 0 {
            DEFAULT_BONUS_DAYS_PER_CLASS
        } else {
            self.bonus_days_per_class as u32
        }
    }

    pub fn is_assessor(&self, key: &Pubkey) -> bool {
        self.assessors.iter().any(|a| a == key)
    }

    /// Quorum efetivo de vistoria (nunca maior que o comite atual).
    pub fn inspection_quorum(&self) -> u8 {
        self.params
            .inspection_threshold
            .min(self.assessors.len() as u8)
            .max(1)
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
    /// Somente roubo e furto: o plano mais barato (motos e carros mais antigos).
    TheftOnly,
    /// Motorista de aplicativo: roubo, colisao, terceiros e natureza, com
    /// preco ajustado ao uso profissional; pensado para contratacao mensal.
    AppDriver,
}

impl CoverageTier {
    /// Multiplicador de risco em percentual.
    pub fn multiplier_pct(&self) -> u64 {
        match self {
            CoverageTier::Basic => 60,
            CoverageTier::Standard => 100,
            CoverageTier::Premium => 140,
            CoverageTier::TheftOnly => 35,
            CoverageTier::AppDriver => 180,
        }
    }

    pub fn covers(&self, kind: ClaimKind) -> bool {
        match (self, kind) {
            (_, ClaimKind::Theft) => true,
            (CoverageTier::TheftOnly, _) => false,
            (_, ClaimKind::NaturalEvent) => true,
            (CoverageTier::Standard | CoverageTier::Premium, ClaimKind::Collision) => true,
            (CoverageTier::Premium, ClaimKind::ThirdParty | ClaimKind::Other) => true,
            (CoverageTier::AppDriver, ClaimKind::Collision | ClaimKind::ThirdParty) => true,
            _ => false,
        }
    }
}

/// Franquia para danos parciais, escolhida na contratacao.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq, InitSpace)]
pub enum DeductibleOption {
    /// 2,5% do valor coberto; premio mais caro.
    Reduced,
    /// 5% do valor coberto.
    Normal,
    /// 10% do valor coberto; premio mais barato.
    Increased,
}

impl DeductibleOption {
    pub fn bps(&self) -> u64 {
        match self {
            DeductibleOption::Reduced => 250,
            DeductibleOption::Normal => 500,
            DeductibleOption::Increased => 1_000,
        }
    }

    /// Ajuste do premio em percentual.
    pub fn price_pct(&self) -> u64 {
        match self {
            DeductibleOption::Reduced => 115,
            DeductibleOption::Normal => 100,
            DeductibleOption::Increased => 85,
        }
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq, InitSpace)]
pub enum PolicyStatus {
    Active,
    /// Encerrada (vencida, caducada por parcela em atraso ou indenizada por perda total).
    Settled,
    /// Recusada na vistoria: premio devolvido integralmente.
    Cancelled,
    /// Cancelada pelo titular (arrependimento ou cancelamento com devolucao proporcional).
    CancelledByOwner,
}

#[account]
#[derive(InitSpace)]
pub struct Policy {
    pub version: u8,
    pub owner: Pubkey,
    pub pool: Pubkey,
    pub id: u64,
    pub nonce: u64,
    /// sha256 da placa normalizada. A placa em texto nunca vai para a
    /// blockchain (pseudonimizacao, LGPD); o avaliador confere o hash na vistoria.
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
    /// Ultimo avaliador que votou na vistoria.
    pub inspector: Pubkey,
    pub inspection_approvals: u8,
    pub inspection_rejections: u8,
    #[max_len(MAX_ASSESSORS)]
    pub inspection_voters: Vec<Pubkey>,
    /// Parte da taxa de vistoria ja repassada aos avaliadores.
    pub inspection_fee_paid: u64,
    /// Primeiro instante em que um sinistro e aceito (inicio + carencia).
    pub claims_allowed_from: i64,
    /// Percentual da FIPE contratado (90, 100 ou 110).
    pub fipe_pct: u8,
    pub deductible_option: DeductibleOption,
    /// Codigo FIPE e ano ("005340-6|2014-3"); vazio se o valor foi informado a mao.
    #[max_len(MAX_FIPE_CODE_LEN)]
    pub fipe_code: String,
    /// Ultima atualizacao do valor FIPE pelo oraculo.
    pub fipe_updated_ts: i64,
    /// Comprador indicado na venda do veiculo (aguardando aceite).
    pub pending_owner: Pubkey,
    /// Classe de bonus do titular na contratacao (desconto de 4% por classe).
    pub bonus_class: u8,
    pub bump: u8,
    pub _reserved: [u8; 64],
}

impl Policy {
    pub fn remaining_coverage(&self) -> u64 {
        self.coverage_limit.saturating_sub(self.total_paid_out)
    }

    /// Dano a partir de 75% do valor coberto, ou roubo/furto: perda total.
    pub fn is_total_loss(&self, kind: ClaimKind, amount: u64) -> bool {
        kind == ClaimKind::Theft
            || (amount as u128) * (BPS_DENOMINATOR as u128)
                >= (self.coverage_limit as u128) * (TOTAL_LOSS_BPS as u128)
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
    /// Em recurso: nova votacao por avaliadores que nao votaram na primeira rodada.
    Appealed,
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
    /// Tipo informado pelo motorista (antes de eventual reclassificacao).
    pub original_kind: ClaimKind,
    pub reclassified: bool,
    /// Indenizado como perda total (cobertura integral, sem franquia).
    pub total_loss: bool,
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
    /// Oficina credenciada que recebe a indenizacao de danos parciais
    /// (`Pubkey::default()` = paga ao motorista).
    pub repair_shop: Pubkey,
    /// Recurso ja usado (so um por sinistro).
    pub appealed: bool,
    #[max_len(MAX_ASSESSORS)]
    pub appeal_voters: Vec<Pubkey>,
    pub appeal_ts: i64,
    /// Avaliadores sorteados para julgar a primeira rodada.
    #[max_len(MAX_ASSESSORS)]
    pub panel: Vec<Pubkey>,
    /// Bit i = voto de aprovacao do i-esimo votante (voters / appeal_voters).
    pub vote_bits: u8,
    pub appeal_vote_bits: u8,
    /// Bit i = voto ja liquidado (reputacao e garantia).
    pub settled_bits: u8,
    pub appeal_settled_bits: u8,
    /// Recuperado com a venda do salvado ou a recuperacao do veiculo.
    pub salvage_recovered: u64,
    pub bump: u8,
    pub _reserved: [u8; 64],
}

impl Claim {
    /// Avaliadores aptos a votar no recurso: os que nao votaram na primeira rodada.
    pub fn appeal_eligible(&self, pool: &Pool) -> u8 {
        pool.assessors.iter().filter(|a| !self.voters.contains(a)).count() as u8
    }

    /// Resultado definitivo, se ja houver: Some(true) = aprovado, Some(false) = recusado.
    pub fn final_outcome(&self, now: i64, seconds_per_day: i64) -> Option<bool> {
        match self.status {
            ClaimStatus::Approved | ClaimStatus::Paid => Some(true),
            ClaimStatus::Rejected => {
                let window_end = self
                    .resolved_ts
                    .saturating_add(APPEAL_WINDOW_DAYS.saturating_mul(seconds_per_day));
                if self.appealed || now > window_end {
                    Some(false)
                } else {
                    None
                }
            }
            _ => None,
        }
    }
}

/// Sorteia `size` avaliadores do comite a partir de uma semente (hash do slot e
/// da conta do sinistro). Pseudoaleatorio: em producao, usar uma VRF.
pub fn draw_panel(assessors: &[Pubkey], size: usize, seed: [u8; 32]) -> Vec<Pubkey> {
    let mut pool: Vec<Pubkey> = assessors.to_vec();
    let size = size.min(pool.len());
    let mut out = Vec::with_capacity(size);
    for i in 0..size {
        let r = u64::from_le_bytes(seed[(i * 4) % 24..(i * 4) % 24 + 8].try_into().unwrap());
        let idx = (r % pool.len() as u64) as usize;
        out.push(pool.swap_remove(idx));
    }
    out
}

/// Garantia e reputacao de um avaliador.
#[account]
#[derive(InitSpace)]
pub struct AssessorRecord {
    pub version: u8,
    pub assessor: Pubkey,
    pub bond: u64,
    pub votes: u32,
    /// Votos liquidados de acordo com o resultado final.
    pub correct_votes: u32,
    /// Votos liquidados contra o resultado final.
    pub wrong_votes: u32,
    pub slashed: u64,
    pub bump: u8,
    pub _reserved: [u8; 32],
}

/// Oficina credenciada pela governanca para receber indenizacoes de danos parciais.
#[account]
#[derive(InitSpace)]
pub struct RepairShop {
    pub version: u8,
    pub wallet: Pubkey,
    #[max_len(MAX_SHOP_NAME_LEN)]
    pub name: String,
    #[max_len(MAX_SHOP_CITY_LEN)]
    pub city: String,
    pub active: bool,
    pub claims_paid: u32,
    pub total_received: u64,
    pub bump: u8,
    pub _reserved: [u8; 32],
}

/// Historico do motorista (por carteira): classe de bonus de renovacao.
#[account]
#[derive(InitSpace)]
pub struct DriverRecord {
    pub version: u8,
    pub owner: Pubkey,
    /// 0 a MAX_BONUS_CLASS; cada classe da BONUS_PCT_PER_CLASS% de desconto.
    pub bonus_class: u8,
    /// Dias de cobertura encerrada sem sinistro indenizado, acumulados.
    pub clean_days: u32,
    pub clean_policies: u32,
    pub paid_claims: u32,
    pub bump: u8,
    pub _reserved: [u8; 32],
}

impl DriverRecord {
    /// Encerramento sem sinistro: acumula dias e recalcula a classe.
    pub fn add_clean_days(&mut self, days: u32, days_per_class: u32) {
        self.clean_days = self.clean_days.saturating_add(days);
        self.clean_policies = self.clean_policies.saturating_add(1);
        let class = (self.clean_days / days_per_class.max(1)).min(MAX_BONUS_CLASS as u32) as u8;
        self.bonus_class = self.bonus_class.max(class);
    }

    /// Sinistro indenizado: desce uma classe (regra de mercado).
    pub fn register_paid_claim(&mut self, days_per_class: u32) {
        self.paid_claims = self.paid_claims.saturating_add(1);
        self.bonus_class = self.bonus_class.saturating_sub(1);
        self.clean_days = self.bonus_class as u32 * days_per_class;
    }
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
    /// Cotas com saque pedido e o instante em que podem ser sacadas.
    pub pending_withdraw_shares: u64,
    pub withdraw_available_at: i64,
    pub bump: u8,
    /// Cotas da classe junior (primeira perda) e saque junior pedido.
    /// Ocupam bytes que eram reservados: o layout da posicao nao muda.
    pub junior_shares: u64,
    pub pending_junior_withdraw: u64,
    pub _reserved: [u8; 16],
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
            inspection_approvals: 1,
            inspection_rejections: 0,
            inspection_voters: Vec::new(),
            inspection_fee_paid: 0,
            claims_allowed_from: 0,
            fipe_pct: 100,
            deductible_option: DeductibleOption::Normal,
            fipe_code: String::new(),
            fipe_updated_ts: 0,
            pending_owner: Pubkey::default(),
            bonus_class: 0,
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

    #[test]
    fn total_loss_rule() {
        let mut p = policy(1_000, 1, 1);
        p.coverage_limit = 100_000;
        assert!(p.is_total_loss(ClaimKind::Theft, 1));
        assert!(!p.is_total_loss(ClaimKind::Collision, 74_999));
        assert!(p.is_total_loss(ClaimKind::Collision, 75_000));
        assert!(p.is_total_loss(ClaimKind::NaturalEvent, 90_000));
    }

    #[test]
    fn bonus_class_rises_with_clean_years_and_drops_on_claim() {
        let mut d = DriverRecord {
            version: ACCOUNT_VERSION,
            owner: Pubkey::default(),
            bonus_class: 0,
            clean_days: 0,
            clean_policies: 0,
            paid_claims: 0,
            bump: 0,
            _reserved: [0; 32],
        };
        d.add_clean_days(200, 365);
        assert_eq!(d.bonus_class, 0);
        d.add_clean_days(200, 365);
        assert_eq!(d.bonus_class, 1);
        for _ in 0..30 {
            d.add_clean_days(365, 365);
        }
        assert_eq!(d.bonus_class, MAX_BONUS_CLASS);
        d.register_paid_claim(365);
        assert_eq!(d.bonus_class, MAX_BONUS_CLASS - 1);
        assert_eq!(d.clean_days, (MAX_BONUS_CLASS as u32 - 1) * 365);
    }

    #[test]
    fn panel_draw_is_a_subset_without_repeats() {
        let a: Vec<Pubkey> = (0..5).map(|_| Pubkey::new_unique()).collect();
        let p = draw_panel(&a, 3, [7u8; 32]);
        assert_eq!(p.len(), 3);
        for x in &p {
            assert!(a.contains(x));
        }
        let mut sorted = p.clone();
        sorted.sort();
        sorted.dedup();
        assert_eq!(sorted.len(), 3);
        assert_eq!(draw_panel(&a, 9, [1u8; 32]).len(), 5);
    }

    #[test]
    fn app_driver_covers_work_risks() {
        assert!(CoverageTier::AppDriver.covers(ClaimKind::Collision));
        assert!(CoverageTier::AppDriver.covers(ClaimKind::ThirdParty));
        assert!(CoverageTier::AppDriver.covers(ClaimKind::Theft));
        assert!(!CoverageTier::AppDriver.covers(ClaimKind::Other));
    }

    #[test]
    fn theft_only_covers_only_theft() {
        assert!(CoverageTier::TheftOnly.covers(ClaimKind::Theft));
        assert!(!CoverageTier::TheftOnly.covers(ClaimKind::NaturalEvent));
        assert!(!CoverageTier::TheftOnly.covers(ClaimKind::Collision));
    }
}
