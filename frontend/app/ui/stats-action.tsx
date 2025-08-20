/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { Skeleton } from "@/app/ui/skeleton";

interface StatItemProps {
  title: string;
  value: string | number | undefined;
}

export const StatsSection = ({ tvl, fee }: { tvl: any; fee: any }) => {
  let tokenPrice = null;
  let uniqueStakers = null;
  let isLoadingPool = false;

  if (!tvl) {
    isLoadingPool = true;
  } else if (tvl?.tokenStats?.length > 0) {
    tokenPrice = tvl.tokenStats[0].tokenPrice;
    uniqueStakers = tvl.uniqueWallets;
  }
  const stats: StatItemProps[] = React.useMemo(
    () => [
      {
        title: "Unique Stakers",
        value: uniqueStakers ?? 0,
      },
      {
        title: "Token Price",
        value: tokenPrice ?? 0,
      },
      {
        title: "Fee",
        value: fee ?? 0,
      },
    ],
    [uniqueStakers, tokenPrice, fee]
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
