import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listVenues } from '../api/resources'
import { SPORT_BY_LABEL } from '../lib/labels'
import { VenueGridSkeleton } from '../components/ui/Skeleton'
import EmptyState from '../components/ui/EmptyState'
import { PitchIcon, SearchIcon, MapPinIcon, ArrowRightIcon } from '../components/ui/icons'
import { RatingBadge } from '../components/ui/Stars'

const FORMATS = Object.entries(SPORT_BY_LABEL) // [['Fotbal 5+1','football_5'], ...]
const SURFACES = ['Gazon sintetic', 'Gazon natural']
const FACILITIES = ['Parcare', 'Dușuri', 'Nocturnă']

// Art stilizat de teren (vedere de sus) — inlocuieste pozele pe care backend-ul nu le are.
function PitchArt() {
  return (
    <div className="relative h-36 w-full overflow-hidden bg-gradient-to-br from-emerald-700 to-emerald-950">
      <svg
        viewBox="0 0 200 100"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full text-white/15"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
      >
        <rect x="6" y="6" width="188" height="88" rx="2" />
        <line x1="100" y1="6" x2="100" y2="94" />
        <circle cx="100" cy="50" r="14" />
        <path d="M6 32h20v36H6M194 32h-20v36h20" />
      </svg>
    </div>
  )
}

