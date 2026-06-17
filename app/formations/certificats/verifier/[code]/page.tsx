import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheckIcon, XCircleIcon } from "lucide-react";
import { verifyByCode } from "@/lib/formations/certificates/service";
import { CERTIFICATE_LABELS, type CertificateType } from "@/lib/formations/constants";
import { formatDate } from "@/components/formations/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Vérification d'attestation — Docbel Formations",
  robots: { index: false },
};

export default async function VerifyCertificatePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const cert = await verifyByCode(code);
  const valid = !!cert && cert.status === "issued" && (!cert.expiresAt || cert.expiresAt > new Date());

  return (
    <div className="flex flex-col gap-6">
      <section className="glass-surface mx-auto flex w-full max-w-xl flex-col items-center gap-4 px-6 py-14 text-center">
        {valid && cert ? (
          <>
            <span className="flex size-16 items-center justify-center rounded-2xl bg-[color:color-mix(in_oklab,#16A34A_16%,transparent)] text-[#16A34A]">
              <BadgeCheckIcon className="size-8" />
            </span>
            <h1 className="glass-display text-[24px] font-semibold">Attestation valide</h1>
            <p className="text-[13px] text-[color:var(--glass-ink-faint)]">
              Ce document a bien été délivré via Docbel.
            </p>
            <dl className="mt-2 grid w-full max-w-sm grid-cols-1 gap-2 text-left text-[13.5px]">
              <Row label="Titulaire" value={cert.holderName} />
              <Row label="Formation" value={cert.trainingTitle} />
              {cert.orgName && <Row label="Organisme" value={cert.orgName} />}
              <Row label="Type" value={CERTIFICATE_LABELS[cert.type as CertificateType] ?? cert.type} />
              <Row label="Délivrée le" value={formatDate(cert.issuedAt) ?? "—"} />
              <Row label="N°" value={cert.certificateNumber} />
            </dl>
          </>
        ) : (
          <>
            <span className="flex size-16 items-center justify-center rounded-2xl bg-[color:color-mix(in_oklab,#DC2626_14%,transparent)] text-[#DC2626]">
              <XCircleIcon className="size-8" />
            </span>
            <h1 className="glass-display text-[24px] font-semibold">Attestation introuvable</h1>
            <p className="max-w-sm text-[14px] leading-[1.6] text-[color:var(--glass-ink-soft)]">
              {cert ? "Cette attestation a été révoquée ou a expiré." : "Aucune attestation ne correspond à ce code de vérification."}
            </p>
          </>
        )}
        <Link
          href="/formations"
          className="glass-cta mt-2 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-bold"
        >
          Découvrir les formations
        </Link>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[color:var(--glass-ink-line)] py-1.5">
      <dt className="text-[color:var(--glass-ink-faint)]">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}
