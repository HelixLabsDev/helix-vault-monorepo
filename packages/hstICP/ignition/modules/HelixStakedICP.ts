import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("HelixStakedICPModule", (m) => {
  // Define initial allowed NFTs as an array (fix: use array literal for default value)
  const defaultAdmin = m.getParameter(
    "defaultAdmin",
    "0x25601b4776537E5aF36F650797C86eF4138FA4bC"
  );

  const minter = m.getParameter(
    "minter",
    "0xb6FD3e009647Cac38e0c356a91b16fEbFc399b41"
  );

  // Deploy HelixStakedICP contract with constructor arguments
  const helixStakedICP = m.contract("HelixStakedICP", [defaultAdmin, minter]);

  return { helixStakedICP };
});
