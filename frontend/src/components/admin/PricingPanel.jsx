import { useEffect, useState } from 'react'
import { listFieldPricingManage, addPricingRule, deletePricingRule } from '../../api/resources'

const DAY_LABELS = ['Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă', 'Duminică']
const DAY_SHORT = ['Lu', 'Ma', 'Mi', 'Jo', 'Vi', 'Sâ', 'Du']
const hhmm = (t) => (t ? t.slice(0, 5) : '')
// end_time "00:00" inseamna miezul noptii (24:00) -> afisam "24:00", nu "00:00".
const endLabel = (t) => (hhmm(t) === '00:00' ? '24:00' : hhmm(t))

const pad = (n) => String(n).padStart(2, '0')
// minute -> eticheta afisata (1440 = miezul noptii = "24:00")
const minLabel = (m) => (m === 1440 ? '24:00' : `${pad(Math.floor(m / 60))}:00`)
// minute -> ora trimisa la backend "HH:00:00" (1440/0 -> "00:00:00" = miezul noptii)
const toServer = (m) => `${pad(Math.floor((m % 1440) / 60))}:00:00`

const inputCls =
  'rounded-lg border border-line bg-panel-2 px-3 py-2 text-sm text-slate-200 outline-none focus:border-accent-400 [color-scheme:dark]'
const labelCls = 'mb-1 block text-xs font-semibold text-slate-300'

