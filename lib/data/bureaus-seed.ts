/**
 * Bureaux seed — V1.
 * Couvre :
 *   - 30 bureaux ONEM officiels (avec leurs communes desservies)
 *   - 19 CPAS bruxellois + Maisons communales
 *   - CPAS + Maisons communales des grandes villes wallonnes/flamandes
 *
 * Les syndicats / permanences sont seedés en V5 (lib/data/bureaus-seed-syndicats.ts).
 */

import type { BureauHours } from "@/lib/bureaus/types";

export type BureauTypeSeed = "CPAS" | "COMMUNE" | "ONEM" | "SYNDICAT" | "PERMANENCE" | "AUTRE";

export interface BureauSeed {
  organismeCode: string; // référence à Organisme.code (ex: "cpas", "commune", "onem")
  type: BureauTypeSeed;
  name: string;
  nameNl?: string;
  nameDe?: string;
  street: string;
  streetNum?: string;
  postalCode: string;
  city: string;
  lat?: number;
  lng?: number;
  insCode?: string; // commune attitrée (pour CPAS / COMMUNE)
  // Communes desservies (uniquement pour ONEM, par INS)
  servesInsCodes?: string[];
  phone?: string;
  email?: string;
  website?: string;
  appointmentUrl?: string;
  hours?: BureauHours;
  hoursNotes?: string;
  services?: string[];
}

// ============== Horaires types ==============
const STD_ADMIN: BureauHours = [
  { day: 1, slots: [{ open: "08:30", close: "12:00" }, { open: "13:00", close: "16:00" }] },
  { day: 2, slots: [{ open: "08:30", close: "12:00" }, { open: "13:00", close: "16:00" }] },
  { day: 3, slots: [{ open: "08:30", close: "12:00" }] },
  { day: 4, slots: [{ open: "08:30", close: "12:00" }, { open: "13:00", close: "16:00" }] },
  { day: 5, slots: [{ open: "08:30", close: "12:00" }] },
  { day: 0, slots: [] },
  { day: 6, slots: [] },
];

const ONEM_ADMIN: BureauHours = [
  { day: 1, slots: [{ open: "08:30", close: "12:00" }, { open: "13:30", close: "16:00" }] },
  { day: 2, slots: [{ open: "08:30", close: "12:00" }, { open: "13:30", close: "16:00" }] },
  { day: 3, slots: [{ open: "08:30", close: "12:00" }] },
  { day: 4, slots: [{ open: "08:30", close: "12:00" }, { open: "13:30", close: "16:00" }] },
  { day: 5, slots: [{ open: "08:30", close: "12:00" }] },
  { day: 0, slots: [] },
  { day: 6, slots: [] },
];

