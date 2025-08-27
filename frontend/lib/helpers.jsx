import { ethers } from "ethers";

async function getContractEssentials() {
  let signer = null;

  let provider;
  provider = ethers.getDefaultProvider();
  if (window.ethereum == null) {
    provider = ethers.getDefaultProvider();
  } else {
    provider = new ethers.BrowserProvider(window?.ethereum);

    signer = await provider.getSigner();
  }
  return { provider, signer };
}

function parse18(amount) {
  return ethers.parseUnits(amount.toString(), 18);
}

function toInteger18(amount) {
  return parseInt(parse18(amount));
}

function toFloat18(amount) {
  return parseFloat(parse18(amount));
}

function parse(amount, decimal) {
  return ethers.parseUnits(amount.toString(), decimal);
}

function format(amount, decimal) {
  return ethers.formatUnits(amount.toString(), decimal);
}

function format18(amount) {
  return ethers.formatUnits(amount.toString(), 18);
}

function convertPercentagesToWeiArray(percentages) {
  const totalPercentage = percentages.reduce(
    (acc, percent) => acc + percent,
    0
  );

  if (totalPercentage > 100) {
    throw new Error("Total percentage must be equal to or less than 100");
  }

  const multiplier = 1e18 / totalPercentage; // Adjusted multiplier

  return percentages.map((percent) => percent * multiplier);
}
export {
  toInteger18,
  toFloat18,
  parse,
  parse18,
  format,
  getContractEssentials,
  format18,
  convertPercentagesToWeiArray,
};
