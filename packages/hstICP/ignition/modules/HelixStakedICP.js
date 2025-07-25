const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

const defaultAdmin = "0x3989BCC4a9A4E356265AcC658fB10Dfb3a86ddd7";
const minter = "0x3CBEE5696e2656dFAA7Ac1721060d7684358F884";

module.exports = buildModule("HelixStakedICPModule", (m) => {
  const hstICP = m.contract("HelixStakedICP", [defaultAdmin, minter], {
    gasLimit: 3_000_000,
  });
  return { hstICP };
});
