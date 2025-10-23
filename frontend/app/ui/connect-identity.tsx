"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo } from "react";
import { AuthClient, LocalStorage } from "@dfinity/auth-client";
import { HttpAgent } from "@dfinity/agent";
import { createActor } from "@/declarations/helix_vault_backend";
import { createActor as createLedgerActor } from "@/declarations/icrc1-ledger";
import { createActor as createCoreVault } from "@/declarations/core_vault_backend";
import { createActor as createFaucetVault } from "@/declarations/icrc_faucet_backend";

import { Button } from "@/app/ui/button";
import { useStore } from "@/lib/store";
import { useStoreCore } from "@/lib/storeCoreVault";

import { getNetworkConfig } from "@/lib/constant";
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

  const networkConfig = useMemo(() => getNetworkConfig(), []);

  // Init and check session on mount
  useEffect(() => {
    (async () => {
      const createOptions =
        networkConfig.id === "local"
          ? { storage: new LocalStorage("helix-local-") }
          : undefined;
      const _authClient = await AuthClient.create(createOptions);
      setAuthClient(_authClient);

      const loggedIn = await _authClient.isAuthenticated();
      setIsAuthenticated(loggedIn);
      if (loggedIn) {
        await updateActor(_authClient);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [networkConfig]);

  // Connect II
  async function login() {
    if (!authClient) return;

    const isLocal = networkConfig.id === "local";
    await authClient.login({
      identityProvider: networkConfig.identityProvider,
      ...(isLocal ? {} : { derivationOrigin: window.location.origin }),
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
    setFaucetActor(null);
  }

  // Setup actors with identity
  async function updateActor(authClient: AuthClient) {
    const identity: any = authClient.getIdentity();
    const isLocal = networkConfig.id === "local";
    const agent = new HttpAgent({
      identity,
      host: networkConfig.host,
    });

    if (isLocal) {
      await agent.fetchRootKey();
    }

    const resolvedVaultId =
      vaultAddress || networkConfig.canisters.vault || undefined;
    if (!resolvedVaultId) {
      console.error("Vault canister ID is not configured for", networkConfig);
      return;
    }

    const actor = createActor(resolvedVaultId, { agent });

    const coreVaultId = networkConfig.canisters.coreVault;
    const actorCore = coreVaultId
      ? createCoreVault(coreVaultId, { agent })
      : null;

    const ledgerCanisterId = networkConfig.canisters.ledger;
    const ledgerActor = ledgerCanisterId
      ? createLedgerActor(ledgerCanisterId, { agent })
      : null;

    const faucetCanisterId = networkConfig.canisters.faucet;
    const faucetActor = faucetCanisterId
      ? createFaucetVault(faucetCanisterId, { agent })
      : null;

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
