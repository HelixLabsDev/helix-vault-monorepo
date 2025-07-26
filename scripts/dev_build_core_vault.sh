#!/bin/bash
set -e

# === CONFIG ===
CANISTER_ID="core_vault_backend"
PACKAGE_NAME="core_vault_backend"
WASM_PATH="target/wasm32-unknown-unknown/debug/${PACKAGE_NAME}.wasm"

# === UI COLORS ===
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No color

# === BUILD ===
echo -e "${GREEN}⛏️  Building $PACKAGE_NAME in dev mode...${NC}"
cargo build --package "$PACKAGE_NAME" --target wasm32-unknown-unknown

# === VALIDATE BUILD ===
if [ ! -f "$WASM_PATH" ]; then
  echo -e "${RED}❌ Error: WASM not found at $WASM_PATH${NC}"
  exit 1
fi

# === FORCE REINSTALL (safe for dev mode) ===
echo -e "${YELLOW}📦 Reinstalling $CANISTER_ID (dev mode)...${NC}"
dfx canister install "$CANISTER_ID" --mode reinstall --wasm "$WASM_PATH"

# === VERIFY DEV MODE ===
echo -e "${YELLOW}🔍 Checking dev mode (is_dev_mode)...${NC}"
dfx canister call "$CANISTER_ID" is_dev_mode

echo -e "${GREEN}✅ Dev build & reinstall complete.${NC}"
