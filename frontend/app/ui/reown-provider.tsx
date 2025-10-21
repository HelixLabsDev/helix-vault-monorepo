/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { wagmiAdapter, projectId } from "@/lib/wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createAppKit } from "@reown/appkit/react";
import { holesky } from "@reown/appkit/networks";
import React, { type ReactNode } from "react";
import { cookieToInitialState, WagmiProvider, type Config } from "wagmi";

const queryClient = new QueryClient();

if (!projectId) {
  throw new Error("Project ID is not defined");
}

const metadataUrl =
  process.env.NEXT_PUBLIC_APPKIT_METADATA_URL ??
  (typeof window !== "undefined"
    ? window.location.origin
    : "http://127.0.0.1:4949");

// Set up metadata
const metadata = {
  name: "EigenFi - ICP Vault",
  description:
    "Helix Vault is a modular liquid staking and cross-chain restaking infrastructure on ICP. It allows users to stake hICP and mint hstICP on Ethereum, with trustless 1:1 redemption, on-chain governance, and shared ownership control.",
  url: metadataUrl, // origin must match your domain & subdomain
  icons: ["/favicon.ico", "/icp.svg"],
};

const modal = createAppKit({
  adapters: [wagmiAdapter],
  projectId,
  networks: [holesky],
  defaultNetwork: holesky,
  metadata: metadata,
  features: {
    analytics: true, // Optional - defaults to your Cloud configuration
  },
});

function ContextProvider({ children }: { children: ReactNode }) {
  const initialState = cookieToInitialState(wagmiAdapter.wagmiConfig as Config);

  return (
    <WagmiProvider
      config={wagmiAdapter.wagmiConfig as Config}
      initialState={initialState}
    >
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}

export default ContextProvider;
