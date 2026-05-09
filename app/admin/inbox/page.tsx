"use client";

import React from "react";
import { InboxPanel } from "@/components/admin/inbox-panel";

export default function InboxPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Boîte de réception</h1>
        <p className="text-muted-foreground mt-2">
          Emails reçus sur contact@docbel.be (synchronisés depuis OVH)
        </p>
      </div>
      <InboxPanel />
    </div>
  );
}
