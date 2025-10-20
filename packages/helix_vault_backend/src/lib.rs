// SPDX-License-Identifier: MIT
// Copyright (c) 2025 Helix Labs

use candid::{CandidType, Nat};
use ic_cdk::{
    call,
    storage::{stable_restore, stable_save},
};
use ic_principal::Principal;
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc1::transfer::{TransferArg, TransferError};
use icrc_ledger_types::icrc2::transfer_from::{TransferFromArgs, TransferFromError};
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::collections::{HashMap, HashSet};
use std::str::FromStr;

const ICRC1_LEDGER_CANISTER_ID: &str = "br5f7-7uaaa-aaaaa-qaaca-cai";
const EVM_BACKEND_CANISTER_ID: &str = "bkyz2-fmaaa-aaaaa-qaaaq-cai";
const CONTRACT_ADDRESS: &str = "0x272aEe5159a257359e84EAB3a6e3bd7F90b712EC";
const DEFAULT_TRANSFER_FEE: u64 = 10_000;

#[derive(Clone, Default)]
struct State {
    user_balances: HashMap<Principal, Nat>,
    total_deposited: Nat,
    transfer_fee: Nat,
    used_tx_hashes: HashSet<String>,
    config: BridgeConfig,
    fee_initialized: bool,
}

impl State {
    fn new() -> Self {
        Self {
            user_balances: HashMap::new(),
            total_deposited: Nat::from(0u64),
            transfer_fee: Nat::from(DEFAULT_TRANSFER_FEE),
            used_tx_hashes: HashSet::new(),
            config: BridgeConfig::default(),
            fee_initialized: false,
        }
    }
}

#[derive(Clone, CandidType, Serialize, Deserialize)]
struct BridgeConfig {
    ledger_canister: Principal,
    evm_backend_canister: Principal,
    contract_address: String,
}

impl Default for BridgeConfig {
    fn default() -> Self {
        let default_contract =
            normalize_contract_address(CONTRACT_ADDRESS).expect("invalid default contract address");
        Self {
            ledger_canister: Principal::from_text(ICRC1_LEDGER_CANISTER_ID)
                .expect("invalid default ledger principal"),
            evm_backend_canister: Principal::from_text(EVM_BACKEND_CANISTER_ID)
                .expect("invalid default evm backend principal"),
            contract_address: default_contract,
        }
    }
}

#[derive(CandidType, Serialize, Deserialize)]
struct StableState {
    user_balances: Vec<(Principal, Nat)>,
    total_deposited: Nat,
    transfer_fee: Nat,
    used_tx_hashes: Vec<String>,
    config: BridgeConfig,
    fee_initialized: bool,
}

impl From<&State> for StableState {
    fn from(state: &State) -> Self {
        StableState {
            user_balances: state
                .user_balances
                .iter()
                .map(|(principal, balance)| (*principal, balance.clone()))
                .collect(),
            total_deposited: state.total_deposited.clone(),
            transfer_fee: state.transfer_fee.clone(),
            used_tx_hashes: state.used_tx_hashes.iter().cloned().collect(),
            config: state.config.clone(),
            fee_initialized: state.fee_initialized,
        }
    }
}

impl From<StableState> for State {
    fn from(state: StableState) -> Self {
        State {
            user_balances: state.user_balances.into_iter().collect(),
            total_deposited: state.total_deposited,
            transfer_fee: state.transfer_fee,
            used_tx_hashes: state.used_tx_hashes.into_iter().collect(),
            config: state.config,
            fee_initialized: state.fee_initialized,
        }
    }
}

thread_local! {
    static STATE: RefCell<State> = RefCell::new(State::new());
}

#[derive(CandidType, Deserialize)]
struct BurnValidation {
    from: String,
    amount_wei: String,
    contract: String,
}

