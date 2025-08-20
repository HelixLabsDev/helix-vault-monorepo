/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/ui/card";
import { Button } from "@/app/ui/button";
import { Badge } from "@/app/ui/badge";
import { Separator } from "@/app/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/app/ui/alert";
import {
  ExternalLink,
  Loader2,
  RefreshCcw,
  ShieldCheck,
  Timer,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { convertNatToNumber } from "@/lib/utils";
import { Principal } from "@dfinity/principal";

interface DropHistory {
  id: string;
  ts: number;
  amount: number;
  tx?: string;
}

const LS_PREFIX = "hicp_faucet";
const lsKey = (name: string, principal?: string | null) =>
  `${LS_PREFIX}:${name}:${principal ?? "anon"}`;

export default function HICPTestnetFaucet() {
  const {
    principal,
    setUserBalance,
    userBalance,
    ledgerActor,
    faucetActor,
    isAuthenticated,
  } = useStore();

  const [cooldownEndsAt, setCooldownEndsAt] = useState<number | null>(null);
  const [history, setHistory] = useState<DropHistory[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setLoading] = useState(false);

  // 12 hours
  const cooldownMs = 1000 * 60 * 60 * 12;
  const now = Date.now();
  const onCooldown = useMemo(
    () => !!cooldownEndsAt && cooldownEndsAt > now,
    [cooldownEndsAt, now]
  );
  const remaining = Math.max(0, (cooldownEndsAt ?? 0) - now);

  const prettyTime = (ms: number) => {
    const s = Math.ceil(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    return `${h}h ${m}m ${ss}s`;
  };

  // ---------- Persist/restore from localStorage ----------
  useEffect(() => {
    if (typeof window === "undefined") return;
    const rawHistory = localStorage.getItem(lsKey("history", principal));
    const rawCooldown = localStorage.getItem(lsKey("cooldown", principal));

    if (rawHistory) {
      try {
        setHistory(JSON.parse(rawHistory));
      } catch {}
    }
    if (rawCooldown) {
      const n = Number(rawCooldown);
      setCooldownEndsAt(Number.isFinite(n) && n > 0 ? n : null);
    }
  }, [principal]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(lsKey("history", principal), JSON.stringify(history));
  }, [history, principal]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (cooldownEndsAt) {
      localStorage.setItem(lsKey("cooldown", principal), `${cooldownEndsAt}`);
    } else {
      localStorage.removeItem(lsKey("cooldown", principal));
    }
  }, [cooldownEndsAt, principal]);

  // ---------- Chain calls ----------
  const fetchBalance = async () => {
    if (!principal || !ledgerActor) return setMessage("Sign in first.");
    setLoading(true);
    try {
      const bal = await ledgerActor.icrc1_balance_of({
        owner: Principal.fromText(principal),
        subaccount: [],
      });
      setUserBalance(convertNatToNumber(bal.toString()));
    } catch (err) {
      console.error("Error fetching vault balance:", err);
    } finally {
      setTimeout(() => setLoading(false), 400);
    }
  };

  const requestDrop = async () => {
    if (!isAuthenticated || faucetActor == null)
      return setMessage("Sign in first.");
    if (onCooldown) return;

    setLoading(true);
    setMessage(null);
    try {
      console.log("faucetActor", faucetActor);
      const amount = 5;
      const tx: any = await faucetActor.claim_tokens([]);

      if (tx.Err) {
        const err = tx.Err as string;
        const match = err.match(/Next at (\d+) ns/);
        if (match) {
          const ns = BigInt(match[1]); // timestamp in nanoseconds
          const ms = Number(ns / BigInt(1_000_000));
          const nextDate = new Date(ms);

          const readable = nextDate.toLocaleString(); // e.g. "8/20/2025, 4:45:41 PM"
          setMessage(`Claim too soon. Next available at ${readable}`);
        } else {
          setMessage(err || "Transaction failed");
        }

        return;
      }

      console.log("tx ->", tx);

      const entry: DropHistory = {
        id: crypto.randomUUID(),
        ts: Date.now(),
        amount,
        tx:
          typeof tx === "string"
            ? tx
            : "https://dashboard.internetcomputer.org/",
      };

      setHistory((h) => [entry, ...h].slice(0, 10));
      const nextCd = Date.now() + cooldownMs;
      setCooldownEndsAt(nextCd);
      setMessage(`Sent ${amount} hICP. Cooldown started.`);
      fetchBalance();
    } catch (e) {
      console.error(e);
      setMessage("Request failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (principal) fetchBalance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [principal]);

  return (
    <div className="mx-auto w-full h-full py-20">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">hICP Testnet Faucet</h1>
          <p className="text-sm text-muted-foreground">
            Claim testnet hICP for development.
          </p>
        </div>
      </div>

      {message && (
        <Alert className="mb-4 rounded-xl">
          <AlertTitle>Status</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Card className="md:col-span-2 rounded-2xl">
          <CardHeader>
            <CardTitle>Request hICP</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex md:flex-row flex-col items-center justify-between gap-3">
              <div className="text-sm text-muted-foreground">
                {onCooldown ? (
                  <span className="inline-flex items-center gap-1">
                    <Timer className="h-4 w-4" /> Cooldown:{" "}
                    {prettyTime(remaining)}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1">
                    <ShieldCheck className="h-4 w-4" /> Eligible
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={fetchBalance}
                  disabled={!principal || isLoading}
                >
                  <RefreshCcw className="mr-2 h-4 w-4" /> Refresh balance
                </Button>
                <Button
                  className="rounded-xl"
                  onClick={requestDrop}
                  disabled={!principal || onCooldown || isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Request hICP
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Status */}
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Network</span>
              <Badge variant="secondary" className="rounded-lg">
                Testnet
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Principal</span>
              <span className="font-medium">
                {principal
                  ? principal.slice(0, 8) + "…" + principal.slice(-4)
                  : "—"}
              </span>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span>Balance</span>
              <span className="font-medium">
                {userBalance === null
                  ? "—"
                  : `${userBalance.toLocaleString()} hICP`}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Cooldown</span>
              <span className="font-medium">
                {onCooldown ? prettyTime(remaining) : "None"}
              </span>
            </div>
            <Separator />
            <div className="space-y-2">
              <div className="font-semibold">Recent drops</div>
              {history.length === 0 ? (
                <div className="text-muted-foreground">No drops yet.</div>
              ) : (
                <div className="space-y-2">
                  {history.map((h) => (
                    <div
                      key={h.id}
                      className="flex items-center justify-between rounded-lg border bg-card px-3 py-2"
                    >
                      <div className="truncate">
                        {new Date(h.ts).toLocaleString().slice(0, 9)}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {h.amount.toLocaleString()} hICP
                        </span>
                        {h.tx && (
                          <a
                            href={h.tx}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex"
                          >
                            <ExternalLink className="h-4 w-4 opacity-70" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
