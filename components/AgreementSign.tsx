"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { signAgreement } from "@/app/onboarding-actions";

type Strings = {
  agreeLabel: string;
  signLabel: string;
  signHint: string;
  signaturePreview: string;
  submit: string;
  error?: boolean;
  errorText: string;
};

function SubmitButton({ label, disabled }: { label: string; disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="inline-flex h-12 items-center justify-center rounded-md bg-orange px-8 text-base font-semibold text-white transition-colors hover:bg-orange-deep disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "…" : label}
    </button>
  );
}

export default function AgreementSign({ slug, t }: { slug: string; t: Strings }) {
  const [name, setName] = useState("");
  const [agree, setAgree] = useState(false);
  const valid = agree && name.trim().length >= 2;

  return (
    <form action={signAgreement} className="mt-5">
      <input type="hidden" name="slug" value={slug} />

      {t.error && (
        <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600">{t.errorText}</p>
      )}

      <label className="flex cursor-pointer items-start gap-3 text-sm text-neutral-700">
        <input
          type="checkbox"
          name="agree"
          checked={agree}
          onChange={(e) => setAgree(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-orange focus:ring-orange/30"
        />
        <span>{t.agreeLabel}</span>
      </label>

      <div className="mt-5 max-w-sm">
        <label className="mb-2 block text-sm font-medium text-neutral-900">{t.signLabel}</label>
        <input
          name="signedName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2.5 text-sm focus:border-orange focus:outline-none focus:ring-2 focus:ring-orange/30"
          placeholder="Your full name"
        />
        <p className="mt-1.5 text-xs text-neutral-500">{t.signHint}</p>
      </div>

      <div className="mt-4 min-h-[64px] rounded-md border border-dashed border-neutral-300 bg-neutral-50 px-4 py-3">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">{t.signaturePreview}</div>
        <div className="mt-1 text-2xl italic text-neutral-900" style={{ fontFamily: "'Segoe Script','Brush Script MT',cursive" }}>
          {name || " "}
        </div>
      </div>

      <div className="mt-6">
        <SubmitButton label={t.submit} disabled={!valid} />
      </div>
    </form>
  );
}
