import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getVenue, listVenueFields } from '../api/resources'
import { SPORT_LABELS, SURFACE_LABELS } from '../lib/labels'

// Afiseaza ora fara secunde: "08:00:00" -> "08:00"
function hhmm(t) {
  return t ? t.slice(0, 5) : ''
}

export default function VenuePage() {
  const { slug } = useParams()
  const [venue, setVenue] = useState(null)
  const [fields, setFields] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    // 1) detaliul bazei (dupa slug) -> avem id-ul, apoi 2) terenurile ei.
    getVenue(slug)
      .then((v) => {
        if (!active) return
        setVenue(v)
        return listVenueFields(v.id).then((f) => active && setFields(f))
      })
      .catch(() => active && setError('Baza sportivă nu a fost găsită.'))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [slug])

  if (loading) return <p className="text-slate-500">Se încarcă…</p>
  if (error) return <p className="text-red-600">{error}</p>
  if (!venue) return null

  return (
    <div className="space-y-8">
      <Link to="/" className="text-sm font-semibold text-brand-600 hover:underline">
        ← Toate bazele
      </Link>

      {/* Antet baza */}
      <section className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-100">
        <h1 className="text-2xl font-extrabold text-slate-900">{venue.name}</h1>
        <p className="mt-1 text-slate-500">
          {venue.address}, {venue.city}, {venue.county}
        </p>
        <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-600">
          <span>🕒 Program: {hhmm(venue.opening_time)}–{hhmm(venue.closing_time)}</span>
          {venue.phone && <span>📞 {venue.phone}</span>}
        </div>
        {venue.description && <p className="mt-4 text-slate-600">{venue.description}</p>}
      </section>

      {/* Terenuri */}
      <section>
        <h2 className="mb-4 text-xl font-extrabold text-slate-900">Terenuri</h2>
        {fields.length === 0 && (
          <p className="text-slate-500">Această bază nu are terenuri active.</p>
        )}
        <div className="grid gap-5 sm:grid-cols-2">
          {fields.map((f) => (
            <div
              key={f.id}
              className="flex flex-col rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100"
            >
              <h3 className="text-lg font-bold text-slate-900">{f.name}</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">
                  {SPORT_LABELS[f.sport_type] ?? f.sport_type}
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                  {SURFACE_LABELS[f.surface_type] ?? f.surface_type}
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                  {f.is_indoor ? 'Acoperit' : 'În aer liber'}
                </span>
              </div>
              <p className="mt-3 text-sm text-slate-500">
                Slot {f.slot_duration_minutes} min · minim {f.min_booking_minutes} min
              </p>
              <Link
                to={`/rezervare/${f.id}`}
                className="mt-5 inline-block rounded-lg bg-brand-600 px-4 py-2 text-center text-sm font-semibold text-white transition hover:bg-brand-700"
              >
                Rezervă
              </Link>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
