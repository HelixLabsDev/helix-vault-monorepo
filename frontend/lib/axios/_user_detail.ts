/* eslint-disable @typescript-eslint/no-unused-vars */

import _axios from "@/lib/axios";

export const _userDetail = async ({ address }: { address: string }) => {
  try {
    const { data, message } = await _axios.get(`/icp/${address}`, {
      next: { tags: ["user"] },
    });

    return { data, message, status: 200 };
  } catch (e) {
    return { data: null, message: null };
  }
};

export const _seenContest = async ({
  id,
  address,
}: {
  id: string;
  address: string;
}) => {
  try {
    const { data, message } = await _axios.post(
      `/icp/${address}/contest/${id}/seen`,
      {
        id,
      }
    );

    return { data, message, status: 200 };
  } catch (e) {
    return { data: null, message: null, status: 400 };
  }
};

export const _getTransactions = async ({
  address,
  limit,
}: {
  address: string;
  limit: number;
}) => {
  try {
    const { data, message } = await _axios.get(
      `/icp/${address}/transactions?limit=${limit}`,
      {
        next: { tags: ["transactions"] },
      }
    );

    return { data, message, status: 200 };
  } catch (e) {
    return { data: null, message: null, status: 400 };
  }
};

export const _usersTVL = async () => {
  try {
    const { data, message } = await _axios.get(`/tvl`, {
      next: { tags: ["usersTVL"] },
    });

    return { data, message, status: 200 };
  } catch (e) {
    return { data: null, message: null };
  }
};

export const _users = async () => {
  try {
    const { data, message } = await _axios.get(`/icp/`, {
      next: { tags: ["users"] },
    });

    return { data, message, status: 200 };
  } catch (e) {
    return { data: null, message: null };
  }
};
