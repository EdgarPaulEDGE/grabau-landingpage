import Image from "next/image";
import { Check, ArrowRight, MapPin, ArrowDown } from "lucide-react";
import Reveal from "./ui/Reveal";
import HeroAerialCanvas from "./HeroAerialCanvas";
import { HERO_PROOF, PLOTS } from "@/config/site";

export default function Hero() {
  const avail = PLOTS.filter((p) => p.status === "verfuegbar").length;
  const reserved = PLOTS.filter((p) => p.status === "reserviert").length;
  const sold = PLOTS.filter((p) => p.status === "verkauft").length;

  return (
    <section id="top" className="relative min-h-[100svh] w-full overflow-hidden bg-night">
      {/* Luftbild als Fallback (SSR + falls WebGL nicht verfügbar) */}
      <div className="absolute inset-0 overflow-hidden">
        <Image
          src="/img/hero-aerial.jpg"
          alt="Luftbild des erschlossenen Gewerbeparks Grabauer Ruhm an der B207"
          fill
          priority
          sizes="100vw"
          className="kenburns object-cover object-center"
        />
      </div>

      {/* WebGL-Ebene: Luftbild mit dezentem Vermessungs-Scan-Shader */}
      <HeroAerialCanvas src="/img/hero-aerial.jpg" className="z-[1]" />

      {/* Overlays für Lesbarkeit + Markenstimmung (über dem Canvas) */}
      <div className="absolute inset-0 z-[2] bg-gradient-to-t from-night via-night/55 to-night/25" />
      <div className="absolute inset-0 z-[2] bg-gradient-to-r from-night/85 via-night/35 to-transparent" />
      <div
        className="absolute inset-0 z-[2] opacity-40 mix-blend-multiply"
        style={{
          background:
            "radial-gradient(120% 80% at 15% 90%, rgba(110,19,25,0.65), transparent 60%)",
        }}
      />

      {/* Inhalt */}
      <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-7xl flex-col justify-end px-5 pb-14 pt-32 md:px-8 md:pb-20">
        <div className="grid items-end gap-10 lg:grid-cols-12">
          {/* Text */}
          <div className="lg:col-span-8">
            <Reveal>
              <div className="flex items-center gap-3">
                <span className="h-px w-10 bg-gold" />
                <span className="eyebrow text-gold">
                  Gewerbepark Grabauer Ruhm · Metropolregion Hamburg
                </span>
              </div>
            </Reveal>

            <Reveal delay={0.1}>
              <h1 className="mt-6 max-w-4xl text-balance font-[family-name:var(--font-display)] text-[2.7rem] font-bold leading-[1.02] text-paper sm:text-6xl md:text-[4.6rem]">
                Ihr nächster Standort.
                <br />
                <span className="text-gold">Schon erschlossen.</span>
              </h1>
            </Reveal>

            <Reveal delay={0.2}>
              <p className="mt-7 max-w-xl text-lg leading-relaxed text-paper/85 md:text-xl">
                Voll erschlossene Gewerbegrundstücke direkt an der B207, 7 km zur
                A24 und 40 Minuten vor Hamburg. Flexibel parzellierbar von 1.800
                bis 18.600 m². Bebauungsplan rechtskräftig, verfügbar ab sofort.
              </p>
            </Reveal>

            <Reveal delay={0.3}>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
                <a
                  href="#kontakt"
                  className="group inline-flex items-center justify-center gap-2 rounded-full bg-wine px-8 py-4 text-base font-semibold text-paper shadow-[0_18px_45px_-15px_rgba(151,27,34,0.9)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-wine-light"
                >
                  Exposé &amp; Lageplan anfordern
                  <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                </a>
                <a
                  href="#standortplan"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-paper/40 px-8 py-4 text-base font-semibold text-paper backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:bg-paper hover:text-ink"
                >
                  <MapPin className="h-5 w-5" />
                  Standortplan ansehen
                </a>
              </div>
            </Reveal>

            <Reveal delay={0.4}>
              <ul className="mt-9 flex flex-wrap gap-x-6 gap-y-2.5">
                {HERO_PROOF.map((p) => (
                  <li
                    key={p}
                    className="flex items-center gap-2 text-sm font-medium text-paper/85"
                  >
                    <Check className="h-4 w-4 text-gold" strokeWidth={2.5} />
                    {p}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>

          {/* Verfügbarkeits-Karte (Verknappung als Vertrauenssignal) */}
          <div className="lg:col-span-4">
            <Reveal delay={0.5}>
              <div className="rounded-2xl border border-paper/15 bg-white/10 p-6 backdrop-blur-xl">
                <p className="eyebrow text-paper/60">Verfügbarkeit heute</p>
                <div className="mt-4 space-y-3.5">
                  <AvailRow
                    dot="var(--color-avail)"
                    label="Sofort verfügbar"
                    value={avail}
                    strong
                  />
                  <AvailRow
                    dot="var(--color-reserved)"
                    label="Verbindlich reserviert"
                    value={reserved}
                  />
                  <AvailRow
                    dot="var(--color-sold)"
                    label="Bereits verkauft"
                    value={sold}
                  />
                </div>
                <div className="mt-5 border-t border-paper/15 pt-4">
                  <p className="text-sm leading-relaxed text-paper/70">
                    Die Nachfrage läuft. Wer plant, sollte sich sein Grundstück
                    früh sichern.
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </div>

        {/* Scroll-Hinweis */}
        <Reveal delay={0.7}>
          <div className="mt-12 hidden items-center gap-2 text-xs uppercase tracking-[0.2em] text-paper/50 md:flex">
            <ArrowDown className="h-4 w-4 animate-bounce" />
            Mehr entdecken
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function AvailRow({
  dot,
  label,
  value,
  strong = false,
}: {
  dot: string;
  label: string;
  value: number;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="flex items-center gap-2.5 text-sm text-paper/80">
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: dot }}
        />
        {label}
      </span>
      <span
        className={
          strong
            ? "font-[family-name:var(--font-display)] text-2xl font-bold text-paper"
            : "font-[family-name:var(--font-display)] text-xl text-paper/80"
        }
      >
        {value}
      </span>
    </div>
  );
}
