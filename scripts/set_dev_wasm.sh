#!/bin/bash
set -e

# === CONFIG ===
CANISTER_ID="core_vault_backend"
PACKAGE_NAME="helix_vault_backend"
WASM_PATH="target/wasm32-unknown-unknown/release/${PACKAGE_NAME}.wasm"
TMP_ARG_FILE="set_wasm_arg.did"

# === UI COLORS ===
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# === BUILD ===
echo -e "${GREEN}📦 Building $PACKAGE_NAME for dev mode...${NC}"
cargo build --package "$PACKAGE_NAME" --target wasm32-unknown-unknown --release

# === VALIDATE BUILD OUTPUT ===
if [ ! -f "$WASM_PATH" ]; then
  echo -e "${RED}❌ Error: WASM not found at $WASM_PATH${NC}"
  exit 1
fi

# === ENCODE WASM INTO CANDID ARGUMENT ===
echo -e "${YELLOW}📤 Encoding WASM as blob for Candid call...${NC}"
echo -n '(blob "' > "$TMP_ARG_FILE"
base64 "$WASM_PATH" | tr -d '\n' >> "$TMP_ARG_FILE"
echo '")' >> "$TMP_ARG_FILE"

# === CALL set_dev_vault_wasm ===
echo -e "${YELLOW}🚀 Calling set_dev_vault_wasm on $CANISTER_ID...${NC}"
dfx canister call "$CANISTER_ID" set_dev_vault_wasm --argument-file "$TMP_ARG_FILE"

# === CLEANUP ===
rm -f "$TMP_ARG_FILE"

echo -e "${GREEN}✅ Dev WASM set successfully.${NC}"