import type { MetadataRoute } from "next";
import { IST_VORSCHAU, SITE_URL } from "@/config/site";

/**
 * robots.txt
 *
 * Wichtig: Bots lesen robots.txt ausschließlich im Domain-Root. Auf der
 * GitHub-Pages-Vorschau (Unterordner) ist diese Datei daher wirkungslos,
 * dort greift der noindex-Tag aus dem Layout. Wirksam wird sie mit der
 * eigenen Domain.
 *
 * Auch in der Vorschau wird das Crawlen ERLAUBT: ein Disallow würde
 * verhindern, dass Suchmaschinen den noindex-Tag überhaupt lesen — die
 * URL könnte dann trotzdem im Index auftauchen.
 */
// Pflicht für den statischen Export: die Datei wird beim Build erzeugt
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    // Sitemap erst verweisen, wenn die Seite auch indexiert werden soll
    ...(IST_VORSCHAU ? {} : { sitemap: `${SITE_URL}/sitemap.xml` }),
    host: SITE_URL,
  };
}
