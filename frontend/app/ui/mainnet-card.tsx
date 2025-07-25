/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { Badge } from "@/app/ui/badge";
import { GovernanceProposal } from "@/declarations/core_vault_backend/core_vault_backend.did";
import { createActor } from "@/declarations/helix_vault_backend";
import { useStore } from "@/lib/store";
import { convertNatToNumber } from "@/lib/utils";
import { HttpAgent } from "@dfinity/agent";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

export default function MainnetCard({ data }: { data: GovernanceProposal[] }) {
  const { setVaultAddress, setActor, authClient, actor } = useStore();
  const [balance, setBalance] = useState<number>(0);

  const fetchBalances = useCallback(async () => {
    if (!actor) {
      console.error("Missing required dependencies for fetching balances");
      return;
    }

    try {
      const vaultBalance = await actor.get_vault_balance();
      setBalance(convertNatToNumber(vaultBalance.toString()));
    } catch (error) {
      console.error("Error fetching balances:", error);
    }
  }, [actor]);

  useEffect(() => {
    if (actor) {
      fetchBalances();
    }
  }, [actor, fetchBalances]);

  return data.map((el, id) => {
    return (
      <Link
        prefetch
        key={id}
        href="/icp"
        className="p-8 group rounded-4xl border flex flex-col gap-6 cursor-pointer transition-all col-span-1"
      >
        <div
          className="md:p-0 p-6"
          onClick={() => {
            const principal = el.executed_vault_id[0]; // Principal type
            const readable = principal?.toText();
            console.log("principal", readable);
            setVaultAddress(readable ?? "");

            const identity: any = authClient?.getIdentity();
            const agent = new HttpAgent({
              identity,
              host: "http://localhost:4943",
            });

            const actor = createActor(readable ?? "", { agent });
            setActor(actor);
          }}
        >
          <div className="flex items-center justify-between w-full py-2">
            <div className="flex items-center duration-150 ease-in-out gap-4">
              <picture>
                <img
                  src="/helix.png"
                  alt="icp"
                  width={24}
                  height={11.5}
                  className="h-auto w-8 ms-2"
                />
              </picture>
              <div className="relative cursor-pointer items-center justify-center">
                <p className="text-2xl font-semibold font-michroma">EigenFi</p>
              </div>
            </div>
            <div>
              <Badge variant={"outline"}>
                <div className="w-1 h-1 animate-pulse bg-primary rounded-full" />
                Mainnet
              </Badge>
            </div>
          </div>
          <div className="py-4 px-6 bg-zinc-100 dark:bg-black rounded-2xl flex flex-col gap-3">
            <div className="flex justify-between border-b py-6">
              <div className="w-1/2 border-r flex flex-col gap-2">
                <p className="text-foreground/70 text-base">Vault</p>{" "}
                <p> {el.title}</p>
              </div>
              <div className="flex flex-col justify-between">
                <p className="text-foreground/70 text-base">Total Deposits</p>{" "}
                <div className="text-end w-full text-xl">{balance}</div>
              </div>
            </div>

            {/* <div className="flex justify-between">
              <p className="text-foreground/70 text-base">Apr</p>{" "}
              <div className="text-lg">
                <Skeleton className="h-4 w-24" />
              </div>
            </div> */}
            <div className="flex justify-between">
              <p className="text-foreground/70 text-base">Network</p>{" "}
              <picture className="flex items-center border rounded-full p-1 w-7 h-7 bg-primary">
                <img
                  src="/icp-logo.png"
                  alt="icp"
                  width={24}
                  height={11.5}
                  className="h-auto w-6 invert"
                />
              </picture>
            </div>
          </div>
        </div>
      </Link>
    );
  });
}
