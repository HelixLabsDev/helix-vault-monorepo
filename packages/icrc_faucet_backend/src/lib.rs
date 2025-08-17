// SPDX-License-Identifier: MIT

use candid::{candid_method, CandidType, Deserialize, Nat, Principal};
use ic_cdk::{api, caller, id};
use ic_cdk_macros::{init, post_upgrade, pre_upgrade, query, update};
use serde::Serialize;
use std::cell::RefCell;
use std::collections::{BTreeMap, VecDeque};
use sha2::{Digest, Sha256};

// ----------------------------- ICRC-1 types -----------------------------

#[derive(Clone, Debug, CandidType, Deserialize, Serialize, PartialEq, Eq)]
pub struct Account {
    pub owner: Principal,
    pub subaccount: Option<Vec<u8>>, // 32 bytes if present
}

#[derive(Clone, Debug, CandidType, Deserialize, Serialize)]
pub struct TransferArg {
    pub from_subaccount: Option<Vec<u8>>,
    pub to: Account,
    pub amount: Nat,
    pub fee: Option<Nat>,
    pub memo: Option<Vec<u8>>,
    pub created_at_time: Option<u64>, // nanos since epoch
}

#[derive(Clone, Debug, CandidType, Deserialize, Serialize)]
pub enum TransferError {
    BadFee { expected_fee: Nat },
    BadBurn { min_burn_amount: Nat },
    InsufficientFunds { balance: Nat },
    TooOld,
    CreatedInFuture { ledger_time: u64 },
    TemporarilyUnavailable,
    Duplicate { duplicate_of: Nat },
    GenericError { error_code: Nat, message: String },
}

// ------------------------------- Events ---------------------------------

#[derive(Clone, Debug, CandidType, Deserialize, Serialize)]
pub enum FaucetEventKind {
    TokensClaimed { to: Account, amount: Nat },
    DailyAllowanceUpdated { old: Nat, new_: Nat },
    Withdrawn { to: Account, amount: Nat },
    Paused(bool),
    MaxDailyTotalSet { max: Option<Nat> },
    PowSet { bits: Option<u8> },
    OwnerChanged { old: Principal, new_: Principal },
    LedgerIdUpdated { old: Principal, new_: Principal },
    ClaimIntervalUpdated { old_nanos: u64, new_nanos: u64 },
}

#[derive(Clone, Debug, CandidType, Deserialize, Serialize)]
pub struct FaucetEvent {
    pub ts_nanos: u64,
    pub actor: Principal,
    pub kind: FaucetEventKind,
}

// ------------------------------- Config ---------------------------------

#[derive(Clone, Debug, CandidType, Deserialize, Serialize)]
pub struct PowConfig {
    /// Number of leading zero bits required in sha256(salt || principal || solution_le)
    pub leading_zero_bits: u8, // 0 disables
}

#[derive(Clone, Debug, CandidType, Deserialize, Serialize)]
pub struct FaucetConfig {
    pub owner: Principal,
    pub ledger_id: Principal,
    pub daily_allowance: Nat,
    pub claim_interval_nanos: u64, // configurable cooldown (default: 24h)
    pub paused: bool,
    pub pow: Option<PowConfig>,
    /// Optional global max total per day bucket
    pub max_daily_total: Option<Nat>,
    /// Optional per-principal lifetime max claim
    pub max_lifetime_per_principal: Option<Nat>,
}

// ------------------------------- State ----------------------------------

#[derive(Clone, Debug, CandidType, Deserialize, Serialize)]
pub struct PersistedState {
    pub cfg: FaucetConfig,
    pub last_claim_ns: BTreeMap<Principal, u64>,
    pub lifetime_claimed: BTreeMap<Principal, Nat>, // per-principal total
    pub day_totals: BTreeMap<u64, Nat>, // key = day bucket
    pub events: VecDeque<FaucetEvent>,  // ring buffer
}

