"use client";

import { useState } from "react";
import { adminRevokeReset } from "@/app/account-actions";

type Reset = { id: number; token: string; email: string; name: string; expires_at: string };

// Outstanding password-reset links — copy to send to a client, or revoke.
// Mirrors InviteList: the origin is read client-side so the link is absolute.
export default function ResetLinkList({ resets }: { resets: Reset[] }) {
  const [copied, setCopied] = useState<number | null>(null);
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  if (resets.length === 0) return <div className="py-3 text-sm text-charcoal-60">No active reset links.</div>;

  return (
    <div className="divide-y divide-charcoal/5">
      {resets.map((r) => {
        const url = `${origin}/reset/${r.token}`;
        const expires = new Date(r.expires_at);
        const expired = expires.getTime() < Date.now();
        return (
          <div key={r.id} className="flex items-center gap-3 py-2.5 flex-wrap">
            <div className="min-w-[140px]">
              <div className="text-sm font-medium text-ink truncate">{r.email}</div>
              <div className="text-xs text-charcoal-40">
                {expired ? "Expired" : `Expires ${expires.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`}
              </div>
            </div>
            <input readOnly value={url} className="lq-input flex-1 min-w-[180px] !px-2.5 !py-1.5 !text-xs text-charcoal-60" />
            <button
              type="button"
              onClick={() => { navigator.clipboard?.writeText(url); setCopied(r.id); setTimeout(() => setCopied(null), 1500); }}
              className="lq-press text-sm font-semibold text-orange-deep hover:text-orange whitespace-nowrap"
            >
              {copied === r.id ? "Copied ✓" : "Copy link"}
            </button>
            <form action={adminRevokeReset}>
              <input type="hidden" name="id" value={r.id} />
              <button className="text-sm font-medium text-charcoal-40 hover:text-rose-700">Revoke</button>
            </form>
          </div>
        );
      })}
    </div>
  );
}
