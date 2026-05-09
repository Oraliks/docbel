import { PrismaClient } from "@prisma/client";

interface PresetSeed {
  name: string;
  description?: string;
  category: "identity" | "contact" | "financial" | "date" | "belgian" | "address" | "custom";
  fieldType: string;
  regex?: string;
  regexFlags?: string;
  minLength?: number;
  maxLength?: number;
  minValue?: number;
  maxValue?: number;
  minDate?: string;
  maxDate?: string;
  belgianType?: "niss" | "iban" | "tva" | "bce" | "postal" | "phone";
  errorMsg: string;
  errorMsgNl?: string;
  helpText?: string;
  helpTextNl?: string;
  placeholder?: string;
  placeholderNl?: string;
  icon?: string;
  color?: string;
}

const PRESETS: PresetSeed[] = [
  // === Identité ===
  {
    name: "Nom de famille",
    description: "Nom légal — lettres uniquement, accents, tirets et apostrophes autorisés.",
    category: "identity",
    fieldType: "text",
    regex: "^[A-Za-zÀ-ÖØ-öø-ÿ' \\-]{1,80}$",
    minLength: 1,
    maxLength: 80,
    errorMsg: "Nom invalide. Lettres, espaces, tirets et apostrophes uniquement.",
    errorMsgNl: "Ongeldige naam. Alleen letters, spaties, koppeltekens en apostrofs.",
    placeholder: "Dupont",
    icon: "User",
  },
  {
    name: "Prénom",
    description: "Prénom — lettres uniquement, accents, tirets et apostrophes autorisés.",
    category: "identity",
    fieldType: "text",
    regex: "^[A-Za-zÀ-ÖØ-öø-ÿ' \\-]{1,60}$",
    minLength: 1,
    maxLength: 60,
    errorMsg: "Prénom invalide. Lettres, espaces, tirets et apostrophes uniquement.",
    errorMsgNl: "Ongeldige voornaam.",
    placeholder: "Jean",
    icon: "User",
  },
  {
    name: "Nom complet (prénom + nom)",
    description: "Nom et prénom sur une seule ligne.",
    category: "identity",
    fieldType: "text",
    regex: "^[A-Za-zÀ-ÖØ-öø-ÿ' \\-]{2,140}$",
    minLength: 2,
    maxLength: 140,
    errorMsg: "Nom complet invalide.",
    placeholder: "Jean Dupont",
    icon: "User",
  },

  // === Belge (validateurs natifs) ===
  {
    name: "NISS belge",
    description: "Numéro d'identification de la sécurité sociale (11 chiffres, validation modulo 97).",
    category: "belgian",
    fieldType: "niss",
    belgianType: "niss",
    errorMsg: "NISS invalide. Format attendu : 11 chiffres (ex : 90.05.27-123.45).",
    errorMsgNl: "Ongeldig rijksregisternummer.",
    placeholder: "90.05.27-123.45",
    helpText: "Le NISS figure au dos de votre carte d'identité électronique.",
    icon: "IdCard",
  },
  {
    name: "IBAN belge",
    description: "Numéro de compte bancaire belge (BE + 14 chiffres).",
    category: "belgian",
    fieldType: "iban",
    belgianType: "iban",
    errorMsg: "IBAN belge invalide. Format attendu : BE68 5390 0754 7034.",
    errorMsgNl: "Ongeldig Belgisch IBAN-nummer.",
    placeholder: "BE68 5390 0754 7034",
    icon: "CreditCard",
  },
  {
    name: "BCE / Numéro d'entreprise",
    description: "Banque-Carrefour des Entreprises (10 chiffres, validation modulo 97).",
    category: "belgian",
    fieldType: "bce",
    belgianType: "bce",
    errorMsg: "Numéro d'entreprise invalide. Format attendu : 0XXX.XXX.XXX (10 chiffres).",
    errorMsgNl: "Ongeldig ondernemingsnummer.",
    placeholder: "0123.456.789",
    helpText: "Vérifiable sur kbopub.economie.fgov.be",
    icon: "Building",
  },
  {
    name: "TVA belge",
    description: "Numéro de TVA belge (BE + 10 chiffres).",
    category: "belgian",
    fieldType: "tva_be",
    belgianType: "tva",
    errorMsg: "Numéro de TVA invalide. Format attendu : BE0XXX.XXX.XXX.",
    errorMsgNl: "Ongeldig BTW-nummer.",
    placeholder: "BE0123.456.789",
    icon: "Receipt",
  },
  {
    name: "Code postal belge",
    description: "Code postal belge (1000 à 9999).",
    category: "belgian",
    fieldType: "postal_be",
    belgianType: "postal",
    errorMsg: "Code postal belge invalide (1000–9999).",
    errorMsgNl: "Ongeldige postcode.",
    placeholder: "1000",
    icon: "MapPin",
  },
  {
    name: "Téléphone belge",
    description: "Numéro fixe ou GSM belge (national ou international +32).",
    category: "belgian",
    fieldType: "phone_be",
    belgianType: "phone",
    errorMsg: "Numéro de téléphone belge invalide.",
    errorMsgNl: "Ongeldig Belgisch telefoonnummer.",
    placeholder: "+32 470 12 34 56",
    icon: "Phone",
  },

  // === Contact ===
  {
    name: "Email",
    description: "Adresse e-mail standard.",
    category: "contact",
    fieldType: "text",
    regex: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$",
    maxLength: 254,
    errorMsg: "Adresse e-mail invalide.",
    errorMsgNl: "Ongeldig e-mailadres.",
    placeholder: "jean.dupont@example.be",
    icon: "Mail",
  },

  // === Adresse ===
  {
    name: "Rue (nom de voie)",
    description: "Nom de rue — lettres, chiffres, accents, tirets, apostrophes.",
    category: "address",
    fieldType: "text",
    regex: "^[A-Za-z0-9À-ÖØ-öø-ÿ' \\-,.]{1,120}$",
    maxLength: 120,
    errorMsg: "Nom de rue invalide.",
    placeholder: "Rue de la Loi",
    icon: "Road",
  },
  {
    name: "Numéro de rue",
    description: "Numéro avec bte/boîte optionnelle (ex : 16, 16A, 16 bte 3).",
    category: "address",
    fieldType: "text",
    regex: "^[0-9]+[A-Za-z]?( ?(bte|boite|boîte) ?[0-9A-Za-z]+)?$",
    regexFlags: "i",
    maxLength: 20,
    errorMsg: "Numéro de rue invalide (ex : 16, 16A, 16 bte 3).",
    placeholder: "16 bte 3",
    icon: "Hash",
  },
  {
    name: "Ville",
    description: "Nom de commune ou ville.",
    category: "address",
    fieldType: "text",
    regex: "^[A-Za-zÀ-ÖØ-öø-ÿ' \\-]{1,80}$",
    maxLength: 80,
    errorMsg: "Nom de ville invalide.",
    placeholder: "Bruxelles",
    icon: "MapPin",
  },

  // === Dates ===
  {
    name: "Date passée",
    description: "Date dans le passé uniquement (jusqu'à aujourd'hui inclus).",
    category: "date",
    fieldType: "date",
    maxDate: "today",
    errorMsg: "La date doit être dans le passé ou aujourd'hui.",
    errorMsgNl: "De datum moet in het verleden of vandaag liggen.",
    icon: "Calendar",
  },
  {
    name: "Date future",
    description: "Date à partir d'aujourd'hui.",
    category: "date",
    fieldType: "date",
    minDate: "today",
    errorMsg: "La date doit être à partir d'aujourd'hui.",
    icon: "Calendar",
  },
  {
    name: "Date de naissance",
    description: "Date entre 1900 et aujourd'hui.",
    category: "date",
    fieldType: "date",
    minDate: "1900-01-01",
    maxDate: "today",
    errorMsg: "Date de naissance invalide (entre 1900 et aujourd'hui).",
    icon: "Cake",
  },
  {
    name: "Date majeur (18+ ans)",
    description: "Date impliquant un âge d'au moins 18 ans.",
    category: "date",
    fieldType: "date",
    minDate: "1900-01-01",
    // maxDate calculé en runtime : aujourd'hui - 18 ans → géré côté validator
    errorMsg: "Vous devez être majeur (18 ans ou plus).",
    icon: "Calendar",
  },

  // === Financier ===
  {
    name: "Montant en euros (positif)",
    description: "Montant ≥ 0 avec 2 décimales max.",
    category: "financial",
    fieldType: "number",
    minValue: 0,
    maxValue: 9999999.99,
    errorMsg: "Montant invalide (≥ 0).",
    placeholder: "0,00",
    icon: "Euro",
  },
  {
    name: "Salaire mensuel brut",
    description: "Salaire mensuel brut en euros (0 à 50 000).",
    category: "financial",
    fieldType: "number",
    minValue: 0,
    maxValue: 50000,
    errorMsg: "Salaire mensuel invalide (0 à 50 000 €).",
    helpText: "Indiquez le montant brut avant retenues sociales et précompte professionnel.",
    placeholder: "2500.00",
    icon: "Euro",
  },
  {
    name: "Pourcentage (0–100)",
    category: "financial",
    fieldType: "number",
    minValue: 0,
    maxValue: 100,
    errorMsg: "Pourcentage invalide (0 à 100).",
    placeholder: "50",
    icon: "Percent",
  },

  // === Custom génériques ===
  {
    name: "Texte court (max 100)",
    description: "Champ texte libre limité à 100 caractères.",
    category: "custom",
    fieldType: "text",
    maxLength: 100,
    errorMsg: "Maximum 100 caractères.",
    icon: "Type",
  },
  {
    name: "Texte long (max 1000)",
    description: "Champ texte libre limité à 1000 caractères.",
    category: "custom",
    fieldType: "textarea",
    maxLength: 1000,
    errorMsg: "Maximum 1000 caractères.",
    icon: "FileText",
  },
];

export async function seedFieldValidationPresets(prisma: PrismaClient) {
  let created = 0;
  let updated = 0;

  for (const preset of PRESETS) {
    const existing = await prisma.fieldValidationPreset.findUnique({
      where: { name: preset.name },
    });
    if (existing) {
      // Si builtin existait déjà, on met à jour (on assume que les builtin sont la source de vérité)
      if (existing.builtin) {
        await prisma.fieldValidationPreset.update({
          where: { name: preset.name },
          data: { ...preset, builtin: true },
        });
        updated++;
      }
    } else {
      await prisma.fieldValidationPreset.create({
        data: { ...preset, builtin: true },
      });
      created++;
    }
  }

  console.log(`  ✓ Presets de validation : ${created} créés, ${updated} mis à jour`);
}
