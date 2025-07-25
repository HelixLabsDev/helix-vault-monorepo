import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function convertBalance(balance: bigint, decimals = 8): number {
  const balanceString = balance.toString();
  const divisor = BigInt(10 ** decimals);
  const wholePart = BigInt(balanceString) / divisor;
  const fractionalPart = BigInt(balanceString) % divisor;
  const fractionalString = fractionalPart.toString().padStart(decimals, "0");

  const result = Number.parseFloat(`${wholePart}.${fractionalString}`);
  return result;
}

export function convertNatToNumber(nat: string | number, decimals = 8): number {
  const natString = nat.toString();
  const paddedNatString = natString.padStart(decimals + 1, "0");
  const wholePart = paddedNatString.slice(0, -decimals) || "0";
  const fractionalPart = paddedNatString.slice(-decimals);

  const result = Number.parseFloat(`${wholePart}.${fractionalPart}`);
  return result;
}

// export const convertToNat = (value: string): bigint => {
//   // Remove the decimal point and pad with zeros if necessary
//   const [wholePart, fractionalPart = ""] = value.split(".");
//   const paddedFractionalPart = fractionalPart.padEnd(8, "0");
//   const combinedValue = wholePart + paddedFractionalPart;

//   // Remove leading zeros and convert to BigInt
//   return BigInt(combinedValue.replace(/^0+/, "") || "0");
// };

export const convertToNat = (value: string): bigint => {
  const [wholePart, fractionalPart = ""] = value.split(".");
  const paddedFractionalPart = fractionalPart.padEnd(8, "0").slice(0, 8); // always 8 decimals
  const combined = `${wholePart}${paddedFractionalPart}`;

  // Make sure to preserve "0" instead of empty string
  return BigInt(combined.replace(/^0+(?!$)/, ""));
};

export function tokensToUnits(
  tokenAmount: string,
  decimals = 8
): bigint | null {
  // Use a regular expression to validate the input format
  const validInputRegex = /^\d+(\.\d+)?$/;
  if (!validInputRegex.test(tokenAmount)) {
    console.error("Invalid token amount format");
    return null;
  }

  // Split the input into whole and fractional parts
  const [wholePart, fractionalPart = ""] = tokenAmount.split(".");

  // Pad or truncate the fractional part to match the decimals
  const paddedFractionalPart = fractionalPart
    .padEnd(decimals, "0")
    .slice(0, decimals);

  // Combine whole and fractional parts
  const combinedAmount = `${wholePart}${paddedFractionalPart}`;

  // Convert to BigInt
  try {
    return BigInt(combinedAmount);
  } catch (error) {
    console.error("Error converting to units:", error);
    return null;
  }
}
