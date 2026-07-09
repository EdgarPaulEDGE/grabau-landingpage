import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import Reveal from "./Reveal";

/** Einheitlicher Abschnittskopf: Eyebrow + Bodoni-Titel + optionaler Intro-Text. */
export default function SectionHeading({
  eyebrow,
  title,
  intro,
  align = "left",
  light = false,
  className,
}: {
  eyebrow: string;
  title: ReactNode;
  intro?: ReactNode;
  align?: "left" | "center";
  light?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "max-w-2xl",
        align === "center" && "mx-auto text-center",
        className,
      )}
    >
      <Reveal>
        <div
          className={cn(
            "flex items-center gap-3",
            align === "center" && "justify-center",
          )}
        >
          <span className={cn("h-px w-8", light ? "bg-gold/70" : "bg-gold")} />
          <span className={cn("eyebrow", light ? "text-gold" : "text-wine")}>
            {eyebrow}
          </span>
        </div>
      </Reveal>
      <Reveal delay={0.08}>
        <h2
          className={cn(
            "mt-5 text-balance text-4xl leading-[1.05] sm:text-5xl md:text-[3.35rem]",
            light ? "text-paper" : "text-ink",
          )}
        >
          {title}
        </h2>
      </Reveal>
      {intro && (
        <Reveal delay={0.16}>
          <p
            className={cn(
              "mt-6 text-lg leading-relaxed",
              light ? "text-paper/70" : "text-muted",
            )}
          >
            {intro}
          </p>
        </Reveal>
      )}
    </div>
  );
}
