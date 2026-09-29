/// "pool_v2": layout de contas v2 (o pool v1 da devnet fica abandonado).
pub const POOL_SEED: &[u8] = b"pool_v2";
pub const VAULT_SEED: &[u8] = b"vault";
pub const POLICY_SEED: &[u8] = b"policy";
pub const CLAIM_SEED: &[u8] = b"claim";
pub const STAKE_SEED: &[u8] = b"stake";
pub const VEHICLE_SEED: &[u8] = b"vehicle";
pub const TEST_MINT_SEED: &[u8] = b"test_mint";
pub const MINT_AUTH_SEED: &[u8] = b"mint_auth";

pub const BPS_DENOMINATOR: u64 = 10_000;
pub const DAYS_PER_YEAR: u64 = 365;

pub const MAX_ASSESSORS: usize = 5;
pub const MAX_MODEL_LEN: usize = 48;
pub const MAX_DESCRIPTION_LEN: usize = 200;
pub const MAX_URI_LEN: usize = 200;

pub const MIN_POLICY_DAYS: u16 = 30;
pub const MAX_POLICY_DAYS: u16 = 365;

/// Franquia padrao: 5% do valor FIPE do veiculo.
pub const DEDUCTIBLE_BPS: u64 = 500;

/// Limite do faucet de tokens de teste por chamada (6 casas decimais).
pub const FAUCET_MAX_PER_CALL: u64 = 200_000 * 1_000_000;
pub const TEST_MINT_DECIMALS: u8 = 6;

/// Parcelamento: ate 12 parcelas, cada uma cobrindo ao menos 30 dias.
pub const MAX_INSTALLMENTS: u8 = 12;
pub const MIN_DAYS_PER_INSTALLMENT: u16 = 30;

/// Cotas "mortas" emitidas no primeiro aporte e nunca resgataveis: tornam o
/// ataque de inflacao de cotas (doacao direta ao cofre) inviavel.
pub const DEAD_SHARES: u64 = 1_000_000;
/// Primeiro aporte minimo do pool (100 tokens com 6 casas).
pub const MIN_FIRST_DEPOSIT: u64 = 100 * 1_000_000;

/// Perda total: dano a partir de 75% do valor coberto (regra de mercado no Brasil).
pub const TOTAL_LOSS_BPS: u64 = 7_500;

/// Direito de arrependimento (CDC art. 49): 7 dias com devolucao integral.
pub const COOLING_OFF_DAYS: i64 = 7;

/// Percentuais da FIPE aceitos na contratacao.
pub const FIPE_PCT_OPTIONS: [u8; 3] = [90, 100, 110];

/// Variacao maxima do valor FIPE por atualizacao do oraculo (20%): limita o
/// estrago de um oraculo comprometido.
pub const MAX_FIPE_CHANGE_BPS: u64 = 2_000;

/// Codigo FIPE + ano, ex.: "005340-6|2014-3".
pub const MAX_FIPE_CODE_LEN: usize = 16;

pub const SHOP_SEED: &[u8] = b"shop";
pub const DRIVER_SEED: &[u8] = b"driver";
pub const MAX_SHOP_NAME_LEN: usize = 48;
pub const MAX_SHOP_CITY_LEN: usize = 32;

/// Recurso contra sinistro recusado: ate 7 dias (da apolice) apos a recusa.
pub const APPEAL_WINDOW_DAYS: i64 = 7;

/// Bonus de renovacao: 4% de desconto por classe, ate a classe 10 (40%).
pub const BONUS_PCT_PER_CLASS: u64 = 4;
pub const MAX_BONUS_CLASS: u8 = 10;
pub const DEFAULT_BONUS_DAYS_PER_CLASS: u32 = 365;