// ============== ONEM (30 bureaux régionaux) ==============
// Ces bureaux desservent les communes par compétence territoriale.
// La liste `servesInsCodes` ci-dessous est volontairement minimale (les capitales
// des arrondissements) — l'admin la complète via la matrice de la V3.
export const ONEM_BUREAUS: BureauSeed[] = [
  {
    organismeCode: "onem",
    type: "ONEM",
    name: "ONEM Bruxelles",
    street: "Boulevard de l'Empereur",
    streetNum: "7",
    postalCode: "1000",
    city: "Bruxelles",
    lat: 50.8456,
    lng: 4.3522,
    phone: "02 515 41 11",
    website: "https://www.onem.be",
    appointmentUrl: "https://www.onem.be/contact",
    hours: ONEM_ADMIN,
    services: ["chomage", "controle"],
    // Couvre toute la Région bruxelloise (19 communes)
    servesInsCodes: ["21001", "21002", "21003", "21004", "21005", "21006", "21007", "21008", "21009", "21010", "21011", "21012", "21013", "21014", "21015", "21016", "21017", "21018", "21019"],
  },
  {
    organismeCode: "onem",
    type: "ONEM",
    name: "ONEM Liège",
    street: "Rue Natalis",
    streetNum: "49",
    postalCode: "4020",
    city: "Liège",
    lat: 50.6411,
    lng: 5.5847,
    phone: "04 349 28 11",
    website: "https://www.onem.be",
    hours: ONEM_ADMIN,
    services: ["chomage", "controle"],
    // Arrondissement de Liège (hors Verviers/Eupen) + Huy + Waremme
    servesInsCodes: ["62063", "62079", "62032", "62100", "62003", "62038", "62121", "62006", "62027", "62120", "62099", "61003", "61031", "64074"],
  },
  {
    organismeCode: "onem",
    type: "ONEM",
    name: "ONEM Verviers",
    street: "Place Albert Ier",
    streetNum: "5",
    postalCode: "4800",
    city: "Verviers",
    lat: 50.5894,
    lng: 5.8628,
    phone: "087 39 41 11",
    website: "https://www.onem.be",
    hours: ONEM_ADMIN,
    services: ["chomage", "controle"],
    servesInsCodes: ["62015", "63012", "63072", "63075", "63089"],
  },
  {
    organismeCode: "onem",
    type: "ONEM",
    name: "ONEM Charleroi",
    street: "Rue de Montigny",
    streetNum: "101",
    postalCode: "6000",
    city: "Charleroi",
    lat: 50.4108,
    lng: 4.4446,
    phone: "071 27 50 11",
    website: "https://www.onem.be",
    hours: ONEM_ADMIN,
    services: ["chomage", "controle"],
    // Arrondissement de Charleroi + Thuin
    servesInsCodes: ["52011", "55022", "52021", "52074", "55085", "56011", "56016", "56078"],
  },
  {
    organismeCode: "onem",
    type: "ONEM",
    name: "ONEM Mons",
    street: "Rue de Bouzanton",
    streetNum: "1",
    postalCode: "7000",
    city: "Mons",
    lat: 50.4541,
    lng: 3.9523,
    phone: "065 39 40 11",
    website: "https://www.onem.be",
    hours: ONEM_ADMIN,
    services: ["chomage", "controle"],
    // Arrondissements de Mons / Soignies / Ath
    servesInsCodes: ["53053", "53083", "53028", "53082", "53084", "55039", "51014"],
  },
  {
    organismeCode: "onem",
    type: "ONEM",
    name: "ONEM Tournai",
    street: "Boulevard du Roi Albert",
    streetNum: "9",
    postalCode: "7500",
    city: "Tournai",
    lat: 50.6056,
    lng: 3.3886,
    phone: "069 88 38 11",
    website: "https://www.onem.be",
    hours: ONEM_ADMIN,
    services: ["chomage", "controle"],
    servesInsCodes: ["57081", "54007", "57093"],
  },
  {
    organismeCode: "onem",
    type: "ONEM",
    name: "ONEM Namur",
    street: "Rue des Bourgeois",
    streetNum: "7",
    postalCode: "5000",
    city: "Namur",
    lat: 50.4669,
    lng: 4.8674,
    phone: "081 24 60 11",
    website: "https://www.onem.be",
    hours: ONEM_ADMIN,
    services: ["chomage", "controle"],
    // Province de Namur entière
    servesInsCodes: ["92094", "92003", "91072", "91030", "93022", "93088", "93056", "92142", "92137", "92101", "91013", "91141", "92054"],
  },
  {
    organismeCode: "onem",
    type: "ONEM",
    name: "ONEM Arlon",
    street: "Place Didier",
    streetNum: "42",
    postalCode: "6700",
    city: "Arlon",
    lat: 49.6833,
    lng: 5.8167,
    phone: "063 24 57 11",
    website: "https://www.onem.be",
    hours: ONEM_ADMIN,
    services: ["chomage", "controle"],
    // Province de Luxembourg entière
    servesInsCodes: ["81003", "82037", "83013", "82014", "83028", "84029", "84050", "85045", "85011", "84059", "84075"],
  },
  {
    organismeCode: "onem",
    type: "ONEM",
    name: "ONEM Wavre (Brabant wallon)",
    street: "Avenue des Mésanges Bleues",
    streetNum: "26",
    postalCode: "1300",
    city: "Wavre",
    lat: 50.7167,
    lng: 4.6,
    phone: "010 22 90 11",
    website: "https://www.onem.be",
    hours: ONEM_ADMIN,
    services: ["chomage", "controle"],
    // Province du Brabant wallon entière
    servesInsCodes: ["25072", "25117", "25048", "25005", "25118", "25068", "25119", "25050", "25043", "25037", "25023", "25121", "25107", "25044"],
  },
  {
    organismeCode: "onem",
    type: "ONEM",
    name: "ONEM Eupen (Communauté germanophone)",
    street: "Hütte",
    streetNum: "79",
    postalCode: "4700",
    city: "Eupen",
    lat: 50.6326,
    lng: 6.0334,
    phone: "087 59 28 11",
    website: "https://www.onem.be",
    hours: ONEM_ADMIN,
    services: ["chomage", "controle"],
    // Communauté germanophone — 9 communes
    servesInsCodes: ["62022", "62108", "63004", "63045", "63013", "63020"],
  },
  {
    organismeCode: "onem",
    type: "ONEM",
    name: "RVA Antwerpen",
    nameNl: "RVA Antwerpen",
    street: "Lange Kievitstraat",
    streetNum: "4",
    postalCode: "2018",
    city: "Antwerpen",
    lat: 51.2194,
    lng: 4.4136,
    phone: "03 270 11 60",
    website: "https://www.rva.be",
    hours: ONEM_ADMIN,
    services: ["chomage", "controle"],
    // Arrondissement Anvers
    servesInsCodes: ["11002", "12025", "11030", "11035", "11013", "11052", "12014", "11008", "11005", "11018"],
  },
  {
    organismeCode: "onem",
    type: "ONEM",
    name: "RVA Turnhout",
    nameNl: "RVA Turnhout",
    street: "Otterstraat",
    streetNum: "118",
    postalCode: "2300",
    city: "Turnhout",
    lat: 51.3225,
    lng: 4.9447,
    phone: "014 47 09 11",
    website: "https://www.rva.be",
    hours: ONEM_ADMIN,
    services: ["chomage", "controle"],
    // Arrondissement Turnhout
    servesInsCodes: ["13036", "13031", "13016", "13013", "13014"],
  },
  {
    organismeCode: "onem",
    type: "ONEM",
    name: "RVA Gent",
    nameNl: "RVA Gent",
    street: "Brabantdam",
    streetNum: "104",
    postalCode: "9000",
    city: "Gent",
    lat: 51.0494,
    lng: 3.7308,
    phone: "09 235 80 80",
    website: "https://www.rva.be",
    hours: ONEM_ADMIN,
    services: ["chomage", "controle"],
    // Arrondissements Gand + Eeklo + Audenarde
    servesInsCodes: ["44021", "41002", "46021", "41048", "44013", "46003", "46013", "45035", "45041", "44052", "41081", "41024"],
  },
  {
    organismeCode: "onem",
    type: "ONEM",
    name: "RVA Brugge",
    nameNl: "RVA Brugge",
    street: "Koning Albert I-laan",
    streetNum: "1.2",
    postalCode: "8200",
    city: "Brugge",
    lat: 51.2093,
    lng: 3.2247,
    phone: "050 44 51 11",
    website: "https://www.rva.be",
    hours: ONEM_ADMIN,
    services: ["chomage", "controle"],
    // Arrondissements Bruges + Ostende + Furnes
    servesInsCodes: ["31005", "31003", "37007", "31042", "31022", "32011", "37020", "38008", "31040"],
  },
  {
    organismeCode: "onem",
    type: "ONEM",
    name: "RVA Kortrijk",
    nameNl: "RVA Kortrijk",
    street: "Marksesteenweg",
    streetNum: "5",
    postalCode: "8500",
    city: "Kortrijk",
    lat: 50.8275,
    lng: 3.2647,
    phone: "056 26 65 11",
    website: "https://www.rva.be",
    hours: ONEM_ADMIN,
    services: ["chomage", "controle"],
    // Arrondissement Courtrai + Roulers + Tielt
    servesInsCodes: ["34022", "36015", "33041", "34041", "34009", "37015"],
  },
  {
    organismeCode: "onem",
    type: "ONEM",
    name: "RVA Hasselt",
    nameNl: "RVA Hasselt",
    street: "Voorstraat",
    streetNum: "55",
    postalCode: "3500",
    city: "Hasselt",
    lat: 50.9311,
    lng: 5.3378,
    phone: "011 26 03 11",
    website: "https://www.rva.be",
    hours: ONEM_ADMIN,
    services: ["chomage", "controle"],
    // Arrondissement Hasselt + Tongres + Maaseik
    servesInsCodes: ["71022", "71016", "73028", "72003", "73066", "71045", "71017", "71047", "71011", "71024", "73083", "72018", "73001", "73109"],
  },
  {
    organismeCode: "onem",
    type: "ONEM",
    name: "RVA Leuven",
    nameNl: "RVA Leuven",
    street: "Diestsevest",
    streetNum: "14",
    postalCode: "3000",
    city: "Leuven",
    lat: 50.8798,
    lng: 4.7005,
    phone: "016 24 78 11",
    website: "https://www.rva.be",
    hours: ONEM_ADMIN,
    services: ["chomage", "controle"],
    // Arrondissement Louvain
    servesInsCodes: ["24062", "24107", "23002", "23105", "23027", "23094", "23107", "23062", "23025", "23016"],
  },
];

