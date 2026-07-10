"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { ArrowRight, Maximize2, Check, Box, Map } from "lucide-react";
import { PLOTS, PLOT_STATUS_META, type Plot, type PlotStatus } from "@/config/site";
import Reveal from "./ui/Reveal";
import { cn } from "@/lib/utils";

// 3D-Ansicht nur im Browser laden (WebGL, kein SSR)
const SitePlan3D = dynamic(() => import("./SitePlan3D"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center text-sm text-paper/40">
      3D-Ansicht wird geladen …
    </div>
  ),
});

type Filter = "alle" | PlotStatus;

const FILTERS: { key: Filter; label: string }[] = [
  { key: "alle", label: "Alle" },
  { key: "verfuegbar", label: "Verfügbar" },
  { key: "reserviert", label: "Reserviert" },
  { key: "verkauft", label: "Verkauft" },
];

function fmtSize(size: number | null): string {
  return size ? `${size.toLocaleString("de-DE")} m²` : "—";
}

/** Löst das Vorbefüllen des Kontaktformulars aus und scrollt dorthin. */
function requestPlot(plot: Plot) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("grabau:selectPlot", { detail: plot.label }),
  );
  document.getElementById("kontakt")?.scrollIntoView({ behavior: "smooth" });
}

export default function SitePlan() {
  const [filter, setFilter] = useState<Filter>("alle");
  const [selected, setSelected] = useState<string | null>("9");
  const [hovered, setHovered] = useState<string | null>(null);
  const [view, setView] = useState<"3d" | "2d">("3d");

  const active = hovered ?? selected;
  const selectedPlot = useMemo(
    () => PLOTS.find((p) => p.id === selected) ?? null,
    [selected],
  );

  // Sortierung der Liste: verfügbar (größte zuerst) → reserviert → verkauft
  const sortedPlots = useMemo(() => {
    const order: Record<PlotStatus, number> = {
      verfuegbar: 0,
      reserviert: 1,
      verkauft: 2,
    };
    return [...PLOTS].sort((a, b) => {
      if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
      return (b.size ?? 0) - (a.size ?? 0);
    });
  }, []);

  const matches = (p: Plot) => filter === "alle" || p.status === filter;

  return (
    <section id="standortplan" className="bg-paper py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <Reveal>
              <div className="flex items-center gap-3">
                <span className="h-px w-8 bg-gold" />
                <span className="eyebrow text-wine">Interaktiver Standortplan</span>
              </div>
            </Reveal>
            <Reveal delay={0.08}>
              <h2 className="mt-5 text-balance text-4xl leading-[1.06] text-ink sm:text-5xl">
                Wählen Sie Ihr Grundstück.
              </h2>
            </Reveal>
            <Reveal delay={0.16}>
              <p className="mt-5 text-lg leading-relaxed text-muted">
                Klicken Sie eine Parzelle an. Sie sehen Größe und Verfügbarkeit
                sofort und können das passende Grundstück direkt anfragen.
              </p>
            </Reveal>
          </div>

          {/* Filter */}
          <Reveal delay={0.2}>
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={cn(
                    "rounded-full border px-4 py-2 text-sm font-semibold transition-all",
                    filter === f.key
                      ? "border-wine bg-wine text-paper"
                      : "border-hair-strong bg-paper text-ink/70 hover:border-wine hover:text-wine",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </Reveal>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-12">
          {/* Kartenbereich */}
          <Reveal className="lg:col-span-8" delay={0.1}>
            <div
              className={cn(
                "relative overflow-hidden rounded-2xl border shadow-[0_30px_80px_-40px_rgba(36,26,27,0.4)]",
                view === "3d"
                  ? "border-white/10 bg-night"
                  : "border-hair-strong bg-white",
              )}
            >
              {/* Umschalter 3D / 2D */}
              <div className="absolute right-3 top-3 z-30 flex overflow-hidden rounded-full border border-white/20 bg-night/70 backdrop-blur-md">
                <button
                  onClick={() => setView("3d")}
                  className={cn(
                    "flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold transition-colors",
                    view === "3d" ? "bg-gold text-night" : "text-paper/70 hover:text-paper",
                  )}
                  aria-pressed={view === "3d"}
                >
                  <Box className="h-3.5 w-3.5" />
                  3D
                </button>
                <button
                  onClick={() => setView("2d")}
                  className={cn(
                    "flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold transition-colors",
                    view === "2d" ? "bg-gold text-night" : "text-paper/70 hover:text-paper",
                  )}
                  aria-pressed={view === "2d"}
                >
                  <Map className="h-3.5 w-3.5" />
                  2D
                </button>
              </div>

              {view === "3d" ? (
                <div
                  className="relative h-[440px] md:h-[560px]"
                  style={{
                    background:
                      "radial-gradient(120% 90% at 50% 32%, #241820 0%, #191114 55%, #120D0F 100%)",
                  }}
                >
                  <SitePlan3D
                    plots={PLOTS}
                    selectedId={selected}
                    hoveredId={hovered}
                    filter={filter}
                    onSelect={setSelected}
                    onHover={setHovered}
                    onRequest={(id) => {
                      const plot = PLOTS.find((p) => p.id === id);
                      if (plot) requestPlot(plot);
                    }}
                  />
                </div>
              ) : (
              <div className="relative aspect-[3402/1535]">
                <Image
                  src="/img/standortplan.webp"
                  alt="Standortplan Gewerbepark Grabauer Ruhm mit allen Grundstücken"
                  fill
                  sizes="(max-width: 1024px) 100vw, 66vw"
                  className="object-cover"
                />

                {/* Interaktive Pins */}
                {PLOTS.map((plot) => {
                  const meta = PLOT_STATUS_META[plot.status];
                  const isActive = active === plot.id;
                  const dim = !matches(plot);
                  return (
                    <button
                      key={plot.id}
                      onClick={() => setSelected(plot.id)}
                      onMouseEnter={() => setHovered(plot.id)}
                      onMouseLeave={() => setHovered(null)}
                      style={{ left: `${plot.x}%`, top: `${plot.y}%` }}
                      className={cn(
                        "absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-200",
                        dim ? "opacity-25" : "opacity-100",
                        isActive ? "z-30" : "z-10",
                      )}
                      aria-label={`Grundstück ${plot.label}, ${meta.label}, ${fmtSize(plot.size)}`}
                    >
                      <span
                        className={cn(
                          "grid place-items-center rounded-full border-2 border-white font-bold text-white shadow-md transition-all",
                          isActive ? "h-9 w-9 scale-110 text-sm" : "h-7 w-7 text-xs",
                        )}
                        style={{ backgroundColor: meta.dot }}
                      >
                        {plot.id}
                      </span>
                      {/* Tooltip */}
                      {isActive && (
                        <span className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-paper shadow-lg">
                          {plot.label} · {fmtSize(plot.size)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              )}

              {/* Legende */}
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-hair bg-paper px-5 py-3.5">
                {(["verfuegbar", "reserviert", "verkauft"] as PlotStatus[]).map((s) => (
                  <span key={s} className="flex items-center gap-2 text-sm text-ink/70">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: PLOT_STATUS_META[s].dot }}
                    />
                    {PLOT_STATUS_META[s].label}
                  </span>
                ))}
                <span className="ml-auto hidden items-center gap-1.5 text-xs text-muted sm:flex">
                  <Maximize2 className="h-3.5 w-3.5" />
                  {view === "3d"
                    ? "Ziehen dreht · Scrollen oder Pinch zoomt · Klick wählt"
                    : "Kartenausschnitt: Bundesstraße B207"}
                </span>
              </div>
            </div>
          </Reveal>

          {/* Detail + Liste */}
          <div className="lg:col-span-4">
            <Reveal delay={0.18}>
              {/* Detailkarte */}
              <div className="rounded-2xl border border-hair-strong bg-white p-6">
                {selectedPlot ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="numeral text-5xl font-bold text-ink">
                        {selectedPlot.label.replace("Nr. ", "")}
                      </span>
                      <StatusBadge status={selectedPlot.status} />
                    </div>
                    <div className="mt-5 space-y-3 border-t border-hair pt-5 text-sm">
                      <Row label="Grundstück" value={selectedPlot.label} />
                      <Row label="Fläche" value={fmtSize(selectedPlot.size)} />
                      <Row label="Nutzung" value="Gewerbegebiet (GE)" />
                      <Row label="GRZ" value="0,8" />
                    </div>
                    {selectedPlot.status === "verkauft" ? (
                      <p className="mt-5 rounded-xl bg-paper-2 px-4 py-3 text-sm text-muted">
                        Dieses Grundstück ist bereits vergeben. Gern zeigen wir
                        Ihnen vergleichbare freie Flächen.
                      </p>
                    ) : (
                      <button
                        onClick={() => requestPlot(selectedPlot)}
                        className="group mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-wine px-6 py-3.5 text-sm font-semibold text-paper transition-all hover:-translate-y-0.5 hover:bg-wine-dark"
                      >
                        {selectedPlot.label} anfragen
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </button>
                    )}
                  </>
                ) : (
                  <p className="py-8 text-center text-muted">
                    Grundstück auf der Karte auswählen.
                  </p>
                )}
              </div>
            </Reveal>

            {/* Liste */}
            <Reveal delay={0.24}>
              <div className="mt-4 max-h-[320px] overflow-y-auto rounded-2xl border border-hair-strong bg-white">
                <ul className="divide-y divide-hair">
                  {sortedPlots.map((plot) => {
                    const meta = PLOT_STATUS_META[plot.status];
                    const on = matches(plot);
                    return (
                      <li key={plot.id}>
                        <button
                          onClick={() => setSelected(plot.id)}
                          onMouseEnter={() => setHovered(plot.id)}
                          onMouseLeave={() => setHovered(null)}
                          className={cn(
                            "flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors",
                            selected === plot.id ? "bg-paper-2" : "hover:bg-paper-2/60",
                            !on && "opacity-40",
                          )}
                        >
                          <span className="flex items-center gap-3">
                            <span
                              className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold text-white"
                              style={{ backgroundColor: meta.dot }}
                            >
                              {plot.id}
                            </span>
                            <span className="text-sm font-medium text-ink">
                              {plot.label}
                            </span>
                          </span>
                          <span className="flex items-center gap-3">
                            <span className="numeral text-sm font-semibold text-ink/80">
                              {fmtSize(plot.size)}
                            </span>
                            <span className={cn("text-xs font-semibold", meta.color)}>
                              {meta.label}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted">{label}</span>
      <span className="font-semibold text-ink">{value}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: PlotStatus }) {
  const meta = PLOT_STATUS_META[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
      style={{ backgroundColor: `${meta.dot}1a`, color: meta.dot }}
    >
      {status === "verfuegbar" && <Check className="h-3.5 w-3.5" />}
      {meta.label}
    </span>
  );
}
