const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

const defaultAdmin = "0xbc873CE5b3Bd0aBA17250E01Cf2ff67CE7B33b4f";
const minter = "0xf337eB5f31e8e543AC306eBa940581955216C464";

module.exports = buildModule("HelixStakedICPModule", (m) => {
  const hstICP = m.contract("HelixStakedICP", [defaultAdmin, minter], {
    gasLimit: 3_000_000,
  });
  return { hstICP };
});