#[ic_cdk::pre_upgrade]
fn pre_upgrade() {
    STATE.with(|state| {
        let stable: StableState = StableState::from(&*state.borrow());
        stable_save((stable,))
            .unwrap_or_else(|e| ic_cdk::trap(&format!("failed to persist state: {}", e)));
    });
}

#[ic_cdk::post_upgrade]
fn post_upgrade() {
    match stable_restore::<(StableState,)>() {
        Ok((stable,)) => STATE.with(|state| {
            *state.borrow_mut() = stable.into();
        }),
        Err(_) => STATE.with(|state| *state.borrow_mut() = State::new()),
    }
}

fn apply_successful_deposit(caller: Principal, amount: &Nat) {
    STATE.with(|state| {
        let mut state = state.borrow_mut();
        let entry = state
            .user_balances
            .entry(caller)
            .or_insert_with(|| Nat::from(0u64));
        *entry += amount.clone();
        state.total_deposited += amount.clone();
    });
}

fn apply_successful_withdraw(
    caller: &Principal,
    withdraw_amount: &Nat,
    total_amount: &Nat,
) -> Result<(), String> {
    STATE.with(|state| {
        let mut state = state.borrow_mut();
        if state.total_deposited < total_amount.clone() {
            return Err("Vault accounting underflow detected.".to_string());
        }
        let balance = state
            .user_balances
            .get_mut(caller)
            .ok_or_else(|| "Recorded balance missing for caller.".to_string())?;
        if *balance < withdraw_amount.clone() {
            return Err("Recorded balance insufficient for withdrawal.".to_string());
        }
        *balance -= withdraw_amount.clone();
        state.total_deposited -= total_amount.clone();
        Ok(())
    })
}

fn ensure_controller(caller: Principal) -> Result<(), String> {
    if ic_cdk::api::is_controller(&caller) {
        Ok(())
    } else {
        Err("Caller is not authorized".to_string())
    }
}

fn current_config() -> BridgeConfig {
    STATE.with(|state| state.borrow().config.clone())
}

async fn refresh_transfer_fee_if_stale(default_fee: &Nat) -> Result<Nat, String> {
    let (token_canister, should_refresh, cached_fee) = STATE.with(|state| {
        let state = state.borrow();
        (
            state.config.ledger_canister,
            !state.fee_initialized || &state.transfer_fee == default_fee,
            state.transfer_fee.clone(),
        )
    });

    if !should_refresh {
        return Ok(cached_fee);
    }

    let fee = match call::<(), (Nat,)>(token_canister, "icrc1_fee", ()).await {
        Ok((fee,)) => fee,
        Err(e) => {
            return Err(format!("Failed to refresh transfer fee: {:?}", e));
        }
    };

    STATE.with(|state| {
        let mut state = state.borrow_mut();
        state.transfer_fee = fee.clone();
        state.fee_initialized = true;
    });

    Ok(fee)
}

async fn attempt_refund(
    token_canister: Principal,
    recipient: Principal,
    amount: Nat,
    fee: Nat,
) -> Result<(), String> {
    let refund_arg = TransferArg {
        from_subaccount: None,
        to: Account {
            owner: recipient,
            subaccount: None,
        },
        amount,
        fee: Some(fee),
        memo: None,
        created_at_time: None,
    };

    match call::<(TransferArg,), (Result<Nat, TransferError>,)>(
        token_canister,
        "icrc1_transfer",
        (refund_arg,),
    )
    .await
    {
        Ok((Ok(_),)) => Ok(()),
        Ok((Err(err),)) => Err(format!("Refund transfer failed: {:?}", err)),
        Err(err) => Err(format!("Refund transfer call failed: {:?}", err)),
    }
}

fn normalize_contract_address(address: &str) -> Result<String, String> {
    let trimmed = address.trim();
    if trimmed.is_empty() {
        return Err("Contract address cannot be empty".to_string());
    }

    let lowercase = trimmed.to_lowercase();
    let without_prefix = lowercase.strip_prefix("0x").unwrap_or(&lowercase);

    if without_prefix.len() != 40 || !without_prefix.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err("Contract address must be a 0x-prefixed 40 hex character string".to_string());
    }

    Ok(format!("0x{}", without_prefix))
}

