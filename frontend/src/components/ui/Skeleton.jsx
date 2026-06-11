// Skeleton loader cu shimmer — folosit in loc de "Se încarcă…" la operatii >1s
// (regula UX: progressive-loading / content-jumping; rezervam spatiul ca sa nu
// existe layout shift).

export function Skeleton({ className = '' }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />
}

// Card-placeholder pentru o baza sportiva (oglindeste structura cardului real).
export function VenueCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl bg-panel ring-1 ring-line">
      <Skeleton className="h-36 w-full rounded-none" />
      <div className="p-5">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="mt-2 h-4 w-1/2" />
        <Skeleton className="mt-4 h-9 w-full" />
      </div>
    </div>
  )
}

// Grila de skeleton-uri (cate carduri vrem in timpul incarcarii).
export function VenueGridSkeleton({ count = 6 }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <VenueCardSkeleton key={i} />
      ))}
    </div>
  )
}
