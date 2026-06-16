"use client";

import React, { useState } from "react";
import { SearchIcon, BelgianFlag, ArrowIcon } from "./icons";
import { Tool } from "@/lib/docbel-data";
// BureauLocator retiré (composant legacy supprimé) — l'outil "bureaux"
// est rendu directement par app/outils/bureaux/page.tsx (BureauxFinder).
import { BureauCallout } from "./bureau-callout";

interface ViewProps {
  accent: string;
  colors?: Record<string, string>;
}

interface ToolViewProps extends ViewProps {
  tool: Tool;
}

const CP_DATA = [
  { cp: "CP 200", nom: "Employés de commerce", smg: "1.954,99 €" },
  { cp: "CP 201", nom: "Employés des industries alimentaires", smg: "2.018,45 €" },
  { cp: "CP 100", nom: "Ouvriers des secteurs complémentaires", smg: "1.806,16 €" },
  { cp: "CP 111", nom: "Mines et carrières", smg: "1.950,00 €" },
  { cp: "CP 118", nom: "Industries alimentaires", smg: "1.901,22 €" },
  { cp: "CP 124", nom: "Construction", smg: "1.933,14 €" },
  { cp: "CP 130", nom: "Pharmacie", smg: "2.110,00 €" },
  { cp: "CP 140", nom: "Transport routier", smg: "1.877,00 €" },
  { cp: "CP 302", nom: "Hôtellerie", smg: "1.852,00 €" },
  { cp: "CP 318", nom: "Services de soins de santé", smg: "2.050,00 €" },
  { cp: "CP 319", nom: "Aide sociale et soins de santé (Brussels)", smg: "2.100,00 €" },
  { cp: "CP 330", nom: "Établissements et services de santé", smg: "1.980,00 €" },
];

export function CalcCP({ accent }: ViewProps) {
  const [search, setSearch] = useState("");
  const filtered = CP_DATA.filter(
    (c) => c.cp.toLowerCase().includes(search.toLowerCase()) || c.nom.toLowerCase().includes(search.toLowerCase())
  );
  return (
    <div>
      <p style={{ fontSize: 13, color: "var(--glass-ink-soft)", marginBottom: 16, lineHeight: 1.6 }}>
        Salaires minimums garantis par commission paritaire — données indicatives 2026. Consultez toujours la CCT
        sectorielle officielle.
      </p>
      <div style={{ position: "relative", marginBottom: 16 }}>
        <span
          style={{
            position: "absolute",
            left: 12,
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--glass-ink-faint)",
          }}
        >
          <SearchIcon size={15} />
        </span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un secteur ou numéro CP…"
          style={{
            width: "100%",
            padding: "9px 12px 9px 36px",
            borderRadius: 10,
            border: "1.5px solid var(--glass-border)",
            background: "var(--glass-surface)",
            color: "var(--glass-ink)",
            fontSize: 13,
            fontFamily: "'Manrope', sans-serif",
            outline: "none",
          }}
          onFocus={(e) => (e.target.style.borderColor = accent)}
          onBlur={(e) => (e.target.style.borderColor = "var(--glass-border)")}
        />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {filtered.map((c) => (
          <div
            key={c.cp}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 14px",
              borderRadius: 10,
              background: "var(--glass-surface)",
              border: "1px solid var(--glass-border)",
            }}
          >
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: accent }}>{c.cp}</div>
              <div style={{ fontSize: 12.5, color: "var(--glass-ink)", marginTop: 2 }}>{c.nom}</div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color: "var(--glass-ink)", flexShrink: 0, marginLeft: 12 }}>
              {c.smg}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: 24, color: "var(--glass-ink-soft)", fontSize: 13 }}>
            Aucun secteur trouvé
          </div>
        )}
      </div>
    </div>
  );
}

// Fonction Locator() supprimée avec BureauLocator. L'outil "bureaux" est
// désormais routé directement vers app/outils/bureaux/page.tsx.