#[ic_cdk::query]
fn get_user_balance(user: Principal) -> Nat {
    STATE.with(|state| {
        state
            .borrow()
            .user_balances
            .get(&user)
            .cloned()
            .unwrap_or_else(|| Nat::from(0u64))
    })
}

#[ic_cdk::query]
fn get_vault_balance() -> Nat {
    STATE.with(|state| state.borrow().total_deposited.clone())
}

#[ic_cdk::query]
fn get_transfer_fee() -> Nat {
    STATE.with(|state| state.borrow().transfer_fee.clone())
}

#[ic_cdk::query]
fn get_bridge_configuration() -> BridgeConfig {
    current_config()
}

#[ic_cdk::update]
fn set_bridge_configuration(
    ledger_canister: Principal,
    evm_backend_canister: Principal,
    contract_address: String,
) -> Result<(), String> {
    let caller = ic_cdk::api::caller();
    ensure_controller(caller)?;

    let normalized_contract = normalize_contract_address(&contract_address)?;

    STATE.with(|state| {
        let mut state = state.borrow_mut();
        state.config = BridgeConfig {
            ledger_canister,
            evm_backend_canister,
            contract_address: normalized_contract,
        };
        state.fee_initialized = false;
    });

    Ok(())
}

#[ic_cdk::update]
async fn deposit_icrc1(amount: Nat, eth_address: String) -> Result<String, String> {
    if amount == Nat::from(0u64) {
        return Err("Deposit amount must be greater than zero".to_string());
    }

    if eth_address.trim().is_empty() {
        return Err("Ethereum address must be provided".to_string());
    }

    let caller = ic_cdk::api::caller();
    let config = current_config();
    let token_canister = config.ledger_canister;

    let default_fee = Nat::from(DEFAULT_TRANSFER_FEE);
    let fee = refresh_transfer_fee_if_stale(&default_fee).await?;

    if amount <= fee {
        return Err(format!(
            "Deposit must exceed the transfer fee of {} units",
            fee
        ));
    }

    let transfer_arg = TransferFromArgs {
        spender_subaccount: None,
        from: Account {
            owner: caller,
            subaccount: None,
        },
        to: Account {
            owner: ic_cdk::id(),
            subaccount: None,
        },
        amount: amount.clone(),
        fee: Some(fee.clone()),
        memo: None,
        created_at_time: None,
    };

    match call::<(TransferFromArgs,), (Result<Nat, TransferFromError>,)>(
        token_canister,
        "icrc2_transfer_from",
        (transfer_arg,),
    )
    .await
    {
        Ok((Ok(_block_index),)) => {
            let evm_backend = config.evm_backend_canister;
            let contract = config.contract_address.clone();

            let scaled_amount = (amount.0.clone() * 10u128.pow(10)).to_string();
            let result: (Result<String, String>,) =
                call(evm_backend, "mint", (contract, eth_address, scaled_amount))
                    .await
                    .map_err(|e| format!("Call failed: {:?}", e))?;

            match result.0 {
                Ok(tx_hash) => {
                    apply_successful_deposit(caller, &amount);

                    STATE.with(|state| {
                        let mut state = state.borrow_mut();
                        state.transfer_fee = fee.clone();
                        state.fee_initialized = true;
                    });

                    Ok(format!(
                        "Deposit successful. Mint transaction sent: {}",
                        tx_hash
                    ))
                }
                Err(e) => {
                    let refund_result =
                        attempt_refund(token_canister, caller, amount.clone(), fee.clone()).await;

                    let refund_message = match refund_result {
                        Ok(_) => "Refunded deposit amount after mint failure.".to_string(),
                        Err(err) => format!("Failed to refund deposit after mint failure: {}", err),
                    };

                    Err(format!(
                        "Deposit succeeded but mint failed: {}. {}",
                        e, refund_message
                    ))
                }
            }
        }
        Ok((Err(e),)) => Err(format!("Transfer failed: {:?}", e)),
        Err(e) => Err(format!("Call failed: {:?}", e)),
    }
}

