import { create } from "zustand";
import { AuthClient } from "@dfinity/auth-client";
import { _SERVICE } from "@/declarations/helix_vault_backend/helix_vault_backend.did";
import { _SERVICE as ledgerType } from "@/declarations/icrc1-ledger/icrc1-ledger.did";

interface AppState {
  actor: _SERVICE | null;
  setActor: (actor: _SERVICE | null) => void;

  vaultAddress: string;
  setVaultAddress: (vaultAddress: string) => void;

  ledgerActor: ledgerType | null;
  setLedgerActor: (ledgerActor: ledgerType | null) => void;

  isAuthenticated: boolean;
  setIsAuthenticated: (isAuthenticated: boolean) => void;

  authClient: AuthClient | null;
  setAuthClient: (authClient: AuthClient | null) => void;

  principal: string | null;
  setPrincipal: (principal: string | null) => void;

  balance: number;
  setBalance: (balance: number) => void;
  userBalance: number;
  setUserBalance: (userBalance: number) => void;

  setWithdrawBalance: (withdrawBalance: number) => void;
  withdrawBalance: number;
}

export const useStore = create<AppState>((set) => ({
  actor: null,
  setActor: (actor) => set({ actor }),

  vaultAddress: "",
  setVaultAddress: (vaultAddress) => set({ vaultAddress }),

  ledgerActor: null,
  setLedgerActor: (ledgerActor) => set({ ledgerActor }),

  isAuthenticated: false,
  setIsAuthenticated: (isAuthenticated) => set({ isAuthenticated }),

  authClient: null,
  setAuthClient: (authClient) => set({ authClient }),

  principal: null,
  setPrincipal: (principal) => set({ principal }),

  balance: 0,
  setBalance: (balance) => set({ balance }),
  userBalance: 0,
  setUserBalance: (userBalance) => set({ userBalance }),

  setWithdrawBalance: (withdrawBalance) => set({ withdrawBalance }),
  withdrawBalance: 0,
}));
