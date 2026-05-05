"use client";

import React, { useState } from "react";
import { ChangelogEntry } from "@/lib/docbel-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PlusIcon, TrashIcon, EditIcon, SaveIcon, XIcon } from "lucide-react";

interface ChangelogFormData {
  version: string;
  date: string;
  time: string;
  type: "feature" | "fix" | "improvement" | "breaking";
  title: string;
  desc: string;
  changes: string[];
  media: { type: "image" | "video"; url: string }[];
}

const typeConfig = {
  feature: { label: "Feature", color: "#10B981", bgColor: "bg-green-100", textColor: "text-green-800" },
  fix: { label: "Fix", color: "#EF4444", bgColor: "bg-red-100", textColor: "text-red-800" },
  improvement: { label: "Amélioration", color: "#3B82F6", bgColor: "bg-blue-100", textColor: "text-blue-800" },
  breaking: { label: "Breaking", color: "#F59E0B", bgColor: "bg-amber-100", textColor: "text-amber-800" },
};

export function ChangelogManager() {
  const [changelogs, setChangelogs] = useState<ChangelogEntry[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ChangelogFormData>({
    version: "",
    date: new Date().toISOString().split("T")[0],
    time: new Date().toTimeString().slice(0, 5),
    type: "feature",
    title: "",
    desc: "",
    changes: [""],
    media: [],
  });

  const handleNewClick = () => {
    setFormData({
      version: "",
      date: new Date().toISOString().split("T")[0],
      time: new Date().toTimeString().slice(0, 5),
      type: "feature",
      title: "",
      desc: "",
      changes: [""],
      media: [],
    });
    setIsAdding(true);
  };

  const handleEditClick = (entry: ChangelogEntry) => {
    const [date, time] = entry.date.split(" ");
    setFormData({
      version: entry.version,
      date: date || new Date().toISOString().split("T")[0],
      time: time || "00:00",
      type: entry.type,
      title: entry.title,
      desc: entry.desc,
      changes: entry.changes,
      media: [],
    });
    setEditingId(entry.version);
  };

  const handleSave = () => {
    if (!formData.version || !formData.title) {
      alert("Version et titre sont requis");
      return;
    }

    const fullDate = `${formData.date} ${formData.time}`;
    const newEntry: ChangelogEntry = {
      version: formData.version,
      date: fullDate,
      type: formData.type,
      title: formData.title,
      desc: formData.desc,
      changes: formData.changes.filter((c) => c.trim()),
    };

    if (editingId) {
      setChangelogs(changelogs.map((c) => (c.version === editingId ? newEntry : c)));
      setEditingId(null);
    } else {
      setChangelogs([newEntry, ...changelogs]);
      setIsAdding(false);
    }

    setFormData({
      version: "",
      date: new Date().toISOString().split("T")[0],
      time: new Date().toTimeString().slice(0, 5),
      type: "feature",
      title: "",
      desc: "",
      changes: [""],
      media: [],
    });
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
  };

  const handleDelete = (version: string) => {
    if (confirm("Êtes-vous sûr de vouloir supprimer cette version?")) {
      setChangelogs(changelogs.filter((c) => c.version !== version));
    }
  };

  const handleChangeAdd = () => {
    setFormData({ ...formData, changes: [...formData.changes, ""] });
  };

  const handleChangeUpdate = (idx: number, value: string) => {
    const newChanges = [...formData.changes];
    newChanges[idx] = value;
    setFormData({ ...formData, changes: newChanges });
  };

  const handleChangeRemove = (idx: number) => {
    setFormData({ ...formData, changes: formData.changes.filter((_, i) => i !== idx) });
  };

  return (
    <div className="space-y-6">
      {/* Actions */}
      <div className="flex justify-end">
        {!isAdding && !editingId && (
          <Button onClick={handleNewClick} className="gap-2">
            <PlusIcon size={18} />
            Nouvelle version
          </Button>
        )}
      </div>

      {/* Form */}
      {(isAdding || editingId) && (
        <Card className="border-2">
          <CardHeader>
            <CardTitle>{editingId ? "Modifier" : "Créer"} une version</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Version & Type Row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Version</label>
                  <Input
                    placeholder="2.1.0"
                    value={formData.version}
                    onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Type</label>
                  <select
                    className="w-full px-3 py-2 border rounded-md"
                    value={formData.type}
                    onChange={(e) =>
                      setFormData({ ...formData, type: e.target.value as ChangelogEntry["type"] })
                    }
                  >
                    <option value="feature">Feature</option>
                    <option value="fix">Fix</option>
                    <option value="improvement">Amélioration</option>
                    <option value="breaking">Breaking</option>
                  </select>
                </div>
              </div>

              {/* Date & Time Row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Date</label>
                  <Input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Heure</label>
                  <Input
                    type="time"
                    value={formData.time}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  />
                </div>
              </div>

              {/* Title & Description */}
              <div>
                <label className="block text-sm font-medium mb-2">Titre</label>
                <Input
                  placeholder="Titre du changement"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <textarea
                  className="w-full px-3 py-2 border rounded-md min-h-24"
                  placeholder="Description détaillée..."
                  value={formData.desc}
                  onChange={(e) => setFormData({ ...formData, desc: e.target.value })}
                />
              </div>

              {/* Changes List */}
              <div>
                <label className="block text-sm font-medium mb-2">Changements</label>
                <div className="space-y-2">
                  {formData.changes.map((change, idx) => (
                    <div key={idx} className="flex gap-2">
                      <Input
                        placeholder={`Changement ${idx + 1}`}
                        value={change}
                        onChange={(e) => handleChangeUpdate(idx, e.target.value)}
                      />
                      {formData.changes.length > 1 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleChangeRemove(idx)}
                          className="gap-1"
                        >
                          <TrashIcon size={16} />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={handleChangeAdd} className="gap-1 w-full">
                    <PlusIcon size={16} />
                    Ajouter un changement
                  </Button>
                </div>
              </div>

              {/* Media Upload */}
              <div>
                <label className="block text-sm font-medium mb-2">Médias (Images/Vidéos)</label>
                <div className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted transition">
                  <p className="text-sm text-muted-foreground">
                    Cliquez ou glissez des images/vidéos
                  </p>
                  <input
                    type="file"
                    multiple
                    accept="image/*,video/*"
                    className="hidden"
                    onChange={(e) => {
                      const files = e.currentTarget.files;
                      if (files) {
                        Array.from(files).forEach((file) => {
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            const url = ev.target?.result as string;
                            const type = file.type.startsWith("image") ? "image" : "video";
                            setFormData({
                              ...formData,
                              media: [...formData.media, { type, url }],
                            });
                          };
                          reader.readAsDataURL(file);
                        });
                      }
                    }}
                  />
                </div>
                {formData.media.length > 0 && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {formData.media.map((m, idx) => (
                      <div key={idx} className="relative rounded-lg overflow-hidden border">
                        {m.type === "image" ? (
                          // Media previews are uploaded as data URLs and are not compatible with next/image optimization.
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={m.url} alt="media" className="w-full h-24 object-cover" />
                        ) : (
                          <video src={m.url} className="w-full h-24 object-cover" />
                        )}
                        <Button
                          size="sm"
                          variant="destructive"
                          className="absolute top-1 right-1"
                          onClick={() =>
                            setFormData({
                              ...formData,
                              media: formData.media.filter((_, i) => i !== idx),
                            })
                          }
                        >
                          <XIcon size={14} />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4">
                <Button onClick={handleSave} className="gap-2 flex-1">
                  <SaveIcon size={18} />
                  Enregistrer
                </Button>
                <Button variant="outline" onClick={handleCancel} className="flex-1">
                  Annuler
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* List */}
      <div className="space-y-3">
        {changelogs.map((entry) => (
          <Card key={entry.version} className="hover:shadow-md transition">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  {/* Top row: Version, Type Badge, Date */}
                  <div className="flex items-center gap-3 mb-2">
                    <Badge variant="outline" className="bg-primary/10 text-primary">
                      v{entry.version}
                    </Badge>
                    <Badge className={`${typeConfig[entry.type].bgColor} ${typeConfig[entry.type].textColor}`}>
                      {typeConfig[entry.type].label}
                    </Badge>
                    <span className="text-sm text-muted-foreground ml-auto">{entry.date}</span>
                  </div>

                  {/* Title */}
                  <h4 className="font-semibold text-lg mb-1">{entry.title}</h4>

                  {/* Description */}
                  <p className="text-sm text-muted-foreground mb-3">{entry.desc}</p>

                  {/* Changes */}
                  <div className="text-sm space-y-1 mb-3">
                    {entry.changes.map((change, idx) => (
                      <div key={idx} className="flex gap-2 text-muted-foreground">
                        <span>•</span>
                        <span>{change}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditClick(entry)}
                    className="gap-1"
                  >
                    <EditIcon size={16} />
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(entry.version)}
                    className="gap-1"
                  >
                    <TrashIcon size={16} />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
