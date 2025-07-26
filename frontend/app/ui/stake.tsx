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

export default function StakeDemo() {
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
  const [amount, setAmount] = useState<string>("");

  const { address } = useAccount();

  const fetchBalances = useCallback(async () => {
    if (!actor || !principal || !ledgerActor) {
      console.error("Missing required dependencies for fetching balances");
      return;
    }

    try {
      const vaultBalance = await actor.get_vault_balance();
      const userBalance = await actor.get_user_balance(
        Principal.fromText(principal)
      );

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

  const handleTransaction = async (type: "deposit" | "withdraw") => {
    if (!actor || !ledgerActor || !authClient || !amount || !principal) {
      toast.error("Please enter a valid amount and ensure you're logged in");
      return;
    }

    const units = tokensToUnits(amount, 8);
    if (!units) {
      toast.error("Please enter a valid amount");
      return;
    }

    const toastId = toast.loading(
      `${type.charAt(0).toUpperCase() + type.slice(1)} in progress...`
    );

    try {
      const userPrincipal = Principal.fromText(principal);
      const amountNat = convertToNat(amount);

      if (type === "deposit") {
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

          toast.loading("Approving transaction...", { id: toastId });

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
            toast.error(`Approval failed: ${JSON.stringify(approveRes.Err)}`, {
              id: toastId,
            });
            return;
          }
        }

        // Perform Deposit
        toast.loading("Depositing...", { id: toastId });

        const res: any = await actor.deposit_icrc1(amountNat, address ?? "");

        // Check if it's a success
        if (!res || typeof res.Ok !== "string") {
          const errorMessage = res?.Err || "Unknown error during deposit";
          toast.error(`Deposit failed: ${JSON.stringify(errorMessage)}`, {
            id: toastId,
          });
          return;
        }

        const match = res.Ok.match(/0x[a-fA-F0-9]{64}/);

        if (!match) {
          toast.error("Tx hash not found in response", { id: toastId });
          return;
        }
        console.log("Deposit Response:", res);
        console.log("address: ", address);

        if (!res || "Err" in res) {
          toast.error(`Deposit failed: ${JSON.stringify(res.Err || res)}`, {
            id: toastId,
          });
          return;
        }

        const { status, message } = await _depositEthereum({
          address: userPrincipal.toText(),
          amount: Number(amount || 0),
        });

        console.log("status", status);
        console.log("message", message);
        toast.success(
          <div>
            <Link href={`https://holesky.etherscan.io/tx/${match[0]}`}>
              Transaction Hash
            </Link>
          </div>,
          { id: toastId }
        );
      } else {
        // Perform Withdrawal
        toast.loading("Withdrawing...", { id: toastId });

        try {
          // if (isConnected) return toast.error("Please connect wallet");
          const { hstICPWriteContract } = await getHstICPContract();

          const tx = await hstICPWriteContract?.burn(parse18(amount));
          await tx.wait();
          console.log("tx", tx);
          const expected_eth_from = address ?? "";
          const expected_contract = hstICPContract;

          // Validation
          if (!/^\d*\.?\d*$/.test(amount)) {
            throw new Error("Please enter a valid amount");
          }

          // ✅ 18-decimal string (for EVM burn)
          const expected_amount_18dec = tokensToUnits(amount, 18)?.toString();
          if (!expected_amount_18dec) {
            throw new Error("Invalid EVM amount: cannot convert to base units");
          }

          // ✅ 8-decimal BigInt (for nICP withdraw)
          const withdraw_amount_8dec = convertToNat(amount); // BigInt

          // Debug
          console.log("expected_amount_18dec:", expected_amount_18dec);
          console.log("withdraw_amount_8dec:", withdraw_amount_8dec.toString());

          const res = await actor.unlock_icrc1(
            tx.hash,
            expected_eth_from,
            expected_amount_18dec,
            withdraw_amount_8dec,
            expected_contract
          );

          if (!res || "Err" in res) {
            toast.error(
              `Withdrawal failed: ${JSON.stringify(res.Err || res)}`,
              {
                id: toastId,
              }
            );
            return;
          }

          const { status, message } = await _withdrawEthereum({
            address: userPrincipal.toText(),
            amount: Number(amount || 0),
          });

          console.log("status", status);
          console.log("message", message);

          toast.success(
            <div>
              Withdraw Successful!{" "}
              <Link href={`https://holesky.etherscan.io/tx/${tx.hash}`}>
                Transaction Hash
              </Link>
            </div>,
            { id: toastId }
          );
        } catch (err: any) {
          toast.error(err, { id: toastId });
          console.log("err", err);
        }
      }

      await fetchBalances();
    } catch (error: any) {
      console.error(`${type} failed:`, error);
      toast.error(
        `${type.charAt(0).toUpperCase() + type.slice(1)} failed: ${
          error.message || JSON.stringify(error)
        }`,
        { id: toastId }
      );
    }
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
            className="py-1.5 flex gap-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-full data-[state=active]:shadow-none duration-300 ease-in-out"
          >
            Deposit
          </TabsTrigger>
          <TabsTrigger
            value="withdraw"
            className="py-1.5 flex gap-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-full data-[state=active]:shadow-none duration-300 ease-in-out"
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
          />
        </TabsContent>
        <TabsContent value="withdraw">
          <AmountInput
            amount={amount}
            onChange={handleAmountChange}
            max={userBalance}
            balance={userBalance}
          />
        </TabsContent>
      </Tabs>

      <div className="shadow hover:bg-primary/5 dark:bg-foreground/5 bg-white rounded-2xl p-4 duration-200 ease-in-out">
        {/* <Input
          onChange={(e) => setEthAddress(e.target.value)}
          value={ethAddress}
          placeholder="0x..."
          className="w-full py-6"
        /> */}
        <StatsSection />
      </div>

      <div className="flex flex-col gap-2">
        {isAuthenticated ? (
          <Button
            onClick={() =>
              handleTransaction(isDeposit ? "deposit" : "withdraw")
            }
            disabled={!amount}
          >
            {isDeposit ? "Deposit" : "Withdraw"}
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
}

function AmountInput({ amount, onChange, balance }: AmountInputProps) {
  const handleChange = (value: string) => {
    // Allow digits and one dot
    let sanitized = value.replace(/[^0-9.]/g, "");

    // Prevent multiple dots
    const dotCount = (sanitized.match(/\./g) || []).length;
    if (dotCount > 1) {
      sanitized = sanitized.substring(0, sanitized.length - 1);
    }

    // Preserve input like "0.", ".1", "0.01"
    const parts = sanitized.split(".");
    const wholePart = parts[0] || "0";
    let newValue = wholePart;

    if (sanitized.includes(".")) {
      const fractionalPart = parts[1]?.slice(0, 8) || "";
      newValue += "." + fractionalPart;
    }

    // Optional: prevent input longer than 18 digits
    if (newValue.length > 24) return;

    onChange(newValue);
  };

  return (
    <div className="relative ease-in-out duration-300 rounded-2xl">
      <div className="absolute top-3 left-4 text-sm text-foreground/80">
        Amount
      </div>
      <Input
        id="pay"
        placeholder="0"
        type="text"
        value={amount}
        onChange={(e) => handleChange(e.target.value)}
        className="hover:bg-primary/5 dark:bg-foreground/5 bg-white  border-0 rounded-2xl focus-visible:ring-offset-0 focus-visible:ring-[0.2px] h-[120px] py-[40px] px-4 md:text-[34px]"
      />
      <div className="absolute top-3 right-5">
        <picture className="flex items-center border rounded-full p-1 w-7 h-7 bg-primary/20">
          <img
            src="/ICP.png"
            alt="icp"
            width={24}
            height={11.5}
            className="h-auto w-6"
          />
        </picture>
      </div>
      <div className="absolute flex gap-1 bottom-4 left-4 text-xs text-muted-foreground/50">
        <div>
          {Number.isNaN(Number(amount)) || amount === ""
            ? "$0.00"
            : `$${(Number(amount) * 6.5).toFixed(2)}`}
        </div>
      </div>
      <div className="absolute bottom-3 right-4 text-xs text-primary flex gap-0.5">
        <span className="py-1 text-foreground/80">{balance} ICP</span>
        <Button
          variant="ghost"
          size="xs"
          onClick={() => balance && onChange(balance.toString())}
        >
          MAX
        </Button>
      </div>
    </div>
  );
}