thread_local! {
    static STATE: RefCell<PersistedState> = RefCell::new(PersistedState{
        cfg: FaucetConfig{
            owner: Principal::anonymous(),
            ledger_id: Principal::anonymous(),
            daily_allowance: Nat::from(0u32),
            claim_interval_nanos: 86_400_000_000_000u64, // 24h in nanos
            paused: false,
            pow: None,
            max_daily_total: None,
            max_lifetime_per_principal: None,
        },
        last_claim_ns: BTreeMap::new(),
        lifetime_claimed: BTreeMap::new(),
        day_totals: BTreeMap::new(),
        events: VecDeque::with_capacity(2_000),
    });
}

const NANOS_PER_SEC: u64 = 1_000_000_000;
const EVENTS_CAP: usize = 2_000;

type FxResult<T> = core::result::Result<T, String>;

#[inline]
fn now_ns() -> u64 { api::time() }
#[inline]
fn day_bucket(ts_ns: u64) -> u64 { ts_ns / (86_400 * NANOS_PER_SEC) }

#[inline]
fn with_state_mut<R>(f: impl FnOnce(&mut PersistedState) -> R) -> R {
    STATE.with(|s| f(&mut s.borrow_mut()))
}

#[inline]
fn with_state<R>(f: impl FnOnce(&PersistedState) -> R) -> R {
    STATE.with(|s| f(&s.borrow()))
}

fn record_event_in(st: &mut PersistedState, kind: FaucetEventKind, actor: Principal, ts: u64) {
    if st.events.len() == EVENTS_CAP { st.events.pop_front(); }
    st.events.push_back(FaucetEvent { ts_nanos: ts, actor, kind });
}

fn push_event(kind: FaucetEventKind) {
    let ts = now_ns();
    let actor = caller();
    with_state_mut(|st| record_event_in(st, kind, actor, ts));
}

fn only_owner() -> FxResult<()> {
    with_state(|st| if caller() == st.cfg.owner { Ok(()) } else { Err("Only owner".into()) })
}

fn caller_account() -> Account {
    Account { owner: caller(), subaccount: None }
}

// ------------------------------ Init/Upgrade ----------------------------

#[init]
#[candid_method(init)]
pub fn init(ledger_id: Principal, daily_allowance: Nat) {
    let owner = caller();
    with_state_mut(|st| {
        st.cfg.owner = owner;
        st.cfg.ledger_id = ledger_id;
        st.cfg.daily_allowance = daily_allowance;
    });
}

#[pre_upgrade]
fn pre_upgrade() {
    STATE.with(|s| ic_cdk::storage::stable_save((s.borrow().clone(),)).expect("stable_save failed"));
}

#[post_upgrade]
fn post_upgrade() {
    if let Ok((st,)) = ic_cdk::storage::stable_restore::<(PersistedState,)>() {
        STATE.with(|s| *s.borrow_mut() = st);
    }
}

// ------------------------------ Admin APIs ------------------------------

#[update]
#[candid_method(update)]
pub fn set_daily_allowance(new_allowance: Nat) -> FxResult<()> {
    only_owner()?;
    let actor = caller();
    let ts = now_ns();
    with_state_mut(|st| {
        let old = st.cfg.daily_allowance.clone();
        st.cfg.daily_allowance = new_allowance.clone();
        record_event_in(st, FaucetEventKind::DailyAllowanceUpdated { old, new_: new_allowance }, actor, ts);
    });
    Ok(())
}

#[update]
#[candid_method(update)]
pub fn set_claim_interval_nanos(new_interval: u64) -> FxResult<()> {
    only_owner()?;
    if new_interval == 0 { return Err("Claim interval cannot be zero".into()); }
    let actor = caller();
    let ts = now_ns();
    with_state_mut(|st| {
        let old = st.cfg.claim_interval_nanos;
        st.cfg.claim_interval_nanos = new_interval;
        record_event_in(st, FaucetEventKind::ClaimIntervalUpdated { old_nanos: old, new_nanos: new_interval }, actor, ts);
    });
    Ok(())
}

#[update]
#[candid_method(update)]
pub fn set_paused(paused: bool) -> FxResult<()> {
    only_owner()?;
    let actor = caller();
    let ts = now_ns();
    with_state_mut(|st| {
        st.cfg.paused = paused;
        record_event_in(st, FaucetEventKind::Paused(paused), actor, ts);
    });
    Ok(())
}

