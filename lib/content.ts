// Marker Studio site — bilingual content (single source of truth, EN/AR).
// Ported from the design system's content.js.

export type WorkItem = { tag: string; title: string; media: string; size: string };
export type MetaItem = { num: string; label: string };
export type NumberedItem = { num: string; title: string; desc: string };
export type MetricItem = { label: string; value: string; delta: string };
export type FooterCol = { title: string; items: string[] };

export type Lang = "en" | "ar";

export interface SiteContent {
  dir: "ltr" | "rtl";
  bodyClass: string;
  nav: string[];
  cta: { primary: string; secondary: string; read: string; arrow: string };
  hero: { eyebrow: string; title: string[]; sub: string; meta: MetaItem[] };
  work: { eyebrow: string; title: string; sub: string; items: WorkItem[] };
  services: { eyebrow: string; title: string; items: NumberedItem[]; link: string };
  metrics: { eyebrow: string; title: string; sub: string; items: MetricItem[] };
  process: { eyebrow: string; title: string; items: NumberedItem[] };
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