#[ic_cdk::update]
async fn unlock_icrc1(
    tx_hash: String,
    expected_eth_from: String,
    evm_amount_18dec: String,
    withdraw_amount_8dec: Nat,
    expected_contract: String,
) -> Result<String, String> {
    let config = current_config();

    if !expected_contract.eq_ignore_ascii_case(&config.contract_address) {
        return Err("Unsupported contract address".to_string());
    }

    if withdraw_amount_8dec == Nat::from(0u64) {
        return Err("Withdrawal amount must be greater than zero".to_string());
    }

    let normalized_tx_hash = tx_hash.to_lowercase();

    let already_used =
        STATE.with(|state| state.borrow().used_tx_hashes.contains(&normalized_tx_hash));
    if already_used {
        return Err("Transaction hash has already been used for unlock.".to_string());
    }

    // Ensure the caller has sufficient recorded balance
    let caller = ic_cdk::api::caller();
    let recorded_balance = STATE.with(|state| {
        state
            .borrow()
            .user_balances
            .get(&caller)
            .cloned()
            .unwrap_or_else(|| Nat::from(0u64))
    });
    if recorded_balance < withdraw_amount_8dec {
        return Err("Insufficient recorded balance for withdrawal.".to_string());
    }

    // 2. Verify the burn on EVM
    let (result,): (Result<BurnValidation, String>,) = call(
        config.evm_backend_canister,
        "verify_tx_receipt_with_validation",
        (
            tx_hash.clone(),
            expected_eth_from.clone(),
            evm_amount_18dec.clone(),
            expected_contract.clone(),
        ),
    )
    .await
    .map_err(|e| format!("Call to EVM RPC failed: {:?}", e))?;

    match result {
        Ok(proof) => {
            if !proof
                .contract
                .eq_ignore_ascii_case(&config.contract_address)
            {
                return Err("Burn proof references unexpected contract.".to_string());
            }

            if !proof.from.eq_ignore_ascii_case(&expected_eth_from) {
                return Err("Burn proof does not match expected burner address.".to_string());
            }

            if proof.amount_wei != evm_amount_18dec {
                return Err("Burn proof amount mismatch.".to_string());
            }

            // Convert 18 decimal burn amount back to 8 decimal withdraw amount
            let burn_amount_nat = Nat::from_str(&proof.amount_wei)
                .map_err(|_| "Invalid burn amount format".to_string())?;
            let scale = Nat::from(10u128.pow(10));

            if burn_amount_nat.clone() % scale.clone() != Nat::from(0u64) {
                return Err("Burn amount is not aligned with expected decimals.".to_string());
            }

            let withdraw_from_burn = burn_amount_nat / scale.clone();
            if withdraw_from_burn != withdraw_amount_8dec {
                return Err("Requested withdrawal does not match burned amount.".to_string());
            }

            let default_fee = Nat::from(DEFAULT_TRANSFER_FEE);
            let fee = refresh_transfer_fee_if_stale(&default_fee).await?;
            let total_amount = withdraw_amount_8dec.clone() + fee.clone();

            let token_canister = config.ledger_canister;
            let vault_balance = match call::<(Account,), (Nat,)>(
                token_canister,
                "icrc1_balance_of",
                (Account {
                    owner: ic_cdk::id(),
                    subaccount: None,
                },),
            )
            .await
            {
                Ok((bal,)) => bal,
                Err(e) => return Err(format!("Failed to get vault balance: {:?}", e)),
            };

            if vault_balance < total_amount {
                return Err(format!(
                    "Insufficient vault balance to unlock amount + fee."
                ));
            }

            let transfer_arg = TransferArg {
                from_subaccount: None,
                to: Account {
                    owner: caller,
                    subaccount: None,
                },
                amount: withdraw_amount_8dec.clone(),
                fee: Some(fee.clone()),
                memo: None,
                created_at_time: None,
            };

            match call::<(TransferArg,), (Result<Nat, TransferError>,)>(
                token_canister,
                "icrc1_transfer",
                (transfer_arg,),
            )
            .await
            {
                Ok((Ok(_block_index),)) => {
                    apply_successful_withdraw(&caller, &withdraw_amount_8dec, &total_amount)?;
                    STATE.with(|state| {
                        let mut state = state.borrow_mut();
                        state.used_tx_hashes.insert(normalized_tx_hash);
                        state.transfer_fee = fee.clone();
                        state.fee_initialized = true;
                    });

                    Ok(format!(
                        "Unlocked {} nICP to caller. Verified burn on Ethereum.",
                        withdraw_amount_8dec
                    ))
                }
                Ok((Err(e),)) => Err(format!("Transfer failed: {:?}", e)),
                Err(e) => Err(format!("Transfer call failed: {:?}", e)),
            }
        }
        Err(err_msg) => Err(format!("Burn verification failed: {}", err_msg)),
    }
}

