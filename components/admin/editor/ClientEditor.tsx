"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  Home,
  CalendarRange,
  ListChecks,
  Camera,
  Wallet,
  PanelsTopLeft,
  FileText,
  Settings,
} from "lucide-react";
import { Seg } from "@/components/ui/glass";
import OverviewTab from "./OverviewTab";
import DashboardTab from "./DashboardTab";
import PlanContentTab from "./PlanContentTab";
import DeliverablesTab from "./DeliverablesTab";
import AnalysisTab from "./AnalysisTab";
import FinanceTab from "./FinanceTab";
import DocumentsTab from "./DocumentsTab";
import IdentityForm from "./IdentityForm";
import type { Client, ClientData } from "@/lib/clients";

// The tab model follows the studio's workflow, not the portal's section list:
// land on Overview (read-only summary), then plan → tasks → shoots → money →
// portal authoring → documents, with Setup (identity, access, integrations,
// danger) last. "Photography" is a jump into Plan & Content's shoot section —
// shoots save together with the plan, so they stay in the same component.
const TABS = [
  { id: "overview", label: "Overview", icon: Home },
  { id: "content", label: "Plan & Content", icon: CalendarRange },
  { id: "tasks", label: "Tasks", icon: ListChecks },
  { id: "photography", label: "Photography", icon: Camera },
  { id: "money", label: "Money", icon: Wallet },
  { id: "portal", label: "Portal content", icon: PanelsTopLeft },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "setup", label: "Setup", icon: Settings },
] as const;
export type TabId = (typeof TABS)[number]["id"];
type PortalSub = "story" | "analysis";

// Legacy deep links (?tab=dashboard / ?tab=finance / ?tab=settings …) resolve
// to the new ids so old bookmarks and server redirects keep working.
const LEGACY: Record<string, TabId> = {
  dashboard: "portal",
  analysis: "portal",
  plan: "content",
  social: "content",
  deliverables: "tasks",
  finance: "money",
  settings: "setup",
};

function resolveTab(requested?: string): TabId {
  if (!requested) return "overview";
  if (TABS.some((t) => t.id === requested)) return requested as TabId;
  return LEGACY[requested] ?? "overview";
}

// One shared `data` state is the source of truth; only the active tab is
// mounted, so a keystroke re-renders just that section — and each tab saves
// its own slice through its existing action.
export default function ClientEditor({
  client,
  projectLogos = [],
  apiEnabled,
  linkedToNotion,
  initialTab,
  latestNote = null,
  docsSlot,
  invoicesSlot,
  settingsSlot,
}: {
  client: Client;
  projectLogos?: { slug: string; name: string; logo: string }[];
  apiEnabled: boolean;
  linkedToNotion: boolean;
  initialTab?: string;
  latestNote?: import("@/lib/notes").Note | null;
  docsSlot?: ReactNode;
  invoicesSlot?: ReactNode;
  settingsSlot?: ReactNode;
}) {
  const [data, setData] = useState<ClientData>(client.data);
  const patch = (p: Partial<ClientData>) => setData((d) => ({ ...d, ...p }));
  const [tab, setTab] = useState<TabId>(() => resolveTab(initialTab));
  // The merged "Portal content" tab keeps an internal seg: Story & dashboard /
  // Analysis. Old ?tab=analysis deep links land on the right half.
  const [portalSub, setPortalSub] = useState<PortalSub>(initialTab === "analysis" ? "analysis" : "story");
  const slug = client.slug;

  function scrollToPhotography() {
    // Two frames: let the tab content mount/lay out before jumping.
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        document.getElementById("photography")?.scrollIntoView({ behavior: "smooth", block: "start" })
      )
    );
  }

  useEffect(() => {
    if (resolveTab(initialTab) === "photography") scrollToPhotography();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function go(id: TabId) {
    setTab(id);
    if (id === "photography") scrollToPhotography();
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", id);
      window.history.replaceState(null, "", url.toString());
    }
  }

  // "Photography" is the same surface as Plan & Content — the shoot schedule
  // saves with the plan — so both ids render the one mounted PlanContentTab
  // (same tree position: switching between them never remounts / loses edits).
  const showContent = tab === "content" || tab === "photography";

  const body = (
    <div className="min-w-0">
      {tab === "overview" && <OverviewTab client={client} data={data} onNavigate={go} latestNote={latestNote} />}
      {showContent && <PlanContentTab slug={slug} data={data} />}
      {tab === "tasks" && <DeliverablesTab slug={slug} data={data} />}
      {tab === "money" && (
        <FinanceTab slug={slug} data={data} patch={patch} linkedToNotion={linkedToNotion} invoicesSlot={invoicesSlot} />
      )}
      {tab === "portal" && (
        <div className="space-y-5">
          <div className="flex items-center gap-3 flex-wrap">
            <Seg<PortalSub>
              value={portalSub}
              onChange={setPortalSub}
              options={[
                { value: "story", label: "Story & dashboard" },
                { value: "analysis", label: "Analysis" },
              ]}
            />
            <p className="text-[12.5px] text-charcoal-60">
              This authors what the client&apos;s portal shows.
            </p>
          </div>
          {portalSub === "story" ? (
            <DashboardTab slug={slug} data={data} patch={patch} />
          ) : (
            <AnalysisTab slug={slug} data={data} patch={patch} client={client} apiEnabled={apiEnabled} />
          )}
        </div>
      )}
      {tab === "documents" && <DocumentsTab slug={slug} data={data} patch={patch} docsSlot={docsSlot} />}
      {tab === "setup" && (
        <div className="space-y-6">
          <IdentityForm client={client} projectLogos={projectLogos} />
          {settingsSlot}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-[900px]:grid min-[900px]:grid-cols-[196px_minmax(0,1fr)] min-[900px]:gap-6 min-[900px]:items-start">
      {/* Desktop: sticky mini-rail of section links (matches the admin rail). */}
      <nav
        className="hidden min-[900px]:flex sticky top-20 flex-col gap-0.5"
        aria-label="Client sections"
        role="tablist"
      >
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => go(id)}
              className={`lq-navlink text-start ${active ? "is-active" : ""}`}
            >
              <Icon aria-hidden />
              {label}
            </button>
          );
        })}
      </nav>

      <div className="min-w-0">
        {/* <900px: the horizontal scrollable seg. */}
        <nav className="min-[900px]:hidden sticky top-16 z-10 -mx-1 px-1 py-1 overflow-x-auto mb-5" aria-label="Client sections">
          <div className="lq-seg" role="tablist">
            {TABS.map(({ id, label }) => {
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

        {body}
      </div>
    </div>
  );
}
