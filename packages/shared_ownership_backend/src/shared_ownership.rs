use ic_cdk_macros::{update, query};
use ic_cdk::api::{caller, management_canister::main::{install_code, CanisterInstallMode, InstallCodeArgument}};
use std::collections::HashSet;
use candid::{CandidType, Principal, Deserialize};
use hex;

#[derive(CandidType, Deserialize, Clone)]
pub enum SharedProposalAction {
    UpgradeVault { vault_id: Principal, wasm_hash: String },
    CreateVault { token_type: String, duration_secs: u64 },
}

#[derive(CandidType, Deserialize, Clone, PartialEq)]
pub enum SharedProposalStatus {
    Pending,
    Approved,
    Declined,
    Executed,
}

#[derive(CandidType, Deserialize, Clone)]
pub struct SharedProposal {
    pub id: u64,
    pub proposer: Principal,
    pub title: String,
    pub description: String,
    pub action: SharedProposalAction,
    pub approvals: HashSet<Principal>,
    pub declines: HashSet<Principal>,
    pub status: SharedProposalStatus,
}

#[derive(CandidType, Deserialize)]
pub enum Result_ {
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

#[derive(CandidType, Deserialize)]
struct ProposalInput {
    title: String,
    description: String,
    action: ProposalAction,
    duration_secs: u64,
}

#[derive(CandidType, Deserialize)]
enum ProposalAction {
    CreateVault { token_symbol: String },
    UpgradeVault { vault_id: String, new_code_hash: Vec<u8> },
}

thread_local! {
    static PROPOSALS: std::cell::RefCell<Vec<SharedProposal>> = std::cell::RefCell::new(Vec::new());
    static NEXT_ID: std::cell::RefCell<u64> = std::cell::RefCell::new(0);
}

const HELIX_ADMINS: &[&str] = &[
    "irprd-rzz57-dpk4r-uoeki-brwfq-oavjg-hsb3p-6p7gl-wxcea-e2xyt-dqe",
];

const SNS_ADMINS: &[&str] = &[
    "vbuhp-vaexh-he5qc-ovpdc-olxyo-ogwjl-luimw-6j6cp-hl7vd-wcgg2-wqe",
];

#[update]
fn submit_proposal(title: String, description: String, action: SharedProposalAction) -> u64 {
    let proposer = caller();

    let proposal = SharedProposal {
        id: NEXT_ID.with(|id| {
            let mut counter = id.borrow_mut();
            let assigned = *counter;
            *counter += 1;
            assigned
        }),
        proposer,
        title,
        description,
        action,
        approvals: HashSet::new(),
        declines: HashSet::new(),
        status: SharedProposalStatus::Pending,
    };

    PROPOSALS.with(|p| p.borrow_mut().push(proposal.clone()));
    proposal.id
}

#[update]
fn approve_proposal(id: u64) -> Result_ {
    PROPOSALS.with(|p| {
        let mut proposals = p.borrow_mut();
        let proposal = proposals.iter_mut().find(|p| p.id == id)
            .ok_or("Proposal not found")?;

        if proposal.status != SharedProposalStatus::Pending {
            return Err("Proposal is already finalized.".to_string());
        }

        if proposal.approvals.contains(&caller()) {
            return Err("You have already approved this proposal.".to_string());
        }

        proposal.approvals.insert(caller());

        if proposal.approvals.iter().any(is_helix_admin)
            && proposal.approvals.iter().any(is_sns_admin)
        {
            proposal.status = SharedProposalStatus::Approved;
        }

        Ok(())
    }).into()
}

#[update]
fn decline_proposal(id: u64) -> Result_ {
    PROPOSALS.with(|p| {
        let mut proposals = p.borrow_mut();
        let proposal = proposals.iter_mut().find(|p| p.id == id)
            .ok_or("Proposal not found")?;

        if proposal.status != SharedProposalStatus::Pending {
            return Err("Proposal is already finalized.".to_string());
        }

        if proposal.declines.contains(&caller()) {
            return Err("You have already declined this proposal.".to_string());
        }

        proposal.declines.insert(caller());
        proposal.status = SharedProposalStatus::Declined;

        Ok(())
    }).into()
}

#[update]
async fn execute_proposal(id: u64) -> Result_ {
    let mut maybe_action = None;

    {
        let result: std::result::Result<(), String> = PROPOSALS.with(|p| {
            let mut proposals = p.borrow_mut();
            let proposal = proposals.iter_mut().find(|p| p.id == id)
                .ok_or("Proposal not found")?;

            if proposal.status == SharedProposalStatus::Executed {
                return Err("Proposal already executed.".to_string());
            }

            if proposal.status != SharedProposalStatus::Approved {
                return Err("Proposal is not approved yet.".to_string());
            }

            proposal.status = SharedProposalStatus::Executed;
            maybe_action = Some(proposal.action.clone());

            Ok(())
        });

        if let Err(e) = result {
            return Result_::Err(e);
        }
    }

    match maybe_action.unwrap() {
        SharedProposalAction::UpgradeVault { vault_id, wasm_hash } => {
            let upgrade_args = InstallCodeArgument {
                mode: CanisterInstallMode::Upgrade(None),
                canister_id: vault_id,
                wasm_module: match hex::decode(&wasm_hash) {
                    Ok(bytes) => bytes,
                    Err(e) => return Result_::Err(format!("Invalid hex wasm: {}", e)),
                },
                arg: vec![],
            };

            if let Err(e) = install_code(upgrade_args).await {
                return Result_::Err(format!("Upgrade failed: {:?}", e));
            }
        }

        SharedProposalAction::CreateVault { token_type, duration_secs } => {
            let core_vault_canister_id = match Principal::from_text("avqkn-guaaa-aaaaa-qaaea-cai") {
                Ok(principal) => principal,
                Err(e) => return Result_::Err(format!("Invalid canister ID: {}", e)),
            };

            let proposal_input = (
                ProposalInput {
                    title: format!("Create Vault for {}", token_type),
                    description: format!("Shared Ownership Proposal: Deploy vault for {}", token_type),
                    action: ProposalAction::CreateVault {
                        token_symbol: token_type.clone()
                    },
                    duration_secs,
                },
            );

            let call_result: std::result::Result<(u64,), _> = ic_cdk::call(
                core_vault_canister_id,
                "submit_proposal",
                proposal_input,
            ).await;

            match call_result {
                Ok((proposal_id,)) => {
                    ic_cdk::println!("Governance proposal submitted with ID: {}", proposal_id);
                }
                Err(e) => {
                    return Result_::Err(format!("Cross-canister call failed: {:?}", e));
                }
            }
        }
    }

    Result_::Ok
}

fn is_helix_admin(p: &Principal) -> bool {
    HELIX_ADMINS.contains(&p.to_text().as_str())
}

fn is_sns_admin(p: &Principal) -> bool {
    SNS_ADMINS.contains(&p.to_text().as_str())
}

#[query]
fn get_proposal(id: u64) -> Option<SharedProposal> {
    PROPOSALS.with(|p| p.borrow().iter().find(|p| p.id == id).cloned())
}

#[query]
fn list_proposals() -> Vec<SharedProposal> {
    PROPOSALS.with(|p| p.borrow().clone())
}