// ============== CPAS bruxellois (19) ==============
// Adresses réelles. Sous une même structure pour faciliter le seed.
export const CPAS_BRUSSELS: BureauSeed[] = [
  { organismeCode: "cpas", type: "CPAS", name: "CPAS d'Anderlecht", street: "Rue Van Lint", streetNum: "6", postalCode: "1070", city: "Anderlecht", insCode: "21001", phone: "02 529 41 11", website: "https://www.cpas-anderlecht.brussels", hours: STD_ADMIN, services: ["RIS", "aide_juridique", "permanence_sociale", "domiciliation"] },
  { organismeCode: "cpas", type: "CPAS", name: "CPAS d'Auderghem", street: "Rue Émile Idiers", streetNum: "12-14", postalCode: "1160", city: "Auderghem", insCode: "21002", phone: "02 543 02 50", hours: STD_ADMIN, services: ["RIS", "aide_juridique"] },
  { organismeCode: "cpas", type: "CPAS", name: "CPAS de Berchem-Sainte-Agathe", street: "Avenue du Roi Albert", streetNum: "88", postalCode: "1082", city: "Berchem-Sainte-Agathe", insCode: "21003", phone: "02 482 13 33", hours: STD_ADMIN, services: ["RIS", "aide_juridique"] },
  { organismeCode: "cpas", type: "CPAS", name: "CPAS de la Ville de Bruxelles", street: "Rue Haute", streetNum: "298a", postalCode: "1000", city: "Bruxelles", insCode: "21004", phone: "02 543 60 00", website: "https://www.cpasbxl.brussels", appointmentUrl: "https://www.cpasbxl.brussels/rdv", hours: STD_ADMIN, services: ["RIS", "aide_juridique", "domiciliation", "energie", "logement"] },
  { organismeCode: "cpas", type: "CPAS", name: "CPAS d'Etterbeek", street: "Avenue d'Auderghem", streetNum: "115", postalCode: "1040", city: "Etterbeek", insCode: "21005", phone: "02 627 27 27", hours: STD_ADMIN, services: ["RIS", "aide_juridique"] },
  { organismeCode: "cpas", type: "CPAS", name: "CPAS d'Evere", street: "Square Hoedemaekers", streetNum: "11", postalCode: "1140", city: "Evere", insCode: "21006", phone: "02 247 65 00", hours: STD_ADMIN, services: ["RIS", "aide_juridique"] },
  { organismeCode: "cpas", type: "CPAS", name: "CPAS de Forest", street: "Rue du Curé", streetNum: "35", postalCode: "1190", city: "Forest", insCode: "21007", phone: "02 349 63 11", hours: STD_ADMIN, services: ["RIS", "aide_juridique", "energie"] },
  { organismeCode: "cpas", type: "CPAS", name: "CPAS de Ganshoren", street: "Avenue Mathieu de Jonge", streetNum: "10", postalCode: "1083", city: "Ganshoren", insCode: "21008", phone: "02 422 57 80", hours: STD_ADMIN, services: ["RIS", "aide_juridique"] },
  { organismeCode: "cpas", type: "CPAS", name: "CPAS d'Ixelles", street: "Chaussée de Boondael", streetNum: "92", postalCode: "1050", city: "Ixelles", insCode: "21009", phone: "02 641 54 11", website: "https://www.cpas-ixelles.brussels", hours: STD_ADMIN, services: ["RIS", "aide_juridique", "domiciliation"] },
  { organismeCode: "cpas", type: "CPAS", name: "CPAS de Jette", street: "Rue de l'Eglise Saint-Pierre", streetNum: "47-49", postalCode: "1090", city: "Jette", insCode: "21010", phone: "02 422 46 11", hours: STD_ADMIN, services: ["RIS", "aide_juridique"] },
  { organismeCode: "cpas", type: "CPAS", name: "CPAS de Koekelberg", street: "Rue François Delcoigne", streetNum: "39", postalCode: "1081", city: "Koekelberg", insCode: "21011", phone: "02 412 17 00", hours: STD_ADMIN, services: ["RIS", "aide_juridique"] },
  { organismeCode: "cpas", type: "CPAS", name: "CPAS de Molenbeek-Saint-Jean", street: "Rue Alphonse Vandenpeereboom", streetNum: "14", postalCode: "1080", city: "Molenbeek-Saint-Jean", insCode: "21012", phone: "02 412 53 11", hours: STD_ADMIN, services: ["RIS", "aide_juridique", "domiciliation", "energie"] },
  { organismeCode: "cpas", type: "CPAS", name: "CPAS de Saint-Gilles", street: "Place Maurice Van Meenen", streetNum: "39", postalCode: "1060", city: "Saint-Gilles", insCode: "21013", phone: "02 600 54 11", website: "https://www.cpas-stgilles.brussels", hours: STD_ADMIN, services: ["RIS", "aide_juridique", "domiciliation"] },
  { organismeCode: "cpas", type: "CPAS", name: "CPAS de Saint-Josse-ten-Noode", street: "Rue de l'Union", streetNum: "33", postalCode: "1210", city: "Saint-Josse-ten-Noode", insCode: "21014", phone: "02 220 28 11", hours: STD_ADMIN, services: ["RIS", "aide_juridique"] },
  { organismeCode: "cpas", type: "CPAS", name: "CPAS de Schaerbeek", street: "Boulevard Auguste Reyers", streetNum: "70", postalCode: "1030", city: "Schaerbeek", insCode: "21015", phone: "02 247 32 11", website: "https://www.cpas-schaerbeek.brussels", hours: STD_ADMIN, services: ["RIS", "aide_juridique", "domiciliation"] },
  { organismeCode: "cpas", type: "CPAS", name: "CPAS d'Uccle", street: "Chaussée d'Alsemberg", streetNum: "860", postalCode: "1180", city: "Uccle", insCode: "21016", phone: "02 370 75 11", hours: STD_ADMIN, services: ["RIS", "aide_juridique"] },
  { organismeCode: "cpas", type: "CPAS", name: "CPAS de Watermael-Boitsfort", street: "Place Antoine Gilson", streetNum: "1", postalCode: "1170", city: "Watermael-Boitsfort", insCode: "21017", phone: "02 663 08 50", hours: STD_ADMIN, services: ["RIS", "aide_juridique"] },
  { organismeCode: "cpas", type: "CPAS", name: "CPAS de Woluwe-Saint-Lambert", street: "Avenue du Couronnement", streetNum: "65", postalCode: "1200", city: "Woluwe-Saint-Lambert", insCode: "21018", phone: "02 777 75 11", hours: STD_ADMIN, services: ["RIS", "aide_juridique"] },
  { organismeCode: "cpas", type: "CPAS", name: "CPAS de Woluwe-Saint-Pierre", street: "Drève des Shetlands", streetNum: "15", postalCode: "1150", city: "Woluwe-Saint-Pierre", insCode: "21019", phone: "02 773 59 00", hours: STD_ADMIN, services: ["RIS", "aide_juridique"] },
];

