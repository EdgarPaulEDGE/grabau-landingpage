/**
 * Zentrale Datenquelle für die Grabau-Landing-Page.
 * Alle harten Fakten stehen hier, damit die Seite konsistent bleibt und
 * Nina / die WFL Werte an EINER Stelle ändern kann.
 *
 * Quellen: wfl.de/de/gewerbegebiet_grabau (Stand Mai 2026),
 * B-Plan Nr. 4 „Auf'n Ruhm", WFL-Standortdaten.
 */

export const CONTACT = {
  name: "Nina Warncke",
  role: "Ansprechpartnerin Gewerbeflächen · WFL",
  org: "Wirtschaftsförderung Herzogtum Lauenburg",
  phone: "+49 4541 86 04 10",
  phoneHref: "tel:+494541860410",
  email: "warncke@wfl.de",
  address: "Junkernstraße 7, 23909 Ratzeburg",
  photo: "/img/nina-warncke.jpg",
} as const;

/** Kernaussagen für die Vertrauensleiste unter dem Hero. */
export const HERO_PROOF = [
  "Voll erschlossen",
  "B-Plan rechtskräftig",
  "Verfügbar ab sofort",
  "Keine Maklerprovision",
  "Direkter Draht zur WFL",
] as const;

/** Große Kennzahlen (Stat-Strip). value wird animiert hochgezählt. */
export interface Stat {
  value: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
  label: string;
  sub?: string;
}

export const STATS: Stat[] = [
  { value: 40, suffix: " km", label: "bis Hamburg", sub: "Hafen · Flughafen · Fachkräfte" },
  { value: 7, suffix: " km", label: "zur A24", sub: "Auffahrt Talkau, Richtung Hamburg" },
  { value: 70380, suffix: " m²", label: "verfügbare Fläche", sub: "auf 11 Hektar Gewerbepark" },
  { value: 1800, prefix: "ab ", suffix: " m²", label: "Grundstücksgröße", sub: "flexibel bis 18.600 m²" },
];

/** Verkaufsargumente in Kurzform (Problem → Lösung Abschnitt). */
export const SOLUTION_POINTS = [
  {
    title: "Sofort bebaubar statt jahrelang warten",
    body: "Das Gebiet ist vollständig erschlossen, der Bebauungsplan Nr. 4 ist rechtskräftig. Nach dem Kauf können Sie direkt bauen. Kein Planungsstau, keine offenen Genehmigungsfragen.",
  },
  {
    title: "Nähe zu Hamburg, ohne Hamburger Preise",
    body: "40 Minuten bis zur Hansestadt, direkt an der B207 und 7 km zur A24. Sie erreichen Hafen, Flughafen und die Fachkräfte der Metropolregion, zahlen aber deutlich günstigere Flächenpreise.",
  },
  {
    title: "Platz, der mitwächst",
    body: "Grundstücke von 1.800 bis 18.600 m², nach Bedarf parzellierbar. Ob kompakter Neubau oder großes Werk mit Reserveflächen: Grabau passt sich Ihrem Vorhaben an.",
  },
  {
    title: "Ein Ansprechpartner statt Behördendschungel",
    body: "Gemeinde und WFL entscheiden gemeinsam und lokal. Sie sprechen direkt mit Nina Warncke, nicht mit einer anonymen Vermarktungsstelle. Schnelle Wege, klare Zusagen.",
  },
];

/** Anbindung / Entfernungen. */
export interface DistanceItem {
  place: string;
  detail: string;
  value: string;
}

export const DISTANCES: DistanceItem[] = [
  { place: "B207", detail: "Bundesstraße", value: "direkt" },
  { place: "A24 Talkau", detail: "Autobahn Hamburg–Berlin", value: "7,0 km" },
  { place: "Schwarzenbek", detail: "Stadt & Bahnhof", value: "2,7 km" },
  { place: "Hamburg", detail: "Metropolregion", value: "≈ 40 km" },
  { place: "Flughafen Hamburg", detail: "internationale Anbindung", value: "41 km" },
  { place: "Hafen Hamburg", detail: "Überseehafen", value: "46 km" },
  { place: "Lübeck", detail: "Ostsee & Flughafen", value: "≈ 41 km" },
  { place: "Bushaltestelle", detail: "ÖPNV vor der Tür", value: "0,2 km" },
];

/** Grundstücke aus dem offiziellen Standortplan (Stand Mai 2026).
 *  x / y = Position in Prozent auf dem Standortplan-Bild (für die Pins). */
