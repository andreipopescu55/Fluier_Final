import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  getMatch, joinMatch, leaveMatch, approveParticipant, rejectParticipant, cancelMatch,
} from '../api/resources'
import { useAuth } from '../auth/AuthContext'
import { SKILL_LABELS, MATCH_STATUS, MATCH_EXPIRED, isMatchExpired, sportLabel } from '../lib/labels'
import { Skeleton } from '../components/ui/Skeleton'
import MatchChat from '../components/MatchChat'
import {
  UsersIcon, MapPinIcon, ClockIcon, ArrowLeftIcon, CheckIcon, CloseIcon,
} from '../components/ui/icons'

function dayLabel(iso) {
  return new Date(iso).toLocaleDateString('ro-RO', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
}
function timeRo(iso) {
  return new Date(iso).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })
}

function initials(name) {
  return (name || '?')
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function Avatar({ name }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-400/15 text-xs font-bold text-accent-400">
      {initials(name)}
    </span>
  )
}

export default function MatchDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const [match, setMatch] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState(null)
  const [removeTarget, setRemoveTarget] = useState(null) // jucatorul de scos (pentru confirmare)

  useEffect(() => {
    let active = true
    setLoading(true)
    getMatch(id)
      .then((m) => active && setMatch(m))
      .catch(() => active && setError('Meciul nu a fost găsit.'))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [id])

  // Starea meciului se schimba si din actiunile ALTORA (organizatorul te
  // accepta, cineva intra/iese, meciul se umple) -> reimprospatam periodic,
  // fara refresh manual. Se opreste cand nu mai are ce sa se schimbe
  // (meci anulat / inceput) si face pauza cat timp tab-ul e ascuns.
  const shouldPoll =
    match !== null &&
    match.status !== 'cancelled' &&
    new Date(match.start_time) > new Date()
  useEffect(() => {
    if (!shouldPoll) return
    function refresh() {
      if (document.visibilityState === 'hidden') return
      getMatch(id)
        .then(setMatch)
        .catch(() => {}) // un tick esuat nu strica pagina; urmatorul corecteaza
    }
    const t = setInterval(refresh, 5000)
    // La revenirea pe tab, sincronizam imediat (nu asteptam urmatorul tick).
    function onVisible() {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [id, shouldPoll])

  // Orice actiune intoarce meciul actualizat -> il punem direct in state.
  async function run(fn) {
    setActionError(null)
    setBusy(true)
    try {
      const updated = await fn()
      setMatch(updated)
      return true
    } catch (err) {
      setActionError(err.response?.data?.detail || 'Acțiunea a eșuat. Încearcă din nou.')
      return false
    } finally {
      setBusy(false)
    }
  }

  // Confirmare la scoaterea unui jucator din echipa.
  async function confirmRemove() {
    if (!removeTarget) return
    const ok = await run(() => rejectParticipant(match.id, removeTarget.user_id))
    if (ok) setRemoveTarget(null)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-44 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    )
  }
  if (error) return <p className="text-red-400">{error}</p>
  if (!match) return null

  const isPast = new Date(match.start_time) <= new Date()
  const isOver = new Date(match.end_time) <= new Date()
  const expired = isMatchExpired(match) // deschis/complet, dar timpul a trecut
  const st = expired
    ? MATCH_EXPIRED
    : MATCH_STATUS[match.status] ?? { label: match.status, cls: 'bg-panel-2 text-slate-400' }
  const isVenueAdmin = user?.role === 'venue_admin'
  const canJoin = !match.is_organizer && match.status === 'open' && !isPast

  return (
    <div className="space-y-6">
      <Link
        to="/meciuri"
        className="inline-flex items-center gap-1 text-sm font-semibold text-accent-400 transition hover:text-accent-300"
      >
        <ArrowLeftIcon className="h-4 w-4" /> Toate meciurile
      </Link>

      {/* Antet meci */}
      <section className="overflow-hidden rounded-2xl bg-panel ring-1 ring-line">
        <div className="h-2 bg-gradient-to-r from-accent-500 to-accent-400" />
        <div className="p-6 sm:p-8">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Link
                to={`/venue/${match.venue_slug}`}
                className="text-2xl font-extrabold text-white hover:text-accent-400"
              >
                {match.venue_name}
              </Link>
              <p className="mt-1 flex items-center gap-1.5 text-slate-400">
                <MapPinIcon className="h-4 w-4 shrink-0 text-slate-500" />
                {match.city} · {match.field_name}
              </p>
            </div>
            <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${st.cls}`}>
              {st.label}
            </span>
          </div>

          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-300">
            <span className="inline-flex items-center gap-1.5 capitalize">
              <ClockIcon className="h-4 w-4 text-slate-500" />
              {dayLabel(match.start_time)}, {timeRo(match.start_time)}–{timeRo(match.end_time)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <UsersIcon className="h-4 w-4 text-slate-500" />
              {match.spots_taken}/{match.total_spots} jucători
            </span>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full bg-accent-400/10 px-2.5 py-1 text-xs font-semibold text-accent-400">
              {sportLabel(match.sport_type)}
            </span>
            <span className="rounded-full bg-panel-2 px-2.5 py-1 text-xs font-semibold text-slate-300">
              {SKILL_LABELS[match.skill_level]}
            </span>
            {match.price_per_player != null && (
              <span className="rounded-full bg-panel-2 px-2.5 py-1 text-xs font-semibold text-slate-300">
                {Number(match.price_per_player).toFixed(0)} RON/jucător
              </span>
            )}
          </div>

          {match.note && (
            <p className="mt-4 rounded-xl bg-panel-2 px-4 py-3 text-sm text-slate-300">
              „{match.note}"
            </p>
          )}
          <p className="mt-3 text-xs text-slate-500">Organizator: {match.organizer_name}</p>

          {actionError && (
            <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm font-medium text-red-400 ring-1 ring-red-500/20">
              {actionError}
            </p>
          )}

          {/* Meciul a ramas in urma timpului: mesaj clar in locul butoanelor. */}
          {expired && (
            <div className="mt-5 flex items-start gap-3 rounded-xl bg-amber-400/10 px-4 py-3 ring-1 ring-amber-400/25">
              <ClockIcon className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
              <div>
                <p className="text-sm font-bold text-amber-300">
                  Acest meci nu mai este valabil
                </p>
                <p className="mt-0.5 text-sm text-amber-200/80">
                  {isOver
                    ? 'Intervalul rezervării a trecut, iar meciul s-a încheiat. Caută un meci viitor în lista de meciuri deschise.'
                    : 'Meciul a început deja — nu se mai primesc cereri de alăturare.'}
                </p>
              </div>
            </div>
          )}

          {/* Zona de actiune (jucator) — dispare cand meciul a expirat */}
          {!expired && (
          <div className="mt-5">
            {!user ? (
              <Link
                to="/login"
                className="inline-flex rounded-xl bg-accent-400 px-5 py-2.5 text-sm font-bold text-ink transition hover:bg-accent-300"
              >
                Autentifică-te ca să te alături
              </Link>
            ) : isVenueAdmin ? (
              <span className="text-sm font-semibold text-slate-400">
                Conturile de administrator nu participă la meciuri.
              </span>
            ) : match.is_organizer ? (
              match.status !== 'cancelled' && (
                <button
                  type="button"
                  onClick={() => run(() => cancelMatch(match.id))}
                  disabled={busy}
                  className="rounded-xl border border-red-500/30 px-4 py-2.5 text-sm font-semibold text-red-400 transition hover:bg-red-500/10 disabled:opacity-50"
                >
                  Anulează meciul
                </button>
              )
            ) : match.my_status === 'approved' ? (
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-accent-400/15 px-3 py-1.5 text-sm font-semibold text-accent-400">
                  ✓ Ești în echipă
                </span>
                <button
                  type="button"
                  onClick={() => run(() => leaveMatch(match.id))}
                  disabled={busy}
                  className="rounded-xl border border-line px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-line-2 disabled:opacity-50"
                >
                  Renunță
                </button>
              </div>
            ) : match.my_status === 'requested' ? (
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-amber-400/15 px-3 py-1.5 text-sm font-semibold text-amber-300">
                  Cerere trimisă — așteaptă aprobarea
                </span>
                <button
                  type="button"
                  onClick={() => run(() => leaveMatch(match.id))}
                  disabled={busy}
                  className="rounded-xl border border-line px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-line-2 disabled:opacity-50"
                >
                  Anulează cererea
                </button>
              </div>
            ) : canJoin || match.my_status === 'rejected' ? (
              <button
                type="button"
                onClick={() => run(() => joinMatch(match.id))}
                disabled={busy}
                className="inline-flex rounded-xl bg-accent-400 px-5 py-2.5 text-sm font-bold text-ink transition hover:bg-accent-300 disabled:opacity-50"
              >
                {match.my_status === 'rejected' ? 'Cere din nou' : 'Cere să te alături'}
              </button>
            ) : (
              <span className="text-sm font-semibold text-slate-400">Meci complet</span>
            )}
          </div>
          )}
        </div>
      </section>

      {/* Cereri in asteptare (doar organizator; fara rost dupa expirare) */}
      {match.is_organizer && !expired && match.pending_requests.length > 0 && (
        <section className="rounded-2xl bg-panel p-6 ring-1 ring-line">
          <h2 className="mb-4 text-base font-bold text-white">
            Cereri în așteptare
            <span className="ml-2 text-sm font-medium text-slate-500">
              ({match.pending_requests.length})
            </span>
          </h2>
          <ul className="space-y-2">
            {match.pending_requests.map((p) => (
              <li
                key={p.user_id}
                className="flex items-center justify-between gap-3 rounded-xl bg-panel-2 px-3 py-2.5"
              >
                <div className="flex items-center gap-3">
                  <Avatar name={p.full_name} />
                  <span className="font-semibold text-white">{p.full_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => run(() => approveParticipant(match.id, p.user_id))}
                    disabled={busy}
                    className="inline-flex items-center gap-1 rounded-lg bg-accent-400 px-3 py-1.5 text-sm font-bold text-ink transition hover:bg-accent-300 disabled:opacity-50"
                  >
                    <CheckIcon className="h-4 w-4" /> Aprobă
                  </button>
                  <button
                    type="button"
                    onClick={() => run(() => rejectParticipant(match.id, p.user_id))}
                    disabled={busy}
                    aria-label="Respinge"
                    className="inline-flex items-center justify-center rounded-lg border border-line px-2.5 py-1.5 text-slate-300 transition hover:border-red-500/40 hover:text-red-400 disabled:opacity-50"
                  >
                    <CloseIcon className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Roster (jucatori confirmati) */}
      <section className="rounded-2xl bg-panel p-6 ring-1 ring-line">
        <h2 className="mb-4 text-base font-bold text-white">
          Echipa
          <span className="ml-2 text-sm font-medium text-slate-500">
            ({match.spots_taken}/{match.total_spots})
          </span>
        </h2>
        <ul className="space-y-2">
          {/* Organizatorul ocupa mereu un loc */}
          <li className="flex items-center gap-3 rounded-xl bg-panel-2 px-3 py-2.5">
            <Avatar name={match.organizer_name} />
            <span className="font-semibold text-white">{match.organizer_name}</span>
            <span className="rounded-full bg-accent-400/15 px-2 py-0.5 text-xs font-semibold text-accent-400">
              Organizator
            </span>
          </li>
          {match.participants.map((p) => (
            <li
              key={p.user_id}
              className="flex items-center justify-between gap-3 rounded-xl bg-panel-2 px-3 py-2.5"
            >
              <div className="flex items-center gap-3">
                <Avatar name={p.full_name} />
                <span className="font-semibold text-white">{p.full_name}</span>
              </div>
              {/* Organizatorul poate scoate un jucator aprobat -> elibereaza locul.
                  Dupa expirare echipa ramane doar istoric — fara modificari. */}
              {match.is_organizer && match.status !== 'cancelled' && !expired && (
                <button
                  type="button"
                  onClick={() => setRemoveTarget(p)}
                  disabled={busy}
                  title="Scoate din echipă"
                  aria-label={`Scoate ${p.full_name} din echipă`}
                  className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-sm font-semibold text-slate-300 transition hover:border-red-500/40 hover:text-red-400 disabled:opacity-50"
                >
                  <CloseIcon className="h-4 w-4" /> Scoate
                </button>
              )}
            </li>
          ))}
          {match.spots_left > 0 &&
            Array.from({ length: match.spots_left }).map((_, i) => (
              <li
                key={`empty-${i}`}
                className="flex items-center gap-3 rounded-xl border border-dashed border-line px-3 py-2.5 text-sm text-slate-500"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full border border-dashed border-line">
                  +
                </span>
                Loc liber
              </li>
            ))}
        </ul>
      </section>

      {/* Conversatia echipei — privata: doar organizator + jucatori aprobati.
          Ramane vizibila (read-only) si dupa ce meciul expira / e anulat. */}
      {user && (match.is_organizer || match.my_status === 'approved') && (
        <MatchChat
          matchId={match.id}
          currentUserId={user.id}
          readOnly={expired || match.status === 'cancelled'}
        />
      )}

      {/* Confirmare scoatere jucator */}
      {removeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-panel shadow-xl ring-1 ring-line">
            <div className="p-6">
              <h3 className="text-lg font-bold text-white">Scoți jucătorul din echipă?</h3>
              <p className="mt-2 text-sm text-slate-400">
                <b className="text-white">{removeTarget.full_name}</b> va fi scos din echipă, iar locul lui devine liber.
              </p>
              {actionError && (
                <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm font-medium text-red-400 ring-1 ring-red-500/20">
                  {actionError}
                </p>
              )}
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRemoveTarget(null)}
                  disabled={busy}
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-300 transition hover:text-white disabled:opacity-50"
                >
                  Anulează
                </button>
                <button
                  type="button"
                  onClick={confirmRemove}
                  disabled={busy}
                  className="rounded-lg bg-red-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-600 disabled:opacity-50"
                >
                  {busy ? 'Se scoate…' : 'Scoate'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
