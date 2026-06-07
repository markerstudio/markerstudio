"use client";

import { useState } from "react";
import { deleteInvite } from "@/app/admin/actions";

export default function InviteList({ invites, slug }: { invites: { id: number; token: string }[]; slug: string }) {
  const [copied, setCopied] = useState<number | null>(null);
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="divide-y divide-neutral-100">
      {invites.map((inv) => {
        const url = `${origin}/invite/${inv.token}`;
        return (
          <div key={inv.id} className="flex items-center gap-3 py-2.5">
            <input readOnly value={url} className="flex-1 min-w-0 border border-neutral-200 rounded-md px-2 py-1.5 text-xs text-neutral-600 bg-neutral-50" />
            <button
              type="button"
              onClick={() => { navigator.clipboard?.writeText(url); setCopied(inv.id); setTimeout(() => setCopied(null), 1500); }}
              className="text-sm font-medium text-orange hover:text-orange-deep whitespace-nowrap"
            >
              {copied === inv.id ? "Copied ✓" : "Copy link"}
            </button>
            <form action={deleteInvite}>
              <input type="hidden" name="id" value={inv.id} />
              <input type="hidden" name="slug" value={slug} />
              <button className="text-sm font-medium text-neutral-400 hover:text-red-600">Revoke</button>
            </form>
          </div>
        );
      })}
      {invites.length === 0 && <div className="py-3 text-sm text-neutral-500">No active invites.</div>}
    </div>
  );
}
