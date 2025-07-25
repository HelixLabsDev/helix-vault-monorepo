"use client";

import DomainSelect from "./domain-select";
import ThemeToggle from "./theme-toggle";
import InternetIdentity from "./dfinity";
import { useAppKit } from "@reown/appkit/react";
import { Button } from "./button";
import { useAccount } from "wagmi";
import Link from "next/link";

export default function Header() {
  const { open } = useAppKit();
  const { address } = useAccount();
  return (
    <div className="mx-10 mt-3 px-6 rounded-2xl py-4 fixed top-0 left-0 bg-zinc-100 dark:bg-[#01100c] right-0 z-50 flex justify-between items-center">
      <div className="flex gap-14 items-center">
        <div className="flex gap-2 text-3xl font-normal items-center font-michroma">
          <Link
            href={"/"}
            className="relative cursor-pointer items-center justify-center "
          >
            <p className="text-xl font-semibold">EigenFi</p>
            <p className="absolute rounded-[5px] border border-foreground text-primary top-[6px] -right-8 text-[10px] px-[3px] pb-0.5">
              icp
            </p>
          </Link>
        </div>
        <div className="hidden md:flex ps-4 gap-6 w-full items-center justify-center">
          <DomainSelect />
          <Link
            target={"_blank"}
            href="https://docs.helixlabs.org/getting-started-on-helix/eigenfi-vaults"
          >
            <div className="text-foreground duration-300 ease-in-out text-sm hover:text-foreground/70">
              Docs
            </div>
          </Link>
          <Link href="/governance" download={true}>
            <div className="text-foreground duration-300 ease-in-out text-sm hover:text-foreground/70">
              Governance
            </div>
          </Link>
          <Link href="/litepaper.pdf" download={true}>
            <div className="text-foreground duration-300 ease-in-out text-sm hover:text-foreground/70">
              Litepaper
            </div>
          </Link>
        </div>
      </div>
      <div className="flex gap-3 items-center">
        <InternetIdentity />
        <Button onClick={() => open()}>
          {address ? address.slice(0, 6) : "Connect EVM Wallet"}
        </Button>
        <ThemeToggle />
      </div>
    </div>
  );
}
