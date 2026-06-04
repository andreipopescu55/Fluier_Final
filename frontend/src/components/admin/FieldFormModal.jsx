import { useState } from 'react'
import { createField, updateField } from '../../api/resources'
import { SPORT_LABELS, SURFACE_LABELS } from '../../lib/labels'

const SPORT_OPTIONS = Object.entries(SPORT_LABELS)
const SURFACE_OPTIONS = Object.entries(SURFACE_LABELS)

// Valori posibile pentru durate (in minute). Slotul trebuie sa dividă min_booking.
const SLOT_OPTIONS = [15, 30, 60]
const MIN_BOOKING_OPTIONS = [30, 60, 90, 120]

export default function FieldFormModal({ venueId, field, onClose, onSaved }) {
  const isEdit = Boolean(field)
  const [form, setForm] = useState({
    name: field?.name ?? '',
    sport_type: field?.sport_type ?? 'football_5',
    surface_type: field?.surface_type ?? 'synthetic_grass',
    is_indoor: field?.is_indoor ?? false,
    slot_duration_minutes: field?.slot_duration_minutes ?? 30,
    min_booking_minutes: field?.min_booking_minutes ?? 60,
    is_active: field?.is_active ?? true,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    // Validare client-side: durata minima trebuie sa fie multiplu de slot.
    if (form.min_booking_minutes % form.slot_duration_minutes !== 0) {
      setError('Durata minimă trebuie să fie multiplu al duratei slotului.')
      return
    }

    const payload = {
      name: form.name.trim(),
      sport_type: form.sport_type,
      surface_type: form.surface_type,
      is_indoor: form.is_indoor,
      slot_duration_minutes: Number(form.slot_duration_minutes),
      min_booking_minutes: Number(form.min_booking_minutes),
      is_active: form.is_active,
    }

    setSaving(true)
    try {
      const saved = isEdit
        ? await updateField(field.id, payload)
        : await createField(venueId, payload)
      onSaved(saved)
    } catch (err) {
      const status = err.response?.status
      setError(
        status === 422
          ? 'Date invalide. Verifică numele și duratele.'
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
        className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6 shadow-xl"
      >
        <h3 className="text-lg font-bold text-slate-900">
          {isEdit ? 'Editează terenul' : 'Teren nou'}
        </h3>

        <Field label="Nume">
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="ex: Terenul 2"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Sport">
            <Select value={form.sport_type} onChange={(v) => set('sport_type', v)} options={SPORT_OPTIONS} />
          </Field>
          <Field label="Suprafață">
            <Select value={form.surface_type} onChange={(v) => set('surface_type', v)} options={SURFACE_OPTIONS} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Durată slot (min)">
            <Select
              value={form.slot_duration_minutes}
              onChange={(v) => set('slot_duration_minutes', Number(v))}
              options={SLOT_OPTIONS.map((n) => [n, `${n} min`])}
            />
          </Field>
          <Field label="Rezervare minimă (min)">
            <Select
              value={form.min_booking_minutes}
              onChange={(v) => set('min_booking_minutes', Number(v))}
              options={MIN_BOOKING_OPTIONS.map((n) => [n, `${n} min`])}
            />
          </Field>
        </div>

        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input type="checkbox" checked={form.is_indoor} onChange={(e) => set('is_indoor', e.target.checked)} />
            Acoperit
          </label>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input type="checkbox" checked={form.is_active} onChange={(e) => set('is_active', e.target.checked)} />
            Activ (vizibil clienților)
          </label>
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

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-slate-700">{label}</span>
      {children}
    </label>
  )
}

function Select({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
    >
      {options.map(([val, label]) => (
        <option key={val} value={val}>
          {label}
        </option>
      ))}
    </select>
  )
}
