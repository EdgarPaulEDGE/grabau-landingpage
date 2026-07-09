# Gewerbepark Grabauer Ruhm — Landing Page

Konversionsoptimierte Landing Page zur Vermarktung der Gewerbeflächen im
Gewerbepark Grabauer Ruhm (WFL Herzogtum Lauenburg / Gemeinde Grabau).

**Strategie:** Pull statt Push. Die Seite fängt Suchintention ab (SEO + später
Google Ads) und wandelt Besucher über ein Exposé-Formular in Leads für Nina
Warncke um. Herzstück ist der interaktive Standortplan.

## Tech Stack

- **Next.js 16** (App Router) + React 19 + TypeScript
- **Tailwind CSS v4**
- **three.js** mit eigenen GLSL-Shadern (WebGL2): Hero-Kino, 3D-Standortplan,
  Scroll-Karte "Die Achse"
- **react-hook-form + zod** für das Lead-Formular
- **lucide-react** für Icons
- Fonts: **Museo Sans Rounded** (Headlines + Labels, Logo-Schrift),
  **Fira Sans** (Body)

## 3D-Komponenten

Alle WebGL-Ebenen liegen über statischen Fallbacks: ohne WebGL bleibt die
Seite voll nutzbar. Animationen pausieren in unsichtbaren Tabs und außerhalb
des Viewports, `prefers-reduced-motion` wird respektiert.

- `HeroAerialCanvas`: Luftbild mit Vermessungs-Scan, Scroll-Zoom und
  Goldstaub-Partikeln.
- `SitePlan3D`: interaktiver 3D-Standortplan (Hover, Klick wählt Grundstück,
  synchron mit Liste und Formular). Umschalter auf den offiziellen 2D-Plan.
- `KorridorScroll` + `KorridorMap3D`: gepinnte Scroll-Sektion, die die
  Verkehrsrouten von Grabau nach Hamburg, Lübeck, Skandinavien und Berlin
  zeichnet.

## Entwicklung

```bash
npm install
npm run dev      # http://localhost:3024 (siehe .claude/launch.json)
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
  fonts/               # Bodoni / Fira Sans / Museo Sans Rounded
  expose/              # B-Plan Nr. 4 als PDF (Download)
```

## Inhalte ändern

Fast alles steht in **`src/config/site.ts`**:

- `PLOTS` — die Grundstücke mit Größe, Status (`verfuegbar` / `reserviert` /
  `verkauft`) und Position auf dem Standortplan (`x` / `y` in Prozent).
- `STATS`, `FACTS`, `DISTANCES` — Kennzahlen und Standortdaten.
- `FAQS`, `INDUSTRIES`, `PROCESS` — Fragen, Branchen, Ablauf.
- `CONTACT` — Ansprechpartnerin.

Status der Grundstücke ändern: einfach `status` in `PLOTS` anpassen. Die
Verfügbarkeits-Anzeige im Hero und die Karte aktualisieren sich automatisch.

## Lead-Formular

Anfragen gehen an `POST /api/lead`. Ohne Konfiguration werden sie lokal in
`data/leads.jsonl` gespeichert und der Nutzer bekommt einen mailto-Fallback.

**Für den Produktivbetrieb E-Mail-Versand aktivieren:** `.env.local.example`
nach `.env.local` kopieren und einen [Resend](https://resend.com)-API-Key
eintragen. Dann geht jede Anfrage per Mail an `warncke@wfl.de`.

## Deployment

Die Seite braucht wegen der `/api/lead`-Route einen Node-Server (kein reines
Static Export).

- **Vercel:** Repo verbinden, fertig. `RESEND_API_KEY` als Env-Variable setzen.
- **Render.com:** Web Service, Build `npm install && npm run build`,
  Start `npm run start`, Env-Variablen setzen.

## Barrierefreiheit & Robustheit

- Einblende-Animationen laufen als reine CSS-Animation (kein JavaScript nötig),
  Inhalt bleibt immer sichtbar.
- `prefers-reduced-motion` wird respektiert.
- Semantisches HTML, WCAG-taugliche Kontraste, Mobile First.