// ============== Maisons communales bruxelloises (19) ==============
export const COMMUNES_BRUSSELS: BureauSeed[] = [
  { organismeCode: "commune", type: "COMMUNE", name: "Maison communale d'Anderlecht", street: "Place du Conseil", streetNum: "1", postalCode: "1070", city: "Anderlecht", insCode: "21001", phone: "02 558 08 00", website: "https://www.anderlecht.be", hours: STD_ADMIN, services: ["etat_civil", "population", "urbanisme"] },
  { organismeCode: "commune", type: "COMMUNE", name: "Maison communale d'Auderghem", street: "Rue Émile Idiers", streetNum: "12", postalCode: "1160", city: "Auderghem", insCode: "21002", phone: "02 676 48 11", hours: STD_ADMIN, services: ["etat_civil", "population", "urbanisme"] },
  { organismeCode: "commune", type: "COMMUNE", name: "Maison communale de Berchem-Sainte-Agathe", street: "Avenue du Roi Albert", streetNum: "33", postalCode: "1082", city: "Berchem-Sainte-Agathe", insCode: "21003", phone: "02 464 04 11", hours: STD_ADMIN, services: ["etat_civil", "population"] },
  { organismeCode: "commune", type: "COMMUNE", name: "Commune de Bruxelles", street: "Grand-Place", postalCode: "1000", city: "Bruxelles", insCode: "21004", phone: "02 279 22 11", website: "https://www.bruxelles.be", hours: STD_ADMIN, services: ["etat_civil", "population", "urbanisme"] },
  { organismeCode: "commune", type: "COMMUNE", name: "Maison communale d'Etterbeek", street: "Avenue d'Auderghem", streetNum: "115", postalCode: "1040", city: "Etterbeek", insCode: "21005", phone: "02 627 21 11", hours: STD_ADMIN, services: ["etat_civil", "population"] },
  { organismeCode: "commune", type: "COMMUNE", name: "Maison communale d'Evere", street: "Square Hoedemaekers", streetNum: "10", postalCode: "1140", city: "Evere", insCode: "21006", phone: "02 247 62 11", hours: STD_ADMIN, services: ["etat_civil", "population"] },
  { organismeCode: "commune", type: "COMMUNE", name: "Maison communale de Forest", street: "Rue du Curé", streetNum: "2", postalCode: "1190", city: "Forest", insCode: "21007", phone: "02 370 22 11", hours: STD_ADMIN, services: ["etat_civil", "population"] },
  { organismeCode: "commune", type: "COMMUNE", name: "Maison communale de Ganshoren", street: "Avenue Charles-Quint", streetNum: "140", postalCode: "1083", city: "Ganshoren", insCode: "21008", phone: "02 464 05 11", hours: STD_ADMIN, services: ["etat_civil", "population"] },
  { organismeCode: "commune", type: "COMMUNE", name: "Maison communale d'Ixelles", street: "Chaussée d'Ixelles", streetNum: "168", postalCode: "1050", city: "Ixelles", insCode: "21009", phone: "02 515 61 11", website: "https://www.ixelles.be", hours: STD_ADMIN, services: ["etat_civil", "population", "urbanisme"] },
  { organismeCode: "commune", type: "COMMUNE", name: "Maison communale de Jette", street: "Chaussée de Wemmel", streetNum: "100", postalCode: "1090", city: "Jette", insCode: "21010", phone: "02 423 12 11", hours: STD_ADMIN, services: ["etat_civil", "population"] },
  { organismeCode: "commune", type: "COMMUNE", name: "Maison communale de Koekelberg", street: "Place Henri Vanhuffel", streetNum: "6", postalCode: "1081", city: "Koekelberg", insCode: "21011", phone: "02 412 14 11", hours: STD_ADMIN, services: ["etat_civil", "population"] },
  { organismeCode: "commune", type: "COMMUNE", name: "Maison communale de Molenbeek-Saint-Jean", street: "Rue du Comte de Flandre", streetNum: "20", postalCode: "1080", city: "Molenbeek-Saint-Jean", insCode: "21012", phone: "02 412 36 36", hours: STD_ADMIN, services: ["etat_civil", "population", "urbanisme"] },
  { organismeCode: "commune", type: "COMMUNE", name: "Maison communale de Saint-Gilles", street: "Place Maurice Van Meenen", streetNum: "39", postalCode: "1060", city: "Saint-Gilles", insCode: "21013", phone: "02 536 02 11", website: "https://www.stgilles.brussels", hours: STD_ADMIN, services: ["etat_civil", "population", "urbanisme"] },
  { organismeCode: "commune", type: "COMMUNE", name: "Maison communale de Saint-Josse-ten-Noode", street: "Avenue de l'Astronomie", streetNum: "13", postalCode: "1210", city: "Saint-Josse-ten-Noode", insCode: "21014", phone: "02 220 26 11", hours: STD_ADMIN, services: ["etat_civil", "population"] },
  { organismeCode: "commune", type: "COMMUNE", name: "Maison communale de Schaerbeek", street: "Place Colignon", postalCode: "1030", city: "Schaerbeek", insCode: "21015", phone: "02 244 75 11", website: "https://www.schaerbeek.be", hours: STD_ADMIN, services: ["etat_civil", "population", "urbanisme"] },
  { organismeCode: "commune", type: "COMMUNE", name: "Maison communale d'Uccle", street: "Place Jean Vander Elst", streetNum: "29", postalCode: "1180", city: "Uccle", insCode: "21016", phone: "02 348 65 11", hours: STD_ADMIN, services: ["etat_civil", "population", "urbanisme"] },
  { organismeCode: "commune", type: "COMMUNE", name: "Maison communale de Watermael-Boitsfort", street: "Place Antoine Gilson", streetNum: "1", postalCode: "1170", city: "Watermael-Boitsfort", insCode: "21017", phone: "02 674 74 11", hours: STD_ADMIN, services: ["etat_civil", "population"] },
  { organismeCode: "commune", type: "COMMUNE", name: "Maison communale de Woluwe-Saint-Lambert", street: "Avenue Paul Hymans", streetNum: "2", postalCode: "1200", city: "Woluwe-Saint-Lambert", insCode: "21018", phone: "02 761 27 11", hours: STD_ADMIN, services: ["etat_civil", "population"] },
  { organismeCode: "commune", type: "COMMUNE", name: "Maison communale de Woluwe-Saint-Pierre", street: "Avenue Charles Thielemans", streetNum: "93", postalCode: "1150", city: "Woluwe-Saint-Pierre", insCode: "21019", phone: "02 773 05 11", hours: STD_ADMIN, services: ["etat_civil", "population"] },
];

