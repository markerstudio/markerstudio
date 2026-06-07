// Marker Studio site — bilingual content (single source of truth, EN/AR).
// Ported from the design system's content.js.

export type WorkItem = { tag: string; title: string; media: string; size: string };
export type MetaItem = { num: string; label: string };
export type NumberedItem = { num: string; title: string; desc: string };
export type MetricItem = { label: string; value: string; delta: string };
export type FooterCol = { title: string; items: string[] };
export type ClientItem = { name: string; initials: string };
export type QuoteItem = { quote: string; name: string; role: string };
export type FaqItem = { q: string; a: string };

export type Lang = "en" | "ar";

export interface SiteContent {
  dir: "ltr" | "rtl";
  bodyClass: string;
  nav: string[];
  cta: { primary: string; secondary: string; read: string; arrow: string };
  hero: { eyebrow: string; title: string[]; sub: string; meta: MetaItem[] };
  clients: { eyebrow: string; title: string; items: ClientItem[] };
  work: { eyebrow: string; title: string; sub: string; items: WorkItem[] };
  services: { eyebrow: string; title: string; items: NumberedItem[]; link: string };
  studio: {
    eyebrow: string;
    title: string[];
    body: string[];
    logos: { src: string; label: string; dark: boolean }[];
  };
  metrics: { eyebrow: string; title: string; sub: string; items: MetricItem[] };
  testimonials: { eyebrow: string; title: string; items: QuoteItem[] };
  process: { eyebrow: string; title: string; items: NumberedItem[] };
  faq: { eyebrow: string; title: string; sub: string; items: FaqItem[] };
  ctaBanner: { title: string[]; sub: string; button: string };
  contact: {
    eyebrow: string;
    title: string[];
    sub: string;
    form: {
      name: string; email: string; brand: string; service: string;
      message: string; submit: string; serviceOptions: string[];
    };
  };
  footer: {
    tagline: string;
    contact: { phone: string; email: string; web: string; addr: string };
    cols: FooterCol[];
    copy: string;
  };
}

