const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

const defaultAdmin = "0xbc873CE5b3Bd0aBA17250E01Cf2ff67CE7B33b4f";
const minter = "0xe3145E42DA54921646b27D2608f0017aaf8B4344";

module.exports = buildModule("HelixStakedICPModule", (m) => {
  const hstICP = m.contract("HelixStakedICP", [defaultAdmin, minter], {
    gasLimit: 3_000_000,
  });
  return { hstICP };
});
