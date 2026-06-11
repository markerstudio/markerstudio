import Link from "next/link";
import { isDbEnabled } from "@/lib/db";
import { ensureInquiriesTable, listInquiries, type Inquiry } from "@/lib/inquiries";
import { markInquiryRead, markAllInquiriesRead, deleteInquiry } from "../actions";
import ConfirmButton from "@/components/admin/ConfirmButton";
import UndoBanner from "@/components/admin/UndoBanner";

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
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <h1 className="text-2xl font-bold tracking-tight">
          Inquiries
          {unread > 0 && (
            <span className="ml-2 align-middle text-xs font-semibold bg-orange text-white rounded-full px-2 py-0.5">
              {unread} new
            </span>
          )}
        </h1>
        {unread > 0 && (
          <form action={markAllInquiriesRead}>
            <button className="text-sm font-medium text-neutral-600 hover:text-neutral-900">
              Mark all read
            </button>
          </form>
        )}
      </div>

      <UndoBanner undo={searchParams.undo} restored={searchParams.restored} undoError={searchParams.undoError} back="/admin/inquiries" />

      {dbOff && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-4 py-3 mb-6">
          No database configured. Connect a database to collect and read contact-form submissions.
        </p>
      )}

      {failed && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-4 py-3 mb-6">
          Database connected, but it hasn&apos;t been initialised yet.{" "}
          <Link href="/admin/setup" className="font-semibold underline">Run setup →</Link>
        </p>
      )}

      {!dbOff && !failed && rows.length === 0 && (
        <div className="bg-white border border-neutral-200 rounded-xl px-4 py-10 text-center text-sm text-neutral-500">
          No inquiries yet. Submissions from the site&apos;s contact form will appear here.
        </div>
      )}

      <div className="space-y-3">
        {rows.map((r) => (
          <div
            key={r.id}
            className={`bg-white border rounded-xl p-4 ${
              r.read_at ? "border-neutral-200" : "border-orange/60 ring-1 ring-orange/30"
            }`}
          >
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {!r.read_at && <span className="w-2 h-2 rounded-full bg-orange shrink-0" aria-label="unread" />}
                  <span className="font-semibold">{r.name}</span>
                  {r.service && (
                    <span className="text-xs font-medium bg-neutral-100 text-neutral-600 rounded-full px-2 py-0.5">
                      {r.service}
                    </span>
                  )}
                  {r.lang && (
                    <span className="text-xs uppercase tracking-wide text-neutral-400">{r.lang}</span>
                  )}
                </div>
                <div className="text-sm text-neutral-600 mt-1 flex items-center gap-3 flex-wrap">
                  <a href={`mailto:${r.email}`} className="hover:text-orange">{r.email}</a>
                  {r.phone && <a href={`tel:${r.phone}`} className="hover:text-orange">{r.phone}</a>}
                  {r.brand && <span className="text-neutral-400">· {r.brand}</span>}
                </div>
              </div>
              <div className="text-xs text-neutral-400 shrink-0 text-right">{when(r.created_at)}</div>
            </div>

            {r.message && (
              <p className="text-sm text-neutral-800 mt-3 whitespace-pre-wrap border-t border-neutral-100 pt-3">
                {r.message}
              </p>
            )}

            <div className="flex items-center gap-4 mt-3 text-sm">
              {!r.read_at && (
                <form action={markInquiryRead}>
                  <input type="hidden" name="id" value={r.id} />
                  <button className="font-medium text-neutral-700 hover:text-orange">Mark read</button>
                </form>
              )}
              <a
                href={`mailto:${r.email}?subject=${encodeURIComponent("Re: your message to Marker Studio")}`}
                className="font-medium text-neutral-700 hover:text-orange"
              >
                Reply
              </a>
              <form action={deleteInquiry} className="ml-auto">
                <input type="hidden" name="id" value={r.id} />
                <ConfirmButton
                  message={`Delete the inquiry from ${r.name}? You'll get a chance to undo right after.`}
                  className="font-medium text-neutral-400 hover:text-red-600"
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
