"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Settings,
  Sparkles,
  AlertTriangle,
  KeyRound,
  ShieldCheck,
  Mail,
  Save,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  aiHelpEnabled: boolean;
  hasAnthropicKey: boolean;
  rgpdGeneral: string;
  rgpdDefault: string;
  emailSubject: string;
  emailSubjectDefault: string;
  emailBody: string;
  emailBodyDefault: string;
}

type Tab = "ai" | "rgpd" | "email";

export function DocumentsSettingsTabs({
  aiHelpEnabled: initialAi,
  hasAnthropicKey,
  rgpdGeneral: initialRgpd,
  rgpdDefault,
  emailSubject: initialEmailSubject,
  emailSubjectDefault,
  emailBody: initialEmailBody,
  emailBodyDefault,
}: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    if (typeof window !== "undefined") {
      const t = new URLSearchParams(window.location.search).get("tab") as Tab | null;
      if (t === "rgpd" || t === "email" || t === "ai") return t;
    }
    return "ai";
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Button render={<Link href="/admin/documents" />} variant="ghost" size="sm">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Retour
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Settings className="w-7 h-7" />
            Paramètres système
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Réglages globaux du module Documents.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b">
        {[
          { id: "ai" as const, label: "Aide IA", icon: <Sparkles className="w-4 h-4" /> },
          { id: "rgpd" as const, label: "RGPD", icon: <ShieldCheck className="w-4 h-4" /> },
          { id: "email" as const, label: "Email", icon: <Mail className="w-4 h-4" /> },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setActiveTab(t.id);
              if (typeof window !== "undefined") {
                const url = new URL(window.location.href);
                url.searchParams.set("tab", t.id);
                window.history.replaceState({}, "", url.toString());
              }
            }}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === t.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "ai" && (
        <AiHelpTab
          initial={initialAi}
          hasAnthropicKey={hasAnthropicKey}
          onChanged={() => router.refresh()}
        />
      )}

      {activeTab === "rgpd" && (
        <SettingTextareaCard
          settingKey="rgpd_general"
          title="Conditions générales (RGPD)"
          description="Texte affiché dans la modale lorsqu'un utilisateur clique sur « les conditions » avant de cocher la case de consentement."
          icon={<ShieldCheck className="w-4 h-4" />}
          initialValue={initialRgpd}
          defaultValue={rgpdDefault}
          rows={20}
          onChanged={() => router.refresh()}
        />
      )}

      {activeTab === "email" && (
        <div className="space-y-4">
          <SettingInputCard
            settingKey="email_subject"
            title="Sujet de l'email"
            description="Une seule ligne. Variables disponibles : {{filename}}, {{expiresAt}}, {{templateName}}"
            icon={<Mail className="w-4 h-4" />}
            initialValue={initialEmailSubject}
            defaultValue={emailSubjectDefault}
            placeholders={[
              { token: "{{filename}}", description: "Nom du fichier généré" },
              { token: "{{expiresAt}}", description: "Date d'expiration du document" },
              { token: "{{templateName}}", description: "Nom du modèle (ex: Demande C4)" },
            ]}
            onChanged={() => router.refresh()}
          />
          <SettingTextareaCard
            settingKey="email_body"
            title="Corps de l'email"
            description="Texte brut. Le PDF/DOCX sera attaché en pièce jointe automatiquement."
            icon={<Mail className="w-4 h-4" />}
            initialValue={initialEmailBody}
            defaultValue={emailBodyDefault}
            rows={12}
            placeholders={[
              { token: "{{filename}}", description: "Nom du fichier généré" },
              { token: "{{expiresAt}}", description: "Date d'expiration du document" },
              { token: "{{templateName}}", description: "Nom du modèle" },
            ]}
            onChanged={() => router.refresh()}
          />
        </div>
      )}
    </div>
  );
}

