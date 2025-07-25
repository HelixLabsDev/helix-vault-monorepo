use crate::types::*;
use std::cell::RefCell;
use std::collections::HashSet;
use ic_cdk::api;
use ic_principal::Principal;
use ic_cdk_macros::query;

thread_local! {
    static PROPOSALS: RefCell<Vec<GovernanceProposal>> = RefCell::new(Vec::new());
    static NEXT_ID: RefCell<u64> = RefCell::new(0);
    static ALL_VOTERS: RefCell<HashSet<Principal>> = RefCell::new(HashSet::new());
    static CREATED_VAULTS: RefCell<Vec<Principal>> = RefCell::new(Vec::new());
}

// Initialize canister state
pub fn init_state() {
    NEXT_ID.with(|id| *id.borrow_mut() = 0);
    PROPOSALS.with(|p| p.borrow_mut().clear());
    ALL_VOTERS.with(|v| v.borrow_mut().clear());
    CREATED_VAULTS.with(|v| v.borrow_mut().clear());
}

// Submit a new proposal (from lib.rs)
pub fn submit_proposal_impl(mut proposal: GovernanceProposal) -> u64 {
    proposal.id = NEXT_ID.with(|id| {
        let mut counter = id.borrow_mut();
        let assigned_id = *counter;
        *counter += 1;
        assigned_id
    });

    proposal.status = ProposalStatus::Pending;
    proposal.votes_for = 0;
    proposal.votes_against = 0;
    proposal.voters = HashSet::new();

    PROPOSALS.with(|p| p.borrow_mut().push(proposal.clone()));
    proposal.id
}

// Vote on proposal
pub fn vote_proposal_impl(proposal_id: u64, approve: bool, voter: Principal) -> Result<(), String> {
    let result = PROPOSALS.with(|p| {
        let mut proposals = p.borrow_mut();

        let proposal = proposals.iter_mut().find(|p| p.id == proposal_id)
            .ok_or("Proposal not found".to_string())?;

        if proposal.status != ProposalStatus::Pending {
            return Err("Proposal is already finalized".to_string());
        }

        let now = current_timestamp();
        if now > proposal.deadline {
            return Err("Voting deadline has passed — you cannot vote anymore.".to_string());
        }

        if proposal.voters.contains(&voter) {
            return Err("You have already voted".to_string());
        }

        proposal.voters.insert(voter);

        ALL_VOTERS.with(|set| {
            set.borrow_mut().insert(voter);
        });

        if approve {
            proposal.votes_for += 1;
        } else {
            proposal.votes_against += 1;
        }

        Ok(())
    });
    evaluate_proposals();

    result
}

