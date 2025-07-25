use candid::{CandidType, Encode, Principal};
use ic_cdk::api::management_canister::main::{
    create_canister, install_code, CanisterInstallMode, CreateCanisterArgument, InstallCodeArgument,
    CanisterSettings,
};
use serde::{Deserialize, Serialize};
use std::fs;

#[derive(CandidType, Serialize, Deserialize)]
struct VaultInitArg {
    token_symbol: String,
}

fn load_vault_wasm() -> Vec<u8> {
    fs::read("scripts/wasm/helix_vault_backend.wasm")
        .expect("WASM file not found at scripts/wasm/helix_vault_backend.wasm")
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
