import {
  Factory,
  CircuitBoard,
  Car,
  Armchair,
  HardHat,
  Wrench,
  Boxes,
  PackageOpen,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import Reveal from "./ui/Reveal";
import SectionHeading from "./ui/SectionHeading";
import { INDUSTRIES } from "@/config/site";

const ICONS: Record<string, LucideIcon> = {
  Factory,
  CircuitBoard,
  Car,
  Armchair,
  HardHat,
  Wrench,
  Boxes,
  PackageOpen,
};

export default function Industries() {
  return (
    <section id="branchen" className="bg-paper py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <SectionHeading
          eyebrow="Für wen Grabau gemacht ist"
          title="Passt Ihr Betrieb in den Bebauungsplan?"
          intro="Grabau ist ein Gewerbegebiet (GE) nach Bebauungsplan Nr. 4. Diese Branchen sind hier ausdrücklich willkommen."
        />

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {INDUSTRIES.map((ind, i) => {
            const Icon = ICONS[ind.icon] ?? Factory;
            return (
              <Reveal key={ind.title} delay={(i % 4) * 0.06}>
                <div className="group h-full rounded-2xl border border-hair-strong bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:border-gold hover:shadow-[0_24px_60px_-30px_rgba(36,26,27,0.35)]">
                  <span className="grid h-12 w-12 place-items-center rounded-xl bg-paper-2 text-wine transition-colors group-hover:bg-wine group-hover:text-paper">
                    <Icon className="h-6 w-6" />
                  </span>
                  <div className="mt-5 flex items-center gap-2">
                    <h3 className="text-lg font-bold text-ink">{ind.title}</h3>
                  </div>
                  <span className="eyebrow mt-1 block text-gold-deep">{ind.wz}</span>
                  <p className="mt-3 text-sm leading-relaxed text-muted">{ind.desc}</p>
                </div>
              </Reveal>
            );
          })}
        </div>

        <Reveal delay={0.2}>
          <div className="mt-10 flex flex-col items-start gap-4 rounded-2xl bg-paper-2 px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-ink/80">
              Nicht sicher, ob Ihr Betrieb passt? Wir prüfen die
              B-Plan-Konformität für Sie, kostenlos und unverbindlich.
            </p>
            <a
              href="#kontakt"
              className="group inline-flex shrink-0 items-center gap-2 font-semibold text-wine"
            >
              Jetzt prüfen lassen
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
