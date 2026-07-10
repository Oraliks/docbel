"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ActivityLog, ActivityItem } from "@/components/admin/activity-log";
import { FileManager } from "@/components/docbel/file-manager";
import { ChangelogManager } from "@/components/admin/changelog-manager";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status?: string;
  lastLoginAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "à l'instant";
  if (seconds < 3600) return `il y a ${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `il y a ${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `il y a ${Math.floor(seconds / 86400)}j`;

  return date.toLocaleDateString("fr-FR");
}

interface AdminDashboardProps {
  view: string;
  /** Uniquement pour view === "users". */
  users?: User[];
}

/**
 * Vues alternatives de /admin (`?view=filemanager|activity|changelog|users`).
 * La vue par défaut (cockpit) est rendue directement par app/admin/page.tsx.
 */
export function AdminDashboard({ view, users = [] }: AdminDashboardProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);

  const totalUsers = users.length;

  useEffect(() => {
    if (view !== "activity") return;
    async function fetchActivities() {
      try {
        const response = await fetch("/api/activities?limit=50");
        if (response.ok) {
          const data = await response.json();
          const formattedData: ActivityItem[] = data.map((activity: { id: string; user: string; action: string; resource: string; resourceName: string; createdAt: string; details: string }) => ({
            id: activity.id,
            user: activity.user,
            action: activity.action,
            resource: activity.resource,
            resourceName: activity.resourceName,
            timestamp: new Date(activity.createdAt).toISOString(),
            details: activity.details,
          }));
          setActivities(formattedData);
        }
      } catch (error) {
        console.error("Failed to fetch activities:", error);
      }
    }

    fetchActivities();
  }, [view]);

  if (view === "filemanager") {
    return <FileManager />
  }

  if (view === "activity") {
    return (
      <div className="space-y-6">
        <ActivityLog activities={activities} limit={50} showViewAll={false} compact={false} />
      </div>
    )
  }

  if (view === "changelog") {
    return <ChangelogManager />
  }

  if (view === "users") {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Tous les Utilisateurs</CardTitle>
            <CardDescription>Total: {totalUsers} utilisateurs</CardDescription>
          </CardHeader>
          <CardContent>
            {users.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Rôle</TableHead>
                    <TableHead>Inscrit le</TableHead>
                    <TableHead>Modifiée</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{user.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{user.role}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatRelativeTime(user.createdAt)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatRelativeTime(user.updatedAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">Aucun utilisateur trouvé</div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // Vue inconnue : rien (le cockpit est rendu par app/admin/page.tsx).
  return null;
}