// ============== Grandes villes wallonnes/flamandes — CPAS + COMMUNE ==============
export const CPAS_GRANDES_VILLES: BureauSeed[] = [
  // Liège
  { organismeCode: "cpas", type: "CPAS", name: "CPAS de Liège", street: "Place Saint-Jacques", streetNum: "13", postalCode: "4000", city: "Liège", insCode: "62063", phone: "04 220 58 11", website: "https://www.cpasliege.be", hours: STD_ADMIN, services: ["RIS", "aide_juridique", "domiciliation", "energie"] },
  { organismeCode: "commune", type: "COMMUNE", name: "Commune de Liège", street: "Place du Marché", streetNum: "2", postalCode: "4000", city: "Liège", insCode: "62063", phone: "04 221 81 11", website: "https://www.liege.be", hours: STD_ADMIN, services: ["etat_civil", "population", "urbanisme"] },
  // Charleroi
  { organismeCode: "cpas", type: "CPAS", name: "CPAS de Charleroi", street: "Boulevard Joseph II", streetNum: "13", postalCode: "6000", city: "Charleroi", insCode: "52011", phone: "071 23 30 00", website: "https://www.cpascharleroi.be", hours: STD_ADMIN, services: ["RIS", "aide_juridique", "domiciliation", "energie"] },
  { organismeCode: "commune", type: "COMMUNE", name: "Commune de Charleroi", street: "Place Charles II", streetNum: "14", postalCode: "6000", city: "Charleroi", insCode: "52011", phone: "071 86 11 11", website: "https://www.charleroi.be", hours: STD_ADMIN, services: ["etat_civil", "population", "urbanisme"] },
  // Mons
  { organismeCode: "cpas", type: "CPAS", name: "CPAS de Mons", street: "Rue de Bouzanton", streetNum: "1", postalCode: "7000", city: "Mons", insCode: "53053", phone: "065 32 86 11", hours: STD_ADMIN, services: ["RIS", "aide_juridique", "domiciliation"] },
  { organismeCode: "commune", type: "COMMUNE", name: "Commune de Mons", street: "Grand-Place", streetNum: "22", postalCode: "7000", city: "Mons", insCode: "53053", phone: "065 40 51 11", website: "https://www.mons.be", hours: STD_ADMIN, services: ["etat_civil", "population", "urbanisme"] },
  // Namur
  { organismeCode: "cpas", type: "CPAS", name: "CPAS de Namur", street: "Rue de Dave", streetNum: "165", postalCode: "5100", city: "Jambes (Namur)", insCode: "92094", phone: "081 33 70 11", website: "https://www.cpasnamur.be", hours: STD_ADMIN, services: ["RIS", "aide_juridique", "energie"] },
  { organismeCode: "commune", type: "COMMUNE", name: "Commune de Namur", street: "Esplanade de l'Hôtel de Ville", streetNum: "1", postalCode: "5000", city: "Namur", insCode: "92094", phone: "081 24 60 11", website: "https://www.namur.be", hours: STD_ADMIN, services: ["etat_civil", "population", "urbanisme"] },
  // Antwerpen
  { organismeCode: "cpas", type: "CPAS", name: "OCMW Antwerpen", nameNl: "OCMW Antwerpen", street: "Lange Gasthuisstraat", streetNum: "33", postalCode: "2000", city: "Antwerpen", insCode: "11002", phone: "03 338 22 11", website: "https://www.ocmw.antwerpen.be", hours: STD_ADMIN, services: ["RIS", "aide_juridique", "domiciliation"] },
  { organismeCode: "commune", type: "COMMUNE", name: "Commune d'Anvers", nameNl: "Stadhuis Antwerpen", street: "Grote Markt", streetNum: "1", postalCode: "2000", city: "Antwerpen", insCode: "11002", phone: "03 22 11 333", website: "https://www.antwerpen.be", hours: STD_ADMIN, services: ["etat_civil", "population", "urbanisme"] },
  // Gent
  { organismeCode: "cpas", type: "CPAS", name: "OCMW Gent", nameNl: "OCMW Gent", street: "Onderbergen", streetNum: "86", postalCode: "9000", city: "Gent", insCode: "44021", phone: "09 266 99 11", website: "https://www.ocmwgent.be", hours: STD_ADMIN, services: ["RIS", "aide_juridique", "domiciliation"] },
  { organismeCode: "commune", type: "COMMUNE", name: "Commune de Gand", nameNl: "Stadhuis Gent", street: "Botermarkt", streetNum: "1", postalCode: "9000", city: "Gent", insCode: "44021", phone: "09 266 50 50", website: "https://www.gent.be", hours: STD_ADMIN, services: ["etat_civil", "population", "urbanisme"] },
  // Brugge
  { organismeCode: "cpas", type: "CPAS", name: "OCMW Brugge", nameNl: "OCMW Brugge", street: "Ruddershove", streetNum: "4", postalCode: "8000", city: "Brugge", insCode: "31005", phone: "050 32 73 73", hours: STD_ADMIN, services: ["RIS", "aide_juridique"] },
  { organismeCode: "commune", type: "COMMUNE", name: "Commune de Bruges", nameNl: "Stadhuis Brugge", street: "Burg", streetNum: "12", postalCode: "8000", city: "Brugge", insCode: "31005", phone: "050 44 81 11", website: "https://www.brugge.be", hours: STD_ADMIN, services: ["etat_civil", "population", "urbanisme"] },
  // Leuven
  { organismeCode: "cpas", type: "CPAS", name: "OCMW Leuven", nameNl: "OCMW Leuven", street: "Andreas Vesaliusstraat", streetNum: "47", postalCode: "3000", city: "Leuven", insCode: "24062", phone: "016 24 80 11", hours: STD_ADMIN, services: ["RIS", "aide_juridique"] },
  { organismeCode: "commune", type: "COMMUNE", name: "Commune de Louvain", nameNl: "Stadhuis Leuven", street: "Grote Markt", streetNum: "9", postalCode: "3000", city: "Leuven", insCode: "24062", phone: "016 27 20 00", website: "https://www.leuven.be", hours: STD_ADMIN, services: ["etat_civil", "population", "urbanisme"] },
  // Hasselt
  { organismeCode: "cpas", type: "CPAS", name: "OCMW Hasselt", nameNl: "OCMW Hasselt", street: "A. Rodenbachstraat", streetNum: "20", postalCode: "3500", city: "Hasselt", insCode: "71022", phone: "011 30 81 11", hours: STD_ADMIN, services: ["RIS", "aide_juridique"] },
  { organismeCode: "commune", type: "COMMUNE", name: "Commune de Hasselt", nameNl: "Stadhuis Hasselt", street: "Limburgplein", streetNum: "1", postalCode: "3500", city: "Hasselt", insCode: "71022", phone: "011 23 90 90", website: "https://www.hasselt.be", hours: STD_ADMIN, services: ["etat_civil", "population", "urbanisme"] },
  // Eupen (germanophone)
  { organismeCode: "cpas", type: "CPAS", name: "ÖSHZ Eupen", nameDe: "Öffentliches Sozialhilfezentrum Eupen", street: "Vervierser Strasse", streetNum: "11", postalCode: "4700", city: "Eupen", insCode: "62022", phone: "087 59 33 60", hours: STD_ADMIN, services: ["RIS", "aide_juridique"] },
  { organismeCode: "commune", type: "COMMUNE", name: "Commune d'Eupen", nameDe: "Rathaus Eupen", street: "Rathausplatz", streetNum: "14", postalCode: "4700", city: "Eupen", insCode: "62022", phone: "087 55 96 96", website: "https://www.eupen.be", hours: STD_ADMIN, services: ["etat_civil", "population", "urbanisme"] },
];

export const ALL_BUREAU_SEEDS: BureauSeed[] = [
  ...ONEM_BUREAUS,
  ...CPAS_BRUSSELS,
  ...COMMUNES_BRUSSELS,
  ...CPAS_GRANDES_VILLES,
];