export function Tutorial({ tool, accent }: ToolViewProps) {
  const [activeStep, setActiveStep] = useState(0);

  const steps = tool.title.includes("carte")
    ? [
        {
          title: "Télécharger l'application MyONEM",
          body: "Disponible sur App Store et Google Play. Connectez-vous avec votre eID ou itsme. Vous pouvez aussi utiliser le site web myonem.onem.be depuis un ordinateur.",
        },
        {
          title: "Accéder à « Ma carte de contrôle »",
          body: "Dans le menu principal, sélectionnez « Ma carte de contrôle C ». Vous y verrez le mois en cours et les jours à déclarer.",
        },
        {
          title: "Cocher les jours travaillés",
          body: "Pour chaque jour où vous avez travaillé, reçu une indemnité ou étiez absent, cochez la case correspondante. Les jours non cochés = jours de chômage.",
        },
        {
          title: "Envoyer la carte",
          body: "Cliquez sur « Envoyer ma carte » avant le dernier jour ouvrable du mois. Vous recevrez une confirmation par e-Box. En cas d'erreur, contactez immédiatement votre organisme de paiement.",
        },
      ]
    : tool.title.includes("e-Box")
    ? [
        {
          title: "Activer votre e-Box",
          body: "Rendez-vous sur myebox.be et connectez-vous avec votre eID, itsme ou token. Cliquez sur « Activer mon e-Box » pour recevoir vos documents gouvernementaux numériquement.",
        },
        {
          title: "Gérer vos préférences",
          body: "Dans les paramètres, choisissez de recevoir vos courriers uniquement par e-Box. Vous pouvez aussi configurer des notifications par email ou SMS.",
        },
        {
          title: "Consulter vos documents",
          body: "Tous vos documents officiels (ONEM, SPF Finances, CPAS…) apparaissent dans votre boîte. Vous pouvez les télécharger et les archiver.",
        },
      ]
    : [
        {
          title: "Accéder à MyONEM",
          body: "Rendez-vous sur myonem.onem.be et cliquez sur « S'inscrire ». Vous aurez besoin de votre carte eID ou de l'application itsme.",
        },
        {
          title: "Vérifier votre identité",
          body: "Choisissez votre méthode d'authentification : eID avec lecteur de carte, itsme sur smartphone, ou token/mot de passe.",
        },
        {
          title: "Compléter votre profil",
          body: "Renseignez vos coordonnées bancaires (IBAN) et choisissez votre organisme de paiement si ce n'est pas encore fait.",
        },
        {
          title: "Accéder à vos services",
          body: "Une fois connecté, vous pouvez envoyer votre carte C, consulter vos allocations, mettre à jour votre situation et échanger avec l'ONEM.",
        },
      ];

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 24 }}>
        {steps.map((_, i) => (
          <div
            key={i}
            onClick={() => setActiveStep(i)}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              cursor: "pointer",
              background: i <= activeStep ? accent : "var(--glass-border)",
              transition: "background 0.2s",
            }}
          />
        ))}
      </div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: accent,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: 6,
        }}
      >
        Étape {activeStep + 1} / {steps.length}
      </div>
      <h4 style={{ fontSize: 16, fontWeight: 800, color: "var(--glass-ink)", marginBottom: 12, letterSpacing: "-0.2px" }}>
        {steps[activeStep].title}
      </h4>
      <p style={{ fontSize: 13.5, color: "var(--glass-ink-soft)", lineHeight: 1.7 }}>{steps[activeStep].body}</p>
      <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
        <button
          onClick={() => setActiveStep((s) => Math.max(0, s - 1))}
          disabled={activeStep === 0}
          style={{
            padding: "9px 18px",
            borderRadius: 9,
            border: "1px solid var(--glass-border)",
            background: "transparent",
            color: "var(--glass-ink-soft)",
            fontWeight: 600,
            fontSize: 13,
            cursor: activeStep === 0 ? "default" : "pointer",
            opacity: activeStep === 0 ? 0.4 : 1,
            fontFamily: "'Manrope', sans-serif",
          }}
        >
          ← Précédent
        </button>
        <button
          onClick={() => setActiveStep((s) => Math.min(steps.length - 1, s + 1))}
          disabled={activeStep === steps.length - 1}
          style={{
            flex: 1,
            padding: "9px 18px",
            borderRadius: 9,
            border: "none",
            background: accent,
            color: "white",
            fontWeight: 700,
            fontSize: 13,
            cursor: activeStep === steps.length - 1 ? "default" : "pointer",
            opacity: activeStep === steps.length - 1 ? 0.5 : 1,
            fontFamily: "'Manrope', sans-serif",
          }}
        >
          Suivant →
        </button>
      </div>
    </div>
  );
}

