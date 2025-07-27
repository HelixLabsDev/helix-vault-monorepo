# `helix-vault-monorepo`

This repository contains the backend service for integrating ICP with EVM-compatible networks. It supports minting and burning tokens such as hstICP based on cross-chain events.

You can learn the detailed document and system architecture from here:

[Helix-Document](https://deepwiki.com/HelixLabsDev/helix-vault-monorepo/1-overview)

---

# ⚡ Quick Start

## 1. Local Environment Setup

Make sure you have [DFX](https://internetcomputer.org/docs/current/developer-docs/build/candid/quickstart/) installed and a working Rust environment.

### 1.1 Clone the Repository

```bash
git clone git@github.com:HelixLabsDev/helix-vault-monorepo.git && cd helix-vault-monorepo
```

### 1.2 Start the Local Replica

```bash
dfx start --background
```

## 2. Deploy Dependencies

### 2.1 Pull and initialize dependencies

```bash
dfx deps pull
```

```bash
dfx deps init evm_rpc --argument '(record {})'
```

```bash
dfx deps deploy
```

### 2.2 Deploy the EVM RPC Canister

```bash
dfx deploy evm_rpc_backend
```

### 2.3 Copy the Canister ID

After deployment, copy the canister ID for evm_rpc_backend and update this line in:

File: packages/helix_vault_backend/src/lib.rs

```rs
const EVM_BACKEND_CANISTER_ID: &str = "<replace_with_your_canister_id>";
```

### 2.4 Fetch Ethereum Public Key

Run the following command to get the ECDSA public key:

```bash
dfx canister call evm_rpc_backend get_canister_eth_address
```

Copy the returned Ethereum address and use it as the **minter role** in the `hstICP` deployment:

File: packages/hstICP/ignition/modules/HelixStakedICP.js

```js
const minter = "0xReturnedEthAddressFromAbove";
```

### 2.5 Set RPC Configuration

Finally, configure the RPC URL and chain ID for your local or testnet EVM-compatible node:

```bash
dfx canister call evm_rpc_backend set_rpc_config '(12345, "https://your_rpc_url_with_api_key")'
```

## 3. Deploying the ERC-20: `hstICP` Smart Contract (Ethereum Side)

This section will help you deploy the `hstICP` ERC-20 smart contract on Ethereum (e.g., Sepolia or Holesky testnet) using Hardhat and Ignition.

### 3.1 Navigate to the hstICP Package

```bash
cd packages/hstICP
```

### 3.2 Install Dependencies

```bash
npm install
```

### 3.3 Configure Environment Variables

Create a .env file in the root of packages/hstICP:

```bash
nano .env
```

Then paste the following into it:

```bash
API_URL="your-api-url-with-api-key"
PRIVATE_KEY="your-private-key"
ETHERSCAN_API_KEY="your-etherscan-api-key"
```

⚠️ Replace all placeholder values with actual credentials.

### 3.4 Make sure you set the Minter Address

Copy the Ethereum public key returned from this command:

```bash
dfx canister call evm_rpc_backend get_canister_eth_address
```

Paste it as the minter value in:

```js
// File: packages/hstICP/ignition/modules/HelixStakedICP.js
const minter = "0xYourPublicKeyFromAbove";
```

### 3.5 Compile and Deploy the Contract

```bash
npx hardhat compile
```

Then deploy:

```bash
npx hardhat ignition deploy ignition/modules/HelixStakedICP.js --network holesky
```

### 3.6 Link Contract Address to Vault Canister

After deployment, you'll receive a contract address.

Update the Rust constant in your vault backend:

```rs
// File: packages/helix_vault_backend/src/lib.rs
const CONTRACT_ADDRESS: &str = "<replace_with_hstICP_contract_address>";
```

## 4. Link ICRC-1 token canister id to Vault Canister

```rs
// File: packages/helix_vault_backend/src/lib.rs
const ICRC1_LEDGER_CANISTER_ID: &str = "<replace_with_ICRC1_canister_id>";
```

## 5. Deploying Helix Vault ICP Canisters

This section will walk you through deploying the `helix_vault_backend`, `core_vault_backend`, and `shared_ownership_backend` canisters, and configuring inter-canister references.

### 5.1 Deploy `helix_vault_backend`

This builds the vault backend and generates a `.wasm` file that is linked in `core_vault_backend/src/vault_factory.rs`.

Ensure this line exists:

```rs
// File: core_vault_backend/src/vault_factory.rs
const VAULT_WASM: &[u8] = include_bytes!("../../../target/wasm32-unknown-unknown/release/helix_vault_backend.wasm");
```

Then deploy:

```bash
dfx deploy helix_vault_backend
```

### 5.2 Deploy `core_vault_backend`

Deploy the core logic that includes governance and vault creation mechanisms:

```bash
dfx deploy core_vault_backend
```

After deployment, copy the canister ID and update this line:

```rs
// File: packages/shared_ownership_backend/src/shared_ownership.rs
let core_vault_canister_id = match Principal::from_text("<your-core_vault_backend_canister_id>")
```

### 5.3 Configure Shared Ownership Admins

We need to register two Internet Identity principals: one for Helix and one for SNS governance.

(a) Get Helix Admin Principal

```bash
dfx identity get-principal
```

Copy the output and replace this line:

```rs
// File: packages/shared_ownership_backend/src/shared_ownership.rs
const HELIX_ADMINS: &[&str] = &["<your_helix_principal_id>"];
```

(b) Create and Use SNS Admin Identity

```bash
dfx identity new sns_admin
dfx identity use sns_admin
dfx identity get-principal
```

Copy the second principal and replace this line:

```rs
// File: packages/shared_ownership_backend/src/shared_ownership.rs
const SNS_ADMINS: &[&str] = &["<your_sns_admin_principal_id>"];
```

💡 You can use more than one principal in each admin list if needed.

### 5.4 Deploy `shared_ownership_backend`

Once both admin principals and the core_vault_backend ID are configured:

```bash
dfx deploy shared_ownership_backend
```

## 6. Configuring the Frontend

This section sets up the frontend for Helix Vault, including Internet Identity, contract and canister addresses, and ICRC-1 integration.

### 6.1 Deploy Internet Identity Canister

```bash
dfx deploy internet_identity
```

After deployment, copy the canister ID and update:

```ts
// File: frontend/lib/constant.ts
const IDENTITY_URL =
  "http://<your-internet-identity-canister-id>.localhost:4943/";
```

### 6.2 Install Frontend Dependencies

Navigate to the frontend directory and install the packages:

```bash
cd frontend && npm install --force
```

### 6.3 Configure Contract & Canister Addresses

Update the constants in frontend/lib/constant.ts:

```ts
// File: frontend/lib/constant.ts

// Paste your ICRC-1 Ledger Canister ID here
export const ledgerActorAddress = "<your_icrc1_canister_id>";

// Paste your Core Vault Backend Canister ID here
export const coreVaultPrincipal = "<your_core_vault_backend_canister_id>";

// Paste your deployed hstICP contract address here
export const hstICPContract = "<your_erc20_contract_address>";
```

💡 You can replace values manually or use environment-specific overrides later.

### 6.4 Generate and Link Candid Declarations

Run the following command to generate canister interfaces:

```bash
dfx generate
```

After generation, copy the declaration folders into the frontend:

```bash
# Copy main canister declarations
cp -r .dfx/local/canisters/<your_canister_name> frontend/declarations/<your_canister_name>

# Copy ICRC-1 canister declarations as well
cp -r <path-to-icrc1-declarations> frontend/declarations/icrc1
```

Make sure your frontend is importing the correct actors from these declaration folders.

### 6.5 Deploy the Frontend Canister

Once all backend canisters are deployed and your frontend is fully configured, you can deploy the frontend as an Internet Computer canister.

From the **root** of the monorepo (`helix-vault-monorepo`), run:

```bash
./scripts/deploy_frontend.sh
```

🛠️ This script will handle building and deploying the helix_vault_frontend canister.

Make sure the script has executable permissions. If not, run:

```bash
chmod +x ./scripts/deploy_frontend.sh
```

## 7 Submit and Execute a Governance Proposal (Shared Ownership Canister)

This step demonstrates how to submit, approve, and execute a governance proposal from the `shared_ownership_backend` canister to create a new vault.

### 7.1 Use Your Helix Admin Identity

Make sure you're using your **Helix Admin** identity (`default`):

```bash
dfx identity use default
```

### 7.2 Submit a Proposal

```bash
dfx canister call shared_ownership_backend submit_proposal '(
  "Name",
  "Description",
  variant { CreateVault = record { token_type = "Test"; duration_secs = 80 : nat64 } }
)'
```

### 7.3 Approve with Helix Admin

Still under the default identity:

```bash
dfx canister call shared_ownership_backend approve_proposal '(0)'
```

### 7.4 Approve with SNS Admin Identity

Switch to your SNS admin identity (we used dev):

```bash
dfx identity use dev
dfx canister call shared_ownership_backend approve_proposal '(0)'
```

### 7.5 Execute the Proposal

Still under the SNS admin identity (or switch back):

```bash
dfx canister call shared_ownership_backend execute_proposal '(0)'
```

This will trigger the actual action (e.g., create vault, upgrade vault).

### 7.6 Interact from the Frontend

7.6.1 Open the frontend in your browser via the deployed frontend canister URL.

7.6.2 Connect your:

7.6.2.1 Internet Identity (ICP Wallet)

7.6.2.2 EVM Wallet (e.g. MetaMask)

7.6.3 Navigate to the Governance section.

7.6.4 You will see the new proposal listed.

7.6.5 You can vote on the proposal using your identity.

7.6.6 Once approved, click Execute from the frontend.

🎉 You're now running the full Helix Vault governance stack with bidirectional approval and execution between Helix and SNS identities!

### 7.7 (Optional) Submit Proposal via Script

To automate the governance flow (submit → approve → execute), you can use the pre-written shell script.

Review or Modify the Script

Open the script and modify parameters as needed.

Make the Script Executable (if not already)

```bash
chmod +x ./scripts/vault_proposal.sh
```

Run the Script

```bash
./scripts/vault_proposal.sh
```

This will:
Submit a CreateVault proposal

Approve with Helix admin

Approve with SNS admin

Execute the proposal

✅ This is the fastest way to test and iterate on governance flows during local development.

## 8. Submitting a Vault Upgrade Proposal

This guide walks you through upgrading an existing vault canister via governance.

### 8.1 Compile New Vault Code

Make changes to your `helix_vault_backend` Rust code, then compile the updated WASM:

```bash
cargo build --target wasm32-unknown-unknown --release -p helix_vault_backend
```

### 8.2 Convert WASM to Hex

Use xxd to convert the .wasm binary into a single-line hex string:

```bash
xxd -p -c 1000000 target/wasm32-unknown-unknown/release/helix_vault_backend.wasm > wasm_hex.txt
```

### 8.3 Prepare generate_did.sh

Edit the script scripts/generate_did.sh to include the following:

```shell
vault_id = principal "your-vault-id";
```

Then run the script to generate the proposal argument:

```bash
./scripts/generate_did.sh
```

### 8.4 Add Shared Ownership as Controller (one-time per vault)

Ensure the shared ownership canister has permission to upgrade:

```bash
dfx canister call core_vault_backend add_controller_to_vault \
  '(principal "your-vault-canister-id", principal "shared-ownership-canister-id")'
```

### 8.5 Submit the Upgrade Proposal

Submit the generated proposal using the shared ownership backend:

```bash
dfx canister call shared_ownership_backend submit_proposal --argument-file upgrade_args.did
```

### 8.6 Approve and Execute the Proposal

Helix Admin:

```bash
dfx canister call shared_ownership_backend approve_proposal '(id)'
```

SNS Admin:

```bash
dfx canister call shared_ownership_backend approve_proposal '(id)'
```

Execute the Proposal:

```bash
dfx canister call shared_ownership_backend execute_proposal '(id)'
```

### 8.7 Verify the Upgrade

Check the canister’s module hash:

```bash
dfx canister info your-vault-canister-id
sha256sum target/wasm32-unknown-unknown/release/helix_vault_backend.wasm
```

Match the hash with the one listed in the output to confirm a successful upgrade.

🚀 You've now completed a full upgrade cycle using bidirectional shared governance!

## 📄 License

MIT © Helix Labs