function AiHelpTab({
  initial,
  hasAnthropicKey,
  onChanged,
}: {
  initial: boolean;
  hasAnthropicKey: boolean;
  onChanged: () => void;
}) {
  const [enabled, setEnabled] = useState(initial);
  const [saving, setSaving] = useState(false);

  async function toggle(value: boolean) {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings/ai_help_enabled", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: value ? "true" : "false" }),
      });
      if (!res.ok) throw new Error("Échec");
      setEnabled(value);
      toast.success(value ? "Aide IA activée" : "Aide IA désactivée");
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="w-4 h-4" />
          Aide IA contextuelle
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Quand activée, une icône <Sparkles className="w-3 h-3 inline" /> apparaît à côté de
          chaque champ des formulaires publics. L&apos;utilisateur peut poser des questions à
          une IA (Claude Haiku) pour comprendre comment remplir un champ.
        </p>

        {!hasAnthropicKey && (
          <Alert variant="destructive">
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription className="text-sm">
              <b>Clé API Anthropic manquante.</b> L&apos;activation ne fonctionnera pas sans
              <code className="ml-1 px-1 py-0.5 rounded bg-muted">ANTHROPIC_API_KEY</code> dans
              votre <code className="px-1 py-0.5 rounded bg-muted">.env.local</code>.
            </AlertDescription>
          </Alert>
        )}

        {hasAnthropicKey && (
          <Alert>
            <KeyRound className="w-4 h-4" />
            <AlertDescription className="text-sm">
              <b>Clé API détectée.</b> Modèle utilisé :{" "}
              <code className="px-1 py-0.5 rounded bg-muted">claude-haiku-4-5</code> avec
              prompt caching.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex items-center justify-between border rounded-lg p-4">
          <div className="space-y-0.5">
            <Label htmlFor="ai-help-toggle" className="text-base font-medium cursor-pointer">
              Activer l&apos;aide IA dans les formulaires publics
            </Label>
            <p className="text-xs text-muted-foreground">
              Désactivée par défaut. Affiche le bouton ✨ à côté de chaque champ.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={enabled ? "default" : "secondary"} className="text-xs">
              {enabled ? "ON" : "OFF"}
            </Badge>
            <Switch
              id="ai-help-toggle"
              checked={enabled}
              onCheckedChange={toggle}
              disabled={saving}
            />
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Coût estimé (avec prompt caching) : ~0,001 € par question. Limité à 10 questions /
          minute par IP.
        </p>
      </CardContent>
    </Card>
  );
}

interface SettingFieldProps {
  settingKey: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  initialValue: string;
  defaultValue: string;
  placeholders?: { token: string; description: string }[];
  onChanged: () => void;
}

function SettingInputCard(props: SettingFieldProps) {
  return <SettingTextCard {...props} multiline={false} />;
}

function SettingTextareaCard(props: SettingFieldProps & { rows?: number }) {
  return <SettingTextCard {...props} multiline={true} />;
}

function SettingTextCard({
  settingKey,
  title,
  description,
  icon,
  initialValue,
  defaultValue,
  placeholders,
  onChanged,
  multiline,
  rows,
}: SettingFieldProps & { multiline: boolean; rows?: number }) {
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const dirty = value !== initialValue;

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/settings/${settingKey}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Échec");
      }
      toast.success("Enregistré");
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{description}</p>

        {placeholders && placeholders.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {placeholders.map((p) => (
              <Badge
                key={p.token}
                variant="outline"
                className="text-xs font-mono"
                title={p.description}
              >
                {p.token}
              </Badge>
            ))}
          </div>
        )}

        {multiline ? (
          <Textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={rows ?? 8}
            className="font-mono text-sm"
          />
        ) : (
          <Input value={value} onChange={(e) => setValue(e.target.value)} />
        )}

        <div className="flex justify-between items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setValue(defaultValue)}
            disabled={value === defaultValue}
          >
            <RotateCcw className="w-4 h-4 mr-1" />
            Restaurer le défaut
          </Button>
          <Button onClick={save} disabled={saving || !dirty}>
            <Save className="w-4 h-4 mr-1" />
            {saving ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
