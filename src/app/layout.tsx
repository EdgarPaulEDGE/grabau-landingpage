import type { Metadata } from "next";
import "./globals.css";
import ScrollProgress from "@/components/ui/ScrollProgress";
import CustomCursor from "@/components/ui/CustomCursor";

export const metadata: Metadata = {
  metadataBase: new URL("https://gewerbepark-grabau.de"),
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
    images: [{ url: "/img/hero-aerial.jpg", width: 2000, height: 1400 }],
  },
  robots: { index: true, follow: true },
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
        {/* Ohne JavaScript: alle per Animation versteckten Elemente sichtbar machen */}
        <noscript>
          <style>{`[style*="opacity"]{opacity:1!important;transform:none!important}`}</style>
        </noscript>
      </head>
      <body>
        {children}
        {/* Globale Polish-Ebene: Fortschrittslinie, Cursor-Begleiter, Filmkorn */}
        <ScrollProgress />
        <CustomCursor />
        <div
          aria-hidden="true"
          className="grain pointer-events-none fixed inset-0 z-[34]"
        />
      </body>
    </html>
  );
}
