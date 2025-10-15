/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useCallback } from "react";
import { Principal } from "@dfinity/principal";
import { toast } from "sonner";
import { Input } from "@/app/ui/input";
import { Button } from "@/app/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/ui/tabs";
import { useStore } from "@/lib/store";
import {
  convertBalance,
  convertNatToNumber,
  convertToNat,
  tokensToUnits,
} from "@/lib/utils";
import InternetIdentity from "./dfinity";
import { _depositEthereum, _withdrawEthereum } from "@/lib/axios/_actions";
import { parse18 } from "@/lib/helpers";
import { useAccount } from "wagmi";
import Link from "next/link";
import { StatsSection } from "./stats-action";
import { hstICPContract } from "../../lib/constant";
import { _userDetail } from "@/lib/axios/_user_detail";
import { VaultUser } from "../icp/page";
import { DepositProgressDialog, initialSteps } from "./progress-bar";
import {
  initialStepsWithdraw,
  WithdrawProgressDialog,
} from "./progress-bar-withdraw";
import { getHstICPContract } from "@/lib/eth-contract";

interface DepositStep {
  id: string;
  title: string;
  description: string;
  status: "pending" | "in-progress" | "completed" | "failed";
  txHash?: string;
  estimatedTime?: string;
}

export default function StakeDemo({
  tvl,
  setUsers,
}: {
  tvl: any;
  setUsers: any;
}) {
  const {
    actor,
    authClient,
    principal,
    setUserBalance,
    setBalance,
    userBalance,
    setWithdrawBalance,
    withdrawBalance,
    ledgerActor,
    isAuthenticated,
    vaultAddress,
  } = useStore();

  const [isDeposit, setIsDeposit] = useState<boolean>(true);
  const [isWithdraw, setIsWithdraw] = useState<boolean>(false);
  const [amount, setAmount] = useState<string>("");
  const [steps, setSteps] = useState<DepositStep[]>(() =>
    initialSteps.map((s) => ({ ...s }))
  );
  const [isOpen, setIsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fee, setFee] = useState<number>(0);
  const ZERO_BIGINT = BigInt(0);
  const [feeNat, setFeeNat] = useState<bigint>(ZERO_BIGINT);
  const [depositError, setDepositError] = useState<string | null>(null);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [progressAmount, setProgressAmount] = useState<string>("");

  const [isLoading, setIsLoading] = useState(false);

  const { address } = useAccount();
  const walletConnected = Boolean(address);

  const fetchBalances = useCallback(async () => {
    if (!actor || !principal || !ledgerActor) {
      console.error("Missing required dependencies for fetching balances");
      return;
    }

    setIsLoading(true);
    try {
      const vaultBalance = await actor.get_vault_balance();
      const userBalance = await actor.get_user_balance(
        Principal.fromText(principal)
      );
      const feeResponse = await actor.get_transfer_fee();
      setFee(convertNatToNumber(feeResponse.toString()));
      setFeeNat(BigInt(feeResponse.toString()));

      setBalance(convertNatToNumber(vaultBalance.toString()));
      setUserBalance(convertNatToNumber(userBalance.toString()));

      const res = await ledgerActor.icrc1_balance_of({
        owner: Principal.fromText(principal),
        subaccount: [],
      });
      setWithdrawBalance(convertBalance(res));
    } catch (error) {
      console.error("Error fetching balances:", error);
      toast.error("Failed to fetch balances");
    }

    setIsLoading(false);
  }, [
    actor,
    principal,
    ledgerActor,
    setBalance,
    setUserBalance,
    setWithdrawBalance,
  ]);

  const resetDepositSteps = () =>
    initialSteps.map((step) => ({
      ...step,
      status: "pending" as const,
      txHash: undefined,
    }));

  const resetWithdrawSteps = () =>
    initialStepsWithdraw.map((step) => ({
      ...step,
      status: "pending" as const,
      txHash: undefined,
    })) as DepositStep[];

  const handleDepositDialogChange = (open: boolean) => {
    if (!open) {
      setIsOpen(false);
      setDepositError(null);
      setSteps(resetDepositSteps());
      setIsProcessing(false);
      setProgressAmount("");
    } else {
      setIsOpen(true);
    }
  };

  const handleWithdrawDialogChange = (open: boolean) => {
    if (!open) {
      setIsWithdraw(false);
      setWithdrawError(null);
      setSteps(resetWithdrawSteps());
      setIsProcessing(false);
      setProgressAmount("");
    } else {
      setIsWithdraw(true);
    }
  };

  useEffect(() => {
    if (actor && principal && ledgerActor) {
      fetchBalances();
    }
  }, [actor, principal, ledgerActor, fetchBalances]);

  const updateTransaction = async () => {
    try {
      const userData = await _userDetail({ address: principal ?? "" });
      setUsers(userData?.data as VaultUser);
    } catch (err) {
      console.error("Error fetching user details:", err);
    }
  };

  const failActiveSteps = () => {
    setSteps((prev) =>
      prev.map((step) =>
        step.status === "completed"
          ? step
          : {
              ...step,
              status: "failed" as const,
            }
      )
    );
  };

  const handleTransaction = async (type: "deposit" | "withdraw") => {
    if (isProcessing) {
      return;
    }

    if (!actor || !ledgerActor || !authClient || !principal) {
      toast.error("Wallet setup incomplete. Please refresh and try again.");
      return;
    }

    if (!isAuthenticated) {
      toast.error("Please ensure you're logged in");
      return;
    }

    if (!walletConnected) {
      toast.error("Connect your Ethereum wallet to continue");
      return;
    }

    if (!amount) {
      toast.error("Please enter an amount");
      return;
    }

    const units = tokensToUnits(amount, 8);
    if (!units) {
      toast.error("Please enter a valid amount");
      return;
    }

    const userPrincipal = Principal.fromText(principal);
    const amountNat = convertToNat(amount);

    setIsProcessing(true);
    setProgressAmount(amount);

    if (type === "deposit") {
      setSteps(resetDepositSteps());
      setDepositError(null);
      setIsOpen(true);
    } else {
      setSteps(resetWithdrawSteps());
      setWithdrawError(null);
      setIsWithdraw(true);
    }

    try {
      if (type === "deposit") {
        updateStepStatus("approve", "in-progress");

        const allowanceResult = await ledgerActor.icrc2_allowance({
          account: { owner: userPrincipal, subaccount: [] },
          spender: {
            owner: Principal.fromText(vaultAddress),
            subaccount: [],
          },
        });

        const currentAllowance = BigInt(allowanceResult.allowance.toString());

        if (currentAllowance < units) {
          let feeAmount = feeNat;
          if (feeAmount === ZERO_BIGINT) {
            const refreshedFee = await actor.get_transfer_fee();
            feeAmount = BigInt(refreshedFee.toString());
            setFee(convertNatToNumber(refreshedFee.toString()));
            setFeeNat(feeAmount);
          }

          const approveAmount = units + feeAmount;

          const approveRes = await ledgerActor.icrc2_approve({
            fee: [feeAmount],
            from_subaccount: [],
            memo: [],
            created_at_time: [],
            amount: approveAmount,
            expected_allowance: [],
            expires_at: [],
            spender: {
              owner: Principal.fromText(vaultAddress),
              subaccount: [],
            },
          });

          if ("Err" in approveRes) {
            const message = JSON.stringify(approveRes.Err);
            setDepositError(message);
            updateStepStatus("approve", "failed");
            throw new Error(`Approval failed: ${message}`);
          }
        }

        updateStepStatus("approve", "completed");
        updateStepStatus("deposit", "in-progress");

        const depositResult: any = await actor.deposit_icrc1(
          amountNat,
          address ?? ""
        );

        if (!depositResult || typeof depositResult.Ok !== "string") {
          const errorMessage =
            depositResult?.Err || "Unknown error during deposit";
          const message =
            typeof errorMessage === "string"
              ? errorMessage
              : JSON.stringify(errorMessage);
          setDepositError(message);
          updateStepStatus("deposit", "failed");
          throw new Error(`Deposit failed: ${message}`);
        }

        const match = depositResult.Ok.match(/0x[a-fA-F0-9]{64}/);
        if (!match) {
          const message = "Transaction hash missing from response";
          setDepositError(message);
          updateStepStatus("deposit", "failed");
          throw new Error(message);
        }

        updateStepStatus("deposit", "completed");
        updateStepStatus("confirm", "in-progress");

        const { status, message } = await _depositEthereum({
          address: userPrincipal.toText(),
          amount: Number(amount || 0),
          transactionHash: match[0],
          tokenId: `${vaultAddress}`,
        });

        if (status > 200) {
          setDepositError(message);
          updateStepStatus("confirm", "failed");
          throw new Error(message);
        }

        await updateTransaction();
        setAmount("");

        updateStepStatus("confirm", "completed");
        updateStepStatus("complete", "in-progress");
        toast.success(
          <div>
            <Link href={`https://holesky.etherscan.io/tx/${match[0]}`}>
              Transaction Hash
            </Link>
          </div>
        );
        updateStepStatus("complete", "completed", match[0]);
        setDepositError(null);
      } else {
        updateStepStatus("burn", "in-progress");
        const { hstICPWriteContract } = await getHstICPContract();

        const amountWei = parse18(amount ?? 0);
        const tx = await hstICPWriteContract?.burn(amountWei);
        await tx.wait();
        updateStepStatus("burn", "completed");
        const expected_eth_from = address ?? "";
        const expected_contract = hstICPContract;

        updateStepStatus("checking", "in-progress");

        if (!/^\d*\.?\d*$/.test(amount)) {
          const message = "Please enter a valid amount";
          setWithdrawError(message);
          updateStepStatus("checking", "failed");
          throw new Error(message);
        }

        const expected_amount_18dec = tokensToUnits(amount, 18)?.toString();
        if (!expected_amount_18dec) {
          const message = "Invalid EVM amount: cannot convert to base units";
          setWithdrawError(message);
          updateStepStatus("checking", "failed");
          throw new Error(message);
        }

        updateStepStatus("checking", "completed");

        const withdraw_amount_8dec = convertToNat(amount);

        updateStepStatus("withdrawing", "in-progress");

        const unlockResult = await actor.unlock_icrc1(
          tx.hash,
          expected_eth_from,
          expected_amount_18dec,
          withdraw_amount_8dec,
          expected_contract
        );

        if (!unlockResult || "Err" in unlockResult) {
          const message = JSON.stringify(unlockResult?.Err || unlockResult);
          setWithdrawError(message);
          updateStepStatus("withdrawing", "failed");
          throw new Error(`Withdrawal failed: ${message}`);
        }

        updateStepStatus("withdrawing", "completed");
        updateStepStatus("complete", "in-progress");

        const { status, message } = await _withdrawEthereum({
          address: userPrincipal.toText(),
          amount: Number(amount || 0),
          transactionHash: tx?.hash,
          tokenId: `${vaultAddress}`,
        });

        if (status > 200) {
          setWithdrawError(message);
          updateStepStatus("complete", "failed");
          throw new Error(message);
        }

        await updateTransaction();
        setAmount("");
        updateStepStatus("complete", "completed", tx.hash);
        toast.success(
          <div>
            Withdraw Successful!{" "}
            <Link href={`https://holesky.etherscan.io/tx/${tx.hash}`}>
              Transaction Hash
            </Link>
          </div>
        );
        setWithdrawError(null);
      }
    } catch (error: any) {
      console.error(`${type} failed:`, error);
      const message = error?.message || JSON.stringify(error);

      if (type === "deposit") {
        setDepositError((prev) => prev ?? message);
      } else {
        setWithdrawError((prev) => prev ?? message);
      }

      failActiveSteps();

      toast.error(
        `${type.charAt(0).toUpperCase() + type.slice(1)} failed: ${message}`
      );
    } finally {
      try {
        await fetchBalances();
      } catch (refreshError) {
        console.error("Failed to refresh balances:", refreshError);
      }
      setIsProcessing(false);
    }
  };

  const updateStepStatus = (
    stepId: string,
    status: DepositStep["status"],
    txHash?: string
  ) => {
    setSteps((prev) =>
      prev.map((step) =>
        step.id === stepId ? { ...step, status, txHash } : step
      )
    );
  };

  const handleAmountChange = (value: string) => {
    const sanitizedValue = value.replace(/[^0-9.]/g, "");
    const parts = sanitizedValue.split(".");
    const wholePart = parts[0];
    const fractionalPart = parts[1] ? parts[1].slice(0, 8) : "";
    const newValue = wholePart + (fractionalPart ? "." + fractionalPart : "");
    setAmount(newValue);
  };

  return (
    <div className="flex flex-col w-full gap-4">
      <Tabs
        defaultValue="deposit"
        onValueChange={(value) => {
          setAmount("");
          setIsDeposit(value === "deposit");
        }}
      >
        <TabsList className="mb-2 gap-1 bg-transparent">
          <TabsTrigger
            value="deposit"
            className="py-1.5 flex gap-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none duration-300 ease-in-out"
          >
            Deposit
          </TabsTrigger>
          <TabsTrigger
            value="withdraw"
            className="py-1.5 flex gap-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none duration-300 ease-in-out"
          >
            Withdraw
          </TabsTrigger>
        </TabsList>
        <TabsContent value="deposit">
          <AmountInput
            amount={amount}
            onChange={handleAmountChange}
            max={withdrawBalance}
            balance={withdrawBalance}
            fee={fee}
          />
        </TabsContent>
        <TabsContent value="withdraw">
          <AmountInput
            amount={amount}
            onChange={handleAmountChange}
            max={userBalance}
            balance={userBalance}
            fee={fee}
          />
        </TabsContent>
      </Tabs>

      <div className="shadow hover:bg-primary/5 dark:bg-foreground/5 bg-white p-4 duration-200 ease-in-out">
        <StatsSection tvl={tvl} fee={Number(fee ?? 0)} />
      </div>

      <DepositProgressDialog
        isOpen={isOpen}
        onOpenChange={handleDepositDialogChange}
        amount={progressAmount || amount}
        tokenSymbol="hICP"
        steps={steps}
        isProcessing={isProcessing}
        errorMessage={depositError ?? undefined}
      />

      <WithdrawProgressDialog
        isOpen={isWithdraw}
        onOpenChange={handleWithdrawDialogChange}
        amount={progressAmount || amount}
        tokenSymbol="hICP"
        steps={steps}
        isProcessing={isProcessing}
        errorMessage={withdrawError ?? undefined}
      />

      <div className="flex flex-col gap-2">
        {isAuthenticated ? (
          <Button
            onClick={() =>
              handleTransaction(isDeposit ? "deposit" : "withdraw")
            }
            disabled={!amount || isLoading || isProcessing || !walletConnected}
          >
            {!amount
              ? "Enter an amount"
              : isLoading
              ? "Loading..."
              : isProcessing
              ? "Processing..."
              : !walletConnected
              ? "Connect Ethereum wallet"
              : isDeposit
              ? "Deposit"
              : "Withdraw"}
          </Button>
        ) : (
          <InternetIdentity />
        )}
      </div>
    </div>
  );
}

