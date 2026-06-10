"use client";

import { useState } from "react";

const field = "rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange/40 focus:border-orange";

/* Client picker for tab-level forms: a dropdown of existing portals with a
   "+ New client" escape hatch that swaps in a free-text name input. The
   server action reads `slug` (or "__new") and `clientName`. */
export default function ClientSelectOrType({ clients }: { clients: { slug: string; name: string }[] }) {
  const [typing, setTyping] = useState(clients.length === 0);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {clients.length > 0 && (
        <select
          name="slug"
          defaultValue=""
          required={!typing}
          onChange={(e) => setTyping(e.target.value === "__new")}
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
  );
}
