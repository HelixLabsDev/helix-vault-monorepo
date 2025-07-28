"use client";

import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/app/ui/dialog";
import { Button } from "@/app/ui/button";
import { useAccount } from "wagmi";
import { useStore } from "@/lib/store";
import { useState, useEffect } from "react";
import { InternetIdentityConnect } from "./connect-identity";
import { ConnectButton as EvmConnectButton } from "./connect-button";
import { CheckCircle2, Loader2, ShieldCheck, Wallet } from "lucide-react";
import { Badge } from "@/app/ui/badge";

export default function LoginStepperDialog() {
  const { isAuthenticated } = useStore();
  const { isConnected, chain } = useAccount();
  const [step, setStep] = useState<1 | 2>(1);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (isAuthenticated && step === 1) {
      setStep(2);
    }
  }, [isAuthenticated, step]);
  const isFullyConnected = isAuthenticated && isConnected;

  const renderTriggerButton = () => {
    if (isFullyConnected) {
      return (
        <Button variant="outline" className="flex gap-2 items-center">
          <Wallet className="w-4 h-4 text-green-500" />
          <Badge variant="secondary" className="text-xs">
            ICP
          </Badge>
          {chain && (
            <Badge variant="secondary" className="text-xs">
              {chain.name}
            </Badge>
          )}
        </Button>
      );
    }

    if (isAuthenticated && !isConnected) {
      return (
        <Button variant="default" className="gap-2">
          <ShieldCheck className="w-4 h-4 text-blue-500" />
          ICP Connected... (waiting EVM)
        </Button>
      );
    }

    if (!isAuthenticated && isConnected) {
      return (
        <Button variant="default" className="gap-2">
          <Wallet className="w-4 h-4 text-green-500" />
          Wallet Connected... (waiting ICP)
        </Button>
      );
    }

    return <Button>Login</Button>;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{renderTriggerButton()}</DialogTrigger>

      <DialogContent className="max-w-sm w-full">
        <DialogHeader>
          <DialogTitle>Wallet Login</DialogTitle>
          <DialogDescription>
            Please complete both steps to access the platform
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 mt-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <ShieldCheck className="w-4 h-4 text-blue-500" />
            Connect Internet Identity
          </div>
          <InternetIdentityConnect className="w-full" />
        </div>

        <div className="flex flex-col gap-4 mt-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Wallet className="w-4 h-4 text-green-500" />
            Connect EVM Wallet
          </div>
          <EvmConnectButton className="w-full" />
        </div>

        <div className="mt-6 space-y-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <CheckCircle2 className="text-green-500 w-4 h-4" />
            ) : step === 1 ? (
              <Loader2 className="animate-spin w-4 h-4" />
            ) : (
              <CheckCircle2 className="opacity-30 w-4 h-4" />
            )}
            Step 1: Internet Identity
          </div>
          <div className="flex items-center gap-2">
            {isConnected ? (
              <CheckCircle2 className="text-green-500 w-4 h-4" />
            ) : step === 2 ? (
              <Loader2 className="animate-spin w-4 h-4" />
            ) : (
              <CheckCircle2 className="opacity-30 w-4 h-4" />
            )}
            Step 2: EVM Wallet
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
