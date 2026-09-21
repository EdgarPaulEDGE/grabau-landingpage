# Gewerbepark Grabauer Ruhm · Landing Page

Konversionsoptimierte Landing Page zur Vermarktung der Gewerbeflächen im Gewerbepark Grabauer Ruhm (WFL Herzogtum Lauenburg / Gemeinde Grabau).

**Strategie:** Pull statt Push. Die Seite fängt Suchintention ab (SEO + später Google Ads) und wandelt Besucher über ein Exposé-Formular in Leads für Nina Warncke um. Herzstück ist der interaktive Standortplan.

## Tech Stack

- **Next.js 16** (App Router) + React 19 + TypeScript
- **Tailwind CSS v4**
- **three.js** mit eigenen GLSL-Shadern (WebGL2): Hero-Kino, Kamerafahrt über echtes Gelände, 3D-Standortplan
- **MapLibre** für die Scroll-Karte „Die Achse“
- **react-hook-form + zod** für das Lead-Formular
- **lucide-react** für Icons
- Fonts: **Museo Sans Rounded** (Headlines + Labels, Logo-Schrift), **Fira Sans** (Body)

## 3D-Komponenten

Alle WebGL-Ebenen liegen über statischen Fallbacks: ohne WebGL bleibt die Seite voll nutzbar. Animationen pausieren in unsichtbaren Tabs und außerhalb des Viewports, `prefers-reduced-motion` wird respektiert.

- `HeroAerialCanvas`: Luftbild mit Vermessungs-Scan, Scroll-Zoom und Goldstaub-Partikeln.
- `KorridorScroll` + `KorridorMapReal`: gepinnte Scroll-Sektion, die die Verkehrsrouten von Grabau nach Hamburg, Lübeck, Skandinavien und Berlin zeichnet.
- `TerrainFlight` + `TerrainFlightCanvas`: gepinnte Kamerafahrt „Der Anflug“ über echte Geodaten (Copernicus DEM, DGM1 und Luftbilder Schleswig-Holstein, OpenStreetMap).
- `SitePlan3D`: interaktiver 3D-Standortplan (Hover, Klick wählt Grundstück, synchron mit Liste und Formular). Umschalter auf den offiziellen 2D-Plan.

## Entwicklung

```bash
npm install
npm run dev      # http://localhost:3024
npm run build    # Produktions-Build (immer vor Commit testen)
```

## Struktur

```
src/
  app/
    page.tsx           # Komposition aller Sektionen
    layout.tsx         # Metadaten / SEO
    globals.css        # Design-System (Farben, Fonts, .reveal-Animation)
    api/lead/route.ts  # Nimmt Formular-Anfragen entgegen
  components/          # Eine Datei pro Sektion (Hero, SitePlan, LeadForm, ...)
  config/site.ts       # ALLE Fakten an einer Stelle (Grundstücke, Fakten, FAQ)
public/
  img/                 # Luftbilder, Standortplan, Foto Nina Warncke
  logos/               # WFL-Logo
  fonts/               # Fira Sans / Museo Sans Rounded
  terrain/             # Geländedaten und Luftbilder für die Kamerafahrt
  expose/              # B-Plan Nr. 4 als PDF (Download)
```

## Inhalte ändern

Fast alles steht in **`src/config/site.ts`**:

- `PLOTS`: die Grundstücke mit Größe, Status (`verfuegbar` / `reserviert` / `verkauft`) und Position auf dem Standortplan (`x` / `y` in Prozent).
- `STATS`, `FACTS`, `DISTANCES`: Kennzahlen und Standortdaten.
- `FAQS`, `INDUSTRIES`, `PROCESS`: Fragen, Branchen, Ablauf.
- `CONTACT`: Ansprechpartnerin.

Status der Grundstücke ändern: einfach `status` in `PLOTS` anpassen. Die Verfügbarkeits-Anzeige im Hero und die Karte aktualisieren sich automatisch.

## Lead-Formular

Anfragen gehen an `POST /api/lead`. Ohne Konfiguration werden sie lokal in `data/leads.jsonl` gespeichert und der Nutzer bekommt einen mailto-Fallback.

**Für den Produktivbetrieb E-Mail-Versand aktivieren:** `.env.local.example` nach `.env.local` kopieren und einen [Resend](https://resend.com)-API-Key eintragen. Dann geht jede Anfrage per Mail an `warncke@wfl.de`.

## Vorschau und Indexierung

Jeder Build ist standardmäßig eine Vorschau und steht auf `noindex, nofollow` (dazu `noarchive`, `nosnippet`, `noimageindex`, kein Canonical, leere Sitemap, KI- und Archiv-Crawler in der `robots.txt` gesperrt). Gesteuert über zwei Build-Variablen:

| Variable | Wirkung |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | Adresse der Auslieferung für Link-Vorschaubild und JSON-LD. Ohne Wert: die GitHub-Pages-Adresse. |
| `NEXT_PUBLIC_SITE_INDEXIEREN` | Nur `1` schaltet die Indexierung frei. Ausschließlich für die echte Domain setzen. |

Laufende Vorschauen: `grabau.edge-digital.ai` (Render Static Site `grabau-landingpage-static`, zusätzlich Header `X-Robots-Tag` auf allen Pfaden, also auch für das B-Plan-PDF) und die GitHub-Pages-Kopie.

## Deployment (Render.com)

Die Seite braucht wegen der `/api/lead`-Route einen Node-Server (kein reines Static Export). Die Service-Konfiguration liegt als Blueprint in [render.yaml](render.yaml) (Region Frankfurt, Auto-Deploy auf `main`).

1. [dashboard.render.com](https://dashboard.render.com) → **New → Blueprint**
2. Repo `EdgarPaulEDGE/grabau-landingpage` auswählen, Render liest die `render.yaml` und legt den Web Service an.
3. Beim Anlegen werden zwei Werte abgefragt:
   - `RESEND_API_KEY`: API-Key von [resend.com](https://resend.com)
   - `LEAD_FROM_EMAIL`: verifizierte Absender-Adresse (z. B. `grabau@wfl.de`)

Wichtig: Ohne gültigen `RESEND_API_KEY` meldet das Formular in Produktion bewusst einen Fehler und zeigt den direkten E-Mail-Fallback. So geht kein Lead still verloren (das Dateisystem auf Render ist flüchtig).

## Barrierefreiheit & Robustheit

- Einblende-Animationen laufen als reine CSS-Animation (kein JavaScript nötig), Inhalt bleibt immer sichtbar.
- `prefers-reduced-motion` wird respektiert.
- Semantisches HTML, WCAG-taugliche Kontraste, Mobile First.
