"use client";

import React, { useEffect, useState } from "react";
import { FeedbackDataTable } from "../ui/FeedbackDataTable";
import FeedbackDialog from "../ui/FeedbackDialog";
import { useStoreCore } from "@/lib/storeCoreVault";
import { GovernanceProposal } from "@/declarations/core_vault_backend/core_vault_backend.did";

export default function Governance() {
  const { actorCore } = useStoreCore();

  const [data2, setData2] = useState<GovernanceProposal[]>();
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);

      const dat = await actorCore?.list_proposals();
      console.log("dat", dat);
      if (dat !== undefined) {
        setData2(dat);
      }

      setLoading(false);
    };

    fetch();
  }, [actorCore]);

  return (
    <div className="container mx-auto pt-12">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Governance</h1>
        <FeedbackDialog />
      </div>
      {loading ? "loading...." : <FeedbackDataTable data={data2 ?? []} />}
    </div>
  );
}
