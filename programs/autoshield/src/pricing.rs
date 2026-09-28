use crate::constants::*;
use crate::state::{CoverageTier, PoolParams};

pub struct Quote {
    pub premium: u64,
    pub coverage_limit: u64,
    pub deductible: u64,
    pub cashback: u64,
}

/// Calcula o premio de uma apolice.
///
/// premio = valor_fipe * taxa_base * multiplicador_plano * dias / 365
/// A mesma formula e replicada no frontend (app/src/lib/pricing.ts).
pub fn quote(
    params: &PoolParams,
    vehicle_value: u64,
    tier: CoverageTier,
    duration_days: u16,
) -> Option<Quote> {
    let value = vehicle_value as u128;
    let premium = value
        .checked_mul(params.base_rate_bps as u128)?
        .checked_mul(tier.multiplier_pct() as u128)?
        .checked_mul(duration_days as u128)?
        .checked_div(BPS_DENOMINATOR as u128 * 100 * DAYS_PER_YEAR as u128)?;
    let premium = u64::try_from(premium).ok()?;
    let deductible = u64::try_from(
        value
            .checked_mul(DEDUCTIBLE_BPS as u128)?
            .checked_div(BPS_DENOMINATOR as u128)?,
    )
    .ok()?;
    let cashback = u64::try_from(
        (premium as u128)
            .checked_mul(params.cashback_bps as u128)?
            .checked_div(BPS_DENOMINATOR as u128)?,
    )
    .ok()?;
    Some(Quote {
        premium,
        coverage_limit: vehicle_value,
        deductible,
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
            faucet_enabled: true,
        }
    }

    #[test]
    fn standard_one_year() {
        // R$ 50.000 FIPE, plano padrao, 365 dias => 3,5% = R$ 1.750
        let q = quote(&params(), 50_000_000_000, CoverageTier::Standard, 365).unwrap();
        assert_eq!(q.premium, 1_750_000_000);
        assert_eq!(q.deductible, 2_500_000_000);
        assert_eq!(q.cashback, 350_000_000);
        assert_eq!(q.coverage_limit, 50_000_000_000);
    }

    #[test]
    fn basic_is_cheaper_than_premium() {
        let b = quote(&params(), 50_000_000_000, CoverageTier::Basic, 180).unwrap();
        let p = quote(&params(), 50_000_000_000, CoverageTier::Premium, 180).unwrap();
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
}
