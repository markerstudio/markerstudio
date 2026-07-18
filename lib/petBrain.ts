// Marky's brain — deterministic, zero AI credits (a rule of the road:
// everything works without credits). Answers come from counting, summing and
// filtering the studio's own derived data: the agenda engine, clients, open
// invoices, recent payments and the tasks board. Bilingual: mirrors Arabic
// questions with Arabic answers.
//
// Two upgrades over the original toy:
//   · Characters — Marky wakes up as a different character every day (same
//     data, different voice). petCharacter() is pure-by-date so the server
//     and the chat UI agree on who he is without a round-trip.
//   · Capture commands — "task call the printer tomorrow @acme" and
//     "note …" are parsed here (parsePetCommand) and EXECUTED by the API
//     route, which turns Marky from a read-only novelty into a real
//     input/output shortcut: ask from anywhere, capture from anywhere.
import type { Agenda } from "@/lib/agenda";

export type PetTask = {
  title: string;
  clientSlug?: string;
  clientName?: string;
  status: string; // todo | doing | review (done rows never reach the brain)
  due?: string;
  priority?: string;
};

export type PetPayment = { clientSlug: string; amount: number; currency: string; paidOn: string };

export type PetData = {
  agenda: Agenda | null;
  clients: { slug: string; name: string; planActive: boolean }[];
  invoices: { number: string; clientSlug: string; remaining: number; currency: string; due?: string }[];
  /** Open (not-done) tasks across every client + the studio list. */
  tasks?: PetTask[];
  /** Recent payments, newest first. */
  payments?: PetPayment[];
  /** Studio-local yyyy-mm-dd / hour — greetings match Beit Sahour, not UTC. */
  today?: string;
  hour?: number;
};

export const isArabic = (q: string) => /[؀-ۿ]/.test(q);
const isAr = isArabic;

/* ---- characters --------------------------------------------------------- */

// One character per day, picked by hashing the date — deterministic (no
// Math.random in the brain), and the same on the server and in the browser,
// so the chat header, hello message and answer flavor all agree.
export type PetCharacter = {
  key: string;
  name: string;
  nameAr: string;
  emoji: string;
  vibe: string; // how he introduces himself
  vibeAr: string;
  cheer: string; // tacked onto good news
  cheerAr: string;
  nudge: string; // tacked onto fires
  nudgeAr: string;
};

const CHARACTERS: PetCharacter[] = [
  {
    key: "spark", name: "Spark Marky", nameAr: "ماركي شرارة", emoji: "⚡",
    vibe: "Fully charged and ready to run.", vibeAr: "مشحون وجاهز للانطلاق.",
    cheer: "Let's gooo!", cheerAr: "يلا يلا! 🔋",
    nudge: "We can clear these fast — go go go!", nudgeAr: "منخلّصهم بسرعة — يلا يلا!",
  },
  {
    key: "zen", name: "Zen Marky", nameAr: "ماركي الهادئ", emoji: "🍵",
    vibe: "Deep breaths. The board is just a board.", vibeAr: "خذ نفس عميق. اللوحة مجرد لوحة.",
    cheer: "Balance restored.", cheerAr: "رجع التوازن.",
    nudge: "One thing at a time — start with the oldest.", nudgeAr: "شغلة شغلة — ابدأ بالأقدم.",
  },
  {
    key: "sleuth", name: "Detective Marky", nameAr: "ماركي المحقق", emoji: "🕵️",
    vibe: "I've been studying the numbers all night.", vibeAr: "قضيت الليل أدرس الأرقام.",
    cheer: "Case closed.", cheerAr: "القضية مقفلة.",
    nudge: "The evidence says: handle these first.", nudgeAr: "الأدلة بتقول: ابدأ بهدول.",
  },
  {
    key: "captain", name: "Captain Marky", nameAr: "ماركي القبطان", emoji: "🧭",
    vibe: "Steady hands on the wheel.", vibeAr: "إيد ثابتة على الدفة.",
    cheer: "Smooth sailing!", cheerAr: "إبحار هادي!",
    nudge: "Storm ahead — secure these items first.", nudgeAr: "في عاصفة قدامنا — ثبّت هدول أول.",
  },
  {
    key: "chef", name: "Chef Marky", nameAr: "ماركي الشيف", emoji: "👨‍🍳",
    vibe: "Today's menu: fresh studio numbers.", vibeAr: "منيو اليوم: أرقام الاستوديو الطازة.",
    cheer: "Chef's kiss!", cheerAr: "قبلة الشيف! 🤌",
    nudge: "These are burning on the stove — plate them first.", nudgeAr: "هدول عم يحترقوا على النار — قدّمهم أول.",
  },
];

