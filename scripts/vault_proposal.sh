#!/bin/bash
set -e

GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${GREEN}🔑 Switching to Helix Admin (minter)...${NC}"
dfx identity use minter

echo -e "${GREEN}📝 Submitting Shared Ownership proposal...${NC}"
dfx canister call shared_ownership_backend submit_proposal '(
  "Helix",
  "Helix",
  variant { CreateVault = record { token_type = "Test"; duration_secs = 30 : nat64 } }
)'

echo -e "${GREEN}🔢 Enter SharedOwnership Proposal ID (e.g., 3):${NC}"
read SHARED_ID

echo -e "${GREEN}👍 Approving with Helix Admin (minter)...${NC}"
dfx canister call shared_ownership_backend approve_proposal "($SHARED_ID)"

echo -e "${GREEN}🔄 Switching to SNS Identity (godstack)...${NC}"
dfx identity use godstack
dfx canister call shared_ownership_backend approve_proposal "($SHARED_ID)"

echo -e "${GREEN}🔁 Switching back to Helix Admin (minter)...${NC}"
dfx identity use minter

echo -e "${GREEN}🚀 Executing SharedOwnership proposal...${NC}"
dfx canister call shared_ownership_backend execute_proposal "($SHARED_ID)"

echo -e "${GREEN}🔢 Enter CoreVault Proposal ID (e.g., 1):${NC}"
read CORE_ID

echo -e "${GREEN}🗳️ Voting with Helix Admin (minter)...${NC}"
dfx canister call core_vault_backend vote_proposal "($CORE_ID, true)"

echo -e "${GREEN}🔄 Switching to SNS Identity (godstack)...${NC}"
dfx identity use godstack
dfx canister call core_vault_backend vote_proposal "($CORE_ID, true)"

echo -e "${GREEN}✅ Done. Proposal voted by both identities.${NC}"