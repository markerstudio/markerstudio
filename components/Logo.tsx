import Link from "next/link";

export default function Logo({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="Marker home"
      className={`group inline-flex items-center gap-2 ${className}`}
    >
      <span className="relative inline-flex h-9 w-9 items-center justify-center rotate-[-6deg] rounded-xl border-2 border-ink bg-marker-yellow shadow-[3px_3px_0_0_#101014] transition-transform duration-150 group-hover:rotate-3">
        {/* Marker nib */}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M3 21l3.5-.7L20 6.8a2.2 2.2 0 0 0 0-3.1l-.7-.7a2.2 2.2 0 0 0-3.1 0L2.7 16.5 2 20l1 1z"
            fill="#101014"
          />
          <path d="M15.5 4.5l4 4" stroke="#FF3D81" strokeWidth="2" />
        </svg>
      </span>
      <span className="font-display text-2xl font-extrabold tracking-tight">
        Marker
        <span className="text-marker-pink">.</span>
      </span>
    </Link>
  );
}
