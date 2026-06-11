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

const inputCls =
  "w-full border border-neutral-300 rounded-md px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange/40 focus:border-orange";

function SubmitButton({ label, disabled }: { label: string; disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="w-full inline-flex h-12 items-center justify-center rounded-md bg-orange px-8 text-base font-semibold text-white transition-colors hover:bg-orange-deep disabled:cursor-not-allowed disabled:opacity-50"
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
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600">{state.error}</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-neutral-900">{copy.nameLabel}</label>
          <input name="name" value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-neutral-900">{copy.dateLabel}</label>
          <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-600">{today}</div>
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-neutral-900">{copy.contactLabel}</label>
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
    <div dir={lang === "ar" ? "rtl" : "ltr"} className="w-full max-w-xl rounded-2xl border border-neutral-200 bg-white p-7 sm:p-9">
      <div className="mb-6 flex items-start justify-between gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/logo-primary-transparent.png" alt="Marker Studio" className="h-8 w-auto" />
        <button
          type="button"
          onClick={() => setLang(lang === "ar" ? "en" : "ar")}
          className="rounded-full border border-neutral-200 px-3 py-1 text-xs font-semibold text-neutral-600 hover:border-neutral-400"
        >
          {ui.toggle}
        </button>
      </div>

      {signed ? (
        <div className="py-10 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-50 text-2xl">✓</div>
          <h1 className="text-2xl font-bold">{ui.thanksTitle}</h1>
          <p className="mt-1 text-sm text-neutral-500">{ui.thanksBody}</p>
          <button
            type="button"
            onClick={() => {
              setSigned(false);
              setRound((r) => r + 1);
            }}
            className="mt-8 rounded-md border border-neutral-300 px-5 py-2.5 text-sm font-semibold text-neutral-700 hover:border-neutral-500"
          >
            {ui.signAnother}
          </button>
        </div>
      ) : (
        <>
          <h1 className="text-2xl font-bold leading-snug">{copy.title}</h1>
          <div className="mt-4 space-y-3 text-sm leading-relaxed text-neutral-600">
            {copy.paras.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
          <SignForm key={round} token={token} lang={lang} copy={copy} onSigned={() => setSigned(true)} />
        </>
      )}

      <p className="mt-8 border-t border-neutral-100 pt-4 text-center text-[11px] text-neutral-400" dir="ltr">
        {CONSENT_FOOTER}
      </p>
    </div>
  );
}
