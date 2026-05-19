import { PrismaClient } from "@prisma/client";

/// Bibliothèque canonique de champs réutilisables (migration 13).
///
/// Source UNIQUE des `FieldValidationPreset` builtin. Sert à la fois :
///   - de validation (regex, belgianType, errorMsg)
///   - de "template de champ" via la palette de l'éditeur visuel
///     (`defaultLabel`, `defaultWidth`, `defaultHeight`, `defaultValue`,
///     `defaultOptions`). Le picker filtre sur `defaultLabel != null` pour ne
///     proposer que les vrais canoniques.
///
/// Conventions :
///   - `popular: true` → apparaît dans la palette rapide (~12 max)
///   - `category` ∈ identity | contact | address | bank | employer | social | document | other
///   - `defaultWidth/Height` en POINTS PDF (origine bas-gauche, échelle native)
///
/// Idempotent : upsert par `name` (unique). Re-runnable sans danger.

export interface CanonicalFieldSeed {
  name: string; // identifiant unique (slug-like), sert de clé d'upsert
  defaultLabel: string;
  description?: string;
  category: string;
  fieldType: string;
  belgianType?: string | null;
  defaultWidth: number;
  defaultHeight: number;
  defaultValue?: string;
  defaultOptions?: { value: string; label: string }[];
  helpText?: string;
  placeholder?: string;
  errorMsg?: string;
  regex?: string;
  popular?: boolean;
  icon?: string;
}

