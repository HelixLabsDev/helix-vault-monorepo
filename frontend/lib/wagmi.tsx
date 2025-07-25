// config/index.tsx

import { cookieStorage, createStorage } from "@wagmi/core";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { holesky } from "@reown/appkit/networks";

// Get projectId from https://cloud.reown.com
export const projectId = "1f92aec3dd870f130f6788f3910e6310";

if (!projectId) {
  throw new Error("Project ID is not defined");
}

export const networks = [holesky];

//Set up the Wagmi Adapter (Config)
export const wagmiAdapter = new WagmiAdapter({
  storage: createStorage({
    storage: cookieStorage,
  }),
  ssr: true,
  projectId,
  networks,
});

export const config = wagmiAdapter.wagmiConfig;
