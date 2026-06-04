import { useEffect, useState } from 'react'
import { listAllVenues, setVenueStatus } from '../../api/resources'

const STATUS = {
  pending: { label: 'În așteptare', cls: 'bg-amber-100 text-amber-800' },
  approved: { label: 'Aprobată', cls: 'bg-mint-50 text-mint-600' },
  suspended: { label: 'Suspendată', cls: 'bg-red-100 text-red-700' },
}

const TABS = [
  { key: '', label: 'Toate' },
  { key: 'pending', label: 'În așteptare' },
  { key: 'approved', label: 'Aprobate' },
  { key: 'suspended', label: 'Suspendate' },
]

export default function VenueModeration() {
  const [venues, setVenues] = useState([])
  const [tab, setTab] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busyId, setBusyId] = useState(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    listAllVenues(tab || undefined)
      .then((vs) => active && setVenues(vs))
      .catch(() => active && setError('Nu am putut încărca bazele.'))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [tab])

  async function changeStatus(venue, status) {
    setBusyId(venue.id)
    setError(null)
    try {
      const updated = await setVenueStatus(venue.id, status)
      setVenues((prev) =>
        // dacă suntem pe un filtru, scoatem baza care nu mai corespunde
        prev
          .map((v) => (v.id === updated.id ? updated : v))
          .filter((v) => !tab || v.status === tab),
      )
    } catch {
      setError('Acțiunea a eșuat.')
    } finally {
      setBusyId(null)
    }
  }

  const pendingCount = venues.filter((v) => v.status === 'pending').length

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-slate-900">
          Moderare baze sportive
          {tab === '' && pendingCount > 0 && (
            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
              {pendingCount} în așteptare
            </span>
          )}
        </h2>
      </div>

      {/* Tabs status */}
      <div className="mt-3 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={[
              'rounded-lg px-3 py-1.5 text-sm font-semibold transition',
              tab === t.key
                ? 'bg-slate-800 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-slate-500">Se încarcă…</p>
      ) : error ? (
        <p className="mt-4 text-sm text-red-600">{error}</p>
      ) : venues.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">Nicio bază în această categorie.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {venues.map((v) => {
            const st = STATUS[v.status] ?? { label: v.status, cls: 'bg-slate-100 text-slate-600' }
            return (
              <li
                key={v.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 p-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900">{v.name}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${st.cls}`}>
                      {st.label}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500">
                    {v.city}, {v.county}
                  </p>
                </div>

                <div className="flex gap-2">
                  {v.status !== 'approved' && (
                    <button
                      type="button"
                      onClick={() => changeStatus(v, 'approved')}
                      disabled={busyId === v.id}
                      className="rounded-lg bg-mint-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                    >
                      {v.status === 'suspended' ? 'Reactivează' : 'Aprobă'}
                    </button>
                  )}
                  {v.status !== 'suspended' && (
                    <button
                      type="button"
                      onClick={() => changeStatus(v, 'suspended')}
                      disabled={busyId === v.id}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                    >
                      Suspendă
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
