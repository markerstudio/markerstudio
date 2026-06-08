"use client";

import { useFormState, useFormStatus } from "react-dom";
import { submitInquiry, type InquiryState } from "@/app/contact-actions";
import { type Lang, type SiteContent } from "@/lib/content";

function SubmitButton({ label, sending, arrow }: { label: string; sending: string; arrow: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="ms-btn ms-btn-primary"
      style={{ width: "100%", justifyContent: "center" }}
    >
      {pending ? sending : (
        <>
          {label} <span>{arrow}</span>
        </>
      )}
    </button>
  );
}

export default function ContactForm({ t, lang }: { t: SiteContent; lang: Lang }) {
  const f = t.contact.form;
  const [state, action] = useFormState(submitInquiry, { ok: false } as InquiryState);

  if (state.ok) {
    return (
      <div className="ms-contact__form ms-contact__success" role="status" aria-live="polite">
        <div className="ms-contact__success-ico" aria-hidden>✓</div>
        <p>{f.success}</p>
      </div>
    );
  }

  return (
    <form className="ms-contact__form" action={action}>
      <input type="hidden" name="lang" value={lang} />
      {/* Honeypot — hidden from humans, catches bots. */}
      <input
        type="text"
        name="company"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        className="ms-hp"
      />

      <div className="ms-contact__field">
        <label>{f.name}</label>
        <input type="text" name="name" required placeholder="Elias Boulos" />
      </div>
      <div className="ms-contact__field">
        <label>{f.email}</label>
        <input type="email" name="email" required placeholder="you@brand.com" />
      </div>
      <div className="ms-contact__field">
        <label>{f.phone}</label>
        <input type="tel" name="phone" placeholder="+970 5…" />
      </div>
      <div className="ms-contact__field">
        <label>{f.brand}</label>
        <input type="text" name="brand" placeholder="Aurora Goods" />
      </div>
      <div className="ms-contact__field">
        <label>{f.service}</label>
        <select name="service" defaultValue={f.serviceOptions[0]}>
          {f.serviceOptions.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>
      <div className="ms-contact__field">
        <label>{f.message}</label>
        <textarea name="message" placeholder="…" />
      </div>

      {state.error && <p className="ms-contact__error">{state.error}</p>}

      <SubmitButton label={f.submit} sending={f.sending} arrow={t.cta.arrow} />
    </form>
  );
}
