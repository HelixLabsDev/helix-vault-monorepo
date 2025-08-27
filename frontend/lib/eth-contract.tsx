import { ethers } from "ethers";
import hstICPAbi from "../abi/HelixStakedICP.json";
import { hstICPContract } from "../lib/constant";
import { getContractEssentials } from "./helpers";

// Define the contract address

// Define the return type interface
interface HstICPContracts {
  hstICPReadContract: ethers.Contract;
  hstICPWriteContract: ethers.Contract;
  provider: ethers.providers.Provider;
  signer: ethers.Signer;
}

/**
 * Gets the EigenFi pool contracts for reading and writing
 * @returns Object containing read and write contracts, provider and signer
 */
async function getHstICPContract(): Promise<HstICPContracts> {
  const { provider, signer } = await getContractEssentials();

  const hstICPReadContract = new ethers.Contract(
    hstICPContract,
    hstICPAbi,
    provider
  );

  const hstICPWriteContract = hstICPReadContract.connect(signer);

  return {
    hstICPReadContract,
    hstICPWriteContract,
    provider,
    signer,
  };
}

export { getHstICPContract };