export type PlotStatus = "verfuegbar" | "reserviert" | "verkauft";

export interface Plot {
  id: string;
  label: string;
  size: number | null; // m², null wenn verkauft / nicht ausgewiesen
  status: PlotStatus;
  x: number;
  y: number;
}

export const PLOTS: Plot[] = [
  { id: "1", label: "Nr. 1", size: null, status: "verkauft", x: 45, y: 82 },
  { id: "2", label: "Nr. 2", size: null, status: "verkauft", x: 39, y: 66 },
  { id: "3", label: "Nr. 3", size: 5440, status: "verfuegbar", x: 44, y: 52 },
  { id: "4", label: "Nr. 4", size: 3700, status: "verfuegbar", x: 47.5, y: 44 },
  { id: "5", label: "Nr. 5", size: 4000, status: "verfuegbar", x: 51.5, y: 31 },
  { id: "6", label: "Nr. 6", size: null, status: "verkauft", x: 54, y: 26 },
  { id: "7", label: "Nr. 7", size: 4540, status: "verfuegbar", x: 56.5, y: 21 },
  { id: "8", label: "Nr. 8", size: 11200, status: "verfuegbar", x: 61.5, y: 35 },
  { id: "9", label: "Nr. 9", size: 12500, status: "verfuegbar", x: 66, y: 49 },
  { id: "10", label: "Nr. 10", size: 7300, status: "verfuegbar", x: 61, y: 58 },
  { id: "11", label: "Nr. 11", size: 12000, status: "reserviert", x: 54, y: 65 },
  { id: "12a", label: "Nr. 12a", size: 2000, status: "verfuegbar", x: 49, y: 57 },
  { id: "12b", label: "Nr. 12b", size: 2600, status: "verfuegbar", x: 50.5, y: 62 },
  { id: "13", label: "Nr. 13", size: 3800, status: "verfuegbar", x: 53, y: 54 },
  { id: "14a", label: "Nr. 14a", size: 1800, status: "reserviert", x: 54, y: 46 },
  { id: "14b", label: "Nr. 14b", size: null, status: "verkauft", x: 56, y: 50 },
];

export const PLOT_STATUS_META: Record<
  PlotStatus,
  { label: string; color: string; dot: string }
> = {
  verfuegbar: { label: "Verfügbar", color: "text-avail", dot: "var(--color-avail)" },
  reserviert: { label: "Reserviert", color: "text-reserved", dot: "var(--color-reserved)" },
  verkauft: { label: "Verkauft", color: "text-sold", dot: "var(--color-sold)" },
};

/** Passende Branchen (B-Plan-konform). Icon-Name = lucide-react. */
export const INDUSTRIES = [
  { icon: "Factory", title: "Metall & Maschinenbau", wz: "WZ 25 · 28", desc: "Metallverarbeitung, Werkzeug- und Maschinenbau." },
  { icon: "CircuitBoard", title: "Elektronik & Medizintechnik", wz: "WZ 26 · 27", desc: "Elektronik, Optik, Mess- und Medizintechnik." },
  { icon: "Car", title: "Fahrzeug- & Teilebau", wz: "WZ 29 · 30", desc: "Herstellung von Fahrzeugen und Komponenten." },
  { icon: "Armchair", title: "Möbel & Holz", wz: "WZ 31", desc: "Möbelherstellung und Holzverarbeitung." },
  { icon: "HardHat", title: "Bau, Ausbau & Handwerk", wz: "WZ 41–43", desc: "Hoch- und Tiefbau, Bauinstallation, Handwerk." },
  { icon: "Wrench", title: "Reparatur & Installation", wz: "WZ 33", desc: "Instandhaltung und Montage von Anlagen." },
  { icon: "Boxes", title: "Glas, Keramik & Beton", wz: "WZ 23", desc: "Herstellung von Baustoffen und Erzeugnissen." },
  { icon: "PackageOpen", title: "Produktion & Manufaktur", wz: "WZ 32", desc: "Sonstige Warenherstellung und Manufaktur." },
] as const;

