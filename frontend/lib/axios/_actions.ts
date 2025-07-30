/* eslint-disable @typescript-eslint/no-unused-vars */

import _axios from "@/lib/axios";

export const _depositEthereum = async ({
  address,
  amount,
  transactionHash,
  tokenId,
}: {
  address: string;
  amount: number;
  transactionHash: string;
  tokenId: string;
}) => {
  try {
    const { data, message } = await _axios.post(`/icp/deposit`, {
      address,
      amount,
      transactionHash,
      tokenId,
    });

    return { data, message, status: 200 };
  } catch (e) {
    return { data: null, message: null, status: 400 };
  }
};

export const _withdrawEthereum = async ({
  address,
  amount,
  transactionHash,
  tokenId,
}: {
  address: string;
  amount: number;
  transactionHash: string;
  tokenId: string;
}) => {
  try {
    const { data, message } = await _axios.post(`/icp/withdraw`, {
      address,
      amount,
      transactionHash,
      tokenId,
    });

    return { data, message, status: 200 };
  } catch (e) {
    return { data: null, message: null, status: 400 };
  }
};