export const CANONICAL_FIELDS: CanonicalFieldSeed[] = [
  // ========================================================================
  // IDENTITÉ
  // ========================================================================
  {
    name: "NISS",
    defaultLabel: "NISS",
    description: "Numéro de Registre national belge",
    category: "identity",
    fieldType: "niss",
    belgianType: "niss",
    defaultWidth: 150,
    defaultHeight: 14,
    helpText: "Trouvez votre NISS sur votre carte d'identité (11 chiffres)",
    placeholder: "XX.XX.XX-XXX.XX",
    errorMsg: "Numéro NISS invalide (format XX.XX.XX-XXX.XX, 11 chiffres)",
    popular: true,
    icon: "IdCard",
  },
  {
    name: "Nom",
    defaultLabel: "Nom",
    description: "Nom de famille",
    category: "identity",
    fieldType: "text",
    defaultWidth: 200,
    defaultHeight: 14,
    placeholder: "Dupont",
    popular: true,
    icon: "Type",
  },
  {
    name: "Prénom",
    defaultLabel: "Prénom",
    category: "identity",
    fieldType: "text",
    defaultWidth: 200,
    defaultHeight: 14,
    placeholder: "Jean",
    popular: true,
    icon: "Type",
  },
  {
    name: "Prénom et nom",
    defaultLabel: "Prénom et nom",
    description: "Champ combiné prénom + nom (utilisé sur certains formulaires)",
    category: "identity",
    fieldType: "text",
    defaultWidth: 300,
    defaultHeight: 14,
    placeholder: "Jean Dupont",
    popular: true,
    icon: "Type",
  },
  {
    name: "Date de naissance",
    defaultLabel: "Date de naissance",
    category: "identity",
    fieldType: "date",
    defaultWidth: 80,
    defaultHeight: 14,
    placeholder: "JJ/MM/AAAA",
    popular: true,
    icon: "Calendar",
  },
  {
    name: "Lieu de naissance",
    defaultLabel: "Lieu de naissance",
    category: "identity",
    fieldType: "text",
    defaultWidth: 200,
    defaultHeight: 14,
    icon: "MapPin",
  },
  {
    name: "Nationalité",
    defaultLabel: "Nationalité",
    category: "identity",
    fieldType: "text",
    defaultWidth: 150,
    defaultHeight: 14,
    defaultValue: "Belge",
    icon: "Type",
  },
  {
    name: "Sexe",
    defaultLabel: "Sexe",
    category: "identity",
    fieldType: "select",
    defaultWidth: 80,
    defaultHeight: 14,
    defaultOptions: [
      { value: "M", label: "Masculin" },
      { value: "F", label: "Féminin" },
    ],
    icon: "Type",
  },
  {
    name: "Accès au marché de l'emploi",
    defaultLabel: "Accès au marché de l'emploi",
    description: "Droit de travailler en Belgique (pour étrangers)",
    category: "identity",
    fieldType: "select",
    defaultWidth: 200,
    defaultHeight: 14,
    defaultOptions: [
      { value: "illimite", label: "Accès illimité" },
      { value: "limite", label: "Accès limité" },
      { value: "aucun", label: "Aucun accès" },
    ],
  },
  {
    name: "Statut de réfugié ou apatride",
    defaultLabel: "Statut de réfugié ou apatride",
    category: "identity",
    fieldType: "select",
    defaultWidth: 200,
    defaultHeight: 14,
    defaultOptions: [
      { value: "refugie", label: "Statut de réfugié" },
      { value: "apatride", label: "Apatride reconnu" },
      { value: "non_applicable", label: "Non applicable" },
    ],
  },

  // ========================================================================
  // CONTACT
  // ========================================================================
  {
    name: "Email",
    defaultLabel: "Adresse e-mail",
    category: "contact",
    fieldType: "text",
    defaultWidth: 250,
    defaultHeight: 14,
    regex: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$",
    errorMsg: "Adresse e-mail invalide",
    placeholder: "jean.dupont@exemple.be",
    popular: true,
    icon: "Type",
  },
  {
    name: "Téléphone",
    defaultLabel: "Téléphone",
    description: "Téléphone fixe ou GSM — accepte +32 belge ou international",
    category: "contact",
    fieldType: "phone_be",
    belgianType: "phone",
    defaultWidth: 150,
    defaultHeight: 14,
    placeholder: "+32 470 12 34 56",
    errorMsg: "Numéro de téléphone invalide",
    popular: true,
    icon: "Phone",
  },

  // ========================================================================
  // ADRESSE
  // ========================================================================
  {
    name: "Rue",
    defaultLabel: "Rue / Avenue / Chaussée",
    category: "address",
    fieldType: "text",
    defaultWidth: 250,
    defaultHeight: 14,
    placeholder: "Rue de la Loi",
    popular: true,
    icon: "MapPin",
  },
  {
    name: "Numéro de rue",
    defaultLabel: "Numéro",
    category: "address",
    fieldType: "text",
    defaultWidth: 60,
    defaultHeight: 14,
    placeholder: "16",
    icon: "Hash",
  },
  {
    name: "Numéro de boîte",
    defaultLabel: "Boîte",
    description: "Numéro de boîte aux lettres (optionnel)",
    category: "address",
    fieldType: "text",
    defaultWidth: 60,
    defaultHeight: 14,
    placeholder: "A",
    icon: "Hash",
  },
  {
    name: "Code postal",
    defaultLabel: "Code postal",
    category: "address",
    fieldType: "postal_be",
    belgianType: "postal",
    defaultWidth: 60,
    defaultHeight: 14,
    placeholder: "1000",
    errorMsg: "Code postal belge invalide (4 chiffres)",
    popular: true,
    icon: "MapPin",
  },
  {
    name: "Commune",
    defaultLabel: "Commune",
    category: "address",
    fieldType: "text",
    defaultWidth: 150,
    defaultHeight: 14,
    placeholder: "Bruxelles",
    popular: true,
    icon: "MapPin",
  },
  {
    name: "Pays",
    defaultLabel: "Pays",
    category: "address",
    fieldType: "text",
    defaultWidth: 120,
    defaultHeight: 14,
    defaultValue: "Belgique",
    icon: "MapPin",
  },

  // ========================================================================
  // BANCAIRE
  // ========================================================================
  {
    name: "IBAN",
    defaultLabel: "IBAN",
    description: "Numéro de compte international (BE, FR, LU, Revolut LT, etc.)",
    category: "bank",
    fieldType: "iban",
    belgianType: "iban",
    defaultWidth: 250,
    defaultHeight: 14,
    placeholder: "BE68 5390 0754 7034",
    errorMsg: "IBAN invalide",
    popular: true,
    icon: "CreditCard",
  },
  {
    name: "BIC",
    defaultLabel: "Code BIC",
    description: "Code SWIFT/BIC de la banque (8 ou 11 caractères)",
    category: "bank",
    fieldType: "text",
    defaultWidth: 120,
    defaultHeight: 14,
    regex: "^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$",
    placeholder: "GKCCBEBB",
    icon: "CreditCard",
  },
  {
    name: "Titulaire du compte",
    defaultLabel: "Titulaire du compte",
    description: "Nom du titulaire si différent du demandeur (Revolut, tiers...)",
    category: "bank",
    fieldType: "text",
    defaultWidth: 200,
    defaultHeight: 14,
    icon: "Type",
  },

  // ========================================================================
  // EMPLOYEUR
  // ========================================================================
  {
    name: "N° BCE",
    defaultLabel: "N° BCE (Banque-Carrefour des Entreprises)",
    description:
      "Numéro d'entreprise belge — déclenche le lookup auto pour remplir ONSS + nom",
    category: "employer",
    fieldType: "bce",
    belgianType: "bce",
    defaultWidth: 120,
    defaultHeight: 14,
    placeholder: "0XXX.XXX.XXX",
    errorMsg: "Numéro BCE invalide",
    popular: true,
    icon: "Building2",
  },
  {
    name: "N° ONSS",
    defaultLabel: "N° ONSS",
    description: "Auto-rempli par lookup BCE quand possible",
    category: "employer",
    fieldType: "text",
    defaultWidth: 120,
    defaultHeight: 14,
    icon: "Building2",
  },
  {
    name: "Nom employeur",
    defaultLabel: "Nom de l'employeur",
    description: "Auto-rempli par lookup BCE quand possible",
    category: "employer",
    fieldType: "text",
    defaultWidth: 300,
    defaultHeight: 14,
    icon: "Building2",
  },
  {
    name: "Statut professionnel",
    defaultLabel: "Statut professionnel",
    description: "Ouvrier ou employé (mutuellement exclusif)",
    category: "employer",
    fieldType: "select",
    defaultWidth: 150,
    defaultHeight: 14,
    defaultOptions: [
      { value: "ouvrier", label: "Ouvrier" },
      { value: "employe", label: "Employé" },
    ],
    icon: "Building2",
  },

  // ========================================================================
  // SOCIAL — spécifique démarches chômage
  // ========================================================================
  {
    name: "Période - date de début",
    defaultLabel: "Date de début",
    description: "Date de début d'une période (incapacité, indisponibilité...)",
    category: "social",
    fieldType: "date",
    defaultWidth: 80,
    defaultHeight: 14,
    icon: "Calendar",
  },
  {
    name: "Période - date de fin",
    defaultLabel: "Date de fin",
    category: "social",
    fieldType: "date",
    defaultWidth: 80,
    defaultHeight: 14,
    icon: "Calendar",
  },
  {
    name: "Situation familiale",
    defaultLabel: "Situation familiale",
    category: "social",
    fieldType: "select",
    defaultWidth: 200,
    defaultHeight: 14,
    defaultOptions: [
      { value: "seul", label: "J'habite seul(e)" },
      { value: "cohabite", label: "Je cohabite avec une ou plusieurs personnes" },
    ],
  },
  {
    name: "Nom et prénom d'un proche",
    defaultLabel: "Nom et prénom",
    category: "social",
    fieldType: "text",
    defaultWidth: 250,
    defaultHeight: 14,
  },
  {
    name: "Lien de parenté",
    defaultLabel: "Lien de parenté",
    category: "social",
    fieldType: "text",
    defaultWidth: 150,
    defaultHeight: 14,
  },
  {
    name: "Revenu professionnel oui/non",
    defaultLabel: "Revenu professionnel ?",
    category: "social",
    fieldType: "select",
    defaultWidth: 80,
    defaultHeight: 14,
    defaultOptions: [
      { value: "non", label: "Non" },
      { value: "oui", label: "Oui" },
    ],
  },
  {
    name: "Montant mensuel brut",
    defaultLabel: "Montant mensuel brut (€)",
    category: "social",
    fieldType: "number",
    defaultWidth: 100,
    defaultHeight: 14,
    placeholder: "0.00",
    icon: "Hash",
  },
  {
    name: "Type de demandeur",
    defaultLabel: "Type de demandeur",
    category: "social",
    fieldType: "select",
    defaultWidth: 250,
    defaultHeight: 14,
    defaultOptions: [
      { value: "chomeur_complet", label: "Chômeur complet" },
      { value: "temps_partiel", label: "Travailleur à temps partiel" },
    ],
  },
  {
    name: "Autorisation cotisation syndicale",
    defaultLabel: "Cotisation syndicale",
    category: "social",
    fieldType: "select",
    defaultWidth: 200,
    defaultHeight: 14,
    defaultOptions: [
      { value: "autorise", label: "J'autorise la retenue" },
      { value: "refuse", label: "Je n'autorise plus la retenue" },
    ],
  },
  {
    name: "Incapacité travail permanente",
    defaultLabel: "Incapacité de travail permanente ≥33% ?",
    category: "social",
    fieldType: "select",
    defaultWidth: 80,
    defaultHeight: 14,
    defaultOptions: [
      { value: "non", label: "Non" },
      { value: "oui", label: "Oui" },
    ],
  },

  // ========================================================================
  // DOCUMENT
  // ========================================================================
  {
    name: "Date de signature",
    defaultLabel: "Date de signature",
    category: "document",
    fieldType: "date",
    defaultWidth: 80,
    defaultHeight: 14,
    popular: true,
    icon: "Calendar",
  },
  {
    name: "Signature travailleur",
    defaultLabel: "Signature du travailleur",
    description: "Canvas dessin (crayon numérique ou doigt sur tactile) obligatoire",
    category: "document",
    fieldType: "signature",
    defaultWidth: 150,
    defaultHeight: 40,
    popular: true,
    icon: "PenTool",
  },
  {
    name: "Signature employeur",
    defaultLabel: "Signature de l'employeur",
    description: "Canvas dessin obligatoire — distinct de la signature du travailleur",
    category: "document",
    fieldType: "signature",
    defaultWidth: 150,
    defaultHeight: 40,
    icon: "PenTool",
  },
  {
    name: "Date générique",
    defaultLabel: "Date",
    description: "Champ date générique (date du jour, date de l'événement...)",
    category: "document",
    fieldType: "date",
    defaultWidth: 80,
    defaultHeight: 14,
    icon: "Calendar",
  },
  {
    name: "Nombre de jours de travail",
    defaultLabel: "Nombre de jours de travail",
    category: "document",
    fieldType: "number",
    defaultWidth: 70,
    defaultHeight: 14,
    icon: "Hash",
  },
  {
    name: "Nombre d'heures de travail",
    defaultLabel: "Nombre d'heures de travail",
    category: "document",
    fieldType: "number",
    defaultWidth: 70,
    defaultHeight: 14,
    icon: "Hash",
  },
  {
    name: "Déclaration sur l'honneur",
    defaultLabel: "Déclaration sur l'honneur",
    description: "Case à cocher d'attestation",
    category: "document",
    fieldType: "checkbox",
    defaultWidth: 14,
    defaultHeight: 14,
    icon: "CheckSquare",
  },
  {
    name: "Documents joints",
    defaultLabel: "Documents joints",
    category: "document",
    fieldType: "text",
    defaultWidth: 250,
    defaultHeight: 14,
  },

  // ========================================================================
  // AUTRE
  // ========================================================================
  {
    name: "Remarques",
    defaultLabel: "Remarques ou informations complémentaires",
    category: "other",
    fieldType: "textarea",
    defaultWidth: 400,
    defaultHeight: 60,
    icon: "AlignLeft",
  },
];

