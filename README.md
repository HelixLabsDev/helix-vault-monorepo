# `helix-vault-monorepo`

This repository contains the backend service for integrating ICP with EVM-compatible networks. It supports minting and burning tokens such as hstICP based on cross-chain events.

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

## 3.1 Navigate to the hstICP Package

```bash
cd packages/hstICP
```

## 3.2 Install Dependencies

```bash
npm install
```

## 3.3 Configure Environment Variables

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

## 3.4 Make sure you set the Minter Address

Copy the Ethereum public key returned from this command:

```bash
dfx canister call evm_rpc_backend get_canister_eth_address
```

Paste it as the minter value in:

```js
// File: packages/hstICP/ignition/modules/HelixStakedICP.js
const minter = "0xYourPublicKeyFromAbove";
```

## 3.5 Compile and Deploy the Contract

```bash
npx hardhat compile
```

Then deploy:

```bash
npx hardhat ignition deploy ignition/modules/HelixStakedICP.js --network holesky
```

## 3.6 Link Contract Address to Vault Canister

After deployment, you'll receive a contract address.

Update the Rust constant in your vault backend:

```rs
// File: packages/helix_vault_backend/src/lib.rs
const CONTRACT_ADDRESS: &str = "<replace_with_hstICP_contract_address>";
```

---

## 📄 License

MIT © Helix Labs
