"use client";

import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/app/ui/card";
import { Input } from "@/app/ui/input";
import { ArrowDownUpIcon, Settings } from "lucide-react";
import { Button } from "@/app/ui/button";
import { InfiniteSlider } from "@/app/ui/infinite-slider";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/app/ui/select";
import { useState } from "react";
import { GridPattern } from "@/app/ui/grid-pattern";
import { cn } from "@/lib/utils";

const chains = [
  { name: "ICP", icon: "/icons/icp.png" },
  { name: "Ethereum", icon: "/icons/eth.png" },
  { name: "Cardano", icon: "/icons/cardano.png" },
  { name: "HyperEVM", icon: "/icons/hl.png" },
  { name: "BNB Chain", icon: "/icons/bnb.png" },
];

export default function BridgePage() {
  const [fromChain, setFromChain] = useState(chains[0].name);
  const [toChain, setToChain] = useState(chains[1].name);

  return (
    <div className="min-h-screen flex gap-8 items-start font-sans justify-center p-4">
      <Card className="w-full max-w-xl text-white shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">
            Bridge Coming Soon...
          </CardTitle>
          <CardAction>
            <Settings className="w-5 h-5" />
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-gray-400">Deposit</span>
          </div>
          <div className="flex items-center bg-primary/5 rounded-lg mb-4">
            <Input
              placeholder="0"
              type="number"
              className="bg-[#23232] px-4 py-8 text-2xl font-semibold w-8/12"
            />
            <div className="flex-1 flex items-center justify-end gap-2">
              <Select value={fromChain} onValueChange={setFromChain}>
                <SelectTrigger className="bg-transparent border-0 px-3 w-full py-8 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {chains.map((chain) => (
                    <SelectItem key={chain.name} value={chain.name}>
                      <picture className="flex items-center gap-2">
                        <img
                          src={chain.icon}
                          alt={chain.name}
                          className="h-6 w-6"
                        />
                        <p className="text-md font-semibold"> {chain.name}</p>
                      </picture>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div
            className="flex justify-center cursor-pointer w-6 mx-auto"
            onClick={() => {
              setTimeout(() => {
                setFromChain(toChain);
                setToChain(fromChain);
              }, 400);
            }}
          >
            <div className="bg-primary/5 rounded-lg p-2">
              <ArrowDownUpIcon />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Receive</span>
          </div>
          <div className="flex items-center bg-primary/5 rounded-lg mb-6">
            <Input
              placeholder="0"
              type="number"
              className="bg-[#23232] px-4 py-8 text-2xl font-semibold w-8/12"
            />
            <div className="flex-1 flex items-center justify-end gap-2">
              <Select value={toChain} onValueChange={setToChain}>
                <SelectTrigger className="bg-transparent border-0 px-3 w-full py-8 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {chains.map((chain) => (
                    <SelectItem key={chain.name} value={chain.name}>
                      <picture className="flex items-center gap-2">
                        <img
                          src={chain.icon}
                          alt={chain.name}
                          className="h-6 w-6"
                        />
                        <p className="text-md font-semibold">{chain.name}</p>
                      </picture>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mb-4">
            <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
              <span>₿ Refund Address</span>
            </div>
            <Input
              placeholder="Refund address"
              className="bg-primary/5 border-0"
            />
          </div>
          {/* <div className="mb-6">
            <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
              <span>✦ Destination Address</span>
            </div>
            <Input
              placeholder="Destination address"
              className="bg-primary/5 border-0"
            />
          </div> */}

          <Button
            disabled
            className="w-full font-semibold bg-primary text-black text-lg h-10 mt-4f"
          >
            Bridge
          </Button>
        </CardContent>
      </Card>
      <Card className="w-full max-w-md relative">
        <GridPattern
          squares={[
            [4, 4],
            [5, 1],
            [8, 2],
            [5, 3],
            [5, 5],
            [10, 10],
            [12, 15],
            [15, 10],
            [10, 15],
            [15, 10],
            [10, 15],
            [15, 10],
          ]}
          className={cn(
            "[mask-image:radial-gradient(200px_circle_at_center,black,transparent)]",
            "inset-x-0 inset-y-[5%] h-[90%] skew-y-12"
          )}
        />
        <CardHeader>
          <div className="my-8 relative overflow-hidden">
            <InfiniteSlider className="h-16">
              {chains.map((chain) => (
                <picture key={chain.name}>
                  <img
                    src={chain.icon}
                    alt={chain.name}
                    className="h-12 bg-background w-12 object-contain p-2 border-border border rounded-md"
                  />
                </picture>
              ))}
            </InfiniteSlider>
          </div>
          <div className="mb-12 flex flex-col gap-2">
            <CardTitle className="text-xl font-semibold text-center">
              Cross-Chain Yield
            </CardTitle>
            <CardDescription className="text-center ">
              <span className="font-bold">Excellent yields.</span> Emphasis on{" "}
              <span className="font-bold">cross-chain</span>.
            </CardDescription>
          </div>
        </CardHeader>
        <CardFooter>
          <div className="flex justify-between text-xs w-full">
            <span>Native assets</span>
            <span>Better yields</span>
            <span>No wallet needed</span>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
