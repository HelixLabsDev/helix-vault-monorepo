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
import { Badge } from "@/app/ui/badge";
import { useAccount } from "wagmi";
import { useStore } from "@/lib/store";
import { useState, useEffect, useMemo } from "react";
import { InternetIdentityConnect } from "./connect-identity";
import { ConnectButton as EvmConnectButton } from "./connect-button";
import { CheckCircle2, Copy, Loader2, ShieldCheck, Wallet } from "lucide-react";
import { toast } from "sonner";

type Step = 1 | 2;

function truncatePrincipal(p?: string, left = 5, right = 5) {
  if (!p) return "";
  if (p.length <= left + right + 3) return p;
  return `${p.slice(0, left)}...${p.slice(-right)}`;
}

export default function LoginStepperDialog() {
  const { isAuthenticated, principal } = useStore();
  const { isConnected, chain } = useAccount();

  const [step, setStep] = useState<Step>(1);
  const [open, setOpen] = useState(false);

  const isFullyConnected = isAuthenticated && isConnected;

  // Advance/reset steps based on auth state
  useEffect(() => {
    if (isAuthenticated) setStep(2);
    else setStep(1);
  }, [isAuthenticated]);

  // Auto-close when both are connected
  useEffect(() => {
    if (isFullyConnected && open) setOpen(false);
  }, [isFullyConnected, open]);

  const handleCopyPrincipal = async () => {
    try {
      if (!principal) return;
      // Clipboard may not be available in all contexts
      await navigator.clipboard?.writeText(principal);
      toast.success("Principal copied");
    } catch {
      toast.error("Could not copy");
    }
  };

  const TriggerButton = useMemo(() => {
    if (isFullyConnected) {
      return (
        <Button variant="outline" className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-green-500" />
          <Badge variant="secondary" className="text-[10px]">
            ICP
          </Badge>
          {chain?.name && (
            <Badge variant="secondary" className="text-[10px]">
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
          ICP Connected… (waiting EVM)
        </Button>
      );
    }
    if (!isAuthenticated && isConnected) {
      return (
        <Button variant="default" className="gap-2">
          <Wallet className="w-4 h-4 text-green-500" />
          Wallet Connected… (waiting ICP)
        </Button>
      );
    }
    return <Button>Login</Button>;
  }, [isFullyConnected, isAuthenticated, isConnected, chain?.name]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{TriggerButton}</DialogTrigger>

      <DialogContent className="max-w-sm w-full">
        <DialogHeader>
          <DialogTitle>Wallet Login</DialogTitle>
          <DialogDescription>
            Please complete both steps to access the platform.
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Internet Identity */}
        <div className="flex flex-col gap-3 mt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              <ShieldCheck className="w-4 h-4 text-blue-500" />
              <span>Connect Internet Identity</span>
            </div>
            {isAuthenticated && (
              <button
                type="button"
                onClick={handleCopyPrincipal}
                className="inline-flex items-center gap-1 text-xs text-green-600 hover:underline"
                title="Copy principal"
              >
                <Copy className="w-3 h-3" />
                {truncatePrincipal(principal ?? "")}
              </button>
            )}
          </div>

          <InternetIdentityConnect className="w-full" />
        </div>

        {/* Step 2: EVM Wallet */}
        <div className="flex flex-col gap-3 mt-5">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Wallet className="w-4 h-4 text-green-500" />
            <span>Connect EVM Wallet</span>
          </div>
          <EvmConnectButton className="w-full" />
        </div>

        {/* Progress indicators */}
        <div className="mt-6 space-y-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <CheckCircle2 className="text-green-500 w-4 h-4" />
            ) : step === 1 ? (
              <Loader2 className="animate-spin w-4 h-4" />
            ) : (
              <CheckCircle2 className="opacity-30 w-4 h-4" />
            )}
            <span>Step 1: Internet Identity</span>
          </div>

          <div className="flex items-center gap-2">
            {isConnected ? (
              <CheckCircle2 className="text-green-500 w-4 h-4" />
            ) : step === 2 ? (
              <Loader2 className="animate-spin w-4 h-4" />
            ) : (
              <CheckCircle2 className="opacity-30 w-4 h-4" />
            )}
            <span>Step 2: EVM Wallet</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
