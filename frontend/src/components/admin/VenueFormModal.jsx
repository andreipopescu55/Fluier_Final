import { useState } from 'react'
import { createVenue, updateVenue } from '../../api/resources'

const hhmm = (t) => (t ? t.slice(0, 5) : '')

export default function VenueFormModal({ venue, onClose, onSaved }) {
  const isEdit = Boolean(venue)
  const [form, setForm] = useState({
    name: venue?.name ?? '',
    description: venue?.description ?? '',
    address: venue?.address ?? '',
    city: venue?.city ?? '',
    county: venue?.county ?? '',
    phone: venue?.phone ?? '',
    opening_time: hhmm(venue?.opening_time) || '08:00',
    closing_time: hhmm(venue?.closing_time) || '23:00',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (form.opening_time >= form.closing_time) {
      setError('Ora de deschidere trebuie să fie înainte de cea de închidere.')
      return
    }

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      address: form.address.trim(),
      city: form.city.trim(),
      county: form.county.trim(),
      phone: form.phone.trim() || null,
      opening_time: form.opening_time,
      closing_time: form.closing_time,
    }

    setSaving(true)
    try {
      const saved = isEdit ? await updateVenue(venue.id, payload) : await createVenue(payload)
      onSaved(saved)
    } catch (err) {
      setError(
        err.response?.status === 422
          ? 'Date invalide. Verifică câmpurile obligatorii și programul.'
          : 'Salvarea a eșuat. Încearcă din nou.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
      >
        <h3 className="text-lg font-bold text-slate-900">
          {isEdit ? 'Editează baza sportivă' : 'Bază sportivă nouă'}
        </h3>
        {!isEdit && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Baza nouă pornește cu status <strong>„În așteptare"</strong> și devine vizibilă public
            după aprobarea de către un administrator al platformei.
          </p>
        )}

        <Field label="Nume">
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="ex: Complex Sportiv Aurora"
            className={inputCls}
          />
        </Field>

        <Field label="Descriere (opțional)">
          <textarea
            rows={2}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            className={inputCls}
          />
        </Field>

        <Field label="Adresă">
          <input
            type="text"
            required
            value={form.address}
            onChange={(e) => set('address', e.target.value)}
            placeholder="Str. Exemplu nr. 1"
            className={inputCls}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Oraș">
            <input type="text" required value={form.city} onChange={(e) => set('city', e.target.value)} className={inputCls} />
          </Field>
          <Field label="Județ">
            <input type="text" required value={form.county} onChange={(e) => set('county', e.target.value)} className={inputCls} />
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Field label="Telefon">
            <input type="text" value={form.phone} onChange={(e) => set('phone', e.target.value)} className={inputCls} />
          </Field>
          <Field label="Deschidere">
            <input type="time" value={form.opening_time} onChange={(e) => set('opening_time', e.target.value)} className={inputCls} />
          </Field>
          <Field label="Închidere">
            <input type="time" value={form.closing_time} onChange={(e) => set('closing_time', e.target.value)} className={inputCls} />
          </Field>
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
          >
            Renunță
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? 'Se salvează…' : isEdit ? 'Salvează' : 'Creează'}
          </button>
        </div>
      </form>
    </div>
  )
}

const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100'

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-slate-700">{label}</span>
      {children}
    </label>
  )
}
