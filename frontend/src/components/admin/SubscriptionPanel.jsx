import { useEffect, useState } from 'react'
import {
  getVenueSubscription,
  subscribeVenue,
  cancelVenueSubscription,
} from '../../api/resources'

// Planuri (doar pentru afisare — preturile sunt demonstrative).
const PLANS = {
  basic: {
    label: 'Basic',
    price: 99,
    features: ['Listare în aplicație', 'Calendar rezervări', 'Management terenuri & tarife'],
  },
  premium: {
    label: 'Premium',
    price: 199,
    features: ['Tot ce e în Basic', 'Promovare în căutări', 'Rapoarte avansate', 'Suport prioritar'],
  },
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function SubscriptionPanel({ venueId }) {
  const [sub, setSub] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    getVenueSubscription(venueId)
      .then((s) => active && setSub(s))
      .catch(() => active && setError('Nu am putut încărca abonamentul.'))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [venueId])

  async function handleSubscribe(plan) {
    setBusy(true)
    setError(null)
    try {
      const updated = await subscribeVenue(venueId, plan)
      setSub(updated)
    } catch {
      setError('Activarea a eșuat. Încearcă din nou.')
    } finally {
      setBusy(false)
    }
  }

  async function handleCancel() {
    setBusy(true)
    setError(null)
    try {
      const updated = await cancelVenueSubscription(venueId)
      setSub(updated)
    } catch {
      setError('Anularea a eșuat.')
    } finally {
      setBusy(false)
    }
  }

  const active = sub && sub.status === 'active'

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-slate-900">Abonament platformă</h2>
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
          demonstrativ — fără plată reală (Stripe ca extensie)
        </span>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-slate-500">Se încarcă…</p>
      ) : active ? (
        // ── Abonament activ ──────────────────────────────────────────
        <div className="mt-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-lg bg-brand-600 px-3 py-1 text-sm font-bold text-white">
              {PLANS[sub.plan]?.label ?? sub.plan}
            </span>
            <span className="rounded-full bg-mint-50 px-2.5 py-1 text-xs font-semibold text-mint-600">
              Activ
            </span>
            <span className="text-sm text-slate-500">
              {sub.cancel_at_period_end
                ? `Se anulează pe ${fmtDate(sub.current_period_end)}`
                : `Se reînnoiește pe ${fmtDate(sub.current_period_end)}`}
            </span>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {/* Trecere la celalalt plan */}
            {Object.keys(PLANS)
              .filter((p) => p !== sub.plan)
              .map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => handleSubscribe(p)}
                  disabled={busy}
                  className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 disabled:opacity-50"
                >
                  Trecere la {PLANS[p].label} ({PLANS[p].price} RON/lună)
                </button>
              ))}
            {!sub.cancel_at_period_end && (
              <button
                type="button"
                onClick={handleCancel}
                disabled={busy}
                className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
              >
                Anulează abonamentul
              </button>
            )}
            {sub.cancel_at_period_end && (
              <button
                type="button"
                onClick={() => handleSubscribe(sub.plan)}
                disabled={busy}
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
              >
                Reactivează
              </button>
            )}
          </div>
        </div>
      ) : (
        // ── Fara abonament: alege un plan ────────────────────────────
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {Object.entries(PLANS).map(([key, plan]) => (
            <div key={key} className="flex flex-col rounded-xl border border-slate-200 p-5">
              <h3 className="text-base font-bold text-slate-900">{plan.label}</h3>
              <p className="mt-1">
                <span className="text-2xl font-extrabold text-slate-900">{plan.price}</span>
                <span className="text-sm text-slate-500"> RON/lună</span>
              </p>
              <ul className="mt-3 flex-1 space-y-1 text-sm text-slate-600">
                {plan.features.map((f) => (
                  <li key={f}>✓ {f}</li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => handleSubscribe(key)}
                disabled={busy}
                className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
              >
                {busy ? 'Se activează…' : `Activează ${plan.label}`}
              </button>
            </div>
          ))}
        </div>
      )}

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>
      )}
    </section>
  )
}
