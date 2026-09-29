use crate::constants::*;
use crate::state::{CoverageTier, DeductibleOption, PoolParams};

pub struct Quote {
    pub premium: u64,
    pub coverage_limit: u64,
    pub deductible: u64,
    pub cashback: u64,
}

/// Valor coberto: percentual escolhido da FIPE (90, 100 ou 110%).
pub fn coverage_for(vehicle_value: u64, fipe_pct: u8) -> Option<u64> {
    u64::try_from((vehicle_value as u128).checked_mul(fipe_pct as u128)? / 100).ok()
}

/// Franquia de danos parciais sobre o valor coberto.
pub fn deductible_for(coverage: u64, option: DeductibleOption) -> Option<u64> {
    u64::try_from((coverage as u128).checked_mul(option.bps() as u128)? / BPS_DENOMINATOR as u128).ok()
}

/// Desconto de bonus de renovacao: BONUS_PCT_PER_CLASS% por classe.
pub fn apply_bonus(premium: u64, bonus_class: u8) -> u64 {
    let class = bonus_class.min(MAX_BONUS_CLASS) as u64;
    (premium as u128 * (100 - class * BONUS_PCT_PER_CLASS) as u128 / 100) as u64
}

/// Calcula o premio de uma apolice.
///
/// cobertura = valor_fipe * %FIPE
/// premio    = cobertura * taxa_base * mult_plano * ajuste_franquia * dias / 365
/// A mesma formula e replicada no frontend (app/src/lib/pricing.ts).
pub fn quote(
    params: &PoolParams,
    vehicle_value: u64,
    tier: CoverageTier,
    duration_days: u16,
    fipe_pct: u8,
    deductible: DeductibleOption,
) -> Option<Quote> {
    let coverage = coverage_for(vehicle_value, fipe_pct)?;
    let premium = (coverage as u128)
        .checked_mul(params.base_rate_bps as u128)?
        .checked_mul(tier.multiplier_pct() as u128)?
        .checked_mul(deductible.price_pct() as u128)?
        .checked_mul(duration_days as u128)?
        .checked_div(BPS_DENOMINATOR as u128 * 100 * 100 * DAYS_PER_YEAR as u128)?;
    let premium = u64::try_from(premium).ok()?;
    let cashback = u64::try_from(
        (premium as u128)
            .checked_mul(params.cashback_bps as u128)?
            .checked_div(BPS_DENOMINATOR as u128)?,
    )
    .ok()?;
    Some(Quote {
        premium,
        coverage_limit: coverage,
        deductible: deductible_for(coverage, deductible)?,
        cashback,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn params() -> PoolParams {
        PoolParams {
            base_rate_bps: 350,
            cashback_bps: 2_000,
            protocol_fee_bps: 500,
            min_collateral_bps: 1_000,
            withdraw_cooldown_secs: 0,
            claim_voting_secs: 3_600,
            seconds_per_day: 86_400,
            claim_waiting_secs: 0,
            installment_grace_secs: 0,
            governance_delay_secs: 0,
            inspection_fee: 0,
            vote_reward: 0,
            min_vehicle_value: 1,
            inspection_threshold: 1,
            withdraw_notice_secs: 0,
            max_policy_coverage_bps: 100_000,
            faucet_enabled: true,
        }
    }

    #[test]
    fn standard_one_year() {
        // R$ 50.000 FIPE, plano padrao, 365 dias => 3,5% = R$ 1.750
        let q = quote(&params(), 50_000_000_000, CoverageTier::Standard, 365, 100, DeductibleOption::Normal).unwrap();
        assert_eq!(q.premium, 1_750_000_000);
        assert_eq!(q.deductible, 2_500_000_000);
        assert_eq!(q.cashback, 350_000_000);
        assert_eq!(q.coverage_limit, 50_000_000_000);
    }

    #[test]
    fn basic_is_cheaper_than_premium() {
        let b = quote(&params(), 50_000_000_000, CoverageTier::Basic, 180, 100, DeductibleOption::Normal).unwrap();
        let p = quote(&params(), 50_000_000_000, CoverageTier::Premium, 180, 100, DeductibleOption::Normal).unwrap();
        assert!(b.premium < p.premium);
    }

    #[test]
    fn tier_coverage_rules() {
        use crate::state::ClaimKind::*;
        assert!(CoverageTier::Basic.covers(Theft));
        assert!(!CoverageTier::Basic.covers(Collision));
        assert!(CoverageTier::Standard.covers(Collision));
        assert!(!CoverageTier::Standard.covers(ThirdParty));
        assert!(CoverageTier::Premium.covers(ThirdParty));
    }

    #[test]
    fn bonus_discount() {
        assert_eq!(apply_bonus(1_000, 0), 1_000);
        assert_eq!(apply_bonus(1_000, 3), 880);
        assert_eq!(apply_bonus(1_000, 10), 600);
        assert_eq!(apply_bonus(1_000, 200), 600);
    }

    #[test]
    fn fipe_pct_and_deductible_change_price() {
        let v = 50_000_000_000;
        let base = quote(&params(), v, CoverageTier::Standard, 365, 100, DeductibleOption::Normal).unwrap();
        let p110 = quote(&params(), v, CoverageTier::Standard, 365, 110, DeductibleOption::Normal).unwrap();
        assert_eq!(p110.coverage_limit, 55_000_000_000);
        assert_eq!(p110.premium, 1_925_000_000);
        let reduced = quote(&params(), v, CoverageTier::Standard, 365, 100, DeductibleOption::Reduced).unwrap();
        let increased = quote(&params(), v, CoverageTier::Standard, 365, 100, DeductibleOption::Increased).unwrap();
        assert!(reduced.premium > base.premium && increased.premium < base.premium);
        assert_eq!(reduced.deductible, 1_250_000_000);
        assert_eq!(increased.deductible, 5_000_000_000);
        let theft = quote(&params(), v, CoverageTier::TheftOnly, 365, 100, DeductibleOption::Normal).unwrap();
        assert_eq!(theft.premium, 612_500_000);
    }
}
