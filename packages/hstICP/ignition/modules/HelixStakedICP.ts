import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("HelixStakedICPModule", (m) => {
  // Define initial allowed NFTs as an array (fix: use array literal for default value)
  const defaultAdmin = m.getParameter(
    "defaultAdmin",
    "0x25601b4776537E5aF36F650797C86eF4138FA4bC"
  );

  const minter = m.getParameter(
    "minter",
    "0x990BAaD8Cac703f9D402D179683f38Eb33389998"
  );

  // Deploy HelixStakedICP contract with constructor arguments
  const helixStakedICP = m.contract("HelixStakedICP", [defaultAdmin, minter]);

  return { helixStakedICP };
});
