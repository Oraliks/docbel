/// Liste des pays du monde (nom FR + code ISO 3166-1 alpha-2), pour le
/// sélecteur "pays" avec recherche + drapeau (cf. CountrySelectInput). Codes
/// utilisés UNIQUEMENT pour dériver le drapeau (emoji, cf. `flagEmoji`) — la
/// valeur stockée dans le formulaire reste le NOM (ex. "Maroc"), pas le code,
/// pour rester compatible avec `derivedFrom: postal-be-country` (qui renvoie
/// "Belgique") et le stamping PDF existant (texte brut, aucun changement).
/// Périmètre : ~195 états souverains couramment reconnus + quelques
/// territoires fréquents comme pays d'origine (Taïwan, Hong Kong) — pas les
/// ~249 entités ISO complètes (îles inhabitées, territoires très rares en
/// pratique pour un champ "pays de résidence").
export interface WorldCountry {
  code: string;
  name: string;
}

export const WORLD_COUNTRIES: WorldCountry[] = [
  { code: "AF", name: "Afghanistan" },
  { code: "ZA", name: "Afrique du Sud" },
  { code: "AL", name: "Albanie" },
  { code: "DZ", name: "Algérie" },
  { code: "DE", name: "Allemagne" },
  { code: "AD", name: "Andorre" },
  { code: "AO", name: "Angola" },
  { code: "AG", name: "Antigua-et-Barbuda" },
  { code: "SA", name: "Arabie saoudite" },
  { code: "AR", name: "Argentine" },
  { code: "AM", name: "Arménie" },
  { code: "AU", name: "Australie" },
  { code: "AT", name: "Autriche" },
  { code: "AZ", name: "Azerbaïdjan" },
  { code: "BS", name: "Bahamas" },
  { code: "BH", name: "Bahreïn" },
  { code: "BD", name: "Bangladesh" },
  { code: "BB", name: "Barbade" },
  { code: "BE", name: "Belgique" },
  { code: "BZ", name: "Belize" },
  { code: "BJ", name: "Bénin" },
  { code: "BT", name: "Bhoutan" },
  { code: "BY", name: "Biélorussie" },
  { code: "MM", name: "Birmanie (Myanmar)" },
  { code: "BO", name: "Bolivie" },
  { code: "BA", name: "Bosnie-Herzégovine" },
  { code: "BW", name: "Botswana" },
  { code: "BR", name: "Brésil" },
  { code: "BN", name: "Brunei" },
  { code: "BG", name: "Bulgarie" },
  { code: "BF", name: "Burkina Faso" },
  { code: "BI", name: "Burundi" },
  { code: "KH", name: "Cambodge" },
  { code: "CM", name: "Cameroun" },
  { code: "CA", name: "Canada" },
  { code: "CV", name: "Cap-Vert" },
  { code: "CF", name: "République centrafricaine" },
  { code: "CL", name: "Chili" },
  { code: "CN", name: "Chine" },
  { code: "CY", name: "Chypre" },
  { code: "CO", name: "Colombie" },
  { code: "KM", name: "Comores" },
  { code: "CG", name: "Congo (Brazzaville)" },
  { code: "CD", name: "Congo (RDC)" },
  { code: "KP", name: "Corée du Nord" },
  { code: "KR", name: "Corée du Sud" },
  { code: "CR", name: "Costa Rica" },
  { code: "CI", name: "Côte d'Ivoire" },
  { code: "HR", name: "Croatie" },
  { code: "CU", name: "Cuba" },
  { code: "DK", name: "Danemark" },
  { code: "DJ", name: "Djibouti" },
  { code: "DM", name: "Dominique" },
  { code: "EG", name: "Égypte" },
  { code: "AE", name: "Émirats arabes unis" },
  { code: "EC", name: "Équateur" },
  { code: "ER", name: "Érythrée" },
  { code: "ES", name: "Espagne" },
  { code: "EE", name: "Estonie" },
  { code: "SZ", name: "Eswatini (Swaziland)" },
  { code: "US", name: "États-Unis" },
  { code: "ET", name: "Éthiopie" },
  { code: "FJ", name: "Fidji" },
  { code: "FI", name: "Finlande" },
  { code: "FR", name: "France" },
  { code: "GA", name: "Gabon" },
  { code: "GM", name: "Gambie" },
  { code: "GE", name: "Géorgie" },
  { code: "GH", name: "Ghana" },
  { code: "GR", name: "Grèce" },
  { code: "GD", name: "Grenade" },
  { code: "GT", name: "Guatemala" },
  { code: "GN", name: "Guinée" },
  { code: "GW", name: "Guinée-Bissau" },
  { code: "GQ", name: "Guinée équatoriale" },
  { code: "GY", name: "Guyana" },
  { code: "HT", name: "Haïti" },
  { code: "HN", name: "Honduras" },
  { code: "HU", name: "Hongrie" },
  { code: "HK", name: "Hong Kong" },
  { code: "IN", name: "Inde" },
  { code: "ID", name: "Indonésie" },
  { code: "IQ", name: "Irak" },
  { code: "IR", name: "Iran" },
  { code: "IE", name: "Irlande" },
  { code: "IS", name: "Islande" },
  { code: "IL", name: "Israël" },
  { code: "IT", name: "Italie" },
  { code: "JM", name: "Jamaïque" },
  { code: "JP", name: "Japon" },
  { code: "JO", name: "Jordanie" },
  { code: "KZ", name: "Kazakhstan" },
  { code: "KE", name: "Kenya" },
  { code: "KG", name: "Kirghizistan" },
  { code: "KI", name: "Kiribati" },
  { code: "XK", name: "Kosovo" },
  { code: "KW", name: "Koweït" },
  { code: "LA", name: "Laos" },
  { code: "LS", name: "Lesotho" },
  { code: "LV", name: "Lettonie" },
  { code: "LB", name: "Liban" },
  { code: "LR", name: "Liberia" },
  { code: "LY", name: "Libye" },
  { code: "LI", name: "Liechtenstein" },
  { code: "LT", name: "Lituanie" },
  { code: "LU", name: "Luxembourg" },
  { code: "MK", name: "Macédoine du Nord" },
  { code: "MG", name: "Madagascar" },
  { code: "MY", name: "Malaisie" },
  { code: "MW", name: "Malawi" },
  { code: "MV", name: "Maldives" },
  { code: "ML", name: "Mali" },
  { code: "MT", name: "Malte" },
  { code: "MA", name: "Maroc" },
  { code: "MU", name: "Maurice" },
  { code: "MR", name: "Mauritanie" },
  { code: "MX", name: "Mexique" },
  { code: "FM", name: "Micronésie" },
  { code: "MD", name: "Moldavie" },
  { code: "MC", name: "Monaco" },
  { code: "MN", name: "Mongolie" },
  { code: "ME", name: "Monténégro" },
  { code: "MZ", name: "Mozambique" },
  { code: "NA", name: "Namibie" },
  { code: "NR", name: "Nauru" },
  { code: "NP", name: "Népal" },
  { code: "NI", name: "Nicaragua" },
  { code: "NE", name: "Niger" },
  { code: "NG", name: "Nigeria" },
  { code: "NO", name: "Norvège" },
  { code: "NZ", name: "Nouvelle-Zélande" },
  { code: "OM", name: "Oman" },
  { code: "UG", name: "Ouganda" },
  { code: "UZ", name: "Ouzbékistan" },
  { code: "PK", name: "Pakistan" },
  { code: "PW", name: "Palaos" },
  { code: "PS", name: "Palestine" },
  { code: "PA", name: "Panama" },
  { code: "PG", name: "Papouasie-Nouvelle-Guinée" },
  { code: "PY", name: "Paraguay" },
  { code: "NL", name: "Pays-Bas" },
  { code: "PE", name: "Pérou" },
  { code: "PH", name: "Philippines" },
  { code: "PL", name: "Pologne" },
  { code: "PT", name: "Portugal" },
  { code: "QA", name: "Qatar" },
  { code: "DO", name: "République dominicaine" },
  { code: "CZ", name: "République tchèque (Tchéquie)" },
  { code: "RO", name: "Roumanie" },
  { code: "GB", name: "Royaume-Uni" },
  { code: "RU", name: "Russie" },
  { code: "RW", name: "Rwanda" },
  { code: "KN", name: "Saint-Christophe-et-Niévès" },
  { code: "SM", name: "Saint-Marin" },
  { code: "VC", name: "Saint-Vincent-et-les-Grenadines" },
  { code: "LC", name: "Sainte-Lucie" },
  { code: "SV", name: "Salvador" },
  { code: "WS", name: "Samoa" },
  { code: "ST", name: "Sao Tomé-et-Principe" },
  { code: "SN", name: "Sénégal" },
  { code: "RS", name: "Serbie" },
  { code: "SC", name: "Seychelles" },
  { code: "SL", name: "Sierra Leone" },
  { code: "SG", name: "Singapour" },
  { code: "SK", name: "Slovaquie" },
  { code: "SI", name: "Slovénie" },
  { code: "SO", name: "Somalie" },
  { code: "SD", name: "Soudan" },
  { code: "SS", name: "Soudan du Sud" },
  { code: "LK", name: "Sri Lanka" },
  { code: "SE", name: "Suède" },
  { code: "CH", name: "Suisse" },
  { code: "SR", name: "Suriname" },
  { code: "SY", name: "Syrie" },
  { code: "TJ", name: "Tadjikistan" },
  { code: "TW", name: "Taïwan" },
  { code: "TZ", name: "Tanzanie" },
  { code: "TD", name: "Tchad" },
  { code: "TH", name: "Thaïlande" },
  { code: "TL", name: "Timor oriental" },
  { code: "TG", name: "Togo" },
  { code: "TO", name: "Tonga" },
  { code: "TT", name: "Trinité-et-Tobago" },
  { code: "TN", name: "Tunisie" },
  { code: "TM", name: "Turkménistan" },
  { code: "TR", name: "Turquie" },
  { code: "TV", name: "Tuvalu" },
  { code: "UA", name: "Ukraine" },
  { code: "UY", name: "Uruguay" },
  { code: "VU", name: "Vanuatu" },
  { code: "VA", name: "Vatican (Saint-Siège)" },
  { code: "VE", name: "Venezuela" },
  { code: "VN", name: "Vietnam" },
  { code: "YE", name: "Yémen" },
  { code: "ZM", name: "Zambie" },
  { code: "ZW", name: "Zimbabwe" },
];

