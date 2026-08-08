/**
 * Präfixt root-absolute Asset-Pfade im statischen Export für GitHub Pages.
 *
 * GitHub Pages liefert Projekt-Seiten unter /<repo>/ aus. Der Export
 * referenziert Assets aber root-absolut (/_next/, /img/, /fonts/, ...).
 * Dieses Skript schreibt alle bekannten Präfixe in HTML/CSS/JS/TXT um.
 *
 * Aufruf: node scripts/pages-prefix.mjs <out-verzeichnis> <repo-name>
 */

import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const [, , outDir = "out", repo = "grabau-landingpage"] = process.argv;

/** Öffentliche Verzeichnisse, deren root-absolute Pfade umgeschrieben werden */
const ASSET_DIRS = ["_next", "img", "fonts", "logos", "expose", "terrain"];
const ENDUNGEN = new Set([".html", ".css", ".js", ".txt", ".json"]);

/** In Anführungszeichen (', ", Backtick) eingeschlossene Pfade */
const zitiert = new RegExp(`(['"\`])/(${ASSET_DIRS.join("|")})/`, "g");
/** CSS url(...) ohne Anführungszeichen */
const cssUrl = new RegExp(`url\\(\\s*/(${ASSET_DIRS.join("|")})/`, "g");

let dateien = 0;
let ersetzungen = 0;

function verarbeite(pfad) {
  for (const eintrag of readdirSync(pfad)) {
    const voll = join(pfad, eintrag);
    const info = statSync(voll);
    if (info.isDirectory()) {
      verarbeite(voll);
      continue;
    }
    if (!ENDUNGEN.has(extname(eintrag))) continue;
    const inhalt = readFileSync(voll, "utf8");
    let anzahl = 0;
    const neu = inhalt
      .replace(zitiert, (_, quote, dir) => {
        anzahl++;
        return `${quote}/${repo}/${dir}/`;
      })
      .replace(cssUrl, (_, dir) => {
        anzahl++;
        return `url(/${repo}/${dir}/`;
      });
    if (anzahl > 0) {
      writeFileSync(voll, neu, "utf8");
      dateien++;
      ersetzungen += anzahl;
    }
  }
}

verarbeite(outDir);
console.log(`pages-prefix: ${ersetzungen} Pfade in ${dateien} Dateien auf /${repo}/ umgeschrieben`);
