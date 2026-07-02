// Proposal & Agreement documents — the studio's print-first, paged A4 system.
//
// A ProposalDoc / AgreementDoc is stored on the client's JSONB data
// (data.proposal.doc / data.agreement.doc) and rendered by
// components/docs/ProposalDocument & AgreementDocument as a bilingual,
// themeable, PDF-exportable document. Defaults below carry the studio's
// standard copy so a new document is presentable before any editing.
//
// Rich text: `*text*` renders in the accent colour, `**text**` renders bold.
// In multi-line title fields, line breaks split display lines.

import type { ClientData } from "@/lib/clients";

export type L = { en: string; ar: string };

export type DocTheme = {
  cover: "ink" | "paper" | "orange";
  accent: "orange" | "charcoal";
  display: "bold" | "light";
  nums: "solid" | "outline";
  brush: boolean;
};

export type MetaItem = { label: L; value: L };
export type GlanceStat = { n: L; d: L };
export type TeamMember = { name: string; role: L };
export type InsightCard = { no: string; title: L; sub: L; bullets: L[] };
export type ScopeCard = { no: string; flag: L; title: L; sub: L; desc: L; bullets: L[] };
// cells: one entry per week column — 0 = empty, 1 = solid bar, 2 = soft bar.
export type GanttPhase = { name: L; alt: L; cells: number[] };

export type PricePlan = {
  key: string;
  title: L;
  sub: L; // small line under the title (other language, e.g.)
  desc: L;
  features: L[];
  price: number;
  oldPrice?: number;
  period: "mo" | "once";
  badge: L; // empty string = no badge
  selected: boolean; // pre-selected when the client opens the doc
};
export type PriceGroup = {
  title: L;
  sub: L;
  mode: "single" | "multi"; // single = radio (always one), multi = toggles
  plans: PricePlan[];
};

export type ProposalDoc = {
  v: 1;
  theme: DocTheme;
  docId: string;
  currency: string; // e.g. "₪"
  cover: {
    eyebrow: L;
    preparedFor: L; // supports ** bold
    title: L; // line breaks split lines; * marks the accent word
    sub: L;
    meta: MetaItem[];
  };
  overview: {
    enabled: boolean;
    kicker: L;
    title: L;
    paras: L[];
    glanceTitle: L;
    stats: GlanceStat[];
    team: TeamMember[];
    signLabel: L;
    signNames: string;
    signRole: L;
    contact: string; // "phone · email · site"
  };
  understanding: { enabled: boolean; kicker: L; title: L; cards: InsightCard[] };
  scope: { enabled: boolean; kicker: L; title: L; intro: L; cards: ScopeCard[] };
  workplan: {
    enabled: boolean;
    kicker: L;
    title: L;
    weeks: number; // number of W columns
    phases: GanttPhase[];
    foot: MetaItem[];
  };
  investment: {
    enabled: boolean;
    kicker: L;
    title: L;
    hint: L; // "selection note" copy in the summary bar
    groups: PriceGroup[];
    note: L; // fine print under the plans
  };
  why: {
    enabled: boolean;
    kicker: L;
    title: L;
    paras: L[];
    quote: L;
    quoteSub: L;
    quoteMark: string;
  };
  acceptance: {
    kicker: L;
    title: L;
    body: L;
    terms: L[];
    stampLine: L;
  };
};

export type AgreementSectionDoc = { title: L; body: L[]; list: L[] };

export type AgreementDoc = {
  v: 1;
  theme: DocTheme;
  docId: string;
  currency: string;
  cover: { eyebrow: L; title: L; sub: L; meta: MetaItem[] };
  summary: { kicker: L; title: L; intro: L; rows: MetaItem[] };
  schedule: {
    enabled: boolean;
    title: L;
    items: { label: L; amount: string }[];
    note: L;
  };
  sections: AgreementSectionDoc[];
  acceptance: { kicker: L; title: L; body: L; stampLine: L };
};

// What the client confirmed on the acceptance page (stored on data.proposal).
export type ProposalSelection = {
  items: { label: string; price: number; period: "mo" | "once" }[];
  monthly: number;
  once: number;
  currency: string;
};

const l = (en: string, ar: string): L => ({ en, ar });

export function docIdFor(name: string, kind: "PRO" | "AGR"): string {
  const initials = (name || "MS")
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 3) || "MS";
  const d = new Date();
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  return `${initials}${String(d.getDate()).padStart(2, "0")}${months[d.getMonth()]}${d.getFullYear()}${kind}`;
}

function todayMeta(): L {
  const d = new Date();
  const en = d.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  const ar = d.toLocaleDateString("ar", { day: "numeric", month: "long", year: "numeric" });
  return l(`${en} · v1.0`, `${ar} · نسخة ١٫٠`);
}

export function defaultTheme(): DocTheme {
  return { cover: "ink", accent: "orange", display: "bold", nums: "solid", brush: true };
}

