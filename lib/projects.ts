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
export type Swatch = { hex: string; name: Bi };

export type Project = {
  slug: string;
  color: string; // brand colour for the hero panel
  accent?: string; // accent colour (numbers, eyebrows) when it differs from the hero colour
  keepLogoColor?: boolean; // don't invert the logo to white (it's already colourful)
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
  palette?: Swatch[]; // colour system
  metrics?: ProjectMetric[];
  gallery?: string[];
};

// Seed data — used as the source when no database is configured, and as the
// import payload for /api/setup when first provisioning the DB.
export const SEED_PROJECTS: Project[] = [
  {
    slug: "cookiefries",
    color: "#121316",
    accent: "#F72585",
    keepLogoColor: true,
    logo: "/assets/work/cookiefries/logo-lockup.png",
    year: "2026",
    name: { en: "CookieFries®", ar: "كوكي فرايز" },
    tag: { en: "Brand identity · Packaged snack", ar: "هوية بصرية · سناك مغلّف" },
    services: {
      en: ["Brand strategy", "Logo & mascot system", "Packaging", "Bilingual typography"],
      ar: ["استراتيجية العلامة", "نظام الشعار والماسكوت", "التغليف", "طباعة ثنائية اللغة"],
    },
    deliverables: {
      en: ["Visual identity guidelines", "Mascot system", "Packaging", "Brand-in-action"],
      ar: ["دليل الهوية البصرية", "نظام الماسكوت", "التغليف", "تطبيقات العلامة"],
    },
    summary: {
      en: "A packaged snack that reimagines the cookie as a thin, crispy stick — built for the shelf, not the bakery. A bold, mascot-led identity made to win at first glance, in Arabic and English.",
      ar: "سناك مغلّف يعيد تخيّل الكوكي على شكل أصابع رفيعة ومقرمشة — مصمّم للرفّ لا للمخبز. هوية جريئة يقودها الماسكوت لتكسب من النظرة الأولى، بالعربية والإنجليزية.",
    },
    challenge: {
      en: "People don't want better cookies — they want something new to try. Cookie Fries had to compete with snacks, not the bakery aisle, and win on impulse: instantly recognisable and instantly readable on a crowded shelf.",
      ar: "الناس لا يريدون كوكيز أفضل — يريدون شيئاً جديداً يجرّبونه. كان على كوكي فرايز أن ينافس السناكات لا رفّ المخبوزات، وأن يكسب باللحظة: حضورٌ ووضوحٌ فوريّان على رفٍّ مزدحم.",
    },
    approach: {
      en: "We turned a familiar product into a new behaviour: cookies shaped like fries — easier to grab, share, and snack on. A circular mascot with a fries-crown leads a bold, high-contrast system, paired with a bilingual type voice (Early Sans + FF Hekaya) that stays playful without being childish.",
      ar: "حوّلنا منتجاً مألوفاً إلى سلوكٍ جديد: كوكيز بشكل البطاطا — أسهل للإمساك والمشاركة والتناول. ماسكوت دائري بتاجٍ من الأصابع يقود نظاماً جريئاً عالي التباين، مع صوتٍ طباعيّ ثنائي اللغة (إيرلي سانس + حكاية) يبقى مرحاً دون أن يكون طفولياً.",
    },
    results: {
      en: "A complete identity that's bold, clean, and instantly readable — from packaging and patterns to a neon storefront and stationery. One playful character, two languages, zero visual noise.",
      ar: "هوية متكاملة جريئة ونظيفة وواضحة فوراً — من التغليف والنقوش إلى لافتة نيون وواجهة قرطاسية. شخصية مرحة واحدة، لغتان، وبلا ضجيج بصري.",
    },
    palette: [
      { hex: "#4CC9F0", name: { en: "Main Blue", ar: "الأزرق الأساسي" } },
      { hex: "#F72585", name: { en: "Pink", ar: "الزهري" } },
      { hex: "#111111", name: { en: "Black", ar: "الأسود" } },
      { hex: "#FFFFFF", name: { en: "White", ar: "الأبيض" } },
    ],
    gallery: [
      "/assets/work/cookiefries/neon.jpg",
      "/assets/work/cookiefries/billboard.jpg",
      "/assets/work/cookiefries/stationery.jpg",
      "/assets/work/cookiefries/pattern.png",
    ],
  },
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
  {
    slug: "bint-al-balad",
    color: "#8C1D2C",
    accent: "#C7A17A",
    logo: "/assets/clients/bint-al-balad.png",
    year: "2025",
    name: { en: "Bint Al Balad", ar: "بنت البلد" },
    tag: { en: "Brand identity · Heritage fashion", ar: "هوية بصرية · أزياء تراثية" },
    services: {
      en: ["Brand strategy", "Logomark & wordmark", "Arabic lettering", "Brand guidelines"],
      ar: ["استراتيجية العلامة", "شعار ورمز", "حروفية عربية", "دليل الهوية"],
    },
    deliverables: {
      en: ["Visual identity", "Logo lockups", "Colour & type system", "Brand-in-action"],
      ar: ["هوية بصرية", "تركيبات الشعار", "نظام الألوان والخطوط", "تطبيقات العلامة"],
    },
    summary: {
      en: "A personal fashion practice rooted in Beit Sahour, where Tatreez is treated not as decoration but as language — Bethlehem embroidery reinterpreted through modern silhouettes, restraint, and a quiet, confident identity.",
      ar: "ممارسة أزياء شخصية متجذّرة في بيت ساحور، حيث التطريز ليس زينة بل لغة — تطريز بيت لحم يُعاد تأويله عبر قَصّات حديثة وانضباط وهوية هادئة وواثقة.",
    },
    challenge: {
      en: "How do you carry Bethlehem Tatreez into a contemporary wardrobe without freezing it as costume? The brand needed an identity that honours stitch logic and symbolism, yet reads as modern fashion — heritage as design discipline, not nostalgia.",
      ar: "كيف تنقل تطريز بيت لحم إلى خزانة معاصرة دون أن يتجمّد كزيٍّ تراثي؟ احتاجت العلامة إلى هوية تحترم منطق الغرزة ورمزيتها، وتُقرأ في الوقت ذاته كأزياء حديثة — التراث بوصفه انضباطاً تصميمياً لا حنيناً.",
    },
    approach: {
      en: "We distilled the Bethlehem flower and star into a single, balanced mark — refined for clarity and structural harmony while keeping its Tatreez logic. A restrained palette of deep reds, warm neutrals, and grounded darks pairs with clean, modern Arabic lettering, so the craft leads and the type never competes.",
      ar: "اختزلنا زهرة بيت لحم ونجمتها في رمزٍ واحد متوازن — مُنقّى للوضوح والانسجام البنيوي مع الحفاظ على منطق التطريز. تتكامل لوحة منضبطة من الأحمر العميق والمحايدات الدافئة والدرجات الداكنة مع حروفية عربية حديثة ونظيفة، فتتقدّم الحرفة ولا يزاحمها الخط.",
    },
    results: {
      en: "A flexible signature that lives across woven labels, embroidery, packaging, storefronts, and digital — a timeless mark rooted in Bethlehem, refined for today. Fashion that carries memory without becoming costume.",
      ar: "توقيعٌ مرنٌ يعيش على البطاقات المنسوجة والتطريز والتغليف والواجهات والرقمي — علامةٌ خالدة متجذّرة في بيت لحم ومُنقّاة لليوم. أزياءٌ تحمل الذاكرة دون أن تتحوّل إلى زيٍّ تراثي.",
    },
    palette: [
      { hex: "#8C1D2C", name: { en: "Heritage Red", ar: "الأحمر التراثي" } },
      { hex: "#C7A17A", name: { en: "Warm Tan", ar: "البيج الدافئ" } },
      { hex: "#2B2622", name: { en: "Grounded Dark", ar: "الداكن الراسخ" } },
      { hex: "#EDE8E0", name: { en: "Natural Cream", ar: "الكريمي الطبيعي" } },
    ],
    gallery: [
      "/assets/work/bint-al-balad/g1.jpg",
      "/assets/work/bint-al-balad/g2.jpg",
      "/assets/work/bint-al-balad/g3.jpg",
      "/assets/work/bint-al-balad/g4.jpg",
    ],
  },
  {
    slug: "365-detox",
    color: "#1F6E3C",
    accent: "#C2D92E",
    logo: "/assets/clients/365-detox.png",
    year: "2025",
    name: { en: "365 Detox", ar: "365 ديتوكس" },
    tag: { en: "Rebrand · Health & wellness", ar: "إعادة علامة · صحة وعافية" },
    services: {
      en: ["Brand strategy", "Logo redesign", "Packaging", "Visual system"],
      ar: ["استراتيجية العلامة", "إعادة تصميم الشعار", "التغليف", "النظام البصري"],
    },
    deliverables: {
      en: ["Logo system", "Colour palette", "Packaging & labels", "Brand-in-action"],
      ar: ["نظام الشعار", "لوحة الألوان", "تغليف وملصقات", "تطبيقات العلامة"],
    },
    summary: {
      en: "Where wellness meets flavour. A reintroduction for a health-driven food and juice brand — nutrient-packed blends and clean, bold design that makes better living feel premium, in every bite and sip.",
      ar: "حيث تلتقي العافية بالنكهة. إعادة تقديم لعلامة أطعمة وعصائر صحية — خلطات غنية بالعناصر وتصميم نظيف وجريء يجعل الحياة الأفضل تبدو فاخرة، في كل قضمة ورشفة.",
    },
    challenge: {
      en: "The original “365” felt generic and dated — a literal take on the name that no longer matched the quality inside the bottle. The brand needed to keep its recognition while moving to a premium, health-conscious identity that prints cleanly and scales everywhere.",
      ar: "بدا «365» الأصلي عامّاً وقديماً — تعبيرٌ حرفيٌّ عن الاسم لم يعد يضاهي جودة ما في الزجاجة. احتاجت العلامة إلى الحفاظ على تميّزها مع الانتقال إلى هوية فاخرة وواعية للصحة تُطبع بنظافة وتتوسّع في كل مكان.",
    },
    approach: {
      en: "We preserved the “365” core but distilled it into a unified, geometric mark — clean vitality: refined forms, crisp contrast, and a fresh palette of leafy greens, zesty citrus, and earthy neutrals. The simplified icon works as a bold standalone, while the full lockup keeps clarity across packaging, labels, and social.",
      ar: "حافظنا على جوهر «365» لكن اختزلناه في رمزٍ هندسيٍّ موحّد — حيويةٌ نظيفة: أشكالٌ مُنقّاة وتباينٌ حادّ ولوحةٌ منعشة من الأخضر الورقي والحمضيات والمحايدات الترابية. تعمل الأيقونة المبسّطة كعلامة مستقلة جريئة، بينما يحفظ التركيب الكامل الوضوح عبر التغليف والملصقات والسوشال.",
    },
    results: {
      en: "A scalable system built for real touchpoints — from juice bottles and kraft meal boxes to labels and merch — that feels fresh, premium, and unmistakably 365. Recognition kept, perception elevated.",
      ar: "نظامٌ قابلٌ للتوسّع مبنيٌّ لنقاط تماسٍ حقيقية — من زجاجات العصير وعلب الطعام الكرافت إلى الملصقات والمنتجات — يبدو منعشاً وفاخراً و«365» بلا التباس. تميّزٌ محفوظ وإدراكٌ مُرتقى.",
    },
    palette: [
      { hex: "#1F6E3C", name: { en: "Leaf Green", ar: "الأخضر الورقي" } },
      { hex: "#C2D92E", name: { en: "Citrus", ar: "الحمضي" } },
      { hex: "#6F5A3A", name: { en: "Earthy Neutral", ar: "المحايد الترابي" } },
      { hex: "#141414", name: { en: "Charcoal", ar: "الفحمي" } },
    ],
    gallery: [
      "/assets/work/365-detox/g1.jpg",
      "/assets/work/365-detox/g2.jpg",
      "/assets/work/365-detox/g3.jpg",
      "/assets/work/365-detox/g4.jpg",
    ],
  },
  {
    slug: "aya-deeb",
    color: "#D63B7C",
    accent: "#1A1A1A",
    logo: "/assets/clients/aya-deeb.png",
    year: "2025",
    name: { en: "Aya Deeb", ar: "آية ديب" },
    tag: { en: "Personal brand · Fitness", ar: "علامة شخصية · لياقة" },
    services: {
      en: ["Brand strategy", "Logo & monogram", "Visual system", "Social templates"],
      ar: ["استراتيجية العلامة", "شعار ورمز", "النظام البصري", "قوالب سوشال"],
    },
    deliverables: {
      en: ["Logo system", "Colour & type", "Brand-in-action", "Social kit"],
      ar: ["نظام الشعار", "الألوان والخطوط", "تطبيقات العلامة", "حزمة سوشال"],
    },
    summary: {
      en: "Where strength meets balance. A personal-trainer identity for a coach who guides women and children — calm, intentional, and confident, built to feel as grounded as the journey itself.",
      ar: "حيث تلتقي القوة بالتوازن. هوية مدرّبة شخصية لمن ترافق النساء والأطفال — هادئة ومقصودة وواثقة، مصمّمة لتبدو راسخة كرحلة التدريب نفسها.",
    },
    challenge: {
      en: "Aya coaches women and children through a journey that is gentle yet powerful. The brand had to hold both at once — a space that feels safe and supportive, but strong and transformational — without tipping into either softness or aggression.",
      ar: "ترافق آية النساء والأطفال في رحلةٍ لطيفةٍ وقويةٍ في آن. كان على العلامة أن تجمع الطرفين معاً — مساحةٌ آمنةٌ وداعمة، لكنها قويةٌ ومحوِّلة — دون أن تنزلق إلى الليونة المفرطة أو الحدّة.",
    },
    approach: {
      en: "We abstracted stacked stones — balance, growth, and grounded strength — into a clean, fluid mark that is soft and bold at once. Paired with a confident pink and calm neutrals, the system stays harmonious from gym walls to social posts, standalone icon or full logo.",
      ar: "جرّدنا الحجارة المتراصّة — التوازن والنموّ والقوة الراسخة — في رمزٍ نظيفٍ وانسيابيٍّ ناعمٍ وجريءٍ معاً. ومع زهريٍّ واثقٍ ومحايداتٍ هادئة، يبقى النظام متناغماً من جدران الصالة إلى منشورات السوشال، أيقونةً مستقلة أو شعاراً كاملاً.",
    },
    results: {
      en: "An identity that mirrors the brand’s personality — calm strength with clear readability across every touchpoint. A space where progress is paired with care, and every step forward feels grounded.",
      ar: "هوية تعكس شخصية العلامة — قوةٌ هادئةٌ ووضوحٌ في القراءة عبر كل نقطة تماس. مساحةٌ يقترن فيها التقدّم بالعناية، ويبدو فيها كل خطوةٍ إلى الأمام راسخة.",
    },
    palette: [
      { hex: "#D63B7C", name: { en: "Signature Pink", ar: "الزهري المميّز" } },
      { hex: "#F4C3D6", name: { en: "Soft Blush", ar: "الوردي الناعم" } },
      { hex: "#1A1A1A", name: { en: "Strong Black", ar: "الأسود القوي" } },
      { hex: "#F2EFEA", name: { en: "Calm Neutral", ar: "المحايد الهادئ" } },
    ],
    gallery: [
      "/assets/work/aya-deeb/g1.jpg",
      "/assets/work/aya-deeb/g2.jpg",
      "/assets/work/aya-deeb/g3.jpg",
      "/assets/work/aya-deeb/g4.jpg",
    ],
  },
  {
    slug: "chef-chocolate",
    color: "#2D1F1A",
    accent: "#D2A679",
    logo: "/assets/clients/chef-chocolate.png",
    year: "2026",
    name: { en: "Chef Chocolate", ar: "شيف شوكولت" },
    tag: { en: "Brand book · Chocolate & gifts", ar: "دليل علامة · شوكولا وهدايا" },
    services: {
      en: ["Brand identity", "Logo system", "Packaging direction", "Brand book"],
      ar: ["هوية بصرية", "نظام الشعار", "توجيه التغليف", "دليل العلامة"],
    },
    deliverables: {
      en: ["Logo & wordmark", "Colour & type system", "Illustration & icons", "Brand guidelines"],
      ar: ["شعار وكلمة", "نظام الألوان والخطوط", "رسوم وأيقونات", "دليل الهوية"],
    },
    summary: {
      en: "More than chocolate — an indulgence that connects tradition with modern elegance. A complete brand book for a luxury chocolate, sweets, and gifts house, where every bar tells a story.",
      ar: "أكثر من شوكولا — متعةٌ تصل التقليد بالأناقة الحديثة. دليل علامة متكامل لدار شوكولا وحلويات وهدايا فاخرة، حيث يحكي كل لوحٍ حكاية.",
    },
    challenge: {
      en: "Chef Chocolate needed a single source of truth — a brand book that preserves the essence of who they are and keeps the identity looking, sounding, and feeling consistent across packaging, social, store experiences, and events.",
      ar: "احتاجت شيف شوكولت إلى مرجعٍ واحد — دليل علامة يحفظ جوهر هويتها ويُبقي مظهرها وصوتها وإحساسها متّسقاً عبر التغليف والسوشال وتجربة المتجر والفعاليات.",
    },
    approach: {
      en: "At the heart is a logo mark of smooth, flowing chocolate forming a heart — craft with love, precision, and elegance. We built it out into wordmark and lockups, a warm palette of espresso, cocoa, caramel, and cream, plus type, illustration, and icon systems documented for every touchpoint.",
      ar: "في القلب رمزٌ من شوكولا انسيابية تتشكّل على هيئة قلب — حرفةٌ بحبٍّ ودقةٍ وأناقة. طوّرناه إلى كلمةٍ وتركيبات، ولوحةٍ دافئة من الإسبريسو والكاكاو والكراميل والكريمي، مع أنظمة خطوطٍ ورسومٍ وأيقوناتٍ موثّقة لكل نقطة تماس.",
    },
    results: {
      en: "A cohesive, premium identity system — luxury rooted in craft — that adapts across formats while staying unmistakably Chef Chocolate, from a chocolate bar to a gift box to a storefront.",
      ar: "نظام هوية متماسك وفاخر — فخامةٌ متجذّرة في الحرفة — يتكيّف عبر الصيغ مع بقائه شيف شوكولت بلا التباس، من لوح الشوكولا إلى علبة الهدية إلى الواجهة.",
    },
    palette: [
      { hex: "#2D1F1A", name: { en: "Espresso", ar: "الإسبريسو" } },
      { hex: "#6F4E37", name: { en: "Cocoa", ar: "الكاكاو" } },
      { hex: "#D2A679", name: { en: "Caramel", ar: "الكراميل" } },
      { hex: "#F7EFE5", name: { en: "Cream", ar: "الكريمي" } },
    ],
    gallery: [
      "/assets/work/chef-chocolate/g1.jpg",
      "/assets/work/chef-chocolate/g2.jpg",
      "/assets/work/chef-chocolate/g3.jpg",
      "/assets/work/chef-chocolate/g4.jpg",
    ],
  },
  {
    slug: "blok",
    color: "#17181C",
    accent: "#E5362C",
    keepLogoColor: true,
    logo: "/assets/clients/blok.png",
    year: "2026",
    name: { en: "BLOK", ar: "بلوك" },
    tag: { en: "Brand identity · Healthy food", ar: "هوية بصرية · طعام صحي" },
    services: {
      en: ["Logo concept", "Identity system", "Packaging direction", "Scalability rules"],
      ar: ["مفهوم الشعار", "نظام الهوية", "توجيه التغليف", "قواعد التوسّع"],
    },
    deliverables: {
      en: ["Logo system", "One identity, many contexts", "Application mockups", "Concept validation"],
      ar: ["نظام الشعار", "هوية واحدة، سياقات عدّة", "نماذج تطبيق", "التحقق من المفهوم"],
    },
    summary: {
      en: "A new way to eat a meal out. BLOK is the answer to the lack of time that stops people choosing healthy food during the working day — a bold, system-built identity made to win on shelf in seconds.",
      ar: "طريقةٌ جديدة لتناول وجبةٍ خارج البيت. بلوك هو الحلّ لضيق الوقت الذي يمنع الناس من اختيار طعامٍ صحيٍّ خلال يوم العمل — هوية جريئة مبنية كنظام لتكسب على الرفّ في ثوانٍ.",
    },
    challenge: {
      en: "The identity had four jobs: stand out instantly on shelf, communicate without thinking, scale across many products as one system, and feel intentional — never decorative. Every cut, colour, and shape had to earn its place.",
      ar: "كان على الهوية أن تؤدّي أربع مهام: أن تبرز فوراً على الرفّ، وتتواصل دون تفكير، وتتوسّع عبر منتجاتٍ كثيرة كنظامٍ واحد، وتبدو مقصودة — لا زخرفية. كان على كل قَطعٍ ولونٍ وشكلٍ أن يستحقّ مكانه.",
    },
    approach: {
      en: "We started from a simple block — structure, focus, intent — then disrupted it with a single controlled cut that introduces movement and direction. The result is a forward-moving mark about action: breaking routine, taking a moment, fuelling the day. One system, many flavours, always recognisable.",
      ar: "انطلقنا من «بلوك» بسيط — بنيةٌ وتركيزٌ ونيّة — ثم كسرناه بقَطعٍ واحدٍ محكوم يُدخل الحركة والاتجاه. النتيجة علامةٌ متقدّمة تتمحور حول الفعل: كسر الروتين، اقتطاع لحظة، وقود اليوم. نظامٌ واحد، نكهاتٌ عدّة، وتميّزٌ دائم.",
    },
    results: {
      en: "A clear, scalable identity validated to stand out, communicate fast, and perform on shelf — a unified system that keeps every product consistent and easy to pick, ready for full packaging rollout.",
      ar: "هوية واضحة قابلة للتوسّع، جرى التحقق منها لتبرز وتتواصل بسرعة وتنجح على الرفّ — نظامٌ موحّد يُبقي كل منتجٍ متّسقاً وسهل الاختيار، جاهزٌ لإطلاق التغليف الكامل.",
    },
    palette: [
      { hex: "#E5362C", name: { en: "Signal Red", ar: "الأحمر الإشاري" } },
      { hex: "#FDBB03", name: { en: "Amber", ar: "الكهرماني" } },
      { hex: "#17181C", name: { en: "Ink", ar: "الحبري" } },
      { hex: "#F4F1EA", name: { en: "Off-White", ar: "الأبيض المكسور" } },
    ],
    gallery: [
      "/assets/work/blok/g1.jpg",
      "/assets/work/blok/g2.jpg",
      "/assets/work/blok/g3.jpg",
    ],
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
