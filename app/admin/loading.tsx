// Route-level loading UI for every /admin page — shimmering skeleton cards
// shaped like the dashboard so navigation feels instant while the server
// fetches data. The admin header/nav (layout) stays visible above this.
export default function AdminLoading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading">
      {/* Hero strip */}
      <div className="adm-skeleton h-24 rounded-2xl" />

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white border border-neutral-200 rounded-xl px-5 py-4">
            <div className="adm-skeleton h-3 w-20 rounded" />
            <div className="adm-skeleton h-8 w-24 rounded mt-3" />
            <div className="adm-skeleton h-3 w-28 rounded mt-2" />
          </div>
        ))}
      </div>

      {/* Wide panel + side panel */}
      <div className="grid lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 bg-white border border-neutral-200 rounded-xl p-5">
          <div className="adm-skeleton h-4 w-44 rounded mb-5" />
          <div className="adm-skeleton h-40 rounded-lg" />
        </div>
        <div className="lg:col-span-2 bg-white border border-neutral-200 rounded-xl p-5">
          <div className="adm-skeleton h-4 w-36 rounded mb-5" />
          <div className="space-y-3">
            <div className="adm-skeleton h-9 rounded-lg" />
            <div className="adm-skeleton h-9 rounded-lg" />
            <div className="adm-skeleton h-9 rounded-lg" />
            <div className="adm-skeleton h-9 rounded-lg" />
          </div>
        </div>
      </div>

      {/* Two list panels */}
      <div className="grid lg:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="bg-white border border-neutral-200 rounded-xl p-5">
            <div className="adm-skeleton h-4 w-36 rounded mb-5" />
            <div className="space-y-3">
              <div className="adm-skeleton h-9 rounded-lg" />
              <div className="adm-skeleton h-9 rounded-lg" />
              <div className="adm-skeleton h-9 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
