// Project / case-study data + access layer.
//
// This is the single source of truth for the work pages. It is deliberately
// shaped as an access layer (getProjects / getProject / getProjectSlugs) so the
// backing store can later move to a database / admin panel WITHOUT touching the
// pages that consume it — only the bodies of these functions change.
//
// NOTE: the case-study copy below is placeholder/representative. It describes the
// *type* of engagement and does not assert specific performance figures for the
// named clients — swap in real briefs, results, and imagery when available.

import type { Lang } from "@/lib/content";
import { getSql, isDbEnabled } from "@/lib/db";

const W = "https://static.wixstatic.com/media/";

export type Bi = { en: string; ar: string };
export type BiList = { en: string[]; ar: string[] };
export type ProjectMetric = { value: string; label: Bi };

export type Project = {
  slug: string;
  color: string; // brand colour for the hero panel
  logo: string;
  year: string;
  name: Bi;
  tag: Bi; // e.g. "Identity · Hospitality"
  services: BiList;
  deliverables: BiList;
  summary: Bi;
  challenge: Bi;
  approach: Bi;
  results: Bi;
  metrics?: ProjectMetric[];
  gallery?: string[];
};

// Seed data — used as the source when no database is configured, and as the
// import payload for /api/setup when first provisioning the DB.
export const SEED_PROJECTS: Project[] = [
  {
    slug: "canaan-hotel",
    color: "#3B4043",
    logo: `${W}12283c_d440d9b568954fbe897be8e0afb50355~mv2.png`,
    year: "2025",
    name: { en: "Canaan Hotel", ar: "فندق كنعان" },
    tag: { en: "Identity · Hospitality", ar: "هوية · ضيافة" },
    services: {
      en: ["Brand identity", "Art direction", "Print & signage"],
      ar: ["هوية بصرية", "إدارة فنية", "مطبوعات ولافتات"],
    },
    deliverables: {
      en: ["Logo system", "Guidelines", "Signage", "Collateral"],
      ar: ["نظام شعار", "دليل استخدام", "لافتات", "مطبوعات"],
    },
    summary: {
      en: "A warm, bilingual identity for a Palestinian hospitality brand — built to feel at home on a façade, a key card, and an invoice alike.",
      ar: "هوية دافئة ثنائية اللغة لعلامة ضيافة فلسطينية — صُمّمت لتليق بالواجهة، وبطاقة الغرفة، والفاتورة على حدّ سواء.",
    },
    challenge: {
      en: "The hotel needed one identity that reads with equal confidence in Arabic and Latin, across everything from a lobby sign to a social post.",
      ar: "احتاج الفندق إلى هوية واحدة تُقرأ بالثقة ذاتها بالعربية واللاتينية، من لافتة المدخل إلى منشور السوشال.",
    },
    approach: {
      en: "We designed both scripts side by side, set a restrained palette and type system, and documented it so the brand stays consistent in every hand.",
      ar: "صمّمنا النصّين جنباً إلى جنب، ووضعنا لوحة ألوان ونظام خطوط منضبطين، ووثّقناهما كي تبقى الهوية متّسقة في كل يد.",
    },
    results: {
      en: "A cohesive system that scaled cleanly from signage to stationery to social — one brand, two languages, no compromises.",
      ar: "نظام متماسك امتدّ بسلاسة من اللافتات إلى القرطاسية إلى السوشال — علامة واحدة، لغتان، بلا تنازلات.",
    },
  },
  {
    slug: "naji-photography",
    color: "#423891",
    logo: `${W}cf380e_82b0607306e34f4aad85883fab2bb6ea~mv2.png`,
    year: "2024",
    name: { en: "Naji Photography", ar: "ناجي للتصوير" },
    tag: { en: "Identity · Photography", ar: "هوية · تصوير" },
    services: {
      en: ["Brand identity", "Logo design", "Social templates"],
      ar: ["هوية بصرية", "تصميم شعار", "قوالب سوشال"],
    },
    deliverables: {
      en: ["Wordmark", "Watermark", "Social kit"],
      ar: ["شعار نصي", "علامة مائية", "حزمة سوشال"],
    },
    summary: {
      en: "A clean, confident mark for a photographer — a logo that frames the work without ever competing with it.",
      ar: "علامة نظيفة وواثقة لمصوّر — شعار يؤطّر العمل دون أن ينافسه.",
    },
    challenge: {
      en: "A photographer's brand has to disappear behind the images while still being instantly recognisable as a signature.",
      ar: "على هوية المصوّر أن تتوارى خلف الصور مع بقائها توقيعاً يُعرف فوراً.",
    },
    approach: {
      en: "We built a minimal wordmark and a discreet watermark, plus a lightweight template kit so every post stays on-brand.",
      ar: "بنينا شعاراً نصياً مينماليّاً وعلامة مائية خفيّة، مع حزمة قوالب بسيطة كي يبقى كل منشور ضمن الهوية.",
    },
    results: {
      en: "A signature that travels across galleries, prints, and feeds without ever stealing focus from the photography.",
      ar: "توقيع ينتقل بين المعارض والمطبوعات والحسابات دون أن يسرق التركيز من التصوير.",
    },
  },
  {
    slug: "yalla-talk",
    color: "#8238EB",
    logo: `${W}12283c_601e21549c9346269ed3d75da70b1470~mv2.png`,
    year: "2025",
    name: { en: "Yalla Talk", ar: "يلا توك" },
    tag: { en: "Identity · App", ar: "هوية · تطبيق" },
    services: {
      en: ["Product identity", "Iconography", "Launch assets"],
      ar: ["هوية المنتج", "أيقونات", "أصول الإطلاق"],
    },
    deliverables: {
      en: ["App icon", "Brand system", "Store assets"],
      ar: ["أيقونة التطبيق", "نظام الهوية", "أصول المتجر"],
    },
    summary: {
      en: "A friendly, energetic identity for a conversation app — playful enough to invite a tap, sturdy enough to scale.",
      ar: "هوية ودودة ونشطة لتطبيق محادثة — مرحة بما يكفي لتدعو إلى الضغط، ومتينة بما يكفي للتوسّع.",
    },
    challenge: {
      en: "An app brand lives at 1024px and at 48px. It had to stay legible and lively at every size and in both languages.",
      ar: "تعيش هوية التطبيق عند ١٠٢٤ بكسل وعند ٤٨ بكسل. كان عليها أن تبقى واضحة وحيّة بكل الأحجام وباللغتين.",
    },
    approach: {
      en: "We designed an icon-first system with a confident colour and a bilingual type pairing, tuned from the app store down to the smallest UI chip.",
      ar: "صمّمنا نظاماً يبدأ من الأيقونة بلونٍ واثق وتزاوجٍ خطّي ثنائي اللغة، مضبوطاً من متجر التطبيقات إلى أصغر عنصر واجهة.",
    },
    results: {
      en: "A launch-ready identity that feels native on a home screen and consistent across every store and screen.",
      ar: "هوية جاهزة للإطلاق تبدو أصيلة على الشاشة الرئيسية ومتّسقة عبر كل متجر وشاشة.",
    },
  },
  {
    slug: "soap-palestine",
    color: "#522F8D",
    logo: `${W}12283c_b72c18d2c15747fa81962b11389ec7ac~mv2.png`,
    year: "2024",
    name: { en: "SOAP Palestine", ar: "صابون فلسطين" },
    tag: { en: "Identity · Retail", ar: "هوية · تجزئة" },
    services: {
      en: ["Brand identity", "Packaging", "Retail collateral"],
      ar: ["هوية بصرية", "تغليف", "مواد تجزئة"],
    },
    deliverables: {
      en: ["Logo", "Packaging", "Labels", "Social kit"],
      ar: ["شعار", "تغليف", "ملصقات", "حزمة سوشال"],
    },
    summary: {
      en: "A heritage-rooted retail identity — modern on the shelf, proudly Palestinian in the detail.",
      ar: "هوية تجزئة متجذّرة في التراث — عصرية على الرفّ، فلسطينية بفخرٍ في التفاصيل.",
    },
    challenge: {
      en: "The brand needed shelf presence that honours a heritage craft without looking dated next to modern retail.",
      ar: "احتاجت العلامة إلى حضورٍ على الرفّ يحترم حرفة تراثية دون أن يبدو قديماً بجانب التجزئة الحديثة.",
    },
    approach: {
      en: "We balanced a contemporary system with heritage cues, then carried it onto packaging built to be picked up.",
      ar: "وازنّا بين نظام معاصر ولمسات تراثية، ثم نقلناه إلى تغليفٍ صُمّم ليُلتقط باليد.",
    },
    results: {
      en: "A retail identity that stands out on the shelf and stands for where it comes from.",
      ar: "هوية تجزئة تبرز على الرفّ وتعبّر عن المكان الذي جاءت منه.",
    },
  },
  {
    slug: "chocolatji",
    color: "#133832",
    logo: `${W}12283c_a743ed71fef7466f86fb26143b665db8~mv2.png`,
    year: "2025",
    name: { en: "Chocolatji", ar: "تشوكولاتجي" },
    tag: { en: "Identity · F&B", ar: "هوية · مأكولات" },
    services: {
      en: ["Brand identity", "Packaging", "Social & content"],
      ar: ["هوية بصرية", "تغليف", "محتوى وسوشال"],
    },
    deliverables: {
      en: ["Logo system", "Packaging", "Menu", "Social kit"],
      ar: ["نظام شعار", "تغليف", "قائمة", "حزمة سوشال"],
    },
    summary: {
      en: "An indulgent, appetite-first identity for a chocolate brand — rich, tactile, and made to be shared.",
      ar: "هوية شهيّة تضع الرغبة أولاً لعلامة شوكولاتة — غنيّة، ملموسة، ومصنوعة لتُشارَك.",
    },
    challenge: {
      en: "Food brands win or lose in the first glance. The identity had to look as good as the product tastes — in both languages.",
      ar: "تُربح علامات الطعام أو تُخسر في النظرة الأولى. كان على الهوية أن تبدو بجودة طعم المنتج — وباللغتين.",
    },
    approach: {
      en: "We built a warm, tactile system across packaging and a content kit tuned for reels-first, appetite-driven social.",
      ar: "بنينا نظاماً دافئاً وملموساً عبر التغليف وحزمة محتوى مضبوطة لسوشال يعتمد الريلز ويثير الشهية.",
    },
    results: {
      en: "A brand that looks delicious on a box and on a feed — consistent, craveable, and unmistakably its own.",
      ar: "علامة تبدو لذيذة على العلبة وعلى الحساب — متّسقة، مثيرة للرغبة، ومميّزة لا تُخطئ.",
    },
  },
];

