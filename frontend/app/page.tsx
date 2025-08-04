/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import GradientText from "@/app/ui/gradient-text";
import MainnetCard from "@/app/ui/mainnet-card";
import VerticalBarsNoise from "@/app/ui/noise-bg";
import { useStoreCore } from "@/lib/storeCoreVault";
import { useEffect, useState } from "react";
// import { GovernanceProposal } from "@/declarations/core_vault_backend/core_vault_backend.did";
import { Skeleton } from "./ui/skeleton";
import { _users, _usersTVL } from "@/lib/axios/_user_detail";
// import OnboardCard from "./ui/onboard";
//
export default function Home() {
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

  const { actorCore } = useStoreCore();

  const [data2, setData2] = useState<any>();
  const [loading, setLoading] = useState<boolean>(false);
  const [tvl, setTvl] = useState<any>({ totalValueLockedUSD: 0 });

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const dat = await actorCore?.list_proposals();

        if (!dat || dat.length === 0) return;

        const vaultId = dat[0].executed_vault_id?.[0];
        const vaultText = vaultId?.toText?.() || "N/A";
        console.log("executed_vault_id:", vaultText);

        const usersData = await _users();

        const executed = dat.filter((el) => {
          return Object.keys(el.status)[0] === "Executed";
        });

        // Merge with user token data
        const enrichedProposals = executed.map((proposal) => {
          const vaultTextId = proposal.executed_vault_id?.[0]?.toText?.() || "";

          // Search matching user + token
          let lockedAmount = 0;
          usersData.data.forEach((user: any) => {
            user.tokenBalances.forEach((token: any) => {
              if (token.tokenId === vaultTextId) {
                lockedAmount += token.lockedAmount;
              }
            });
          });

          return {
            ...proposal,
            lockedAmount, // attach matched lockedAmount (or 0)
          };
        });

        console.log("enrichedProposals:", enrichedProposals);
        setData2(enrichedProposals);
      } catch (e) {
        console.error("Fetch failed:", e);
      } finally {
        setLoading(false);
      }
    };

    fetch();
  }, [actorCore]);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const usersData = await _usersTVL();
        console.log("usersData", usersData);
        setTvl(usersData.data);
      } catch (error) {
        console.error("Error fetching users:", error);
      } finally {
        setLoading(false);
      }
    };

    fetch();
  }, [actorCore]);

  return (
    <div className="flex flex-col justify-center items-center">
      <div className="w-full flex gap-8 justify-between py-12">
        <div className="w-full xl:w-7/12 flex flex-col gap-6 justify-around">
          <GradientText>
            <p className="text-6xl font-light">ICP Vault</p>
          </GradientText>
          <p className="text-muted-foreground text-base md:text-lg font-light leading-6 text-justify">
            Helix Vault is a cross-chain liquid staking platform that lets you
            stake hICP on the Internet Computer and receive hstICP on Ethereum —
            unlocking DeFi access, yield, and seamless 1:1 redemption. Fully
            governed on-chain with modular upgradeability.
          </p>
          <div className="flex items-center gap-2 justify-between">
            <div className="flex flex-col gap-2 justify-between">
              <p className="text-lg text-foreground/90">Total Value Locked</p>
              <div className="text-5xl">
                {loading ? (
                  <Skeleton className="h-8 w-32" />
                ) : (
                  `$${formatNumber(tvl.totalValueLockedUSD)}`
                )}
              </div>
            </div>{" "}
          </div>
        </div>
        <VerticalBarsNoise />
      </div>

      {/* <OnboardCard /> */}

      <div className="w-full gap-6 grid grid-cols-1 md:grid-cols-2 py-12">
        <MainnetCard data={data2 ?? []} />
      </div>
    </div>
  );
}