interface AmountInputProps {
  amount: string;
  onChange: (value: string) => void;
  max?: number;
  balance?: number;
  fee?: number;
}
function AmountInput({ amount, onChange, balance, fee }: AmountInputProps) {
  const handleChange = (value: string) => {
    const [whole, frac = ""] = value.split(".");
    let newValue = value.includes(".") ? `${whole}.${frac.slice(0, 8)}` : whole; // limit 8 decimals only if dot exists

    const num = Number(newValue);

    // Calculate max spendable balance (balance - fee, but not < 0)
    const bal = Number(balance) || 0;
    const f = Number(fee) || 0;
    const max = bal > f ? bal - f : 0;

    // If exceeds balance → clamp to max
    if (!isNaN(num) && num > max) {
      newValue = max.toString();
    }

    onChange(newValue);
  };

  return (
    <div className="relative ease-in-out duration-300">
      <div className="absolute top-3 left-4 text-sm text-foreground/80">
        Amount
      </div>
      <Input
        id="pay"
        placeholder="0"
        type="number"
        inputMode="decimal"
        step="any"
        value={amount}
        onChange={(e) => handleChange(e.target.value)}
        onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
        onKeyDown={(e) => {
          if (["e", "+", "-"].includes(e.key)) {
            e.preventDefault();
          }
        }}
        className="hover:bg-primary/5 dark:bg-foreground/5 bg-white border-0 
          focus-visible:ring-offset-0 focus-visible:ring-[0.2px] 
          h-[120px] py-[40px] px-4 md:text-[34px]"
      />
      <div className="absolute top-3 right-5">
        <picture className="flex items-center border rounded-full p-1 w-7 h-7 bg-primary/20">
          <img src="/ICP.png" alt="icp" className="h-auto w-6" />
        </picture>
      </div>
      <div className="absolute flex gap-1 bottom-4 left-4 text-xs text-muted-foreground/70">
        <span>
          Fee:{" "}
          {Number.isFinite(Number(fee))
            ? `${(Number(fee) || 0).toLocaleString(undefined, {
                maximumFractionDigits: 8,
              })} hICP`
            : "--"}
        </span>
      </div>
      <div className="absolute bottom-3 right-4 text-xs text-primary flex gap-0.5">
        <span className="py-1 text-foreground/80">
          {balance?.toLocaleString()} hICP
        </span>
        <Button
          variant="ghost"
          size="xs"
          onClick={() => {
            const bal = Number(balance) || 0;
            const f = Number(fee) || 0;
            const max = bal > f ? bal - f : 0;
            onChange(max.toString());
          }}
        >
          MAX
        </Button>
      </div>
    </div>
  );
}
