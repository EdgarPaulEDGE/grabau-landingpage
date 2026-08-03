import type { Metadata } from "next";
import "./globals.css";
import ScrollProgress from "@/components/ui/ScrollProgress";
import { IST_VORSCHAU, SITE_URL } from "@/config/site";
import { baueSchemaGraph } from "@/lib/schema";

export const metadata: Metadata = {
  // Basis für absolute URLs (Link-Vorschaubilder, canonical).
  // Umstellen auf die eigene Domain in src/config/site.ts → SITE_URL.
  metadataBase: new URL(`${SITE_URL}/`),
  alternates: { canonical: "./" },
  title: {
    default:
      "Gewerbepark Grabauer Ruhm · Gewerbeflächen an der B207, 40 Min. vor Hamburg",
    template: "%s · Gewerbepark Grabau",
  },
  description:
    "Voll erschlossene Gewerbegrundstücke im Kreis Herzogtum Lauenburg. Direkt an der B207, 7 km zur A24, 40 Minuten vor Hamburg. Flexibel parzellierbar ab 1.800 m². Bebauungsplan rechtskräftig, verfügbar ab sofort.",
  keywords: [
    "Gewerbegrundstück Hamburg Umland",
    "Gewerbefläche kaufen Schleswig-Holstein",
    "Gewerbepark Grabau",
    "Gewerbegebiet Herzogtum Lauenburg",
    "Produktionsstandort Metropolregion Hamburg",
    "erschlossene Gewerbefläche B207 A24",
  ],
  openGraph: {
    type: "website",
    locale: "de_DE",
    title: "Gewerbepark Grabauer Ruhm · Ihr nächster Standort, schon erschlossen",
    description:
      "Voll erschlossene Gewerbegrundstücke an der B207, 40 Minuten vor Hamburg. Ab 1.800 m², sofort bebaubar.",
    // Bewusst OHNE führenden Slash: die Seite liegt auf GitHub Pages in
    // einem Unterordner, ein root-absoluter Pfad würde ihn überschreiben.
    images: [{ url: "img/hero-aerial.jpg", width: 2000, height: 1400 }],
  },
  // WFL-Wortmarke auf Weinrot. Pfade bewusst relativ, damit sie auch im
  // GitHub-Pages-Unterordner stimmen.
  icons: {
    icon: [
      { url: "favicon.ico", sizes: "any" },
      { url: "icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: { url: "apple-touch-icon.png", sizes: "180x180" },
  },
  // Vorschau unter github.io bleibt aus dem Index, damit sie später nicht
  // gegen die eigene Domain konkurriert (siehe IST_VORSCHAU in site.ts).
  robots: IST_VORSCHAU
    ? { index: false, follow: false }
    : { index: true, follow: true },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <meta name="theme-color" content="#971B22" />
        {/* Strukturierte Daten: Standort, Angebot, Anbieter und FAQ */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(baueSchemaGraph()) }}
        />
        {/* Ohne JavaScript: alle per Animation versteckten Elemente sichtbar machen */}
        <noscript>
          <style>{`[style*="opacity"]{opacity:1!important;transform:none!important}`}</style>
        </noscript>
      </head>
      <body>
        {children}
        {/* Globale Polish-Ebene: Fortschrittslinie, Filmkorn */}
        <ScrollProgress />
        <div
          aria-hidden="true"
          className="grain pointer-events-none fixed inset-0 z-[34]"
        />
      </body>
    </html>
  );
}
