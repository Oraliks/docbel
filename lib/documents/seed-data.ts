import { DocumentField, GenerationPayload } from "./types";

/// Génère un payload réaliste pour tester un template sans saisie manuelle.
/// Utilisé par le bouton "Tester avec données fictives" dans l'admin.

const FIRST_NAMES = ["Jean", "Marie", "Lucas", "Emma", "Pierre", "Sofia", "Hugo", "Léa", "Mehdi", "Anaïs"];
const LAST_NAMES = ["Dupont", "Janssens", "Peeters", "Martin", "De Smet", "Lambert", "Vermeulen", "Dubois"];
const STREETS = ["Rue de la Loi", "Avenue Louise", "Chaussée de Wavre", "Rue Neuve", "Boulevard Anspach"];
const CITIES = [
  { postal: "1000", city: "Bruxelles" },
  { postal: "4000", city: "Liège" },
  { postal: "9000", city: "Gand" },
  { postal: "5000", city: "Namur" },
  { postal: "2000", city: "Anvers" },
  { postal: "1300", city: "Wavre" },
];
const COMPANIES = [
  "Belgacom SA",
  "Solvay Pharma",
  "Carrefour Belgium",
  "Engie Electrabel",
  "Proximus",
  "Acme Consulting SPRL",
];
const JOB_TITLES = ["Consultant", "Comptable", "Vendeur", "Développeur", "Manager", "Ouvrier"];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function genNiss(): string {
  // YY MM DD CCC AB où AB = 97 - (YYMMDD * 1000 + CCC) % 97
  const year = 70 + Math.floor(Math.random() * 35);
  const month = String(1 + Math.floor(Math.random() * 12)).padStart(2, "0");
  const day = String(1 + Math.floor(Math.random() * 28)).padStart(2, "0");
  const counter = String(Math.floor(Math.random() * 999)).padStart(3, "0");
  const base = `${String(year).padStart(2, "0")}${month}${day}${counter}`;
  const check = String(97 - (parseInt(base, 10) % 97)).padStart(2, "0");
  return `${base}${check}`;
}

function genBce(): string {
  // 0XXX XXX XXX où le check passe modulo 97
  for (let i = 0; i < 100; i++) {
    const head = `0${Math.floor(100000000 + Math.random() * 900000000)
      .toString()
      .slice(0, 8)}`;
    const check = String(97 - (parseInt(head, 10) % 97)).padStart(2, "0");
    const result = head + check;
    // Validate (sanity)
    const base = parseInt(result.slice(0, 8), 10);
    if ((97 - (base % 97)) === parseInt(result.slice(8, 10), 10)) {
      return result;
    }
  }
  return "0123456789";
}

function genIban(): string {
  // BE + check2 + 12 digits — calcul réel modulo 97
  for (let i = 0; i < 100; i++) {
    const acc = Math.floor(100000000000 + Math.random() * 900000000000).toString();
    const rearranged = acc + "111400"; // BE = 11 14
    let remainder = 0;
    for (let j = 0; j < rearranged.length; j += 7) {
      const chunk = remainder.toString() + rearranged.slice(j, j + 7);
      remainder = parseInt(chunk, 10) % 97;
    }
    const check = String(98 - remainder).padStart(2, "0");
    const iban = `BE${check}${acc}`;
    return iban;
  }
  return "BE68539007547034";
}

function genDate(yearsBack = 30): string {
  const now = Date.now();
  const offset = Math.floor(Math.random() * yearsBack * 365 * 24 * 60 * 60 * 1000);
  const d = new Date(now - offset);
  return d.toISOString().slice(0, 10);
}

export function generateSeedPayload(fields: DocumentField[]): GenerationPayload {
  const payload: GenerationPayload = {};
  const cityChoice = pick(CITIES);
  const firstName = pick(FIRST_NAMES);
  const lastName = pick(LAST_NAMES);
  const fullName = `${firstName} ${lastName}`;

  for (const f of fields) {
    const id = f.id.toLowerCase();
    let v: string | number | boolean | null = null;

    switch (f.type) {
      case "checkbox":
        v = Math.random() > 0.5;
        break;
      case "number":
        v = f.minValue != null && f.maxValue != null
          ? Math.floor(f.minValue + Math.random() * (f.maxValue - f.minValue))
          : Math.floor(100 + Math.random() * 9000);
        break;
      case "date":
        v = genDate();
        break;
      case "niss":
        v = genNiss();
        break;
      case "iban":
        v = genIban();
        break;
      case "bce":
      case "tva_be":
        v = genBce();
        break;
      case "postal_be":
        v = cityChoice.postal;
        break;
      case "phone_be":
        v = `+32${Math.floor(400000000 + Math.random() * 99999999)}`;
        break;
      case "select":
        v = f.options?.[0]?.value ?? "";
        break;
      case "signature":
        // Signature gérée séparément
        v = null;
        break;
      case "text":
      case "textarea":
      default:
        // Heuristique selon le label / id
        if (id.includes("niss")) v = genNiss();
        else if (id.includes("iban")) v = genIban();
        else if (id.includes("bce") || id.includes("entreprise")) v = genBce();
        else if (id.includes("postal") || id.includes("cp")) v = cityChoice.postal;
        else if (id.includes("city") || id.includes("ville") || id.includes("commune"))
          v = cityChoice.city;
        else if (id.includes("street") || id.includes("rue") || id.includes("adresse"))
          v = pick(STREETS);
        else if (id.includes("num") && (id.includes("rue") || id.includes("street")))
          v = String(Math.floor(1 + Math.random() * 200));
        else if (id.includes("first") || id.includes("prenom")) v = firstName;
        else if (id.includes("last") || id.includes("nom_famille") || id === "nom") v = lastName;
        else if (id.includes("name") || id.includes("nom")) v = fullName;
        else if (id.includes("email")) v = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.be`;
        else if (id.includes("phone") || id.includes("tel"))
          v = `+32${Math.floor(400000000 + Math.random() * 99999999)}`;
        else if (id.includes("employer") || id.includes("entreprise") || id.includes("company"))
          v = pick(COMPANIES);
        else if (id.includes("job") || id.includes("fonction") || id.includes("poste"))
          v = pick(JOB_TITLES);
        else if (id.includes("date")) v = genDate();
        else if (id.includes("amount") || id.includes("montant") || id.includes("salaire"))
          v = String(1500 + Math.floor(Math.random() * 4500));
        else v = `Test ${cleanLabel(f.label)}`;
    }

    payload[f.id] = v;
  }

  return payload;
}

/// Le label d'un champ peut contenir des caractères exotiques (PUA, etc.)
/// extraits d'un PDF avec polices custom. On nettoie pour ne pas casser le rendu.
function cleanLabel(label: string): string {
  return (
    label
      .replace(/[-]/g, "") // PUA (Wingdings/Symbol)
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[–—]/g, "-")
      .replace(/[^ -ÿ]/g, "")
      .trim()
      .slice(0, 30) || "Champ"
  );
}