#[ic_cdk::update]
async fn sync_state() -> Result<(), String> {
    let config = current_config();
    let token_canister = config.ledger_canister;
    let balance = match call::<(Account,), (Nat,)>(
        token_canister,
        "icrc1_balance_of",
        (Account {
            owner: ic_cdk::id(),
            subaccount: None,
        },),
    )
    .await
    {
        Ok((balance,)) => balance,
        Err(e) => return Err(format!("Failed to sync vault balance: {:?}", e)),
    };
    let fee = match call::<(), (Nat,)>(token_canister, "icrc1_fee", ()).await {
        Ok((fee,)) => fee,
        Err(e) => return Err(format!("Failed to sync fee: {:?}", e)),
    };

    STATE.with(|state| {
        let mut state = state.borrow_mut();
        state.total_deposited = balance;
        state.transfer_fee = fee;
        state.fee_initialized = true;
    });
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn reset_state() {
        STATE.with(|state| *state.borrow_mut() = State::new());
    }

    #[test]
    fn apply_successful_deposit_updates_balances() {
        reset_state();
        let caller = Principal::anonymous();
        let amount = Nat::from(50u64);

        apply_successful_deposit(caller, &amount);

        let stored_balance = STATE.with(|state| {
            state
                .borrow()
                .user_balances
                .get(&Principal::anonymous())
                .cloned()
        });
        let total = STATE.with(|state| state.borrow().total_deposited.clone());

        assert_eq!(stored_balance.unwrap(), amount);
        assert_eq!(total, Nat::from(50u64));
    }

    #[test]
    fn apply_successful_withdraw_subtracts_amount_and_fee() {
        reset_state();
        let caller = Principal::anonymous();
        let initial_balance = Nat::from(200u64);
        let initial_total = Nat::from(300u64);

        STATE.with(|state| {
            let mut state = state.borrow_mut();
            state.user_balances.insert(caller, initial_balance.clone());
            state.total_deposited = initial_total.clone();
        });

        let withdraw_amount = Nat::from(70u64);
        let fee = Nat::from(10u64);
        let total_amount = withdraw_amount.clone() + fee.clone();

        apply_successful_withdraw(&Principal::anonymous(), &withdraw_amount, &total_amount)
            .expect("withdrawal should succeed");

        let stored_balance = STATE.with(|state| {
            state
                .borrow()
                .user_balances
                .get(&Principal::anonymous())
                .cloned()
        });
        let total = STATE.with(|state| state.borrow().total_deposited.clone());

        assert_eq!(stored_balance.unwrap(), initial_balance - withdraw_amount);
        assert_eq!(total, initial_total - total_amount);
    }
}