// Execute if passed
pub async fn execute_proposal_impl(id: u64) -> Result<Principal, String> {
    let proposal_opt = PROPOSALS.with(|p| {
        let proposals = p.borrow();
        proposals.iter().find(|p| p.id == id).cloned()
    });

    let mut proposal = proposal_opt.ok_or("Proposal not found".to_string())?;

    if proposal.status != ProposalStatus::Pending {
        return Err("Proposal already finalized.".to_string());
    }

    let now = current_timestamp();

    // 🔐 BLOCK execution before deadline
    if now < proposal.deadline {
        return Err("Voting period is still active. Wait until deadline ends.".to_string());
    }

    let total_votes = proposal.votes_for + proposal.votes_against;
    let total_voters = total_registered_voters();
    let quorum_required = ((total_voters as f64) * 0.3).ceil() as u64;

    if total_votes < quorum_required {
        update_proposal_status(id, ProposalStatus::Rejected);
        return Err("Quorum not met. Proposal rejected.".to_string());
    }

    let approval_ratio = proposal.votes_for as f64 / total_votes as f64;
    if approval_ratio < 0.51 {
        update_proposal_status(id, ProposalStatus::Rejected);
        return Err("Proposal rejected due to insufficient support.".to_string());
    }

    match &proposal.action {
        ProposalAction::CreateVault { token_symbol } => {
            match crate::vault_factory::create_helix_vault(token_symbol.clone()).await {
                Ok(vault_id) => {
                    update_proposal_status(id, ProposalStatus::Approved);
                    record_created_vault(vault_id);
                    set_executed_vault_id(id, Some(vault_id));
                    update_proposal_status(id, ProposalStatus::Executed);
                    return Ok(vault_id);
                }
                Err(err) => {
                    update_proposal_status(id, ProposalStatus::Rejected);
                    return Err(format!("Vault creation failed: {}", err));
                }
            }
        }

        ProposalAction::UpgradeVault { vault_id, new_code_hash } => {
            use ic_cdk::api::management_canister::main::{
                install_code, CanisterInstallMode, InstallCodeArgument
            };

            let target = Principal::from_text(vault_id.clone())
                .map_err(|e| format!("Invalid vault_id: {}", e))?;

            let upgrade_args = InstallCodeArgument {
                mode: CanisterInstallMode::Upgrade(None),
                canister_id: target,
                wasm_module: new_code_hash.clone(),
                arg: vec![], // No init args
            };

            match install_code(upgrade_args).await {
                Ok(_) => {
                    update_proposal_status(id, ProposalStatus::Approved);
                    return Ok(target);
                }
                Err(e) => {
                    update_proposal_status(id, ProposalStatus::Rejected);
                    return Err(format!("Upgrade failed: {:?}", e));
                }
            }
        }
    }
}

fn set_executed_vault_id(id: u64, vault_id: Option<Principal>) {
    PROPOSALS.with(|p| {
        let mut proposals = p.borrow_mut();
        if let Some(found) = proposals.iter_mut().find(|p| p.id == id) {
            found.executed_vault_id = vault_id;
        }
    });
}

// Query: single proposal
pub fn get_proposal_impl(id: u64) -> Option<GovernanceProposal> {
    PROPOSALS.with(|p| p.borrow().iter().find(|p| p.id == id).cloned())
}

// Query: all proposals
pub fn list_proposals_impl() -> Vec<GovernanceProposal> {
    evaluate_proposals();
    PROPOSALS.with(|p| p.borrow().clone())
}

// Query: created vaults
#[query]
pub fn list_created_vaults() -> Vec<Principal> {
    CREATED_VAULTS.with(|v| v.borrow().clone())
}

// Internal: timestamp
fn current_timestamp() -> u64 {
    api::time() / 1_000_000_000
}

// Internal: voter count
fn total_registered_voters() -> usize {
    ALL_VOTERS.with(|set| set.borrow().len())
}

// Internal: update status
fn update_proposal_status(id: u64, new_status: ProposalStatus) {
    PROPOSALS.with(|p| {
        let mut proposals = p.borrow_mut();
        if let Some(found) = proposals.iter_mut().find(|p| p.id == id) {
            found.status = new_status;
        }
    });
}

// Internal: record vault ID
fn record_created_vault(id: Principal) {
    CREATED_VAULTS.with(|v| v.borrow_mut().push(id));
}

pub fn evaluate_proposals() {
    let now_secs = api::time() / 1_000_000_000;

    PROPOSALS.with(|p| {
        let mut proposals = p.borrow_mut();

        for proposal in proposals.iter_mut() {
            if proposal.status == ProposalStatus::Pending && now_secs > proposal.deadline {
                let total_votes = proposal.votes_for + proposal.votes_against;

                let total_voters = ALL_VOTERS.with(|v| v.borrow().len());
                let total_voters_u64 = total_voters as u64;

                let quorum_met = total_voters_u64 > 0 && total_votes * 100 / total_voters_u64 >= 50;
                if quorum_met && proposal.votes_for > proposal.votes_against {
                    proposal.status = ProposalStatus::Approved;
                } else {
                    proposal.status = ProposalStatus::Rejected;
                }
            }
        }
    });
}