"use client";

// Route-level error boundary for every /admin page. Until now a server crash
// (most often: the database not answering) surfaced as Next's bare
// "Application error … Digest: …" screen with no way forward. This keeps the
// person inside the product: name the likely culprit, link the health check,
// offer a retry.
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="text-5xl">🛠️</div>
        <h1 className="font-display font-bold text-xl text-ink">The studio hit a server error</h1>
        <p className="text-sm text-charcoal-60 leading-relaxed">
          This page couldn&apos;t load its data — usually that means the database isn&apos;t answering.
          Check{" "}
          <a href="/api/health" className="font-semibold text-[#F57F00] underline underline-offset-2">
            /api/health
          </a>{" "}
          to see which piece is down.
        </p>
        {error.digest && <p className="text-[11px] text-charcoal-40">Error digest: {error.digest}</p>}
        <button
          type="button"
          onClick={reset}
          className="lq-btn lq-btn--primary"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
