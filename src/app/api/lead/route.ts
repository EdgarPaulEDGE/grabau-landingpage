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

  const { name, company, email, consent } = data;
  const emailOk = typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!name || !company || !emailOk || consent !== true) {
    return NextResponse.json({ ok: false, error: "validation" }, { status: 400 });
  }

  // Lokaler Fallback-Speicher (best effort, blockiert die Antwort nicht)
  void persistLead(data);

  // E-Mail an die WFL (nur wenn konfiguriert)
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    try {
      await sendEmail(apiKey, data);
    } catch (err) {
      // Mail fehlgeschlagen, aber Lead ist gespeichert: kein harter Fehler
      console.error("Lead-Mail fehlgeschlagen:", err);
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
    ["Telefon", d.phone || "—"],
    ["Gewünschte Größe", d.plotSize || "—"],
    ["Nachricht", d.message || "—"],
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
