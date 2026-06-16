import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { listMyBookings, cancelBooking, getField, listMyMatches, payBookingDeposit } from '../api/resources'
import { BOOKING_STATUS, fieldFormat } from '../lib/labels'
import { formatDateTimeRo } from '../lib/booking'
import { Skeleton } from '../components/ui/Skeleton'
import EmptyState from '../components/ui/EmptyState'
import { PitchIcon, UsersIcon } from '../components/ui/icons'
import CreateMatchModal from '../components/CreateMatchModal'

const CANCEL_CUTOFF_H = 24

function timeRo(iso) {
  return new Date(iso).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })
}

// Activa = viitoare si nu anulata/finalizata (apare la "Următoarele rezervări").
function isUpcoming(b) {
  const active = b.status === 'pending' || b.status === 'confirmed'
  return active && new Date(b.start_time) > new Date()
}

function hoursUntil(iso) {
  return (new Date(iso) - new Date()) / 36e5
}

// Politica de anulare (oglindeste backend-ul): pending oricand; confirmed doar cu ≥24h.
function canCancelNow(b) {
  if (!isUpcoming(b)) return false
  if (b.status === 'pending') return true
  return hoursUntil(b.start_time) >= CANCEL_CUTOFF_H
}

export default function MyBookingsPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [bookings, setBookings] = useState([])
  const [fields, setFields] = useState({})
  const [matchByBooking, setMatchByBooking] = useState({}) // booking_id -> meci
  const [modalBooking, setModalBooking] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [justBooked, setJustBooked] = useState(Boolean(location.state?.justBooked))
  const [justConfirmed, setJustConfirmed] = useState(Boolean(location.state?.justConfirmed))
  const [cancellingId, setCancellingId] = useState(null)
  const [payingId, setPayingId] = useState(null)
  const [actionError, setActionError] = useState(null)

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

    // Meciurile mele -> map dupa booking_id, ca sa stim ce rezervare are deja meci.
    listMyMatches()
      .then((ms) => {
        if (!active) return
        const map = {}
        ms.forEach((m) => { map[m.booking_id] = m })
        setMatchByBooking(map)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  const { upcoming, history } = useMemo(() => {
    const up = []
    const hist = []
    for (const b of bookings) {
      if (isUpcoming(b)) up.push(b)
      else hist.push(b)
    }
    up.sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
    hist.sort((a, b) => new Date(b.start_time) - new Date(a.start_time))
    return { upcoming: up, history: hist }
  }, [bookings])

  async function handleCancel(booking) {
    setActionError(null)
    setCancellingId(booking.id)
    try {
      const updated = await cancelBooking(booking.id)
      setBookings((prev) => prev.map((b) => (b.id === updated.id ? updated : b)))
    } catch (err) {
      setActionError(
        err.response?.data?.detail || 'Anularea a eșuat. Încearcă din nou.',
      )
    } finally {
      setCancellingId(null)
    }
  }

  async function handlePay(booking) {
    setActionError(null)
    setPayingId(booking.id)
    try {
      const updated = await payBookingDeposit(booking.id)
      setBookings((prev) => prev.map((b) => (b.id === updated.id ? updated : b)))
    } catch (err) {
      setActionError(err.response?.data?.detail || 'Plata a eșuat. Încearcă din nou.')
    } finally {
      setPayingId(null)
    }
  }

  function fieldLabel(fieldId) {
    const f = fields[fieldId]
    if (!f) return 'Teren'
    const fmt = fieldFormat(f)
    return fmt ? `${f.name} · ${fmt}` : f.name
  }

  function renderCard(b) {
    const st = BOOKING_STATUS[b.status] ?? { label: b.status, cls: 'bg-panel-2 text-slate-400' }
    const upcoming = isUpcoming(b)
    const isPending = b.status === 'pending'
    const existingMatch = matchByBooking[b.id]
    const total = Number(b.total_price)
    const deposit = b.deposit_amount != null ? Number(b.deposit_amount) : total / 2
    const rest = total - deposit
    return (
      <li
        key={b.id}
        className="flex flex-col gap-3 rounded-2xl bg-panel p-5 ring-1 ring-line transition hover:ring-line-2 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold text-white">{fieldLabel(b.field_id)}</h3>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.cls}`}>
              {st.label}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-300">
            {formatDateTimeRo(b.start_time)}–{timeRo(b.end_time)}
          </p>
          {/* Avans / rest la teren */}
          {b.status === 'confirmed' ? (
            <p className="mt-1 text-xs text-slate-500">
              Avans plătit: <span className="font-semibold text-slate-300">{deposit.toFixed(2)} {b.currency}</span>
              {' · '}De plătit la teren: <span className="font-semibold text-slate-300">{rest.toFixed(2)} {b.currency}</span>
            </p>
          ) : isPending && upcoming ? (
            <p className="mt-1 text-xs text-amber-300">
              Neconfirmată — avans de plată: {deposit.toFixed(2)} {b.currency}
            </p>
          ) : null}
          {b.notes && <p className="mt-1 text-sm text-slate-500">{b.notes}</p>}
        </div>

        <div className="flex items-center gap-4 sm:flex-col sm:items-end">
          <span className="whitespace-nowrap text-lg font-extrabold text-accent-400">
            {total.toFixed(2)} {b.currency}
          </span>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {/* Confirmare prin plata avansului */}
            {isPending && upcoming && (
              <button
                type="button"
                onClick={() => handlePay(b)}
                disabled={payingId === b.id}
                className="rounded-lg bg-accent-400 px-3 py-1.5 text-sm font-bold text-ink transition hover:bg-accent-300 disabled:opacity-50"
              >
                {payingId === b.id ? 'Se procesează…' : `Plătește avansul (${deposit.toFixed(0)} ${b.currency})`}
              </button>
            )}

            {/* Find Party */}
            {upcoming &&
              (existingMatch ? (
                <Link
                  to={`/meciuri/${existingMatch.id}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-accent-400/40 px-3 py-1.5 text-sm font-semibold text-accent-400 transition hover:bg-accent-400/10"
                >
                  <UsersIcon className="h-4 w-4" />
                  Vezi meciul ({existingMatch.spots_taken}/{existingMatch.total_spots})
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => setModalBooking(b)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-accent-400/15 px-3 py-1.5 text-sm font-semibold text-accent-400 transition hover:bg-accent-400/25"
                >
                  <UsersIcon className="h-4 w-4" />
                  Deschide meci
                </button>
              ))}

            {/* Anulare — doar daca politica permite */}
            {canCancelNow(b) ? (
              <button
                type="button"
                onClick={() => handleCancel(b)}
                disabled={cancellingId === b.id}
                className="rounded-lg border border-red-500/30 px-3 py-1.5 text-sm font-semibold text-red-400 transition hover:bg-red-500/10 disabled:opacity-50"
              >
                {cancellingId === b.id ? 'Se anulează…' : 'Anulează'}
              </button>
            ) : (
              upcoming && (
                <span className="text-xs text-slate-500">Anulare indisponibilă (&lt;24h)</span>
              )
            )}
          </div>
        </div>
      </li>
    )
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-20 w-full rounded-2xl" />
      </div>
    )
  }
  if (error) return <p className="text-red-400">{error}</p>

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-white">Rezervările mele</h1>
        <p className="mt-1 text-slate-400">Gestionează rezervările tale curente și trecute.</p>
      </div>

      {justConfirmed && (
        <div className="flex items-start justify-between gap-3 rounded-2xl bg-accent-400/10 px-4 py-3 text-sm font-medium text-accent-400 ring-1 ring-accent-400/20">
          <span>✓ Rezervare confirmată! Avansul a fost plătit, restul se achită la bază.</span>
          <button type="button" onClick={() => setJustConfirmed(false)} className="text-accent-400/70 hover:text-accent-400">✕</button>
        </div>
      )}

      {justBooked && (
        <div className="flex items-start justify-between gap-3 rounded-2xl bg-amber-400/10 px-4 py-3 text-sm font-medium text-amber-300 ring-1 ring-amber-400/20">
          <span>Rezervarea ta e înregistrată, dar neconfirmată. Plătește avansul ca să o confirmi (altfel expiră).</span>
          <button type="button" onClick={() => setJustBooked(false)} className="text-amber-300/70 hover:text-amber-300">✕</button>
        </div>
      )}

      {actionError && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm font-medium text-red-400 ring-1 ring-red-500/20">
          {actionError}
        </p>
      )}

      {bookings.length === 0 ? (
        <EmptyState
          icon={<PitchIcon className="h-7 w-7" />}
          title="Nu ai nicio rezervare încă"
          description="Caută o bază sportivă și rezervă primul tău meci."
          actionLabel="Caută un teren"
          actionTo="/"
        />
      ) : (
        <>
          <section>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
              Următoarele rezervări
            </h2>
            {upcoming.length === 0 ? (
              <p className="text-sm text-slate-500">Nu ai rezervări viitoare.</p>
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

      {modalBooking && (
        <CreateMatchModal
          booking={modalBooking}
          fieldLabel={fieldLabel(modalBooking.field_id)}
          onClose={() => setModalBooking(null)}
          onCreated={(match) => {
            setMatchByBooking((prev) => ({ ...prev, [match.booking_id]: match }))
            setModalBooking(null)
            navigate(`/meciuri/${match.id}`)
          }}
        />
      )}
    </div>
  )
}
