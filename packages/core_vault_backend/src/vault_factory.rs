// SPDX-License-Identifier: MIT
// Copyright (c) 2025 Helix Labs

use candid::{CandidType, Encode, Principal};
use ic_cdk::api::management_canister::main::{
    create_canister, install_code, CanisterInstallMode, CreateCanisterArgument, InstallCodeArgument,
    CanisterSettings,
};
use serde::{Deserialize, Serialize};

const VAULT_WASM: &[u8] = include_bytes!("../../../target/wasm32-unknown-unknown/release/helix_vault_backend.wasm");

#[derive(CandidType, Serialize, Deserialize)]
struct VaultInitArg {
    token_symbol: String,
}

pub async fn create_helix_vault(token_symbol: String) -> Result<Principal, String> {
    let cycles: u128 = 1_000_000_000_000;

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

    let arg = Encode!(&VaultInitArg { token_symbol }).map_err(|e| format!("Candid encoding failed: {:?}", e))?;

    install_code(InstallCodeArgument {
        mode: CanisterInstallMode::Install,
        canister_id: res.canister_id,
        wasm_module: VAULT_WASM.to_vec(),
        arg,
    })
    .await
    .map_err(|e| format!("install_code failed: {:?}", e))?;

    Ok(res.canister_id)
}
