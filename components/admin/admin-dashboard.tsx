"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ActivityLog, ActivityItem } from "@/components/admin/activity-log";
import { AdminDashboardOverview } from "@/components/admin/admin-dashboard-overview";
import { FileManager } from "@/components/docbel/file-manager";
import { ChangelogManager } from "@/components/admin/changelog-manager";
import { ToolsManager } from "@/components/admin/tools-manager";

interface Page {
  id: string;
  title: string;
  slug: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

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

interface Tool {
  id: string;
  name: string;
  slug: string;
  description: string;
  type: string;
  icon?: string;
  popular: boolean;
  timeMin?: number;
  order: number;
}

interface ToolSection {
  id: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  order: number;
  tools: Tool[];
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
  pages: Page[];
  users: User[];
  sections: ToolSection[];
}

export function AdminDashboard({ pages, users, sections }: AdminDashboardProps) {
  const searchParams = useSearchParams();
  const view = searchParams.get("view") || "dashboard";
  const [activities, setActivities] = useState<ActivityItem[]>([]);

  const totalUsers = users.length;

  useEffect(() => {
    async function fetchActivities() {
      try {
        const response = await fetch("/api/activities?limit=20");
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
  }, []);

  // Afficher les vues alternatives
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

  if (view === "tools") {
    return <ToolsManager sections={sections} />
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

  // Vue par défaut: Dashboard
  return (
    <AdminDashboardOverview
      pages={pages}
      users={users}
      sections={sections}
      activities={activities}
    />
  );
}
