"use client";

import React, { useEffect, useState } from "react";
import { FeedbackDataTable } from "../ui/feedback-data-table";
// import FeedbackDialog from "../ui/FeedbackDialog";
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
      if (dat !== undefined) {
        setData2(dat);
      }

      setLoading(false);
    };

    fetch();
  }, [actorCore]);

  return (
    <div className="flex flex-col py-14 h-full">
      <div className="flex items-center justify-between mb-6">
        <div className="text-3xl font-light relative overflow-hidden">
          Governance
        </div>
        {/* <FeedbackDialog /> */}
      </div>

      {loading ? (
        "loading...."
      ) : (
        <FeedbackDataTable
          setData={setData2}
          data={data2 ?? []}
          loading={loading}
        />
      )}
    </div>
  );
}
