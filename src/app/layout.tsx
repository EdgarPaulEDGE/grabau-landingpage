import type { Metadata } from "next";
import "./globals.css";
import ScrollProgress from "@/components/ui/ScrollProgress";
import { IST_VORSCHAU, SITE_URL } from "@/config/site";
import { baueSchemaGraph } from "@/lib/schema";

export const metadata: Metadata = {
  // Basis für absolute URLs (Link-Vorschaubilder, canonical).
  // Kommt aus NEXT_PUBLIC_SITE_URL, siehe src/config/site.ts.
  metadataBase: new URL(`${SITE_URL}/`),
  // Canonical nur auf der echten Domain. Auf einer noindex-Vorschau wäre
  // es ein widersprüchliches Signal.
  ...(IST_VORSCHAU ? {} : { alternates: { canonical: "./" } }),
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
  // Vorschauen bleiben komplett aus Suchmaschinen und Archiven raus,
  // damit sie später nicht gegen die eigene Domain konkurrieren.
  robots: IST_VORSCHAU
    ? {
        index: false,
        follow: false,
        noarchive: true,
        nosnippet: true,
        noimageindex: true,
        googleBot: {
          index: false,
          follow: false,
          noarchive: true,
          nosnippet: true,
          noimageindex: true,
        },
      }
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
