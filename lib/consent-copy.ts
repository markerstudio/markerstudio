// The studio's standard photo/video consent release, bilingual. Kept in its
// own module (no DB imports) so client components can share it with the
// server-rendered admin record pages.

export type ConsentCopy = {
  title: string;
  paras: readonly string[];
  nameLabel: string;
  dateLabel: string;
  contactLabel: string;
  signLabel: string;
};

export const CONSENT_COPY: Record<"en" | "ar", ConsentCopy> = {
  en: {
    title: "Consent Form for Photography and Videography Use",
    paras: [
      "I hereby grant Marker Creative Studio™ the full right to use my image, video recordings, and any audio captured during photoshoots or filming sessions for the purpose of marketing, branding, and promotional content on social media platforms, website, printed materials, or any other communication mediums.",
      "Marker Creative Studio™ promises to use all photos, videos, and recordings in a respectful, professional, and culturally appropriate way that aligns with our brand values.",
      "This consent is granted without time limitation and is valid for all countries. I understand that no compensation will be given for the use of such media unless otherwise agreed.",
    ],
    nameLabel: "Participant full name",
    dateLabel: "Date",
    contactLabel: "Phone / email (optional)",
    signLabel: "Signature",
  },
  ar: {
    title: "نموذج موافقة لاستخدام الصور والفيديو",
    paras: [
      "أنا الموقّع أدناه أوافق على أن يستخدم ستوديو ماركر الإبداعي™ صوري أو الفيديوهات التي أظهر بها، وأي تسجيلات صوتية تم التقاطها خلال جلسات التصوير، في المواد التسويقية أو الترويجية على وسائل التواصل الاجتماعي أو الموقع الإلكتروني أو أي وسائط أخرى.",
      "يتعهد ستوديو ماركر الإبداعي™ باستخدام جميع الصور والفيديوهات والتسجيلات بطريقة محترمة ومهنية ومناسبة ثقافيًا، بما يتماشى مع قيم الاستوديو.",
      "هذه الموافقة صالحة بدون تحديد مدة زمنية، وتشمل كافة الدول. أفهم أنه لن يتم تقديم أي تعويض مالي مقابل استخدام هذه المواد إلا إذا تم الاتفاق على خلاف ذلك.",
    ],
    nameLabel: "الاسم الكامل",
    dateLabel: "التاريخ",
    contactLabel: "رقم الهاتف / البريد الإلكتروني (اختياري)",
    signLabel: "التوقيع",
  },
};

export const CONSENT_FOOTER = "Marker Creative Studio™ · +970 568 08 14 08 · create@marker.ps · www.marker.ps";
