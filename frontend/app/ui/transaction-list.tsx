import { cn } from "@/lib/utils";
import { ArrowUpRight, ArrowDownLeft, Wallet } from "lucide-react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Button } from "../ui/button";
import Link from "next/link";

export interface Transaction {
  address: string;
  amount: string;
  createdAt: string;
  id: string;
  transactionHash: string;
  type: string;
}

export const DaySingle = ({ date }: { date: string }) => {
  const d = new Date(date);
  const formatted = `${d.toLocaleTimeString()} ${d.toLocaleString("default", {
    month: "long",
  })} ${d.getDate()}, ${d.getFullYear()}`;

  return <span>{formatted}</span>;
};

export default function TransactionList({
  transactions,
}: {
  transactions: Transaction[];
}) {
  return (
    <Card className="border rounded-xl w-full">
      <CardHeader>
        <CardTitle className="text-base font-medium">
          Recent Activity <span>({transactions.length} transactions)</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {transactions.map((transaction) => (
            <Link
              key={transaction.id}
              href={`https://holesky.etherscan.io/tx/${transaction.transactionHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-movement-500 ps-1 font-light"
            >
              <div
                className={cn(
                  "group flex items-center gap-3",
                  "p-2 rounded-lg",
                  "dark:hover:bg-zinc-800/50 hover:bg-black/5",
                  "transition-all duration-200"
                )}
              >
                <div
                  className={cn(
                    "p-2 rounded-lg",
                    "bg-zinc-800",
                    "borderborder-zinc-700"
                  )}
                >
                  <Wallet className="w-3.5 h-3.5 text-primary dark:text-primary" />
                </div>

                <div className="flex-1 flex items-center justify-between min-w-0">
                  <div className="space-y-0.5">
                    <h3 className="font-medium dark:text-zinc-100">
                      {transaction.id.slice(0, 8)}...
                    </h3>
                    <p className="text-[14px] text-zinc-600 dark:text-zinc-400">
                      {DaySingle({ date: transaction.createdAt })}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 pl-3">
                    <span
                      className={cn(
                        "font-medium",
                        transaction.type === "withdraw"
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-red-600 dark:text-red-400"
                      )}
                    >
                      {transaction.type === "withdraw" ? "+" : "-"}
                      {transaction.amount}
                    </span>
                    {transaction.type === "withdraw" ? (
                      <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <ArrowUpRight className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                    )}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>

      <CardFooter className="flex justify-center">
        <Button variant={"secondary"} className="gap-1">
          More
        </Button>
      </CardFooter>
    </Card>
  );
}
