import { ethers } from "ethers";
import hstICPAbi from "../abi/HelixStakedICP.json";
import { getContractEssentials } from "./helpers";
import { toast } from "sonner";

// v6-friendly provider type
type AnyProvider = ethers.Provider | ethers.BrowserProvider;

interface HstICPContracts {
  hstICPReadContract: ethers.Contract;
  hstICPWriteContract: ethers.Contract;
  provider: AnyProvider;
  signer: ethers.Signer; // guaranteed for write
}

export async function getHstICPContract(
  contractAddress: string
): Promise<HstICPContracts> {
  if (!contractAddress) {
    throw new Error(
      "hstICP contract address is not configured for the selected network."
    );
  }

  const { provider, signer } = await getContractEssentials();

  if (!provider) {
    toast.error(
      "Withdrawals are not supported on mobile. Please use a desktop browser with the Metamask extension."
    );
    throw new Error("No provider available.");
  }
  if (!signer) {
    // If your getContractEssentials can return null signer (fallback RPC),
    // force users to connect for write ops:
    toast.error(
      "Withdrawals are not supported on mobile. Please use a desktop browser with the Metamask extension."
    );
    throw new Error("No signer found. Connect a wallet to enable writes.");
  }

  // In v6, pass the runner directly (Provider for read, Signer for write)
  const hstICPReadContract = new ethers.Contract(
    contractAddress,
    hstICPAbi,
    provider
  );
  const hstICPWriteContract = new ethers.Contract(
    contractAddress,
    hstICPAbi,
    signer
  );

  return { hstICPReadContract, hstICPWriteContract, provider, signer };
}
