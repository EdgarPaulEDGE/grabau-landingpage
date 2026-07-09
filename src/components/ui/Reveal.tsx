import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Blendet Inhalte beim Laden sanft ein (reine CSS-Animation, siehe .reveal in
 * globals.css). Zeitbasiert und robust: Der Endzustand ist immer sichtbar,
 * auch ohne JavaScript. Das gestaffelte `delay` erzeugt einen ruhigen
 * Kaskaden-Effekt.
 *
 * Kein "use client" nötig: reines CSS.
 */
export default function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("reveal", className)}
      style={delay ? { animationDelay: `${delay}s` } : undefined}
    >
      {children}
    </div>
  );
}