export default function HomePage() {
  const [venues, setVenues] = useState([])
  const [cities, setCities] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Filtre
  const [q, setQ] = useState('')
  const [format, setFormat] = useState('') // valoarea enum (football_5/7/11) sau ''
  const [city, setCity] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false) // pliere filtre pe mobil

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => {
    let active = true
    listVenues()
      .then((data) => active && setCities([...new Set(data.map((v) => v.city))].sort()))
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    const params = {}
    if (debouncedQ.trim()) params.q = debouncedQ.trim()
    if (format) params.sport = format
    if (city) params.city = city
    listVenues(params)
      .then((data) => active && setVenues(data))
      .catch(() => active && setError('Nu am putut încărca bazele sportive.'))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [debouncedQ, format, city])

  const hasFilters = Boolean(q || format || city)

  function resetFilters() {
    setQ('')
    setFormat('')
    setCity('')
  }

  return (
    <div className="space-y-10">
      {/* Hero */}
      <section className="relative -mx-4 overflow-hidden border-b border-line bg-ink-2 px-4 py-16 sm:py-20">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-accent-400/10 to-transparent" />
        <div className="relative mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            Unde vrei să joci astăzi?
          </h1>
          <p className="mt-3 text-slate-400">Găsește, rezervă și joacă — fără telefoane.</p>

          {/* Bara de cautare */}
          <form
            onSubmit={(e) => e.preventDefault()}
            className="mx-auto mt-8 flex max-w-2xl flex-col gap-2 rounded-2xl border border-line bg-panel p-2 shadow-xl sm:flex-row sm:items-center"
          >
            <div className="relative flex-1">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Oraș, județ sau nume bază…"
                aria-label="Caută"
                className="w-full rounded-xl bg-transparent py-2.5 pl-10 pr-3 text-sm text-white placeholder:text-slate-500 outline-none"
              />
            </div>
            <select
              value={city}
              onChange={(e) => setCity(e.target.value)}
              aria-label="Oraș"
              className="cursor-pointer rounded-xl border border-line bg-panel-2 px-3 py-2.5 text-sm text-slate-200 outline-none sm:border-0"
            >
              <option value="">Toate orașele</option>
              {cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-xl bg-accent-400 px-5 py-2.5 text-sm font-bold text-ink transition hover:bg-accent-300"
            >
              Caută Teren
            </button>
          </form>
        </div>
      </section>

      {/* Layout rezultate */}
      <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
        {/* Sidebar filtre */}
        <aside className="space-y-5 lg:space-y-7">
          <button
            type="button"
            onClick={() => setFiltersOpen((o) => !o)}
            className="flex w-full items-center justify-between gap-2 rounded-lg border border-line bg-panel px-3 py-2 text-sm font-bold uppercase tracking-wide text-white transition hover:border-line-2 lg:pointer-events-none lg:border-0 lg:bg-transparent lg:p-0"
          >
            <span className="flex items-center gap-2">
              <span className="text-accent-400">≡</span> Filtre
              {hasFilters && <span className="h-2 w-2 rounded-full bg-accent-400" />}
            </span>
            <span className="text-slate-400 lg:hidden">{filtersOpen ? '▲' : '▼'}</span>
          </button>

          <div className={`${filtersOpen ? 'block' : 'hidden'} space-y-7 lg:block`}>
          {/* Format */}
          <FilterGroup title="Format">
            <div className="flex flex-col gap-2">
              {FORMATS.map(([label, val]) => {
                const active = format === val
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setFormat(active ? '' : val)}
                    className={[
                      'flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm font-medium transition',
                      active ? 'text-accent-400' : 'text-slate-300 hover:text-white',
                    ].join(' ')}
                  >
                    <span
                      className={[
                        'flex h-4 w-4 items-center justify-center rounded border text-[10px]',
                        active ? 'border-accent-400 bg-accent-400 text-ink' : 'border-line',
                      ].join(' ')}
                    >
                      {active ? '✓' : ''}
                    </span>
                    {label}
                  </button>
                )
              })}
            </div>
          </FilterGroup>

          {/* Suprafata (vizual — necesita filtru in backend) */}
          <FilterGroup title="Suprafață" soon>
            <div className="grid grid-cols-2 gap-2">
              {SURFACES.map((s) => (
                <span
                  key={s}
                  className="cursor-not-allowed rounded-lg border border-line px-2 py-1.5 text-center text-xs text-slate-500"
                >
                  {s}
                </span>
              ))}
            </div>
          </FilterGroup>

          {/* Facilitati (vizual) */}
          <FilterGroup title="Facilități" soon>
            <ul className="space-y-2 text-sm text-slate-500">
              {FACILITIES.map((f) => (
                <li key={f} className="flex items-center justify-between">
                  <span>{f}</span>
                  <span className="text-slate-600">—</span>
                </li>
              ))}
            </ul>
          </FilterGroup>
          </div>
        </aside>

        {/* Rezultate */}
        <section>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-white">
                Rezultate{city ? ` în ${city}` : ''}
              </h2>
              {!loading && (
                <p className="text-sm text-slate-400">
                  Am găsit {venues.length} {venues.length === 1 ? 'locație' : 'locații'} pentru tine.
                </p>
              )}
            </div>
            {hasFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="rounded-lg border border-line bg-panel px-3 py-1.5 text-sm font-semibold text-slate-200 transition hover:border-line-2 hover:text-white"
              >
                Resetează filtrele
              </button>
            )}
          </div>

          {loading ? (
            <VenueGridSkeleton count={4} />
          ) : error ? (
            <p className="text-red-400">{error}</p>
          ) : venues.length === 0 ? (
            <EmptyState
              icon={<PitchIcon className="h-7 w-7" />}
              title={hasFilters ? 'Nicio bază găsită' : 'Nu există baze disponibile'}
              description={
                hasFilters
                  ? 'Nicio bază nu corespunde filtrelor. Încearcă să le relaxezi.'
                  : 'Momentan nu sunt baze sportive aprobate.'
              }
              actionLabel={hasFilters ? 'Resetează filtrele' : undefined}
              onAction={resetFilters}
            />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2">
              {venues.map((v, i) => (
                <Link
                  key={v.id}
                  to={`/venue/${v.slug}`}
                  style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                  className="group relative animate-fade-in-up overflow-hidden rounded-2xl bg-panel ring-1 ring-line transition duration-200 hover:-translate-y-1 hover:ring-accent-400/50"
                >
                  <PitchArt />
                  {v.rating_count > 0 && (
                    <div className="absolute right-3 top-3 rounded-full bg-black/55 px-2.5 py-1 backdrop-blur-sm">
                      <RatingBadge avg={v.rating_avg} count={v.rating_count} />
                    </div>
                  )}
                  <div className="p-5">
                    <h3 className="text-base font-bold text-white group-hover:text-accent-400">
                      {v.name}
                    </h3>
                    <p className="mt-1 flex items-center gap-1 text-sm text-slate-400">
                      <MapPinIcon className="h-4 w-4 text-slate-500" />
                      {v.city}, {v.county}
                    </p>
                    <div className="mt-4 flex items-center justify-between">
                      <span className="text-sm font-semibold text-accent-400">Vezi terenurile</span>
                      <span className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-slate-300 transition group-hover:border-accent-400 group-hover:text-accent-400">
                        <ArrowRightIcon className="h-4 w-4" />
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function FilterGroup({ title, soon, children }) {
  return (
    <div>
      <h4 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
        {title}
        {soon && (
          <span className="rounded bg-panel-2 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
            în curând
          </span>
        )}
      </h4>
      {children}
    </div>
  )
}
