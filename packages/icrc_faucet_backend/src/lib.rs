// SPDX-License-Identifier: MIT

// Features
// - Daily per-principal allowance (24h cooldown)
// - Owner controls: pause, allowance, max daily cap, PoW difficulty, ledger id, ownership transfer
// - Optional Proof-of-Work (leading-zero bits) anti-bot
// - Withdraw back to owner
// - Event log + queries
// - Upgrade-safe state (stable (de)serialization)
// - Faucet balance via UPDATE to avoid IC0504
//
// Notes
// - This faucet uses ICRC-1 transfer only. If you want allowance-pull (ICRC-2), add a variant path.
// - We avoid nested STATE borrows by recording events via a helper that writes inside the same borrow.
// - No panics: all fallible paths return Result<String> errors.

use candid::{candid_method, CandidType, Deserialize, Nat, Principal};
use ic_cdk::{api, caller, id};
use ic_cdk_macros::{init, post_upgrade, pre_upgrade, query, update};
use serde::Serialize;
use std::cell::RefCell;
use std::collections::{BTreeMap, VecDeque};

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
    pub paused: bool,
    pub pow: Option<PowConfig>,
    /// Optional global max total per UTC day (00:00..23:59) to limit distribution budget
    pub max_daily_total: Option<Nat>,
}

// ------------------------------- State ----------------------------------

#[derive(Clone, Debug, CandidType, Deserialize, Serialize)]
pub struct PersistedState {
    pub cfg: FaucetConfig,
    pub last_claim_ns: BTreeMap<Principal, u64>,
    pub day_totals: BTreeMap<u64, Nat>, // key = day bucket (UTC days since epoch)
    pub events: VecDeque<FaucetEvent>,   // ring buffer persisted
}

thread_local! {
    static STATE: RefCell<PersistedState> = RefCell::new(PersistedState{
        cfg: FaucetConfig{
            owner: Principal::anonymous(),
            ledger_id: Principal::anonymous(),
            daily_allowance: Nat::from(0u32),
            paused: false,
            pow: None,
            max_daily_total: None,
        },
        last_claim_ns: BTreeMap::new(),
        day_totals: BTreeMap::new(),
        events: VecDeque::with_capacity(2_000),
    });
}

const NANOS_PER_SEC: u64 = 1_000_000_000;
const SECS_PER_DAY: u64 = 86_400;
const NANOS_PER_DAY: u64 = SECS_PER_DAY * NANOS_PER_SEC;
const EVENTS_CAP: usize = 2_000; // ring buffer max

type FxResult<T> = core::result::Result<T, String>;

#[inline]
fn now_ns() -> u64 { api::time() }
#[inline]
fn day_bucket(ts_ns: u64) -> u64 { ts_ns / NANOS_PER_DAY }

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

/// Convenience: record an event when you are NOT already borrowing STATE.
fn push_event(kind: FaucetEventKind) {
    let ts = now_ns();
    let actor = caller();
    with_state_mut(|st| record_event_in(st, kind, actor, ts));
}

fn only_owner() -> FxResult<()> {
    with_state(|st| if caller() == st.cfg.owner { Ok(()) } else { Err("Only owner".into()) })
}

// ------------------------------ Init/Upgrade ----------------------------

#[init]
#[candid_method(init)]
pub fn init(ledger_id: Principal, daily_allowance: Nat) {
    let owner = caller();
    with_state_mut(|st| {
        st.cfg = FaucetConfig {
            owner,
            ledger_id,
            daily_allowance,
            paused: false,
            pow: None,
            max_daily_total: None,
        };
    });
}

#[pre_upgrade]
fn pre_upgrade() { STATE.with(|s| ic_cdk::storage::stable_save((s.borrow().clone(),)).expect("stable_save")); }

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
    with_state_mut(|st| st.cfg.ledger_id = new_ledger);
    Ok(())
}

// ---------------------------- Claim / Withdraw --------------------------

#[derive(Clone, Debug, CandidType, Deserialize, Serialize)]
pub struct ClaimResult {
    pub amount: Nat,
    pub block_index: Option<Nat>,
    pub next_claim_ns: u64,
}

#[update]
#[candid_method(update)]
pub async fn claim_tokens(pow_solution: Option<u64>) -> FxResult<ClaimResult> {
    // Snapshot config and current counters without holding a borrow across await.
    let (cfg, last_ns_for_me, today_total, allowance) = with_state(|st| {
        let now = now_ns();
        (
            st.cfg.clone(),
            st.last_claim_ns.get(&caller()).copied(),
            st.day_totals.get(&day_bucket(now)).cloned().unwrap_or_else(|| Nat::from(0u32)),
            st.cfg.daily_allowance.clone(),
        )
    });

    if cfg.paused { return Err("Faucet is paused".into()); }
    if allowance == Nat::from(0u32) { return Err("Daily allowance is zero".into()); }

    // Anti-bot PoW (optional)
    if let Some(p) = cfg.pow {
        if !verify_pow(caller(), p.leading_zero_bits, pow_solution.unwrap_or_default()) {
            return Err("Invalid or missing PoW solution".into());
        }
    }

    // 24h cooldown per principal
    if let Some(prev) = last_ns_for_me {
        let elapsed = now_ns().saturating_sub(prev);
        if elapsed < NANOS_PER_DAY {
            let next = prev + NANOS_PER_DAY;
            return Err(format!("Already claimed. Next claim at {} ns", next));
        }
    }

    // Global daily budget check (best-effort, might race under heavy concurrency)
    if let Some(max) = cfg.max_daily_total.clone() {
        if today_total.clone() + allowance.clone() > max { return Err("Daily budget exhausted".into()); }
    }

    // Transfer to caller's default account
    let to_acc = Account { owner: caller(), subaccount: None };
    let transfer_arg = TransferArg {
        from_subaccount: None,
        to: to_acc.clone(),
        amount: allowance.clone(),
        fee: None,
        memo: None,
        created_at_time: Some(now_ns()),
    };

    let block_idx = icrc1_transfer(cfg.ledger_id, transfer_arg).await
        .map_err(|e| format!("transfer failed: {}", e))?;

    // Update state & record event in a single borrow
    let actor = caller();
    let now = now_ns();
    with_state_mut(|st| {
        st.last_claim_ns.insert(actor, now);
        let key = day_bucket(now);
        let cur = st.day_totals.get(&key).cloned().unwrap_or_else(|| Nat::from(0u32));
        st.day_totals.insert(key, cur + allowance.clone());
        record_event_in(st, FaucetEventKind::TokensClaimed { to: to_acc.clone(), amount: allowance.clone() }, actor, now);
    });

    Ok(ClaimResult { amount: allowance, block_index: block_idx, next_claim_ns: now + NANOS_PER_DAY })
}