// The studio's standard proposal, personalised with the client's name. Where a
// brief / legacy timeline / legacy pricing exists on the client, it's folded in.
export function defaultProposalDoc(clientName: string, data?: ClientData): ProposalDoc {
  const name = clientName || "New Client";
  const brief = data?.onboarding;
  const firstWord = name.split(/\s+/)[0];
  const rest = name.split(/\s+/).slice(1).join(" ");

  const doc: ProposalDoc = {
    v: 1,
    theme: defaultTheme(),
    docId: docIdFor(name, "PRO"),
    currency: "₪",
    cover: {
      eyebrow: l("Brand & Social Content Proposal", "مقترح علامة ومحتوى وسائل تواصل"),
      preparedFor: l(`Prepared for **${name}** · By **Marker Studio®**`, `مُحضّر لـ **${name}** · من **Marker Studio®**`),
      title: l(rest ? `${firstWord}\n*${rest}*` : `*${firstWord}*`, rest ? `${firstWord}\n*${rest}*` : `*${firstWord}*`),
      sub: l(
        "A clear brand and content system, built with care — carrying your story to the people who are quietly searching for exactly this.",
        "نظام علامة ومحتوى واضح، مبني بعناية — ينقل قصتك إلى الأشخاص الذين يبحثون بهدوء عن هذا تحديدًا."
      ),
      meta: [
        { label: l("Client", "العميل"), value: l(name, name) },
        { label: l("Field", "المجال"), value: l(brief?.brandDescription?.slice(0, 60) || "—", brief?.brandDescription?.slice(0, 60) || "—") },
        { label: l("Scope", "النطاق"), value: l("Brand & social content", "علامة ومحتوى وسائل تواصل") },
        { label: l("Date", "التاريخ"), value: todayMeta() },
      ],
    },
    overview: {
      enabled: true,
      kicker: l("Overview", "نظرة عامة"),
      title: l("A clear, confident voice — made *visible*.", "صوت واضح وواثق — نجعله *مرئيًا*."),
      paras: [
        l(
          `At **Marker Studio®**, we are glad to present this proposal for **${name}**.`,
          `يسرّ **Marker Studio®** تقديم هذا المقترح لـ **${name}**.`
        ),
        l(
          "People don't choose a brand from an advert — they choose the voice that makes them feel **understood**. That's what we build: clarity, consistency and trust.",
          "لا يختار الناس علامةً من إعلان — بل يختارون الصوت الذي يُشعرهم بأنهم **مفهومون**. هذا ما نبنيه: وضوح وانتظام وثقة."
        ),
        l(
          "Marker builds a warm, consistent presence that carries your expertise to the people looking for it — clearly, bilingually, and with care.",
          "يبني Marker حضورًا دافئًا ومنتظمًا ينقل خبرتك إلى من يبحث عنها — بوضوح، بلغتين، وبعناية."
        ),
      ],
      glanceTitle: l("Studio at a glance", "لمحة عن الاستوديو"),
      stats: [
        { n: l("7+", "+7"), d: l("Years building warm, trustworthy brands and content across the region.", "سنوات في بناء علامات ومحتوى دافئ وموثوق في المنطقة.") },
        { n: l("100+", "+100"), d: l("Brands and practitioners supported with clarity and care.", "علامة وممارِس تم دعمهم بوضوح وعناية.") },
        { n: l("EN · AR", "عربي · إنجليزي"), d: l("Everything produced bilingually — Arabic and English, side by side.", "كل شيء يُنتَج بلغتين، جنبًا إلى جنب.") },
      ],
      team: [
        { name: "Elias Boulos", role: l("Branding", "الهوية") },
        { name: "Maram Mughrabi", role: l("Administration", "الإدارة") },
        { name: "Ramzi Qumsieh", role: l("Marketing", "التسويق") },
      ],
      signLabel: l("Prepared by", "إعداد"),
      signNames: "Elias Boulos, Maram Mughrabi & Ramzi Qumsieh",
      signRole: l("Marker Studio® · Beit Sahour, Palestine", "Marker Studio® · بيت ساحور، فلسطين"),
      contact: "+970 568 08 14 08 · create@marker.ps · marker.ps",
    },
    understanding: {
      enabled: true,
      kicker: l("The project", "المشروع"),
      title: l("The work isn't marketing. It's *connection*.", "العمل ليس تسويقًا. إنه *تواصل*."),
      cards: [
        {
          no: "2.1",
          title: l("Strengths", "نقاط القوة"),
          sub: l("نقاط القوة", "Strengths"),
          bullets: [
            l("**A real story.** Genuine expertise and warmth — trust that can't be faked.", "**قصة حقيقية.** خبرة ودفء صادقان — ثقة لا يمكن اصطناعها."),
            l("**Emotionally resonant.** Work that touches people's lives and is worth sharing.", "**أثر عاطفي.** عمل يلامس حياة الناس ويستحق المشاركة."),
            l("**An underserved need.** Clear, caring content is rare in this field.", "**حاجة غير مُلبّاة.** المحتوى الواضح والمهتم نادر في هذا المجال."),
            l("**Bilingual reach.** Arabic and English audiences, each served in their own language.", "**وصول بلغتين.** جمهور عربي وإنجليزي، كلٌّ بلغته."),
          ],
        },
        {
          no: "2.2",
          title: l("Challenges", "التحديات"),
          sub: l("التحديات", "Challenges"),
          bullets: [
            l("**Consistency is hard.** A meaningful presence needs steady, regular content.", "**الانتظام صعب.** الحضور المؤثر يحتاج محتوى منتظمًا وثابتًا."),
            l("**Time is scarce.** Running the business leaves little time to post.", "**الوقت ضيّق.** إدارة العمل تترك وقتًا قليلًا للنشر."),
            l("**Tone matters.** The voice must build trust — never feel like noise.", "**النبرة مهمة.** الصوت يجب أن يبني الثقة — لا أن يكون ضجيجًا."),
            l("**Quiet today.** No steady rhythm or audience yet.", "**حضور خافت.** لا إيقاع أو جمهور ثابت بعد."),
          ],
        },
        {
          no: "2.3",
          title: l("Audience", "الجمهور"),
          sub: l("الجمهور", "Audience"),
          bullets: [
            l("**The core audience.** The people actively searching for exactly this service.", "**الجمهور الأساسي.** الأشخاص الباحثون فعلًا عن هذه الخدمة تحديدًا."),
            l("**The circle around them.** Family and friends who recommend and share.", "**الدائرة المحيطة.** العائلة والأصدقاء الذين يوصون ويشاركون."),
            l("**The community.** People drawn to this field and way of working.", "**المجتمع.** المهتمون بهذا المجال وبهذه الطريقة في العمل."),
          ],
        },
      ],
    },
    scope: {
      enabled: true,
      kicker: l("The plan", "الخطة"),
      title: l("A focused content engine, built to *build trust*.", "محرّك محتوى مركّز، مبني *لبناء الثقة*."),
      intro: l(
        "Four connected workstreams take the account from quiet to a warm, recognizable presence — a voice to be known by, a content system to sustain it, a daily rhythm that builds closeness, and a profile that turns visitors into followers.",
        "أربعة مسارات مترابطة تنقل الحساب من الهدوء إلى حضور دافئ ومعروف — صوت يُعرَف به، ونظام محتوى يُديمه، وإيقاع يومي يبني القرب، وملف يحوّل الزائر إلى متابع."
      ),
      cards: [
        {
          no: "01",
          flag: l("Recommended start", "البداية الموصى بها"),
          title: l("Brand Voice & Positioning", "نبرة العلامة والتموضع"),
          sub: l("نبرة العلامة", "Brand Voice"),
          desc: l(
            "The foundation — a warm, calm bilingual voice, the topics you own, and the feeling every post should leave behind.",
            "الأساس — صوت دافئ هادئ بلغتين، المواضيع التي تملكها، والشعور الذي يتركه كل منشور."
          ),
          bullets: [l("Bilingual tone of voice", "نبرة صوت بلغتين"), l("Content pillars & themes", "محاور ومواضيع المحتوى")],
        },
        {
          no: "02",
          flag: l("", ""),
          title: l("Content System & Templates", "نظام المحتوى والقوالب"),
          sub: l("نظام المحتوى", "Content System"),
          desc: l(
            "A repeatable kit so weeks of content take hours, not days — reel frameworks, post templates and content series, ready to reuse.",
            "حقيبة متكررة تجعل محتوى أسابيع يُنجَز بساعات — أطر ريلز، قوالب منشورات، وسلاسل محتوى جاهزة لإعادة الاستخدام."
          ),
          bullets: [l("Post & reel templates", "قوالب منشورات وريلز"), l("Caption & script frameworks", "أطر نصوص وكابشن")],
        },
        {
          no: "03",
          flag: l("", ""),
          title: l("Daily Stories & Community", "ستوري يومي ومجتمع"),
          sub: l("ستوري يومي", "Daily Stories"),
          desc: l(
            "A warm daily presence — managed stories, gentle prompts and replies that turn quiet followers into a trusting community.",
            "حضور يومي دافئ — ستوري مُدار، تحفيز لطيف، وردود تحوّل المتابعين الهادئين إلى مجتمع واثق."
          ),
          bullets: [l("Managed daily stories", "ستوري يومي مُدار"), l("Community replies & DMs", "ردود المجتمع والرسائل")],
        },
        {
          no: "04",
          flag: l("", ""),
          title: l("Profile & Growth Setup", "إعداد الحساب والنمو"),
          sub: l("إعداد الحساب", "Profile Setup"),
          desc: l(
            "A clean, welcoming profile — an optimized bio, highlight covers and a clear path that turns a first visit into a follow.",
            "ملف نظيف ومُرحّب — نبذة مُحسّنة، أغطية هايلايت، ومسار واضح يحوّل الزيارة الأولى إلى متابعة."
          ),
          bullets: [l("Bio & highlight covers", "نبذة وأغطية هايلايت"), l("Hashtags & growth setup", "هاشتاغ وإعداد النمو")],
        },
      ],
    },
    workplan: {
      enabled: true,
      kicker: l("The work plan", "خطة العمل"),
      title: l("Four weeks to launch, then *ongoing*.", "أربعة أسابيع للإطلاق، ثم *استمرار*."),
      weeks: 6,
      phases: [
        { name: l("Discovery & voice", "الاكتشاف والنبرة"), alt: l("الاكتشاف والنبرة", "Discovery"), cells: [1, 2, 0, 0, 0, 0] },
        { name: l("Content system & templates", "نظام المحتوى والقوالب"), alt: l("نظام المحتوى", "Content"), cells: [0, 1, 1, 0, 0, 0] },
        { name: l("Profile & highlights setup", "إعداد الحساب والهايلايت"), alt: l("إعداد الحساب", "Setup"), cells: [0, 0, 2, 1, 0, 0] },
        { name: l("First content & launch", "أول محتوى وإطلاق"), alt: l("أول محتوى وإطلاق", "Launch"), cells: [0, 0, 0, 2, 1, 0] },
        { name: l("Monthly content & stories", "المحتوى والستوري الشهري"), alt: l("المحتوى الشهري", "Monthly"), cells: [0, 0, 0, 0, 1, 1] },
      ],
      foot: [
        { label: l("Setup duration", "مدة الإعداد"), value: l("≈ 4 weeks", "≈ ٤ أسابيع") },
        { label: l("Main output", "المخرج الأساسي"), value: l("Voice + content engine", "نبرة + محرّك محتوى") },
        { label: l("Then", "ثم"), value: l("Ongoing monthly plan", "خطة شهرية مستمرة") },
      ],
    },
    investment: {
      enabled: true,
      kicker: l("The investment", "الاستثمار"),
      title: l("Two clear plans. *You choose* the rhythm.", "خطتان واضحتان. *أنت تختار* الإيقاع."),
      hint: l(
        "Choose the plan that fits. Both are monthly with no setup fee — start, pause or change with 14 days' notice.",
        "اختر الخطة المناسبة. كلتاهما شهرية وبلا رسوم إعداد — تبدأ أو تتوقف أو تتغيّر بإشعار ١٤ يومًا."
      ),
      groups: [
        {
          title: l("Monthly plans", "الخطط الشهرية"),
          sub: l("Choose one · no setup fee", "اختر واحدة · بلا رسوم إعداد"),
          mode: "single",
          plans: [
            {
              key: "content",
              title: l("Content Plan — Self-Managed", "خطة المحتوى — إدارة ذاتية"),
              sub: l("خطة المحتوى — إدارة ذاتية", "Content Plan — Self-Managed"),
              desc: l(
                "A full content plan and per-post direction. We give the strategy and the script; you record and post yourself.",
                "خطة محتوى كاملة وتوجيه لكل منشور. نقدّم الاستراتيجية والنص؛ وأنت تسجّل وتنشر بنفسك."
              ),
              features: [
                l("Monthly content plan & calendar", "خطة محتوى وتقويم شهري"),
                l("Per-post direction & scripts (EN/AR)", "توجيه ونصوص لكل منشور (عربي/إنجليزي)"),
                l("Reel & post ideas, ready to film", "أفكار ريلز ومنشورات جاهزة للتصوير"),
                l("You record & post — no management", "أنت تسجّل وتنشر — بلا إدارة"),
              ],
              price: 800,
              period: "mo",
              badge: l("", ""),
              selected: false,
            },
            {
              key: "social",
              title: l("Social Plan + Daily Stories", "خطة وسائل التواصل + ستوري يومي"),
              sub: l("خطة وسائل التواصل + ستوري يومي", "Social Plan + Daily Stories"),
              desc: l(
                "Everything in the Content Plan, fully managed by us — plus daily stories that keep you present every single day.",
                "كل ما في خطة المحتوى، بإدارتنا الكاملة — بالإضافة إلى ستوري يومي يُبقيك حاضرًا كل يوم."
              ),
              features: [
                l("Everything in the Content Plan", "كل ما في خطة المحتوى"),
                l("Fully managed posting (EN/AR)", "نشر بإدارة كاملة (عربي/إنجليزي)"),
                l("Daily stories, managed for you", "ستوري يومي، بإدارتنا"),
                l("Community replies & monthly report", "ردود المجتمع وتقرير شهري"),
              ],
              price: 1600,
              period: "mo",
              badge: l("Recommended", "موصى به"),
              selected: true,
            },
          ],
        },
      ],
      note: l(
        "Prices are in Israeli new shekel (₪) and valid for 30 days. Plans are billed monthly and can pause or change with 14 days' notice. Photo and video shoots are quoted separately.",
        "الأسعار بالشيكل الجديد (₪) وصالحة ٣٠ يومًا. الخطط تُدفع شهريًا ويمكن إيقافها أو تغييرها بإشعار ١٤ يومًا. جلسات التصوير الفوتوغرافي والفيديو تُسعّر بشكل منفصل."
      ),
    },
    why: {
      enabled: true,
      kicker: l("Why Marker", "لماذا Marker"),
      title: l("Warm, bilingual, and *accountable*.", "دافئ، بلغتين، و*مسؤول*."),
      paras: [
        l(
          "We are a **Palestinian creative studio** built for exactly this — warm, clear bilingual content that earns trust. We don't chase trends; we make care *visible*.",
          "نحن **استوديو فلسطيني** مبني لهذا تحديدًا — محتوى دافئ وواضح بلغتين يكسب الثقة. لا نلاحق الموضات؛ نجعل العناية *مرئية*."
        ),
        l(
          "Every month you get the work **and the numbers** behind it — what resonated, what didn't, and what's next. Calm, honest and consistent.",
          "كل شهر تحصل على العمل **والأرقام** خلفه — ما لامس القلوب وما لم يفعل وما هو التالي. بهدوء وصدق وانتظام."
        ),
      ],
      quote: l("“We mark the brands that matter.”", "نُبرز العلامات التي لها معنى."),
      quoteSub: l("نُبرز العلامات التي لها معنى.", "We mark the brands that matter."),
      quoteMark: `Marker Studio® · ${new Date().getFullYear()}`,
    },
    acceptance: {
      kicker: l("Acceptance", "القبول"),
      title: l("Ready when you are.", "جاهزون حين تكون."),
      body: l(
        "To begin, confirm your selected plan below and sign. We'll send a short agreement and the first invoice, and schedule a 45-minute discovery call.",
        "للبدء، أكّد الخطة المختارة أدناه ووقّع. سنرسل اتفاقية قصيرة والفاتورة الأولى، ونحدد مكالمة اكتشاف مدتها ٤٥ دقيقة."
      ),
      terms: [
        l("Selection confirms scope only — final terms are set in the signed agreement.", "الاختيار يؤكد النطاق فقط — الشروط النهائية في الاتفاقية الموقّعة."),
        l("Work begins on receipt of the first payment.", "يبدأ العمل عند استلام الدفعة الأولى."),
        l("All content is reviewed with you before it goes live.", "كل محتوى يُراجَع معك قبل نشره."),
      ],
      stampLine: l(`Beit Sahour, Palestine — ${name} Proposal`, `بيت ساحور، فلسطين — مقترح ${name}`),
    },
  };

  // Fold in legacy data the studio may already have prepared on this client.
  const legacyPricing = data?.pricing?.items?.filter((it) => it.label) || [];
  if (legacyPricing.length) {
    doc.investment.groups = [
      {
        title: l("Your quote", "عرض السعر"),
        sub: l("Itemised · select to confirm", "مُفصّل · اختر للتأكيد"),
        mode: "multi",
        plans: legacyPricing.map((it, i) => ({
          key: `item-${i}`,
          title: l(it.label, it.label),
          sub: l("", ""),
          desc: l("", ""),
          features: [],
          price: parseFloat((it.amount || "").replace(/[^0-9.]/g, "")) || 0,
          period: /mo|month|شهري/i.test(it.amount || "") ? "mo" : "once",
          badge: l("", ""),
          selected: true,
        })),
      },
    ];
    if (data?.pricing?.note) doc.investment.note = l(data.pricing.note, data.pricing.note);
  }
  const legacyTimeline = data?.proposal?.timeline?.filter((t) => t.phase) || [];
  if (legacyTimeline.length) {
    const weeks = Math.max(6, legacyTimeline.length + 1);
    doc.workplan.weeks = weeks;
    doc.workplan.phases = legacyTimeline.map((t, i) => {
      const cells = Array.from({ length: weeks }, () => 0);
      cells[Math.min(i, weeks - 1)] = 1;
      if (i + 1 < weeks) cells[i + 1] = 2;
      return { name: l(t.phase, t.phase), alt: l(t.duration || "", t.duration || ""), cells };
    });
  }
  return doc;
}

