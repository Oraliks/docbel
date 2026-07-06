import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp, sha256Hex } from "@/lib/pdf-forms/security";
import { REPORT_TYPES, isKnownReportType } from "@/lib/reports/registry";

export type LegacyStatus =
  | "pending" | "new" | "in_progress" | "resolved" | "accepted" | "dismissed" | "rejected";

/// Mappe les 3 vocabulaires de statut hérités vers le vocabulaire unifié
/// (pending | in_progress | resolved | dismissed) — utilisé par le backfill
/// (Task 17) pour préserver l'historique.
export function mapLegacyStatus(legacy: LegacyStatus): string {
  switch (legacy) {
    case "new":
      return "pending";
    case "accepted":
      return "resolved";
    case "rejected":
      return "dismissed";
    default:
      return legacy;
  }
}

export interface ReportSession {
  id: string;
  email?: string | null;
  partnerOrganization?: string | null;
  segment?: string | null;
  vatNumber?: string | null;
}

export interface CreateReportInput {
  type: string;
  targetId?: string;
  message?: string;
  payload: unknown;
  reporterEmail?: string;
  session: ReportSession | null;
  ip: string;
  userAgent: string | null;
}

export type CreateReportResult =
  | { ok: true; id: string }
  | { ok: false; status: number; error: string };

/// Résout l'organisation à snapshotter sur le signalement pour une session
/// connectée : `partnerOrganization` pour les partenaires, sinon un libellé
/// dérivé du n° de TVA pour les employeurs (aucun nom d'entreprise en base
/// aujourd'hui), sinon null (admin ou compte sans organisation).
function resolveReporterOrg(session: ReportSession): string | null {
  if (session.partnerOrganization) return session.partnerOrganization;
  if (session.vatNumber) return `Employeur ${session.vatNumber}`;
  return null;
}

export async function createReport(input: CreateReportInput): Promise<CreateReportResult> {
  if (!isKnownReportType(input.type)) {
    return { ok: false, status: 400, error: `Type de signalement inconnu : ${input.type}` };
  }
  const config = REPORT_TYPES[input.type];

  if (config.guard) {
    const guardResult = await config.guard();
    if (guardResult.blocked) {
      return { ok: false, status: guardResult.status, error: guardResult.error };
    }
  }

  const isAnonymous = !input.session;
  if (isAnonymous) {
    const rl = checkRateLimit(`reports:${input.type}:${input.ip}`, { windowMs: 60 * 60_000, max: 5 });
    if (!rl.ok) {
      return { ok: false, status: 429, error: "Trop de signalements depuis cette adresse. Réessayez dans une heure." };
    }
  }

  const payloadCheck = config.payloadSchema.safeParse(input.payload);
  if (!payloadCheck.success) {
    return { ok: false, status: 400, error: "Payload invalide pour ce type de signalement" };
  }
  const messageCheck = config.messageSchema.safeParse(input.message);
  if (!messageCheck.success) {
    return { ok: false, status: 400, error: "Message invalide" };
  }

  const target = await config.resolveTarget(input.targetId, payloadCheck.data);
  if (!target.ok) {
    return { ok: false, status: 404, error: "Cible du signalement introuvable" };
  }

  const created = await prisma.report.create({
    data: {
      type: input.type,
      status: "pending",
      message: messageCheck.data ?? null,
      targetId: input.targetId ?? null,
      targetLabel: target.targetLabel,
      targetUrl: target.targetUrl,
      payload: payloadCheck.data as object,
      reporterEmail: isAnonymous ? (input.reporterEmail ?? null) : null,
      reporterId: input.session?.id ?? null,
      reporterOrg: input.session ? resolveReporterOrg(input.session) : null,
      ipHash: isAnonymous ? sha256Hex(input.ip).slice(0, 16) : null,
      userAgent: input.userAgent?.slice(0, 200) ?? null,
    },
    select: { id: true },
  });

  return { ok: true, id: created.id };
}

export interface ListReportsParams {
  type?: string;
  status?: string;
  limit?: number;
}

export async function listReports(params: ListReportsParams) {
  const where: { type?: string; status?: string } = {};
  if (params.type && params.type !== "all") where.type = params.type;
  if (params.status && params.status !== "all") where.status = params.status;
  return prisma.report.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: Math.min(params.limit ?? 50, 200),
  });
}

export interface UpdateReportInput {
  id: string;
  status?: string;
  adminNote?: string;
  actionTaken?: string;
  resolvedBy: string;
}

export type UpdateReportResult =
  | { ok: true; report: Awaited<ReturnType<typeof prisma.report.update>> }
  | { ok: false; status: number; error: string };

export async function updateReport(input: UpdateReportInput): Promise<UpdateReportResult> {
  const existing = await prisma.report.findUnique({ where: { id: input.id } });
  if (!existing) {
    return { ok: false, status: 404, error: "Signalement introuvable" };
  }

  const data: {
    status?: string; adminNote?: string; actionTaken?: string;
    resolvedById?: string | null; resolvedAt?: Date | null;
  } = {};
  if (input.status !== undefined) data.status = input.status;
  if (input.adminNote !== undefined) data.adminNote = input.adminNote;
  if (input.actionTaken !== undefined) data.actionTaken = input.actionTaken;

  if (input.status === "resolved" || input.status === "dismissed") {
    data.resolvedById = input.resolvedBy;
    data.resolvedAt = new Date();
  } else if (input.status === "pending" || input.status === "in_progress") {
    data.resolvedById = null;
    data.resolvedAt = null;
  }

  const updated = await prisma.report.update({ where: { id: input.id }, data });

  if (input.status === "resolved") {
    const config = REPORT_TYPES[existing.type];
    if (config?.onResolve) {
      await config.onResolve(
        { id: updated.id, targetId: updated.targetId, payload: updated.payload },
        input.resolvedBy,
      );
    }
  }

  return { ok: true, report: updated };
}