/** Ablauf in 4 Schritten. */
export const PROCESS = [
  { step: "01", title: "Exposé anfordern", body: "Sie erhalten Lageplan, B-Plan und alle Eckdaten kostenlos per Mail. Unverbindlich, ohne Verkaufsdruck." },
  { step: "02", title: "Standort kennenlernen", body: "Vor-Ort-Termin oder Videocall mit der WFL. Gemeinsam finden wir das Grundstück, das zu Ihrem Vorhaben passt." },
  { step: "03", title: "Reservieren & kaufen", body: "Verbindliche Reservierung, dann notarieller Kaufvertrag mit der Gemeinde Grabau. Transparent und ohne Maklerprovision." },
  { step: "04", title: "Bauen & loslegen", body: "Voll erschlossen, B-Plan rechtskräftig: Sie können sofort bauen. GRZ 0,8, Gebäudehöhe bis 18 m." },
];

/** Harte Standortdaten (Fakten-Tabelle). */
export const FACTS: { label: string; value: string }[] = [
  { label: "Gebietsgröße", value: "110.000 m²" },
  { label: "Verfügbare Fläche", value: "70.380 m²" },
  { label: "Grundstücke", value: "1.800 – 18.600 m²" },
  { label: "Parzellierung", value: "nach Bedarf möglich" },
  { label: "Erschließung", value: "vollständig erschlossen" },
  { label: "Verfügbar ab", value: "sofort" },
  { label: "Nutzungsart", value: "Gewerbegebiet (GE)" },
  { label: "Bebauungsplan", value: "Nr. 4 „Auf'n Ruhm“" },
  { label: "Grundflächenzahl (GRZ)", value: "0,8" },
  { label: "Gebäudehöhe", value: "bis 18 m" },
  { label: "Gewerbesteuer-Hebesatz", value: "370 %" },
  { label: "Grundsteuer B", value: "282 %" },
];

/** FAQ (Fragen, die Entscheider vor dem Kontakt haben). */
export const FAQS = [
  {
    q: "Was kostet ein Grundstück?",
    a: "Den Quadratmeterpreis nennen wir Ihnen im persönlichen Gespräch, abhängig von Grundstück und Vorhaben. Verkauft wird direkt durch die Gemeinde Grabau gemeinsam mit der WFL. Es fällt keine Maklerprovision an.",
  },
  {
    q: "Kann ich Grundstücke zusammenlegen oder teilen?",
    a: "Ja. Die Parzellierung ist nach Bedarf teilweise möglich. So entstehen Flächen von 1.800 bis rund 18.600 m². Sagen Sie uns einfach, wie viel Platz Sie brauchen.",
  },
  {
    q: "Welche Betriebe dürfen sich ansiedeln?",
    a: "Grabau ist ein Gewerbegebiet (GE) nach Bebauungsplan Nr. 4. Willkommen sind produzierendes Gewerbe, Handwerk sowie Bau- und Installationsbetriebe. Schwere Industrie mit hohen Emissionen gehört in ein Industriegebiet und passt hier nicht.",
  },
  {
    q: "Wie schnell kann ich bauen?",
    a: "Sofort nach dem Kauf. Das Gebiet ist voll erschlossen und der Bebauungsplan rechtskräftig. Es gibt keinen Planungsstau, der Sie ausbremst.",
  },
  {
    q: "Wie gut ist die Anbindung an Hamburg?",
    a: "Sehr gut. Direkt an der B207, nur 7 km zur A24 (Hamburg–Berlin) und rund 40 km bis Hamburg mit Hafen, Flughafen und den Fachkräften der Metropolregion.",
  },
  {
    q: "Welche Rolle spielt der Fehmarnbelttunnel?",
    a: "Grabau liegt im Hansebelt-Korridor. Mit dem Fehmarnbelttunnel (Eröffnung um 2031) wird die Region zur zentralen Landverbindung zwischen Skandinavien und Kontinentaleuropa. Wer heute hier investiert, sitzt morgen an einer der wichtigsten Nord-Süd-Achsen Europas.",
  },
];

/** WFL-Netzwerk / Partner für die Vertrauensleiste. */
export const NETWORK = [
  "Gemeinde Grabau",
  "Metropolregion Hamburg",
  "IHK zu Lübeck",
  "HanseBelt e.V.",
  "WTSH",
  "Kreis Herzogtum Lauenburg",
];

/** Navigationspunkte (Anker). */
export const NAV = [
  { href: "#lage", label: "Lage" },
  { href: "#flaechen", label: "Flächen" },
  { href: "#standortplan", label: "Standortplan" },
  { href: "#branchen", label: "Branchen" },
  { href: "#ablauf", label: "Ablauf" },
  { href: "#kontakt", label: "Kontakt" },
];
