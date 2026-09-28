pub const POOL_SEED: &[u8] = b"pool";
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
pub const MAX_PLATE_LEN: usize = 10;
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
