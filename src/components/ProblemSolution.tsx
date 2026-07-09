import Image from "next/image";
import Reveal from "./ui/Reveal";
import { SOLUTION_POINTS } from "@/config/site";

export default function ProblemSolution() {
  return (
    <section className="bg-paper-2 py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
          {/* Linke Spalte: Aussage + Bild */}
          <div className="lg:col-span-5">
            <Reveal>
              <div className="flex items-center gap-3">
                <span className="h-px w-8 bg-gold" />
                <span className="eyebrow text-wine">Warum Grabau</span>
              </div>
            </Reveal>
            <Reveal delay={0.08}>
              <h2 className="mt-5 text-balance text-4xl leading-[1.06] text-ink sm:text-5xl">
                Hamburg wird enger.
                <br />
                Und teurer.
              </h2>
            </Reveal>
            <Reveal delay={0.16}>
              <p className="mt-6 text-lg leading-relaxed text-ink/70">
                Wer in der Metropolregion produziert, kennt das: Freie
                Gewerbeflächen sind rar, die Preise steigen, und die Halle platzt
                aus allen Nähten. Grabau gibt Ihnen den Raum zurück, den Hamburg
                nicht mehr hergibt. Nah genug für Hafen, Flughafen und
                Fachkräfte, weit genug für bezahlbare Flächen und echte Reserve.
              </p>
            </Reveal>
            <Reveal delay={0.24}>
              <div className="mt-10 overflow-hidden rounded-2xl ring-1 ring-hair-strong">
                <div className="relative aspect-[4/3]">
                  <Image
                    src="/img/grabau-roundabout.jpg"
                    alt="Fertig erschlossener Kreisverkehr im Gewerbepark Grabau bei sonnigem Wetter"
                    fill
                    sizes="(max-width: 1024px) 100vw, 40vw"
                    className="object-cover"
                  />
                </div>
              </div>
            </Reveal>
          </div>

          {/* Rechte Spalte: 4 Lösungspunkte */}
          <div className="lg:col-span-7">
            <div className="lg:pl-8">
              {SOLUTION_POINTS.map((point, i) => (
                <Reveal key={point.title} delay={i * 0.1}>
                  <div className="flex gap-6 border-b border-hair-strong py-7 first:pt-0 last:border-0">
                    <span className="numeral shrink-0 text-3xl font-bold text-gold-deep">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <h3 className="text-xl font-bold text-ink md:text-2xl">
                        {point.title}
                      </h3>
                      <p className="mt-2.5 leading-relaxed text-ink/70">
                        {point.body}
                      </p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