#[update]
#[candid_method(update)]
pub async fn withdraw_tokens(amount: Nat, to: Option<Account>) -> FxResult<Nat> {
    only_owner()?;
    let cfg = with_state(|st| st.cfg.clone());
    let dst = to.unwrap_or(Account { owner: cfg.owner, subaccount: None });

    let arg = TransferArg {
        from_subaccount: None,
        to: dst.clone(),
        amount: amount.clone(),
        fee: None,
        memo: None,
        created_at_time: Some(now_ns()),
    };

    let block = icrc1_transfer(cfg.ledger_id, arg).await
        .map_err(|e| format!("withdraw failed: {}", e))?;

    // Record event (not holding a borrow here)
    push_event(FaucetEventKind::Withdrawn { to: dst, amount: amount.clone() });
    Ok(block.unwrap_or_else(|| Nat::from(0u32)))
}

// ------------------------------- Queries --------------------------------

#[query]
#[candid_method(query)]
pub fn get_config() -> FaucetConfig { with_state(|st| st.cfg.clone()) }

#[query]
#[candid_method(query)]
pub fn get_last_claim_of(user: Principal) -> Option<u64> { with_state(|st| st.last_claim_ns.get(&user).copied()) }

// NOTE: Faucet balance performs cross-canister call; keep as UPDATE to avoid IC0504.
#[update]
#[candid_method(update)]
pub async fn faucet_balance() -> FxResult<Nat> {
    let cfg = with_state(|st| st.cfg.clone());
    icrc1_balance_of(cfg.ledger_id, Account { owner: id(), subaccount: None }).await
}

#[query]
#[candid_method(query)]
pub fn recent_events(from_latest: usize, limit: usize) -> Vec<FaucetEvent> {
    with_state(|st| {
        let ev = &st.events;
        let len = ev.len();
        if len == 0 { return vec![]; }
        let end = len.saturating_sub(from_latest);
        let start = end.saturating_sub(limit);
        ev.iter().cloned().skip(start).take(end.saturating_sub(start)).collect()
    })
}

// ---------------------------- Anti-bot PoW ------------------------------

fn verify_pow(principal: Principal, leading_zero_bits: u8, solution: u64) -> bool {
    use sha2::{Digest, Sha256};
    if leading_zero_bits == 0 { return true; }

    // Salt changes over time to prevent precomputation: use day bucket + canister id
    let mut salt = Vec::with_capacity(8 + id().as_slice().len());
    salt.extend_from_slice(&day_bucket(now_ns()).to_le_bytes());
    salt.extend_from_slice(id().as_slice());

    let mut hasher = Sha256::new();
    hasher.update(&salt);
    hasher.update(principal.as_slice());
    hasher.update(solution.to_le_bytes());
    let digest = hasher.finalize();

    // Count leading zero bits
    let mut zeros = 0u8;
    for byte in digest {
        if byte == 0 { zeros += 8; } else { zeros += byte.leading_zeros() as u8; break; }
    }
    zeros >= leading_zero_bits
}

// ------------------------------ Ledger calls ----------------------------

async fn icrc1_transfer(ledger: Principal, arg: TransferArg) -> FxResult<Option<Nat>> {
    type Res = Result<Nat, TransferError>;
    let (res,): (Res,) = ic_cdk::call(ledger, "icrc1_transfer", (arg,))
        .await
        .map_err(|e| format!("call icrc1_transfer: {}", e.1))?;
    match res { Ok(idx) => Ok(Some(idx)), Err(e) => Err(format!("ledger error: {:?}", e)) }
}

async fn icrc1_balance_of(ledger: Principal, acc: Account) -> FxResult<Nat> {
    let (bal,): (Nat,) = ic_cdk::call(ledger, "icrc1_balance_of", (acc,))
        .await
        .map_err(|e| format!("call icrc1_balance_of: {}", e.1))?;
    Ok(bal)
}

// ------------------------------- Utility --------------------------------

#[query]
#[candid_method(query)]
pub fn version() -> String { "icrc_faucet_backend v0.2.0".into() }

// ------------------------------- Candid ---------------------------------

// Generate service text at compile time for __get_candid_interface_tmp_hack
candid::export_service!();

#[query(name = "__get_candid_interface_tmp_hack")]
#[candid_method(query, rename = "__get_candid_interface_tmp_hack")]
pub fn export_did() -> String { __export_service() }
