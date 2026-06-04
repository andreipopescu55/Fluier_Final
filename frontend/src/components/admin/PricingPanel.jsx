import { useEffect, useState } from 'react'
import { listFieldPricingManage, addPricingRule, deletePricingRule } from '../../api/resources'

const DAY_LABELS = ['Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă', 'Duminică']
const hhmm = (t) => (t ? t.slice(0, 5) : '')

export default function PricingPanel({ fieldId }) {
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Formular adăugare.
  const [form, setForm] = useState({ day_of_week: 0, start_time: '08:00', end_time: '12:00', price_per_hour: '' })
  const [adding, setAdding] = useState(false)
  const [formError, setFormError] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    listFieldPricingManage(fieldId)
      .then((rs) => active && setRules(rs))
      .catch(() => active && setError('Nu am putut încărca tarifele.'))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [fieldId])

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleAdd(e) {
    e.preventDefault()
    setFormError(null)
    if (form.start_time >= form.end_time) {
      setFormError('Ora de început trebuie să fie înainte de cea de sfârșit.')
      return
    }
    const price = Number(form.price_per_hour)
    if (!price || price <= 0) {
      setFormError('Introdu un preț valid (> 0).')
      return
    }
    setAdding(true)
    try {
      const created = await addPricingRule(fieldId, {
        day_of_week: Number(form.day_of_week),
        start_time: form.start_time,
        end_time: form.end_time,
        price_per_hour: price,
        currency: 'RON',
      })
      setRules((prev) =>
        [...prev, created].sort(
          (a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time),
        ),
      )
      set('price_per_hour', '')
    } catch (err) {
      setFormError(
        err.response?.status === 409
          ? 'Se suprapune cu o regulă existentă pe aceeași zi.'
          : 'Adăugarea a eșuat. Verifică datele.',
      )
    } finally {
      setAdding(false)
    }
  }

  async function handleDelete(rule) {
    setDeletingId(rule.id)
    try {
      await deletePricingRule(rule.id)
      setRules((prev) => prev.filter((r) => r.id !== rule.id))
    } catch {
      setError('Ștergerea a eșuat.')
    } finally {
      setDeletingId(null)
    }
  }

  // Grupăm pe zi pentru afișare.
  const byDay = DAY_LABELS.map((label, day) => ({
    label,
    day,
    rules: rules.filter((r) => r.day_of_week === day),
  }))

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100 sm:p-6">
      <h2 className="text-lg font-bold text-slate-900">Tarife</h2>
      <p className="mt-1 text-sm text-slate-400">
        Intervalele cu tarif definesc și sloturile rezervabile pentru clienți.
      </p>

      {/* Lista pe zile */}
      {loading ? (
        <p className="mt-4 text-sm text-slate-500">Se încarcă…</p>
      ) : error ? (
        <p className="mt-4 text-sm text-red-600">{error}</p>
      ) : (
        <div className="mt-4 space-y-3">
          {byDay.map(({ label, day, rules: dayRules }) => (
            <div key={day} className="flex flex-wrap items-center gap-2">
              <span className="w-24 shrink-0 text-sm font-semibold text-slate-600">{label}</span>
              {dayRules.length === 0 ? (
                <span className="text-sm text-slate-300">—</span>
              ) : (
                dayRules.map((r) => (
                  <span
                    key={r.id}
                    className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-2.5 py-1 text-sm"
                  >
                    <span className="font-medium text-slate-700">
                      {hhmm(r.start_time)}–{hhmm(r.end_time)}
                    </span>
                    <span className="font-bold text-slate-900">{Number(r.price_per_hour)} {r.currency}/h</span>
                    <button
                      type="button"
                      onClick={() => handleDelete(r)}
                      disabled={deletingId === r.id}
                      className="text-slate-400 transition hover:text-red-600 disabled:opacity-50"
                      title="Șterge regula"
                    >
                      ✕
                    </button>
                  </span>
                ))
              )}
            </div>
          ))}
        </div>
      )}

      {/* Formular adăugare */}
      <form onSubmit={handleAdd} className="mt-6 border-t border-slate-100 pt-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-700">Zi</span>
            <select
              value={form.day_of_week}
              onChange={(e) => set('day_of_week', e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            >
              {DAY_LABELS.map((label, d) => (
                <option key={d} value={d}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-700">De la</span>
            <input
              type="time"
              value={form.start_time}
              onChange={(e) => set('start_time', e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-700">Până la</span>
            <input
              type="time"
              value={form.end_time}
              onChange={(e) => set('end_time', e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-700">Preț/oră</span>
            <input
              type="number"
              min="1"
              step="0.01"
              value={form.price_per_hour}
              onChange={(e) => set('price_per_hour', e.target.value)}
              placeholder="100"
              className="w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </label>
          <button
            type="submit"
            disabled={adding}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
          >
            {adding ? 'Se adaugă…' : 'Adaugă tarif'}
          </button>
        </div>
        {formError && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{formError}</p>
        )}
      </form>
    </section>
  )
}