export const MARKER_CONTENT: Record<Lang, SiteContent> = {
  en: {
    dir: "ltr",
    bodyClass: "",
    nav: ["Work", "Services", "Studio", "Notes", "Contact"],
    cta: { primary: "Start a project", secondary: "View work", read: "Read brief", arrow: "→" },
    hero: {
      eyebrow: "Beit Sahour · Palestine — est. since the spark",
      title: ["We", "mark", "the brands", "that matter."],
      sub: "Marker is a creative & marketing studio. We ship branding, social, and campaigns that move the numbers — not the goalposts.",
      meta: [
        { num: "+369", label: "Followers / 60 days" },
        { num: "445K", label: "Views generated" },
        { num: "6.9%", label: "Click-through" },
        { num: "12+", label: "Brands marked" },
      ],
    },
    clients: {
      eyebrow: "Trusted by",
      title: "Brands that asked us to leave a mark.",
      items: [
        { name: "Dr. Jack Sabat", initials: "JS" },
        { name: "Beit Café", initials: "BC" },
        { name: "Aurora Goods", initials: "AG" },
        { name: "JIAD ISEAD", initials: "JI" },
        { name: "Marker Studio®", initials: "M" },
      ],
    },
    work: {
      eyebrow: "Recent work",
      title: "Brands we've left a mark on.",
      sub: "A mix of identity, content, and campaign work from the past year.",
      items: [
        { tag: "Identity · Healthcare", title: "Dr. Jack Sabat", media: "JS", size: "lg" },
        { tag: "Social · F&B", title: "Beit Café", media: "BC", size: "sm" },
        { tag: "Campaign · Retail", title: "Aurora Goods", media: "AG", size: "sm" },
        { tag: "Content · Education", title: "JIAD ISEAD", media: "JI", size: "md" },
        { tag: "Identity · Studio", title: "Marker Studio®", media: "M", size: "md" },
      ],
    },
    services: {
      eyebrow: "What we do",
      title: "Three things, done sharply.",
      items: [
        { num: "01", title: "Brand identity", desc: "Naming, logos, visual systems, guidelines. Bilingual by default. We design for the merch, the storefront, and the invoice — not just the deck." },
        { num: "02", title: "Social & content", desc: "Reels-first strategy, content direction, paid amplification. We track the funnel from reach to profile-visit to follower to inquiry — and report it monthly." },
        { num: "03", title: "Campaigns", desc: "Launch creative, seasonal pushes, partner activations. Built around a CTA, measured by conversion — not vanity." },
      ],
      link: "Read more",
    },
    studio: {
      eyebrow: "The studio",
      title: ["A small studio", "with a heavy", "marker."],
      body: [
        "Marker is a creative & marketing studio out of Beit Sahour, Palestine. We're small on purpose — every brand we take on gets focused attention, not a hand-off.",
        "We work bilingually by default, design in Arabic and Latin at the same time, and treat the brushstroke as a promise: when we mark a brand, it stays marked.",
      ],
      logos: [
        { src: "/assets/logo-primary-transparent.png", label: "Primary mark", dark: false },
        { src: "/assets/logo-on-dark.svg", label: "On charcoal", dark: true },
      ],
    },
    metrics: {
      eyebrow: "Recent client · 60 days",
      title: "Numbers from one engagement.",
      sub: "Real performance shift on a private clinic Instagram after we took it on.",
      items: [
        { label: "Accounts reached", value: "87,606", delta: "+1,353% vs prior 60 days" },
        { label: "Total views", value: "445K", delta: "from 105K previously" },
        { label: "Net followers", value: "+369", delta: "up from +66" },
        { label: "Profile visits", value: "6,078", delta: "from 1,001 previously" },
      ],
    },
    testimonials: {
      eyebrow: "In their words",
      title: "What it's like to be marked.",
      items: [
        {
          quote:
            "They didn't just redesign our page — they rebuilt how patients find us. The numbers moved within the first month.",
          name: "Private clinic",
          role: "Healthcare · Bethlehem",
        },
        {
          quote:
            "Bilingual, fast, and they actually understand the local audience. The brand finally feels like us in both languages.",
          name: "F&B brand",
          role: "Hospitality · Beit Sahour",
        },
        {
          quote:
            "A campaign built around one clear idea, measured by what it sold — not by likes. Refreshing.",
          name: "Retail partner",
          role: "Retail · Palestine",
        },
      ],
    },
    process: {
      eyebrow: "How we work",
      title: "Four phases. No surprises.",
      items: [
        { num: "01", title: "Discover", desc: "We read your room — audience, market, what's worked, what hasn't. Numbers and instinct." },
        { num: "02", title: "Mark", desc: "We commit to a direction. One identity, one funnel, one campaign — sharp enough to bet on." },
        { num: "03", title: "Make", desc: "Production sprints. Assets shipped weekly, paid amplification dialed in, content tested." },
        { num: "04", title: "Measure", desc: "Monthly report — reach, conversion, learnings. Then we tune the next phase against it." },
      ],
    },
    faq: {
      eyebrow: "Before you ask",
      title: "Questions, answered.",
      sub: "The things brands ask us before the first call.",
      items: [
        {
          q: "Do you work in English and Arabic?",
          a: "Always. We design both scripts side by side — type, layout, and tone — so neither version feels like a translation of the other.",
        },
        {
          q: "How long does a brand identity take?",
          a: "A focused identity runs 3–5 weeks: discovery, one committed direction, then the full system and guidelines. Campaigns and social are ongoing monthly engagements.",
        },
        {
          q: "Do you only work with brands in Palestine?",
          a: "No — we're based in Beit Sahour but work remotely with brands anywhere. Bilingual work is our specialty, wherever you are.",
        },
        {
          q: "How do you measure success?",
          a: "By the funnel, not vanity. Reach, profile visits, inquiries, conversion — reported monthly, tuned every phase.",
        },
      ],
    },
    ctaBanner: {
      title: ["Ready to leave", "a mark?"],
      sub: "Tell us what you're building. We reply to every brief within two working days.",
      button: "Start a project",
    },
    contact: {
      eyebrow: "Make your mark",
      title: ["Tell us about", "your brand."],
      sub: "We respond to every brief within two working days. Bring numbers, screenshots, and your worst Instagram metric — we like a challenge.",
      form: {
        name: "Your name", email: "Email", brand: "Brand or project", service: "Service",
        message: "What are you trying to mark?", submit: "Send brief",
        serviceOptions: ["Brand identity", "Social & content", "Campaigns", "Not sure yet"],
      },
    },
    footer: {
      tagline: "We mark the brands that matter.",
      contact: { phone: "+970 568 08 14 08", email: "create@marker.ps", web: "www.marker.ps", addr: "Beit Sahour · Palestine · P181" },
      cols: [
        { title: "Studio", items: ["About", "Process", "Team", "Notes"] },
        { title: "Work", items: ["Recent", "Case studies", "Awards", "Clients"] },
        { title: "Services", items: ["Identity", "Social", "Campaigns", "Consulting"] },
      ],
      copy: "© 2026 Marker Studio® · Licensed practitioner no. 401120258",
    },
  },
  ar: {
    dir: "rtl",
    bodyClass: "ar",
    nav: ["الأعمال", "الخدمات", "الاستديو", "المدونة", "تواصل"],
    cta: { primary: "ابدأ مشروعاً", secondary: "اطّلع على أعمالنا", read: "اقرأ التفاصيل", arrow: "←" },
    hero: {
      eyebrow: "بيت ساحور · فلسطين — منذ الشرارة",
      title: ["نحن", "نعلّم", "على العلامات", "التي تستحقّ."],
      sub: "ماركر استديو إبداعي وتسويقي. نطلق هوّيات، محتوى، وحملات تُحرّك الأرقام — لا تُحرّك الأهداف.",
      meta: [
        { num: "+369", label: "متابع / 60 يوم" },
        { num: "445K", label: "مشاهدة" },
        { num: "6.9%", label: "نسبة النقر" },
        { num: "+12", label: "علامة" },
      ],
    },
    clients: {
      eyebrow: "وثقوا بنا",
      title: "علامات طلبت منّا أن نترك أثراً.",
      items: [
        { name: "د. جاك صبات", initials: "ج ص" },
        { name: "بيت كافيه", initials: "ب ك" },
        { name: "أورورا", initials: "أ" },
        { name: "جياد إسعاد", initials: "ج إ" },
        { name: "ماركر®", initials: "م" },
      ],
    },
    work: {
      eyebrow: "أحدث الأعمال",
      title: "علامات تركنا أثرنا عليها.",
      sub: "مزيج من الهويات والمحتوى والحملات خلال العام الماضي.",
      items: [
        { tag: "هوية · رعاية صحية", title: "د. جاك صبات", media: "ج ص", size: "lg" },
        { tag: "محتوى · مأكولات", title: "بيت كافيه", media: "ب ك", size: "sm" },
        { tag: "حملة · تجزئة", title: "أورورا", media: "أ", size: "sm" },
        { tag: "محتوى · تعليم", title: "جياد إسعاد", media: "ج إ", size: "md" },
        { tag: "هوية · استديو", title: "ماركر®", media: "م", size: "md" },
      ],
    },
    services: {
      eyebrow: "ماذا نفعل",
      title: "ثلاث خدمات، بحدّة.",
      items: [
        { num: "٠١", title: "هويّة العلامة", desc: "تسمية، شعار، نظام بصري، دليل استخدام. ثنائي اللغة بالأصل. نصمّم للمنتج، للواجهة، وللفاتورة — لا للعرض فقط." },
        { num: "٠٢", title: "المحتوى والسوشال", desc: "استراتيجية تعتمد الريلز، إدارة محتوى، إعلانات مدفوعة. نقيس القمع من الوصول إلى الزيارة إلى المتابعة إلى الاستفسار — ونوثّقه شهرياً." },
        { num: "٠٣", title: "الحملات", desc: "إطلاقات، حملات موسمية، شراكات. مبنيّة حول CTA واضح، تُقاس بالتحويل — لا بالأرقام الزائفة." },
      ],
      link: "اقرأ المزيد",
    },
    studio: {
      eyebrow: "الاستديو",
      title: ["استديو صغير", "بأثر", "ثقيل."],
      body: [
        "ماركر استديو إبداعي وتسويقي من بيت ساحور، فلسطين. صغيرٌ عن قصد — كل علامة نتولّاها تحصل على اهتمام كامل، لا على تسليمٍ بارد.",
        "نشتغل بلغتين بالأصل، ونصمّم بالعربية واللاتينية في آنٍ واحد، ونعامل ضربة الفرشاة كوعد: حين نعلّم على علامة، يبقى الأثر.",
      ],
      logos: [
        { src: "/assets/logo-primary-transparent.png", label: "الشعار الأساسي", dark: false },
        { src: "/assets/logo-on-dark.svg", label: "على الفحمي", dark: true },
      ],
    },
    metrics: {
      eyebrow: "عميل حديث · 60 يوم",
      title: "أرقام من حساب واحد.",
      sub: "تحوّل حقيقي في حساب عيادة طبية خاصة بعد توليّنا الحساب.",
      items: [
        { label: "الحسابات الواصلة", value: "87,606", delta: "+1,353% مقارنة بالسابق" },
        { label: "إجمالي المشاهدات", value: "445K", delta: "كانت 105 ألف سابقاً" },
        { label: "صافي المتابعين", value: "+369", delta: "كان +66" },
        { label: "زيارات الملف", value: "6,078", delta: "كانت 1,001" },
      ],
    },
    testimonials: {
      eyebrow: "بكلماتهم",
      title: "كيف يكون أن تُعلَّم.",
      items: [
        {
          quote:
            "لم يعيدوا تصميم صفحتنا فحسب — أعادوا بناء طريقة وصول المرضى إلينا. تحرّكت الأرقام خلال الشهر الأول.",
          name: "عيادة خاصة",
          role: "رعاية صحية · بيت لحم",
        },
        {
          quote:
            "ثنائيو اللغة، سريعون، ويفهمون الجمهور المحلي فعلاً. أصبحت العلامة تشبهنا في اللغتين.",
          name: "علامة مأكولات",
          role: "ضيافة · بيت ساحور",
        },
        {
          quote:
            "حملة مبنيّة حول فكرة واحدة واضحة، تُقاس بما باعته — لا بالإعجابات. منعش.",
          name: "شريك تجزئة",
          role: "تجزئة · فلسطين",
        },
      ],
    },
    process: {
      eyebrow: "طريقة عملنا",
      title: "أربع مراحل. بلا مفاجآت.",
      items: [
        { num: "٠١", title: "اكتشاف", desc: "نقرأ الجمهور والسوق وما اشتغل وما لم يشتغل. أرقام وحدس." },
        { num: "٠٢", title: "علامة", desc: "نلتزم باتجاه. هوية، قمع، حملة — حادة بما يكفي للمراهنة." },
        { num: "٠٣", title: "إنتاج", desc: "أسابيع إنتاج. أصول تُسلَّم أسبوعياً، إعلانات مضبوطة، محتوى مُختبَر." },
        { num: "٠٤", title: "قياس", desc: "تقرير شهري — وصول، تحويل، دروس. ثمّ نضبط المرحلة القادمة عليه." },
      ],
    },
    faq: {
      eyebrow: "قبل أن تسأل",
      title: "أسئلة، بإجابات.",
      sub: "ما تسألنا عنه العلامات قبل أول مكالمة.",
      items: [
        {
          q: "هل تشتغلون بالعربية والإنجليزية؟",
          a: "دائماً. نصمّم النصّين جنباً إلى جنب — الخط والتخطيط والنبرة — كي لا يبدو أيٌّ منهما ترجمةً للآخر.",
        },
        {
          q: "كم تستغرق هوية العلامة؟",
          a: "هوية مركّزة تأخذ 3–5 أسابيع: اكتشاف، اتجاه واحد ملتزَم، ثمّ النظام الكامل والدليل. الحملات والمحتوى ارتباطات شهرية مستمرة.",
        },
        {
          q: "هل تعملون فقط مع علامات في فلسطين؟",
          a: "لا — مقرّنا بيت ساحور لكنّنا نعمل عن بُعد مع علامات في أي مكان. العمل ثنائي اللغة تخصّصنا، أينما كنت.",
        },
        {
          q: "كيف تقيسون النجاح؟",
          a: "بالقمع، لا بالأرقام الزائفة. وصول، زيارات، استفسارات، تحويل — موثّقة شهرياً، ومضبوطة كل مرحلة.",
        },
      ],
    },
    ctaBanner: {
      title: ["جاهز لتترك", "أثراً؟"],
      sub: "حدّثنا عمّا تبنيه. نردّ على كل طلب خلال يومَي عمل.",
      button: "ابدأ مشروعاً",
    },
    contact: {
      eyebrow: "اترك علامتك",
      title: ["حدّثنا عن", "علامتك."],
      sub: "نردّ على كل طلب خلال يومَي عمل. أحضر أرقامك، لقطاتك، وأسوأ مؤشر إنستغرام لديك — نحبّ التحدّي.",
      form: {
        name: "اسمك", email: "البريد", brand: "العلامة أو المشروع", service: "الخدمة",
        message: "ما الذي تريد أن تعلّم عليه؟", submit: "أرسل الطلب",
        serviceOptions: ["هوية", "محتوى", "حملات", "لست متأكداً"],
      },
    },
    footer: {
      tagline: "نعلّم على العلامات التي تستحقّ.",
      contact: { phone: "+970 568 08 14 08", email: "create@marker.ps", web: "www.marker.ps", addr: "بيت ساحور · فلسطين · P181" },
      cols: [
        { title: "الاستديو", items: ["عنّا", "العملية", "الفريق", "المدوّنة"] },
        { title: "الأعمال", items: ["الأحدث", "دراسات حالة", "الجوائز", "العملاء"] },
        { title: "الخدمات", items: ["هوية", "محتوى", "حملات", "استشارة"] },
      ],
      copy: "© 2026 ماركر استديو® · مشتغل مرخص رقم 401120258",
    },
  },
};
