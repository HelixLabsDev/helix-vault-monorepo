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
import { getHstICPContract } from "@/lib/eth-contract";
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
  const [steps, setSteps] = useState<DepositStep[]>(initialSteps);
  const [isOpen, setIsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fee, setFee] = useState<number>(0);

  const [isLoading, setIsLoading] = useState(false);

  const { address } = useAccount();

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
      const fee = await actor.get_transfer_fee();
      setFee(convertNatToNumber(fee.toString()));
      console.log(fee);

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

  const handleTransaction = async (type: "deposit" | "withdraw") => {
    if (!actor || !ledgerActor || !authClient || !amount || !principal) {
      toast.error("Please enter a valid amount and ensure you're logged in");
      return;
    }

    if (!isAuthenticated) {
      toast.error("Please ensure you're logged in");
      return;
    }

    const units = tokensToUnits(amount, 8);
    if (!units) {
      toast.error("Please enter a valid amount");
      return;
    }

    try {
      const userPrincipal = Principal.fromText(principal);
      const amountNat = convertToNat(amount);

      setIsProcessing(true);

      if (type === "deposit") {
        setIsOpen(true);
        setSteps(initialSteps); // Reset steps
        updateStepStatus("approve", "in-progress");
        try {
          const allowanceResult = await ledgerActor.icrc2_allowance({
            account: { owner: userPrincipal, subaccount: [] },
            spender: {
              owner: Principal.fromText(vaultAddress),
              subaccount: [],
            },
          });

          const currentAllowance = BigInt(allowanceResult.allowance.toString());

          if (currentAllowance < units) {
            const feeAmount = BigInt(10000);
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
              toast.error(`Approval failed: ${JSON.stringify(approveRes.Err)}`);
              updateStepStatus("approve", "failed");
              return;
            }
          }

          updateStepStatus("approve", "completed");

          updateStepStatus("deposit", "in-progress");
          // Perform Deposit

          const res: any = await actor.deposit_icrc1(amountNat, address ?? "");

          // Check if it's a success
          if (!res || typeof res.Ok !== "string") {
            const errorMessage = res?.Err || "Unknown error during deposit";
            toast.error(`Deposit failed: ${JSON.stringify(errorMessage)}`);
            updateStepStatus("deposit", "failed");
            return;
          }

          const match = res.Ok.match(/0x[a-fA-F0-9]{64}/);

          if (!match) {
            toast.error("Tx hash not found in response");
            return;
          }

          updateStepStatus("deposit", "completed");

          updateStepStatus("confirm", "in-progress");

          if (!res || "Err" in res) {
            toast.error(`Deposit failed: ${JSON.stringify(res.Err || res)}`);
            updateStepStatus("confirm", "failed");
            return;
          }

          const { status, message } = await _depositEthereum({
            address: userPrincipal.toText(),
            amount: Number(amount || 0),
            transactionHash: match[0],
            tokenId: `${vaultAddress}`,
          });
          if (status > 200) {
            updateStepStatus("confirm", "failed");
            return toast.error(message);
          }
          updateTransaction();
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
        } catch (err: any) {
          // toast.error(err, { id: toastId });
          console.log("err", err);

          updateStepStatus("approve", "failed");
          updateStepStatus("deposit", "failed");
          updateStepStatus("confirm", "failed");
          updateStepStatus("complete", "failed");
        }
        // setIsOpen(false);
      } else {
        setIsWithdraw(true);
        setSteps(initialStepsWithdraw); // Reset steps

        try {
          updateStepStatus("burn", "in-progress");
          const { hstICPWriteContract } = await getHstICPContract();

          const tx = await hstICPWriteContract?.burn(parse18(amount));
          await tx.wait();
          updateStepStatus("burn", "completed");
          const expected_eth_from = address ?? "";
          const expected_contract = hstICPContract;

          updateStepStatus("checking", "in-progress");

          // Validation
          if (!/^\d*\.?\d*$/.test(amount)) {
            throw new Error("Please enter a valid amount");
          }

          // ✅ 18-decimal string (for EVM burn)
          const expected_amount_18dec = tokensToUnits(amount, 18)?.toString();
          if (!expected_amount_18dec) {
            throw new Error("Invalid EVM amount: cannot convert to base units");
          }

          updateStepStatus("checking", "completed");

          // ✅ 8-decimal BigInt (for hICP withdraw)
          const withdraw_amount_8dec = convertToNat(amount); // BigInt

          updateStepStatus("withdrawing", "in-progress");

          const res = await actor.unlock_icrc1(
            tx.hash,
            expected_eth_from,
            expected_amount_18dec,
            withdraw_amount_8dec,
            expected_contract
          );

          if (!res || "Err" in res) {
            toast.error(`Withdrawal failed: ${JSON.stringify(res.Err || res)}`);

            updateStepStatus("withdrawing", "failed");
            return;
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
            updateStepStatus("complete", "failed");
            return toast.error(message);
          }

          updateTransaction();
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
        } catch (err: any) {
          // toast.error(err, { id: toastId });
          console.log("err", err);

          updateStepStatus("burn", "failed");
          updateStepStatus("checking", "failed");
          updateStepStatus("withdrawing", "failed");
          updateStepStatus("complete", "failed");
        }
      }

      await fetchBalances();
    } catch (error: any) {
      console.error(`${type} failed:`, error);

      toast.error(
        `${type.charAt(0).toUpperCase() + type.slice(1)} failed: ${
          error.message || JSON.stringify(error)
        }`
      );
    }
    setIsProcessing(false);
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
        <StatsSection tvl={tvl} />
      </div>

      <DepositProgressDialog
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        amount={amount}
        tokenSymbol="hICP"
        steps={steps}
        isProcessing={isProcessing}
      />

      <WithdrawProgressDialog
        isOpen={isWithdraw}
        onOpenChange={setIsWithdraw}
        amount={amount}
        tokenSymbol="hICP"
        steps={steps}
        isProcessing={isProcessing}
      />

      <div className="flex flex-col gap-2">
        {isAuthenticated ? (
          <Button
            onClick={() =>
              handleTransaction(isDeposit ? "deposit" : "withdraw")
            }
            disabled={!amount || isProcessing || isLoading}
          >
            {!amount
              ? "Enter an amount"
              : isLoading
              ? "Loading..."
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
    // Split whole + fractional part
    const [whole, frac = ""] = value.split(".");
    let newValue = value.includes(".") ? `${whole}.${frac.slice(0, 8)}` : whole; // limit 8 decimals only if dot exists

    // Convert to number
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
          if (["ArrowUp", "ArrowDown", "e", "+", "-"].includes(e.key)) {
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
      <div className="absolute flex gap-1 bottom-4 left-4 text-xs text-muted-foreground/50">
        {Number(amount) ? `$${(Number(amount) * 5.3).toFixed(2)}` : "$0.00"}
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