// The studio's standard service agreement as a bilingual paged document.
export function defaultAgreementDoc(input: {
  clientName: string;
  representative?: string;
  phone?: string;
  packageName?: string;
  scope?: string[];
  purpose?: string;
  value?: string;
}): AgreementDoc {
  const name = input.clientName || "New Client";
  const rep = input.representative || "";
  const scope = input.scope?.length
    ? input.scope
    : ["Branding and visual identity", "Launch designs", "Final setup and handover"];
  const pkg = input.packageName || scope.join(", ");
  const value = input.value || "As per the accepted proposal";

  return {
    v: 1,
    theme: { ...defaultTheme(), cover: "paper" },
    docId: docIdFor(name, "AGR"),
    currency: "₪",
    cover: {
      eyebrow: l("Service Agreement", "اتفاقية الخدمة"),
      title: l(`Service\n*Agreement*`, `اتفاقية\n*الخدمة*`),
      sub: l(
        `This Agreement sets the scope, payment structure and responsibilities for the work between Marker Studio® and ${name} — clear terms, so both sides can focus on the work.`,
        `تحدّد هذه الاتفاقية النطاق وهيكل الدفع والمسؤوليات للعمل بين Marker Studio® و${name} — شروط واضحة ليتفرّغ الطرفان للعمل.`
      ),
      meta: [
        { label: l("Client", "العميل"), value: l(name, name) },
        { label: l("Provider", "مزوّد الخدمة"), value: l("Marker Studio®", "Marker Studio®") },
        { label: l("Package", "الباقة"), value: l(pkg.slice(0, 60), pkg.slice(0, 60)) },
        { label: l("Date", "التاريخ"), value: todayMeta() },
      ],
    },
    summary: {
      kicker: l("Summary", "الملخّص"),
      title: l("The agreement *at a glance*.", "الاتفاقية *بلمحة*."),
      intro: l(
        "The legally binding terms follow in the numbered sections. This page summarises who the parties are and how the engagement is structured.",
        "الشروط الملزمة في البنود المرقّمة التالية. تلخّص هذه الصفحة الطرفين وكيفية تنظيم التعاقد."
      ),
      rows: [
        { label: l("Client", "العميل"), value: l(name, name) },
        { label: l("Client representative", "ممثّل العميل"), value: l(`${rep}${input.phone ? ` · ${input.phone}` : ""}` || "—", `${rep}${input.phone ? ` · ${input.phone}` : ""}` || "—") },
        { label: l("Service provider", "مزوّد الخدمة"), value: l("Marker Studio® · Beit Sahour, Palestine", "Marker Studio® · بيت ساحور، فلسطين") },
        { label: l("Agreement value", "قيمة الاتفاقية"), value: l(value, value) },
        { label: l("Package confirmation", "تأكيد الباقة"), value: l(pkg, pkg) },
        {
          label: l("Payment method", "طريقة الدفع"),
          value: l(
            "Each scope is paid in two parts — 50% before starting and 50% after approval, before the next phase.",
            "كل نطاق يُدفع على جزأين — ٥٠٪ قبل البدء و٥٠٪ بعد الاعتماد، قبل المرحلة التالية."
          ),
        },
      ],
    },
    schedule: {
      enabled: false,
      title: l("Payment schedule", "جدول الدفعات"),
      items: [],
      note: l("All prices are exclusive of VAT.", "جميع الأسعار بدون ضريبة القيمة المضافة."),
    },
    sections: [
      {
        title: l("Parties", "الأطراف"),
        body: [
          l(
            `This Service Agreement is made between Marker Studio®, a creative branding and marketing studio based in Beit Sahour, Palestine (“Studio”), and ${name}${rep ? `, represented by ${rep}` : ""} (“Client”).`,
            `أُبرمت اتفاقية الخدمة هذه بين Marker Studio®، استوديو إبداعي للهوية والتسويق مقرّه بيت ساحور، فلسطين («الاستوديو»)، و${name}${rep ? `، ويمثّله ${rep}` : ""} («العميل»).`
          ),
          l(
            "The effective date of this Agreement is the date of signature by both parties, or the date the first phase advance payment is received, whichever occurs first.",
            "يسري مفعول هذه الاتفاقية من تاريخ توقيع الطرفين، أو تاريخ استلام دفعة المرحلة الأولى المقدّمة، أيهما أسبق."
          ),
        ],
        list: [],
      },
      {
        title: l("Project Purpose", "غرض المشروع"),
        body: [
          l(
            input.purpose || `${name}'s project will be developed into a clear, distinctive brand and launch collection that communicate its identity and goals.`,
            input.purpose || `سيُطوَّر مشروع ${name} إلى علامة واضحة ومميزة ومجموعة إطلاق تعبّران عن هويته وأهدافه.`
          ),
        ],
        list: [],
      },
      {
        title: l("Agreed Scope of Work", "نطاق العمل المتفق عليه"),
        body: [l("The agreed package includes the following deliverables:", "تشمل الباقة المتفق عليها التسليمات التالية:")],
        list: scope.map((s) => l(s, s)),
      },
      {
        title: l("Payment Structure by Scope", "هيكل الدفع حسب النطاق"),
        body: [
          l(
            "Payments are not collected as one large project advance. Instead, each phase is activated by an advance for that phase, then completed by the balance payment after approval of that phase.",
            "لا تُحصَّل الدفعات كمقدّم واحد كبير للمشروع. بل تُفعَّل كل مرحلة بدفعة مقدّمة خاصة بها، وتُستكمل بدفع الرصيد بعد اعتماد تلك المرحلة."
          ),
          l(
            "Each scope is split 50% before the phase starts and 50% after approval of that phase, before moving to the next. A phase starts only after its advance payment is received, and final files for each phase are released after the remaining balance for that phase is paid. All prices are excluding VAT.",
            "يُقسَّم كل نطاق إلى ٥٠٪ قبل بدء المرحلة و٥٠٪ بعد اعتمادها وقبل الانتقال إلى التالية. تبدأ المرحلة فقط بعد استلام دفعتها المقدّمة، وتُسلَّم الملفات النهائية لكل مرحلة بعد سداد رصيدها المتبقي. جميع الأسعار بدون ضريبة القيمة المضافة."
          ),
        ],
        list: [],
      },
      {
        title: l("Timeline and Phase Flow", "الجدول الزمني وتسلسل المراحل"),
        body: [
          l(
            "An estimated timeline is shared once the first phase advance and all required materials, references, feedback, and content are received. Work proceeds phase by phase through branding, designs, website/digital (if included), then final setup and handover.",
            "يُشارَك جدول زمني تقديري بعد استلام دفعة المرحلة الأولى وكل المواد والمراجع والملاحظات والمحتوى المطلوب. يسير العمل مرحلةً بمرحلة عبر الهوية، فالتصاميم، فالموقع/الرقمي (إن وُجد)، ثم الإعداد النهائي والتسليم."
          ),
          l(
            "Delays in feedback, content, approval, access, or required wording may extend the timeline.",
            "قد يمتد الجدول الزمني بسبب التأخير في الملاحظات أو المحتوى أو الاعتماد أو الوصول أو الصياغات المطلوبة."
          ),
        ],
        list: [],
      },
      {
        title: l("Languages and Content Approval", "اللغات واعتماد المحتوى"),
        body: [
          l(
            "Where the package includes written or multilingual content, the Client is responsible for reviewing and approving all final language content, including any specialised, legal, or formal terminology, names, and expressions.",
            "حين تشمل الباقة محتوى مكتوبًا أو متعدد اللغات، يتحمّل العميل مسؤولية مراجعة واعتماد كل المحتوى اللغوي النهائي، بما فيه المصطلحات المتخصصة أو القانونية أو الرسمية والأسماء والتعابير."
          ),
          l(
            "If specialised translation or formal review is required, the Client must provide or approve the wording before launch.",
            "إذا لزمت ترجمة متخصصة أو مراجعة رسمية، على العميل توفير الصياغة أو اعتمادها قبل الإطلاق."
          ),
        ],
        list: [],
      },
      {
        title: l("Revision Policy", "سياسة التعديلات"),
        body: [
          l(
            "The package includes up to two (2) revision rounds per major deliverable stage (e.g. branding, designs, website structure). Additional revision rounds, major direction changes after approval, or new deliverables outside the agreed scope may be priced separately.",
            "تشمل الباقة حتى جولتي تعديل (٢) لكل مرحلة تسليم رئيسية (مثل الهوية، التصاميم، هيكل الموقع). جولات التعديل الإضافية، أو تغييرات الاتجاه الكبرى بعد الاعتماد، أو التسليمات الجديدة خارج النطاق المتفق عليه قد تُسعَّر بشكل منفصل."
          ),
        ],
        list: [],
      },
      {
        title: l("What Is Not Included", "ما لا تشمله الباقة"),
        body: [l("Unless agreed separately in writing, the following are not included in the package:", "ما لم يُتفق عليه كتابةً بشكل منفصل، لا تشمل الباقة ما يلي:")],
        list: [
          l("Manufacturing, embroidery, printing, fabric sourcing, tailoring, or production costs.", "تكاليف التصنيع أو التطريز أو الطباعة أو توريد الأقمشة أو الخياطة أو الإنتاج."),
          l("Photography, videography, models, product styling, or location rental.", "التصوير الفوتوغرافي أو الفيديو أو العارضين أو تنسيق المنتجات أو استئجار المواقع."),
          l("Paid advertising budget, campaign launch execution, or monthly social media management.", "ميزانية الإعلانات المدفوعة أو تنفيذ إطلاق الحملات أو الإدارة الشهرية لوسائل التواصل."),
          l("Domain registration, hosting, premium plugins/apps, payment gateway fees, or external platform subscriptions.", "تسجيل النطاق أو الاستضافة أو الإضافات المدفوعة أو رسوم بوابات الدفع أو اشتراكات المنصات الخارجية."),
          l("E-commerce checkout/payment integration, unless agreed separately.", "تكامل الدفع/السلة للتجارة الإلكترونية، ما لم يُتفق عليه بشكل منفصل."),
          l("Legal registration, trademark registration, or any third-party approvals.", "التسجيل القانوني أو تسجيل العلامة التجارية أو أي موافقات من أطراف ثالثة."),
          l("Additional designs or deliverables beyond the agreed scope.", "تصاميم أو تسليمات إضافية خارج النطاق المتفق عليه."),
        ],
      },
      {
        title: l("Campaign Launch and Marketing", "إطلاق الحملات والتسويق"),
        body: [
          l(
            "Campaign launch plans and monthly marketing management are separate services and are not included unless added by written approval. If selected later, campaign launch support applies to the first month only, while monthly marketing may continue as a separate retainer.",
            "خطط إطلاق الحملات والإدارة التسويقية الشهرية خدمات منفصلة وغير مشمولة ما لم تُضَف بموافقة كتابية. وإن اختيرت لاحقًا، يقتصر دعم إطلاق الحملة على الشهر الأول، بينما قد يستمر التسويق الشهري كاتفاق منفصل."
          ),
        ],
        list: [],
      },
      {
        title: l("Client Responsibilities", "مسؤوليات العميل"),
        body: [
          l(
            "The Client agrees to provide timely feedback, references, brand information, product details, approved content, accuracy guidance, access if needed, and any materials required to complete the project.",
            "يلتزم العميل بتقديم الملاحظات في وقتها، والمراجع، ومعلومات العلامة، وتفاصيل المنتجات، والمحتوى المعتمد، وتوجيهات الدقة، والوصول إن لزم، وأي مواد مطلوبة لإنجاز المشروع."
          ),
          l(
            "The Client also agrees that manufacturing or production should not begin before reviewing and approving the final production-intended files and details.",
            "كما يقرّ العميل بألا يبدأ التصنيع أو الإنتاج قبل مراجعة واعتماد الملفات والتفاصيل النهائية المخصصة للإنتاج."
          ),
        ],
        list: [],
      },
      {
        title: l("Ownership and Usage Rights", "الملكية وحقوق الاستخدام"),
        body: [
          l(
            "Final approved deliverables become the Client's property after full payment for the relevant phase is received. Unused concepts, rejected directions, preliminary drafts, internal working files, and presentation methods remain the intellectual property of Marker Studio® unless otherwise agreed in writing.",
            "تصبح التسليمات النهائية المعتمدة ملكًا للعميل بعد السداد الكامل للمرحلة المعنية. وتبقى الأفكار غير المستخدمة والاتجاهات المرفوضة والمسودات الأولية وملفات العمل الداخلية وأساليب العرض ملكية فكرية لـ Marker Studio® ما لم يُتفق كتابةً على خلاف ذلك."
          ),
          l(
            "The Studio may showcase the completed work in its portfolio, website, and social media after public launch, unless the Client requests confidentiality in writing.",
            "يجوز للاستوديو عرض العمل المنجز في معرض أعماله وموقعه ووسائل تواصله بعد الإطلاق العام، ما لم يطلب العميل السرّية كتابةً."
          ),
        ],
        list: [],
      },
      {
        title: l("Approval and Handover", "الاعتماد والتسليم"),
        body: [
          l(
            "Each phase is reviewed and approved separately. The final files for each approved phase are handed over after the remaining balance for that phase is paid. Full final project handover is completed after all phases are paid in full.",
            "تُراجَع كل مرحلة وتُعتمد على حدة. وتُسلَّم الملفات النهائية لكل مرحلة معتمدة بعد سداد رصيدها المتبقي. ويكتمل التسليم النهائي الكامل للمشروع بعد سداد جميع المراحل بالكامل."
          ),
        ],
        list: [],
      },
      {
        title: l("Cancellation", "الإلغاء"),
        body: [
          l(
            "If the Client cancels the project after a phase has started, payments already made for that phase are non-refundable and will be considered compensation for completed time, planning, and creative work. If the Studio is unable to continue for reasons unrelated to Client delay or non-payment, both parties will agree on a fair settlement based on work completed.",
            "إذا ألغى العميل المشروع بعد بدء مرحلة ما، فإن المدفوعات المسدّدة لتلك المرحلة غير قابلة للاسترداد وتُعتبر تعويضًا عن الوقت والتخطيط والعمل الإبداعي المنجز. وإذا تعذّر على الاستوديو الاستمرار لأسباب لا تتعلق بتأخير العميل أو عدم سداده، يتفق الطرفان على تسوية عادلة بحسب العمل المنجز."
          ),
        ],
        list: [],
      },
    ],
    acceptance: {
      kicker: l("Acceptance", "القبول"),
      title: l("Sign to *begin*.", "وقّع *لنبدأ*."),
      body: l(
        "By signing below, both parties confirm that they understand and accept the scope, package value, phase-based payment terms, responsibilities, and conditions of this Agreement.",
        "بالتوقيع أدناه، يؤكّد الطرفان فهمهما وقبولهما للنطاق وقيمة الباقة وشروط الدفع على مراحل والمسؤوليات وشروط هذه الاتفاقية."
      ),
      stampLine: l(`Beit Sahour, Palestine — ${name} Service Agreement`, `بيت ساحور، فلسطين — اتفاقية خدمة ${name}`),
    },
  };
}