// Map a DB row to a Project. Bilingual fields live in a JSONB `data` column.
type ProjectRow = {
  slug: string;
  color: string;
  logo: string;
  year: string;
  data: Omit<Project, "slug" | "color" | "logo" | "year">;
};

function rowToProject(r: ProjectRow): Project {
  return { slug: r.slug, color: r.color, logo: r.logo, year: r.year, ...r.data };
}

export async function getProjects(): Promise<Project[]> {
  if (!isDbEnabled()) return SEED_PROJECTS;
  try {
    const sql = getSql();
    const rows = (await sql`
      SELECT slug, color, logo, year, data FROM projects ORDER BY sort_order ASC, created_at ASC
    `) as unknown as ProjectRow[];
    // Before setup runs the table is empty/missing — fall back to seed so the
    // public site never breaks.
    return rows.length ? rows.map(rowToProject) : SEED_PROJECTS;
  } catch (err) {
    console.error("[projects] DB read failed, using seed data:", err);
    return SEED_PROJECTS;
  }
}

export async function getProject(slug: string): Promise<Project | undefined> {
  if (!isDbEnabled()) return SEED_PROJECTS.find((p) => p.slug === slug);
  try {
    const sql = getSql();
    const rows = (await sql`
      SELECT slug, color, logo, year, data FROM projects WHERE slug = ${slug} LIMIT 1
    `) as unknown as ProjectRow[];
    if (rows[0]) return rowToProject(rows[0]);
    // Table reachable but row missing — fall back to seed (covers pre-setup).
    return SEED_PROJECTS.find((p) => p.slug === slug);
  } catch (err) {
    console.error("[projects] DB read failed, using seed data:", err);
    return SEED_PROJECTS.find((p) => p.slug === slug);
  }
}

export async function getProjectSlugs(): Promise<string[]> {
  const projects = await getProjects();
  return projects.map((p) => p.slug);
}

// The next project in the list (wraps around) for "next project" links.
export async function getNextProject(slug: string): Promise<Project> {
  const projects = await getProjects();
  const i = projects.findIndex((p) => p.slug === slug);
  return projects[(i + 1) % projects.length];
}

// Split the immutable columns from the bilingual JSON blob for DB writes.
export function toRow(p: Project): { slug: string; color: string; logo: string; year: string; data: Omit<Project, "slug" | "color" | "logo" | "year"> } {
  const { slug, color, logo, year, ...data } = p;
  return { slug, color, logo, year, data };
}

// Pick a localized field.
export function bi(value: Bi, lang: Lang): string {
  return value[lang];
}
