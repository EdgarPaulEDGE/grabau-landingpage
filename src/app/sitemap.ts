import type { MetadataRoute } from "next";
import { IST_VORSCHAU, SITE_URL } from "@/config/site";

/**
 * sitemap.xml
 *
 * Die Seite ist ein Onepager, es gibt genau eine URL. Anker (#standortplan
 * usw.) gehören nicht in eine Sitemap.
 *
 * Solange die Seite als Vorschau auf noindex steht, bleibt die Sitemap
 * bewusst leer: eine Sitemap, die eine noindex-URL meldet, ist ein
 * widersprüchliches Signal (und in der Search Console eine Warnung).
 * Mit NEXT_PUBLIC_SITE_INDEXIEREN=1 (nur auf der echten Domain) füllt sie
 * sich automatisch.
 */
// Pflicht für den statischen Export: lastModified friert auf die Bauzeit ein
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  if (IST_VORSCHAU) return [];

  return [
    {
      url: `${SITE_URL}/`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
