/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { Badge } from "@/app/ui/badge";
import { createActor } from "@/declarations/helix_vault_backend";
import { useStore } from "@/lib/store";
import { HttpAgent } from "@dfinity/agent";
import Link from "next/link";

export default function MainnetCard({ data }: { data: any[] }) {
  const { setVaultAddress, setActor, authClient } = useStore();

  return data.map((el, id) => {
    return (
      <Link
        prefetch
        key={id}
        href="/icp"
        className="p-4 md:p-8 group border-2 flex flex-col gap-6 cursor-pointer transition-all col-span-1"
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
              host: "https://ic0.app",
            });

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
              <Badge variant={"outline"}>
                <div className="w-1 h-1 animate-pulse bg-primary rounded-full" />
                Testnet
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
                  {el.lockedAmount.toLocaleString()}
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
