const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

const defaultAdmin = "0x3989BCC4a9A4E356265AcC658fB10Dfb3a86ddd7";
const minter = "0xCE1bCD3510202F58C32C8D37931FFF87B456713A";

module.exports = buildModule("HelixStakedICPModule", (m) => {
  const hstICP = m.contract("HelixStakedICP", [defaultAdmin, minter], {
    gasLimit: 3_000_000,
  });
  return { hstICP };
});