function hash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h;
}

export function petCharacter(dayIso?: string): PetCharacter {
  const day =
    dayIso ||
    // Browser callers (the chat header/hello) pass nothing — local date is
    // close enough to studio date for a costume choice.
    `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(new Date().getDate()).padStart(2, "0")}`;
  return CHARACTERS[hash(day) % CHARACTERS.length];
}

/* ---- capture commands --------------------------------------------------- */

// "task …" / "todo …" / "note …" (and Arabic مهمة / ملاحظة) — the input half
// of the shortcut. Parsed here so both the route (to execute) and any UI hint
// agree on the grammar. The keyword needs a separator after it, so questions
// like "tasks for acme?" stay questions.
export type PetCommand = { type: "task" | "note"; body: string };

export function parsePetCommand(q: string): PetCommand | null {
  const task = q.match(/^\s*(?:add |new |ضيف |أضف )?(?:task|todo|مهمة|مهمه)(?:[:：،]\s*|\s+)([\s\S]+)$/i);
  if (task) return { type: "task", body: task[1].trim() };
  const note = q.match(/^\s*(?:add |new |take a |ضيف |أضف )?(?:note|ملاحظة|ملاحظه)(?:[:：،]\s*|\s+)([\s\S]+)$/i);
  if (note) return { type: "note", body: note[1].trim() };
  return null;
}

/* ---- helpers ------------------------------------------------------------ */

function money(sums: Map<string, number>): string {
  return Array.from(sums.entries())
    .map(([cur, n]) => `${Math.round(n).toLocaleString("en-US")} ${cur}`)
    .join(" + ") || "0";
}

type Listable = { clientName?: string; title: string };
function listItems(items: Listable[], max: number): string {
  return items
    .slice(0, max)
    .map((it) => `• ${it.clientName ? it.clientName + ": " : ""}${it.title}`)
    .join("\n");
}

// Lowercase + strip Arabic diacritics/tatweel so "أحْمَد" matches "احمد".
function norm(s: string): string {
  return s.toLowerCase().replace(/[ً-ْـ]/g, "").replace(/[أإآ]/g, "ا");
}

// A client mentioned by name focuses every answer on them. Matches the full
// name, the slug, or (for multi-word names) a distinctive first word of 4+
// characters — "ramallah" finds "Ramallah Cafe". Longest match wins.
function findClient(text: string, clients: PetData["clients"]): PetData["clients"][number] | null {
  const q = norm(text);
  let best: { c: PetData["clients"][number]; len: number } | null = null;
  for (const c of clients) {
    for (const cand of [c.name, c.slug]) {
      const n = norm(cand || "");
      if (!n) continue;
      if (q.includes(n) && (!best || n.length > best.len)) best = { c, len: n.length };
      const first = n.split(/\s+/)[0];
      if (first.length >= 4 && first !== n && q.includes(first) && (!best || first.length > best.len))
        best = { c, len: first.length };
    }
  }
  return best?.c ?? null;
}

