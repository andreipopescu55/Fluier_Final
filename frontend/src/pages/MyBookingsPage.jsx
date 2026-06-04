import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { listMyBookings, cancelBooking, getField } from '../api/resources'
import { BOOKING_STATUS, SPORT_LABELS } from '../lib/labels'
import { formatDateTimeRo } from '../lib/booking'

// Doar ora ("18:00") dintr-un datetime ISO al backend-ului.
function timeRo(iso) {
  return new Date(iso).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })
}

// O rezervare e anulabila daca e activa (pending/confirmed) si nu a inceput inca.
function isCancellable(b) {
  const active = b.status === 'pending' || b.status === 'confirmed'
  return active && new Date(b.start_time) > new Date()
}

export default function MyBookingsPage() {
  const location = useLocation()
  const [bookings, setBookings] = useState([])
  const [fields, setFields] = useState({}) // field_id -> { name, sport_type }
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Banner de succes daca tocmai am venit din fluxul de rezervare.
  const [justBooked, setJustBooked] = useState(Boolean(location.state?.justBooked))

  const [cancellingId, setCancellingId] = useState(null)
  const [actionError, setActionError] = useState(null)

  // 1) Incarcam rezervarile, apoi numele terenurilor (un fetch per teren unic).
  useEffect(() => {
    let active = true
    listMyBookings()
      .then(async (list) => {
        if (!active) return
        setBookings(list)
        const ids = [...new Set(list.map((b) => b.field_id))]
        const results = await Promise.allSettled(ids.map((id) => getField(id)))
        if (!active) return
        const map = {}
        results.forEach((r, i) => {
          if (r.status === 'fulfilled') map[ids[i]] = r.value
        })
        setFields(map)
      })
      .catch(() => active && setError('Nu am putut încărca rezervările.'))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [])

  // Impartim in "viitoare" (activ + neînceput) si "istoric" (restul).
  const { upcoming, history } = useMemo(() => {
    const up = []
    const hist = []
    for (const b of bookings) {
      if (isCancellable(b)) up.push(b)
      else hist.push(b)
    }
    up.sort((a, b) => new Date(a.start_time) - new Date(b.start_time)) // cele apropiate primele
    hist.sort((a, b) => new Date(b.start_time) - new Date(a.start_time)) // recente primele
    return { upcoming: up, history: hist }
  }, [bookings])

  async function handleCancel(booking) {
    setActionError(null)
    setCancellingId(booking.id)
    try {
      const updated = await cancelBooking(booking.id)
      // Inlocuim rezervarea cu varianta intoarsa de server (status=cancelled).
      setBookings((prev) => prev.map((b) => (b.id === updated.id ? updated : b)))
    } catch (err) {
      const status = err.response?.status
      setActionError(
        status === 409
          ? 'Rezervarea nu mai poate fi anulată.'
          : 'Anularea a eșuat. Încearcă din nou.',
      )
    } finally {
      setCancellingId(null)
    }
  }

  function fieldLabel(fieldId) {
    const f = fields[fieldId]
    if (!f) return 'Teren'
    const sport = SPORT_LABELS[f.sport_type] ?? f.sport_type
    return `${f.name} · ${sport}`
  }

  function renderCard(b) {
    const st = BOOKING_STATUS[b.status] ?? { label: b.status, cls: 'bg-slate-100 text-slate-600' }
    const canCancel = isCancellable(b)
    return (
      <li
        key={b.id}
        className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold text-slate-900">{fieldLabel(b.field_id)}</h3>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.cls}`}>
              {st.label}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {formatDateTimeRo(b.start_time)}–{timeRo(b.end_time)}
          </p>
          {b.notes && <p className="mt-1 text-sm text-slate-400">{b.notes}</p>}
        </div>

        <div className="flex items-center gap-4 sm:flex-col sm:items-end">
          <span className="whitespace-nowrap text-lg font-extrabold text-slate-900">
            {Number(b.total_price).toFixed(2)} {b.currency}
          </span>
          {canCancel && (
            <button
              type="button"
              onClick={() => handleCancel(b)}
              disabled={cancellingId === b.id}
              className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
            >
              {cancellingId === b.id ? 'Se anulează…' : 'Anulează'}
            </button>
          )}
        </div>
      </li>
    )
  }

  if (loading) return <p className="text-slate-500">Se încarcă…</p>
  if (error) return <p className="text-red-600">{error}</p>

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">Rezervările mele</h1>
        <p className="mt-1 text-slate-500">Gestionează rezervările tale curente și trecute.</p>
      </div>

      {justBooked && (
        <div className="flex items-start justify-between gap-3 rounded-2xl bg-mint-50 px-4 py-3 text-sm font-medium text-mint-600 ring-1 ring-mint-500/20">
          <span>✓ Rezervarea ta a fost înregistrată.</span>
          <button
            type="button"
            onClick={() => setJustBooked(false)}
            className="text-mint-600/70 hover:text-mint-600"
          >
            ✕
          </button>
        </div>
      )}

      {actionError && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {actionError}
        </p>
      )}

      {bookings.length === 0 ? (
        <div className="rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-100">
          <p className="text-slate-500">Nu ai nicio rezervare încă.</p>
          <Link
            to="/"
            className="mt-4 inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            Caută un teren
          </Link>
        </div>
      ) : (
        <>
          <section>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
              Următoarele rezervări
            </h2>
            {upcoming.length === 0 ? (
              <p className="text-sm text-slate-400">Nu ai rezervări viitoare.</p>
            ) : (
              <ul className="space-y-3">{upcoming.map(renderCard)}</ul>
            )}
          </section>

          {history.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
                Istoric
              </h2>
              <ul className="space-y-3">{history.map(renderCard)}</ul>
            </section>
          )}
        </>
      )}
    </div>
  )
}
