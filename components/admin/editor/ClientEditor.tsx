"use client";

import { useState, type ReactNode } from "react";
import DashboardTab from "./DashboardTab";
import PlanContentTab from "./PlanContentTab";
import DeliverablesTab from "./DeliverablesTab";
import AnalysisTab from "./AnalysisTab";
import FinanceTab from "./FinanceTab";
import DocumentsTab from "./DocumentsTab";
import IdentityForm from "./IdentityForm";
import type { Client, ClientData } from "@/lib/clients";

const TABS = [
  ["dashboard", "Dashboard"],
  ["content", "Plan & Content"],
  ["deliverables", "Deliverables"],
  ["analysis", "Analysis"],
  ["finance", "Finance"],
  ["documents", "Documents"],
  ["settings", "⚙ Settings"],
] as const;
type TabId = (typeof TABS)[number][0];

// The tabbed client editor. Tabs mirror the six client-facing portal sections,
// plus a Settings tab for infrastructure (identity, access, integrations, danger).
// One shared `data` state is the source of truth; only the active tab is mounted,
// so a keystroke re-renders just that section — and each tab saves its own slice.
export default function ClientEditor({
  client,
  projectLogos = [],
  apiEnabled,
  linkedToNotion,
  initialTab,
  docsSlot,
  invoicesSlot,
  settingsSlot,
}: {
  client: Client;
  projectLogos?: { slug: string; name: string; logo: string }[];
  apiEnabled: boolean;
  linkedToNotion: boolean;
  initialTab?: string;
  docsSlot?: ReactNode;
  invoicesSlot?: ReactNode;
  settingsSlot?: ReactNode;
}) {
  const [data, setData] = useState<ClientData>(client.data);
  const patch = (p: Partial<ClientData>) => setData((d) => ({ ...d, ...p }));
  // Legacy deep links (?tab=plan / ?tab=social) now resolve to the merged tab.
  const requested = initialTab === "plan" || initialTab === "social" ? "content" : initialTab;
  const valid = TABS.some(([id]) => id === requested);
  const [tab, setTab] = useState<TabId>(valid ? (requested as TabId) : "dashboard");
  const slug = client.slug;

  function go(id: TabId) {
    setTab(id);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", id);
      window.history.replaceState(null, "", url.toString());
    }
  }

  return (
    <div className="space-y-6">
      <nav className="sticky top-16 z-10 -mx-1 px-1 py-1 overflow-x-auto">
        <div className="lq-seg" role="tablist">
          {TABS.map(([id, label]) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => go(id)}
                className={`lq-seg__opt whitespace-nowrap ${active ? "is-on" : ""}`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </nav>

      <div className="min-w-0">
        {tab === "dashboard" && <DashboardTab slug={slug} data={data} patch={patch} />}
        {tab === "content" && <PlanContentTab slug={slug} data={data} />}
        {tab === "deliverables" && <DeliverablesTab slug={slug} data={data} />}
        {tab === "analysis" && <AnalysisTab slug={slug} data={data} patch={patch} client={client} apiEnabled={apiEnabled} />}
        {tab === "finance" && <FinanceTab slug={slug} data={data} patch={patch} linkedToNotion={linkedToNotion} invoicesSlot={invoicesSlot} />}
        {tab === "documents" && <DocumentsTab slug={slug} data={data} patch={patch} docsSlot={docsSlot} />}
        {tab === "settings" && (
          <div className="space-y-6">
            <IdentityForm client={client} projectLogos={projectLogos} />
            {settingsSlot}
          </div>
        )}
      </div>
    </div>
  );
}
