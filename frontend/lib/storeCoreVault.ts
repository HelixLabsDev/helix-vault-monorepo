import { create } from "zustand";
import { AuthClient } from "@dfinity/auth-client";
import { _SERVICE } from "@/declarations/core_vault_backend/core_vault_backend.did";
import { _SERVICE as ledgerType } from "@/declarations/icrc1-ledger/icrc1-ledger.did";

interface AppState {
  actorCore: _SERVICE | null;
  setActorCore: (actor: _SERVICE | null) => void;

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

export const useStoreCore = create<AppState>((set) => ({
  actorCore: null,
  setActorCore: (actorCore) => set({ actorCore }),

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
