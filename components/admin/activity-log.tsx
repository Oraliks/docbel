"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";
import Link from "next/link";

export interface ActivityItem {
  id: string;
  user: string;
  action: "created" | "updated" | "deleted" | "published" | "unpublished" | "error";
  resource: "page" | "user" | "comment" | "setting";
  resourceName: string;
  timestamp: string;
  details?: string;
  mentioned?: boolean;
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return "AUJOURD'HUI";
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return "HIER";
  }

  return date.toLocaleDateString("fr-FR", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).toUpperCase();
}

function getUserInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getActionLabel(action: ActivityItem["action"]): string {
  const labels = {
    created: "a créé",
    updated: "a modifié",
    deleted: "a supprimé",
    published: "a publié",
    unpublished: "a dépublié",
    error: "erreur sur",
  };
  return labels[action];
}

function getActionBadge(action: ActivityItem["action"]) {
  const variants = {
    created: { variant: "secondary" as const, label: "Créé" },
    updated: { variant: "outline" as const, label: "Modifié" },
    deleted: { variant: "destructive" as const, label: "Supprimé" },
    published: { variant: "default" as const, label: "Publié" },
    unpublished: { variant: "outline" as const, label: "Dépublié" },
    error: { variant: "destructive" as const, label: "Erreur" },
  };

  return variants[action] || { variant: "outline" as const, label: action };
}

interface ActivityLogProps {
  activities: ActivityItem[];
  limit?: number;
  showViewAll?: boolean;
  compact?: boolean;
}

export function ActivityLog({ activities, limit, showViewAll = false, compact = false }: ActivityLogProps) {
  const [showMentionedOnly, setShowMentionedOnly] = useState(false);

  const displayed = useMemo(() => {
    let filtered = activities;
    if (showMentionedOnly) {
      filtered = filtered.filter((a) => a.mentioned);
    }
    return limit ? filtered.slice(0, limit) : filtered;
  }, [activities, showMentionedOnly, limit]);

  const groupedByDate = useMemo(() => {
    const groups: Record<string, ActivityItem[]> = {};
    displayed.forEach((activity) => {
      const date = formatDate(activity.timestamp);
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(activity);
    });
    return groups;
  }, [displayed]);

  if (compact) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-start justify-between pb-3 space-y-0">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Activity log
            </CardTitle>
            <CardDescription>Dernières modifications</CardDescription>
          </div>
          {showViewAll && (
            <Link href="/admin/activity">
              <Badge variant="outline" className="cursor-pointer hover:bg-muted">
                Voir tout →
              </Badge>
            </Link>
          )}
        </CardHeader>

        <CardContent className="pt-0">
          {displayed.length > 0 ? (
            <div className="space-y-3">
              {Object.entries(groupedByDate).map(([date, items]) => (
                <div key={date}>
                  <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase">{date}</p>
                  <div className="space-y-2">
                    {items.map((activity) => {
                      const initials = getUserInitials(activity.user);
                      const badge = getActionBadge(activity.action);

                      return (
                        <div
                          key={activity.id}
                          className="flex items-center gap-3 text-sm py-1.5 rounded-md hover:bg-muted/30 transition-colors px-1.5"
                        >
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                            <span className="text-xs font-semibold">{initials}</span>
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="text-sm">
                              <span className="font-medium">{activity.user}</span>
                              {" "}
                              <span className="text-muted-foreground">{getActionLabel(activity.action)}</span>
                              {" "}
                              <span className="font-medium">{activity.resourceName}</span>
                            </p>
                          </div>

                          <Badge variant={badge.variant} className="text-xs flex-shrink-0">
                            {badge.label}
                          </Badge>

                          <span className="text-xs text-muted-foreground flex-shrink-0 w-12 text-right">
                            {formatTime(activity.timestamp)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-sm text-muted-foreground">Aucune activité</div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Full view for dedicated page
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-muted-foreground" />
            Journal d'activité
          </CardTitle>
          <CardDescription>Suivi complet de tous les changements</CardDescription>
        </div>
        <button
          onClick={() => setShowMentionedOnly(!showMentionedOnly)}
          className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          {showMentionedOnly ? "Tout afficher" : "Show mentioned only"}
        </button>
      </CardHeader>

      <CardContent>
        {displayed.length > 0 ? (
          <div className="space-y-6">
            {Object.entries(groupedByDate).map(([date, items]) => (
              <div key={date}>
                <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase">{date}</p>
                <div className="space-y-3 pl-4 border-l border-border">
                  {items.map((activity) => {
                    const initials = getUserInitials(activity.user);
                    const badge = getActionBadge(activity.action);

                    return (
                      <div key={activity.id} className="flex items-start gap-4">
                        <div className="mt-1 flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-semibold">
                          {initials}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-semibold">{activity.user}</span>
                            <span className="text-muted-foreground">{getActionLabel(activity.action)}</span>
                            <span className="font-medium text-foreground">{activity.resourceName}</span>
                            <Badge variant={badge.variant}>{badge.label}</Badge>
                          </div>
                          {activity.details && (
                            <p className="text-sm text-muted-foreground mb-1">{activity.details}</p>
                          )}
                          <p className="text-xs text-muted-foreground">{formatTime(activity.timestamp)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">Aucune activité pour le moment</div>
        )}
      </CardContent>
    </Card>
  );
}
