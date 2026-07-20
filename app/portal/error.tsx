"use client";

// Route-level error boundary for the client portal — the client-facing twin of
// app/admin/error.tsx. Clients shouldn't ever meet Next's raw "Application
// error" screen; give them a calm message and a retry. (No /api/health link
// here — that's studio-facing diagnostics.)
export default function PortalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="text-5xl">🧡</div>
        <h1 className="font-display font-bold text-xl text-ink">Something went wrong on our side</h1>
        <p className="text-sm text-charcoal-60 leading-relaxed">
          Your portal couldn&apos;t load just now. It&apos;s not you — please try again in a moment,
          and if it keeps happening let the studio know.
        </p>
        {error.digest && <p className="text-[11px] text-charcoal-40">Error digest: {error.digest}</p>}
        <button type="button" onClick={reset} className="lq-btn lq-btn--primary">
          Try again
        </button>
      </div>
    </div>
  );
}
