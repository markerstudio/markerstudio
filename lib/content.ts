// Marker Studio site — bilingual content (single source of truth, EN/AR).
// Ported from the design system's content.js.

export type WorkItem = { tag: string; title: string; logo: string; color: string; size: string };
export type MetaItem = { num: string; label: string };
export type NumberedItem = { num: string; title: string; desc: string };
export type MetricItem = { label: string; value: string; delta: string };
export type FooterCol = { title: string; items: string[] };
export type ClientItem = { name: string; logo: string };

// Real client brand logos, pulled from the Marker Studio (marker.ps) Wix Media
// Manager and hot-linked from the Wix CDN. Shared across both languages.
const W = "https://static.wixstatic.com/media/";
export const CLIENT_BRANDS: ClientItem[] = [
  { name: "Gardenia", logo: `${W}cf380e_a9afa6eeeb4e4339b92b1600ed878e37~mv2.png` },
  { name: "Naji Photography", logo: `${W}cf380e_82b0607306e34f4aad85883fab2bb6ea~mv2.png` },
  { name: "Issa House", logo: `${W}12283c_f62235bfa0ea4695bf7fe8681a5893c5~mv2.png` },
  { name: "Michael", logo: `${W}12283c_7081be7ddff846cb8f7cb212c038f27d~mv2.png` },
  { name: "Luis", logo: `${W}12283c_60c6fae314c84865a607d7146c2e7238~mv2.png` },
  { name: "Rani Odeh", logo: `${W}12283c_55c4ddcbc64844e79b743212894692d1~mv2.png` },
  { name: "Double Shake", logo: `${W}12283c_ff3e7bc38ccf4483938053e559787b7f~mv2.png` },
  { name: "Canaan Hotel", logo: `${W}12283c_d440d9b568954fbe897be8e0afb50355~mv2.png` },
  { name: "Touch of Grace", logo: `${W}12283c_da3a0bc6ebe64e54a22d99f94b076aab~mv2.png` },
  { name: "Yalla Talk", logo: `${W}12283c_601e21549c9346269ed3d75da70b1470~mv2.png` },
  { name: "SOAP Palestine", logo: `${W}12283c_b72c18d2c15747fa81962b11389ec7ac~mv2.png` },
  { name: "Chocolatji", logo: `${W}12283c_a743ed71fef7466f86fb26143b665db8~mv2.png` },
  { name: "ENG PRO", logo: `${W}12283c_ba1e2a13358c4a559fb7142f8c39e6d0~mv2.png` },
  { name: "Mariana", logo: `${W}12283c_f6d933c8f8fa4543bd42a2b809ddfa4d~mv2.png` },
  { name: "Nailed It", logo: `${W}12283c_73f8d395fd034eeaa857852c55fed1b3~mv2.png` },
  { name: "Boutique Hotel", logo: `${W}12283c_1a1da3c67fb348cfba5b5be91855c8b8~mv2.png` },
  { name: "AOCC", logo: `${W}12283c_972076d8314745f8b4e74c4a14b382c3~mv2.png` },
  { name: "Eveleen", logo: `${W}12283c_b6a60ce942bf40239b20b5f6b726edba~mv2.png` },
  { name: "Taha", logo: `${W}12283c_d0da7775037c4d5bb1df1b8b2df0fe4f~mv2.png` },
  // Locally-hosted marks extracted from recent brand projects.
  { name: "Bint Al Balad", logo: "/assets/clients/bint-al-balad.png" },
  { name: "365 Detox", logo: "/assets/clients/365-detox.png" },
  { name: "Aya Deeb", logo: "/assets/clients/aya-deeb.png" },
  { name: "Chef Chocolate", logo: "/assets/clients/chef-chocolate.png" },
  { name: "BLOK", logo: "/assets/clients/blok.png" },
];
export type QuoteItem = { quote: string; name: string; role: string };
export type FaqItem = { q: string; a: string };

export type Lang = "en" | "ar";

