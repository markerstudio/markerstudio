// Route-level loading UI for every /admin page — shimmering lq-skeleton blocks
// shaped like the Marker Glass dashboard so navigation feels instant while the
// server fetches data. The admin chrome (layout) stays visible around this.
export default function AdminLoading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading">
      {/* Greeting header — eyebrow line + big title */}
      <header className="pt-1">
        <div className="lq-skeleton h-3 w-44" />
        <div className="lq-skeleton h-9 w-72 max-w-full mt-2.5" />
      </header>

      {/* Dark agenda panel */}
      <div className="lq-dark p-5">
        <div className="lq-skeleton h-4 w-40 mb-4 opacity-30" />
        <div className="space-y-2.5">
          <div className="lq-skeleton h-9 opacity-20" />
          <div className="lq-skeleton h-9 opacity-20" />
          <div className="lq-skeleton h-9 opacity-20" />
        </div>
      </div>

      {/* KPI stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="lq-card p-4">
            <div className="lq-skeleton h-3 w-20" />
            <div className="lq-skeleton h-7 w-24 mt-3" />
            <div className="lq-skeleton h-3 w-28 mt-2" />
          </div>
        ))}
      </div>

      {/* Tasks + attention panels */}
      <div className="grid lg:grid-cols-5 gap-4">
        <div className="lg:col-span-2 lq-card p-5">
          <div className="lq-skeleton h-4 w-24 mb-4" />
          <div className="space-y-2.5">
            <div className="lq-skeleton h-5" />
            <div className="lq-skeleton h-5" />
            <div className="lq-skeleton h-5" />
            <div className="lq-skeleton h-9 mt-4" />
          </div>
        </div>
        <div className="lg:col-span-3 lq-card p-5">
          <div className="lq-skeleton h-4 w-36 mb-4" />
          <div className="space-y-2.5">
            <div className="lq-skeleton h-9" />
            <div className="lq-skeleton h-9" />
            <div className="lq-skeleton h-9" />
          </div>
        </div>
      </div>

      {/* Wide chart card */}
      <div className="lq-card p-5">
        <div className="lq-skeleton h-4 w-44 mb-5" />
        <div className="lq-skeleton h-40" />
      </div>

      {/* Two list cards */}
      <div className="grid lg:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="lq-card p-5">
            <div className="lq-skeleton h-4 w-36 mb-5" />
            <div className="space-y-3">
              <div className="lq-skeleton h-9" />
              <div className="lq-skeleton h-9" />
              <div className="lq-skeleton h-9" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