#[update]
#[candid_method(update)]
pub fn set_max_daily_total(max: Option<Nat>) -> FxResult<()> {
    only_owner()?;
    let actor = caller();
    let ts = now_ns();
    with_state_mut(|st| {
        st.cfg.max_daily_total = max.clone();
        record_event_in(st, FaucetEventKind::MaxDailyTotalSet { max }, actor, ts);
    });
    Ok(())
}

#[update]
#[candid_method(update)]
pub fn set_pow_bits(bits: Option<u8>) -> FxResult<()> {
    only_owner()?;
    let actor = caller();
    let ts = now_ns();
    with_state_mut(|st| {
        st.cfg.pow = bits.map(|b| PowConfig { leading_zero_bits: b });
        record_event_in(st, FaucetEventKind::PowSet { bits }, actor, ts);
    });
    Ok(())
}

#[update]
#[candid_method(update)]
pub fn transfer_ownership(new_owner: Principal) -> FxResult<()> {
    only_owner()?;
    let actor = caller();
    let ts = now_ns();
    with_state_mut(|st| {
        let old = st.cfg.owner;
        st.cfg.owner = new_owner;
        record_event_in(st, FaucetEventKind::OwnerChanged { old, new_: new_owner }, actor, ts);
    });
    Ok(())
}

#[update]
#[candid_method(update)]
pub fn set_ledger_id(new_ledger: Principal) -> FxResult<()> {
    only_owner()?;
    let actor = caller();
    let ts = now_ns();
    with_state_mut(|st| {
        let old = st.cfg.ledger_id;
        st.cfg.ledger_id = new_ledger;
        record_event_in(st, FaucetEventKind::LedgerIdUpdated { old, new_: new_ledger }, actor, ts);
    });
    Ok(())
}

// ---------------------------- Withdraw --------------------------

#[update]
#[candid_method(update)]
pub async fn withdraw_tokens(amount: Nat, to: Option<Account>) -> FxResult<Option<Nat>> {
    only_owner()?;
    let cfg = with_state(|st| st.cfg.clone());
    let dst = to.unwrap_or(caller_account());
    let arg = TransferArg {
        from_subaccount: None,
        to: dst.clone(),
        amount: amount.clone(),
        fee: None,
        memo: None,
        created_at_time: Some(now_ns()),
    };
    let block_idx = icrc1_transfer(cfg.ledger_id, arg).await?;
    push_event(FaucetEventKind::Withdrawn { to: dst, amount });
    Ok(block_idx)
}

// ---------------------------- Claim ------------------------------

#[derive(Clone, Debug, CandidType, Deserialize, Serialize)]
pub struct ClaimResult {
    pub amount: Nat,
    pub block_index: Option<Nat>,
    pub next_claim_ns: u64,
}

