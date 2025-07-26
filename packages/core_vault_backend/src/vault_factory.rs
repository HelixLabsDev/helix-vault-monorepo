use candid::{CandidType, Encode, Principal};
use ic_cdk::api::management_canister::main::{
    create_canister, install_code, CanisterInstallMode, CreateCanisterArgument,
    InstallCodeArgument, CanisterSettings,
};
use ic_cdk_macros::*;
use serde::{Deserialize, Serialize};
use std::cell::RefCell;

#[derive(CandidType, Serialize, Deserialize)]
struct VaultInitArg {
    token_symbol: String,
}

#[cfg(debug_assertions)]
thread_local! {
    static DEV_VAULT_WASM: RefCell<Option<Vec<u8>>> = RefCell::new(None);
}

#[update]
#[cfg(debug_assertions)]
pub fn set_dev_vault_wasm(wasm_module: Vec<u8>) {
    DEV_VAULT_WASM.with(|cell| {
        *cell.borrow_mut() = Some(wasm_module);
    });
}

fn load_vault_wasm() -> Vec<u8> {
    #[cfg(debug_assertions)]
    {
        return DEV_VAULT_WASM.with(|cell| {
            cell.borrow().clone().unwrap_or_else(|| {
                ic_cdk::trap("❗️ Missing vault WASM in dev mode. Call set_dev_vault_wasm() first.")
            })
        });
    }

    #[cfg(not(debug_assertions))]
    {
        ic_cdk::trap("❗️ Vault WASM should be uploaded via proposal in production.");
    }
}

#[query]
fn is_dev_mode() -> bool {
    cfg!(debug_assertions)
}

pub async fn create_helix_vault(token_symbol: String) -> Result<Principal, String> {
    let cycles: u128 = 100_000_000_000;

    let (res,) = create_canister(
        CreateCanisterArgument {
            settings: Some(CanisterSettings {
                controllers: Some(vec![ic_cdk::api::id()]),
                compute_allocation: None,
                memory_allocation: None,
                freezing_threshold: None,
                log_visibility: None,
                reserved_cycles_limit: None,
                wasm_memory_limit: None,
            }),
        },
        cycles,
    )
    .await
    .map_err(|e| format!("create_canister failed: {:?}", e))?;

    let arg = Encode!(&VaultInitArg { token_symbol })
        .map_err(|e| format!("Candid encoding failed: {:?}", e))?;

    let wasm_bytes = load_vault_wasm();

    install_code(InstallCodeArgument {
        mode: CanisterInstallMode::Install,
        canister_id: res.canister_id,
        wasm_module: wasm_bytes,
        arg,
    })
    .await
    .map_err(|e| format!("install_code failed: {:?}", e))?;

    Ok(res.canister_id)
}
