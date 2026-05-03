"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, ChevronDown, ChevronUp, Edit2, Trash2 } from "lucide-react";

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

interface ToolsManagerProps {
  sections: ToolSection[];
}

export function ToolsManager({ sections }: ToolsManagerProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editingTool, setEditingTool] = useState<string | null>(null);

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestion des Outils</h1>
          <p className="text-muted-foreground mt-1">Gérez les sections et outils disponibles</p>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Nouvelle Section
        </Button>
      </div>

      <div className="space-y-4">
        {sections.map((section) => (
          <Card key={section.id} className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <button
                    onClick={() => toggleSection(section.id)}
                    className="p-1 hover:bg-accent rounded-md transition-colors"
                  >
                    {expandedSections[section.id] ? (
                      <ChevronUp className="w-5 h-5" />
                    ) : (
                      <ChevronDown className="w-5 h-5" />
                    )}
                  </button>
                  <div>
                    <div className="flex items-center gap-2">
                      {section.icon && <span className="text-2xl">{section.icon}</span>}
                      <CardTitle className="text-lg">{section.name}</CardTitle>
                      <Badge variant="secondary">{section.tools.length} outils</Badge>
                    </div>
                    {section.description && (
                      <CardDescription className="mt-1">{section.description}</CardDescription>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm">
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm">
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </CardHeader>

            {expandedSections[section.id] && (
              <CardContent className="space-y-4 pt-0">
                <div className="pl-10 space-y-3">
                  {section.tools.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4">Aucun outil dans cette section</p>
                  ) : (
                    <>
                      {section.tools.map((tool) => (
                        <div
                          key={tool.id}
                          className="flex items-center justify-between p-3 bg-accent/30 rounded-lg border border-border"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              {tool.icon && <span className="text-lg">{tool.icon}</span>}
                              <div>
                                <p className="font-medium text-sm">{tool.name}</p>
                                <p className="text-xs text-muted-foreground">{tool.slug}</p>
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">{tool.description}</p>
                            <div className="flex gap-2 mt-2">
                              <Badge variant="outline" className="text-xs">
                                {tool.type}
                              </Badge>
                              {tool.popular && (
                                <Badge variant="secondary" className="text-xs">
                                  ⭐ Populaire
                                </Badge>
                              )}
                              {tool.timeMin && (
                                <Badge variant="outline" className="text-xs">
                                  {tool.timeMin}min
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm">
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      <Button variant="outline" size="sm" className="w-full mt-2">
                        <Plus className="w-4 h-4 mr-2" />
                        Ajouter un outil
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
