// Marky's brain — deterministic, zero AI credits (a rule of the road:
// everything works without credits). Answers come from counting, summing and
// filtering the studio's own derived data: the agenda engine, clients, and
// open invoices. Bilingual: mirrors Arabic questions with Arabic answers.
import type { Agenda, AgendaItem } from "@/lib/agenda";

export type PetData = {
  agenda: Agenda | null;
  clients: { slug: string; name: string; planActive: boolean }[];
  invoices: { number: string; clientSlug: string; remaining: number; currency: string; due?: string }[];
};

const isAr = (q: string) => /[؀-ۿ]/.test(q);

function money(sums: Map<string, number>): string {
  return Array.from(sums.entries())
    .map(([cur, n]) => `${Math.round(n).toLocaleString("en-US")} ${cur}`)
    .join(" + ") || "0";
}

function listItems(items: AgendaItem[], max: number): string {
  return items
    .slice(0, max)
    .map((it) => `• ${it.clientName ? it.clientName + ": " : ""}${it.title}`)
    .join("\n");
}

export function petAnswer(question: string, data: PetData): string {
  const q = question.toLowerCase();
  const ar = isAr(question);
  const a = data.agenda;

  // A client mentioned by name focuses every answer on them.
  const client = data.clients.find(
    (c) => c.name && q.includes(c.name.toLowerCase()) || q.includes(c.slug.toLowerCase())
  );

  const invoicesOf = (slug?: string) => data.invoices.filter((i) => !slug || i.clientSlug === slug);
  const sums = (list: PetData["invoices"]) => {
    const m = new Map<string, number>();
    for (const i of list) m.set(i.currency, (m.get(i.currency) || 0) + i.remaining);
    return m;
  };

  // ---- money / owes / invoices ----
  if (/(owe|outstanding|invoice|money|debt|دين|فواتير|فاتورة|مستحق|فلوس|مصاري)/.test(q)) {
    const list = invoicesOf(client?.slug);
    if (!list.length)
      return client
        ? ar ? `لا فواتير مفتوحة على ${client.name} 🎉` : `${client.name} has no open invoices 🎉`
        : ar ? "لا فواتير مفتوحة — كل شيء محصّل 🎉" : "No open invoices — everything's collected 🎉";
    const rows = list
      .sort((x, y) => y.remaining - x.remaining)
      .slice(0, 6)
      .map((i) => `• ${i.number} (${data.clients.find((c) => c.slug === i.clientSlug)?.name || i.clientSlug}): ${Math.round(i.remaining).toLocaleString("en-US")} ${i.currency}${i.due ? `, due ${i.due}` : ""}`)
      .join("\n");
    const total = money(sums(list));
    return ar
      ? `المتبقي ${client ? `على ${client.name}` : "الكلي"}: ${total} 💸\n${rows}\nالتفاصيل: /admin/invoices`
      : `${client ? `${client.name} still owes` : "Outstanding across everyone"}: ${total} 💸\n${rows}\nDetails: /admin/invoices`;
  }

  // ---- approvals / blocked ----
  if (/(approv|blocked|waiting|موافق|معلق|منتظر)/.test(q)) {
    const items = (a?.all || []).filter((i) => i.kind === "approval" && (!client || i.clientSlug === client.slug));
    if (!items.length) return ar ? "لا شيء عالق على الموافقات ✨" : "Nothing is blocked on approvals ✨";
    return ar
      ? `${items.length} بانتظار موافقة العميل:\n${listItems(items, 5)}\nراسلهم — الجدول متوقف عليها.`
      : `${items.length} waiting on client approval:\n${listItems(items, 5)}\nNudge them — the schedule is on hold.`;
  }

  // ---- shoots ----
  if (/(shoot|photo|تصوير|جلسة)/.test(q)) {
    const items = (a?.all || []).filter((i) => i.kind === "shoot" && (!client || i.clientSlug === client.slug));
    if (!items.length) return ar ? "لا جلسات تصوير قريبة 📷" : "No shoots coming up 📷";
    return (ar ? "الجلسات القادمة:\n" : "Upcoming shoots:\n") + listItems(items, 5) + "\n→ /admin/photographer";
  }

  // ---- a specific client, generally ----
  if (client && a) {
    const items = a.all.filter((i) => i.clientSlug === client.slug);
    const inv = invoicesOf(client.slug);
    const parts = [
      items.length
        ? (ar ? `أجندة ${client.name}:\n` : `${client.name}'s agenda:\n`) + listItems(items, 6)
        : ar ? `لا شيء على أجندة ${client.name} 🎉` : `Nothing on ${client.name}'s agenda 🎉`,
    ];
    if (inv.length) parts.push(ar ? `المتبقي: ${money(sums(inv))}` : `Still owed: ${money(sums(inv))}`);
    return parts.join("\n") + `\n→ /admin/clients/${client.slug}/edit`;
  }

  // ---- today / on fire / default day view ----
  if (/(today|fire|due|urgent|overdue|what|اليوم|شو|ايش|متأخر|ضايل)/.test(q) && a) {
    const hot = a.all.filter((i) => i.urgency !== "soon");
    if (!hot.length)
      return ar
        ? "لا شيء مستعجل اليوم — يوم هادي 🧡 القادم على /admin/agenda"
        : "Nothing urgent today — enjoy the calm 🧡 What's next lives at /admin/agenda";
    return ar
      ? `اليوم: ${a.counts.overdue} متأخر، ${a.counts.today} لليوم${a.snoozed ? `، ${a.snoozed} مؤجل` : ""} 🔥\n${listItems(hot, 7)}\nالكل: /admin/agenda`
      : `Today: ${a.counts.overdue} overdue, ${a.counts.today} due${a.snoozed ? `, ${a.snoozed} snoozed` : ""} 🔥\n${listItems(hot, 7)}\nEverything: /admin/agenda`;
  }

  // ---- fallback / help ----
  return ar
    ? "أنا ماركي 🧡 اسألني: «شو ضايل اليوم؟» · «قديش الديون؟» · «شو معلق عالموافقات؟» · «متى التصوير؟» — أو اذكر اسم عميل."
    : "I'm Marky 🧡 Try: “what's on fire today?” · “how much does everyone owe?” · “what's blocked on approvals?” · “when's the next shoot?” — or mention a client's name.";
}