#[update]
#[candid_method(update)]
pub async fn claim_tokens(pow_solution: Option<u64>) -> FxResult<ClaimResult> {
    if caller() == Principal::anonymous() {
        return Err("Anonymous principals cannot claim tokens".into());
    }

    // Snapshot to avoid borrow across await
    let (cfg, last_ns, lifetime, today_total, allowance, interval) = with_state(|st| {
        let now = now_ns();
        (
            st.cfg.clone(),
            st.last_claim_ns.get(&caller()).copied(),
            st.lifetime_claimed.get(&caller()).cloned().unwrap_or(Nat::from(0u64)),
            st.day_totals.get(&day_bucket(now)).cloned().unwrap_or(Nat::from(0u64)),
            st.cfg.daily_allowance.clone(),
            st.cfg.claim_interval_nanos,
        )
    });

    if cfg.paused { return Err("Faucet is paused".into()); }
    if allowance == Nat::from(0u64) { return Err("Daily allowance is zero".into()); }

    // PoW check (require solution only if enabled and bits > 0)
    if let Some(p) = &cfg.pow {
        if p.leading_zero_bits > 0 {
            let sol = pow_solution.ok_or("PoW solution required".to_string())?;
            if !verify_pow(caller(), p.leading_zero_bits, sol) {
                return Err("Invalid PoW solution".into());
            }
        }
    }

    // Cooldown check
    if let Some(prev) = last_ns {
        let elapsed = now_ns().saturating_sub(prev);
        if elapsed < interval {
            return Err(format!("Claim too soon. Next at {} ns", prev + interval));
        }
    }

    // Lifetime cap check
    if let Some(max_life) = cfg.max_lifetime_per_principal {
        if lifetime + allowance.clone() > max_life {
            return Err("Lifetime claim limit exceeded".into());
        }
    }

    // Daily total check (best-effort)
    if let Some(max_day) = cfg.max_daily_total {
        if today_total + allowance.clone() > max_day {
            return Err("Daily budget exhausted".into());
        }
    }

    // Perform transfer
    let to_acc = caller_account();
    let arg = TransferArg {
        from_subaccount: None,
        to: to_acc.clone(),
        amount: allowance.clone(),
        fee: None,
        memo: None,
        created_at_time: Some(now_ns()),
    };
    let block_idx = icrc1_transfer(cfg.ledger_id, arg).await?;

    // Update state atomically
    let now = now_ns();
    let actor = caller();
    with_state_mut(|st| {
        st.last_claim_ns.insert(actor, now);
        let life = st.lifetime_claimed.get(&actor).cloned().unwrap_or(Nat::from(0u64));
        st.lifetime_claimed.insert(actor, life + allowance.clone());
        let day = day_bucket(now);
        let day_total = st.day_totals.get(&day).cloned().unwrap_or(Nat::from(0u64));
        st.day_totals.insert(day, day_total + allowance.clone());
        record_event_in(st, FaucetEventKind::TokensClaimed { to: to_acc, amount: allowance.clone() }, actor, now);
    });

    Ok(ClaimResult {
        amount: allowance,
        block_index: block_idx,
        next_claim_ns: now + interval,
    })
}

// ------------------------------- Queries --------------------------------

#[query]
#[candid_method(query)]
pub fn get_config() -> FaucetConfig {
    with_state(|st| st.cfg.clone())
}

#[query]
#[candid_method(query)]
pub fn get_last_claim_of(user: Principal) -> Option<u64> {
    with_state(|st| st.last_claim_ns.get(&user).cloned())
}

#[query]
#[candid_method(query)]
pub fn get_next_claim_of(user: Option<Principal>) -> Option<u64> {
    let p = user.unwrap_or(caller());
    with_state(|st| st.last_claim_ns.get(&p).map(|t| *t + st.cfg.claim_interval_nanos))
}

#[query]
#[candid_method(query)]
pub fn get_lifetime_claimed_of(user: Principal) -> Nat {
    with_state(|st| st.lifetime_claimed.get(&user).cloned().unwrap_or(Nat::from(0u64)))
}

#[update]
#[candid_method(update)]
pub async fn faucet_balance() -> FxResult<Nat> {
    let cfg = with_state(|st| st.cfg.clone());
    icrc1_balance_of(cfg.ledger_id, faucet_account()).await
}

#[query]
#[candid_method(query)]
pub fn get_daily_total(day: Option<u64>) -> Nat {
    let d = day.unwrap_or(day_bucket(now_ns()));
    with_state(|st| st.day_totals.get(&d).cloned().unwrap_or(Nat::from(0u64)))
}

#[query]
#[candid_method(query)]
pub fn recent_events(skip: u64, limit: u64) -> Vec<FaucetEvent> {
    with_state(|st| {
        let len = st.events.len();
        let s = (skip as usize).min(len);
        let l = (limit as usize).min(EVENTS_CAP);
        st.events.iter().rev().skip(s).take(l).cloned().collect()
    })
}

#[query]
#[candid_method(query)]
pub fn faucet_account() -> Account {
    Account { owner: id(), subaccount: None }
}

#[query]
#[candid_method(query)]
pub fn get_pow_salt() -> Vec<u8> {
    pow_salt_for_day(day_bucket(now_ns()))
}

// ---------------------------- Maintenance ------------------------------

