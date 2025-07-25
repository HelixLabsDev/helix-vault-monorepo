import { ethers } from "ethers";
import { getContractEssentials } from "./helpers";
import hstICPAbi from "../abi/HelixStakedICP.json";

// Define the contract address
const hstICPContract: string = "0xF47763Ae4b3C4A04345C65229e99344be107301b";

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
