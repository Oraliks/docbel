"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Plus, Edit2, Trash2 } from "lucide-react";

interface Tool {
  id: string;
  name: string;
  slug: string;
  description: string;
  type: string;
  icon?: string | null;
  popular: boolean;
  timeMin?: number | null;
  order: number;
  section: {
    id: string;
    name: string;
  };
}

interface ToolsListViewProps {
  tools: Tool[];
}

const typeLabels: Record<string, string> = {
  calc_preavis: "Calculatrice - Préavis",
  calc_agr: "Calculatrice - AGR",
  calc_cp: "Calculatrice - Salaire",
  locator: "Localisateur",
  tutorial: "Tutoriel",
  info: "FAQ",
  links: "Liens",
  form: "Formulaire",
};

export function ToolsListView({ tools }: ToolsListViewProps) {
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");

  const filteredTools = useMemo(() => {
    return tools.filter((tool) => {
      const matchesSearch =
        tool.name.toLowerCase().includes(search.toLowerCase()) ||
        tool.description.toLowerCase().includes(search.toLowerCase()) ||
        tool.slug.toLowerCase().includes(search.toLowerCase());

      const matchesType = selectedType === "all" || tool.type === selectedType;

      return matchesSearch && matchesType;
    });
  }, [tools, search, selectedType]);

  // Get unique types
  const types = Array.from(new Set(tools.map((t) => t.type))).sort();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Outils</h1>
          <p className="text-muted-foreground mt-1">
            {filteredTools.length} outil{filteredTools.length !== 1 ? "s" : ""} ({tools.length} total)
          </p>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Nouvel Outil
        </Button>
      </div>

      {/* Filters */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Search */}
          <div className="space-y-2">
            <Label htmlFor="search">Rechercher</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Nom, description, slug..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Type Filter */}
          <div className="space-y-2">
            <Label htmlFor="type">Type d&apos;outil</Label>
            <select
              id="type"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 w-full"
            >
              <option value="all">Tous les types</option>
              {types.map((type) => (
                <option key={type} value={type}>
                  {typeLabels[type] || type}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tools Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredTools.length === 0 ? (
          <div className="col-span-full">
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <p className="text-muted-foreground">Aucun outil trouvé</p>
              </CardContent>
            </Card>
          </div>
        ) : (
          filteredTools.map((tool) => (
            <Card key={tool.id} className="flex flex-col hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      {tool.icon && <span className="text-2xl">{tool.icon}</span>}
                      <CardTitle className="text-base">{tool.name}</CardTitle>
                    </div>
                    <CardDescription className="text-xs font-mono">{tool.slug}</CardDescription>
                  </div>
                  {tool.popular && (
                    <Badge variant="secondary" className="text-xs">
                      ⭐
                    </Badge>
                  )}
                </div>
              </CardHeader>

              <CardContent className="flex-1 space-y-3 pb-4">
                <p className="text-sm text-muted-foreground line-clamp-2">{tool.description}</p>

                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="outline" className="text-xs">
                      {typeLabels[tool.type] || tool.type}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {tool.section.name}
                    </Badge>
                    {tool.timeMin && (
                      <Badge variant="outline" className="text-xs">
                        {tool.timeMin}min
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button variant="ghost" size="sm" className="flex-1">
                    <Edit2 className="w-4 h-4 mr-1" />
                    Éditer
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
