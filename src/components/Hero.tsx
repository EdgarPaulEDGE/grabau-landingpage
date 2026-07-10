import Image from "next/image";
import { Check, ArrowRight, MapPin } from "lucide-react";
import Reveal from "./ui/Reveal";
import HeroAerialCanvas from "./HeroAerialCanvas";
import { HERO_PROOF, PLOTS, PLOT_STATUS_META } from "@/config/site";

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

      {/* Overlays für Lesbarkeit: nur dort abdunkeln, wo Text steht.
          Das Luftbild muss tragen, keine dunkle Wand. */}
      <div className="absolute inset-0 z-[2] bg-gradient-to-t from-night via-night/25 to-transparent" />
      <div className="absolute inset-0 z-[2] bg-gradient-to-r from-night/70 via-night/15 to-transparent" />
      <div
        className="absolute inset-0 z-[2] opacity-25 mix-blend-multiply"
        style={{
          background:
            "radial-gradient(120% 80% at 15% 90%, rgba(110,19,25,0.6), transparent 60%)",
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
              <h1 className="mt-6 max-w-4xl text-balance font-[family-name:var(--font-display)] text-[2.85rem] font-bold leading-[0.98] tracking-tight text-paper drop-shadow-[0_2px_24px_rgba(0,0,0,0.55)] sm:text-6xl md:text-[5.1rem]">
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

          {/* Verfügbarkeit: eine große Zahl, ein Belegungsbalken, klickbar zum Plan */}
          <div className="lg:col-span-4">
            <Reveal delay={0.5}>
              <a
                href="#standortplan"
                className="group block rounded-2xl border border-white/10 bg-night/40 p-6 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-gold/50"
              >
                <p className="eyebrow text-paper/55">Aktuelle Verfügbarkeit</p>
                <div className="mt-3 flex items-end gap-3">
                  <span className="numeral text-6xl font-bold leading-none text-gold md:text-7xl">
                    {avail}
                  </span>
                  <span className="pb-1 text-lg leading-tight text-paper/90">
                    von {PLOTS.length} Grundstücken
                    <br />
                    noch frei
                  </span>
                </div>
                {/* Belegungsbalken: jedes Segment ist eine echte Parzelle */}
                <div className="mt-6 flex gap-1">
                  {PLOTS.map((p) => (
                    <span
                      key={p.id}
                      title={`${p.label}: ${PLOT_STATUS_META[p.status].label}`}
                      className="h-1.5 flex-1 rounded-full"
                      style={{
                        backgroundColor: PLOT_STATUS_META[p.status].dot,
                        opacity: p.status === "verfuegbar" ? 1 : 0.35,
                      }}
                    />
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between text-sm">
                  <span className="text-paper/60">
                    {reserved} reserviert · {sold} verkauft
                  </span>
                  <span className="inline-flex items-center gap-1.5 font-semibold text-gold transition-transform group-hover:translate-x-1">
                    Zum Standortplan
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </div>
              </a>
            </Reveal>
          </div>
        </div>

      </div>
    </section>
  );
}

