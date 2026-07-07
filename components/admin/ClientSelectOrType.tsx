"use client";

import { useState } from "react";

const field = "lq-input !w-auto text-sm";

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
        <p className="lq-chip lq-chip--orange !text-[11px]">
          Already owes <b className="tabular-nums">{fmt(bal.open)}</b> across {bal.count} open invoice{bal.count === 1 ? "" : "s"}.
        </p>
      ) : slug && slug !== "__new" ? (
        <p className="lq-chip lq-chip--green !text-[11px]">Nothing outstanding — all invoices paid.</p>
      ) : null}
    </div>
  );
}