export function InfoPanel({ tool }: ToolViewProps) {
  const isALE = tool.title.includes("ALE");

  const content = isALE
    ? {
        intro:
          "L'ALE (Agence Locale pour l'Emploi) permet aux chômeurs complets et aux bénéficiaires du RIS d'effectuer de petits travaux autorisés contre des chèques-ALE.",
        items: [
          [
            "Qui peut travailler via l'ALE ?",
            "Chômeurs complets indemnisés depuis ≥ 6 mois, bénéficiaires du RIS, chômeurs de 60+.",
          ],
          [
            "Quelles activités ?",
            "Aide à domicile, jardinage, petits travaux, cours particuliers, aide aux personnes âgées...",
          ],
          [
            "Combien peut-on gagner ?",
            "Maximum 630 heures/an (850h si 50+). Pas d'impact sur les allocations dans la limite autorisée.",
          ],
          [
            "Comment s'inscrire ?",
            "Contactez l'ALE de votre commune. Apportez votre carte SIS, carte d'identité et attestation de chômage.",
          ],
        ],
      }
    : {
        intro:
          "Lorsque vos allocations de chômage arrivent à leur terme (fin de droits), le CPAS de votre commune peut vous accorder le Revenu d'Intégration Sociale (RIS).",
        items: [
          [
            "Conditions d'accès",
            "Avoir la nationalité belge ou un titre de séjour valide, résider en Belgique, être dans le besoin, disponible au travail.",
          ],
          [
            "Montants RIS 2026",
            "Personne isolée : 1.409 €/mois. Cohabitant : 940 €/mois. Chef de famille : 1.880 €/mois.",
          ],
          [
            "Documents à apporter",
            "Preuve de fin de droits ONEM, carte d'identité, composition de ménage, preuves de revenus, IBAN.",
          ],
          ["Délai de traitement", "Le CPAS dispose de 30 jours (prolongeable à 45 jours) pour prendre une décision."],
        ],
      };

  return (
    <div>
      <p style={{ fontSize: 13.5, color: "var(--glass-ink-soft)", marginBottom: 20, lineHeight: 1.65 }}>{content.intro}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {content.items.map(([title, body]) => (
          <div
            key={title}
            style={{
              padding: "14px 16px",
              borderRadius: 12,
              background: "var(--glass-surface)",
              border: "1px solid var(--glass-border)",
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--glass-ink)", marginBottom: 5 }}>{title}</div>
            <div style={{ fontSize: 12.5, color: "var(--glass-ink-soft)", lineHeight: 1.6 }}>{body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LinkPanel({ tool, accent }: ToolViewProps) {
  const info: Record<string, { url: string; tel: string; desc: string }> = {
    Actiris: {
      url: "actiris.brussels",
      tel: "0800 35 123",
      desc: "Service bruxellois de l'emploi. Inscription obligatoire pour les DE bruxellois. Permanences sans rendez-vous lun-ven 8h30-12h30.",
    },
    VDAB: {
      url: "vdab.be",
      tel: "0800 30 700",
      desc: "Vlaamse Dienst voor Arbeidsbemiddeling. Service flamand de l'emploi et de la formation. Mycareer.be pour votre CV en ligne.",
    },
    FOREM: {
      url: "leforem.be",
      tel: "0800 93 947",
      desc: "Office wallon de la formation et de l'emploi. Inscription en ligne ou dans un bureau local. Accompagnement personnalisé.",
    },
    ADG: {
      url: "adg.be",
      tel: "087 59 64 00",
      desc: "Arbeitsamt der Deutschsprachigen Gemeinschaft. Service de l'emploi pour les 9 communes de la Communauté germanophone.",
    },
  };
  const key = Object.keys(info).find((k) => tool.title.includes(k)) || "Actiris";
  const d = info[key];
  return (
    <div>
      <div
        style={{
          padding: "20px",
          borderRadius: 14,
          background: "var(--glass-surface)",
          border: "1px solid var(--glass-border)",
          marginBottom: 16,
        }}
      >
        <p style={{ fontSize: 13.5, color: "var(--glass-ink-soft)", lineHeight: 1.65, marginBottom: 16 }}>{d.desc}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 13, color: "var(--glass-ink)" }}>
            <strong>🌐 Site web :</strong> <span style={{ color: accent }}>{d.url}</span>
          </div>
          <div style={{ fontSize: 13, color: "var(--glass-ink)" }}>
            <strong>📞 Tél. :</strong> {d.tel}
          </div>
        </div>
      </div>
      <button
        style={{
          width: "100%",
          padding: "11px",
          borderRadius: 10,
          border: "none",
          background: accent,
          color: "white",
          fontWeight: 700,
          fontSize: 14,
          cursor: "pointer",
          fontFamily: "'Manrope', sans-serif",
        }}
      >
        Visiter le site officiel →
      </button>
    </div>
  );
}

export function FormFlow({ tool, accent, lang }: ToolViewProps & { lang: string }) {
  const [step, setStep] = useState(0);
  const labels: Record<string, string[]> = {
    FR: ["Formulaire", "Prévisualisation", "Téléchargement"],
    NL: ["Formulier", "Voorbeeld", "Download"],
    EN: ["Form", "Preview", "Download"],
    DE: ["Formular", "Vorschau", "Download"],
  };
  const steps = labels[lang] || labels.FR;
  const [formData, setFormData] = useState({
    nom: "",
    prenom: "",
    dob: "",
    adresse: "",
    commune: "",
    nrn: "",
  });
  const [loading, setLoading] = useState(false);

  const handleGenerate = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setStep(2);
    }, 1600);
  };

  const fields: [string, keyof typeof formData, string, string][] = [
    ["Nom", "nom", "Dupont", "text"],
    ["Prénom", "prenom", "Jean", "text"],
    ["Date de naissance", "dob", "01/01/1990", "text"],
    ["N° registre national", "nrn", "90.01.01-123.45", "text"],
    ["Adresse", "adresse", "Rue de la Loi 1", "text"],
    ["Commune", "commune", "Bruxelles 1000", "text"],
  ];

  return (
    <div>
      <div style={{ display: "flex", gap: 0, marginBottom: 22 }}>
        {steps.map((s, i) => (
          <button
            key={i}
            onClick={() => i <= step && setStep(i)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              padding: "5px 12px",
              border: "none",
              background: "none",
              cursor: i <= step ? "pointer" : "default",
              color: i === step ? accent : i < step ? "var(--glass-ink-soft)" : "var(--glass-ink-faint)",
              fontSize: 12.5,
              fontWeight: i === step ? 700 : 500,
              fontFamily: "'Manrope', sans-serif",
            }}
          >
            <span
              style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                flexShrink: 0,
                background: i === step ? accent : i < step ? `${accent}20` : "var(--glass-surface)",
                color: i === step ? "white" : i < step ? accent : "var(--glass-ink-faint)",
                fontSize: 10.5,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {i < step ? "✓" : i + 1}
            </span>
            {s}
          </button>
        ))}
      </div>

      {step === 0 && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {fields.map(([label, key, ph, type]) => (
              <div key={key} style={{ gridColumn: key === "adresse" ? "1 / -1" : "auto" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--glass-ink)",
                    marginBottom: 5,
                  }}
                >
                  {label}
                </label>
                <input
                  type={type}
                  placeholder={ph}
                  value={formData[key]}
                  onChange={(e) => setFormData((d) => ({ ...d, [key]: e.target.value }))}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 9,
                    border: "1.5px solid var(--glass-border)",
                    background: "var(--glass-surface)",
                    color: "var(--glass-ink)",
                    fontSize: 13,
                    fontFamily: "'Manrope', sans-serif",
                    outline: "none",
                    transition: "border 0.15s",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = accent)}
                  onBlur={(e) => (e.target.style.borderColor = "var(--glass-border)")}
                />
              </div>
            ))}
          </div>
          <button
            onClick={() => setStep(1)}
            style={{
              marginTop: 20,
              padding: "10px 24px",
              borderRadius: 10,
              border: "none",
              background: accent,
              color: "white",
              fontWeight: 700,
              fontSize: 13.5,
              cursor: "pointer",
              fontFamily: "'Manrope', sans-serif",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            Prévisualiser <ArrowIcon size={14} />
          </button>
        </div>
      )}

      {step === 1 && (
        <div>
          <div
            style={{
              background: "var(--glass-surface)",
              border: "1px solid var(--glass-border)",
              borderRadius: 12,
              padding: "24px",
              fontFamily: "monospace",
            }}
          >
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <BelgianFlag />
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--glass-ink)", marginTop: 10 }}>
                ROYAUME DE BELGIQUE — ONEM
              </div>
              <div style={{ height: 1, background: "var(--glass-border)", margin: "14px 0" }}></div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--glass-ink)", textTransform: "uppercase" }}>
                {tool.title}
              </div>
            </div>
            <div style={{ fontSize: 12.5, color: "var(--glass-ink)", lineHeight: 2 }}>
              <div>
                <strong>Nom :</strong> {formData.nom || "DUPONT"}
              </div>
              <div>
                <strong>Prénom :</strong> {formData.prenom || "Jean"}
              </div>
              <div>
                <strong>Date de naissance :</strong> {formData.dob || "01/01/1990"}
              </div>
              <div>
                <strong>N° Reg. nat. :</strong> {formData.nrn || "90.01.01-123.45"}
              </div>
              <div>
                <strong>Adresse :</strong> {formData.adresse || "Rue de la Loi 1"}
              </div>
              <div>
                <strong>Commune :</strong> {formData.commune || "Bruxelles 1000"}
              </div>
            </div>
            <div style={{ height: 1, background: "var(--glass-border)", margin: "16px 0" }}></div>
            <div style={{ fontSize: 11, color: "var(--glass-ink-soft)", textAlign: "right" }}>
              Généré le {new Date().toLocaleDateString("fr-BE")} via DocBel
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button
              onClick={() => setStep(0)}
              style={{
                padding: "9px 18px",
                borderRadius: 9,
                border: "1px solid var(--glass-border)",
                background: "transparent",
                color: "var(--glass-ink-soft)",
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
                fontFamily: "'Manrope', sans-serif",
              }}
            >
              ← Modifier
            </button>
            <button
              onClick={handleGenerate}
              disabled={loading}
              style={{
                flex: 1,
                padding: "10px 24px",
                borderRadius: 10,
                border: "none",
                background: accent,
                color: "white",
                fontWeight: 700,
                fontSize: 13.5,
                cursor: "pointer",
                fontFamily: "'Manrope', sans-serif",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "Génération…" : "Générer le document PDF"}
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <div style={{ textAlign: "center", padding: "16px 0 20px" }}>
            <div style={{ fontSize: 42, marginBottom: 10 }}>✅</div>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: "var(--glass-ink)", marginBottom: 6 }}>Document prêt !</h3>
            <p style={{ fontSize: 13, color: "var(--glass-ink-soft)", marginBottom: 16 }}>
              Votre {tool.title.toLowerCase()} a été généré avec succès.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button
                style={{
                  padding: "10px 22px",
                  borderRadius: 10,
                  border: `1.5px solid ${accent}`,
                  background: "transparent",
                  color: accent,
                  fontWeight: 700,
                  fontSize: 13.5,
                  cursor: "pointer",
                  fontFamily: "'Manrope', sans-serif",
                }}
              >
                Aperçu PDF
              </button>
              <button
                style={{
                  padding: "10px 22px",
                  borderRadius: 10,
                  border: "none",
                  background: accent,
                  color: "white",
                  fontWeight: 700,
                  fontSize: 13.5,
                  cursor: "pointer",
                  fontFamily: "'Manrope', sans-serif",
                }}
              >
                ↓ Télécharger
              </button>
            </div>
          </div>
          {/* BureauCallout AVANT le bouton download (l'étape suivante visuelle) */}
          <BureauCallout organismeCode={inferOrganismeFromTool(tool)} accent={accent} />
        </div>
      )}
    </div>
  );
}

/** Heuristique pour déduire l'organisme cible d'un outil (FormFlow démo). */
function inferOrganismeFromTool(tool: Tool): string | null {
  const t = `${tool.title} ${tool.desc}`.toLowerCase();
  if (t.includes("cpas") || t.includes("ris") || t.includes("aide sociale") || t.includes("intégration sociale"))
    return "cpas";
  if (t.includes("commune") || t.includes("hôtel de ville") || t.includes("état civil"))
    return "commune";
  if (t.includes("c4") || t.includes("c1") || t.includes("chômage") || t.includes("onem"))
    return "onem";
  if (t.includes("syndicat") || t.includes("paiement") || t.includes("capac")) return "capac";
  return null;
}
