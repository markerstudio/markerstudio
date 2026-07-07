import Link from "next/link";
import { isDbEnabled } from "@/lib/db";
import { ensureInquiriesTable, listInquiries, type Inquiry } from "@/lib/inquiries";
import { markInquiryRead, markAllInquiriesRead, deleteInquiry } from "../actions";
import ConfirmButton from "@/components/admin/ConfirmButton";
import UndoBanner from "@/components/admin/UndoBanner";
import { EmptyState } from "@/components/ui/glass";

export const dynamic = "force-dynamic";

function when(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function InquiriesPage({
  searchParams,
}: {
  searchParams: { ok?: string; undo?: string; restored?: string; undoError?: string };
}) {
  const dbOff = !isDbEnabled();
  let rows: Inquiry[] = [];
  let failed = false;

  if (!dbOff) {
    try {
      await ensureInquiriesTable();
      rows = await listInquiries();
    } catch {
      failed = true;
    }
  }

  const unread = rows.filter((r) => !r.read_at).length;

  return (
    <div className="space-y-5">
      <header className="lq-rise flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-display font-bold uppercase tracking-[0.14em] text-charcoal-60">From the contact form</p>
          <h1 className="font-display font-extrabold text-[28px] tracking-tight text-ink leading-tight mt-1">
            Inquiries
            {unread > 0 && (
              <span className="lq-chip lq-chip--orange ms-2.5 align-middle !text-[11px]">
                {unread} new
              </span>
            )}
          </h1>
        </div>
        {unread > 0 && (
          <form action={markAllInquiriesRead}>
            <button className="lq-btn lq-btn--glass lq-btn--sm">
              Mark all read
            </button>
          </form>
        )}
      </header>

      <UndoBanner undo={searchParams.undo} restored={searchParams.restored} undoError={searchParams.undoError} back="/admin/inquiries" />

      {dbOff && (
        <p className="lq-card text-sm text-amber-800 px-4 py-3 !border-amber-300/40">
          No database configured. Connect a database to collect and read contact-form submissions.
        </p>
      )}

      {failed && (
        <p className="lq-card text-sm text-amber-800 px-4 py-3 !border-amber-300/40">
          Database connected, but it hasn&apos;t been initialised yet.{" "}
          <Link href="/admin/setup" className="font-semibold underline">Run setup →</Link>
        </p>
      )}

      {!dbOff && !failed && rows.length === 0 && (
        <div className="lq-card lq-rise">
          <EmptyState
            icon="✉️"
            title="No inquiries yet"
            sub={<>Submissions from the site&apos;s contact form will appear here.</>}
          />
        </div>
      )}

      <div className="space-y-3 lq-stagger">
        {rows.map((r, i) => (
          <div
            key={r.id}
            style={{ "--i": i } as React.CSSProperties}
            className={`lq-card p-5 ${r.read_at ? "" : "!border-orange/40 ring-1 ring-orange/25"}`}
          >
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {!r.read_at && <span className="w-2 h-2 rounded-full bg-orange shrink-0" aria-label="unread" />}
                  <span className="font-display font-bold tracking-tight text-ink">{r.name}</span>
                  {r.service && (
                    <span className="lq-chip !text-[11px]">
                      {r.service}
                    </span>
                  )}
                  {r.lang && (
                    <span className="text-xs uppercase tracking-wide text-charcoal-40">{r.lang}</span>
                  )}
                </div>
                <div className="text-sm text-charcoal-60 mt-1 flex items-center gap-3 flex-wrap">
                  <a href={`mailto:${r.email}`} className="hover:text-orange-deep no-underline">{r.email}</a>
                  {r.phone && <a href={`tel:${r.phone}`} className="hover:text-orange-deep no-underline">{r.phone}</a>}
                  {r.brand && <span className="text-charcoal-40">· {r.brand}</span>}
                </div>
              </div>
              <div className="text-xs text-charcoal-40 shrink-0 text-right">{when(r.created_at)}</div>
            </div>

            {r.message && (
              <p className="text-sm text-charcoal-80 mt-3 whitespace-pre-wrap border-t border-charcoal/5 pt-3">
                {r.message}
              </p>
            )}

            <div className="flex items-center gap-4 mt-3 text-sm">
              {!r.read_at && (
                <form action={markInquiryRead}>
                  <input type="hidden" name="id" value={r.id} />
                  <button className="font-medium text-charcoal-80 hover:text-orange-deep">Mark read</button>
                </form>
              )}
              <a
                href={`mailto:${r.email}?subject=${encodeURIComponent("Re: your message to Marker Studio")}`}
                className="font-medium text-charcoal-80 hover:text-orange-deep no-underline"
              >
                Reply
              </a>
              <form action={deleteInquiry} className="ms-auto">
                <input type="hidden" name="id" value={r.id} />
                <ConfirmButton
                  message={`Delete the inquiry from ${r.name}? You'll get a chance to undo right after.`}
                  className="font-medium text-charcoal-40 hover:text-rose-700"
                >
                  Delete
                </ConfirmButton>
              </form>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