function fmtDay(iso: string, ar: boolean): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString(ar ? "ar" : "en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/* ---- the brain ---------------------------------------------------------- */

export function petAnswer(question: string, data: PetData, history: string[] = []): string {
  const q = norm(question);
  const ar = isAr(question);
  const a = data.agenda;
  const ch = petCharacter(data.today);
  const flavor = (en: string, arS: string) => (ar ? arS : en);

  let client = findClient(question, data.clients);
  // Follow-ups — "what about their invoices?" — inherit the last client the
  // conversation was about.
  if (!client && /(^|\s)(they|them|their|هم|عنهم|عليهم|الهم|إلهم)(\s|$|\?)/i.test(question)) {
    for (const h of [...history].reverse()) {
      client = findClient(h, data.clients);
      if (client) break;
    }
  }

  const invoicesOf = (slug?: string) => data.invoices.filter((i) => !slug || i.clientSlug === slug);
  const sums = (list: { currency: string; remaining?: number; amount?: number }[]) => {
    const m = new Map<string, number>();
    for (const i of list) m.set(i.currency, (m.get(i.currency) || 0) + (i.remaining ?? i.amount ?? 0));
    return m;
  };

  // ---- help / what can you do ----
  if (/(help|what can you|how do you work|commands|مساعدة|شو بتعرف|كيف بشتغل|كيف بتشتغل)/.test(q)) {
    return ar
      ? `أنا ${ch.nameAr} ${ch.emoji} — بعرف أرقام الاستوديو لحظة بلحظة.\n\nاسألني:\n• «شو ضايل اليوم؟» · «شو هالأسبوع؟»\n• «قديش الديون؟» · «قديش قبضنا هالشهر؟»\n• «شو معلق عالموافقات؟» · «متى التصوير؟» · «شو المهام؟»\n• أو اذكر اسم أي عميل\n\nوسجّل بسرعة:\n• «مهمة اتصل بالمطبعة بكرا @اسم-العميل»\n• «ملاحظة العميل بحب اللون الأزرق»`
      : `I'm ${ch.name} ${ch.emoji} — I know the studio's live numbers.\n\nAsk me:\n• “what's on fire today?” · “what's coming this week?”\n• “how much does everyone owe?” · “what did we collect this month?”\n• “what's blocked on approvals?” · “when's the next shoot?” · “what's on the board?”\n• or mention any client by name\n\nAnd capture things fast:\n• “task call the printer tomorrow !high @client”\n• “note the client prefers the blue logo”`;
  }

  // ---- thanks ----
  if (/^\s*(thanks|thank you|thx|ty|شكرا|يسلمو|تسلم)/i.test(question) && question.length < 30) {
    return ar ? `على الراحة 🧡 ${ch.cheerAr}` : `Anytime 🧡 ${ch.cheer}`;
  }

  // ---- greeting (short salutations only, so real questions fall through) ----
  if (
    question.trim().length < 32 &&
    /^\s*(hi|hey|hello|yo|hala|good (morning|afternoon|evening)|مرحبا|هلا|اهلا|سلام|صباح|مساء|كيفك)/i.test(norm(question))
  ) {
    const h = data.hour ?? 12;
    const tod = ar
      ? h < 5 ? "سهرانين؟" : h < 12 ? "صباح الخير" : h < 17 ? "يعطيك العافية" : "مساء الخير"
      : h < 5 ? "Up late?" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
    const hot = (a?.counts.overdue || 0) + (a?.counts.today || 0);
    const pulse = hot
      ? ar
        ? `في ${a!.counts.overdue} متأخر و${a!.counts.today} لليوم — قلّي «اليوم» وبعدّدلك ياهم.`
        : `There are ${a!.counts.overdue} overdue and ${a!.counts.today} due today — say “today” and I'll list them.`
      : ar
        ? "ولا شي مستعجل حالياً ✨"
        : "Nothing urgent right now ✨";
    return `${tod}! ${ch.emoji} ${flavor(ch.vibe, ch.vibeAr)}\n${pulse}`;
  }

  // ---- money / owes / invoices ----
  if (/(owe|outstanding|invoice|money|debt|دين|ديون|فواتير|فاتورة|مستحق|فلوس|مصاري)/.test(q)) {
    const list = invoicesOf(client?.slug);
    if (!list.length)
      return client
        ? ar ? `لا فواتير مفتوحة على ${client.name} 🎉` : `${client.name} has no open invoices 🎉`
        : ar ? `لا فواتير مفتوحة — كل شيء محصّل 🎉 ${ch.cheerAr}` : `No open invoices — everything's collected 🎉 ${ch.cheer}`;
    // "who owes the most" — rank clients instead of listing invoices.
    if (!client && /(most|biggest|largest|اكثر|أكثر|اكبر|أكبر)/.test(q)) {
      const per = new Map<string, Map<string, number>>();
      for (const i of list) {
        const m = per.get(i.clientSlug) || new Map<string, number>();
        m.set(i.currency, (m.get(i.currency) || 0) + i.remaining);
        per.set(i.clientSlug, m);
      }
      const ranked = Array.from(per.entries())
        .map(([slug, m]) => ({ slug, m, top: Math.max(...Array.from(m.values())) }))
        .sort((x, y) => y.top - x.top)
        .slice(0, 3)
        .map(({ slug, m }, i) => `${i + 1}. ${data.clients.find((c) => c.slug === slug)?.name || slug}: ${money(m)}`)
        .join("\n");
      return ar ? `أكبر الديون ${ch.emoji}\n${ranked}\nالتفاصيل: /admin/invoices` : `Biggest balances ${ch.emoji}\n${ranked}\nDetails: /admin/invoices`;
    }
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

  // ---- income / payments received ----
  if (/(receiv|collect|income|revenue|paid us|قبض|قبضنا|دخل|وارد|دفعات)/.test(q)) {
    const pays = (data.payments || []).filter((p) => !client || p.clientSlug === client.slug);
    const month = (data.today || "").slice(0, 7);
    const inMonth = month ? pays.filter((p) => String(p.paidOn).slice(0, 7) === month) : [];
    const last = pays[0];
    if (!pays.length)
      return ar
        ? `ما في دفعات مسجلة${client ? ` من ${client.name}` : ""} بعد.`
        : `No payments on record${client ? ` from ${client.name}` : ""} yet.`;
    const head = inMonth.length
      ? ar
        ? `قبضنا هالشهر${client ? ` من ${client.name}` : ""}: ${money(sums(inMonth))} (${inMonth.length} ${inMonth.length === 1 ? "دفعة" : "دفعات"}) 💰`
        : `Collected this month${client ? ` from ${client.name}` : ""}: ${money(sums(inMonth))} across ${inMonth.length} payment${inMonth.length === 1 ? "" : "s"} 💰`
      : ar
        ? `ولا دفعة هالشهر${client ? ` من ${client.name}` : ""} بعد.`
        : `Nothing collected yet this month${client ? ` from ${client.name}` : ""}.`;
    const lastLine = last
      ? ar
        ? `آخر دفعة: ${Math.round(last.amount).toLocaleString("en-US")} ${last.currency} من ${data.clients.find((c) => c.slug === last.clientSlug)?.name || last.clientSlug} (${String(last.paidOn).slice(0, 10)})`
        : `Last payment: ${Math.round(last.amount).toLocaleString("en-US")} ${last.currency} from ${data.clients.find((c) => c.slug === last.clientSlug)?.name || last.clientSlug} on ${String(last.paidOn).slice(0, 10)}`
      : "";
    return `${head}\n${lastLine}\n${ar ? "الدفاتر" : "Books"}: /admin/finance`;
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

  // ---- tasks board ----
  if (/(task|todo|board|مهمة|مهام|مهمه)/.test(q)) {
    const list = (data.tasks || []).filter((t) => !client || t.clientSlug === client.slug);
    if (!list.length)
      return client
        ? ar ? `لوحة ${client.name} فاضية 🎉` : `${client.name}'s board is clear 🎉`
        : ar ? `اللوحة فاضية 🎉 ${ch.cheerAr}` : `The board is clear 🎉 ${ch.cheer}`;
    const by = (s: string) => list.filter((t) => t.status === s).length;
    const top = [...list]
      .sort((x, y) => (x.due || "9999-99-99").localeCompare(y.due || "9999-99-99"))
      .slice(0, 5);
    const counts = ar
      ? `${by("todo")} جديدة · ${by("doing")} شغالين عليها · ${by("review")} للمراجعة`
      : `${by("todo")} to do · ${by("doing")} in progress · ${by("review")} in review`;
    const hint = ar
      ? "ضيف من هون: «مهمة اتصل بالمطبعة بكرا @العميل»"
      : "Add one right from here: “task call the printer tomorrow @client”";
    return `${ar ? `${list.length} مهمة مفتوحة` : `${list.length} open task${list.length === 1 ? "" : "s"}`}${client ? ` — ${client.name}` : ""} (${counts})\n${listItems(top.map((t) => ({ clientName: client ? undefined : t.clientName, title: `${t.title}${t.due ? ` (${t.due})` : ""}` })), 5)}\n${hint}\n→ /admin/deliverables`;
  }

  // ---- week ahead ----
  if (/(this week|next 7|coming up|week ahead|هالاسبوع|الاسبوع|هالأسبوع|الأسبوع|القادم)/.test(q) && a) {
    const items = a.all.filter((i) => !client || i.clientSlug === client.slug);
    if (!items.length) return ar ? "الأسبوع فاضي — وقت ممتاز للإبداع 🎨" : "The week is clear — great time to create 🎨";
    const rows = items
      .slice(0, 8)
      .map((i) => `• ${fmtDay(i.date, ar)} — ${i.clientName ? i.clientName + ": " : ""}${i.title}`)
      .join("\n");
    return ar
      ? `الأسبوع القادم (${items.length}):\n${rows}\nالكل: /admin/agenda`
      : `The week ahead (${items.length} item${items.length === 1 ? "" : "s"}):\n${rows}\nEverything: /admin/agenda`;
  }

  // ---- clients overview (no specific client named) ----
  if (!client && /(clients|عملاء|كم عميل)/.test(q)) {
    const active = data.clients;
    const plans = active.filter((c) => c.planActive);
    const owing = new Set(data.invoices.map((i) => i.clientSlug)).size;
    return ar
      ? `${active.length} عميل نشط · ${plans.length} باشتراك فعّال · ${owing} عليهم فواتير مفتوحة\n${plans.length ? `الاشتراكات: ${plans.slice(0, 6).map((c) => c.name).join("، ")}` : ""}\n→ /admin/clients`
      : `${active.length} active client${active.length === 1 ? "" : "s"} · ${plans.length} on an active plan · ${owing} with open invoices\n${plans.length ? `On plans: ${plans.slice(0, 6).map((c) => c.name).join(", ")}` : ""}\n→ /admin/clients`;
  }

  // ---- a specific client, generally ----
  if (client && a) {
    const items = a.all.filter((i) => i.clientSlug === client.slug);
    const inv = invoicesOf(client.slug);
    const open = (data.tasks || []).filter((t) => t.clientSlug === client.slug);
    const lastPay = (data.payments || []).find((p) => p.clientSlug === client.slug);
    const parts = [
      items.length
        ? (ar ? `أجندة ${client.name}:\n` : `${client.name}'s agenda:\n`) + listItems(items, 6)
        : ar ? `لا شيء على أجندة ${client.name} 🎉` : `Nothing on ${client.name}'s agenda 🎉`,
    ];
    if (open.length) parts.push(ar ? `${open.length} مهمة مفتوحة على اللوحة` : `${open.length} open task${open.length === 1 ? "" : "s"} on the board`);
    if (inv.length) parts.push(ar ? `المتبقي: ${money(sums(inv))}` : `Still owed: ${money(sums(inv))}`);
    if (lastPay)
      parts.push(
        ar
          ? `آخر دفعة: ${Math.round(lastPay.amount).toLocaleString("en-US")} ${lastPay.currency} (${String(lastPay.paidOn).slice(0, 10)})`
          : `Last payment: ${Math.round(lastPay.amount).toLocaleString("en-US")} ${lastPay.currency} (${String(lastPay.paidOn).slice(0, 10)})`
      );
    return parts.join("\n") + `\n→ /admin/clients/${client.slug}/edit`;
  }

  // ---- today / on fire / default day view ----
  if (/(today|fire|due|urgent|overdue|what|اليوم|شو|ايش|متأخر|ضايل)/.test(q) && a) {
    const hot = a.all.filter((i) => i.urgency !== "soon");
    if (!hot.length)
      return ar
        ? `لا شيء مستعجل اليوم — يوم هادي 🧡 ${ch.cheerAr} القادم على /admin/agenda`
        : `Nothing urgent today — enjoy the calm 🧡 ${ch.cheer} What's next lives at /admin/agenda`;
    return ar
      ? `اليوم: ${a.counts.overdue} متأخر، ${a.counts.today} لليوم${a.snoozed ? `، ${a.snoozed} مؤجل` : ""} 🔥\n${listItems(hot, 7)}\n${ch.nudgeAr}\nالكل: /admin/agenda`
      : `Today: ${a.counts.overdue} overdue, ${a.counts.today} due${a.snoozed ? `, ${a.snoozed} snoozed` : ""} 🔥\n${listItems(hot, 7)}\n${ch.nudge}\nEverything: /admin/agenda`;
  }

  // ---- fallback / help ----
  return ar
    ? `أنا ${ch.nameAr} ${ch.emoji} — ${ch.vibeAr}\nاسألني: «شو ضايل اليوم؟» · «قديش الديون؟» · «قديش قبضنا؟» · «شو المهام؟» — أو اذكر اسم عميل.\nوبسجّل بسرعة: «مهمة …» أو «ملاحظة …»`
    : `I'm ${ch.name} ${ch.emoji} — ${ch.vibe}\nTry: “what's on fire today?” · “how much does everyone owe?” · “what did we collect?” · “what's on the board?” — or mention a client's name.\nQuick capture too: “task …” or “note …”`;
}
