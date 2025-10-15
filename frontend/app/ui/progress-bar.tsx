"use client";

import * as React from "react";
import { motion, useSpring } from "framer-motion";
import { CheckCircle, Circle, Clock, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/app/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/app/ui/dialog";
import { Button } from "@/app/ui/button";

export type StepStatus = "pending" | "in-progress" | "completed" | "failed";

interface DepositStep {
  id: string;
  title: string;
  description: string;
  status: "pending" | "in-progress" | "completed" | "failed";
  txHash?: string;
  estimatedTime?: string;
}

interface DepositProgressDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  amount?: string;
  tokenSymbol?: string;
  steps?: ReadonlyArray<DepositStep>;
  isProcessing?: boolean;
  errorMessage?: string;
}

export const initialSteps = [
  {
    id: "approve",
    title: "Depositing",
    description: "Transferring tokens to vault",
    status: "pending",
    estimatedTime: "",
  },
  {
    id: "deposit",
    title: "Bridging to Ethereum (Holesky Testnet)",
    description: "Minting hstICP natively on Ethereum Holesky",
    status: "pending",
    estimatedTime: "~45s",
  },
  {
    id: "confirm",
    title: "Validating",
    description: "Verifying Ethereum transaction via trustless Chain Fusion",
    status: "pending",
    estimatedTime: "",
  },
  {
    id: "complete",
    title: "Complete",
    description: "Deposit and bridge successfully processed",
    status: "pending",
    estimatedTime: "",
  },
] satisfies readonly DepositStep[];

const StepIcon = ({ status }: { status: DepositStep["status"] }) => {
  const iconProps = { className: "w-5 h-5" };

  switch (status) {
    case "completed":
      return <CheckCircle {...iconProps} className="w-5 h-5 text-green-500" />;
    case "in-progress":
      return (
        <Clock {...iconProps} className="w-5 h-5 text-blue-500 animate-pulse" />
      );
    case "failed":
      return <AlertCircle {...iconProps} className="w-5 h-5 text-red-500" />;
    default:
      return (
        <Circle {...iconProps} className="w-5 h-5 text-muted-foreground" />
      );
  }
};

const ProgressBar = ({ progress }: { progress: number }) => {
  const springProgress = useSpring(progress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  return (
    <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
      <motion.div
        className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full"
        style={{ width: springProgress.get() + "%" }}
        initial={{ width: 0 }}
        animate={{ width: progress + "%" }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      />
    </div>
  );
};

export const DepositProgressDialog = ({
  isOpen,
  onOpenChange,
  amount = "0",
  tokenSymbol = "ICP",
  steps = initialSteps,
  isProcessing,
  errorMessage,
}: DepositProgressDialogProps) => {
  const completedSteps = steps.filter(
    (step) => step.status === "completed"
  ).length;
  const progress = (completedSteps / steps.length) * 100;
  const inProgressStep = steps.find((step) => step.status === "in-progress");
  const hasError = steps.some((step) => step.status === "failed");
  const isComplete = completedSteps === steps.length;

  const canClose = !isProcessing && (isComplete || hasError);

  const handleOpenChange = (open: boolean) => {
    if (open || canClose) {
      onOpenChange(open);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        onInteractOutside={(e) => !canClose && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Token Deposit</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-medium text-foreground">
                Deposit Progress
              </h3>
              <Badge variant="outline" className="text-xs">
                {completedSteps}/{steps.length} Complete
              </Badge>
            </div>
            <div className="text-sm text-muted-foreground">
              Depositing {amount} {tokenSymbol}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{Math.round(progress)}%</span>
            </div>
            <ProgressBar progress={progress} />
          </div>

          {/* Steps */}
          <div className="space-y-4">
            {steps.map((step, index) => (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className={cn(
                  "flex items-start space-x-3 p-3 rounded-lg transition-colors",
                  step.status === "in-progress" &&
                    "bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800",
                  step.status === "completed" &&
                    "bg-green-50 dark:bg-green-950/20",
                  step.status === "failed" && "bg-red-50 dark:bg-red-950/20"
                )}
              >
                <div className="flex-shrink-0 mt-0.5">
                  <StepIcon status={step.status} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4
                      className={cn(
                        "text-sm font-medium",
                        step.status === "completed" &&
                          "text-green-700 dark:text-green-300",
                        step.status === "in-progress" &&
                          "text-blue-700 dark:text-blue-300",
                        step.status === "failed" &&
                          "text-red-700 dark:text-red-300",
                        step.status === "pending" && "text-muted-foreground"
                      )}
                    >
                      {step.title}
                    </h4>
                    {step.estimatedTime && step.status !== "completed" && (
                      <span className="text-xs text-muted-foreground">
                        {step.estimatedTime}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground mt-1">
                    {step.description}
                  </p>

                  {step.txHash && (
                    <div className="mt-2">
                      <a
                        href={`https://holesky.etherscan.io/tx/${step.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        View transaction: {step.txHash.slice(0, 8)}
                      </a>
                    </div>
                  )}

                  {step.status === "in-progress" && (
                    <div className="mt-2">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                        <span className="text-xs text-blue-600 dark:text-blue-400">
                          Processing...
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Footer */}
          {inProgressStep && (
            <div className="pt-4 border-t border-border">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Current step:</span>
                <span className="font-medium text-foreground">
                  {inProgressStep.title}
                </span>
              </div>
            </div>
          )}

          {hasError && (
            <div className="pt-4 border-t border-border">
              {errorMessage && (
                <p className="mb-3 text-xs text-red-600 dark:text-red-400">
                  {errorMessage}
                </p>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="w-full"
              >
                Close
              </Button>
            </div>
          )}

          {isComplete && !hasError && (
            <div className="pt-4 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="w-full"
              >
                Done
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
