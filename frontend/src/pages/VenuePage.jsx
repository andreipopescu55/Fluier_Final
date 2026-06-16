import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getVenue, listVenueFields, getVenueRating, rateVenue } from '../api/resources'
import { useAuth } from '../auth/AuthContext'
import { SURFACE_LABELS, fieldFormat } from '../lib/labels'
import { Skeleton } from '../components/ui/Skeleton'
import EmptyState from '../components/ui/EmptyState'
import { RatingBadge, StarRating } from '../components/ui/Stars'
import {
  PitchIcon, MapPinIcon, ClockIcon, PhoneIcon, ArrowRightIcon, ArrowLeftIcon,
} from '../components/ui/icons'

const hhmm = (t) => (t ? t.slice(0, 5) : '')

export default function VenuePage() {
  const { slug } = useParams()
  const { user } = useAuth()
  const [venue, setVenue] = useState(null)
  const [fields, setFields] = useState([])
  const [rating, setRating] = useState(null) // { average, count, my_score }
  const [ratingBusy, setRatingBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    getVenue(slug)
      .then((v) => {
        if (!active) return
        setVenue(v)
        getVenueRating(v.id).then((rs) => active && setRating(rs)).catch(() => {})
        return listVenueFields(v.id).then((f) => active && setFields(f))
      })
      .catch(() => active && setError('Baza sportivă nu a fost găsită.'))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [slug])

  async function handleRate(score) {
    if (!user || !venue) return
    setRatingBusy(true)
    try {
      const updated = await rateVenue(venue.id, score)
      setRating(updated)
    } catch {
      /* lasam UI-ul neschimbat la eroare */
    } finally {
      setRatingBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <div className="grid gap-5 sm:grid-cols-2">
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      </div>
    )
  }
  if (error) return <p className="text-red-400">{error}</p>
  if (!venue) return null

  return (
    <div className="space-y-8">
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-sm font-semibold text-accent-400 transition hover:text-accent-300"
      >
        <ArrowLeftIcon className="h-4 w-4" /> Toate bazele
      </Link>

      {/* Antet baza */}
      <section className="animate-fade-in-up overflow-hidden rounded-2xl bg-panel ring-1 ring-line">
        <div className="h-2 bg-gradient-to-r from-accent-500 to-accent-400" />
        <div className="p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <span className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent-400/10 text-accent-400 sm:flex">
              <PitchIcon className="h-7 w-7" />
            </span>
            <div className="min-w-0">
              <h1 className="text-2xl font-extrabold text-white">{venue.name}</h1>
              <p className="mt-1 flex items-center gap-1.5 text-slate-400">
                <MapPinIcon className="h-4 w-4 shrink-0 text-slate-500" />
                {venue.address}, {venue.city}, {venue.county}
              </p>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-300">
                <span className="inline-flex items-center gap-1.5">
                  <ClockIcon className="h-4 w-4 text-slate-500" />
                  {hhmm(venue.opening_time)}–{hhmm(venue.closing_time)}
                </span>
                {venue.phone && (
                  <span className="inline-flex items-center gap-1.5">
                    <PhoneIcon className="h-4 w-4 text-slate-500" />
                    {venue.phone}
                  </span>
                )}
                {rating && <RatingBadge avg={rating.average} count={rating.count} />}
              </div>
              {venue.description && <p className="mt-4 text-slate-300">{venue.description}</p>}
            </div>
          </div>
        </div>
      </section>

      {/* Evaluează baza */}
      <section className="rounded-2xl bg-panel p-6 ring-1 ring-line">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-white">Evaluează această bază</h2>
            <p className="mt-1 text-sm text-slate-400">
              {rating?.count
                ? `Media: ${Number(rating.average).toFixed(1)} din ${rating.count} ${
                    rating.count === 1 ? 'evaluare' : 'evaluări'
                  }.`
                : 'Fii primul care evaluează.'}
            </p>
          </div>
          {!user ? (
            <div className="flex flex-col items-end gap-1.5">
              <StarRating value={rating?.average ?? 0} readOnly size="h-7 w-7" />
              <Link to="/login" className="text-sm font-semibold text-accent-400 hover:text-accent-300">
                Autentifică-te ca să evaluezi →
              </Link>
            </div>
          ) : rating?.can_rate ? (
            <div className="text-right">
              <StarRating value={rating?.my_score ?? 0} onRate={handleRate} disabled={ratingBusy} />
              <p className="mt-1 text-xs text-slate-500">
                {rating?.my_score ? `Evaluarea ta: ${rating.my_score}/5` : 'Apasă o stea'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-end gap-1.5">
              <StarRating value={rating?.average ?? 0} readOnly size="h-7 w-7" />
              <p className="max-w-[16rem] text-right text-xs text-slate-500">
                🔒 Te așteptăm cu o evaluare imediat ce ai terminat de jucat și sesiunea ta s-a încheiat!
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Terenuri */}
      <section>
        <h2 className="mb-4 text-xl font-extrabold text-white">
          Terenuri
          <span className="ml-2 text-sm font-medium text-slate-500">({fields.length})</span>
        </h2>

        {fields.length === 0 ? (
          <EmptyState
            icon={<PitchIcon className="h-7 w-7" />}
            title="Niciun teren disponibil"
            description="Această bază nu are terenuri active momentan."
          />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            {fields.map((f, i) => (
              <div
                key={f.id}
                style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                className="group flex flex-col rounded-2xl bg-panel p-6 ring-1 ring-line transition duration-200 animate-fade-in-up hover:-translate-y-1 hover:ring-accent-400/50"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-400/10 text-accent-400 transition group-hover:bg-accent-400 group-hover:text-ink">
                    <PitchIcon className="h-6 w-6" />
                  </span>
                  <h3 className="text-lg font-bold text-white">{f.name}</h3>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-accent-400/10 px-2.5 py-1 text-xs font-semibold text-accent-400">
                    {fieldFormat(f)}
                  </span>
                  <span className="rounded-full bg-panel-2 px-2.5 py-1 text-xs font-semibold text-slate-300">
                    {SURFACE_LABELS[f.surface_type] ?? f.surface_type}
                  </span>
                  <span className="rounded-full bg-panel-2 px-2.5 py-1 text-xs font-semibold text-slate-300">
                    {f.is_indoor ? 'Acoperit' : 'În aer liber'}
                  </span>
                </div>

                <p className="mt-3 text-sm text-slate-400">
                  Slot {f.slot_duration_minutes} min · minim {f.min_booking_minutes} min
                </p>

                <Link
                  to={`/rezervare/${f.id}`}
                  className="mt-5 inline-flex items-center justify-center gap-1.5 rounded-lg bg-accent-400 px-4 py-2.5 text-sm font-bold text-ink transition hover:bg-accent-300"
                >
                  Rezervă
                  <ArrowRightIcon className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
