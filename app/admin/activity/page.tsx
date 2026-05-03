"use client";

import { useState, useEffect } from "react";
import { ActivityLog, ActivityItem } from "@/components/admin/activity-log";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Clock, Filter, Activity } from "lucide-react";

export default function ActivityPage() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [filteredActivities, setFilteredActivities] = useState<ActivityItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [resourceFilter, setResourceFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchActivities() {
      try {
        const response = await fetch("/api/activities?limit=100");
        if (response.ok) {
          const data = await response.json();
          // Convert createdAt to timestamp string for ActivityItem interface
          const formattedData: ActivityItem[] = data.map((activity: {
            id: string;
            user: string;
            action: string;
            resource: string;
            resourceName: string;
            createdAt: string;
            details: string;
          }) => ({
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
      } finally {
        setLoading(false);
      }
    }

    fetchActivities();
  }, []);

  useEffect(() => {
    let filtered = activities;

    if (searchTerm) {
      filtered = filtered.filter(
        (activity) =>
          activity.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
          activity.resourceName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          activity.details?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (actionFilter !== "all") {
      filtered = filtered.filter((activity) => activity.action === actionFilter);
    }

    if (resourceFilter !== "all") {
      filtered = filtered.filter((activity) => activity.resource === resourceFilter);
    }

    setFilteredActivities(filtered);
  }, [activities, searchTerm, actionFilter, resourceFilter]);

  const stats = {
    total: activities.length,
    thisMonth: activities.filter(
      (a) => new Date(a.timestamp).getMonth() === new Date().getMonth()
    ).length,
    today: activities.filter(
      (a) =>
        new Date(a.timestamp).toDateString() ===
        new Date().toDateString()
    ).length,
  };

  return (
    <div className="flex flex-col gap-6 py-6 px-4 lg:px-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <Clock className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold tracking-tight">Journal d'activité</h1>
        </div>
        <p className="text-muted-foreground">Suivi complet de tous les changements effectués</p>
      </div>

      {/* Stats Cards Grid */}
      {!loading && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs">Total d'activités</CardDescription>
              <CardTitle className="text-3xl font-bold">{stats.total}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs">Ce mois</CardDescription>
              <CardTitle className="text-3xl font-bold">{stats.thisMonth}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs">Aujourd'hui</CardDescription>
              <CardTitle className="text-3xl font-bold">{stats.today}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Filters Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filtres
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label htmlFor="search" className="text-sm font-medium">
                Rechercher
              </label>
              <Input
                id="search"
                placeholder="Utilisateur, ressource, détails..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="action-filter" className="text-sm font-medium">
                Type d'action
              </label>
              <Select value={actionFilter} onValueChange={(value) => setActionFilter(value || "all")}>
                <SelectTrigger id="action-filter" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les actions</SelectItem>
                  <SelectItem value="created">Créé</SelectItem>
                  <SelectItem value="updated">Modifié</SelectItem>
                  <SelectItem value="deleted">Supprimé</SelectItem>
                  <SelectItem value="published">Publié</SelectItem>
                  <SelectItem value="unpublished">Dépublié</SelectItem>
                  <SelectItem value="error">Erreur</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label htmlFor="resource-filter" className="text-sm font-medium">
                Type de ressource
              </label>
              <Select value={resourceFilter} onValueChange={(value) => setResourceFilter(value || "all")}>
                <SelectTrigger id="resource-filter" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les ressources</SelectItem>
                  <SelectItem value="page">Page</SelectItem>
                  <SelectItem value="user">Utilisateur</SelectItem>
                  <SelectItem value="comment">Commentaire</SelectItem>
                  <SelectItem value="setting">Paramètre</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Summary */}
      {!loading && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  <CardTitle>Résultats</CardTitle>
                </div>
                <p className="text-sm text-muted-foreground">
                  {filteredActivities.length} activité{filteredActivities.length !== 1 ? "s" : ""}
                </p>
              </div>
            </CardHeader>
          </Card>

          {/* Activity Log */}
          <ActivityLog activities={filteredActivities} showViewAll={false} compact={false} />
        </>
      )}

      {loading && (
        <Card>
          <CardHeader>
            <CardTitle>Chargement...</CardTitle>
          </CardHeader>
          <CardContent className="text-center py-8 text-muted-foreground">
            Chargement des activités...
          </CardContent>
        </Card>
      )}
    </div>
  );
}
