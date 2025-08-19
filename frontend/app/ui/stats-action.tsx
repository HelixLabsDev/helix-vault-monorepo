/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { Skeleton } from "@/app/ui/skeleton";
// import { tvlType } from "../icp/page";

interface StatItemProps {
  title: string;
  value: string | number | undefined;
}

export const StatsSection = ({ tvl }: { tvl: any }) => {
  let tokenPrice = null;
  let uniqueStakers = null;
  let isLoadingPool = false;

  tokenPrice = Math.round(tvl?.assets?.tokens[0]?.tokenPrice) || 0;
  uniqueStakers = tvl?.uniqueWallets || "0";
  isLoadingPool = false;

  const stats: StatItemProps[] = React.useMemo(
    () => [
      {
        title: "Unique Stakers",
        value: uniqueStakers,
      },
      {
        title: "Token Price",
        value: tokenPrice,
      },
    ],
    [uniqueStakers, tokenPrice]
  );

  if (isLoadingPool) {
    return (
      <section className="w-full">
        <ul className="flex flex-col gap-4">
          {Array(4)
            .fill(0)
            .map((_, i) => (
              <li className="basis-1/3 text-foreground/60" key={i}>
                <Skeleton className="h-4 w-full" />
              </li>
            ))}
        </ul>
      </section>
    );
  }

  return (
    <section className="w-full">
      <ul className="flex flex-col gap-4">
        {stats.map((stat) => (
          <div key={stat.title} className="flex justify-between">
            <p className="text-foreground/70">{stat.title}</p>
            <p className="text-lg">{stat.value}</p>
          </div>
        ))}
      </ul>
    </section>
  );
};
