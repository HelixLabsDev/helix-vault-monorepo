"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import animation from "@/app/ui/assets/stars.json";

import StakeDemo from "@/app/ui/stake";
import { Component as Chart1 } from "@/app/ui/chart-1";
import { Component2 as Chart2 } from "@/app/ui/chart-2";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/ui/tabs";
import { Skeleton } from "@/app/ui/skeleton";
import { useStore } from "@/lib/store";
import { convertBalance, convertNatToNumber } from "@/lib/utils";
import { Principal } from "@dfinity/principal";
import { createActor } from "@/declarations/helix_vault_backend";
import { _userDetail } from "@/lib/axios/_user_detail";

const LottiePlayer = dynamic(() => import("lottie-react"), { ssr: false });

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

  const [points, setPoints] = useState(0);

  useEffect(() => {
    const sayGreeting = async () => {
      if (actor && principal && ledgerActor && authClient) {
        const user = await actor.get_user_balance(
          Principal.fromText(principal)
        );

        setUserBalance(convertNatToNumber(user.toString()));

        const res = await ledgerActor.icrc1_balance_of({
          owner: Principal.fromText(principal),
          subaccount: [],
        });
        setWithdrawBalance(convertBalance(res));
      }
    };

    sayGreeting();
  }, [
    actor,
    authClient,
    ledgerActor,
    principal,
    setUserBalance,
    setWithdrawBalance,
  ]);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const actor = createActor(vaultAddress);
      const balance = await actor.get_vault_balance();
      setBalance(convertNatToNumber(balance.toString()));
      setInterval(() => {
        setLoading(false);
      }, 1000);
    };

    fetch();
  }, [setBalance, vaultAddress]);

  useEffect(() => {
    const fetch = async () => {
      const userData = await _userDetail({ address: principal ?? "" });
      setPoints(userData?.data?.points);
      console.log("userData", userData);
    };

    fetch();
  }, [principal]);

  const stats = [
    { label: "Total Deposits", value: balance ? balance.toString() : "empty" },
    { label: "Liquidity", value: "12.74k" },
    { label: "APY", value: "4.18%" },
  ];

  const statsWithBalance = [
    { label: "Total Deposits", value: balance ? balance.toString() : "empty" },
    {
      label: "User Balance",
      value: userBalance ? userBalance.toString() : "empty",
    },
    { label: "APY", value: "4.18%" },
  ];

  return (
    <div className="flex gap-24 w-full items-start p-10 pt-12 rounded-2xl">
      <div className="flex flex-col gap-12">
        <div className="text-6xl font-light relative overflow-hidden">
          ICP <span className="text-muted-foreground">Vault</span>
          <LottiePlayer
            animationData={animation}
            loop={true}
            style={{ width: "192px", height: "192px" }}
            className="absolute -top-4 left-24"
          />
        </div>
        <p className="text-muted-foreground text-lg font-light leading-6">
          The ICP Vault is a decentralized platform that allows users to store
          their ICP tokens in a secure and accessible manner. With the ICP
          Vault, users can easily transfer their ICP tokens to other users,
          enabling seamless and secure transactions.
        </p>
        <Statistics
          loading={loading}
          stats={isAuthenticated ? statsWithBalance : stats}
        />
        <VaultTabs points={points} />
      </div>
      <div className="w-[740px] mt-12 sticky top-5">
        <StakeDemo />
      </div>
    </div>
  );
}

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

function VaultTabs({ points }: { points: number }) {
  return (
    <div className="flex flex-col">
      <Tabs defaultValue="tab-1" className="items-center relative">
        <div className="absolute w-full border-b top-10" />
        <TabsList className="h-auto rounded-none border-b bg-transparent p-0">
          <TabsTrigger
            value="tab-1"
            className="text-base data-[state=active]:after:bg-primary relative rounded-none py-2 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            Vault
          </TabsTrigger>
          <TabsTrigger
            value="tab-2"
            className="text-base data-[state=active]:after:bg-primary relative rounded-none py-2 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            My Account
          </TabsTrigger>
        </TabsList>
        <TabsContent value="tab-1" className="py-4">
          <Chart1 />
        </TabsContent>
        <TabsContent value="tab-2" className="py-4">
          <div className="flex gap-3 my-6 text-xl">
            <p>Points: </p>
            <p>{points}</p>
          </div>
          <Chart2 />
        </TabsContent>
      </Tabs>
    </div>
  );
}
