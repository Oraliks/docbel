"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MessageDetailView } from "./message-detail";
import { Eye, EyeOff, Archive, Trash2, Mail, ChevronRight, CheckCircle, Circle } from "lucide-react";

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

interface MessagesPanelProps {
  initialMessages?: ContactMessage[];
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "à l'instant";
  if (seconds < 3600) return `il y a ${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `il y a ${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `il y a ${Math.floor(seconds / 86400)}j`;

  return date.toLocaleDateString("fr-FR");
}

function getStatusBadgeColor(status: string): string {
  switch (status) {
    case "NEW":
      return "bg-blue-100 text-blue-800";
    case "READ":
      return "bg-gray-100 text-gray-800";
    case "REPLIED":
      return "bg-green-100 text-green-800";
    case "ARCHIVED":
      return "bg-slate-100 text-slate-600";
    default:
      return "bg-gray-100 text-gray-800";
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

export function MessagesPanel({ initialMessages = [] }: MessagesPanelProps) {
  const [messages, setMessages] = useState<ContactMessage[]>(initialMessages);
  const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(null);
  const [loading, setLoading] = useState(!initialMessages.length);
  const [filter, setFilter] = useState<"ALL" | "NEW" | "READ" | "REPLIED" | "ARCHIVED">("ALL");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!initialMessages.length) {
      fetchMessages();
    }
  }, [initialMessages.length]);

  async function fetchMessages() {
    try {
      const response = await fetch("/api/contact-messages");
      if (response.ok) {
        const data = await response.json();
        setMessages(data);
      }
    } catch (error) {
      console.error("Failed to fetch messages:", error);
    } finally {
      setLoading(false);
    }
  }

  async function updateMessageStatus(id: string, newStatus: string) {
    setActionLoading(id);
    try {
      const response = await fetch(`/api/contact-messages/${id}`, {
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
        setMessages(messages.map((msg) => (msg.id === id ? updatedMessage : msg)));
      }
    } catch (error) {
      console.error("Error updating message:", error);
    } finally {
      setActionLoading(null);
    }
  }

  async function deleteMessage(id: string) {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce message ?")) {
      return;
    }

    setActionLoading(id);
    try {
      const response = await fetch(`/api/contact-messages/${id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        setMessages(messages.filter((msg) => msg.id !== id));
      }
    } catch (error) {
      console.error("Error deleting message:", error);
    } finally {
      setActionLoading(null);
    }
  }

  function handleMessageUpdated(updatedMessage: ContactMessage) {
    setMessages(messages.map((msg) => (msg.id === updatedMessage.id ? updatedMessage : msg)));
    setSelectedMessage(updatedMessage);
  }

  const filteredMessages = filter === "ALL" ? messages : messages.filter((msg) => msg.status === filter);

  const stats = {
    NEW: messages.filter((m) => m.status === "NEW").length,
    READ: messages.filter((m) => m.status === "READ").length,
    REPLIED: messages.filter((m) => m.status === "REPLIED").length,
    ARCHIVED: messages.filter((m) => m.status === "ARCHIVED").length,
  };

  if (selectedMessage) {
    return (
      <MessageDetailView
        message={selectedMessage}
        onBack={() => setSelectedMessage(null)}
        onMessageUpdated={handleMessageUpdated}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { status: "ALL", label: "Total", count: messages.length, color: "bg-blue-50 border-blue-200" },
          { status: "NEW", label: "Nouveau", count: stats.NEW, color: "bg-blue-50 border-blue-200" },
          { status: "READ", label: "Lu", count: stats.READ, color: "bg-gray-50 border-gray-200" },
          { status: "REPLIED", label: "Répondu", count: stats.REPLIED, color: "bg-green-50 border-green-200" },
        ].map((item) => (
          <Card key={item.status} className={`border ${item.color}`}>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-1">{item.label}</p>
                <p className="text-3xl font-bold">{item.count}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {["ALL", "NEW", "READ", "REPLIED", "ARCHIVED"].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status as any)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === status
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            {status === "ALL" ? "Tous" : getStatusLabel(status)}
          </button>
        ))}
      </div>

      {/* Messages Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail size={20} />
            Messages de contact ({filteredMessages.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-gray-500">Chargement des messages...</div>
          ) : filteredMessages.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {filter === "ALL" ? "Aucun message" : "Aucun message avec ce statut"}
            </div>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 hover:bg-gray-50">
                    <TableHead className="font-semibold">De</TableHead>
                    <TableHead className="font-semibold">Sujet</TableHead>
                    <TableHead className="font-semibold">Statut</TableHead>
                    <TableHead className="font-semibold">Date</TableHead>
                    <TableHead className="font-semibold text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMessages.map((message) => (
                    <TableRow key={message.id} className="hover:bg-gray-50 transition-colors">
                      <TableCell>
                        <div className="cursor-pointer" onClick={() => setSelectedMessage(message)}>
                          <div className="font-medium hover:text-blue-600">{message.name}</div>
                          <div className="text-sm text-gray-600">{message.email}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-xs cursor-pointer truncate hover:text-blue-600 hover:underline" onClick={() => setSelectedMessage(message)}>
                          {message.subject}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusBadgeColor(message.status)}>
                          {getStatusLabel(message.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">{formatDate(message.createdAt)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 justify-end">
                          {/* View/Detail button */}
                          <Button
                            onClick={() => setSelectedMessage(message)}
                            variant="ghost"
                            size="sm"
                            title="Voir les détails"
                            className="h-8 w-8 p-0"
                          >
                            <ChevronRight size={16} />
                          </Button>

                          {/* Toggle Read/Unread */}
                          {(message.status === "NEW" || message.status === "READ") && (
                            <Button
                              onClick={() => updateMessageStatus(message.id, message.status === "NEW" ? "READ" : "NEW")}
                              disabled={actionLoading === message.id}
                              variant="ghost"
                              size="sm"
                              title={message.status === "NEW" ? "Marquer comme lu" : "Marquer comme non lu"}
                              className="h-8 w-8 p-0"
                            >
                              {message.status === "NEW" ? (
                                <Circle size={16} className="text-blue-600" />
                              ) : (
                                <CheckCircle size={16} className="text-green-600" />
                              )}
                            </Button>
                          )}

                          {/* Archive */}
                          {message.status !== "ARCHIVED" && (
                            <Button
                              onClick={() => updateMessageStatus(message.id, "ARCHIVED")}
                              disabled={actionLoading === message.id}
                              variant="ghost"
                              size="sm"
                              title="Archiver"
                              className="h-8 w-8 p-0"
                            >
                              <Archive size={16} />
                            </Button>
                          )}

                          {/* Delete */}
                          <Button
                            onClick={() => deleteMessage(message.id)}
                            disabled={actionLoading === message.id}
                            variant="ghost"
                            size="sm"
                            title="Supprimer"
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
