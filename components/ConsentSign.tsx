"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { signConsent, type ConsentSignState } from "@/app/consent-actions";
import SignaturePad from "@/components/SignaturePad";
import { CONSENT_COPY, CONSENT_FOOTER, type ConsentCopy } from "@/lib/consent-copy";

const UI = {
  en: {
    clear: "Clear",
    drawHint: "Sign here — finger, pencil or mouse",
    submit: "I agree — submit my signature",
    thanksTitle: "Thank you!",
    thanksBody: "Your consent has been recorded.",
    signAnother: "Sign another form",
    toggle: "عربي",
  },
  ar: {
    clear: "مسح",
    drawHint: "وقّع هنا — بالإصبع أو القلم أو الفأرة",
    submit: "أوافق — إرسال توقيعي",
    thanksTitle: "شكرًا لك!",
    thanksBody: "تم تسجيل موافقتك.",
    signAnother: "توقيع نموذج آخر",
    toggle: "English",
  },
} as const;

const inputCls = "lq-input";

function SubmitButton({ label, disabled }: { label: string; disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="lq-btn lq-btn--primary w-full h-12 justify-center !text-base disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "…" : label}
    </button>
  );
}

function SignForm({
  token,
  lang,
  copy,
  onSigned,
}: {
  token: string;
  lang: "en" | "ar";
  copy: ConsentCopy;
  onSigned: () => void;
}) {
  const ui = UI[lang];
  const [state, action] = useFormState(
    async (prev: ConsentSignState, fd: FormData) => {
      const next = await signConsent(prev, fd);
      if (next.ok) onSigned();
      return next;
    },
    { ok: false }
  );
  const [name, setName] = useState("");
  const [drawn, setDrawn] = useState(false);

  const today = new Date().toLocaleDateString(lang === "ar" ? "ar" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <form action={action} className="mt-6 space-y-4">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="lang" value={lang} />

      {state.error && (
        <p className="lq-well !border-rose-300/40 px-4 py-2.5 text-sm font-medium text-rose-700">{state.error}</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink">{copy.nameLabel}</label>
          <input name="name" value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink">{copy.dateLabel}</label>
          <div className="lq-well px-3 py-2.5 text-sm text-charcoal-60">{today}</div>
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-ink">{copy.contactLabel}</label>
        <input name="contact" className={inputCls} />
      </div>

      <SignaturePad label={copy.signLabel} clearLabel={ui.clear} hint={ui.drawHint} onChange={setDrawn} />

      <SubmitButton label={ui.submit} disabled={name.trim().length < 2 || !drawn} />
    </form>
  );
}

export default function ConsentSign({ token, defaultLang }: { token: string; defaultLang: "en" | "ar" }) {
  const [lang, setLang] = useState<"en" | "ar">(defaultLang);
  const [signed, setSigned] = useState(false);
  // Remounting the form (keyed by round) resets it for the next signer.
  const [round, setRound] = useState(0);

  const copy = CONSENT_COPY[lang];
  const ui = UI[lang];

  return (
    <div dir={lang === "ar" ? "rtl" : "ltr"} className="lq-card lq-rise w-full max-w-xl p-7 sm:p-9">
      <div className="mb-6 flex items-start justify-between gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/logo-primary-transparent.png" alt="Marker Studio" className="h-8 w-auto" />
        <button
          type="button"
          onClick={() => setLang(lang === "ar" ? "en" : "ar")}
          className="lq-btn lq-btn--glass lq-btn--sm !px-3 !py-1"
        >
          {ui.toggle}
        </button>
      </div>

      {signed ? (
        <div className="py-10 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700 text-2xl">✓</div>
          <h1 className="font-display font-extrabold text-2xl tracking-tight text-ink">{ui.thanksTitle}</h1>
          <p className="mt-1 text-sm text-charcoal-60">{ui.thanksBody}</p>
          <button
            type="button"
            onClick={() => {
              setSigned(false);
              setRound((r) => r + 1);
            }}
            className="lq-btn lq-btn--glass mt-8"
          >
            {ui.signAnother}
          </button>
        </div>
      ) : (
        <>
          <h1 className="font-display font-extrabold text-2xl tracking-tight text-ink leading-snug">{copy.title}</h1>
          <div className="mt-4 space-y-3 text-sm leading-relaxed text-charcoal-60">
            {copy.paras.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
          <SignForm key={round} token={token} lang={lang} copy={copy} onSigned={() => setSigned(true)} />
        </>
      )}

      <p className="mt-8 border-t border-charcoal/5 pt-4 text-center text-[11px] text-charcoal-40" dir="ltr">
        {CONSENT_FOOTER}
      </p>
    </div>
  );
}
