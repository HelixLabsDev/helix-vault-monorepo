"use client";

import Link from "next/link";
import { ModeToggle } from "./theme-toggle";
import { Logo } from "./logo";
import LoginDialog from "./connect-wallets";

export default function Header() {
  return (
    <div className="mx-auto my-8 py-4 px-6 fixed top-0 bg-zinc-50 dark:bg-[#01100c] z-50 flex justify-between items-center max-w-5xl w-full">
      <div className="flex gap-6 items-center">
        <Link href={"/"} className="h-4 w-auto">
          <Logo />
        </Link>
        <div className="hidden md:flex font-medium text-sm gap-6 w-full items-center justify-center">
          <Link href="/governance" download={true}>
            <div className="text-foreground duration-300 ease-in-out hover:text-foreground/70">
              Governance
            </div>
          </Link>
          <Link
            target={"_blank"}
            href="https://docs.helixlabs.org/getting-started-on-helix/eigenfi-vaults"
          >
            <div className="text-foreground duration-300 ease-in-out hover:text-foreground/70">
              Docs
            </div>
          </Link>
          <Link href="/litepaper.pdf" download={true}>
            <div className="text-foreground duration-300 ease-in-out hover:text-foreground/70">
              Litepaper
            </div>
          </Link>
        </div>
      </div>
      <div className="flex gap-3 items-center">
        <LoginDialog />
        <ModeToggle />
      </div>
    </div>
  );
}
