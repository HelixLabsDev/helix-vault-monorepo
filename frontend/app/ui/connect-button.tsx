"use client";

import { useAppKit } from "@reown/appkit/react";
import { useAccount } from "wagmi";
import { Button } from "@/app/ui/button";
import { Badge } from "@/app/ui/badge";

import { ChevronDown } from "lucide-react";
interface ConnectButtonProps {
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg";
  className?: string;
}

export function ConnectButton({
  variant = "outline",
  size = "default",
  className,
}: ConnectButtonProps) {
  const { open } = useAppKit();
  const { address, isConnected, chain, isConnecting } = useAccount();

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  if (isConnecting) {
    return (
      <Button
        onClick={() => open()}
        variant={variant}
        size={size}
        className={className}
      >
        Loading...
      </Button>
    );
  }

  if (!isConnected) {
    return (
      <Button
        onClick={() => open()}
        variant={variant}
        size={size}
        className={className}
      >
        Connect EVM Wallet
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      onClick={() => open()}
      className={`${className} flex items-center space-x-2`}
    >
      <div className="flex items-center space-x-2">
        <span className="font-mono text-sm">{formatAddress(address!)}</span>
        {chain && (
          <Badge variant="secondary" className="text-xs">
            {chain.name}
          </Badge>
        )}
      </div>
      <ChevronDown className="h-4 w-4" />
    </Button>
  );
}
