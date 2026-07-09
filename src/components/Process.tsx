import Reveal from "./ui/Reveal";
import SectionHeading from "./ui/SectionHeading";
import { PROCESS } from "@/config/site";

export default function Process() {
  return (
    <section id="ablauf" className="bg-paper-2 py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <SectionHeading
          eyebrow="So läuft es ab"
          title="In vier Schritten zum eigenen Standort."
          intro="Kein Behördendschungel, keine langen Wege. Von der ersten Anfrage bis zum Baubeginn begleitet Sie die WFL persönlich."
        />

        <div className="relative mt-16 grid gap-10 md:grid-cols-4 md:gap-6">
          {/* Verbindungslinie (Desktop) */}
          <span className="absolute left-0 right-0 top-6 hidden h-px bg-gradient-to-r from-transparent via-gold/50 to-transparent md:block" />

          {PROCESS.map((step, i) => (
            <Reveal key={step.step} delay={i * 0.1}>
              <div className="relative">
                <span className="relative z-10 grid h-12 w-12 place-items-center rounded-full border border-gold bg-paper numeral text-lg font-bold text-wine">
                  {step.step}
                </span>
                <h3 className="mt-5 text-xl font-bold text-ink">{step.title}</h3>
                <p className="mt-2.5 leading-relaxed text-ink/70">{step.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
