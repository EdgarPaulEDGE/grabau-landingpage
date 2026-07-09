"use client";

import { useEffect, useState } from "react";
import { Phone, ArrowRight } from "lucide-react";
import { CONTACT } from "@/config/site";
import { cn } from "@/lib/utils";

/** Feste CTA-Leiste am unteren Rand, nur mobil und erst nach dem Hero. */
export default function MobileCta() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 700);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-hair bg-paper/95 p-3 backdrop-blur-md transition-transform duration-300 lg:hidden",
        show ? "translate-y-0" : "translate-y-full",
      )}
    >
      <div className="flex items-center gap-3">
        <a
          href={CONTACT.phoneHref}
          className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-hair-strong text-wine"
          aria-label="Anrufen"
        >
          <Phone className="h-5 w-5" />
        </a>
        <a
          href="#kontakt"
          className="flex flex-1 items-center justify-center gap-2 rounded-full bg-wine px-6 py-3.5 text-base font-semibold text-paper"
        >
          Exposé anfordern
          <ArrowRight className="h-5 w-5" />
        </a>
      </div>
    </div>
  );
}
