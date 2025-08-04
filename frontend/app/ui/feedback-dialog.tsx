/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { Button } from "@/app/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/app/ui/dialog";
import { Input } from "@/app/ui/input";
import { Label } from "@/app/ui/label";
import { Textarea } from "@/app/ui/textarea";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { useStoreCore } from "@/lib/storeCoreVault";

export default function FeedbackDialog() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState(60); // in seconds
  const [actionType, setActionType] = useState<"CreateVault" | "UpgradeVault">(
    "CreateVault"
  );
  const [tokenSymbol, setTokenSymbol] = useState("hICP");
  const [vaultId, setVaultId] = useState("");
  const [newCodeHash, setNewCodeHash] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { actorCore } = useStoreCore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (!actorCore?.submit_proposal) {
        toast.error("Actor not available. Please reconnect your wallet.");
        return;
      }

      const action =
        actionType === "CreateVault"
          ? { CreateVault: { token_symbol: tokenSymbol } }
          : {
              UpgradeVault: {
                vault_id: vaultId,
                new_code_hash: Array.from(Buffer.from(newCodeHash, "hex")),
              },
            };

      const result = await actorCore.submit_proposal({
        title,
        description,
        action,
        duration_secs: BigInt(duration),
      });

      toast.success("Proposal submitted", {
        description: `Proposal ID: ${result}`,
      });

      setTitle("");
      setDescription("");
      setTokenSymbol("hICP");
      setVaultId("");
      setNewCodeHash("");
      setOpen(false);
    } catch (error) {
      console.error(error);
      toast.error("Failed to submit proposal");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Submit Proposal
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Submit Proposal</DialogTitle>
            <DialogDescription>
              Create or upgrade a vault via governance.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-[80px]"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="duration">Voting Duration (seconds)</Label>
              <Input
                id="duration"
                type="number"
                value={duration}
                min={15}
                onChange={(e) => setDuration(parseInt(e.target.value))}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label>Action Type</Label>
              <select
                className="w-full rounded-md border p-2"
                value={actionType}
                onChange={(e) => setActionType(e.target.value as any)}
              >
                <option value="CreateVault">Create Vault</option>
                <option value="UpgradeVault">Upgrade Vault</option>
              </select>
            </div>
            {actionType === "CreateVault" ? (
              <div className="grid gap-2">
                <Label htmlFor="tokenSymbol">Token Symbol</Label>
                <Input
                  id="tokenSymbol"
                  value={tokenSymbol}
                  onChange={(e) => setTokenSymbol(e.target.value)}
                  required
                />
              </div>
            ) : (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="vaultId">Vault ID (Principal)</Label>
                  <Input
                    id="vaultId"
                    value={vaultId}
                    onChange={(e) => setVaultId(e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="newCodeHash">New Code Hash (hex)</Label>
                  <Input
                    id="newCodeHash"
                    value={newCodeHash}
                    onChange={(e) => setNewCodeHash(e.target.value)}
                    required
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : "Submit"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