// Build the agreement draft straight from the accepted proposal — no AI step.
// The plans the client confirmed become the package name, their features the
// bilingual scope list, and their prices the payment schedule and agreement
// value. Returns null when no selection was recorded. The standard clauses
// come from defaultAgreementDoc; the studio reviews the draft before sending.
export function agreementDocFromProposal(name: string, data: ClientData): AgreementDoc | null {
  const p = data.proposal;
  const sel = p?.selection;
  if (!sel?.items?.length) return null;

  const plans = p?.doc?.investment?.groups?.flatMap((g) => g.plans) || [];
  const currency = sel.currency || p?.doc?.currency || "₪";
  const fmt = (n: number) => n.toLocaleString("en-US");
  // The selection stores the plan title in whichever language the client was
  // viewing — match back to the proposal's plans for the other language and
  // the feature list.
  const chosen = sel.items.map((it) => ({
    it,
    plan: plans.find((pl) => pl.title.en === it.label || pl.title.ar === it.label),
  }));
  const titleOf = (c: (typeof chosen)[number]): L => c.plan?.title || l(c.it.label, c.it.label);

  const pkg: L = {
    en: chosen.map((c) => titleOf(c).en || titleOf(c).ar).join(" + "),
    ar: chosen.map((c) => titleOf(c).ar || titleOf(c).en).join(" + "),
  };
  const scope: L[] = chosen.flatMap((c) => {
    const features = (c.plan?.features || []).filter((f) => f.en || f.ar);
    return features.length ? features : [titleOf(c)];
  });
  const value: L = {
    en:
      [sel.once ? `${fmt(sel.once)} ${currency} one-time` : "", sel.monthly ? `${fmt(sel.monthly)} ${currency} / month` : ""]
        .filter(Boolean)
        .join(" + ") || "As per the accepted proposal",
    ar:
      [sel.once ? `${fmt(sel.once)} ${currency} دفعة واحدة` : "", sel.monthly ? `${fmt(sel.monthly)} ${currency} شهريًا` : ""]
        .filter(Boolean)
        .join(" + ") || "بحسب العرض المقبول",
  };

  const brief = data.onboarding;
  const doc = defaultAgreementDoc({
    clientName: brief?.brandName || name,
    representative: p?.acceptedBy || (brief ? `${brief.firstName} ${brief.lastName}`.trim() : ""),
    phone: brief?.phone || "",
    purpose: brief?.brandDescription || "",
  });
  doc.currency = currency;

  // Overlay the selection-derived, properly bilingual details on the standard
  // contract (defaultAgreementDoc duplicates one string across both languages).
  const coverPkg = doc.cover.meta.find((m) => m.label.en === "Package");
  if (coverPkg) coverPkg.value = { en: pkg.en.slice(0, 60), ar: pkg.ar.slice(0, 60) };
  for (const row of doc.summary.rows) {
    if (row.label.en === "Agreement value") row.value = value;
    if (row.label.en === "Package confirmation") row.value = pkg;
    // The standard payment-method clause is phase-based (50/50); a purely
    // monthly selection is paid month by month instead.
    if (row.label.en === "Payment method" && sel.monthly && !sel.once) {
      row.value = l(
        "The monthly fee is paid before the start of each service month and activates that month's work.",
        "تُدفع الرسوم الشهرية قبل بداية كل شهر خدمة، وتُفعّل العمل لذلك الشهر."
      );
    }
  }
  doc.schedule.enabled = true;
  doc.schedule.items = chosen.map((c) => ({
    label: titleOf(c),
    amount: `${fmt(c.it.price)} ${currency}${c.it.period === "mo" ? " /mo" : ""}`,
  }));
  const scopeSection = doc.sections.find((s) => s.title.en === "Agreed Scope of Work");
  if (scopeSection) scopeSection.list = scope;
  return doc;
}

