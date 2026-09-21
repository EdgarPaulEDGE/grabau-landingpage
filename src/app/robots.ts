import type { MetadataRoute } from "next";
import { IST_VORSCHAU, SITE_URL } from "@/config/site";

/**
 * robots.txt
 *
 * Wirkt nur im Domain-Root. Auf der GitHub-Pages-Vorschau (Unterordner)
 * greift deshalb allein der noindex-Tag aus dem Layout, auf der Vorschau
 * unter grabau.edge-digital.ai zusätzlich der X-Robots-Tag-Header von Render.
 *
 * Suchmaschinen dürfen die Vorschau crawlen: nur so lesen sie das noindex.
 * Ein pauschales Disallow würde das verhindern und die Adresse könnte
 * trotzdem im Index landen. KI- und Archiv-Crawler werten noindex nicht
 * zuverlässig aus, die bleiben in der Vorschau komplett draußen.
 */
// Pflicht für den statischen Export: die Datei wird beim Build erzeugt
export const dynamic = "force-static";

/** Crawler für KI-Training, KI-Antworten und Webarchive */
const KI_UND_ARCHIV_CRAWLER = [
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "ClaudeBot",
  "Claude-SearchBot",
  "anthropic-ai",
  "Google-Extended",
  "Applebot-Extended",
  "PerplexityBot",
  "CCBot",
  "Bytespider",
  "Meta-ExternalAgent",
  "Amazonbot",
  "ia_archiver",
  "archive.org_bot",
];

export default function robots(): MetadataRoute.Robots {
  if (IST_VORSCHAU) {
    return {
      rules: [
        { userAgent: KI_UND_ARCHIV_CRAWLER, disallow: "/" },
        { userAgent: "*", allow: "/" },
      ],
    };
  }

  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
