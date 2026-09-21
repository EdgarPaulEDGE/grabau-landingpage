import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export const runtime = "nodejs";

interface Lead {
  name?: string;
  company?: string;
  email?: string;
  phone?: string;
  plotSize?: string;
  message?: string;
  consent?: boolean;
  website?: string;
}

/**
 * Einfache Drosselung pro IP: höchstens 5 Anfragen in 10 Minuten.
 * Liegt im Speicher der laufenden Instanz, das reicht gegen Skripte,
 * die das Formular in Schleife abschicken.
 */
const FENSTER_MS = 10 * 60 * 1000;
const MAX_PRO_FENSTER = 5;
const anfragen = new Map<string, number[]>();

function gedrosselt(ip: string): boolean {
  const jetzt = Date.now();
  const frisch = (anfragen.get(ip) ?? []).filter((t) => jetzt - t < FENSTER_MS);
  frisch.push(jetzt);
  anfragen.set(ip, frisch);
  if (anfragen.size > 5000) anfragen.clear();
  return frisch.length > MAX_PRO_FENSTER;
}

/** Text-Feld prüfen: String, getrimmt, in der erlaubten Länge */
function text(v: unknown, min: number, max: number): string | null {
  if (typeof v !== "string") return min === 0 ? "" : null;
  const t = v.trim();
  return t.length >= min && t.length <= max ? t : null;
}

/**
 * Nimmt eine Grabau-Anfrage entgegen.
 * 1. Validiert die Pflichtfelder.
 * 2. Verschickt eine E-Mail an die WFL (nur wenn RESEND_API_KEY gesetzt ist).
 * 3. Speichert die Anfrage zusätzlich lokal (Fallback, falls kein Mailversand).
 */
export async function POST(req: Request) {
  let data: Lead;
  try {
    data = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  // Bot hat das unsichtbare Feld ausgefüllt: freundlich "ok", nichts tun
  if (typeof data.website === "string" && data.website.trim() !== "") {
    return NextResponse.json({ ok: true });
  }

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unbekannt";
  if (gedrosselt(ip)) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }

  // Dieselben Regeln wie im Formular (LeadForm.tsx)
  const name = text(data.name, 2, 120);
  const company = text(data.company, 2, 160);
  const email = text(data.email, 3, 254);
  const phone = text(data.phone, 0, 40);
  const plotSize = text(data.plotSize, 0, 60);
  const message = text(data.message, 0, 4000);
  const emailOk = !!email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!name || !company || !emailOk || phone === null || plotSize === null || message === null || data.consent !== true) {
    return NextResponse.json({ ok: false, error: "validation" }, { status: 400 });
  }
  data = { name, company, email: email!, phone, plotSize, message, consent: true };

  // Lokaler Fallback-Speicher (best effort, blockiert die Antwort nicht).
  // Achtung: Auf Hosts wie Render ist das Dateisystem fluechtig, die Datei
  // ist dort nur eine Notfall-Kopie bis zum naechsten Deploy.
  void persistLead(data);

  const apiKey = process.env.RESEND_API_KEY;
  const produktion = process.env.NODE_ENV === "production";

  // In Produktion MUSS die Mail rausgehen, sonst waere der Lead still
  // verloren. Der Fehlerfall zeigt dem Nutzer den direkten Mail-Fallback.
  if (!apiKey) {
    if (produktion) {
      console.error("RESEND_API_KEY fehlt: Lead kann nicht zugestellt werden");
      return NextResponse.json({ ok: false, error: "mail_not_configured" }, { status: 503 });
    }
    // Lokale Entwicklung: Datei-Speicherung reicht
    return NextResponse.json({ ok: true });
  }

  try {
    await sendEmail(apiKey, data);
  } catch (err) {
    console.error("Lead-Mail fehlgeschlagen:", err);
    if (produktion) {
      return NextResponse.json({ ok: false, error: "mail_failed" }, { status: 502 });
    }
  }

  return NextResponse.json({ ok: true });
}

async function persistLead(data: Lead) {
  try {
    const dir = path.join(process.cwd(), "data");
    await fs.mkdir(dir, { recursive: true });
    const line = JSON.stringify({ ...data, at: new Date().toISOString() }) + "\n";
    await fs.appendFile(path.join(dir, "leads.jsonl"), line, "utf8");
  } catch (err) {
    console.error("Lead-Speicherung fehlgeschlagen:", err);
  }
}

async function sendEmail(apiKey: string, d: Lead) {
  const to = process.env.LEAD_TO_EMAIL || "warncke@wfl.de";
  const from = process.env.LEAD_FROM_EMAIL || "Grabau <grabau@wfl.de>";
  const cc = process.env.LEAD_CC_EMAIL;

  const rows: [string, string][] = [
    ["Name", d.name ?? ""],
    ["Unternehmen", d.company ?? ""],
    ["E-Mail", d.email ?? ""],
    ["Telefon", d.phone || "keine Angabe"],
    ["Gewünschte Größe", d.plotSize || "keine Angabe"],
    ["Nachricht", d.message || "keine Angabe"],
  ];

  const html = `
    <div style="font-family:Arial,sans-serif;color:#241a1b">
      <h2 style="color:#971b22">Neue Anfrage · Gewerbepark Grabau</h2>
      <table style="border-collapse:collapse">
        ${rows
          .map(
            ([k, v]) =>
              `<tr><td style="padding:6px 14px 6px 0;color:#7a6e6f">${k}</td><td style="padding:6px 0"><strong>${escapeHtml(
                v,
              )}</strong></td></tr>`,
          )
          .join("")}
      </table>
    </div>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      ...(cc ? { cc: [cc] } : {}),
      reply_to: d.email,
      subject: `Grabau-Anfrage: ${d.company}`,
      html,
    }),
  });

  if (!res.ok) throw new Error(`Resend ${res.status}`);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
