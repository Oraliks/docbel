"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Plus, Settings, Wand2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { CATEGORY_LABELS } from "@/lib/booking/status";

interface TenantRow {
  id: string;
  slug: string;
  name: string;
  category: string;
  partnerOrganization: string | null;
  active: boolean;
  pendingCount: number;
  monthCount: number;
}

const CATEGORIES = ["unemployment", "social_aid", "municipal", "private", "other"];

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function AdminBookingList({ tenants }: { tenants: TenantRow[] }) {
  const t = useTranslations("admin.booking");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [slugEdited, setSlugEdited] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    category: "private",
    partnerOrganization: "",
  });

  function update(patch: Partial<typeof form>) {
    setForm((f) => ({ ...f, ...patch }));
  }

  async function toggleActive(tenant: TenantRow) {
    setToggling(tenant.id);
    try {
      const res = await fetch(`/api/booking/partner/tenants/${tenant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !tenant.active }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? t("errorGeneric"));
        return;
      }
      toast.success(
        tenant.active ? t("toastDeactivated") : t("toastActivated"),
      );
      router.refresh();
    } finally {
      setToggling(null);
    }
  }

  async function create() {
    if (!form.name.trim() || !form.slug.trim()) {
      toast.error(t("errorNameSlugRequired"));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/booking/partner/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          slug: form.slug.trim(),
          category: form.category,
          partnerOrganization: form.partnerOrganization.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? t("errorGeneric"));
        return;
      }
      toast.success(t("toastCreated"));
      setOpen(false);
      router.push(`/admin/booking/${data.id}/configuration`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.push("/admin/booking/nouveau")}>
          <Wand2 className="size-4" />
          {t("guidedWizard")}
        </Button>
        <Button onClick={() => setOpen(true)}>
          <Plus className="size-4" />
          {t("createTenant")}
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("dialogTitle")}</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-2">
              <div className="flex flex-col gap-1.5">
                <Label>{t("fieldNameLabel")}</Label>
                <Input
                  value={form.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    update({
                      name,
                      ...(slugEdited ? {} : { slug: slugify(name) }),
                    });
                  }}
                  placeholder={t("fieldNamePlaceholder")}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t("fieldSlugLabel")}</Label>
                <Input
                  value={form.slug}
                  onChange={(e) => {
                    setSlugEdited(true);
                    update({ slug: slugify(e.target.value) });
                  }}
                  placeholder="entreprise-dupont"
                />
                <p className="text-xs text-muted-foreground">
                  {t.rich("fieldSlugHelper", {
                    slug: form.slug || "slug",
                    code: (chunks) => <code>{chunks}</code>,
                  })}
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t("fieldCategoryLabel")}</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => update({ category: v ?? "private" })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {CATEGORY_LABELS[c] ?? c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t("fieldPartnerOrgLabel")}</Label>
                <Input
                  value={form.partnerOrganization}
                  onChange={(e) => update({ partnerOrganization: e.target.value })}
                  placeholder={t("fieldPartnerOrgPlaceholder")}
                />
                <p className="text-xs text-muted-foreground">
                  {t("fieldPartnerOrgHelper")}
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                {t("cancel")}
              </Button>
              <Button onClick={create} disabled={saving}>
                {saving ? t("creating") : t("create")}
              </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {tenants.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("emptyState")}</p>
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("colName")}</TableHead>
                <TableHead>{t("colCategory")}</TableHead>
                <TableHead>{t("colOrganization")}</TableHead>
                <TableHead>{t("colStatus")}</TableHead>
                <TableHead>{t("colPending")}</TableHead>
                <TableHead>{t("colThisMonth")}</TableHead>
                <TableHead className="text-right">{t("colActions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants.map((tenant) => (
                <TableRow key={tenant.id}>
                  <TableCell>
                    <div className="font-medium">{tenant.name}</div>
                    <div className="text-xs text-muted-foreground">/{tenant.slug}</div>
                  </TableCell>
                  <TableCell>
                    {CATEGORY_LABELS[tenant.category] ?? tenant.category}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {tenant.partnerOrganization ?? "—"}
                  </TableCell>
                  <TableCell>
                    {tenant.active ? (
                      <Badge className="bg-emerald-100 text-emerald-800">
                        {t("statusActive")}
                      </Badge>
                    ) : (
                      <Badge className="bg-gray-100 text-gray-700">
                        {t("statusInactive")}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {tenant.pendingCount > 0 ? (
                      <Badge className="bg-amber-100 text-amber-800">
                        {tenant.pendingCount}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm tabular-nums text-muted-foreground">
                    {tenant.monthCount}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant={tenant.active ? "outline" : "default"}
                        size="sm"
                        disabled={toggling === tenant.id}
                        onClick={() => toggleActive(tenant)}
                      >
                        {toggling === tenant.id
                          ? "…"
                          : tenant.active
                            ? t("deactivate")
                            : t("activate")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/admin/booking/${tenant.id}/agenda`)}
                      >
                        <Settings className="size-4" />
                        {t("manage")}
                      </Button>
                      <a
                        href={`/${tenant.slug}/rendez-vous`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground inline-flex items-center"
                        title={t("publicPage")}
                      >
                        <ExternalLink className="size-4" />
                      </a>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
