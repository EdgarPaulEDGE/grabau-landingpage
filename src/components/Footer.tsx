import Image from "next/image";
import { CONTACT } from "@/config/site";

const LEGAL = [
  { href: "https://wfl.de/de/impressum", label: "Impressum" },
  { href: "https://wfl.de/de/datenschutz", label: "Datenschutz" },
  { href: "https://wfl.de/de/gewerbegebiet_grabau", label: "wfl.de" },
];

export default function Footer() {
  return (
    <footer className="bg-night pb-10 pt-16 text-paper">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <div className="grid gap-10 border-b border-white/10 pb-10 md:grid-cols-3">
          {/* Marke */}
          <div>
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-paper">
                <Image
                  src="/logos/wfl-logo.png"
                  alt="WFL"
                  width={876}
                  height={876}
                  className="h-9 w-9 object-contain"
                />
              </span>
              <span className="font-[family-name:var(--font-display)] text-lg font-bold leading-tight text-paper">
                Wirtschaftsförderung
                <br />
                Herzogtum Lauenburg
              </span>
            </div>
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-paper/60">
              Gewerbepark Grabauer Ruhm. Ein Standortangebot der
              Wirtschaftsförderung Herzogtum Lauenburg gemeinsam mit der Gemeinde
              Grabau.
            </p>
          </div>

          {/* Kontakt */}
          <div>
            <p className="eyebrow text-gold">Kontakt</p>
            <div className="mt-4 space-y-2 text-sm text-paper/75">
              <p className="font-semibold text-paper">{CONTACT.name}</p>
              <p>{CONTACT.org}</p>
              <p>{CONTACT.address}</p>
              <p>
                <a href={CONTACT.phoneHref} className="hover:text-gold">
                  {CONTACT.phone}
                </a>
              </p>
              <p>
                <a href={`mailto:${CONTACT.email}`} className="hover:text-gold">
                  {CONTACT.email}
                </a>
              </p>
            </div>
          </div>

          {/* Rechtliches */}
          <div>
            <p className="eyebrow text-gold">Rechtliches</p>
            <ul className="mt-4 space-y-2 text-sm">
              {LEGAL.map((l) => (
                <li key={l.label}>
                  <a
                    href={l.href}
                    target="_blank"
                    rel="noopener"
                    className="text-paper/75 transition-colors hover:text-gold"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-3 pt-6 text-xs text-paper/45 sm:flex-row">
          <p>© {new Date().getFullYear()} Wirtschaftsförderung Herzogtum Lauenburg</p>
          <p>Angaben ohne Gewähr · Stand Mai 2026</p>
        </div>
      </div>
    </footer>
  );
}
