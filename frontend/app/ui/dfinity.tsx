/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo } from "react";
import { AuthClient } from "@dfinity/auth-client";
import { HttpAgent } from "@dfinity/agent";
import { createActor } from "@/declarations/helix_vault_backend";
import { createActor as createLedgerActor } from "@/declarations/icrc1-ledger"; // Ledger actor
import { createActor as createCoreVault } from "@/declarations/core_vault_backend"; // Ledger actorr
import { createActor as createFaucetVault } from "@/declarations/icrc_faucet_backend"; // Ledger actorr
import { Button } from "./button";
import { useStore } from "@/lib/store";
import { getNetworkConfig } from "@/lib/constant";
import { useStoreCore } from "@/lib/storeCoreVault";

const InternetIdentity = () => {
  const {
    setActor,
    isAuthenticated,
    setIsAuthenticated,
    authClient,
    setAuthClient,
    principal,
    setPrincipal,
    setLedgerActor,
    setFaucetActor,
    vaultAddress,
  } = useStore();

  const {
    setActorCore,
    // isAuthenticated,
    // setIsAuthenticated,
    // authClient,
    // setAuthClient,
    // principal,
    // setPrincipal,
    // setLedgerActor,
  } = useStoreCore();

  const networkConfig = useMemo(() => getNetworkConfig(), []);

  useEffect(() => {
    updateActor();
  }, [networkConfig]);

  async function updateActor(): Promise<void> {
    const authClient = await AuthClient.create();
    const isAuthenticated = await authClient.isAuthenticated();
    setAuthClient(authClient);

    if (isAuthenticated) {
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
        vaultAddress.length > 0
          ? vaultAddress
          : networkConfig.canisters.vault || undefined;
      if (!resolvedVaultId) {
        console.error(
          "Vault canister ID missing. Configure local canister IDs first."
        );
        return;
      }

      const actor = createActor(resolvedVaultId, { agent });
      setActor(actor);

      const coreVaultId = networkConfig.canisters.coreVault;
      const actorCore = coreVaultId
        ? createCoreVault(coreVaultId, { agent })
        : null;
      setActorCore(actorCore);

      const faucetId = networkConfig.canisters.faucet;
      const faucetActor = faucetId
        ? createFaucetVault(faucetId, { agent })
        : null;
      setFaucetActor(faucetActor);

      setIsAuthenticated(true);
      setPrincipal(identity.getPrincipal().toText().toString());

      const ledgerId = networkConfig.canisters.ledger;
      const ledgerActor = ledgerId
        ? createLedgerActor(ledgerId, { agent })
        : null;
      setLedgerActor(ledgerActor);
    } else {
      setIsAuthenticated(false);
      setPrincipal(null);
    }
  }

  async function login(): Promise<void> {
    if (authClient) {
      await authClient.login({
        identityProvider: networkConfig.identityProvider,
        derivationOrigin: window.location.origin,
        onSuccess: updateActor,
      });
    }
  }

  async function logout(): Promise<void> {
    if (authClient) {
      await authClient.logout();
      setActor(null);
      setLedgerActor(null);
      setActorCore(null);
      setFaucetActor(null);
      setIsAuthenticated(false);
      setPrincipal(null);
    }
  }

  return (
    <div className="flex w-full items-center space-x-4">
      {isAuthenticated ? (
        <>
          <Button onClick={logout}>{principal}</Button>
        </>
      ) : (
        <Button className="w-full" onClick={login}>
          Connect Internet Identity
        </Button>
      )}
    </div>
  );
};

export default InternetIdentity;
