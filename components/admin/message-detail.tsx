"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Mail, Archive, Trash2, Eye, EyeOff } from "lucide-react";

interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: string;
  adminReply?: string;
  createdAt: string;
  updatedAt: string;
}

interface MessageDetailViewProps {
  message: ContactMessage;
  onBack: () => void;
  onMessageUpdated: (message: ContactMessage) => void;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatusBadgeColor(status: string): string {
  switch (status) {
    case "NEW":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200";
    case "READ":
      return "bg-muted text-muted-foreground";
    case "REPLIED":
      return "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200";
    case "ARCHIVED":
      return "bg-muted text-muted-foreground";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function getStatusLabel(status: string): string {
  const labels: { [key: string]: string } = {
    NEW: "Nouveau",
    READ: "Lu",
    REPLIED: "Répondu",
    ARCHIVED: "Archivé",
  };
  return labels[status] || status;
}

export function MessageDetailView({
  message: initialMessage,
  onBack,
  onMessageUpdated,
}: MessageDetailViewProps) {
  const [message, setMessage] = useState(initialMessage);
  const [reply, setReply] = useState(message.adminReply || "");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  async function updateMessageStatus(newStatus: string) {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/contact-messages/${message.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: newStatus,
        }),
      });

      if (response.ok) {
        const updatedMessage = await response.json();
        setMessage(updatedMessage);
        onMessageUpdated(updatedMessage);
      }
    } catch (error) {
      console.error("Error updating message:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSaveReply() {
    if (!reply.trim()) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/contact-messages/${message.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          adminReply: reply,
        }),
      });

      if (response.ok) {
        const updatedMessage = await response.json();
        setMessage(updatedMessage);
        onMessageUpdated(updatedMessage);
      }
    } catch (error) {
      console.error("Error saving reply:", error);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce message ? Cette action est irréversible.")) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/contact-messages/${message.id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        onBack();
      }
    } catch (error) {
      console.error("Error deleting message:", error);
    } finally {
      setIsLoading(false);
    }
  }

  const isArchived = message.status === "ARCHIVED";

  return (
    <div className="space-y-6">
      {/* Header with back button and status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-foreground bg-muted hover:bg-muted/70 rounded-lg transition-colors"
          >
            <ArrowLeft size={16} />
            Retour
          </button>
          <div>
            <h2 className="text-2xl font-bold">{message.subject}</h2>
            <p className="text-sm text-muted-foreground">{message.name} • {message.email}</p>
          </div>
        </div>
        <Badge className={getStatusBadgeColor(message.status)}>
          {getStatusLabel(message.status)}
        </Badge>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 flex-wrap">
        {message.status === "NEW" && (
          <Button
            onClick={() => updateMessageStatus("READ")}
            disabled={isLoading}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <Eye size={16} />
            Marquer comme lu
          </Button>
        )}

        {message.status === "READ" && (
          <Button
            onClick={() => updateMessageStatus("NEW")}
            disabled={isLoading}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <EyeOff size={16} />
            Marquer comme non lu
          </Button>
        )}

        {!isArchived && (
          <Button
            onClick={() => updateMessageStatus("ARCHIVED")}
            disabled={isLoading}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <Archive size={16} />
            Archiver
          </Button>
        )}

        <Button
          onClick={handleDelete}
          disabled={isLoading}
          variant="destructive"
          size="sm"
          className="gap-2 ml-auto"
        >
          <Trash2 size={16} />
          Supprimer
        </Button>
      </div>

      {/* Original message */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail size={20} />
            Message original
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">De</label>
              <p className="font-semibold">{message.name}</p>
              <p className="text-sm text-muted-foreground">{message.email}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Date</label>
              <p className="text-sm">{formatDate(message.createdAt)}</p>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground">Sujet</label>
            <p className="font-semibold">{message.subject}</p>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground block mb-2">Message</label>
            <div className="bg-muted/50 p-4 rounded-lg whitespace-pre-wrap text-sm border border-border">
              {message.message}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Admin reply section */}
      <Card>
        <CardHeader>
          <CardTitle>Réponse de l&apos;admin</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {message.adminReply && (
            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-2">Réponse actuelle</label>
              <div className="bg-green-50 dark:bg-green-950/30 p-4 rounded-lg whitespace-pre-wrap text-sm border border-green-200 dark:border-green-900">
                {message.adminReply}
              </div>
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-muted-foreground block mb-2">
              {message.adminReply ? "Modifier la réponse" : "Ajouter une réponse"}
            </label>
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Écrivez votre réponse ici..."
              className="w-full px-4 py-3 border border-input bg-background rounded-lg text-sm focus:ring-2 focus:ring-ring focus:border-transparent resize-vertical"
              rows={6}
            />
            <p className="text-xs text-muted-foreground mt-2">
              {reply.length} caractères
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleSaveReply}
              disabled={isSaving || !reply.trim()}
              className="gap-2"
            >
              <Mail size={16} />
              {isSaving ? "Enregistrement..." : "Enregistrer la réponse"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
