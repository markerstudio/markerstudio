"use client";

import { useState } from "react";

// One client hub, two tabs: the portal content editor and the settings/access
// cards. Both stay mounted (toggled with `hidden`) so form state survives a
// tab switch. Server-rendered settings JSX is passed in as the `manage` slot.
export default function ClientAdminTabs({ content, manage }: { content: React.ReactNode; manage: React.ReactNode }) {
  const [tab, setTab] = useState<"content" | "manage">("content");
  const btn = (id: "content" | "manage", label: string) => (
    <button
      onClick={() => setTab(id)}
      className={
        tab === id
          ? "rounded-lg bg-white shadow-sm px-4 py-1.5 text-sm font-semibold text-neutral-900"
          : "rounded-lg px-4 py-1.5 text-sm font-medium text-neutral-500 hover:text-neutral-800"
      }
    >
      {label}
    </button>
  );

  return (
    <div>
      <div className="inline-flex rounded-xl bg-neutral-100 p-1 mb-6">
        {btn("content", "Portal content")}
        {btn("manage", "Settings & access")}
      </div>
      <div className={tab === "content" ? "" : "hidden"}>{content}</div>
      <div className={tab === "manage" ? "" : "hidden"}>{manage}</div>
    </div>
  );
}
