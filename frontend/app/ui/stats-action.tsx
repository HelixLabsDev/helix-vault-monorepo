import React from "react";
import { Skeleton } from "@/app/ui/skeleton";

interface StatItemProps {
  title: string;
  value: string | number | undefined;
}

export const StatsSection = () => {
  let stakingRatio = null;
  let apr = null;
  let rewardReleased = null;
  let uniqueStakers = null;
  let isLoadingPool = false;

  stakingRatio = "10";
  apr = "14";
  rewardReleased = "100";
  uniqueStakers = "15";
  isLoadingPool = false;

  const stats: StatItemProps[] = React.useMemo(
    () => [
      {
        title: "Unique Stakers",
        value: uniqueStakers,
      },
      {
        title: "Protocol Staking Ratio",
        value: `${stakingRatio}%`,
      },
      {
        title: "Rewards Released So Far",
        value: rewardReleased,
      },
      {
        title: "Real Time APR",
        value: `${apr}%`,
      },
    ],
    [uniqueStakers, stakingRatio, rewardReleased, apr]
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
