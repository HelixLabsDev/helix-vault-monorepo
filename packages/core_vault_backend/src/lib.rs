// SPDX-License-Identifier: MIT
// Copyright (c) 2025 Helix Labs

pub mod governance;
pub mod types;
mod vault_factory;

use governance::*;
use types::*;
use ic_cdk_macros::*;
use std::result::Result;
use candid::{CandidType, Deserialize};
use candid::Principal;
use ic_cdk::api::time; 
use std::collections::HashSet;
use types::ProposalInput;

#[derive(CandidType, Deserialize)]
enum Result_ {
    #[serde(rename = "ok")]
    Ok,
    #[serde(rename = "err")]
    Err(String),
}

impl From<std::result::Result<(), String>> for Result_ {
    fn from(res: std::result::Result<(), String>) -> Self {
        match res {
            Ok(_) => Result_::Ok,
            Err(e) => Result_::Err(e),
        }
    }
}

/// Called once at canister initialization
#[init]
fn init() {
    init_state();
}

#[update]
fn submit_proposal(input: ProposalInput) -> u64 {
    let caller = ic_cdk::caller();
    if caller == Principal::anonymous() {
        ic_cdk::trap("Anonymous principals cannot submit proposals.");
    }
    // 15 sec
    if input.duration_secs < 15 {
        ic_cdk::trap("Proposal duration too short. Minimum is 1 hour.");
    }

    let proposal = GovernanceProposal {
        id: 0, // will be overwritten by `submit_proposal_impl`
        proposer: caller,
        title: input.title,
        description: input.description,
        action: input.action,
        status: ProposalStatus::Pending,
        votes_for: 0,
        votes_against: 0,
        deadline: current_timestamp() + input.duration_secs,
        voters: HashSet::new(),
        executed_vault_id: None,
    };

    submit_proposal_impl(proposal)
}

// Add if you don’t already have it
fn current_timestamp() -> u64 {
    time() / 1_000_000_000
}

#[derive(CandidType, Deserialize)]
enum VoteResult {
    Ok,
    Err(String),
}

#[update]
fn vote_proposal(id: u64, approve: bool) -> VoteResult {
    let caller = ic_cdk::caller();
    if caller == Principal::anonymous() {
        return VoteResult::Err("Anonymous principals cannot vote.".into());
    }

    match vote_proposal_impl(id, approve, caller) {
        Ok(_) => VoteResult::Ok,
        Err(e) => VoteResult::Err(e),
    }
}


#[update]
async fn execute_proposal(id: u64) -> Result<Principal, String> {
    execute_proposal_impl(id).await
}

/// Get a specific proposal by ID
#[query]
fn get_proposal(id: u64) -> Option<GovernanceProposal> {
    get_proposal_impl(id)
}

/// List all governance proposals
#[query]
fn list_proposals() -> Vec<GovernanceProposal> {
    list_proposals_impl()
}

#[update]
fn add_controller_to_vault(vault_id: Principal, new_controller: Principal) -> Result_ {
    use ic_cdk::api::management_canister::main::{
        update_settings, UpdateSettingsArgument, CanisterSettings,
    };

    ic_cdk::spawn(async move {
        let settings = CanisterSettings {
            controllers: Some(vec![new_controller]),
            compute_allocation: None,
            memory_allocation: None,
            freezing_threshold: None,
            log_visibility: None,
            reserved_cycles_limit: None,
            wasm_memory_limit: None,
        };

        let args = UpdateSettingsArgument {
            canister_id: vault_id,
            settings,
        };

        match update_settings(args).await {
            Ok(()) => ic_cdk::println!("✅ Controller added to vault"),
            Err(e) => ic_cdk::println!("❌ Failed to add controller: {:?}", e),
        }
    });

    // Always return Ok immediately, since we cannot await inside this fn
    Result_::Ok
}
