/* eslint-disable @next/next/no-img-element */
"use client";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/app/ui/select";
import Image from "next/image";
import { useRouter } from "next/navigation";
import React from "react";
import { FaEthereum, FaBtc } from "react-icons/fa6";
import { SiBinance, SiCardano } from "react-icons/si";

export default function DomainSelect() {
  const router = useRouter();

  const handleValueChange = (value: string) => {
    const selectedDomain = domains
      .flatMap((category) => category.items)
      .find((item) => item.name === value);
    if (selectedDomain?.link) {
      router.push(selectedDomain.link);
    }
  };

  return (
    <div>
      <Select defaultValue="ICP" onValueChange={handleValueChange}>
        <SelectTrigger className="w-[140px] focus-visible:ring-0 flex border-0">
          <SelectValue placeholder="Select a domain" />
        </SelectTrigger>
        <SelectContent className="dark:bg-[#01100c]">
          {mainnet.map((domain) => (
            <SelectGroup key={domain.category}>
              <SelectLabel className="text-foreground/70">
                {domain.category}
              </SelectLabel>
              {domain.items.map((item) => (
                <SelectItem key={item.id} value={item.name}>
                  <div className="flex items-center gap-1.5 text-foreground">
                    {item.icon} {item.name}
                  </div>
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

const mainnet = [
  {
    category: "Mainnet",
    items: [
      {
        id: 6,
        name: "Movement",
        link: "https://movement.eigenfi.io",
        icon: (
          <Image
            src={"/movement.svg"}
            className="w-4 h-4 dark:invert-0 invert"
            alt="movement"
            width={20}
            height={20}
          />
        ),
      },
      {
        id: 9,
        name: "ICP",
        link: "https://icp.eigenfi.io",
        icon: (
          <img
            src={"/icp-logo.png"}
            className="w-5 h-auto dark:invert-0 invert"
            alt="icp"
            width={20}
            height={20}
          />
        ),
      },
    ],
  },
];

const domains = [
  {
    category: "Non EVM",
    items: [
      {
        id: 9,
        name: "ICP",
        link: "https://icp.eigenfi.io",
        icon: (
          <img
            src={"/icp-logo.png"}
            className="w-5 h-auto dark:invert-0 invert"
            alt="icp"
            width={20}
            height={20}
          />
        ),
      },
      {
        id: 2,
        name: "Cardano",
        link: "https://cardano.eigenfi.io",
        icon: <SiCardano className="w-4 h-4" />,
      },
    ],
  },
  {
    category: "MVM",
    items: [
      {
        id: 6,
        name: "Movement",
        link: "https://movement.eigenfi.io",
        icon: (
          <Image
            src={"/movement.svg"}
            className="w-4 h-4 dark:invert-0 invert"
            alt="movement"
            width={20}
            height={20}
          />
        ),
      },
      {
        id: 5,
        name: "Aptos",
        link: "https://aptos.eigenfi.io",
        icon: (
          <Image
            src={"/aptos.svg"}
            className="w-4 h-4 dark:invert-0 invert"
            alt="aptos"
            width={20}
            height={20}
          />
        ),
      },
    ],
  },
  {
    category: "EVM",
    items: [
      {
        id: 1,
        name: "Ethereum",
        link: "https://ethereum.eigenfi.io",
        icon: <FaEthereum />,
      },
      {
        id: 3,
        name: "BNB Chain",
        link: "https://bnb.eigenfi.io",
        icon: <SiBinance className="w-4 h-4" />,
      },
      {
        id: 4,
        name: "BitLayer",
        link: "https://bitlayer.eigenfi.io/",
        icon: <FaBtc className="w-4 h-4" />,
      },
    ],
  },
];
