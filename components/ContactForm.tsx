"use client";

import { useEffect, useRef } from "react";
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
  const formRef = useRef<HTMLFormElement>(null);

  // "Get a quote" on a pricing card fires ms-quote — preselect the matching
  // service, prefill the message with the chosen package, and focus the form.
  useEffect(() => {
    const onQuote = (e: Event) => {
      const d = (e as CustomEvent).detail as { plan?: string; category?: string } | undefined;
      const form = formRef.current;
      if (!form || !d) return;
      const sel = form.elements.namedItem("service") as HTMLSelectElement | null;
      if (sel) {
        const want = d.category === "marketing" ? /market|social|تسويق|سوشال/i : /brand|identity|هوية|علامة/i;
        const opt = Array.from(sel.options).find((o) => want.test(o.value) || want.test(o.text));
        if (opt) sel.value = opt.value;
      }
      const msg = form.elements.namedItem("message") as HTMLTextAreaElement | null;
      if (msg && d.plan) {
        msg.value =
          lang === "ar"
            ? `أرغب بعرض سعر لباقة «${d.plan}».`
            : `I'd like a quote for the “${d.plan}” package.`;
      }
      window.setTimeout(() => {
        (form.elements.namedItem("name") as HTMLInputElement | null)?.focus({ preventScroll: true });
      }, 450);
    };
    window.addEventListener("ms-quote", onQuote);
    return () => window.removeEventListener("ms-quote", onQuote);
  }, [lang]);

  if (state.ok) {
    return (
      <div className="ms-contact__form ms-contact__success" role="status" aria-live="polite">
        <div className="ms-contact__success-ico" aria-hidden>✓</div>
        <p>{f.success}</p>
      </div>
    );
  }

  return (
    <form ref={formRef} className="ms-contact__form" action={action}>
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
