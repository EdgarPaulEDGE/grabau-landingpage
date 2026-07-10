"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Phone,
  Mail,
  MapPin,
  Check,
  Loader2,
  FileDown,
  ArrowRight,
  CalendarClock,
} from "lucide-react";
import { CONTACT } from "@/config/site";
import { cn } from "@/lib/utils";

const schema = z.object({
  name: z.string().min(2, "Bitte Ihren Namen angeben."),
  company: z.string().min(2, "Bitte Ihr Unternehmen angeben."),
  email: z
    .string()
    .min(1, "Bitte Ihre E-Mail angeben.")
    .refine((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Bitte eine gültige E-Mail angeben."),
  phone: z.string().optional(),
  plotSize: z.string().optional(),
  message: z.string().optional(),
  consent: z.boolean().refine((v) => v === true, "Bitte den Datenschutzhinweis bestätigen."),
});

type FormValues = z.infer<typeof schema>;

const PLOT_SIZES = [
  "Noch offen",
  "Unter 3.000 m²",
  "3.000 – 6.000 m²",
  "6.000 – 10.000 m²",
  "Über 10.000 m²",
];

export default function LeadForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { plotSize: "Noch offen", consent: false },
  });

  // Vorbefüllung, wenn im Standortplan ein Grundstück angefragt wird
  useEffect(() => {
    const handler = (e: Event) => {
      const label = (e as CustomEvent<string>).detail;
      setValue(
        "message",
        `Ich interessiere mich für Grundstück ${label} und bitte um das Exposé mit Preisangabe.`,
      );
    };
    window.addEventListener("grabau:selectPlot", handler);
    return () => window.removeEventListener("grabau:selectPlot", handler);
  }, [setValue]);

  async function onSubmit(values: FormValues) {
    setStatus("sending");
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error("Request failed");
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  function mailtoFallback() {
    const v = getValues();
    const subject = encodeURIComponent("Anfrage Gewerbepark Grabau");
    const body = encodeURIComponent(
      `Name: ${v.name}\nUnternehmen: ${v.company}\nE-Mail: ${v.email}\nTelefon: ${v.phone ?? ""}\nGewünschte Größe: ${v.plotSize ?? ""}\n\n${v.message ?? ""}`,
    );
    return `mailto:${CONTACT.email}?subject=${subject}&body=${body}`;
  }

  return (
    <section id="kontakt" className="bg-night py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-5 md:px-8">
        {/* Kopf */}
        <div className="mx-auto max-w-2xl text-center">
          <div className="flex items-center justify-center gap-3">
            <span className="h-px w-8 bg-gold" />
            <span className="eyebrow text-gold">Kontakt</span>
            <span className="h-px w-8 bg-gold" />
          </div>
          <h2 className="mt-5 text-balance text-4xl leading-[1.06] text-paper sm:text-5xl">
            Sichern Sie sich Ihr Grundstück.
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-paper/70">
            Fordern Sie das kostenlose Exposé an oder stellen Sie Ihre Frage.
            Wir melden uns schnellstmöglich.
          </p>
        </div>

        <div className="mt-14 grid overflow-hidden rounded-3xl border border-white/10 lg:grid-cols-2">
          {/* Ansprechpartnerin */}
          <div className="relative flex flex-col bg-night-2 p-8 md:p-10">
            <div className="overflow-hidden rounded-2xl">
              <div className="relative aspect-[4/3]">
                <Image
                  src={CONTACT.photo}
                  alt={CONTACT.name}
                  fill
                  sizes="(max-width: 1024px) 100vw, 40vw"
                  className="object-cover object-[center_25%]"
                />
              </div>
            </div>
            <div className="mt-6">
              <p className="font-[family-name:var(--font-display)] text-2xl font-bold text-paper">
                {CONTACT.name}
              </p>
              <p className="mt-1 text-sm text-gold">{CONTACT.role}</p>
            </div>
            <div className="mt-6 space-y-3">
              <a
                href={CONTACT.phoneHref}
                className="flex items-center gap-3 text-paper/85 transition-colors hover:text-gold"
              >
                <Phone className="h-5 w-5 text-gold" />
                {CONTACT.phone}
              </a>
              <a
                href={`mailto:${CONTACT.email}`}
                className="flex items-center gap-3 text-paper/85 transition-colors hover:text-gold"
              >
                <Mail className="h-5 w-5 text-gold" />
                {CONTACT.email}
              </a>
              <p className="flex items-center gap-3 text-paper/85">
                <MapPin className="h-5 w-5 text-gold" />
                {CONTACT.address}
              </p>
            </div>
            <div className="mt-8 flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-paper/70">
              <CalendarClock className="h-4 w-4 text-gold" />
              Wir melden uns schnellstmöglich
            </div>
            <div className="mt-auto flex items-center gap-3 pt-8">
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-paper ring-1 ring-white/10">
                <Image
                  src="/logos/wfl-logo.png"
                  alt="WFL"
                  width={876}
                  height={876}
                  className="h-9 w-9 object-contain"
                />
              </span>
              <span className="text-sm leading-tight text-paper/70">
                Wirtschaftsförderung
                <br />
                Herzogtum Lauenburg
              </span>
            </div>
          </div>

          {/* Formular / Erfolg */}
          <div className="bg-paper p-8 md:p-10">
            {status === "done" ? (
              <SuccessPanel />
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Name" error={errors.name?.message}>
                    <input
                      {...register("name")}
                      className={inputCls(!!errors.name)}
                      placeholder="Max Mustermann"
                    />
                  </Field>
                  <Field label="Unternehmen" error={errors.company?.message}>
                    <input
                      {...register("company")}
                      className={inputCls(!!errors.company)}
                      placeholder="Muster GmbH"
                    />
                  </Field>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="E-Mail" error={errors.email?.message}>
                    <input
                      {...register("email")}
                      type="email"
                      className={inputCls(!!errors.email)}
                      placeholder="name@firma.de"
                    />
                  </Field>
                  <Field label="Telefon (optional)">
                    <input
                      {...register("phone")}
                      className={inputCls(false)}
                      placeholder="0401234567"
                    />
                  </Field>
                </div>

                <Field label="Gewünschte Grundstücksgröße">
                  <select {...register("plotSize")} className={inputCls(false)}>
                    {PLOT_SIZES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Ihr Vorhaben (optional)">
                  <textarea
                    {...register("message")}
                    rows={3}
                    className={cn(inputCls(false), "resize-none")}
                    placeholder="Worum geht es? Kurz genügt."
                  />
                </Field>

                <label className="flex items-start gap-3 text-sm text-ink/70">
                  <input
                    type="checkbox"
                    {...register("consent")}
                    className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-wine)]"
                  />
                  <span>
                    Ich bin einverstanden, dass die WFL meine Angaben zur
                    Bearbeitung meiner Anfrage verwendet.{" "}
                    <a href="https://wfl.de/de/datenschutz" target="_blank" rel="noopener" className="underline hover:text-wine">
                      Datenschutz
                    </a>
                  </span>
                </label>
                {errors.consent && (
                  <p className="-mt-2 text-sm text-wine">{errors.consent.message}</p>
                )}

                <button
                  type="submit"
                  disabled={status === "sending"}
                  className="group mt-2 inline-flex items-center justify-center gap-2 rounded-full bg-wine px-8 py-4 text-base font-semibold text-paper transition-all hover:-translate-y-0.5 hover:bg-wine-dark disabled:opacity-60"
                >
                  {status === "sending" ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Wird gesendet…
                    </>
                  ) : (
                    <>
                      Exposé anfordern
                      <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </button>

                {status === "error" && (
                  <p className="text-sm text-wine">
                    Der Versand hat nicht geklappt. Bitte schreiben Sie uns
                    direkt:{" "}
                    <a href={mailtoFallback()} className="font-semibold underline">
                      {CONTACT.email}
                    </a>
                  </p>
                )}
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function SuccessPanel() {
  return (
    <div className="flex h-full flex-col items-center justify-center py-6 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-full bg-avail/15 text-avail">
        <Check className="h-8 w-8" strokeWidth={2.5} />
      </span>
      <h3 className="mt-6 text-2xl font-bold text-ink">Vielen Dank!</h3>
      <p className="mt-3 max-w-sm leading-relaxed text-muted">
        Ihre Anfrage ist bei der WFL eingegangen. Wir melden uns
        schnellstmöglich mit dem vollständigen Exposé.
      </p>
      <a
        href="/expose/bplan-grabau-nr4.pdf"
        target="_blank"
        rel="noopener"
        className="mt-8 inline-flex items-center gap-2 rounded-full bg-wine px-6 py-3.5 text-sm font-semibold text-paper transition-all hover:-translate-y-0.5 hover:bg-wine-dark"
      >
        <FileDown className="h-4 w-4" />
        Schon jetzt: B-Plan ansehen
      </a>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold text-ink">{label}</span>
      {children}
      {error && <span className="text-sm text-wine">{error}</span>}
    </label>
  );
}

function inputCls(hasError: boolean): string {
  return cn(
    "w-full rounded-xl border bg-white px-4 py-3 text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-wine focus:ring-2 focus:ring-wine/15",
    hasError ? "border-wine" : "border-hair-strong",
  );
}
