// Service walkthrough content — powers the interactive /services/[slug] pages
// reached from the "Read more" links on the home page Services section.
// Bilingual EN/AR by default, matching the rest of the site.

export type L = { en: string; ar: string };

export type ServiceStep = {
  num: string;
  title: L;
  desc: L;
  bullets: L[];
};

export type ServiceDetail = {
  slug: string;
  num: string;
  name: L;
  eyebrow: L;
  tagline: L;
  intro: L;
  steps: ServiceStep[];
  deliverables: L[];
  outcome: L;
};

const l = (en: string, ar: string): L => ({ en, ar });

export const SERVICES: ServiceDetail[] = [
  {
    slug: "brand-identity",
    num: "01",
    name: l("Brand identity", "هوية العلامة"),
    eyebrow: l("Service 01", "الخدمة 01"),
    tagline: l(
      "Naming, logos, and a visual system built to last.",
      "اسمٌ وشعارٌ ونظامٌ بصريٌّ مبنيٌّ ليبقى."
    ),
    intro: l(
      "We design identities that work everywhere your brand shows up — the storefront, the feed, the merch, and the invoice. Bilingual by default, in Arabic and Latin at once.",
      "نصمّم هويّاتٍ تعمل أينما ظهرت علامتك — الواجهة، والمنشور، والمنتج، والفاتورة. ثنائية اللغة افتراضيًا، بالعربية واللاتينية معًا."
    ),
    steps: [
      {
        num: "01",
        title: l("Discover", "الاكتشاف"),
        desc: l(
          "We read your room — market, audience, competitors, and what your brand already means.",
          "نقرأ محيطك — السوق والجمهور والمنافسين وما تعنيه علامتك أصلًا."
        ),
        bullets: [
          l("Stakeholder & market interviews", "مقابلات مع أصحاب القرار والسوق"),
          l("Competitive & visual audit", "تحليل المنافسين والمشهد البصري"),
          l("Positioning & moodboard", "التموضع ولوحة الإلهام"),
        ],
      },
      {
        num: "02",
        title: l("Define", "التحديد"),
        desc: l(
          "We commit to a direction — the name, the voice, and the creative territory worth betting on.",
          "نلتزم باتجاه — الاسم والصوت والمساحة الإبداعية التي تستحق الرهان."
        ),
        bullets: [
          l("Naming & messaging", "التسمية والرسائل"),
          l("Brand strategy & voice", "استراتيجية العلامة وصوتها"),
          l("Art direction", "التوجيه الفني"),
        ],
      },
      {
        num: "03",
        title: l("Design", "التصميم"),
        desc: l(
          "We build the full identity system — logo, type, color, and the rules that hold it together.",
          "نبني نظام الهوية الكامل — الشعار والخط واللون والقواعد التي تجمعها."
        ),
        bullets: [
          l("Logo & mark", "الشعار والعلامة"),
          l("Typography & color system", "نظام الخطوط والألوان"),
          l("Applications & templates", "التطبيقات والقوالب"),
        ],
      },
      {
        num: "04",
        title: l("Deliver", "التسليم"),
        desc: l(
          "We hand over a complete, documented kit — and the guidelines to keep it consistent.",
          "نسلّم حقيبة كاملة وموثّقة — مع دليلٍ يحافظ على اتساقها."
        ),
        bullets: [
          l("Brand guidelines", "دليل العلامة"),
          l("Asset & file handoff", "تسليم الملفات والأصول"),
          l("Launch support", "دعم الإطلاق"),
        ],
      },
    ],
    deliverables: [
      l("Logo suite", "مجموعة الشعارات"),
      l("Brand guidelines (PDF)", "دليل العلامة (PDF)"),
      l("Typography & color system", "نظام الخطوط والألوان"),
      l("Social & print templates", "قوالب للسوشال والطباعة"),
      l("Bilingual lockups", "صيغ ثنائية اللغة"),
    ],
    outcome: l(
      "A brand that stays marked — consistent in every language and every place it appears.",
      "علامةٌ تبقى موسومة — متّسقة في كل لغة وكل مكان تظهر فيه."
    ),
  },
  {
    slug: "social-content",
    num: "02",
    name: l("Social & content", "السوشال والمحتوى"),
    eyebrow: l("Service 02", "الخدمة 02"),
    tagline: l(
      "Reels-first content that moves the funnel, not just the feed.",
      "محتوى يبدأ بالريلز ويحرّك المسار، لا المنشورات فقط."
    ),
    intro: l(
      "We run your social like a funnel — reach to profile-visit to follower to inquiry — and report every number, every month.",
      "ندير سوشالك كمسارٍ متكامل — من الوصول إلى زيارة الملف إلى المتابعة إلى الاستفسار — ونوثّق كل رقمٍ كل شهر."
    ),
    steps: [
      {
        num: "01",
        title: l("Audit", "التدقيق"),
        desc: l(
          "We map where you stand today — content, engagement, and the gaps in your funnel.",
          "نرسم موقعك اليوم — المحتوى والتفاعل والفجوات في مسارك."
        ),
        bullets: [
          l("Account & funnel audit", "تدقيق الحساب والمسار"),
          l("Audience & competitor scan", "مسح الجمهور والمنافسين"),
          l("Content gap analysis", "تحليل فجوات المحتوى"),
        ],
      },
      {
        num: "02",
        title: l("Strategy", "الاستراتيجية"),
        desc: l(
          "We set a reels-first plan — pillars, cadence, and the CTAs that turn views into inquiries.",
          "نضع خطةً تبدأ بالريلز — محاور ووتيرة ودعواتٍ تحوّل المشاهدات إلى استفسارات."
        ),
        bullets: [
          l("Content pillars & calendar", "محاور المحتوى والتقويم"),
          l("Reels-first creative plan", "خطة إبداعية تبدأ بالريلز"),
          l("Funnel & CTA mapping", "رسم المسار والدعوات"),
        ],
      },
      {
        num: "03",
        title: l("Produce", "الإنتاج"),
        desc: l(
          "Weekly content sprints — shoot, edit, write, and ship, tested as we go.",
          "دفعات إنتاج أسبوعية — تصوير وتحرير وكتابة ونشر، مع اختبارٍ مستمر."
        ),
        bullets: [
          l("Content direction & shoots", "توجيه المحتوى والتصوير"),
          l("Editing & copy", "التحرير والكتابة"),
          l("Weekly publishing", "النشر الأسبوعي"),
        ],
      },
      {
        num: "04",
        title: l("Amplify & report", "التضخيم والتقرير"),
        desc: l(
          "We dial in paid amplification and report the funnel monthly — then tune the next sprint.",
          "نضبط التضخيم المدفوع ونرفع تقرير المسار شهريًا — ثم نضبط الدفعة التالية."
        ),
        bullets: [
          l("Paid amplification", "التضخيم المدفوع"),
          l("Monthly funnel report", "تقرير المسار الشهري"),
          l("Continuous optimization", "تحسينٌ مستمر"),
        ],
      },
    ],
    deliverables: [
      l("Monthly content calendar", "تقويم محتوى شهري"),
      l("Reels & static creative", "ريلز وتصاميم ثابتة"),
      l("Captions & copy (bilingual)", "نصوص ثنائية اللغة"),
      l("Paid campaign management", "إدارة الحملات المدفوعة"),
      l("Monthly performance report", "تقرير أداء شهري"),
    ],
    outcome: l(
      "A feed that compounds — measured from reach all the way to inquiry.",
      "حضورٌ يتراكم — مقيسٌ من الوصول حتى الاستفسار."
    ),
  },
  {
    slug: "campaigns",
    num: "03",
    name: l("Campaigns", "الحملات"),
    eyebrow: l("Service 03", "الخدمة 03"),
    tagline: l(
      "Launch creative built around one idea, measured by what it sells.",
      "إبداعُ إطلاقٍ مبنيٌّ على فكرةٍ واحدة، يُقاس بما يبيعه."
    ),
    intro: l(
      "Seasonal pushes, launches, and partner activations — built around a single clear idea and a CTA, measured by conversion, not vanity.",
      "دفعات موسمية وإطلاقات وتفعيلات شراكة — مبنية على فكرةٍ واحدة واضحة ودعوةٍ للفعل، تُقاس بالتحويل لا بالأرقام السطحية."
    ),
    steps: [
      {
        num: "01",
        title: l("Brief", "الإيجاز"),
        desc: l(
          "We pin the goal, the audience, and the one idea the whole campaign hangs on.",
          "نحدّد الهدف والجمهور والفكرة الواحدة التي تتعلّق بها الحملة كلها."
        ),
        bullets: [
          l("Goal & KPI setting", "تحديد الهدف والمؤشرات"),
          l("Audience & offer", "الجمهور والعرض"),
          l("The big idea", "الفكرة الكبرى"),
        ],
      },
      {
        num: "02",
        title: l("Build", "البناء"),
        desc: l(
          "We produce the creative across every channel the campaign will live on.",
          "ننتج الإبداع عبر كل قناةٍ ستعيش عليها الحملة."
        ),
        bullets: [
          l("Key visual & messaging", "البصري الرئيسي والرسائل"),
          l("Channel assets", "أصول القنوات"),
          l("Landing & CTA", "صفحة الهبوط والدعوة"),
        ],
      },
      {
        num: "03",
        title: l("Launch", "الإطلاق"),
        desc: l(
          "We roll it out — organic and paid — and watch it live, adjusting in real time.",
          "نطلقها — عضويًا ومدفوعًا — ونراقبها مباشرةً، ونعدّل لحظيًا."
        ),
        bullets: [
          l("Rollout across channels", "الإطلاق عبر القنوات"),
          l("Paid media setup", "إعداد الإعلانات المدفوعة"),
          l("Live optimization", "تحسينٌ مباشر"),
        ],
      },
      {
        num: "04",
        title: l("Measure", "القياس"),
        desc: l(
          "We read the results against the goal — conversions, cost, and learnings for next time.",
          "نقرأ النتائج مقابل الهدف — التحويلات والتكلفة والدروس للمرّة القادمة."
        ),
        bullets: [
          l("Conversion readout", "قراءة التحويلات"),
          l("Cost & ROI review", "مراجعة التكلفة والعائد"),
          l("Learnings & next steps", "الدروس والخطوات التالية"),
        ],
      },
    ],
    deliverables: [
      l("Campaign concept & key visual", "مفهوم الحملة والبصري الرئيسي"),
      l("Multi-channel assets", "أصول متعددة القنوات"),
      l("Landing page", "صفحة هبوط"),
      l("Paid media management", "إدارة الإعلانات المدفوعة"),
      l("Conversion report", "تقرير التحويلات"),
    ],
    outcome: l(
      "A campaign that earns its budget — judged by conversion, not applause.",
      "حملةٌ تستحق ميزانيتها — يحكم عليها التحويل لا التصفيق."
    ),
  },
];

export const SERVICE_SLUGS = SERVICES.map((s) => s.slug);

export function getService(slug: string): ServiceDetail | undefined {
  return SERVICES.find((s) => s.slug === slug);
}
