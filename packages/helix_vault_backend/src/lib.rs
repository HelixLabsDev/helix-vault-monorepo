use std::collections::{HashMap, HashSet};
use std::str::FromStr;
use std::cell::RefCell;
use candid::{CandidType, Deserialize, Nat};
use ic_principal::Principal;
use ic_cdk::call;
use icrc_ledger_types::icrc1::transfer::{TransferArg, TransferError};
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc2::transfer_from::{TransferFromArgs, TransferFromError};
use ic_cdk_macros::{init, query, update};

#[init]
fn init() {
    ic_cdk::println!("Vault canister initialized.");
}

const ICRC1_LEDGER_CANISTER_ID: &str = "be2us-64aaa-aaaaa-qaabq-cai";
const EVM_BACKEND_CANISTER_ID: &str = "bkyz2-fmaaa-aaaaa-qaaaq-cai";
const CONTRACT_ADDRESS: &str = "0x46801cA1cF9225c40CB262f04BACAD867a86EeE1";

#[derive(CandidType, Deserialize, Default, Clone)]
struct UserBalance {
    balance: Nat,
}

thread_local! {
    static USER_BALANCES: RefCell<HashMap<Principal, UserBalance>> = RefCell::new(HashMap::new());
    static TOTAL_DEPOSITED: RefCell<Nat> = RefCell::new(Nat::from(0u64));
    static TRANSFER_FEE: RefCell<Nat> = RefCell::new(Nat::from(10_000_u64));
    static USED_TX_HASHES: RefCell<HashSet<String>> = RefCell::new(HashSet::new());
}

#[ic_cdk::query]
fn get_user_balance(user: Principal) -> Nat {
    USER_BALANCES.with(|balances| {
        balances.borrow().get(&user).map_or(Nat::from(0u64), |b| b.balance.clone())
    })
}

#[ic_cdk::query]
fn get_vault_balance() -> Nat {
    TOTAL_DEPOSITED.with(|total| total.borrow().clone())
}

#[ic_cdk::query]
fn get_transfer_fee() -> Nat {
    TRANSFER_FEE.with(|fee| fee.borrow().clone())
}

#[ic_cdk::update]
async fn deposit_icrc1(amount: Nat, eth_address: String) -> Result<String, String> {
    if amount == Nat::from(0u64) {
        return Err("Deposit amount must be greater than zero".to_string());
    }

    let caller = ic_cdk::api::caller();
    let token_canister: Principal = ICRC1_LEDGER_CANISTER_ID.parse().unwrap();

    let fee = TRANSFER_FEE.with(|f| f.borrow().clone());
    let fee = if fee == Nat::from(10_000_u64) {
        match call::<(), (Nat,)>(token_canister, "icrc1_fee", ()).await {
            Ok((new_fee,)) => {
                TRANSFER_FEE.with(|f| *f.borrow_mut() = new_fee.clone());
                new_fee
            }
            Err(_) => fee,
        }
    } else {
        fee
    };

    if amount <= fee {
        return Err(format!("Deposit must exceed the transfer fee of {} units", fee));
    }

    let transfer_arg = TransferFromArgs {
        spender_subaccount: None,
        from: Account { owner: caller, subaccount: None },
        to: Account { owner: ic_cdk::id(), subaccount: None },
        amount: amount.clone(),
        fee: Some(fee.clone()),
        memo: None,
        created_at_time: None,
    };

    match call::<(TransferFromArgs,), (Result<Nat, TransferFromError>,)>(
        token_canister,
        "icrc2_transfer_from",
        (transfer_arg,),
    ).await {
        Ok((Ok(_block_index),)) => {
            USER_BALANCES.with(|balances| {
                let mut user_balances = balances.borrow_mut();
                let user_balance = user_balances
                    .entry(caller)
                    .or_insert(UserBalance { balance: Nat::from(0u64) });
                user_balance.balance += amount.clone();
            });
            TOTAL_DEPOSITED.with(|total| {
                let mut total_deposited = total.borrow_mut();
                *total_deposited += amount.clone();
            });
            let test_evm_rpc_canister: Principal = EVM_BACKEND_CANISTER_ID.parse().unwrap();
            let contract = CONTRACT_ADDRESS.to_string();

            let scaled_amount = (amount.0.clone() * 10u128.pow(10)).to_string();
            let result: (Result<String, String>,) = call(
                test_evm_rpc_canister,
                "mint",
                (contract, eth_address, scaled_amount),
            ).await.map_err(|e| format!("Call failed: {:?}", e))?;

            match result.0 {
                Ok(tx_hash) => Ok(format!("Deposit successful. Mint tx sent: {}", tx_hash)),
                Err(e) => Err(format!("Deposit succeeded but mint failed: {}", e)),
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
    // 1. Prevent replay
    let already_used = USED_TX_HASHES.with(|set| set.borrow().contains(&tx_hash));
    if already_used {
        return Err("Transaction hash has already been used for unlock.".to_string());
    }

    // 2. Verify the burn on EVM
    let (result,): (Result<String, String>,) = call(
        EVM_BACKEND_CANISTER_ID.parse().unwrap(),
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
        Ok(_msg) => {
            // 3. Use withdraw_amount_8dec directly for nICP transfer
            let caller = ic_cdk::api::caller();
            let fee = TRANSFER_FEE.with(|f| f.borrow().clone());
            let total_amount = withdraw_amount_8dec.clone() + fee.clone();

            let token_canister: Principal = ICRC1_LEDGER_CANISTER_ID.parse().unwrap();
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
                return Err(format!("Insufficient vault balance to unlock amount + fee."));
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
                    USED_TX_HASHES.with(|set| set.borrow_mut().insert(tx_hash));
                    // Update user balance
                    USER_BALANCES.with(|balances| {
                        let mut user_balances = balances.borrow_mut();
                        if let Some(user_balance) = user_balances.get_mut(&caller) {
                            if user_balance.balance >= withdraw_amount_8dec {
                                user_balance.balance -= withdraw_amount_8dec.clone();
                            }
                        }
                    });

                    // Update vault balance
                    TOTAL_DEPOSITED.with(|total| {
                        let mut total_deposited = total.borrow_mut();
                        if *total_deposited >= withdraw_amount_8dec {
                            *total_deposited -= withdraw_amount_8dec.clone();
                        }
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
    let token_canister: Principal = ICRC1_LEDGER_CANISTER_ID.parse().unwrap();
    let balance = match call::<(Account,), (Nat,)>(
        token_canister,
        "icrc1_balance_of",
        (Account { owner: ic_cdk::id(), subaccount: None },),
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

    TOTAL_DEPOSITED.with(|total| *total.borrow_mut() = balance);
    TRANSFER_FEE.with(|f| *f.borrow_mut() = fee);
    Ok(())
}