// Resolve the doc to render: the saved one, else a default built from the
// client's current data (so a preview always works before any editing).
export function resolveProposalDoc(name: string, data: ClientData): ProposalDoc {
  const saved = (data.proposal as { doc?: ProposalDoc } | undefined)?.doc;
  return saved && saved.v === 1 ? saved : defaultProposalDoc(name, data);
}

export function resolveAgreementDoc(name: string, data: ClientData): AgreementDoc {
  const saved = (data.agreement as { doc?: AgreementDoc } | undefined)?.doc;
  if (saved && saved.v === 1) return saved;
  const fromProposal = agreementDocFromProposal(name, data);
  if (fromProposal) return fromProposal;
  const brief = data.onboarding;
  const extraServices = [
    ...(brief?.services || []).filter((sv) => sv !== "Other"),
    ...(brief?.servicesOther ? [brief.servicesOther] : []),
  ];
  const scope = [...(brief?.planFeatures || []), ...(brief?.marketingFeatures || []), ...extraServices];
  const pricing = data.pricing?.items?.filter((it) => it.label) || [];
  return defaultAgreementDoc({
    clientName: brief?.brandName || name,
    representative: brief ? `${brief.firstName} ${brief.lastName}`.trim() : "",
    phone: brief?.phone || "",
    packageName: [brief?.plan, brief?.marketingPlan, ...extraServices].filter(Boolean).join(" + ") || pricing.map((p) => p.label).join(" + "),
    scope: scope.length ? scope : pricing.map((p) => p.label),
    purpose: brief?.brandDescription || "",
    value: data.agreement?.value || "",
  });
}
