import type { NextConfig } from "next";

// STATIC_EXPORT=1 erzeugt eine rein statische Vorschau (GitHub Pages):
// kein Server, keine API. Die Pfad-Präfixe für den Pages-Unterordner
// setzt scripts/pages-prefix.mjs nach dem Build.
const istExport = process.env.STATIC_EXPORT === "1";

const nextConfig: NextConfig = {
  ...(istExport ? { output: "export" as const } : {}),
  images: {
    // Moderne Formate für kleinere Dateien und schnelleres Laden
    formats: ["image/avif", "image/webp"],
    // Statischer Export hat keinen Bild-Optimierer
    ...(istExport ? { unoptimized: true } : {}),
  },
};

export default nextConfig;
