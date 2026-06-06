"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

// ─── Types ────────────────────────────────────────────────────────────────────

type MemberRole = "owner" | "manager" | "agent";

interface Member {
  id: string;
  userId: string;
  role: MemberRole;
  name: string | null;
  email: string | null;
}

const ROLE_LABELS: Record<MemberRole, string> = {
  owner: "Propriétaire",
  manager: "Responsable",
  agent: "Agent",
};

const ROLE_BADGE: Record<MemberRole, string> = {
  owner: "bg-violet-100 text-violet-800",
  manager: "bg-blue-100 text-blue-800",
  agent: "bg-gray-100 text-gray-700",
};

// ─── Component ────────────────────────────────────────────────────────────────

interface EquipeClientProps {
  tenantId: string;
}

export function EquipeClient({ tenantId }: EquipeClientProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [partnerOrganization, setPartnerOrganization] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [addDialog, setAddDialog] = useState<{
    open: boolean;
    email: string;
    role: MemberRole;
    saving: boolean;
  }>({ open: false, email: "", role: "agent", saving: false });

  const loadMembers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/booking/partner/tenants/${tenantId}/members`
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Erreur");
        return;
      }
      setMembers(data.members ?? []);
      setPartnerOrganization(data.partnerOrganization ?? null);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  async function handleAdd() {
    if (!addDialog.email.trim()) {
      toast.error("Email obligatoire");
      return;
    }
    setAddDialog((s) => ({ ...s, saving: true }));
    const res = await fetch(
      `/api/booking/partner/tenants/${tenantId}/members`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: addDialog.email.trim(),
          role: addDialog.role,
        }),
      }
    );
    const data = await res.json();
    setAddDialog((s) => ({ ...s, saving: false }));
    if (!res.ok) {
      toast.error(
        res.status === 404
          ? "Aucun compte trouvé avec cet email"
          : (data.error ?? "Erreur")
      );
      return;
    }
    toast.success("Membre ajouté");
    setAddDialog({ open: false, email: "", role: "agent", saving: false });
    loadMembers();
  }

  async function handleRoleChange(memberId: string, role: MemberRole) {
    const res = await fetch(
      `/api/booking/partner/tenants/${tenantId}/members/${memberId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      }
    );
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "Erreur");
      return;
    }
    toast.success("Rôle mis à jour");
    loadMembers();
  }

  async function handleRemove(memberId: string) {
    const res = await fetch(
      `/api/booking/partner/tenants/${tenantId}/members/${memberId}`,
      { method: "DELETE" }
    );
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "Erreur");
      return;
    }
    toast.success("Membre retiré");
    loadMembers();
  }

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Équipe</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Membres ayant accès à la gestion de ce guichet.
          </p>
        </div>
        <Button onClick={() => setAddDialog((s) => ({ ...s, open: true }))}>
          <Plus className="size-4" /> Ajouter un membre
        </Button>
      </div>

      {partnerOrganization && (
        <div className="flex items-start gap-2 rounded-lg border bg-muted/40 px-4 py-3 text-sm">
          <Users className="size-4 mt-0.5 text-muted-foreground shrink-0" />
          <p className="text-muted-foreground">
            Les responsables de{" "}
            <span className="font-medium text-foreground">
              {partnerOrganization}
            </span>{" "}
            ont déjà accès automatiquement via leur organisation.
          </p>
        </div>
      )}

      {loading ? (
        <Skeleton className="h-48 rounded-xl" />
      ) : members.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucun membre explicite — accès via l&apos;organisation uniquement.
        </p>
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">
                    {m.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {m.email ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={m.role}
                      onValueChange={(v) =>
                        handleRoleChange(m.id, v as MemberRole)
                      }
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue>
                          <span
                            className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
                              ROLE_BADGE[m.role]
                            }`}
                          >
                            {ROLE_LABELS[m.role]}
                          </span>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {(
                          Object.entries(ROLE_LABELS) as [MemberRole, string][]
                        ).map(([k, v]) => (
                          <SelectItem key={k} value={k}>
                            {v}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleRemove(m.id)}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add member dialog */}
      <Dialog
        open={addDialog.open}
        onOpenChange={(o) =>
          !addDialog.saving && setAddDialog((s) => ({ ...s, open: o }))
        }
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Ajouter un membre</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>
                Email <span className="text-destructive">*</span>
              </Label>
              <Input
                type="email"
                placeholder="prenom.nom@organisation.be"
                value={addDialog.email}
                onChange={(e) =>
                  setAddDialog((s) => ({ ...s, email: e.target.value }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Le compte doit déjà exister sur la plateforme.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Rôle</Label>
              <Select
                value={addDialog.role}
                onValueChange={(v) =>
                  setAddDialog((s) => ({ ...s, role: v as MemberRole }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(
                    Object.entries(ROLE_LABELS) as [MemberRole, string][]
                  ).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddDialog((s) => ({ ...s, open: false }))}
              disabled={addDialog.saving}
            >
              Annuler
            </Button>
            <Button onClick={handleAdd} disabled={addDialog.saving}>
              {addDialog.saving ? "Ajout…" : "Ajouter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
