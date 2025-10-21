/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { Badge } from "@/app/ui/badge";
import { createActor } from "@/declarations/helix_vault_backend";
import { useStore } from "@/lib/store";
import { HttpAgent } from "@dfinity/agent";
import Link from "next/link";
import { MouseEvent, useMemo } from "react";
import { getNetworkConfig } from "@/lib/constant";

export default function MainnetCard({ data }: { data: any[] }) {
  const { setVaultAddress, setActor, authClient } = useStore();
  const networkConfig = useMemo(() => getNetworkConfig(), []);

  return data.map((el, id) => {
    const statusKey =
      typeof el.statusKey === "string"
        ? el.statusKey
        : Object.keys(el.status ?? {})[0] ?? "Unknown";
    const statusLabel = statusKey.replace(/([A-Z])/g, " $1").trim();
    const vaultPrincipal = el.executed_vault_id?.[0];
    const readable =
      el.executedVaultText || vaultPrincipal?.toText?.() || undefined;
    const hasVault = Boolean(readable);
    const formattedLockedAmount = Number(el.lockedAmount ?? 0).toLocaleString();
    const cardClasses = [
      "p-4 md:p-8 group border-2 flex flex-col gap-6 transition-all col-span-1",
      hasVault ? "cursor-pointer" : "cursor-not-allowed opacity-80",
    ].join(" ");

    return (
      <Link
        prefetch
        key={id}
        href="/icp"
        aria-disabled={!hasVault}
        className={cardClasses}
      >
        <div
          className="md:p-0 p-6"
          onClick={(event: MouseEvent) => {
            if (!hasVault) {
              event.preventDefault();
              return;
            }

            setVaultAddress(readable ?? "");

            const identity: any = authClient?.getIdentity();
            const isLocal = networkConfig.id === "local";
            const agent = new HttpAgent({
              identity,
              host: networkConfig.host,
            });
            if (isLocal) {
              agent
                .fetchRootKey()
                .catch((err) =>
                  console.error("Failed to fetch local root key", err)
                );
            }

            const actor = createActor(readable ?? "", { agent });
            setActor(actor);
          }}
        >
          <div className="flex items-center justify-between w-full py-2 mb-2">
            <div className="flex items-center duration-150 ease-in-out gap-4">
              <picture>
                <img
                  src="/helix.png"
                  alt="icp"
                  width={24}
                  height={11.5}
                  className="h-auto w-6 ms-2"
                />
              </picture>
              <div className="relative cursor-pointer items-center justify-center">
                <p className="text-2xl font-semibold">Helix Vault</p>
              </div>
            </div>
            <div>
              <Badge variant={hasVault ? "outline" : "secondary"}>
                <div className="w-1 h-1 animate-pulse bg-primary rounded-full" />
                {statusLabel || "Pending"}
              </Badge>
            </div>
          </div>
          <div className="py-4 px-6 bg-zinc-200 dark:bg-black flex flex-col gap-3">
            <div className="flex justify-between border-b py-6">
              <div className="w-1/2 border-r flex flex-col gap-2">
                <p className="text-foreground/70 text-base">Vault</p>{" "}
                <p> {el.title}</p>
              </div>
              <div className="flex flex-col justify-between">
                <p className="text-foreground/70 text-base">Total Deposits</p>{" "}
                <div className="text-end w-full text-xl">
                  {formattedLockedAmount}
                </div>
              </div>
            </div>

            {/* <div className="flex justify-between">
              <p className="text-foreground/70 text-base">Apr</p>{" "}
              <div className="text-lg">
                <Skeleton className="h-4 w-24" />
              </div>
            </div> */}
            <div className="flex justify-between">
              <p className="text-foreground/70 text-base">
                {hasVault ? "Vault Principal" : "Awaiting Vault Deployment"}
              </p>{" "}
              <picture className="flex items-center border rounded-full p-1 w-7 h-7 bg-primary">
                {hasVault ? (
                  <img
                    src="/icp-logo.png"
                    alt="icp"
                    width={24}
                    height={11.5}
                    className="h-auto w-6 invert"
                  />
                ) : (
                  <span className="text-[10px] font-semibold text-white">
                    Soon
                  </span>
                )}
              </picture>
            </div>
            {hasVault && (
              <div className="text-xs text-foreground/70 break-all">
                {readable}
              </div>
            )}
          </div>
        </div>
      </Link>
    );
  });
}
