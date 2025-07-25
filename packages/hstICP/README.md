# `hstICP`

This repository contains the smart contract and deployment configuration for **Helix Staked ICP (hstICP)** — an ERC-20 compatible token representing liquid staked ICP on Ethereum.

---

## ⚡ Quick Start

### Clone the Repository

```bash
git clone git@github.com:HelixLabsDev/hstICP.git && cd hstICP
```

### Install Dependencies

```bash
npm install
```

### Set Environment Variables

Create a `.env` file:

```bash
nano .env
```

Paste the following:

```env
API_URL="https://eth-sepolia.g.alchemy.com/v2/your-api-key"
PRIVATE_KEY="your-private-key"
ETHERSCAN_API_KEY="your-etherscan-api-key"
```

> ⚠️ Do **NOT** commit `.env` to version control.

---

## ⚙️ Configuration

Open the deployment module:

```bash
nano ignition/modules/HelixStakedICP.js
```

Change the following variables to your desired Ethereum addresses:

```js
const defaultAdmin = "0xYourAdminAddress";
const minter = "0xYourMinterAddress";
```

---

## 🚀 Deploying to Sepolia

### Compile the Contract

```bash
npx hardhat compile
```

### Deploy and Verify on Sepolia Testnet

```bash
npx hardhat ignition deploy ignition/modules/HelixStakedICP.js --network arb_sepolia
```

---

## 📄 License

MIT © Helix Labs