/// Seed des FieldValidationPreset à partir de CANONICAL_FIELDS.
///
/// Upsert par `name` : ré-exécutable, met à jour les presets existants avec les
/// nouvelles méta-données canoniques.
export async function seedFieldValidationPresets(prisma: PrismaClient) {
  let created = 0;
  let updated = 0;

  for (const field of CANONICAL_FIELDS) {
    const data = {
      name: field.name,
      description: field.description ?? null,
      category: field.category,
      fieldType: field.fieldType,
      belgianType: field.belgianType ?? null,
      defaultLabel: field.defaultLabel,
      defaultWidth: field.defaultWidth,
      defaultHeight: field.defaultHeight,
      defaultValue: field.defaultValue ?? null,
      defaultOptions: field.defaultOptions
        ? (field.defaultOptions as unknown as object)
        : undefined,
      regex: field.regex ?? null,
      errorMsg: field.errorMsg ?? `Valeur invalide pour "${field.name}"`,
      helpText: field.helpText ?? null,
      placeholder: field.placeholder ?? null,
      icon: field.icon ?? null,
      builtin: true,
      popular: field.popular ?? false,
    };

    const existing = await prisma.fieldValidationPreset.findUnique({
      where: { name: field.name },
    });
    if (existing) {
      await prisma.fieldValidationPreset.update({
        where: { id: existing.id },
        data,
      });
      updated++;
    } else {
      await prisma.fieldValidationPreset.create({ data });
      created++;
    }
  }

  console.log(
    `  ✓ Presets canoniques : ${created} créés, ${updated} mis à jour (total ${CANONICAL_FIELDS.length})`
  );
}
