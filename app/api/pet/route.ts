// Marky — the studio's pet assistant. Admin-only, and deliberately
// credit-free: answers are computed by lib/petBrain from the studio's own
// derived data (agenda engine, clients, open invoices, payments, tasks) —
// no LLM, no API key, no cost, works instantly. Beyond answering, Marky is
// now an input shortcut too: "task …" and "note …" messages create real
// records through the same guarded paths the admin UI uses. The chat UI
// lives in components/admin/petChat.tsx.
import { NextResponse } from "next/server";
import { getSession, isPartnerOnly, isPhotographerOnly } from "@/lib/auth";
import { getAgenda, agendaToday } from "@/lib/agenda";
import { getClients } from "@/lib/clients";
import { listInvoices, invoiceRemaining, invoiceCurrency } from "@/lib/invoices";
import { listAllPayments } from "@/lib/payments";
import { getStudioDeliverables, STUDIO_SLUG } from "@/lib/studio";
import { createNote } from "@/lib/notes";
import { createTask } from "@/app/admin/deliverables/actions";
import { parseTask, friendlyDue, type ProjectOption } from "@/lib/taskParse";
import { petAnswer, parsePetCommand, isArabic, type PetData, type PetTask } from "@/lib/petBrain";

export const dynamic = "force-dynamic";

// Greetings should match the studio's clock, not the server's.
function studioHour(): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Hebron", hour: "2-digit", hourCycle: "h23" }).format(new Date())
  );
}

type SlimClient = { slug: string; name: string; planActive: boolean };

// "note @acme prefers the blue logo" — an optional leading/inline @mention
// links the note to a client; the tag is stripped from the saved body.
function noteClient(body: string, clients: SlimClient[]): { slug?: string; name?: string; clean: string } {
  const m = body.match(/(^|\s)@([^\s@]+)/);
  if (!m) return { clean: body };
  const word = m[2].toLowerCase();
  const hit = clients.find((c) => {
    const name = c.name.toLowerCase();
    return c.slug.toLowerCase().startsWith(word) || name.startsWith(word) || name.split(/\s+/)[0].startsWith(word);
  });
  if (!hit) return { clean: body };
  const at = m.index! + m[1].length;
  const clean = (body.slice(0, at) + body.slice(at + 1 + m[2].length)).replace(/\s{2,}/g, " ").trim();
  return { slug: hit.slug, name: hit.name, clean };
}

