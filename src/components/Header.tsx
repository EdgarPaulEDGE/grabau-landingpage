"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Menu, X, ArrowUpRight } from "lucide-react";
import { NAV } from "@/config/site";
import { cn } from "@/lib/utils";

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Solide Darstellung, sobald gescrollt ODER Mobile-Menü offen
  const solid = scrolled || open;

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-500",
        solid
          ? "border-b border-hair bg-paper/90 backdrop-blur-md shadow-[0_8px_30px_-20px_rgba(36,26,27,0.5)]"
          : "border-b border-transparent bg-transparent",
      )}
    >
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 md:px-8">
        {/* Marke */}
        <a href="#top" className="flex items-center gap-3" aria-label="Startseite">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-paper shadow-sm ring-1 ring-hair">
            <Image
              src="/logos/wfl-logo.png"
              alt="WFL Wirtschaftsförderung Herzogtum Lauenburg"
              width={876}
              height={876}
              className="h-8 w-8 object-contain"
              priority
            />
          </span>
          <span className="leading-tight">
            <span
              className={cn(
                "block font-[family-name:var(--font-rounded)] text-[0.62rem] font-bold uppercase tracking-[0.2em] transition-colors",
                solid ? "text-wine" : "text-gold",
              )}
            >
              Gewerbepark
            </span>
            <span
              className={cn(
                "block font-[family-name:var(--font-display)] text-[1.05rem] font-bold leading-none transition-colors",
                solid ? "text-ink" : "text-paper",
              )}
            >
              Grabauer Ruhm
            </span>
          </span>
        </a>

        {/* Navigation Desktop */}
        <nav className="hidden items-center gap-8 lg:flex">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={cn(
                "relative text-sm font-medium transition-colors after:absolute after:-bottom-1.5 after:left-0 after:h-px after:w-0 after:bg-gold after:transition-all hover:after:w-full",
                solid ? "text-ink/80 hover:text-wine" : "text-paper/85 hover:text-paper",
              )}
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* CTA + Burger */}
        <div className="flex items-center gap-2">
          <a
            href="#kontakt"
            className="hidden items-center gap-2 rounded-full bg-wine px-5 py-2.5 text-sm font-semibold text-paper shadow-[0_10px_30px_-14px_rgba(151,27,34,0.9)] transition-all hover:-translate-y-0.5 hover:bg-wine-dark sm:inline-flex"
          >
            Exposé anfordern
            <ArrowUpRight className="h-4 w-4" />
          </a>
          <button
            onClick={() => setOpen((v) => !v)}
            className={cn(
              "grid h-11 w-11 place-items-center rounded-xl transition-colors lg:hidden",
              solid ? "text-ink hover:bg-paper-2" : "text-paper hover:bg-white/10",
            )}
            aria-label={open ? "Menü schließen" : "Menü öffnen"}
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile-Menü */}
      <div
        className={cn(
          "overflow-hidden border-t border-hair bg-paper transition-[max-height] duration-500 lg:hidden",
          open ? "max-h-96" : "max-h-0",
        )}
      >
        <nav className="flex flex-col gap-1 px-5 py-4">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-3 text-base font-medium text-ink/85 transition-colors hover:bg-paper-2 hover:text-wine"
            >
              {item.label}
            </a>
          ))}
          <a
            href="#kontakt"
            onClick={() => setOpen(false)}
            className="mt-2 inline-flex items-center justify-center gap-2 rounded-full bg-wine px-5 py-3.5 text-sm font-semibold text-paper"
          >
            Exposé anfordern
            <ArrowUpRight className="h-4 w-4" />
          </a>
        </nav>
      </div>
    </header>
  );
}
