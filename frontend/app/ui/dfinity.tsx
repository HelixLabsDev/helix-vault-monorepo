/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect } from "react";
import { AuthClient } from "@dfinity/auth-client";
import { HttpAgent } from "@dfinity/agent";
import { createActor } from "@/declarations/helix_vault_backend";
import { createActor as createLedgerActor } from "@/declarations/icrc1-ledger"; // Ledger actor
import { createActor as createCoreVault } from "@/declarations/core_vault_backend"; // Ledger actor
import { Button } from "./button";
import { useStore } from "@/lib/store";
import {
  coreVaultPrincipal,
  IDENTITY_URL,
  ledgerActorAddress,
  vaultActorAddress,
} from "@/lib/constant";
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

  const { vaultAddress } = useStore();

  useEffect(() => {
    updateActor();
  }, []);

  async function updateActor(): Promise<void> {
    const authClient = await AuthClient.create();
    const isAuthenticated = await authClient.isAuthenticated();
    setAuthClient(authClient);

    if (isAuthenticated) {
      const identity: any = authClient.getIdentity();
      const agent = new HttpAgent({ identity, host: "http://localhost:4943" });
      if (process.env.NEXT_PUBLIC_DFX_NETWORK !== "ic") {
        await agent.fetchRootKey(); // Local dev
      }
      const actor = createActor(
        vaultAddress.length > 0 ? vaultAddress : vaultActorAddress,
        { agent }
      );
      setActor(actor);

      const actorCore = createCoreVault(coreVaultPrincipal, { agent });
      setActorCore(actorCore);

      setIsAuthenticated(true);
      setPrincipal(identity.getPrincipal().toText().toString());
      console.log("idd: ", principal);

      const ledgerActor = createLedgerActor(ledgerActorAddress, {
        agentOptions: { identity },
      });
      setLedgerActor(ledgerActor);
    } else {
      setIsAuthenticated(false);
      setPrincipal(null);
    }
  }

  async function login(): Promise<void> {
    if (authClient) {
      await authClient.login({
        identityProvider: IDENTITY_URL,
        onSuccess: updateActor,
      });
    }
  }

  async function logout(): Promise<void> {
    if (authClient) {
      await authClient.logout();
      setActor(null);
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
