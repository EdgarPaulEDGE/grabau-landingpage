import Image from "next/image";
import { Navigation, Train, Plane, Anchor, Ship } from "lucide-react";
import Reveal from "./ui/Reveal";
import CorridorField from "./CorridorField";
import { DISTANCES } from "@/config/site";

export default function Location() {
  return (
    <section id="lage" className="relative overflow-hidden bg-night py-20 text-paper md:py-28">
      {/* Gefadetes Foto der fertigen Erschließung als Atmosphäre */}
      <div className="absolute inset-0">
        <Image
          src="/img/grabau-road.jpg"
          alt=""
          fill
          sizes="100vw"
          className="object-cover opacity-20"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-night via-night/85 to-night" />
      </div>

      {/* WebGL-Korridor: strömende goldene Achse (Fehmarnbelt-Motiv) */}
      <CorridorField className="z-[1]" />

      <div className="relative z-10 mx-auto max-w-7xl px-5 md:px-8">
        <div className="grid gap-14 lg:grid-cols-2 lg:gap-20">
          {/* Links: Botschaft */}
          <div>
            <Reveal>
              <div className="flex items-center gap-3">
                <span className="h-px w-8 bg-gold" />
                <span className="eyebrow text-gold">Lage &amp; Anbindung</span>
              </div>
            </Reveal>
            <Reveal delay={0.08}>
              <h2 className="mt-5 text-balance text-4xl leading-[1.06] text-paper sm:text-5xl">
                Mitten im
                <br />
                Hansebelt-Korridor.
              </h2>
            </Reveal>
            <Reveal delay={0.16}>
              <p className="mt-6 max-w-lg text-lg leading-relaxed text-paper/75">
                Grabau liegt direkt an der B207, nur sieben Kilometer von der A24
                Hamburg–Berlin entfernt. Von hier erreichen Sie den Hamburger
                Hafen, den Flughafen und die Fachkräfte der Metropolregion in
                kurzer Zeit.
              </p>
            </Reveal>

            <Reveal delay={0.24}>
              <div className="mt-10 rounded-2xl border border-gold/30 bg-white/5 p-6 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <Navigation className="h-5 w-5 text-gold" />
                  <span className="eyebrow text-gold">Zukunftsachse</span>
                </div>
                <p className="mt-4 leading-relaxed text-paper/85">
                  Mit dem <strong className="text-paper">Fehmarnbelttunnel</strong>{" "}
                  (Eröffnung um 2031) wird die Region zur zentralen
                  Landverbindung zwischen Skandinavien und Kontinentaleuropa. Wer
                  heute hier investiert, sitzt morgen an einer der wichtigsten
                  Nord-Süd-Achsen Europas.
                </p>
              </div>
            </Reveal>
          </div>

          {/* Rechts: Entfernungen */}
          <div>
            <Reveal delay={0.1}>
              <ul className="divide-y divide-white/10">
                {DISTANCES.map((d, i) => (
                  <li
                    key={d.place}
                    className="flex items-center justify-between gap-4 py-4"
                  >
                    <div className="flex items-center gap-4">
                      <DistanceIcon index={i} />
                      <div>
                        <p className="font-semibold text-paper">{d.place}</p>
                        <p className="text-sm text-paper/55">{d.detail}</p>
                      </div>
                    </div>
                    <span className="numeral whitespace-nowrap text-2xl font-bold text-gold">
                      {d.value}
                    </span>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Passendes Icon je Entfernungstyp (dezent rotierend nach Reihenfolge). */
function DistanceIcon({ index }: { index: number }) {
  const icons = [Navigation, Navigation, Train, Navigation, Plane, Anchor, Ship, Train];
  const Icon = icons[index] ?? Navigation;
  return (
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/15 bg-white/5">
      <Icon className="h-5 w-5 text-paper/80" />
    </span>
  );
}
