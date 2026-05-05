"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUpIcon, TrendingDownIcon, FileIcon, UsersIcon, ActivityIcon } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ActivityLog, ActivityItem } from "@/components/admin/activity-log";
import { FileManager } from "@/components/docbel/file-manager";
import { ApiKeysPanel } from "@/components/admin/api-keys-panel";
import { MessagesPanel } from "@/components/admin/messages-panel";
import { ChangelogManager } from "@/components/admin/changelog-manager";
import { ToolsManager } from "@/components/admin/tools-manager";

interface Page {
  id: string;
  title: string;
  slug: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  content: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
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

  const totalPages = pages.length;
  const publishedPages = pages.filter((p) => p.status === "published").length;
  const draftPages = pages.filter((p) => p.status === "draft").length;
  const totalUsers = users.length;

  const recentPages = pages.slice(0, 5);
  const recentUsers = users.slice(0, 5);

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

  const stats = [
    {
      label: "Total Pages",
      value: totalPages,
      trend: publishedPages > draftPages ? "+12%" : "-5%",
      icon: FileIcon,
      up: publishedPages > draftPages,
    },
    {
      label: "Published",
      value: publishedPages,
      trend: "+8%",
      icon: ActivityIcon,
      up: true,
    },
    {
      label: "Total Users",
      value: totalUsers,
      trend: "+5%",
      icon: UsersIcon,
      up: true,
    },
    {
      label: "Draft Pages",
      value: draftPages,
      trend: `-${Math.round((draftPages / totalPages) * 100)}%`,
      icon: FileIcon,
      up: false,
    },
  ];

  // Afficher les vues alternatives
  if (view === "filemanager") {
    return <FileManager />
  }

  if (view === "messages") {
    return <MessagesPanel />
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

  if (view === "api-keys") {
    return <ApiKeysPanel />
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
    <div className="space-y-6">
      {/* Stats Cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.label}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardDescription className="text-sm">{stat.label}</CardDescription>
                      <CardTitle className="text-2xl font-bold">{stat.value}</CardTitle>
                    </div>
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardHeader>
                <CardContent>
                  <Badge variant={stat.up ? "default" : "secondary"} className="text-xs">
                    {stat.up ? (
                      <TrendingUpIcon className="h-3 w-3 mr-1" />
                    ) : (
                      <TrendingDownIcon className="h-3 w-3 mr-1" />
                    )}
                    {stat.trend}
                  </Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Recent Pages */}
        <Card>
          <CardHeader>
            <CardTitle>Pages Récentes</CardTitle>
            <CardDescription>Vos {totalPages} pages, dernières modifications en haut</CardDescription>
          </CardHeader>
          <CardContent>
            {recentPages.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Titre</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Modifiée</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentPages.map((page) => (
                    <TableRow key={page.id}>
                      <TableCell className="font-medium">{page.title}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{page.slug}</TableCell>
                      <TableCell>
                        <Badge variant={page.status === "published" ? "default" : "secondary"}>
                          {page.status === "published" ? "Publiée" : "Brouillon"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatRelativeTime(page.updatedAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">Aucune page trouvée</div>
            )}
          </CardContent>
        </Card>

        {/* Recent Users */}
        <Card>
          <CardHeader>
            <CardTitle>Utilisateurs Récents</CardTitle>
            <CardDescription>Vos {totalUsers} utilisateurs, inscriptions récentes en haut</CardDescription>
          </CardHeader>
          <CardContent>
            {recentUsers.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Rôle</TableHead>
                    <TableHead>Inscrit le</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{user.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{user.role}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatRelativeTime(user.createdAt)}
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

        {/* Activity Log */}
        <ActivityLog activities={activities} limit={5} showViewAll={true} compact={true} />
    </div>
  );
}
