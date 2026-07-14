import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listMatches, listMyMatches } from '../api/resources'
import { useAuth } from '../auth/AuthContext'
import { SKILL_LABELS, MATCH_STATUS, MATCH_EXPIRED, isMatchExpired, PARTICIPANT_STATUS, sportLabel, SPORT_LABELS } from '../lib/labels'
import { VenueGridSkeleton } from '../components/ui/Skeleton'
import EmptyState from '../components/ui/EmptyState'
import { UsersIcon, MapPinIcon, ClockIcon, ArrowRightIcon } from '../components/ui/icons'

function dayLabel(iso) {
  return new Date(iso).toLocaleDateString('ro-RO', { weekday: 'short', day: 'numeric', month: 'short' })
}
function timeRo(iso) {
  return new Date(iso).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })
}

// Bara de locuri ocupate (taken / total).
function SpotsBar({ taken, total }) {
  const pct = Math.min(100, Math.round((taken / total) * 100))
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-semibold text-slate-300">
          {taken}/{total} jucători
        </span>
        <span className="text-slate-500">{total - taken} locuri libere</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-panel-2">
        <div className="h-full rounded-full bg-accent-400 transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export function MatchCard({ m }) {
  // In "Meciurile mele" apar si meciuri trecute — le etichetam "Expirat".
  const st = isMatchExpired(m)
    ? MATCH_EXPIRED
    : MATCH_STATUS[m.status] ?? { label: m.status, cls: 'bg-panel-2 text-slate-400' }
  const mine = m.my_status ? PARTICIPANT_STATUS[m.my_status] : null
  return (
    <Link
      to={`/meciuri/${m.id}`}
      className="group flex flex-col rounded-2xl bg-panel p-5 ring-1 ring-line transition duration-200 hover:-translate-y-1 hover:ring-accent-400/50"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-bold text-white group-hover:text-accent-400">{m.venue_name}</h3>
          <p className="mt-0.5 flex items-center gap-1 text-sm text-slate-400">
            <MapPinIcon className="h-4 w-4 text-slate-500" />
            {m.city} · {m.field_name}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.cls}`}>
          {st.label}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <span className="rounded-full bg-accent-400/10 px-2.5 py-1 text-xs font-semibold text-accent-400">
          {sportLabel(m.sport_type)}
        </span>
        <span className="rounded-full bg-panel-2 px-2.5 py-1 text-xs font-semibold text-slate-300">
          {SKILL_LABELS[m.skill_level]}
        </span>
        {m.price_per_player != null && (
          <span className="rounded-full bg-panel-2 px-2.5 py-1 text-xs font-semibold text-slate-300">
            {Number(m.price_per_player).toFixed(0)} RON/jucător
          </span>
        )}
      </div>

      <p className="mt-3 flex items-center gap-1.5 text-sm text-slate-300">
        <ClockIcon className="h-4 w-4 text-slate-500" />
        <span className="font-semibold capitalize">{dayLabel(m.start_time)}</span>
        <span className="text-slate-400">{timeRo(m.start_time)}–{timeRo(m.end_time)}</span>
      </p>

      <div className="mt-4">
        <SpotsBar taken={m.spots_taken} total={m.total_spots} />
      </div>

      <div className="mt-4 flex items-center justify-between">
        {mine ? (
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${mine.cls}`}>{mine.label}</span>
        ) : m.is_organizer ? (
          <span className="text-xs font-semibold text-slate-400">Organizat de tine</span>
        ) : (
          <span className="text-xs text-slate-500">org: {m.organizer_name}</span>
        )}
        <span className="flex items-center gap-1 text-sm font-semibold text-accent-400">
          Detalii <ArrowRightIcon className="h-4 w-4 transition group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  )
}

export default function MatchesPage() {
  const { isAuthenticated } = useAuth()
  const [tab, setTab] = useState('open') // 'open' | 'mine'
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Filtre (aplicate client-side pe lista incarcata)
  const [city, setCity] = useState('')
  const [sport, setSport] = useState('')
  const [skill, setSkill] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    const fetcher = tab === 'mine' ? listMyMatches() : listMatches()
    fetcher
      .then((data) => active && setMatches(data))
      .catch(() => active && setError('Nu am putut încărca meciurile.'))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [tab])

  const cities = useMemo(
    () => [...new Set(matches.map((m) => m.city))].sort(),
    [matches],
  )

  const filtered = useMemo(() => {
    return matches.filter(
      (m) =>
        (!city || m.city === city) &&
        (!sport || m.sport_type === sport) &&
        (!skill || m.skill_level === skill),
    )
  }, [matches, city, sport, skill])

  const hasFilters = Boolean(city || sport || skill)
  const selectCls =
    'cursor-pointer rounded-xl border border-line bg-panel-2 px-3 py-2 text-sm text-slate-200 outline-none focus:border-accent-400'

  return (
    <div className="space-y-8">
      {/* Header */}
      <section className="relative -mx-4 overflow-hidden border-b border-line bg-ink-2 px-4 py-12">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-accent-400/10 to-transparent" />
        <div className="relative mx-auto max-w-3xl text-center">
          <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-400/10 text-accent-400">
            <UsersIcon className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Găsește un meci
          </h1>
          <p className="mt-2 text-slate-400">
            N-ai echipă completă? Alătură-te unui meci deschis sau deschide-l tu pe al tău.
          </p>
        </div>
      </section>

      {/* Taburi */}
      {isAuthenticated && (
        <div className="flex gap-1 rounded-xl border border-line bg-panel p-1">
          {[
            ['open', 'Meciuri deschise'],
            ['mine', 'Ale mele'],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={[
                'flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition',
                tab === key ? 'bg-accent-400 text-ink' : 'text-slate-300 hover:text-white',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Filtre (doar pe tab-ul "deschise") */}
      {tab === 'open' && (
        <div className="flex flex-wrap items-center gap-2">
          <select value={city} onChange={(e) => setCity(e.target.value)} aria-label="Oraș" className={selectCls}>
            <option value="">Toate orașele</option>
            {cities.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select value={sport} onChange={(e) => setSport(e.target.value)} aria-label="Format" className={selectCls}>
            <option value="">Orice format</option>
            {Object.entries(SPORT_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
          <select value={skill} onChange={(e) => setSkill(e.target.value)} aria-label="Nivel" className={selectCls}>
            <option value="">Orice nivel</option>
            {Object.entries(SKILL_LABELS)
              .filter(([v]) => v !== 'any')
              .map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
          </select>
          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setCity('')
                setSport('')
                setSkill('')
              }}
              className="rounded-xl border border-line bg-panel px-3 py-2 text-sm font-semibold text-slate-200 transition hover:border-line-2 hover:text-white"
            >
              Resetează
            </button>
          )}
        </div>
      )}

      {/* Continut */}
      {loading ? (
        <VenueGridSkeleton count={4} />
      ) : error ? (
        <p className="text-red-400">{error}</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<UsersIcon className="h-7 w-7" />}
          title={tab === 'mine' ? 'Nu ai niciun meci' : 'Niciun meci deschis'}
          description={
            tab === 'mine'
              ? 'Deschide un meci din „Rezervările mele" sau alătură-te unuia existent.'
              : hasFilters
                ? 'Niciun meci nu corespunde filtrelor. Încearcă să le relaxezi.'
                : 'Momentan nu sunt meciuri deschise. Deschide-l tu pe primul!'
          }
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((m) => (
            <MatchCard key={m.id} m={m} />
          ))}
        </div>
      )}
    </div>
  )
}
