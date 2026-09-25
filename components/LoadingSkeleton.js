export default function LoadingSkeleton({ variant = "list", label = "Loading content" }) {
  const dashboard = variant === "dashboard";
  const profile = variant === "profile";
  const cards = variant === "course" ? 3 : variant === "profile" ? 2 : 4;
  return <main className="min-h-screen app-shell px-4 sm:px-6 py-8" role="status" aria-label={label} aria-busy="true">
    <span className="sr-only">{label}</span>
    <div className="max-w-6xl mx-auto" aria-hidden="true">
      <div className="skeleton skeleton-line w-28 mb-5" />
      <div className="skeleton skeleton-title w-2/3 max-w-md mb-3" />
      <div className="skeleton skeleton-line w-1/2 max-w-xs mb-8" />
      {dashboard && <div className="skeleton skeleton-hero mb-7" />}
      {variant === "course" && <div className="skeleton skeleton-banner mb-7" />}
      <div className={dashboard || variant === "course" ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" : profile ? "grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl" : "space-y-4 max-w-4xl"}>
        {Array.from({ length: cards }, (_, i) => <div key={i} className="skeleton-card">
          {(dashboard || variant === "course") && <div className="skeleton skeleton-card-image mb-5" />}
          <div className="skeleton skeleton-line w-24 mb-4" />
          <div className="skeleton skeleton-line w-4/5 mb-3" />
          <div className="skeleton skeleton-line w-3/5 mb-5" />
          <div className="skeleton skeleton-line w-full" />
        </div>)}
      </div>
    </div>
  </main>;
}