export async function POST(req: Request) {
  const user = await getSession();
  if (!user || user.role === "client" || isPartnerOnly(user)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: { messages?: { role: string; content: string }[]; page?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const page = typeof body.page === "string" ? body.page.slice(0, 32) : undefined;
  const userMsgs = (body.messages || []).filter((m) => m.role === "user");
  const last = userMsgs.pop();
  const question = String(last?.content || "").slice(0, 500);
  if (!question.trim()) return NextResponse.json({ error: "bad request" }, { status: 400 });
  // Earlier turns give follow-ups ("what about their invoices?") a memory.
  const history = userMsgs.slice(-8).map((m) => String(m.content || "").slice(0, 300));
  const ar = isArabic(question);

  // ---- capture commands: Marky as an input shortcut ----------------------
  const cmd = parsePetCommand(question);
  if (cmd) {
    const clients = (await getClients().catch(() => []))
      .filter((c) => !c.data?.archived)
      .map((c) => ({ slug: c.slug, name: c.name || c.slug, planActive: !!c.data?.plan?.active }));

    if (cmd.type === "task") {
      const projects: ProjectOption[] = [
        { key: STUDIO_SLUG, name: "Studio", kind: "studio" },
        ...clients.map((c) => ({ key: c.slug, name: c.name, kind: "client" as const })),
      ];
      const parsed = parseTask(cmd.body, projects);
      if (!parsed.title)
        return NextResponse.json({ text: ar ? "شو المهمة؟ اكتب: «مهمة اتصل بالمطبعة بكرا»" : "What's the task? Try: “task call the printer tomorrow”" });
      const res = await createTask({
        slug: parsed.project?.key || STUDIO_SLUG,
        title: parsed.title,
        due: parsed.due,
        time: parsed.time,
        priority: parsed.priority,
        listName: parsed.project?.name,
      });
      if (!res.ok)
        return NextResponse.json({ text: ar ? `ما قدرت أضيفها — ${res.error || "خطأ"}` : `Couldn't add it — ${res.error || "unknown error"}` });
      const bits = [
        parsed.project?.name || "Studio",
        parsed.due ? friendlyDue(parsed.due) + (parsed.time ? ` ${parsed.time}` : "") : "",
        parsed.priority && parsed.priority !== "normal" ? parsed.priority : "",
      ].filter(Boolean).join(" · ");
      return NextResponse.json({
        text: ar
          ? `تمّت الإضافة ✅ «${parsed.title}» — ${bits} 🎉\nاللوحة: /admin/deliverables`
          : `Added ✅ “${parsed.title}” — ${bits} 🎉\nBoard: /admin/deliverables`,
      });
    }

    // Notes mirror the notes app's access rule (photographer-only stays out).
    if (isPhotographerOnly(user))
      return NextResponse.json({ text: ar ? "الملاحظات مش ضمن صلاحياتك 🙈" : "Notes aren't part of your area 🙈" });
    const { slug, name, clean } = noteClient(cmd.body, clients);
    if (!clean)
      return NextResponse.json({ text: ar ? "شو الملاحظة؟" : "What should the note say?" });
    const note = await createNote({ body: clean, clientSlug: slug || null });
    if (!note)
      return NextResponse.json({ text: ar ? "ما قدرت أحفظها — قاعدة البيانات مش متاحة." : "Couldn't save it — no database available." });
    return NextResponse.json({
      text: ar
        ? `سجّلتها 🗒️✅ «${clean.slice(0, 120)}»${name ? ` — على ${name}` : ""}\nالملاحظات: /admin/notes`
        : `Noted 🗒️✅ “${clean.slice(0, 120)}”${name ? ` — filed under ${name}` : ""}\nNotes: /admin/notes`,
    });
  }

  // ---- questions: Marky as an output shortcut ----------------------------
  // Clients are fetched once and shared with the agenda engine — the clients
  // table is the heaviest read in the app, and this route used to pull it
  // twice per chat message.
  const clients = await getClients().catch(() => []);
  const [agenda, invoices, payments, studioItems] = await Promise.all([
    getAgenda(7, { clients }).catch(() => null),
    listInvoices().catch(() => []),
    listAllPayments(300).catch(() => []),
    getStudioDeliverables().catch(() => []),
  ]);
  const activeClients = clients.filter((c) => !c.data?.archived);

  // Open tasks: every client's deliverables (already fetched) + the studio list.
  const tasks: PetTask[] = [];
  for (const c of activeClients) {
    for (const it of c.data?.deliverables?.items || []) {
      if (it.title && it.status !== "done")
        tasks.push({ title: it.title, clientSlug: c.slug, clientName: c.name || c.slug, status: it.status, due: it.due, priority: it.priority });
    }
  }
  for (const it of studioItems) {
    if (it.title && it.status !== "done")
      tasks.push({ title: it.title, status: it.status, due: it.due, priority: it.priority });
  }

  const data: PetData = {
    agenda,
    clients: activeClients.map((c) => ({ slug: c.slug, name: c.name || c.slug, planActive: !!c.data?.plan?.active })),
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
    tasks,
    payments: payments.map((p) => ({
      clientSlug: p.client_slug,
      amount: Number(p.amount) || 0,
      currency: p.currency,
      paidOn: String(p.paid_on).slice(0, 10),
    })),
    today: agendaToday(),
    hour: studioHour(),
    page,
  };

  return NextResponse.json({ text: petAnswer(question, data, history) });
}
