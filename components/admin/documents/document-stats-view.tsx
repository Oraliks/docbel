"use client";

import Link from "next/link";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
} from "recharts";
import { FileText, UserCheck, Mail, TrendingUp, Globe } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Totals {
  last30Days: number;
  loggedIn: number;
  anonymous: number;
  emailed: number;
  activeTemplates: number;
}

interface PerTemplate {
  name: string;
  slug: string;
  total: number;
  loggedIn: number;
  emailed: number;
}

interface PerDay {
  date: string;
  count: number;
}

interface Props {
  totals: Totals;
  allTime: number;
  perTemplate: PerTemplate[];
  perDay: PerDay[];
}

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
            <p className="text-3xl font-bold">{value}</p>
            {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
          </div>
          <div className="text-muted-foreground">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export function DocumentStatsView({ totals, allTime, perTemplate, perDay }: Props) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={<FileText className="w-5 h-5" />}
          label="30 derniers jours"
          value={totals.last30Days}
          hint={`${allTime} depuis le début`}
        />
        <StatCard
          icon={<UserCheck className="w-5 h-5" />}
          label="Connectés"
          value={`${totals.loggedIn} / ${totals.last30Days || 1}`}
          hint={
            totals.last30Days > 0
              ? `${Math.round((totals.loggedIn / totals.last30Days) * 100)}% des générations`
              : undefined
          }
        />
        <StatCard
          icon={<Mail className="w-5 h-5" />}
          label="Envoyés par email"
          value={totals.emailed}
          hint={
            totals.last30Days > 0
              ? `${Math.round((totals.emailed / totals.last30Days) * 100)}% des générations`
              : undefined
          }
        />
        <StatCard
          icon={<Globe className="w-5 h-5" />}
          label="Modèles actifs"
          value={totals.activeTemplates}
          hint="ayant généré au moins 1 doc"
        />
      </div>

      {/* Graphique par jour */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Générations par jour (30 derniers jours)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {perDay.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Aucune donnée.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={perDay}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#7C3AED" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Top modèles */}
      <Card>
        <CardHeader>
          <CardTitle>Modèles les plus utilisés</CardTitle>
        </CardHeader>
        <CardContent>
          {perTemplate.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Aucune génération dans les 30 derniers jours.
            </p>
          ) : (
            <>
              <div className="mb-6">
                <ResponsiveContainer width="100%" height={Math.max(180, 40 * perTemplate.length)}>
                  <BarChart data={perTemplate} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                    <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="total" fill="#7C3AED" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2">
                {perTemplate.map((t) => (
                  <Link
                    key={t.slug}
                    href={`/outils/${t.slug}`}
                    target="_blank"
                    className="flex items-center justify-between p-3 border rounded hover:bg-muted/50 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">{t.name}</p>
                      <p className="text-xs text-muted-foreground font-mono truncate">/{t.slug}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Badge variant="default">{t.total}</Badge>
                      {t.loggedIn > 0 && (
                        <Badge variant="outline" title="Utilisateurs connectés">
                          <UserCheck className="w-3 h-3 mr-1" />
                          {t.loggedIn}
                        </Badge>
                      )}
                      {t.emailed > 0 && (
                        <Badge variant="outline" title="Envoyés par email">
                          <Mail className="w-3 h-3 mr-1" />
                          {t.emailed}
                        </Badge>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