export default function PricingPanel({ fieldId }) {
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [days, setDays] = useState([0, 1, 2, 3, 4]) // zilele selectate (indici)
  const [startMin, setStartMin] = useState(16 * 60) // 16:00
  const [endMin, setEndMin] = useState(1440) // 24:00
  const [price, setPrice] = useState('')
  const [adding, setAdding] = useState(false)
  const [formError, setFormError] = useState(null)
  const [formOk, setFormOk] = useState(null)
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

  function toggleDay(i) {
    setDays((prev) => (prev.includes(i) ? prev.filter((d) => d !== i) : [...prev, i].sort()))
  }

  function changeStart(m) {
    setStartMin(m)
    if (endMin <= m) setEndMin(m + 60) // sfarsitul ramane mereu dupa inceput
  }

  function sortRules(list) {
    return [...list].sort(
      (a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time),
    )
  }

  async function handleAdd(e) {
    e.preventDefault()
    setFormError(null)
    setFormOk(null)
    if (days.length === 0) {
      setFormError('Alege cel puțin o zi.')
      return
    }
    const p = Number(price)
    if (!p || p <= 0) {
      setFormError('Introdu un preț valid (> 0).')
      return
    }

    setAdding(true)
    const payloadBase = { start_time: toServer(startMin), end_time: toServer(endMin), price_per_hour: p, currency: 'RON' }
    const added = []
    const skipped = []
    let otherError = false
    for (const day of days) {
      try {
        const created = await addPricingRule(fieldId, { ...payloadBase, day_of_week: day })
        added.push(created)
      } catch (err) {
        if (err.response?.status === 409) skipped.push(day)
        else otherError = true
      }
    }
    if (added.length) setRules((prev) => sortRules([...prev, ...added]))

    const parts = []
    if (added.length) parts.push(`Adăugat pe ${added.length} ${added.length === 1 ? 'zi' : 'zile'}.`)
    if (skipped.length) {
      parts.push(
        `${skipped.length === 1 ? 'O zi avea' : `${skipped.length} zile aveau`} deja interval acolo (${skipped.map((d) => DAY_SHORT[d]).join(', ')}) — sărit${skipped.length === 1 ? 'ă' : 'e'}.`,
      )
    }
    if (otherError) parts.push('Unele zile au eșuat. Încearcă din nou.')
    const msg = parts.join(' ')
    if (added.length) {
      setFormOk(msg)
      setPrice('')
    } else {
      setFormError(msg || 'Adăugarea a eșuat.')
    }
    setAdding(false)
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

  const byDay = DAY_LABELS.map((label, day) => ({
    label,
    day,
    rules: rules.filter((r) => r.day_of_week === day),
  }))

  // Optiuni ore: start 00:00..23:00; sfarsit (start+1h)..23:00 + 24:00.
  const startOptions = Array.from({ length: 24 }, (_, h) => h * 60)
  const endOptions = [...Array.from({ length: 24 }, (_, h) => h * 60).filter((m) => m > startMin), 1440]

  return (
    <section className="rounded-2xl bg-panel p-4 ring-1 ring-line sm:p-6">
      <h2 className="text-lg font-bold text-white">Tarife</h2>
      <p className="mt-1 text-sm text-slate-400">
        Intervalele cu tarif definesc și sloturile rezervabile pentru clienți.
      </p>

      {loading ? (
        <p className="mt-4 text-sm text-slate-400">Se încarcă…</p>
      ) : error ? (
        <p className="mt-4 text-sm text-red-400">{error}</p>
      ) : (
        <div className="mt-4 space-y-3">
          {byDay.map(({ label, day, rules: dayRules }) => (
            <div key={day} className="flex flex-wrap items-center gap-2">
              <span className="w-24 shrink-0 text-sm font-semibold text-slate-300">{label}</span>
              {dayRules.length === 0 ? (
                <span className="text-sm text-slate-600">—</span>
              ) : (
                dayRules.map((r) => (
                  <span
                    key={r.id}
                    className="inline-flex items-center gap-2 rounded-lg bg-panel-2 px-2.5 py-1 text-sm"
                  >
                    <span className="font-medium text-slate-300">
                      {hhmm(r.start_time)}–{endLabel(r.end_time)}
                    </span>
                    <span className="font-bold text-accent-400">{Number(r.price_per_hour)} {r.currency}/h</span>
                    <button
                      type="button"
                      onClick={() => handleDelete(r)}
                      disabled={deletingId === r.id}
                      className="text-slate-500 transition hover:text-red-400 disabled:opacity-50"
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

      {/* Formular adăugare — zile multiple + ore din dropdown (din ora in ora) */}
      <form onSubmit={handleAdd} className="mt-6 border-t border-line pt-4">
        <span className={labelCls}>Zile</span>
        <div className="flex flex-wrap gap-1.5">
          {DAY_SHORT.map((d, i) => {
            const on = days.includes(i)
            return (
              <button
                key={i}
                type="button"
                onClick={() => toggleDay(i)}
                className={[
                  'min-w-[44px] rounded-lg px-2 py-1.5 text-sm font-semibold transition',
                  on ? 'bg-accent-400 text-ink' : 'bg-panel-2 text-slate-300 hover:text-white',
                ].join(' ')}
              >
                {d}
              </button>
            )
          })}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {[
            ['Zile lucrătoare', [0, 1, 2, 3, 4]],
            ['Weekend', [5, 6]],
            ['Toate', [0, 1, 2, 3, 4, 5, 6]],
          ].map(([label, set]) => (
            <button
              key={label}
              type="button"
              onClick={() => setDays(set)}
              className="rounded-lg border border-line px-2.5 py-1 text-xs font-semibold text-slate-400 transition hover:border-line-2 hover:text-white"
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="block">
            <span className={labelCls}>De la</span>
            <select value={startMin} onChange={(e) => changeStart(Number(e.target.value))} className={inputCls}>
              {startOptions.map((m) => (
                <option key={m} value={m}>{minLabel(m)}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelCls}>Până la</span>
            <select value={endMin} onChange={(e) => setEndMin(Number(e.target.value))} className={inputCls}>
              {endOptions.map((m) => (
                <option key={m} value={m}>{minLabel(m)}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelCls}>Preț/oră</span>
            <input
              type="number"
              min="1"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="100"
              className={`w-28 ${inputCls}`}
            />
          </label>
          <button
            type="submit"
            disabled={adding}
            className="rounded-lg bg-accent-400 px-4 py-2 text-sm font-bold text-ink transition hover:bg-accent-300 disabled:opacity-50"
          >
            {adding ? 'Se adaugă…' : `Adaugă pe ${days.length} ${days.length === 1 ? 'zi' : 'zile'}`}
          </button>
        </div>

        {formOk && (
          <p className="mt-3 rounded-lg bg-accent-400/10 px-3 py-2 text-sm font-medium text-accent-400 ring-1 ring-accent-400/20">
            ✓ {formOk}
          </p>
        )}
        {formError && (
          <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm font-medium text-red-400 ring-1 ring-red-500/20">
            {formError}
          </p>
        )}
      </form>
    </section>
  )
}
