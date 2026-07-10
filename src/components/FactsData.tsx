import Image from "next/image";
import { FileDown, ArrowUpRight } from "lucide-react";
import Reveal from "./ui/Reveal";
import SectionHeading from "./ui/SectionHeading";
import { FACTS } from "@/config/site";

export default function FactsData() {
  return (
    <section id="flaechen" className="bg-paper-2 py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <SectionHeading
          eyebrow="Standortdaten"
          title="Alle harten Fakten auf einen Blick."
        />

        <div className="mt-14 grid gap-6 lg:grid-cols-12">
          {/* Fakten-Tabelle */}
          <Reveal className="lg:col-span-7" delay={0.1}>
            <div className="overflow-hidden rounded-2xl border border-hair-strong bg-white">
              <dl className="grid sm:grid-cols-2">
                {FACTS.map((f, i) => (
                  <div
                    key={f.label}
                    className={`flex items-center justify-between gap-4 px-5 py-4 ${
                      i % 2 === 0 ? "sm:border-r sm:border-hair" : ""
                    } border-b border-hair`}
                  >
                    <dt className="text-sm text-muted">{f.label}</dt>
                    <dd className="text-right text-sm font-semibold text-ink">
                      {f.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </Reveal>

          {/* Download-Karte */}
          <Reveal className="lg:col-span-5" delay={0.18}>
            <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-hair-strong bg-night text-paper">
              <div className="relative aspect-[16/10] w-full">
                <Image
                  src="/img/standortplan.webp"
                  alt="Bebauungsplan Grabauer Ruhm"
                  fill
                  sizes="(max-width: 1024px) 100vw, 40vw"
                  className="object-cover opacity-90"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-night to-transparent" />
              </div>
              <div className="flex flex-1 flex-col p-6">
                <span className="eyebrow text-gold">Zum Download</span>
                <h3 className="mt-2 text-2xl font-bold text-paper">
                  Bebauungsplan Nr. 4
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-paper/70">
                  Der vollständige B-Plan „Auf'n Ruhm" als PDF. Das komplette
                  Exposé mit m²-Preisen erhalten Sie persönlich auf Anfrage.
                </p>
                <div className="mt-6 flex flex-col gap-3">
                  <a
                    href="/expose/bplan-grabau-nr4.pdf"
                    target="_blank"
                    rel="noopener"
                    className="group inline-flex items-center justify-center gap-2 rounded-full bg-paper px-6 py-3.5 text-sm font-semibold text-ink transition-all hover:-translate-y-0.5 hover:bg-gold"
                  >
                    <FileDown className="h-4 w-4" />
                    B-Plan herunterladen
                  </a>
                  <a
                    href="#kontakt"
                    className="group inline-flex items-center justify-center gap-2 rounded-full border border-paper/30 px-6 py-3.5 text-sm font-semibold text-paper transition-all hover:bg-white/10"
                  >
                    Vollständiges Exposé anfordern
                    <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </a>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
