const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

const defaultAdmin = "0x3989BCC4a9A4E356265AcC658fB10Dfb3a86ddd7";
const minter = "0x8fd25b2C451FD76a2F814daFCcDdaaB3B7B42f1F";

module.exports = buildModule("HelixStakedICPModule", (m) => {
  const hstICP = m.contract("HelixStakedICP", [defaultAdmin, minter], {
    gasLimit: 3_000_000,
  });
  return { hstICP };
});