export interface SiteContent {
  dir: "ltr" | "rtl";
  bodyClass: string;
  nav: string[];
  cta: { primary: string; secondary: string; read: string; arrow: string; login: string; whatsapp: string; whatsappMsg: string };
  hero: { eyebrow: string; title: string[]; sub: string; meta: MetaItem[] };
  heroCine: {
    brandName: string;
    tagline1: string;
    tagline2: string;
    tagline2Brush: string;
    cardHeading: string;
    cardDescription: string;
    metricValue: number;
    metricLabel: string;
    ctaHeading: string;
    ctaHeadingBrush: string;
    ctaDescription: string;
    phoneToday: string;
    phoneTitle: string;
    phoneChartLabel: string;
    phoneInitials: string;
    phonePlainTitle: string;
    phoneStats: [{ label: string; value: string }, { label: string; value: string }];
    badges: [{ icon: string; title: string; sub: string }, { icon: string; title: string; sub: string }];
  };
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
  pricing: {
    eyebrow: string;
    title: string[];
    sub: string;
    quoteNote: string;
    cta: string;
    popularLabel: string;
    arrow: string;
    categories: {
      key: string;
      label: string;
      plans: {
        name: string;
        meta: string;
        tagline: string;
        features: string[];
        featured?: boolean;
      }[];
    }[];
  };
  faq: { eyebrow: string; title: string; sub: string; items: FaqItem[] };
  ctaBanner: { title: string[]; sub: string; button: string };
  contact: {
    eyebrow: string;
    title: string[];
    sub: string;
    form: {
      name: string; email: string; phone: string; brand: string; service: string;
      message: string; submit: string; sending: string; success: string; error: string;
      serviceOptions: string[];
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
    cta: { primary: "Start a project", secondary: "View work", read: "Read brief", arrow: "→", login: "Client login", whatsapp: "Chat on WhatsApp", whatsappMsg: "Hi Marker Studio — I'd like to talk about a project." },
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
    heroCine: {
      brandName: "Marker",
      tagline1: "We mark the brands",
      tagline2: "that",
      tagline2Brush: "matter.",
      cardHeading: "Marketing, measured.",
      cardDescription:
        "Marker runs your brand's social like a funnel — reach to profile-visit to follower to inquiry — and reports every number, every month.",
      metricValue: 445,
      metricLabel: "K Views",
      ctaHeading: "Ready to leave a",
      ctaHeadingBrush: "mark?",
      ctaDescription:
        "Tell us what you're building. We reply to every brief within two working days.",
      phoneToday: "Last 60 days",
      phoneTitle: "Reach",
      phoneChartLabel: "Daily reach",
      phoneInitials: "MS",
      phonePlainTitle: "Your brand",
      phoneStats: [
        { label: "Reach", value: "+1,353%" },
        { label: "Followers", value: "+369" },
      ],
      badges: [
        { icon: "📈", title: "87,606", sub: "Accounts reached" },
        { icon: "✦", title: "6.9% CTR", sub: "Click-through" },
      ],
    },
    clients: {
      eyebrow: "Trusted by",
      title: "Brands that asked us to leave a mark.",
      items: CLIENT_BRANDS,
    },
    work: {
      eyebrow: "Recent work",
      title: "Brands we've left a mark on.",
      sub: "A mix of identity, content, and campaign work from the past year.",
      items: [
        { tag: "Identity · Hospitality", title: "Canaan Hotel", logo: `${W}12283c_d440d9b568954fbe897be8e0afb50355~mv2.png`, color: "#3B4043", size: "lg" },
        { tag: "Identity · Photography", title: "Naji Photography", logo: `${W}cf380e_82b0607306e34f4aad85883fab2bb6ea~mv2.png`, color: "#423891", size: "sm" },
        { tag: "Identity · App", title: "Yalla Talk", logo: `${W}12283c_601e21549c9346269ed3d75da70b1470~mv2.png`, color: "#8238EB", size: "sm" },
        { tag: "Identity · Retail", title: "SOAP Palestine", logo: `${W}12283c_b72c18d2c15747fa81962b11389ec7ac~mv2.png`, color: "#522F8D", size: "md" },
        { tag: "Identity · F&B", title: "Chocolatji", logo: `${W}12283c_a743ed71fef7466f86fb26143b665db8~mv2.png`, color: "#133832", size: "md" },
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
    pricing: {
      eyebrow: "Packages",
      title: ["Pick a track,", "leave a mark."],
      sub: "Two ways to work with Marker — build your brand, or run it. Pick a package and we'll tailor a quote to your scope.",
      quoteNote: "Every brand is different — your final quote is tailored to scope. No surprises, no lock-in.",
      cta: "Get a quote",
      popularLabel: "Most popular",
      arrow: "→",
      categories: [
        {
          key: "branding",
          label: "Branding",
          plans: [
            {
              name: "Project Branding",
              meta: "One-time project",
              tagline: "The essentials to launch a mark.",
              features: ["Logo design", "Mood board"],
            },
            {
              name: "Growth Branding",
              meta: "One-time project",
              tagline: "A full identity system to grow with.",
              featured: true,
              features: [
                "Everything in Project Branding",
                "Visual identity system",
                "Branding accessories — business cards, banners, stationery & more",
              ],
            },
            {
              name: "Complete Branding",
              meta: "One-time project",
              tagline: "Your brand, end to end — on every screen.",
              features: [
                "Everything in Growth Branding",
                "Website design",
                "Social media post layouts",
              ],
            },
          ],
        },
        {
          key: "marketing",
          label: "Marketing",
          plans: [
            {
              name: "Casual",
              meta: "Monthly",
              tagline: "A steady presence, twice a week.",
              features: ["Monthly plan", "~2 posts per week"],
            },
            {
              name: "Intensive",
              meta: "Monthly",
              tagline: "Daily stories and paid reach.",
              featured: true,
              features: [
                "Monthly plan",
                "Daily stories",
                "~3 posts per week",
                "Ad management",
              ],
            },
            {
              name: "Rocket",
              meta: "Monthly",
              tagline: "Maximum output, fully managed.",
              features: [
                "Everything in Intensive",
                "~4 posts per week",
                "Full ad campaign management",
              ],
            },
          ],
        },
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
        name: "Your name", email: "Email", phone: "Phone", brand: "Brand or project", service: "Service",
        message: "What are you trying to mark?", submit: "Send brief",
        sending: "Sending…",
        success: "Thanks — we've got your brief and will reply within two working days.",
        error: "Something went wrong. Please email create@marker.ps directly.",
        serviceOptions: ["Branding", "Marketing", "Website", "Not sure yet"],
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
    cta: { primary: "ابدأ مشروعاً", secondary: "اطّلع على أعمالنا", read: "اقرأ التفاصيل", arrow: "←", login: "دخول العملاء", whatsapp: "تواصل عبر واتساب", whatsappMsg: "مرحباً ماركر استديو — أودّ التحدّث عن مشروع." },
    hero: {
      eyebrow: "بيت ساحور · فلسطين — منذ الشرارة",
      title: ["نحن", "نعلّم", "على العلامات", "التي تستحقّ."],
      sub: "ماركر استديو إبداعي وتسويقي. نطلق هويّات، محتوى، وحملات تُحرّك الأرقام — لا تُحرّك الأهداف.",
      meta: [
        { num: "+369", label: "متابع / 60 يوم" },
        { num: "445K", label: "مشاهدة" },
        { num: "6.9%", label: "نسبة النقر" },
        { num: "+12", label: "علامة" },
      ],
    },
    heroCine: {
      brandName: "ماركر",
      tagline1: "نعلّم على العلامات",
      tagline2: "التي",
      tagline2Brush: "تستحقّ.",
      cardHeading: "تسويق، يُقاس.",
      cardDescription:
        "نُدير وسائل التواصل لعلامتك كقمعٍ تسويقي — من الوصول إلى زيارة الملف إلى المتابعة إلى الاستفسار — ونوثّق كل رقم، كل شهر.",
      metricValue: 445,
      metricLabel: "ألف مشاهدة",
      ctaHeading: "جاهزٌ لتترك",
      ctaHeadingBrush: "أثراً؟",
      ctaDescription: "حدّثنا عمّا تبنيه. نردّ على كل طلب خلال يومَي عمل.",
      phoneToday: "آخر ٦٠ يوم",
      phoneTitle: "الوصول",
      phoneChartLabel: "الوصول اليومي",
      phoneInitials: "MS",
      phonePlainTitle: "علامتك",
      phoneStats: [
        { label: "الوصول", value: "+1,353%" },
        { label: "متابعون", value: "+369" },
      ],
      badges: [
        { icon: "📈", title: "87,606", sub: "حساب وصلنا إليه" },
        { icon: "✦", title: "6.9% نقر", sub: "نسبة النقر" },
      ],
    },
    clients: {
      eyebrow: "وثقوا بنا",
      title: "علامات طلبت منّا أن نترك أثراً.",
      items: CLIENT_BRANDS,
    },
    work: {
      eyebrow: "أحدث الأعمال",
      title: "علامات تركنا أثرنا عليها.",
      sub: "مزيج من الهويات والمحتوى والحملات خلال العام الماضي.",
      items: [
        { tag: "هوية · ضيافة", title: "كنعان", logo: `${W}12283c_d440d9b568954fbe897be8e0afb50355~mv2.png`, color: "#3B4043", size: "lg" },
        { tag: "هوية · تصوير", title: "ناجي للتصوير", logo: `${W}cf380e_82b0607306e34f4aad85883fab2bb6ea~mv2.png`, color: "#423891", size: "sm" },
        { tag: "هوية · تطبيق", title: "يلا توك", logo: `${W}12283c_601e21549c9346269ed3d75da70b1470~mv2.png`, color: "#8238EB", size: "sm" },
        { tag: "هوية · تجزئة", title: "صابون فلسطين", logo: `${W}12283c_b72c18d2c15747fa81962b11389ec7ac~mv2.png`, color: "#522F8D", size: "md" },
        { tag: "هوية · مأكولات", title: "تشوكولاتجي", logo: `${W}12283c_a743ed71fef7466f86fb26143b665db8~mv2.png`, color: "#133832", size: "md" },
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
      sub: "تحوّل حقيقي في حساب عيادة طبية خاصة بعد تولّينا الحساب.",
      items: [
        { label: "الحسابات الواصلة", value: "87,606", delta: "+1,353% مقارنة بالسابق" },
        { label: "إجمالي المشاهدات", value: "445K", delta: "كانت 105 ألف سابقاً" },
        { label: "صافي المتابعين", value: "+369", delta: "كان +66" },
        { label: "زيارات الملف", value: "6,078", delta: "كانت 1,001" },
      ],
    },
    testimonials: {
      eyebrow: "بكلماتهم",
      title: "كيف يكون أن تحمل علامتنا.",
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
        { num: "٠٢", title: "توسيم", desc: "نلتزم باتجاه. هوية، قمع، حملة — حادّة بما يكفي للمراهنة." },
        { num: "٠٣", title: "إنتاج", desc: "أسابيع إنتاج. أصول تُسلَّم أسبوعياً، إعلانات مضبوطة، محتوى مُختبَر." },
        { num: "٠٤", title: "قياس", desc: "تقرير شهري — وصول، تحويل، دروس. ثمّ نضبط المرحلة القادمة عليه." },
      ],
    },
    pricing: {
      eyebrow: "الباقات",
      title: ["اختر مساراً،", "واترك أثراً."],
      sub: "طريقتان للعمل مع ماركر — ابنِ علامتك، أو أدِرها. اختر باقة ونفصّل لك عرض سعر حسب نطاق عملك.",
      quoteNote: "كل علامة مختلفة — السعر النهائي يُفصَّل حسب نطاق العمل. بلا مفاجآت، وبلا التزام مقيِّد.",
      cta: "اطلب عرض سعر",
      popularLabel: "الأكثر طلباً",
      arrow: "←",
      categories: [
        {
          key: "branding",
          label: "البراندنج",
          plans: [
            {
              name: "براندنج المشروع",
              meta: "مشروع لمرة واحدة",
              tagline: "الأساسيّات لإطلاق علامتك.",
              features: ["تصميم شعار", "لوحة إلهام (Mood Board)"],
            },
            {
              name: "براندنج النمو",
              meta: "مشروع لمرة واحدة",
              tagline: "نظام هوية متكامل تنمو معه.",
              featured: true,
              features: [
                "كل ما في باقة المشروع",
                "نظام هوية بصرية",
                "مستلزمات العلامة — كروت شخصية، بنرات، قرطاسية والمزيد",
              ],
            },
            {
              name: "براندنج متكامل",
              meta: "مشروع لمرة واحدة",
              tagline: "علامتك كاملة — على كل شاشة.",
              features: [
                "كل ما في باقة النمو",
                "تصميم موقع إلكتروني",
                "تصاميم منشورات سوشال ميديا",
              ],
            },
          ],
        },
        {
          key: "marketing",
          label: "التسويق",
          plans: [
            {
              name: "كاجوال",
              meta: "شهري",
              tagline: "حضور ثابت، مرتين أسبوعياً.",
              features: ["خطة شهرية", "~مرتين أسبوعياً"],
            },
            {
              name: "مكثّف",
              meta: "شهري",
              tagline: "ستوريات يومية ووصول مدفوع.",
              featured: true,
              features: [
                "خطة شهرية",
                "ستوريات يومية",
                "~3 مرات أسبوعياً",
                "إدارة إعلانات",
              ],
            },
            {
              name: "روكِت",
              meta: "شهري",
              tagline: "أقصى إنتاج، بإدارة كاملة.",
              features: [
                "كل ما في الباقة المكثّفة",
                "~4 مرات أسبوعياً",
                "إدارة حملات إعلانية كاملة",
              ],
            },
          ],
        },
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
        name: "اسمك", email: "البريد", phone: "الهاتف", brand: "العلامة أو المشروع", service: "الخدمة",
        message: "ما الذي تريد أن تعلّم عليه؟", submit: "أرسل الطلب",
        sending: "جارٍ الإرسال…",
        success: "شكراً — وصلنا طلبك وسنردّ خلال يومَي عمل.",
        error: "حدث خطأ ما. يرجى مراسلتنا مباشرة على create@marker.ps.",
        serviceOptions: ["البراندنج", "التسويق", "موقع إلكتروني", "لست متأكداً"],
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
