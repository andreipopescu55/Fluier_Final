import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listVenues } from '../api/resources'
import { useAuth } from '../auth/AuthContext'
import { SPORT_LABELS } from '../lib/labels'

const SPORT_OPTIONS = Object.entries(SPORT_LABELS)

export default function HomePage() {
  const { user } = useAuth()
  const [venues, setVenues] = useState([])
  const [cities, setCities] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Filtre
  const [q, setQ] = useState('')
  const [sport, setSport] = useState('')
  const [city, setCity] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')

  // Debounce pe căutarea text (evităm un request la fiecare tastă).
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300)
    return () => clearTimeout(t)
  }, [q])

  // Lista de orașe pentru dropdown — o luăm o singură dată (toate bazele).
  useEffect(() => {
    let active = true
    listVenues()
      .then((data) => active && setCities([...new Set(data.map((v) => v.city))].sort()))
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  // Re-interogăm la schimbarea filtrelor.
  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    const params = {}
    if (debouncedQ.trim()) params.q = debouncedQ.trim()
    if (sport) params.sport = sport
    if (city) params.city = city
    listVenues(params)
      .then((data) => active && setVenues(data))
      .catch(() => active && setError('Nu am putut încărca bazele sportive.'))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [debouncedQ, sport, city])

  const hasFilters = Boolean(q || sport || city)

  function resetFilters() {
    setQ('')
    setSport('')
    setCity('')
  }

  return (
    <div className="space-y-10">
      {/* Hero */}
      <section className="rounded-3xl bg-white p-10 text-center shadow-xl ring-1 ring-slate-100">
        <span className="inline-block rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
          Rezervări online
        </span>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-slate-900">
          Rezervă terenul tău <span className="text-brand-600">în câteva secunde</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-slate-500">
          {user
            ? `Bine ai venit, ${user.full_name}! Caută o bază sportivă mai jos.`
            : 'Caută baze sportive, vezi disponibilitatea și rezervă online.'}
        </p>
      </section>

      {/* Bara de căutare / filtrare */}
      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Caută după nume, oraș sau județ…"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
          <select
            value={sport}
            onChange={(e) => setSport(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          >
            <option value="">Toate sporturile</option>
            {SPORT_OPTIONS.map(([val, label]) => (
              <option key={val} value={val}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          >
            <option value="">Toate orașele</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={resetFilters}
            disabled={!hasFilters}
            className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-40"
          >
            Resetează
          </button>
        </div>
      </section>

      {/* Lista baze sportive */}
      <section>
        <h2 className="mb-4 text-xl font-extrabold text-slate-900">
          Baze sportive
          {!loading && (
            <span className="ml-2 text-sm font-medium text-slate-400">({venues.length})</span>
          )}
        </h2>

        {loading && <p className="text-slate-500">Se încarcă…</p>}
        {error && <p className="text-red-600">{error}</p>}
        {!loading && !error && venues.length === 0 && (
          <p className="text-slate-500">
            {hasFilters
              ? 'Nicio bază nu corespunde filtrelor alese.'
              : 'Nu există baze sportive disponibile momentan.'}
          </p>
        )}

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {venues.map((v) => (
            <Link
              key={v.id}
              to={`/venue/${v.slug}`}
              className="group rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100 transition hover:shadow-lg hover:ring-brand-200"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-xl">
                ⚽
              </div>
              <h3 className="mt-4 text-lg font-bold text-slate-900 group-hover:text-brand-700">
                {v.name}
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                {v.city}, {v.county}
              </p>
              <span className="mt-4 inline-block text-sm font-semibold text-brand-600">
                Vezi terenurile →
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
