// SPDX-License-Identifier: MIT
// Copyright (c) 2025 Helix Labs

use serde::{Deserialize, Serialize};
use candid::CandidType;
use std::collections::HashSet;
use ic_principal::Principal;

#[derive(CandidType, Serialize, Deserialize, Clone)]
pub struct GovernanceProposal {
    pub id: u64,
    pub proposer: Principal,
    pub title: String,
    pub description: String,
    pub action: ProposalAction,
    pub status: ProposalStatus,
    pub votes_for: u64,
    pub votes_against: u64,
    pub deadline: u64,
    pub voters: HashSet<Principal>,
    pub executed_vault_id: Option<Principal>,
}

#[derive(CandidType, Serialize, Deserialize, Clone)]
pub struct ProposalInput {
    pub title: String,
    pub description: String,
    pub action: ProposalAction,
    pub duration_secs: u64, // ⬅️ this is the only new thing needed
}

#[derive(CandidType, Serialize, Deserialize, Clone)]
pub enum ProposalAction {
    CreateVault { token_symbol: String },
    UpgradeVault { vault_id: String, new_code_hash: Vec<u8> },
}

#[derive(CandidType, Serialize, Deserialize, Clone, PartialEq)]
pub enum ProposalStatus {
    Pending,
    Approved,
    Rejected,
    Executed,
}
