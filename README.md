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

---

## 📄 License

MIT © Helix Labs
