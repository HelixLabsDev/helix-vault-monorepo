"use client";

import Link from "next/link";
import ThemeToggle from "./theme-toggle";
import { Logo } from "./logo";
import LoginDialog from "./connect-wallets";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export default function Header() {
  const [menuState, setMenuState] = useState(false);
  return (
    <div className="mx-auto my-8 py-4 px-6 fixed top-0 bg-zinc-50 dark:bg-[#01100c] z-50 flex justify-between items-center max-w-5xl w-full">
      <div
        className="flex gap-6 items-center fixed z-20 w-full px-2"
        data-state={menuState && "active"}
      >
        <button
          onClick={() => setMenuState(!menuState)}
          aria-label={menuState == true ? "Close Menu" : "Open Menu"}
          className="relative z-20 -m-2.5 -mr-4 block cursor-pointer p-2.5 md:hidden"
        >
          <Menu className="in-data-[state=active]:rotate-180 in-data-[state=active]:scale-0 in-data-[state=active]:opacity-0 m-auto size-6 duration-200" />
          <X className="in-data-[state=active]:rotate-0 in-data-[state=active]:scale-100 in-data-[state=active]:opacity-100 absolute inset-0 m-auto size-6 -rotate-180 scale-0 opacity-0 duration-200" />
        </button>
        <Link href={"/"}>
          <Logo />
        </Link>
        <div className="hidden md:flex font-medium text-sm gap-6 w-full items-center justify-center">
          <Link href="/governance">
            <div className="text-foreground duration-300 ease-in-out hover:text-foreground/70">
              Governance
            </div>
          </Link>
          <Link href="/bridge">
            <div className="text-foreground duration-300 ease-in-out hover:text-foreground/70">
              Bridge
            </div>
          </Link>
          <Link href="/faucet">
            <div className="text-foreground duration-300 ease-in-out hover:text-foreground/70">
              Faucet
            </div>
          </Link>
          {/* <Link href="/litepaper.pdf" download={true}>
            <div className="text-foreground duration-300 ease-in-out hover:text-foreground/70">
              Litepaper
            </div>
          </Link> */}
        </div>

        <div
          className={cn(
            `absolute md:hidden bg-background top-12 flex flex-col font-medium text-sm gap-6 w-full items-start p-6 justify-center rounded-md shadow-lg z-20`
          )}
        >
          <Link href="/governance">
            <div className="text-foreground duration-300 ease-in-out hover:text-foreground/70">
              Governance
            </div>
          </Link>
          <Link href="/bridge">
            <div className="text-foreground duration-300 ease-in-out hover:text-foreground/70">
              Bridge
            </div>
          </Link>
          <Link href="/faucet">
            <div className="text-foreground duration-300 ease-in-out hover:text-foreground/70">
              Faucet
            </div>
          </Link>
          {/* <Link href="/litepaper.pdf" download={true}>
            <div className="text-foreground duration-300 ease-in-out hover:text-foreground/70">
              Litepaper
            </div>
          </Link> */}
        </div>
      </div>
      <div className="flex gap-3 items-center">
        <LoginDialog />
        <ThemeToggle />
      </div>
    </div>
  );
}
