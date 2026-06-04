import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom'
import { getField, getFieldPricing, createBooking } from '../api/resources'
import { useAuth } from '../auth/AuthContext'
import { SURFACE_LABELS, fieldFormat } from '../lib/labels'
import {
  dowFromDate,
  buildDaySlots,
  estimatePrice,
  minutesToTime,
  localISO,
  defaultBookingDate,
  formatDateRo,
  toDateStr,
} from '../lib/booking'

export default function BookingPage() {
  const { fieldId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [field, setField] = useState(null)
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Starea selectiei
  const [date, setDate] = useState('')
  const [startMin, setStartMin] = useState(null)
  const [duration, setDuration] = useState(null)

  // Sloturi care au dat 409 (deja rezervate) — le marcam local ca indisponibile.
  const [takenStarts, setTakenStarts] = useState(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState(null)

  // 1) Incarcam terenul + regulile de pret.
  useEffect(() => {
    let active = true
    Promise.all([getField(fieldId), getFieldPricing(fieldId)])
      .then(([f, p]) => {
        if (!active) return
        setField(f)
        setRules(p)
        setDate(defaultBookingDate(p)) // pornim pe prima zi cu tarife
      })
      .catch(() => active && setError('Terenul nu a fost găsit.'))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [fieldId])

  const slotDuration = field?.slot_duration_minutes ?? 30
  const minBooking = field?.min_booking_minutes ?? 60
  const dow = date ? dowFromDate(date) : null

  // Sloturile zilei (minute de start) derivate din tarife.
  const slots = useMemo(
    () => (date ? buildDaySlots(rules, dow, slotDuration) : []),
    [rules, date, dow, slotDuration],
  )

  // Optiuni de durata: multipli ai slotului, de la minimul terenului pana la 4h.
  const durationOptions = useMemo(() => {
    const opts = []
    for (let d = minBooking; d <= 240; d += slotDuration) opts.push(d)
    return opts
  }, [minBooking, slotDuration])

  // Dezactivam sloturile din trecut daca data aleasa e azi.
  const todayStr = toDateStr(new Date())
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes()

  // Pretul estimat pentru selectia curenta (null = interval neacoperit/indisponibil).
  const price =
    startMin != null && duration != null
      ? estimatePrice(rules, dow, startMin, duration, slotDuration)
      : null

  function resetSelection() {
    setStartMin(null)
    setDuration(null)
    setFormError(null)
  }

  function onChangeDate(e) {
    setDate(e.target.value)
    resetSelection()
  }

  async function handleBooking() {
    setFormError(null)

    // Trebuie sa fii logat ca sa rezervi.
    if (!user) {
      navigate('/login', { state: { from: location } })
      return
    }
    if (startMin == null || duration == null || price == null) return

    setSubmitting(true)
    try {
      await createBooking({
        field_id: fieldId,
        start_time: localISO(date, startMin),
        end_time: localISO(date, startMin + duration),
      })
      // Succes -> mergem la "Rezervările mele".
      navigate('/rezervarile-mele', { state: { justBooked: true } })
    } catch (err) {
      const status = err.response?.status
      if (status === 409) {
        // Slot ocupat -> il marcam ca indisponibil si cerem alta alegere.
        setTakenStarts((prev) => new Set(prev).add(startMin))
        setFormError('Acest interval tocmai a fost ocupat. Alege altul.')
        resetSelection()
      } else if (status === 422) {
        setFormError('Interval invalid pentru acest teren. Verifică ora și durata.')
      } else if (status === 401) {
        navigate('/login', { state: { from: location } })
      } else {
        setFormError('A apărut o eroare. Încearcă din nou.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <p className="text-slate-500">Se încarcă…</p>
  if (error) return <p className="text-red-600">{error}</p>
  if (!field) return null

  return (
    <div className="space-y-6">
      <Link to="/" className="text-sm font-semibold text-brand-600 hover:underline">
        ← Înapoi
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Coloana stanga: selectie */}
        <div className="space-y-6">
          {/* Antet teren */}
          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
            <h1 className="text-2xl font-extrabold text-slate-900">{field.name}</h1>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">
                {fieldFormat(field)}
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                {SURFACE_LABELS[field.surface_type] ?? field.surface_type}
              </span>
            </div>
          </section>

          {/* Data */}
          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">Data</span>
              <input
                type="date"
                value={date}
                min={todayStr}
                onChange={onChangeDate}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </label>
            <p className="mt-2 text-sm text-slate-500">{date && formatDateRo(date)}</p>
          </section>

          {/* Sloturi */}
          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">Oră de început</h2>
            {slots.length === 0 ? (
              <p className="text-sm text-slate-500">
                Nu există tarife (deci nici sloturi) pentru această zi. Alege altă dată.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {slots.map((m) => {
                  const isTaken = takenStarts.has(m)
                  const isPast = date === todayStr && m <= nowMin
                  const disabled = isTaken || isPast
                  const selected = m === startMin
                  return (
                    <button
                      key={m}
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        setStartMin(m)
                        setDuration((d) => d ?? minBooking)
                        setFormError(null)
                      }}
                      className={[
                        'rounded-lg px-2 py-2 text-sm font-semibold transition',
                        selected
                          ? 'bg-brand-600 text-white'
                          : disabled
                            ? 'cursor-not-allowed bg-slate-100 text-slate-300 line-through'
                            : 'bg-slate-100 text-slate-700 hover:bg-brand-50 hover:text-brand-700',
                      ].join(' ')}
                    >
                      {minutesToTime(m)}
                    </button>
                  )
                })}
              </div>
            )}
          </section>

          {/* Durata */}
          {startMin != null && (
            <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
              <h2 className="mb-3 text-sm font-semibold text-slate-700">Durată</h2>
              <div className="flex flex-wrap gap-2">
                {durationOptions.map((d) => {
                  const est = estimatePrice(rules, dow, startMin, d, slotDuration)
                  const ok = est != null
                  const selected = d === duration
                  return (
                    <button
                      key={d}
                      type="button"
                      disabled={!ok}
                      onClick={() => setDuration(d)}
                      className={[
                        'rounded-lg px-3 py-2 text-sm font-semibold transition',
                        selected
                          ? 'bg-brand-600 text-white'
                          : ok
                            ? 'bg-slate-100 text-slate-700 hover:bg-brand-50 hover:text-brand-700'
                            : 'cursor-not-allowed bg-slate-50 text-slate-300',
                      ].join(' ')}
                    >
                      {d % 60 === 0 ? `${d / 60}h` : `${Math.floor(d / 60)}h${d % 60}`}
                    </button>
                  )
                })}
              </div>
            </section>
          )}
        </div>

        {/* Coloana dreapta: sumar */}
        <aside className="h-fit rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100 lg:sticky lg:top-20">
          <h2 className="text-lg font-bold text-slate-900">Sumar rezervare</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Teren</dt>
              <dd className="font-semibold text-slate-900">{field.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Data</dt>
              <dd className="font-semibold text-slate-900">{date}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Interval</dt>
              <dd className="font-semibold text-slate-900">
                {startMin != null && duration != null
                  ? `${minutesToTime(startMin)}–${minutesToTime(startMin + duration)}`
                  : '—'}
              </dd>
            </div>
          </dl>

          <div className="mt-4 border-t border-slate-100 pt-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-slate-500">Preț estimat</span>
              <span className="text-2xl font-extrabold text-slate-900">
                {price != null ? `${price.toFixed(2)} RON` : '—'}
              </span>
            </div>
          </div>

          {formError && (
            <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {formError}
            </p>
          )}

          <button
            onClick={handleBooking}
            disabled={submitting || startMin == null || duration == null || price == null}
            className="mt-4 w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
          >
            {submitting ? 'Se rezervă…' : user ? 'Rezervă' : 'Autentifică-te ca să rezervi'}
          </button>
          <p className="mt-3 text-center text-xs text-slate-400">
            Prețul final e confirmat de server la rezervare.
          </p>
        </aside>
      </div>
    </div>
  )
}
