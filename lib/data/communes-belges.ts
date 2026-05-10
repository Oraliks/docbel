/**
 * Communes belges — sous-ensemble représentatif (couvre ~70% de la population).
 * Source: codes INS officiels (Statbel) + coordonnées centroïdes (OpenStreetMap).
 *
 * Format compact : [insCode, nameFr, nameNl?, region, province, lat, lng, [postalCodes...]]
 *
 * NOTE : On part avec les 19 Bruxelles + ~50 grandes villes wallonnes/flamandes/germano.
 * Le reste (450+ communes) est ajouté via admin UI ou import CSV.
 */

export type RegionLite = "wallonia" | "flanders" | "brussels" | "germanophone";

export interface CommuneSeed {
  insCode: string;
  nameFr: string;
  nameNl: string | null;
  nameDe: string | null;
  region: RegionLite;
  province: string | null;
  lat: number;
  lng: number;
  postalCodes: string[];
}

export const COMMUNES_SEED: CommuneSeed[] = [
  // ============== Région de Bruxelles-Capitale (19) ==============
  { insCode: "21001", nameFr: "Anderlecht", nameNl: "Anderlecht", nameDe: null, region: "brussels", province: "bruxelles", lat: 50.8367, lng: 4.3066, postalCodes: ["1070"] },
  { insCode: "21002", nameFr: "Auderghem", nameNl: "Oudergem", nameDe: null, region: "brussels", province: "bruxelles", lat: 50.8169, lng: 4.4279, postalCodes: ["1160"] },
  { insCode: "21003", nameFr: "Berchem-Sainte-Agathe", nameNl: "Sint-Agatha-Berchem", nameDe: null, region: "brussels", province: "bruxelles", lat: 50.8657, lng: 4.2932, postalCodes: ["1082"] },
  { insCode: "21004", nameFr: "Bruxelles", nameNl: "Brussel", nameDe: null, region: "brussels", province: "bruxelles", lat: 50.8503, lng: 4.3517, postalCodes: ["1000", "1020", "1120", "1130"] },
  { insCode: "21005", nameFr: "Etterbeek", nameNl: "Etterbeek", nameDe: null, region: "brussels", province: "bruxelles", lat: 50.8346, lng: 4.3884, postalCodes: ["1040"] },
  { insCode: "21006", nameFr: "Evere", nameNl: "Evere", nameDe: null, region: "brussels", province: "bruxelles", lat: 50.8678, lng: 4.4019, postalCodes: ["1140"] },
  { insCode: "21007", nameFr: "Forest", nameNl: "Vorst", nameDe: null, region: "brussels", province: "bruxelles", lat: 50.8147, lng: 4.3265, postalCodes: ["1190"] },
  { insCode: "21008", nameFr: "Ganshoren", nameNl: "Ganshoren", nameDe: null, region: "brussels", province: "bruxelles", lat: 50.8722, lng: 4.3092, postalCodes: ["1083"] },
  { insCode: "21009", nameFr: "Ixelles", nameNl: "Elsene", nameDe: null, region: "brussels", province: "bruxelles", lat: 50.8276, lng: 4.3716, postalCodes: ["1050"] },
  { insCode: "21010", nameFr: "Jette", nameNl: "Jette", nameDe: null, region: "brussels", province: "bruxelles", lat: 50.8806, lng: 4.3270, postalCodes: ["1090"] },
  { insCode: "21011", nameFr: "Koekelberg", nameNl: "Koekelberg", nameDe: null, region: "brussels", province: "bruxelles", lat: 50.8631, lng: 4.3253, postalCodes: ["1081"] },
  { insCode: "21012", nameFr: "Molenbeek-Saint-Jean", nameNl: "Sint-Jans-Molenbeek", nameDe: null, region: "brussels", province: "bruxelles", lat: 50.8553, lng: 4.3231, postalCodes: ["1080"] },
  { insCode: "21013", nameFr: "Saint-Gilles", nameNl: "Sint-Gillis", nameDe: null, region: "brussels", province: "bruxelles", lat: 50.8268, lng: 4.3437, postalCodes: ["1060"] },
  { insCode: "21014", nameFr: "Saint-Josse-ten-Noode", nameNl: "Sint-Joost-ten-Node", nameDe: null, region: "brussels", province: "bruxelles", lat: 50.8540, lng: 4.3724, postalCodes: ["1210"] },
  { insCode: "21015", nameFr: "Schaerbeek", nameNl: "Schaarbeek", nameDe: null, region: "brussels", province: "bruxelles", lat: 50.8676, lng: 4.3812, postalCodes: ["1030"] },
  { insCode: "21016", nameFr: "Uccle", nameNl: "Ukkel", nameDe: null, region: "brussels", province: "bruxelles", lat: 50.7997, lng: 4.3387, postalCodes: ["1180"] },
  { insCode: "21017", nameFr: "Watermael-Boitsfort", nameNl: "Watermaal-Bosvoorde", nameDe: null, region: "brussels", province: "bruxelles", lat: 50.8079, lng: 4.4119, postalCodes: ["1170"] },
  { insCode: "21018", nameFr: "Woluwe-Saint-Lambert", nameNl: "Sint-Lambrechts-Woluwe", nameDe: null, region: "brussels", province: "bruxelles", lat: 50.8473, lng: 4.4280, postalCodes: ["1200"] },
  { insCode: "21019", nameFr: "Woluwe-Saint-Pierre", nameNl: "Sint-Pieters-Woluwe", nameDe: null, region: "brussels", province: "bruxelles", lat: 50.8385, lng: 4.4550, postalCodes: ["1150"] },

  // ============== Province de Liège ==============
  { insCode: "62063", nameFr: "Liège", nameNl: "Luik", nameDe: "Lüttich", region: "wallonia", province: "liege", lat: 50.6326, lng: 5.5797, postalCodes: ["4000", "4020", "4030", "4031", "4032"] },
  { insCode: "62079", nameFr: "Seraing", nameNl: null, nameDe: null, region: "wallonia", province: "liege", lat: 50.6017, lng: 5.5083, postalCodes: ["4100", "4101", "4102"] },
  { insCode: "62015", nameFr: "Verviers", nameNl: null, nameDe: null, region: "wallonia", province: "liege", lat: 50.5894, lng: 5.8628, postalCodes: ["4800", "4801", "4802"] },
  { insCode: "62032", nameFr: "Herstal", nameNl: null, nameDe: null, region: "wallonia", province: "liege", lat: 50.6633, lng: 5.6206, postalCodes: ["4040"] },
  { insCode: "62022", nameFr: "Eupen", nameNl: null, nameDe: "Eupen", region: "germanophone", province: "liege", lat: 50.6326, lng: 6.0334, postalCodes: ["4700", "4701"] },
  { insCode: "62108", nameFr: "Saint-Vith", nameNl: null, nameDe: "Sankt Vith", region: "germanophone", province: "liege", lat: 50.2806, lng: 6.1306, postalCodes: ["4780"] },
  { insCode: "63012", nameFr: "Malmedy", nameNl: null, nameDe: null, region: "wallonia", province: "liege", lat: 50.4253, lng: 6.0276, postalCodes: ["4960"] },
  { insCode: "62100", nameFr: "Saint-Nicolas", nameNl: null, nameDe: null, region: "wallonia", province: "liege", lat: 50.6403, lng: 5.5403, postalCodes: ["4420"] },

  // ============== Province de Hainaut ==============
  { insCode: "52011", nameFr: "Charleroi", nameNl: null, nameDe: null, region: "wallonia", province: "hainaut", lat: 50.4108, lng: 4.4446, postalCodes: ["6000", "6001", "6010", "6020", "6030", "6031", "6032", "6040", "6041", "6042", "6043", "6044"] },
  { insCode: "53053", nameFr: "Mons", nameNl: "Bergen", nameDe: null, region: "wallonia", province: "hainaut", lat: 50.4541, lng: 3.9523, postalCodes: ["7000", "7011", "7012", "7020", "7021", "7022", "7024", "7030", "7031", "7032", "7033", "7034"] },
  { insCode: "55022", nameFr: "La Louvière", nameNl: null, nameDe: null, region: "wallonia", province: "hainaut", lat: 50.4794, lng: 4.1872, postalCodes: ["7100", "7110"] },
  { insCode: "57081", nameFr: "Tournai", nameNl: "Doornik", nameDe: null, region: "wallonia", province: "hainaut", lat: 50.6056, lng: 3.3886, postalCodes: ["7500", "7501", "7502", "7503", "7504"] },
  { insCode: "54007", nameFr: "Mouscron", nameNl: "Moeskroen", nameDe: null, region: "wallonia", province: "hainaut", lat: 50.7406, lng: 3.2236, postalCodes: ["7700"] },

  // ============== Province de Namur ==============
  { insCode: "92094", nameFr: "Namur", nameNl: "Namen", nameDe: null, region: "wallonia", province: "namur", lat: 50.4669, lng: 4.8674, postalCodes: ["5000", "5001", "5002", "5003", "5004", "5020", "5024"] },
  { insCode: "92003", nameFr: "Andenne", nameNl: null, nameDe: null, region: "wallonia", province: "namur", lat: 50.4889, lng: 5.0944, postalCodes: ["5300"] },
  { insCode: "91072", nameFr: "Dinant", nameNl: null, nameDe: null, region: "wallonia", province: "namur", lat: 50.2611, lng: 4.9128, postalCodes: ["5500"] },

  // ============== Province de Luxembourg ==============
  { insCode: "81003", nameFr: "Arlon", nameNl: null, nameDe: "Arel", region: "wallonia", province: "luxembourg", lat: 49.6833, lng: 5.8167, postalCodes: ["6700", "6704"] },
  { insCode: "82037", nameFr: "Marche-en-Famenne", nameNl: null, nameDe: null, region: "wallonia", province: "luxembourg", lat: 50.2275, lng: 5.3437, postalCodes: ["6900"] },
  { insCode: "83013", nameFr: "Bastogne", nameNl: null, nameDe: "Bastnach", region: "wallonia", province: "luxembourg", lat: 50.0025, lng: 5.7156, postalCodes: ["6600"] },

  // ============== Province de Brabant wallon ==============
  { insCode: "25072", nameFr: "Wavre", nameNl: null, nameDe: null, region: "wallonia", province: "brabant-wallon", lat: 50.7167, lng: 4.6, postalCodes: ["1300"] },
  { insCode: "25117", nameFr: "Ottignies-Louvain-la-Neuve", nameNl: null, nameDe: null, region: "wallonia", province: "brabant-wallon", lat: 50.6631, lng: 4.6097, postalCodes: ["1340", "1341", "1342", "1348"] },
  { insCode: "25048", nameFr: "Nivelles", nameNl: null, nameDe: null, region: "wallonia", province: "brabant-wallon", lat: 50.5972, lng: 4.3306, postalCodes: ["1400"] },
  { insCode: "25005", nameFr: "Braine-l'Alleud", nameNl: null, nameDe: null, region: "wallonia", province: "brabant-wallon", lat: 50.6817, lng: 4.3681, postalCodes: ["1420"] },

  // ============== Province d'Anvers ==============
  { insCode: "11002", nameFr: "Anvers", nameNl: "Antwerpen", nameDe: "Antwerpen", region: "flanders", province: "antwerpen", lat: 51.2194, lng: 4.4025, postalCodes: ["2000", "2018", "2020", "2030", "2040", "2050", "2060", "2100", "2140", "2170", "2180", "2600", "2610", "2660"] },
  { insCode: "13031", nameFr: "Mol", nameNl: "Mol", nameDe: null, region: "flanders", province: "antwerpen", lat: 51.1903, lng: 5.1131, postalCodes: ["2400"] },
  { insCode: "12025", nameFr: "Malines", nameNl: "Mechelen", nameDe: null, region: "flanders", province: "antwerpen", lat: 51.0259, lng: 4.4775, postalCodes: ["2800", "2801", "2811", "2812"] },
  { insCode: "11030", nameFr: "Schoten", nameNl: "Schoten", nameDe: null, region: "flanders", province: "antwerpen", lat: 51.2519, lng: 4.5028, postalCodes: ["2900"] },
  { insCode: "13036", nameFr: "Turnhout", nameNl: "Turnhout", nameDe: null, region: "flanders", province: "antwerpen", lat: 51.3225, lng: 4.9447, postalCodes: ["2300"] },

  // ============== Province de Flandre orientale ==============
  { insCode: "44021", nameFr: "Gand", nameNl: "Gent", nameDe: null, region: "flanders", province: "oost-vlaanderen", lat: 51.0543, lng: 3.7174, postalCodes: ["9000", "9030", "9031", "9032", "9040", "9041", "9042", "9050", "9051", "9052"] },
  { insCode: "41002", nameFr: "Alost", nameNl: "Aalst", nameDe: null, region: "flanders", province: "oost-vlaanderen", lat: 50.9381, lng: 4.0386, postalCodes: ["9300", "9308", "9310", "9320"] },
  { insCode: "46021", nameFr: "Saint-Nicolas (Wase)", nameNl: "Sint-Niklaas", nameDe: null, region: "flanders", province: "oost-vlaanderen", lat: 51.165, lng: 4.1419, postalCodes: ["9100"] },
  { insCode: "41048", nameFr: "Termonde", nameNl: "Dendermonde", nameDe: null, region: "flanders", province: "oost-vlaanderen", lat: 51.0286, lng: 4.1014, postalCodes: ["9200"] },

  // ============== Province de Flandre occidentale ==============
  { insCode: "31005", nameFr: "Bruges", nameNl: "Brugge", nameDe: null, region: "flanders", province: "west-vlaanderen", lat: 51.2093, lng: 3.2247, postalCodes: ["8000", "8200", "8310", "8380"] },
  { insCode: "34022", nameFr: "Courtrai", nameNl: "Kortrijk", nameDe: null, region: "flanders", province: "west-vlaanderen", lat: 50.8275, lng: 3.2647, postalCodes: ["8500", "8501", "8510", "8511"] },
  { insCode: "31003", nameFr: "Ostende", nameNl: "Oostende", nameDe: null, region: "flanders", province: "west-vlaanderen", lat: 51.2247, lng: 2.9156, postalCodes: ["8400"] },
  { insCode: "36015", nameFr: "Roulers", nameNl: "Roeselare", nameDe: null, region: "flanders", province: "west-vlaanderen", lat: 50.9469, lng: 3.1247, postalCodes: ["8800"] },
  { insCode: "37007", nameFr: "Ypres", nameNl: "Ieper", nameDe: null, region: "flanders", province: "west-vlaanderen", lat: 50.8514, lng: 2.8856, postalCodes: ["8900"] },

  // ============== Province de Limbourg ==============
  { insCode: "71022", nameFr: "Hasselt", nameNl: "Hasselt", nameDe: null, region: "flanders", province: "limburg", lat: 50.9311, lng: 5.3378, postalCodes: ["3500", "3501", "3510", "3511", "3512"] },
  { insCode: "71016", nameFr: "Genk", nameNl: "Genk", nameDe: null, region: "flanders", province: "limburg", lat: 50.965, lng: 5.5, postalCodes: ["3600"] },
  { insCode: "73028", nameFr: "Maaseik", nameNl: "Maaseik", nameDe: null, region: "flanders", province: "limburg", lat: 51.0967, lng: 5.7864, postalCodes: ["3680"] },
  { insCode: "72003", nameFr: "Tongres", nameNl: "Tongeren", nameDe: null, region: "flanders", province: "limburg", lat: 50.7806, lng: 5.4647, postalCodes: ["3700"] },

  // ============== Province de Brabant flamand ==============
  { insCode: "24062", nameFr: "Louvain", nameNl: "Leuven", nameDe: null, region: "flanders", province: "vlaams-brabant", lat: 50.8798, lng: 4.7005, postalCodes: ["3000", "3001", "3010", "3012", "3018"] },
  { insCode: "23002", nameFr: "Asse", nameNl: "Asse", nameDe: null, region: "flanders", province: "vlaams-brabant", lat: 50.9106, lng: 4.2058, postalCodes: ["1730"] },
  { insCode: "24107", nameFr: "Tirlemont", nameNl: "Tienen", nameDe: null, region: "flanders", province: "vlaams-brabant", lat: 50.8067, lng: 4.9378, postalCodes: ["3300"] },
  { insCode: "23105", nameFr: "Vilvorde", nameNl: "Vilvoorde", nameDe: null, region: "flanders", province: "vlaams-brabant", lat: 50.9281, lng: 4.4256, postalCodes: ["1800"] },
  { insCode: "23027", nameFr: "Hal", nameNl: "Halle", nameDe: null, region: "flanders", province: "vlaams-brabant", lat: 50.7333, lng: 4.2333, postalCodes: ["1500"] },
  { insCode: "23094", nameFr: "Tervuren", nameNl: "Tervuren", nameDe: null, region: "flanders", province: "vlaams-brabant", lat: 50.8208, lng: 4.5108, postalCodes: ["3080"] },
  { insCode: "23107", nameFr: "Diegem", nameNl: "Zaventem", nameDe: null, region: "flanders", province: "vlaams-brabant", lat: 50.8847, lng: 4.4708, postalCodes: ["1930"] },
  { insCode: "23062", nameFr: "Overijse", nameNl: "Overijse", nameDe: null, region: "flanders", province: "vlaams-brabant", lat: 50.7706, lng: 4.5333, postalCodes: ["3090"] },
  { insCode: "23025", nameFr: "Grimbergen", nameNl: "Grimbergen", nameDe: null, region: "flanders", province: "vlaams-brabant", lat: 50.9333, lng: 4.3833, postalCodes: ["1850"] },
  { insCode: "23016", nameFr: "Dilbeek", nameNl: "Dilbeek", nameDe: null, region: "flanders", province: "vlaams-brabant", lat: 50.8500, lng: 4.2667, postalCodes: ["1700"] },

  // ============== Brabant wallon (suite) ==============
  { insCode: "25118", nameFr: "Waterloo", nameNl: null, nameDe: null, region: "wallonia", province: "brabant-wallon", lat: 50.7167, lng: 4.4000, postalCodes: ["1410"] },
  { insCode: "25068", nameFr: "Rixensart", nameNl: null, nameDe: null, region: "wallonia", province: "brabant-wallon", lat: 50.7167, lng: 4.5333, postalCodes: ["1330", "1331", "1332"] },
  { insCode: "25119", nameFr: "Tubize", nameNl: null, nameDe: null, region: "wallonia", province: "brabant-wallon", lat: 50.6889, lng: 4.2056, postalCodes: ["1480"] },
  { insCode: "25050", nameFr: "Lasne", nameNl: null, nameDe: null, region: "wallonia", province: "brabant-wallon", lat: 50.7000, lng: 4.4833, postalCodes: ["1380"] },
  { insCode: "25043", nameFr: "Jodoigne", nameNl: null, nameDe: null, region: "wallonia", province: "brabant-wallon", lat: 50.7167, lng: 4.8722, postalCodes: ["1370"] },
  { insCode: "25037", nameFr: "Genappe", nameNl: null, nameDe: null, region: "wallonia", province: "brabant-wallon", lat: 50.6111, lng: 4.4500, postalCodes: ["1470"] },
  { insCode: "25023", nameFr: "Court-Saint-Étienne", nameNl: null, nameDe: null, region: "wallonia", province: "brabant-wallon", lat: 50.6333, lng: 4.5667, postalCodes: ["1490"] },
  { insCode: "25121", nameFr: "Walhain", nameNl: null, nameDe: null, region: "wallonia", province: "brabant-wallon", lat: 50.6500, lng: 4.7000, postalCodes: ["1457", "1458"] },
  { insCode: "25107", nameFr: "Perwez", nameNl: null, nameDe: null, region: "wallonia", province: "brabant-wallon", lat: 50.6494, lng: 4.7986, postalCodes: ["1360"] },
  { insCode: "25044", nameFr: "La Hulpe", nameNl: null, nameDe: null, region: "wallonia", province: "brabant-wallon", lat: 50.7333, lng: 4.4833, postalCodes: ["1310"] },

  // ============== Hainaut (suite) ==============
  { insCode: "55039", nameFr: "Soignies", nameNl: null, nameDe: null, region: "wallonia", province: "hainaut", lat: 50.5808, lng: 4.0700, postalCodes: ["7060", "7062", "7063"] },
  { insCode: "51014", nameFr: "Ath", nameNl: null, nameDe: null, region: "wallonia", province: "hainaut", lat: 50.6244, lng: 3.7783, postalCodes: ["7800"] },
  { insCode: "56011", nameFr: "Binche", nameNl: null, nameDe: null, region: "wallonia", province: "hainaut", lat: 50.4117, lng: 4.1675, postalCodes: ["7130"] },
  { insCode: "56016", nameFr: "Chimay", nameNl: null, nameDe: null, region: "wallonia", province: "hainaut", lat: 50.0492, lng: 4.3214, postalCodes: ["6460", "6464"] },
  { insCode: "56078", nameFr: "Thuin", nameNl: null, nameDe: null, region: "wallonia", province: "hainaut", lat: 50.3403, lng: 4.2906, postalCodes: ["6530", "6532", "6534"] },
  { insCode: "53083", nameFr: "Saint-Ghislain", nameNl: null, nameDe: null, region: "wallonia", province: "hainaut", lat: 50.4500, lng: 3.8167, postalCodes: ["7330", "7333", "7334"] },
  { insCode: "53028", nameFr: "Frameries", nameNl: null, nameDe: null, region: "wallonia", province: "hainaut", lat: 50.4083, lng: 3.9000, postalCodes: ["7080"] },
  { insCode: "53082", nameFr: "Quaregnon", nameNl: null, nameDe: null, region: "wallonia", province: "hainaut", lat: 50.4475, lng: 3.8597, postalCodes: ["7390"] },
  { insCode: "55085", nameFr: "Manage", nameNl: null, nameDe: null, region: "wallonia", province: "hainaut", lat: 50.5147, lng: 4.2306, postalCodes: ["7170"] },
  { insCode: "57093", nameFr: "Comines-Warneton", nameNl: "Komen-Waasten", nameDe: null, region: "wallonia", province: "hainaut", lat: 50.7711, lng: 2.9956, postalCodes: ["7780", "7781", "7782", "7783", "7784"] },
  { insCode: "53084", nameFr: "Boussu", nameNl: null, nameDe: null, region: "wallonia", province: "hainaut", lat: 50.4333, lng: 3.7917, postalCodes: ["7300"] },
  { insCode: "52074", nameFr: "Châtelet", nameNl: null, nameDe: null, region: "wallonia", province: "hainaut", lat: 50.4042, lng: 4.5239, postalCodes: ["6200"] },
  { insCode: "52021", nameFr: "Courcelles", nameNl: null, nameDe: null, region: "wallonia", province: "hainaut", lat: 50.4533, lng: 4.3850, postalCodes: ["6180", "6181", "6182", "6183"] },

  // ============== Liège (suite) ==============
  { insCode: "62003", nameFr: "Ans", nameNl: null, nameDe: null, region: "wallonia", province: "liege", lat: 50.6611, lng: 5.5217, postalCodes: ["4430", "4431", "4432"] },
  { insCode: "61003", nameFr: "Aywaille", nameNl: null, nameDe: null, region: "wallonia", province: "liege", lat: 50.4744, lng: 5.6783, postalCodes: ["4920"] },
  { insCode: "62038", nameFr: "Fléron", nameNl: null, nameDe: null, region: "wallonia", province: "liege", lat: 50.6175, lng: 5.6772, postalCodes: ["4620", "4621", "4623"] },
  { insCode: "62121", nameFr: "Visé", nameNl: null, nameDe: null, region: "wallonia", province: "liege", lat: 50.7367, lng: 5.6953, postalCodes: ["4600", "4601", "4602"] },
  { insCode: "63089", nameFr: "Welkenraedt", nameNl: null, nameDe: null, region: "wallonia", province: "liege", lat: 50.6606, lng: 5.9750, postalCodes: ["4840"] },
  { insCode: "63072", nameFr: "Spa", nameNl: null, nameDe: null, region: "wallonia", province: "liege", lat: 50.4925, lng: 5.8636, postalCodes: ["4900"] },
  { insCode: "63075", nameFr: "Stavelot", nameNl: null, nameDe: null, region: "wallonia", province: "liege", lat: 50.3950, lng: 5.9333, postalCodes: ["4970"] },
  { insCode: "64074", nameFr: "Waremme", nameNl: null, nameDe: null, region: "wallonia", province: "liege", lat: 50.6964, lng: 5.2500, postalCodes: ["4300"] },
  { insCode: "61031", nameFr: "Huy", nameNl: null, nameDe: null, region: "wallonia", province: "liege", lat: 50.5189, lng: 5.2389, postalCodes: ["4500"] },
  { insCode: "62006", nameFr: "Awans", nameNl: null, nameDe: null, region: "wallonia", province: "liege", lat: 50.6647, lng: 5.4853, postalCodes: ["4340"] },
  { insCode: "62027", nameFr: "Esneux", nameNl: null, nameDe: null, region: "wallonia", province: "liege", lat: 50.5344, lng: 5.5733, postalCodes: ["4130"] },
  { insCode: "62120", nameFr: "Wanze", nameNl: null, nameDe: null, region: "wallonia", province: "liege", lat: 50.5333, lng: 5.2222, postalCodes: ["4520"] },
  { insCode: "62099", nameFr: "Saint-Georges-sur-Meuse", nameNl: null, nameDe: null, region: "wallonia", province: "liege", lat: 50.6086, lng: 5.3478, postalCodes: ["4470"] },
  { insCode: "63004", nameFr: "Bullange", nameNl: null, nameDe: "Büllingen", region: "germanophone", province: "liege", lat: 50.4167, lng: 6.2667, postalCodes: ["4760"] },
  { insCode: "63045", nameFr: "Lontzen", nameNl: null, nameDe: "Lontzen", region: "germanophone", province: "liege", lat: 50.6833, lng: 6.0167, postalCodes: ["4710", "4711"] },
  { insCode: "63013", nameFr: "Raeren", nameNl: null, nameDe: "Raeren", region: "germanophone", province: "liege", lat: 50.6675, lng: 6.1100, postalCodes: ["4730"] },
  { insCode: "63020", nameFr: "Burg-Reuland", nameNl: null, nameDe: "Burg-Reuland", region: "germanophone", province: "liege", lat: 50.2069, lng: 6.1083, postalCodes: ["4790"] },

  // ============== Namur (suite) ==============
  { insCode: "91030", nameFr: "Ciney", nameNl: null, nameDe: null, region: "wallonia", province: "namur", lat: 50.2944, lng: 5.0972, postalCodes: ["5590"] },
  { insCode: "93022", nameFr: "Couvin", nameNl: null, nameDe: null, region: "wallonia", province: "namur", lat: 50.0533, lng: 4.4933, postalCodes: ["5660", "5670"] },
  { insCode: "93088", nameFr: "Walcourt", nameNl: null, nameDe: null, region: "wallonia", province: "namur", lat: 50.2522, lng: 4.4314, postalCodes: ["5650"] },
  { insCode: "93056", nameFr: "Philippeville", nameNl: null, nameDe: null, region: "wallonia", province: "namur", lat: 50.1944, lng: 4.5439, postalCodes: ["5600"] },
  { insCode: "92142", nameFr: "Gembloux", nameNl: null, nameDe: null, region: "wallonia", province: "namur", lat: 50.5611, lng: 4.6900, postalCodes: ["5030", "5031"] },
  { insCode: "92137", nameFr: "Sambreville", nameNl: null, nameDe: null, region: "wallonia", province: "namur", lat: 50.4500, lng: 4.6333, postalCodes: ["5060"] },
  { insCode: "92101", nameFr: "Profondeville", nameNl: null, nameDe: null, region: "wallonia", province: "namur", lat: 50.3722, lng: 4.8639, postalCodes: ["5170"] },
  { insCode: "91013", nameFr: "Beauraing", nameNl: null, nameDe: null, region: "wallonia", province: "namur", lat: 50.1117, lng: 4.9558, postalCodes: ["5570"] },
  { insCode: "91141", nameFr: "Yvoir", nameNl: null, nameDe: null, region: "wallonia", province: "namur", lat: 50.3261, lng: 4.8842, postalCodes: ["5530"] },
  { insCode: "92054", nameFr: "Floreffe", nameNl: null, nameDe: null, region: "wallonia", province: "namur", lat: 50.4361, lng: 4.7611, postalCodes: ["5150"] },

  // ============== Luxembourg (suite) ==============
  { insCode: "82014", nameFr: "Vielsalm", nameNl: null, nameDe: null, region: "wallonia", province: "luxembourg", lat: 50.2839, lng: 5.9117, postalCodes: ["6690"] },
  { insCode: "83028", nameFr: "Houffalize", nameNl: null, nameDe: null, region: "wallonia", province: "luxembourg", lat: 50.1306, lng: 5.7867, postalCodes: ["6660"] },
  { insCode: "84029", nameFr: "Libramont-Chevigny", nameNl: null, nameDe: null, region: "wallonia", province: "luxembourg", lat: 49.9211, lng: 5.3789, postalCodes: ["6800"] },
  { insCode: "84050", nameFr: "Neufchâteau", nameNl: null, nameDe: null, region: "wallonia", province: "luxembourg", lat: 49.8400, lng: 5.4347, postalCodes: ["6840"] },
  { insCode: "85045", nameFr: "Virton", nameNl: null, nameDe: null, region: "wallonia", province: "luxembourg", lat: 49.5681, lng: 5.5339, postalCodes: ["6760"] },
  { insCode: "85011", nameFr: "Florenville", nameNl: null, nameDe: null, region: "wallonia", province: "luxembourg", lat: 49.7011, lng: 5.3050, postalCodes: ["6820"] },
  { insCode: "84059", nameFr: "Saint-Hubert", nameNl: null, nameDe: null, region: "wallonia", province: "luxembourg", lat: 50.0264, lng: 5.3719, postalCodes: ["6870"] },
  { insCode: "84075", nameFr: "Wellin", nameNl: null, nameDe: null, region: "wallonia", province: "luxembourg", lat: 50.0786, lng: 5.1100, postalCodes: ["6920"] },

  // ============== Anvers (suite) ==============
  { insCode: "11035", nameFr: "Brasschaat", nameNl: "Brasschaat", nameDe: null, region: "flanders", province: "antwerpen", lat: 51.2900, lng: 4.4992, postalCodes: ["2930"] },
  { insCode: "11013", nameFr: "Edegem", nameNl: "Edegem", nameDe: null, region: "flanders", province: "antwerpen", lat: 51.1561, lng: 4.4319, postalCodes: ["2650"] },
  { insCode: "11052", nameFr: "Mortsel", nameNl: "Mortsel", nameDe: null, region: "flanders", province: "antwerpen", lat: 51.1647, lng: 4.4486, postalCodes: ["2640"] },
  { insCode: "13016", nameFr: "Geel", nameNl: "Geel", nameDe: null, region: "flanders", province: "antwerpen", lat: 51.1644, lng: 4.9933, postalCodes: ["2440"] },
  { insCode: "13013", nameFr: "Herentals", nameNl: "Herentals", nameDe: null, region: "flanders", province: "antwerpen", lat: 51.1797, lng: 4.8367, postalCodes: ["2200"] },
  { insCode: "12014", nameFr: "Lierre", nameNl: "Lier", nameDe: null, region: "flanders", province: "antwerpen", lat: 51.1311, lng: 4.5667, postalCodes: ["2500"] },
  { insCode: "13014", nameFr: "Heist-op-den-Berg", nameNl: "Heist-op-den-Berg", nameDe: null, region: "flanders", province: "antwerpen", lat: 51.0808, lng: 4.7203, postalCodes: ["2220", "2221", "2222"] },
  { insCode: "11008", nameFr: "Boom", nameNl: "Boom", nameDe: null, region: "flanders", province: "antwerpen", lat: 51.0903, lng: 4.3678, postalCodes: ["2850"] },
  { insCode: "11005", nameFr: "Brecht", nameNl: "Brecht", nameDe: null, region: "flanders", province: "antwerpen", lat: 51.3514, lng: 4.6328, postalCodes: ["2960"] },
  { insCode: "11018", nameFr: "Kapellen", nameNl: "Kapellen", nameDe: null, region: "flanders", province: "antwerpen", lat: 51.3147, lng: 4.4314, postalCodes: ["2950"] },

  // ============== Flandre orientale (suite) ==============
  { insCode: "44013", nameFr: "Deinze", nameNl: "Deinze", nameDe: null, region: "flanders", province: "oost-vlaanderen", lat: 50.9839, lng: 3.5306, postalCodes: ["9800"] },
  { insCode: "46003", nameFr: "Beveren", nameNl: "Beveren", nameDe: null, region: "flanders", province: "oost-vlaanderen", lat: 51.2147, lng: 4.2569, postalCodes: ["9120"] },
  { insCode: "46013", nameFr: "Lokeren", nameNl: "Lokeren", nameDe: null, region: "flanders", province: "oost-vlaanderen", lat: 51.1033, lng: 3.9889, postalCodes: ["9160"] },
  { insCode: "41048", nameFr: "Termonde", nameNl: "Dendermonde", nameDe: null, region: "flanders", province: "oost-vlaanderen", lat: 51.0286, lng: 4.1014, postalCodes: ["9200", "9201", "9202", "9220", "9230"] },
  { insCode: "45035", nameFr: "Audenarde", nameNl: "Oudenaarde", nameDe: null, region: "flanders", province: "oost-vlaanderen", lat: 50.8425, lng: 3.6011, postalCodes: ["9700"] },
  { insCode: "45041", nameFr: "Renaix", nameNl: "Ronse", nameDe: null, region: "flanders", province: "oost-vlaanderen", lat: 50.7475, lng: 3.6019, postalCodes: ["9600"] },
  { insCode: "44052", nameFr: "Wetteren", nameNl: "Wetteren", nameDe: null, region: "flanders", province: "oost-vlaanderen", lat: 51.0008, lng: 3.8847, postalCodes: ["9230"] },
  { insCode: "41081", nameFr: "Ninove", nameNl: "Ninove", nameDe: null, region: "flanders", province: "oost-vlaanderen", lat: 50.8278, lng: 4.0203, postalCodes: ["9400"] },
  { insCode: "41024", nameFr: "Grammont", nameNl: "Geraardsbergen", nameDe: null, region: "flanders", province: "oost-vlaanderen", lat: 50.7700, lng: 3.8783, postalCodes: ["9500"] },

  // ============== Flandre occidentale (suite) ==============
  { insCode: "33041", nameFr: "Menin", nameNl: "Menen", nameDe: null, region: "flanders", province: "west-vlaanderen", lat: 50.7969, lng: 3.1244, postalCodes: ["8930", "8931", "8932"] },
  { insCode: "34041", nameFr: "Waregem", nameNl: "Waregem", nameDe: null, region: "flanders", province: "west-vlaanderen", lat: 50.8856, lng: 3.4189, postalCodes: ["8790"] },
  { insCode: "34009", nameFr: "Harelbeke", nameNl: "Harelbeke", nameDe: null, region: "flanders", province: "west-vlaanderen", lat: 50.8550, lng: 3.3186, postalCodes: ["8530"] },
  { insCode: "31042", nameFr: "Knokke-Heist", nameNl: "Knokke-Heist", nameDe: null, region: "flanders", province: "west-vlaanderen", lat: 51.3450, lng: 3.2925, postalCodes: ["8300", "8301"] },
  { insCode: "31022", nameFr: "Damme", nameNl: "Damme", nameDe: null, region: "flanders", province: "west-vlaanderen", lat: 51.2517, lng: 3.2828, postalCodes: ["8340"] },
  { insCode: "32011", nameFr: "Dixmude", nameNl: "Diksmuide", nameDe: null, region: "flanders", province: "west-vlaanderen", lat: 51.0314, lng: 2.8625, postalCodes: ["8600"] },
  { insCode: "37020", nameFr: "Poperinge", nameNl: "Poperinge", nameDe: null, region: "flanders", province: "west-vlaanderen", lat: 50.8553, lng: 2.7286, postalCodes: ["8970", "8972"] },
  { insCode: "38008", nameFr: "Furnes", nameNl: "Veurne", nameDe: null, region: "flanders", province: "west-vlaanderen", lat: 51.0728, lng: 2.6622, postalCodes: ["8630"] },
  { insCode: "37015", nameFr: "Wervik", nameNl: "Wervik", nameDe: null, region: "flanders", province: "west-vlaanderen", lat: 50.7833, lng: 3.0500, postalCodes: ["8940"] },
  { insCode: "31040", nameFr: "Zedelgem", nameNl: "Zedelgem", nameDe: null, region: "flanders", province: "west-vlaanderen", lat: 51.1517, lng: 3.1500, postalCodes: ["8210"] },

  // ============== Limbourg (suite) ==============
  { insCode: "72003", nameFr: "Bilzen", nameNl: "Bilzen", nameDe: null, region: "flanders", province: "limburg", lat: 50.8722, lng: 5.5183, postalCodes: ["3740"] },
  { insCode: "72018", nameFr: "Lanaken", nameNl: "Lanaken", nameDe: null, region: "flanders", province: "limburg", lat: 50.8736, lng: 5.6519, postalCodes: ["3620"] },
  { insCode: "73001", nameFr: "As", nameNl: "As", nameDe: null, region: "flanders", province: "limburg", lat: 51.0058, lng: 5.5775, postalCodes: ["3665"] },
  { insCode: "73066", nameFr: "Saint-Trond", nameNl: "Sint-Truiden", nameDe: null, region: "flanders", province: "limburg", lat: 50.8167, lng: 5.1833, postalCodes: ["3800", "3803"] },
  { insCode: "71045", nameFr: "Lommel", nameNl: "Lommel", nameDe: null, region: "flanders", province: "limburg", lat: 51.2289, lng: 5.3153, postalCodes: ["3920"] },
  { insCode: "71017", nameFr: "Heusden-Zolder", nameNl: "Heusden-Zolder", nameDe: null, region: "flanders", province: "limburg", lat: 51.0322, lng: 5.2761, postalCodes: ["3550"] },
  { insCode: "71047", nameFr: "Maasmechelen", nameNl: "Maasmechelen", nameDe: null, region: "flanders", province: "limburg", lat: 50.9744, lng: 5.6953, postalCodes: ["3630"] },
  { insCode: "71011", nameFr: "Beringen", nameNl: "Beringen", nameDe: null, region: "flanders", province: "limburg", lat: 51.0511, lng: 5.2306, postalCodes: ["3580", "3581", "3582", "3583"] },
  { insCode: "71024", nameFr: "Houthalen-Helchteren", nameNl: "Houthalen-Helchteren", nameDe: null, region: "flanders", province: "limburg", lat: 51.0339, lng: 5.3814, postalCodes: ["3530"] },
  { insCode: "73083", nameFr: "Tessenderlo", nameNl: "Tessenderlo", nameDe: null, region: "flanders", province: "limburg", lat: 51.0656, lng: 5.0856, postalCodes: ["3980"] },
  { insCode: "73109", nameFr: "Fourons", nameNl: "Voeren", nameDe: null, region: "flanders", province: "limburg", lat: 50.7589, lng: 5.7872, postalCodes: ["3790", "3791", "3792", "3793"] },
];
