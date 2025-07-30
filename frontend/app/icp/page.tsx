"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import animation from "@/app/ui/assets/stars.json";

import StakeDemo from "@/app/ui/stake";
import { Skeleton } from "@/app/ui/skeleton";
import { useStore } from "@/lib/store";
import { convertBalance, convertNatToNumber } from "@/lib/utils";
import { Principal } from "@dfinity/principal";
import { createActor } from "@/declarations/helix_vault_backend";
import { _userDetail } from "@/lib/axios/_user_detail";
import TransactionList, { Transaction } from "../ui/transaction-list";

const LottiePlayer = dynamic(() => import("lottie-react"), { ssr: false });

function formatNumber(num: number): string {
  if (num >= 1_000_000_000_000) {
    return (num / 1_000_000_000_000).toFixed(1).replace(/\.0$/, "") + "T";
  } else if (num >= 1_000_000_000) {
    return (num / 1_000_000_000).toFixed(1).replace(/\.0$/, "") + "B";
  } else if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  } else if (num >= 1_000) {
    return (num / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  }
  return num.toFixed(2).toString();
}

export interface VaultUser {
  address: string;
  points: string;
  lockedAmount: string;
  valueUSD: string;
  totalDeposited: number;
  recentTransactions: Transaction[];
  tvl: tvlType;
}

export interface tvlType {
  totalDeposited: string;
  uniqueWallets: string;
  valueUSD: string;
  icpPercentage: string;
  assets: {
    stICP: {
      totalLocked: number;
      valueUSD: number;
    };
  };
}

export default function Home() {
  const {
    actor,
    principal,
    setUserBalance,
    setBalance,
    balance,
    userBalance,
    authClient,
    setWithdrawBalance,
    ledgerActor,
    isAuthenticated,
    vaultAddress,
  } = useStore();

  const [loading, setLoading] = useState(true);
  const [points, setPoints] = useState("0");
  const [users, setUsers] = useState<VaultUser>({
    address: "",
    points: "0",
    lockedAmount: "0",
    valueUSD: "0",
    totalDeposited: 0,
    recentTransactions: [],
    tvl: {
      totalDeposited: "0",
      uniqueWallets: "0",
      valueUSD: "0",
      icpPercentage: "0",
      assets: {
        stICP: {
          totalLocked: 0,
          valueUSD: 0,
        },
      },
    },
  });

  useEffect(() => {
    if (!vaultAddress) return;

    const fetchBalance = async () => {
      try {
        const actor = createActor(vaultAddress);
        const balance = await actor.get_vault_balance();
        setBalance(convertNatToNumber(balance.toString()));
      } catch (err) {
        console.error("Error fetching vault balance:", err);
      } finally {
        setTimeout(() => setLoading(false), 1000);
      }
    };

    fetchBalance();
  }, [vaultAddress, setBalance]);

  useEffect(() => {
    if (!(actor && principal && ledgerActor && authClient)) return;

    const fetchUserBalances = async () => {
      try {
        const user = await actor.get_user_balance(
          Principal.fromText(principal)
        );
        setUserBalance(convertNatToNumber(user.toString()));

        const res = await ledgerActor.icrc1_balance_of({
          owner: Principal.fromText(principal),
          subaccount: [],
        });
        setWithdrawBalance(convertBalance(res));
      } catch (err) {
        console.error("Error fetching user balances:", err);
      }
    };

    fetchUserBalances();
  }, [
    actor,
    principal,
    ledgerActor,
    authClient,
    setUserBalance,
    setWithdrawBalance,
  ]);

  useEffect(() => {
    if (!principal) return;

    const fetchUserDetails = async () => {
      try {
        const userData = await _userDetail({ address: principal });
        setPoints(userData?.data?.points || 0);
        setUsers(userData?.data as VaultUser);
      } catch (err) {
        console.error("Error fetching user details:", err);
      }
    };

    fetchUserDetails();
  }, [principal]);

  const stats = [
    {
      label: "Total Deposits",
      value: balance ? formatNumber(balance).toString() : "0",
    },
    { label: "Liquidity", value: "12.74k" },
    { label: "APY", value: "15.1%" },
  ];

  const statsWithBalance = [
    {
      label: "Total Deposits",
      value: balance ? formatNumber(balance) : "0",
    },
    {
      label: "User Balance",
      value: userBalance ? formatNumber(userBalance).toString() : "0",
    },
    { label: "APY", value: "15.1%" },
  ];

  return (
    <div className="flex md:flex-row flex-col gap-12 w-full items-start pt-12 h-full">
      <div className="flex flex-col gap-12 w-full md:w-2/3">
        <div className="text-6xl font-light relative overflow-hidden">
          nICP <span className="text-muted-foreground">Vault</span>
          <LottiePlayer
            animationData={animation}
            loop={true}
            style={{ width: "192px", height: "192px" }}
            className="absolute -top-4 left-24"
          />
        </div>
        <p className="text-muted-foreground text-lg font-light leading-6 text-justify">
          Helix Vault is a cross-chain liquid staking platform that lets you
          stake nICP on the Internet Computer and receive hstICP on Ethereum —
          unlocking DeFi access, yield, and seamless 1:1 redemption. Fully
          governed on-chain with modular upgradeability.
        </p>
        <Statistics
          loading={loading}
          stats={isAuthenticated ? statsWithBalance : stats}
        />
        <VaultTabs points={points} users={users} />
      </div>
      <div className="mt-12 w-full md:w-1/3 block md:sticky top-5 relative">
        <StakeDemo
          tvl={users ?? { valueUSD: "0", icpPercentage: "0" }}
          setUsers={setUsers}
        />
      </div>
    </div>
  );
}

// Statistics component
function Statistics({
  stats,
  loading,
}: {
  stats: { label: string; value: string }[];
  loading: boolean;
}) {
  return (
    <div className="flex gap-6 justify-between">
      {loading
        ? [...Array(3)].map((_, index) => (
            <div
              key={index}
              className="flex gap-2 mt-6 text-xl text-foreground/80 font-light"
            >
              <Skeleton className="h-[72px] w-[128px] bg-primary/5" />
            </div>
          ))
        : stats.map((stat) => (
            <div
              key={stat.label}
              className="flex flex-col gap-2 mt-6 text-xl text-foreground/80 font-light"
            >
              <p>{stat.label}</p>
              <p className="text-3xl text-foreground">{stat.value}</p>
            </div>
          ))}
    </div>
  );
}

// Vault Tabs Component
function VaultTabs({
  points,
  users,
}: {
  points: string;
  users: VaultUser | null;
}) {
  if (!users) return null;

  const txns = users.recentTransactions ?? [];

  return (
    <div className="flex flex-col pb-6">
      <div className="border-b py-3 text-muted-foreground/80 text-sm">
        Vault
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 text-muted-foreground">
          <div className="flex flex-col gap-1 mt-6">
            <p className="text-sm">Points</p>
            <p className="text-2xl font-medium text-foreground">
              {Number(points).toFixed(2)}
            </p>
          </div>

          <div className="flex flex-col gap-2 mt-6 text-xl">
            <p>Recent Transactions</p>
          </div>
        </div>
        <TransactionList transactions={txns} />
        {/* <Chart1 /> */}
      </div>
    </div>
  );
}
