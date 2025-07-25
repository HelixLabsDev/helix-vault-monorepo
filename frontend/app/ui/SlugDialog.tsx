/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { Button } from "@/app/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/app/ui/dialog";
import { ChevronRight } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";
import { useStoreCore } from "@/lib/storeCoreVault";
import { toast } from "sonner";
import { Badge } from "./badge";

type ProposalData = {
  id: bigint;
  title: string;
  description: string;
  votes_for: any;
  votes_against: any;
  deadline: bigint | string | number;
  status: any;
  action: any;
  proposer: any;
};

export const getStatusBadge = (status: string) => {
  switch (status.toLowerCase()) {
    case "pending":
      return (
        <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
          Pending
        </Badge>
      );
    case "approved":
      return (
        <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
          Approved
        </Badge>
      );
    case "rejected":
      return (
        <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
          Rejected
        </Badge>
      );
    default:
      return (
        <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">
          {status}
        </Badge>
      );
  }
};

export default function SlugDialog({ data }: { data: ProposalData }) {
  const [open, setOpen] = useState(false);
  const { actorCore } = useStoreCore();
  const [action, setAction] = useState<boolean | undefined>();
  console.log(data);

  const [val, setVal] = useState<string>(
    data.votes_for == 1 ? "vote" : data.votes_against == 1 ? "against" : ""
  );

  const statusKey = Object.keys(data.status)[0];

  console.log("statusKey", statusKey);

  const handleSubmit = async () => {
    try {
      if (!actorCore?.vote_proposal) {
        toast.error("Actor not available. Please reconnect your wallet.");
        return;
      }

      if (action === undefined) {
        toast.error("Vote failed: no action selected.");
        return;
      }

      const result: { Ok: null } | { Err: string } =
        await actorCore.vote_proposal(data.id, action);

      if ("Err" in result) {
        toast.error("Vote failed", { description: result.Err });
      } else {
        toast.success("Vote submitted", {
          description: `Proposal ID: ${data.id.toString()}`,
        });
        setOpen(false);
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to submit vote");
    }
  };

  const handleExecute = async () => {
    try {
      if (!actorCore?.execute_proposal) {
        toast.error("Actor not available. Please reconnect your wallet.");
        return;
      }

      const result = await actorCore.execute_proposal(data.id);

      console.log("result", result);

      if ("Err" in result) {
        toast.error("Execution failed", { description: result.Err });
      } else {
        const principal = result.Ok; // This is already of type Principal
        const readable = principal.toText(); // ✅ human-readable string

        console.log("readable", readable);

        toast.success("Execution successful", {
          description: `Principal: ${readable}`,
        });
        setOpen(false);
      }

      setOpen(false);
    } catch (error) {
      console.error(error);
      toast.error("Failed to execute proposal");
    }
  };

  // Convert deadline to milliseconds from BigInt (seconds)
  const deadlineTimestamp =
    typeof data.deadline === "bigint"
      ? Number(data.deadline) * 1000
      : typeof data.deadline === "string"
      ? Number(data.deadline) * 1000
      : data.deadline;

  const isDeadlinePassed = deadlineTimestamp > Date.now();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" className="cursor-pointer">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <div className="space-y-6">
          <h1 className="text-2xl font-bold">Governance Detail</h1>
          <p className="text-lg">{data.title}</p>
          <p className="text-gray-600">{data.description}</p>
          <p className="text-sm text-gray-500">
            Status: {getStatusBadge(statusKey)}
          </p>
          <p className="text-sm text-gray-500">
            Deadline: {new Date(deadlineTimestamp).toLocaleString()}
          </p>

          <div className="border rounded-lg gap-2 py-2 px-4 flex flex-col">
            <p className="text-sm text-foreground/80">Your vote</p>
            <div className="flex gap-2">
              <Select
                value={val}
                onValueChange={(value) => {
                  setVal(value);
                  setAction(value === "vote");
                }}
                disabled={data.votes_for == 1 || data.votes_against == 1}
              >
                <SelectTrigger className="w-1/2">
                  <SelectValue placeholder="Choose..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vote">Vote</SelectItem>
                  <SelectItem value="against">Vote Against</SelectItem>
                </SelectContent>
              </Select>
              <Button
                className="w-1/2"
                onClick={handleSubmit}
                disabled={data.votes_for == 1 || data.votes_against == 1}
              >
                Submit
              </Button>
            </div>
          </div>

          {!isDeadlinePassed && statusKey == "Approved" && (
            <Button onClick={handleExecute}>Execute</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
