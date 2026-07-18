// Marky — the studio's pet assistant. Admin-only, and deliberately
// credit-free: answers are computed by lib/petBrain from the studio's own
// derived data (agenda engine, clients, open invoices) — no LLM, no API key,
// no cost, works instantly. The chat UI lives in components/admin/Pet.tsx.
import { NextResponse } from "next/server";
import { getSession, isPartnerOnly } from "@/lib/auth";
import { getAgenda } from "@/lib/agenda";
import { getClients } from "@/lib/clients";
import { listInvoices, invoiceRemaining, invoiceCurrency } from "@/lib/invoices";
import { petAnswer, type PetData } from "@/lib/petBrain";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getSession();
  if (!user || user.role === "client" || isPartnerOnly(user)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: { messages?: { role: string; content: string }[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const last = (body.messages || []).filter((m) => m.role === "user").pop();
  const question = String(last?.content || "").slice(0, 500);
  if (!question.trim()) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const [agenda, clients, invoices] = await Promise.all([
    getAgenda(7).catch(() => null),
    getClients().catch(() => []),
    listInvoices().catch(() => []),
  ]);
  const data: PetData = {
    agenda,
    clients: clients
      .filter((c) => !c.data?.archived)
      .map((c) => ({ slug: c.slug, name: c.name || c.slug, planActive: !!c.data?.plan?.active })),
    invoices: invoices
      .filter((i) => !i.archived_at && (i.status === "due" || i.status === "partial"))
      .map((i) => ({
        number: i.number,
        clientSlug: i.client_slug,
        remaining: invoiceRemaining(i.items, Number(i.vat_rate) || 0, Number(i.paid_amount) || 0),
        currency: invoiceCurrency(i.items),
        due: i.due_date ? String(i.due_date).slice(0, 10) : undefined,
      }))
      .filter((i) => i.remaining > 0),
  };

  return NextResponse.json({ text: petAnswer(question, data) });
}
