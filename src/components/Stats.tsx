import Reveal from "./ui/Reveal";
import AnimatedNumber from "./ui/AnimatedNumber";
import { STATS } from "@/config/site";

/** Einheit und „ab“ neben der Zahl, halb so groß */
const ZUSATZ =
  "text-[clamp(1.25rem,5vw,1.5rem)] font-normal text-ink/60 md:text-3xl lg:text-2xl xl:text-3xl";

/** Kennzahlen-Band: vier harte Zahlen, die sofort überzeugen. */
export default function Stats() {
  return (
    <section className="bg-paper py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <div className="grid grid-cols-2 gap-y-10 lg:grid-cols-4">
          {STATS.map((s, i) => (
            <Reveal key={s.label} delay={i * 0.08}>
              <div className="relative px-2 lg:px-5 xl:px-8">
                {i !== 0 && (
                  <span className="absolute left-0 top-1/2 hidden h-16 w-px -translate-y-1/2 bg-gradient-to-b from-transparent via-gold/60 to-transparent lg:block" />
                )}
                {/* Größen gemessen: „70.380 m²“ passt so bei 360, 390, 1024
                    und 1280 px in eine Zeile. Schmale Handys skalieren mit vw. */}
                <div className="numeral whitespace-nowrap text-[clamp(2.25rem,10vw,3rem)] font-bold leading-none text-wine md:text-6xl lg:text-5xl xl:text-6xl">
                  {s.prefix && (
                    <span className={ZUSATZ}>
                      {s.prefix}
                    </span>
                  )}
                  <AnimatedNumber value={s.value} decimals={s.decimals ?? 0} />
                  {s.suffix && (
                    <span className={ZUSATZ}>
                      {s.suffix}
                    </span>
                  )}
                </div>
                <p className="mt-3 text-base font-semibold text-ink">{s.label}</p>
                {s.sub && (
                  <p className="mt-1 text-sm leading-snug text-muted">{s.sub}</p>
                )}
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
