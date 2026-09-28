use anchor_lang::prelude::*;

use crate::state::{ClaimKind, ClaimStatus, CoverageTier};

#[event]
pub struct PoolInitialized {
    pub pool: Pubkey,
    pub authority: Pubkey,
    pub stable_mint: Pubkey,
}

#[event]
pub struct LiquidityDeposited {
    pub owner: Pubkey,
    pub amount: u64,
    pub shares: u64,
}

#[event]
pub struct LiquidityWithdrawn {
    pub owner: Pubkey,
    pub amount: u64,
    pub shares: u64,
}

#[event]
pub struct PolicyPurchased {
    pub policy: Pubkey,
    pub owner: Pubkey,
    pub id: u64,
    pub tier: CoverageTier,
    pub premium: u64,
    pub coverage_limit: u64,
    pub end_ts: i64,
}

#[event]
pub struct ClaimFiled {
    pub claim: Pubkey,
    pub policy: Pubkey,
    pub claimant: Pubkey,
    pub kind: ClaimKind,
    pub amount: u64,
}

#[event]
pub struct ClaimVoted {
    pub claim: Pubkey,
    pub assessor: Pubkey,
    pub approve: bool,
    pub status: ClaimStatus,
}

#[event]
pub struct ClaimPaid {
    pub claim: Pubkey,
    pub claimant: Pubkey,
    pub payout: u64,
}

#[event]
pub struct PolicySettled {
    pub policy: Pubkey,
    pub owner: Pubkey,
    pub cashback_paid: u64,
}
