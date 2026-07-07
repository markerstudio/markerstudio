"use client";

import { useState } from "react";
import { deleteInvite } from "@/app/admin/actions";

export default function InviteList({ invites, slug }: { invites: { id: number; token: string }[]; slug: string }) {
  const [copied, setCopied] = useState<number | null>(null);
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="divide-y divide-charcoal/5">
      {invites.map((inv) => {
        const url = `${origin}/invite/${inv.token}`;
        return (
          <div key={inv.id} className="flex items-center gap-3 py-2.5">
            <input readOnly value={url} className="lq-input flex-1 min-w-0 !px-2.5 !py-1.5 !text-xs text-charcoal-60" />
            <button
              type="button"
              onClick={() => { navigator.clipboard?.writeText(url); setCopied(inv.id); setTimeout(() => setCopied(null), 1500); }}
              className="lq-press text-sm font-semibold text-orange-deep hover:text-orange whitespace-nowrap"
            >
              {copied === inv.id ? "Copied ✓" : "Copy link"}
            </button>
            <form action={deleteInvite}>
              <input type="hidden" name="id" value={inv.id} />
              <input type="hidden" name="slug" value={slug} />
              <button className="text-sm font-medium text-charcoal-40 hover:text-rose-700">Revoke</button>
            </form>
          </div>
        );
      })}
      {invites.length === 0 && <div className="py-3 text-sm text-charcoal-60">No active invites.</div>}
    </div>
  );
}
