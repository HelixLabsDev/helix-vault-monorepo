"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect } from "react";
import { AuthClient } from "@dfinity/auth-client";
import { HttpAgent } from "@dfinity/agent";
import { createActor } from "@/declarations/helix_vault_backend";
import { createActor as createLedgerActor } from "@/declarations/icrc1-ledger";
import { createActor as createCoreVault } from "@/declarations/core_vault_backend";
import { createActor as createFaucetVault } from "@/declarations/icrc_faucet_backend";

import { Button } from "@/app/ui/button";
import { useStore } from "@/lib/store";
import { useStoreCore } from "@/lib/storeCoreVault";

import {
  coreVaultPrincipal,
  faucetActorAddress,
  IDENTITY_URL,
  ledgerActorAddress,
  vaultActorAddress,
} from "@/lib/constant";
import { Badge } from "./badge";
import { ChevronDown } from "lucide-react";

interface Props {
  className?: string;
  variant?: "default" | "outline" | "ghost";
}

export function InternetIdentityConnect({
  className = "",
  variant = "outline",
}: Props) {
  const {
    setActor,
    isAuthenticated,
    setIsAuthenticated,
    authClient,
    setAuthClient,
    principal,
    setPrincipal,
    setLedgerActor,
    vaultAddress,
    setFaucetActor,
  } = useStore();

  const { setActorCore } = useStoreCore();

  console.log("principal", principal);

  // Init and check session on mount
  useEffect(() => {
    (async () => {
      const _authClient = await AuthClient.create();
      setAuthClient(_authClient);

      const loggedIn = await _authClient.isAuthenticated();
      if (loggedIn) {
        await updateActor(_authClient);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // Connect II
  async function login() {
    if (!authClient) return;

    await authClient.login({
      identityProvider: IDENTITY_URL,
      onSuccess: async () => {
        await updateActor(authClient);
      },
    });
  }

  // Disconnect II
  async function logout() {
    if (!authClient) return;

    await authClient.logout();

    // Clear all state
    setIsAuthenticated(false);
    setPrincipal(null);
    setActor(null);
    setLedgerActor(null);
    setActorCore(null);
  }

  // Setup actors with identity
  async function updateActor(authClient: AuthClient) {
    const identity: any = authClient.getIdentity();
    const isMainnet = true;
    const agent = new HttpAgent({
      identity,
      host: isMainnet ? "https://ic0.app" : "http://localhost:4943",
    });

    if (!isMainnet) {
      await agent.fetchRootKey();
    }

    const actor = createActor(vaultAddress || vaultActorAddress, { agent });
    const actorCore = createCoreVault(coreVaultPrincipal, { agent });
    const ledgerActor = createLedgerActor(ledgerActorAddress, {
      agentOptions: { identity },
    });

    const faucetActor = createFaucetVault(faucetActorAddress, { agent });

    setActor(actor);
    setActorCore(actorCore);
    setLedgerActor(ledgerActor);
    setFaucetActor(faucetActor);
    setPrincipal(identity.getPrincipal().toText());
    setIsAuthenticated(true);
  }

  return isAuthenticated ? (
    <Button onClick={logout} className={className} variant={variant}>
      ({principal?.slice(0, 6)}...{principal?.slice(-4)})
      <Badge variant="secondary" className="text-xs">
        ICP
      </Badge>
      <ChevronDown className="h-4 w-4" />
    </Button>
  ) : (
    <Button onClick={login} className={className} variant={variant}>
      Connect Internet Identity
    </Button>
  );
}