const ACCENTED_CHARS: Record<string, string> = {
  à: "a", â: "a", ä: "a",
  ç: "c",
  è: "e", é: "e", ê: "e", ë: "e",
  î: "i", ï: "i",
  ô: "o", ö: "o",
  ù: "u", û: "u", ü: "u",
  ÿ: "y",
};

function normalize(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[àâäçèéêëîïôöùûüÿ]/g, (ch) => ACCENTED_CHARS[ch] ?? ch)
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const BY_NORMALIZED_NAME = new Map(WORLD_COUNTRIES.map((c) => [normalize(c.name), c]));

/// Pays dont le nom normalisé COMMENCE par la requête en premier (préfixe —
/// ex. "fr" → France avant "Afrique du Sud"), puis les autres correspondances
/// par inclusion, dans l'ordre alphabétique d'origine. Requête vide → [].
export function searchCountries(query: string, limit = 8): WorldCountry[] {
  const q = normalize(query);
  if (!q) return [];
  const startsWith: WorldCountry[] = [];
  const includes: WorldCountry[] = [];
  for (const country of WORLD_COUNTRIES) {
    const n = normalize(country.name);
    if (n.startsWith(q)) startsWith.push(country);
    else if (n.includes(q)) includes.push(country);
  }
  return [...startsWith, ...includes].slice(0, limit);
}

/// Résout un pays depuis son nom EXACT (normalisé) — sert à retrouver le
/// drapeau à partir de la valeur COURANTE du champ (texte libre), pas
/// seulement depuis la liste de suggestions.
export function findCountryByName(name: string): WorldCountry | undefined {
  return BY_NORMALIZED_NAME.get(normalize(name));
}

/// Emoji drapeau à partir d'un code ISO 3166-1 alpha-2, via les symboles
/// indicateurs régionaux Unicode (ex. "BE" → 🇧🇪). Calculé, jamais copié à la
/// main — évite tout risque de mauvais caractère sur 195 entrées.
export function flagEmoji(code: string): string {
  if (!/^[A-Za-z]{2}$/.test(code)) return "";
  const codePoints = [...code.toUpperCase()].map((ch) => 127397 + ch.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}
