// Marky — the studio's pet assistant. Admin-only chat over a fresh digest of
// the studio's own data (agenda, clients, money), so answers come from what
// the app already knows — never invented numbers. Uses the same
// ANTHROPIC_API_KEY that powers the AI analysis; without it the endpoint
// answers 501 and the pet explains itself instead of thinking.
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSession, isPartnerOnly } from "@/lib/auth";
import { getAgenda } from "@/lib/agenda";
import { getClients } from "@/lib/clients";
import { listInvoices, invoiceRemaining, invoiceCurrency } from "@/lib/invoices";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

type ChatMsg = { role: "user" | "assistant"; content: string };

async function studioDigest(): Promise<string> {
  const [agenda, clients, invoices] = await Promise.all([
    getAgenda(7).catch(() => null),
    getClients().catch(() => []),
    listInvoices().catch(() => []),
  ]);
  const lines: string[] = [];
  if (agenda) {
    lines.push(`TODAY=${agenda.today} · counts: ${agenda.counts.overdue} overdue, ${agenda.counts.today} today, ${agenda.counts.soon} soon, ${agenda.snoozed} snoozed`);
    for (const it of agenda.all.slice(0, 30)) {
      lines.push(`AGENDA [${it.urgency}] (${it.kind}) ${it.clientName ? it.clientName + ": " : ""}${it.title} — due ${it.date} — page ${it.href}`);
    }
  }
  const live = clients.filter((c) => !c.data?.archived);
  lines.push(`CLIENTS (${live.length}): ${live.map((c) => `${c.name || c.slug}${c.data?.plan?.active ? " [active plan]" : ""}`).join(" · ")}`);
  for (const inv of invoices) {
    if (inv.archived_at || (inv.status !== "due" && inv.status !== "partial")) continue;
    const remaining = invoiceRemaining(inv.items, Number(inv.vat_rate) || 0, Number(inv.paid_amount) || 0);
    if (remaining > 0) lines.push(`OPEN INVOICE ${inv.number} /${inv.client_slug}: ${Math.round(remaining)} ${invoiceCurrency(inv.items)} left${inv.due_date ? `, due ${String(inv.due_date).slice(0, 10)}` : ""}`);
  }
  return lines.join("\n").slice(0, 14000);
}

const SYSTEM = `You are Marky, Marker Studio's pet assistant — a small, cheerful orange blob living in the corner of the studio's admin app. Personality: warm, playful, VERY concise (2-4 short sentences unless asked for detail), occasionally uses one fitting emoji. You speak English or Arabic — mirror the user's language.

You answer ONLY from the STUDIO DATA digest provided. Never invent numbers, clients, or dates. If the digest doesn't contain the answer, say so and point to the right page. When referring to app pages, mention the path from the digest (e.g. /admin/agenda). Money stays in its original currency. The studio: Marker Studio®, a bilingual creative & marketing studio in Beit Sahour, Palestine. Today's date is in the digest.`;

export async function POST(req: Request) {
  const user = await getSession();
  if (!user || user.role === "client" || isPartnerOnly(user)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "no-ai" }, { status: 501 });
  }
  let body: { messages?: ChatMsg[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const messages = (body.messages || [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-12)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  try {
    const digest = await studioDigest();
    const anthropic = new Anthropic();
    const res = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 700,
      system: `${SYSTEM}\n\n===== STUDIO DATA =====\n${digest}`,
      messages,
    });
    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    return NextResponse.json({ text: text || "…" });
  } catch {
    return NextResponse.json({ error: "think-failed" }, { status: 502 });
  }
}
