"use client";

import React from "react";
import { MessagesPanel } from "@/components/admin/messages-panel";

export default function MessagesPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Messages de contact</h1>
        <p className="text-muted-foreground mt-2">Gérez les messages de contact reçus</p>
      </div>
      <MessagesPanel />
    </div>
  );
}
