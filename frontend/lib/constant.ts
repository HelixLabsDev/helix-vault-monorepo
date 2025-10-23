type Nullable<T extends string> = T | "";

export type NetworkId = "mainnet" | "local";

interface NetworkContracts {
  hstICP: string;
}

interface NetworkCanisters {
  vault: Nullable<string>;
  ledger: Nullable<string>;
  coreVault: Nullable<string>;
  faucet: Nullable<string>;
}

export interface NetworkConfig {
  id: NetworkId;
  label: string;
  description: string;
  host: string;
  identityProvider: string;
  canisters: NetworkCanisters;
  contracts: NetworkContracts;
}

const LOCAL_HOST = "http://127.0.0.1:4949";
const LOCAL_IDENTITY_CANISTER_ID = "rdmx6-jaaaa-aaaaa-aaadq-cai";
const LOCAL_IDENTITY_PROVIDER = `http://${LOCAL_IDENTITY_CANISTER_ID}.localhost:4949/`;
const LOCAL_FAUCET_CANISTER_ID = "";
const LOCAL_HST_ICP_CONTRACT = "0x5a95715DA13CF8a72Af1460868D3e7d2eDfC4E71";

const NETWORKS: Record<NetworkId, NetworkConfig> = {
  mainnet: {
    id: "mainnet",
    label: "ICP Mainnet",
    description: "Primary Helix deployment",
    host: "https://ic0.app",
    identityProvider: "https://identity.ic0.app/",
    canisters: {
      vault: "osvil-vyaaa-aaaaj-qnsba-cai",
      ledger: "5rm7o-daaaa-aaaag-auffa-cai",
      coreVault: "zb2a6-yyaaa-aaaaj-qnr7a-cai",
      faucet: "p73mf-2qaaa-aaaaj-qnsgq-cai",
    },
    contracts: {
      hstICP: "0xA198902f589BC4805ED4cA6089B9Fe46d1c9a866",
    },
  },
  local: {
    id: "local",
    label: "Local Replica",
    description: "DFX local replica (development)",
    host: LOCAL_HOST,
    identityProvider: LOCAL_IDENTITY_PROVIDER,
    canisters: {
      vault: "a3shf-5eaaa-aaaaa-qaafa-cai",
      ledger: "br5f7-7uaaa-aaaaa-qaaca-cai",
      coreVault: "by6od-j4aaa-aaaaa-qaadq-cai",
      faucet: LOCAL_FAUCET_CANISTER_ID,
    },
    contracts: {
      hstICP: LOCAL_HST_ICP_CONTRACT,
    },
  },
};

export const DEFAULT_NETWORK: NetworkId = "local";

export function getNetworkConfig(network: NetworkId = DEFAULT_NETWORK) {
  return NETWORKS[network];
}

export function getDefaultVaultCanister(network: NetworkId = DEFAULT_NETWORK) {
  return getNetworkConfig(network).canisters.vault ?? "";
}
