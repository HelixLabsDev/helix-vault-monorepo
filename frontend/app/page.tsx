"use client";

import GradientText from "@/app/ui/gradient-text";
import MainnetCard from "@/app/ui/mainnet-card";
import VerticalBarsNoise from "@/app/ui/noise-bg";
import { useStoreCore } from "@/lib/storeCoreVault";
import { useEffect, useState } from "react";
import { GovernanceProposal } from "@/declarations/core_vault_backend/core_vault_backend.did";

export default function Home() {
  //   function formatNumber(num: number): string {
  //     if (num >= 1_000_000_000_000) {
  //       return (num / 1_000_000_000_000).toFixed(1).replace(/\.0$/, "") + "T";
  //     } else if (num >= 1_000_000_000) {
  //       return (num / 1_000_000_000).toFixed(1).replace(/\.0$/, "") + "B";
  //     } else if (num >= 1_000_000) {
  //       return (num / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  //     } else if (num >= 1_000) {
  //       return (num / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  //     }
  //     return num.toString();
  //   }

  const { actorCore } = useStoreCore();

  const [data2, setData2] = useState<GovernanceProposal[]>();
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const dat = await actorCore?.list_proposals();
      if (dat !== undefined) {
        setData2(
          dat.filter((el, id) => {
            console.log("object", Object.keys(el.status)[id]);
            return Object.keys(el.status)[0] == "Executed";
          })
        );
      }
      setLoading(false);
    };

    fetch();
  }, [actorCore]);

  return (
    <div className="md:p-12 flex flex-col gap-6">
      <div className="bg-background rounded-md w-full lg:flex-row flex-col flex gap-6 lg:gap-12 justify-between md:p-6">
        <div className="w-full xl:w-7/12 p-8 rounded-sm bg-background flex flex-col gap-6 justify-around">
          <GradientText>
            <p className="text-6xl font-light">ICP Vault</p>
          </GradientText>
          <p className="text-muted-foreground text-base md:text-lg font-light leading-6">
            The ICP Vault is a decentralized platform that allows users to store
            their ICP tokens in a secure and accessible manner. With the ICP
            Vault, users can easily transfer their ICP tokens to other users,
            enabling seamless and secure transactions.
          </p>
          <div className="flex items-center gap-2 justify-between">
            <div className="flex flex-col gap-2 justify-between">
              <p className="text-lg text-foreground/90">Total Amount Locked</p>
              <div className="text-5xl">
                10000
                {/* {isLoadingPool || isLoadingHst ? (
                  <Skeleton className="h-8 w-32" />
                ) : (
                  formatNumber(
                    parseFloat(totalStaked.replace(/,/g, "")) +
                      parseFloat(hstStaked.replace(/,/g, ""))
                  )
                )} */}
              </div>
            </div>{" "}
          </div>
        </div>
        <VerticalBarsNoise />
      </div>

      <div className="bg-background rounded-md w-full gap-6 md:p-6 grid grid-cols-2">
        {loading ? "loading...." : <MainnetCard data={data2 ?? []} />}
      </div>
    </div>
  );
}
