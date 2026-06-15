"use client";

import { useState } from "react";

const field = "rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange/40 focus:border-orange";

/* Client picker for tab-level forms: a dropdown of existing portals with a
   "+ New client" escape hatch that swaps in a free-text name input. The
   server action reads `slug` (or "__new") and `clientName`.

   When `balances` is supplied, picking a client surfaces what they still owe
   on open invoices — so you know what's left to pay before writing a new one. */
export default function ClientSelectOrType({
  clients,
  balances = {},
}: {
  clients: { slug: string; name: string }[];
  balances?: Record<string, { open: number; count: number }>;
}) {
  const [typing, setTyping] = useState(clients.length === 0);
  const [slug, setSlug] = useState("");

  const bal = slug && slug !== "__new" ? balances[slug] : undefined;
  const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        {clients.length > 0 && (
          <select
            name="slug"
            defaultValue=""
            required={!typing}
            onChange={(e) => {
              setSlug(e.target.value);
              setTyping(e.target.value === "__new");
            }}
            className={`${field} min-w-[200px]`}
          >
            <option value="" disabled>
              Choose a client…
            </option>
            {clients.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
            <option value="__new">+ New client — type a name</option>
          </select>
        )}
        {typing && (
          <input
            name="clientName"
            required
            placeholder="Client name"
            className={`${field} min-w-[200px]`}
            autoFocus={clients.length > 0}
          />
        )}
      </div>
      {bal && bal.open > 0 ? (
        <p className="text-xs font-medium text-orange-deep bg-orange-50 border border-orange-100 rounded-md px-3 py-1.5 inline-block">
          Already owes <b className="tabular-nums">{fmt(bal.open)}</b> across {bal.count} open invoice{bal.count === 1 ? "" : "s"}.
        </p>
      ) : slug && slug !== "__new" ? (
        <p className="text-xs font-medium text-green-700 bg-green-50 border border-green-100 rounded-md px-3 py-1.5 inline-block">
          Nothing outstanding — all invoices paid.
        </p>
      ) : null}
    </div>
  );
}
