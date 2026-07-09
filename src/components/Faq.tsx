"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import Reveal from "./ui/Reveal";
import { FAQS } from "@/config/site";
import { cn } from "@/lib/utils";

export default function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="bg-paper py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
          {/* Überschrift */}
          <div className="lg:col-span-4">
            <Reveal>
              <div className="flex items-center gap-3">
                <span className="h-px w-8 bg-gold" />
                <span className="eyebrow text-wine">Häufige Fragen</span>
              </div>
            </Reveal>
            <Reveal delay={0.08}>
              <h2 className="mt-5 text-balance text-4xl leading-[1.06] text-ink sm:text-5xl">
                Was Entscheider vorher wissen wollen.
              </h2>
            </Reveal>
            <Reveal delay={0.16}>
              <p className="mt-6 leading-relaxed text-muted">
                Ihre Frage ist nicht dabei? Rufen Sie einfach an. Nina Warncke
                nimmt sich Zeit.
              </p>
            </Reveal>
          </div>

          {/* Akkordeon */}
          <div className="lg:col-span-8">
            <ul className="divide-y divide-hair-strong border-t border-hair-strong">
              {FAQS.map((item, i) => {
                const isOpen = open === i;
                return (
                  <li key={item.q}>
                    <button
                      onClick={() => setOpen(isOpen ? null : i)}
                      className="flex w-full items-center justify-between gap-6 py-6 text-left"
                      aria-expanded={isOpen}
                    >
                      <span
                        className={cn(
                          "text-lg font-semibold transition-colors md:text-xl",
                          isOpen ? "text-wine" : "text-ink",
                        )}
                      >
                        {item.q}
                      </span>
                      <span
                        className={cn(
                          "grid h-9 w-9 shrink-0 place-items-center rounded-full border transition-all duration-300",
                          isOpen
                            ? "rotate-45 border-wine bg-wine text-paper"
                            : "border-hair-strong text-ink",
                        )}
                      >
                        <Plus className="h-4 w-4" />
                      </span>
                    </button>
                    <div
                      className={cn(
                        "grid overflow-hidden transition-all duration-300",
                        isOpen ? "grid-rows-[1fr] pb-6" : "grid-rows-[0fr]",
                      )}
                    >
                      <div className="overflow-hidden">
                        <p className="max-w-2xl pr-12 leading-relaxed text-ink/70">
                          {item.a}
                        </p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
