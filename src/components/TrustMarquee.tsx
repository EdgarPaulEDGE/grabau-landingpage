import { NETWORK } from "@/config/site";

/** Schmale Vertrauensleiste: WFL-Netzwerk als endloses Laufband. */
export default function TrustMarquee() {
  const items = [...NETWORK, ...NETWORK];
  return (
    <div className="border-y border-hair bg-paper py-5">
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-5 md:px-8">
        <span className="eyebrow shrink-0 text-muted">
          Standort mit Rückhalt
        </span>
        <div className="relative flex-1 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
          <div className="marquee-track flex w-max items-center gap-10">
            {items.map((name, i) => (
              <span
                key={i}
                className="flex items-center gap-10 whitespace-nowrap text-sm font-semibold text-ink/45"
              >
                {name}
                <span className="h-1 w-1 rounded-full bg-gold/60" />
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