#[update]
#[candid_method(update)]
pub fn prune_older_than(days: u64) -> FxResult<usize> {
    only_owner()?;
    let cutoff_day = day_bucket(now_ns()).saturating_sub(days);
    let mut removed = 0usize;

    with_state_mut(|st| {
        // last_claim_ns
        let before = st.last_claim_ns.len();
        st.last_claim_ns.retain(|_, &mut last| day_bucket(last) >= cutoff_day);
        removed += before - st.last_claim_ns.len();

        // day_totals
        let before = st.day_totals.len();
        st.day_totals.retain(|&day, _| day >= cutoff_day);
        removed += before - st.day_totals.len();

        // optional: lifetime_claimed (only keep entries that still have a last_claim)
        let before = st.lifetime_claimed.len();
        st.lifetime_claimed.retain(|p, _| st.last_claim_ns.contains_key(p));
        removed += before - st.lifetime_claimed.len();
    });

    Ok(removed)
}

// ---------------------------- Anti-bot PoW ------------------------------

fn pow_salt_for_day(day: u64) -> Vec<u8> {
    let mut salt = Vec::with_capacity(8 + id().as_slice().len());
    salt.extend_from_slice(&day.to_le_bytes());
    salt.extend_from_slice(id().as_slice());
    salt
}

fn verify_pow(principal: Principal, leading_zero_bits: u8, solution: u64) -> bool {
    if leading_zero_bits == 0 { return true; }
    let current_day = day_bucket(now_ns());
    for off in 0..=1 {
        let salt = pow_salt_for_day(current_day.saturating_sub(off));
        let mut hasher = Sha256::new();
        hasher.update(&salt);
        hasher.update(principal.as_slice());
        hasher.update(&solution.to_le_bytes());
        let digest = hasher.finalize();
        let mut zeros = 0u8;
        for &byte in digest.iter() {
            if byte == 0 {
                zeros += 8;
            } else {
                zeros += byte.leading_zeros() as u8;
                break;
            }
        }
        if zeros >= leading_zero_bits {
            return true;
        }
    }
    false
}

// ------------------------------ Ledger calls ----------------------------
fn pretty_transfer_err(e: TransferError) -> String {
    match e {
        TransferError::BadFee { expected_fee } =>
            format!("Bad fee. Expected: {}", expected_fee),
        TransferError::BadBurn { min_burn_amount } =>
            format!("Bad burn. Min: {}", min_burn_amount),
        TransferError::InsufficientFunds { balance } =>
            format!("Insufficient funds. Balance: {}", balance),
        TransferError::TooOld =>
            "Transaction too old".into(),
        TransferError::CreatedInFuture { ledger_time } =>
            format!("Created in future. Ledger time: {}", ledger_time),
        TransferError::TemporarilyUnavailable =>
            "Ledger temporarily unavailable".into(),
        TransferError::Duplicate { duplicate_of } =>
            format!("Duplicate transaction. Of: {}", duplicate_of),
        TransferError::GenericError { error_code, message } =>
            format!("Error {}: {}", error_code, message),
    }
}

async fn icrc1_transfer(ledger: Principal, arg: TransferArg) -> FxResult<Option<Nat>> {
    type Res = Result<Nat, TransferError>;
    let (res,): (Res,) = ic_cdk::call(ledger, "icrc1_transfer", (arg,))
        .await
        .map_err(|e| format!("ICRC1 transfer call failed: {}", e.1))?;
    res.map(Some).map_err(pretty_transfer_err)
}

async fn icrc1_balance_of(ledger: Principal, acc: Account) -> FxResult<Nat> {
    let (bal,): (Nat,) = ic_cdk::call(ledger, "icrc1_balance_of", (acc,))
        .await
        .map_err(|e| format!("ICRC1 balance call failed: {}", e.1))?;
    Ok(bal)
}

// ------------------------------- Utility --------------------------------

#[query]
#[candid_method(query)]
pub fn version() -> String { "icrc_faucet_backend v0.4.0".into() }

// ------------------------------- Candid ---------------------------------

candid::export_service!();

#[query(name = "__get_candid_interface_tmp_hack")]
#[candid_method(query, rename = "__get_candid_interface_tmp_hack")]
pub fn export_did() -> String { __export_service() }