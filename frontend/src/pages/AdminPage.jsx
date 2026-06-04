import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { listMyVenues, listVenueFieldsManage, deleteField } from '../api/resources'
import { SPORT_LABELS, SURFACE_LABELS } from '../lib/labels'
import CalendarPanel from '../components/admin/CalendarPanel'
import PricingPanel from '../components/admin/PricingPanel'
import FieldFormModal from '../components/admin/FieldFormModal'
import VenueFormModal from '../components/admin/VenueFormModal'
import SubscriptionPanel from '../components/admin/SubscriptionPanel'
import VenueModeration from '../components/admin/VenueModeration'

const VENUE_STATUS = {
  pending: { label: 'În așteptare', cls: 'bg-amber-100 text-amber-800' },
  approved: { label: 'Aprobată', cls: 'bg-mint-50 text-mint-600' },
  suspended: { label: 'Suspendată', cls: 'bg-red-100 text-red-700' },
}

export default function AdminPage() {
  const { user } = useAuth()
  const isSuperAdmin = user?.role === 'super_admin'

  const [venues, setVenues] = useState([])
  const [venueId, setVenueId] = useState('')
  const [fields, setFields] = useState([])
  const [fieldId, setFieldId] = useState('')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [fieldsError, setFieldsError] = useState(null)

  // Modal teren: { field } (field=null -> creare)
  const [fieldModal, setFieldModal] = useState(null)
  // Modal bază: { venue } (venue=null -> creare)
  const [venueModal, setVenueModal] = useState(null)
  const [actionError, setActionError] = useState(null)

  // 1) Bazele mele.
  useEffect(() => {
    let active = true
    listMyVenues()
      .then((vs) => {
        if (!active) return
        setVenues(vs)
        if (vs.length) setVenueId(vs[0].id)
      })
      .catch(() => active && setError('Nu am putut încărca bazele tale.'))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [])

  // 2) Terenurile bazei selectate (toate, inclusiv inactive).
  useEffect(() => {
    if (!venueId) return
    let active = true
    setFieldsError(null)
    setFields([])
    setFieldId('')
    listVenueFieldsManage(venueId)
      .then((fs) => {
        if (!active) return
        setFields(fs)
        if (fs.length) setFieldId(fs[0].id)
        else setFieldsError('Această bază nu are terenuri. Adaugă primul teren.')
      })
      .catch(() => active && setFieldsError('Nu am putut încărca terenurile.'))
    return () => {
      active = false
    }
  }, [venueId])

  const selectedVenue = venues.find((v) => v.id === venueId)
  const selectedField = fields.find((f) => f.id === fieldId)

  function handleVenueSaved(saved) {
    setVenues((prev) => {
      const exists = prev.some((v) => v.id === saved.id)
      return exists ? prev.map((v) => (v.id === saved.id ? saved : v)) : [...prev, saved]
    })
    setVenueId(saved.id)
    setVenueModal(null)
  }

  function handleFieldSaved(saved) {
    setFields((prev) => {
      const exists = prev.some((f) => f.id === saved.id)
      return exists ? prev.map((f) => (f.id === saved.id ? saved : f)) : [...prev, saved]
    })
    setFieldId(saved.id)
    setFieldModal(null)
    setFieldsError(null)
  }

  async function handleDeleteField(field) {
    if (!window.confirm(`Ștergi terenul „${field.name}"? Această acțiune e ireversibilă.`)) return
    setActionError(null)
    try {
      await deleteField(field.id)
      setFields((prev) => {
        const next = prev.filter((f) => f.id !== field.id)
        setFieldId(next[0]?.id ?? '')
        return next
      })
    } catch {
      setActionError('Ștergerea a eșuat (terenul are rezervări?).')
    }
  }

  if (loading) return <p className="text-slate-500">Se încarcă…</p>
  if (error) return <p className="text-red-600">{error}</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-slate-900">Dashboard administrator</h1>
        {isSuperAdmin && (
          <span className="rounded-full bg-mint-50 px-3 py-1 text-xs font-semibold text-mint-600">
            mod Super Admin
          </span>
        )}
      </div>

      {/* Moderare — doar super_admin */}
      {isSuperAdmin && <VenueModeration />}

      {venues.length === 0 ? (
        isSuperAdmin ? null : (
          <div className="rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-100">
            <p className="text-slate-500">Nu ai nicio bază sportivă încă.</p>
            <button
              type="button"
              onClick={() => setVenueModal({ venue: null })}
              className="mt-4 inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
            >
              + Adaugă prima bază
            </button>
          </div>
        )
      ) : (
        <>
          {/* Selector bază + terenuri */}
          <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100 sm:p-6">
            <div className="flex flex-wrap items-end gap-4">
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700">Bază sportivă</span>
                <select
                  value={venueId}
                  onChange={(e) => setVenueId(e.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                >
                  {venues.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </label>
              {selectedVenue && (
                <span
                  className={`mb-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                    VENUE_STATUS[selectedVenue.status]?.cls ?? 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {VENUE_STATUS[selectedVenue.status]?.label ?? selectedVenue.status}
                </span>
              )}

              <div className="mb-1 ml-auto flex gap-2">
                {selectedVenue && (
                  <button
                    type="button"
                    onClick={() => setVenueModal({ venue: selectedVenue })}
                    className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
                  >
                    Editează baza
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setVenueModal({ venue: null })}
                  className="rounded-lg border border-dashed border-brand-300 px-3 py-1.5 text-sm font-semibold text-brand-600 transition hover:bg-brand-50"
                >
                  + Bază nouă
                </button>
              </div>
            </div>

            {/* Pills terenuri + buton adaugare */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {fields.map((f) => {
                const selected = f.id === fieldId
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFieldId(f.id)}
                    className={[
                      'rounded-lg px-3 py-1.5 text-sm font-semibold transition',
                      selected
                        ? 'bg-brand-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-brand-50 hover:text-brand-700',
                      !f.is_active ? 'opacity-60' : '',
                    ].join(' ')}
                  >
                    {f.name}
                    {!f.is_active && <span className="ml-1.5 text-xs font-normal">(inactiv)</span>}
                  </button>
                )
              })}
              <button
                type="button"
                onClick={() => setFieldModal({ field: null })}
                className="rounded-lg border border-dashed border-brand-300 px-3 py-1.5 text-sm font-semibold text-brand-600 transition hover:bg-brand-50"
              >
                + Adaugă teren
              </button>
            </div>

            {fieldsError && <p className="mt-4 text-sm text-slate-500">{fieldsError}</p>}
            {actionError && <p className="mt-3 text-sm text-red-600">{actionError}</p>}
          </section>

          {/* Abonament (nivel bază) */}
          {venueId && <SubscriptionPanel key={venueId} venueId={venueId} />}

          {selectedField && (
            <>
              {/* Setări teren */}
              <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">{selectedField.name}</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {SPORT_LABELS[selectedField.sport_type] ?? selectedField.sport_type} ·{' '}
                      {SURFACE_LABELS[selectedField.surface_type] ?? selectedField.surface_type} ·{' '}
                      {selectedField.is_indoor ? 'Acoperit' : 'În aer liber'} · slot{' '}
                      {selectedField.slot_duration_minutes} min · minim{' '}
                      {selectedField.min_booking_minutes} min
                      {!selectedField.is_active && (
                        <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
                          inactiv
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setFieldModal({ field: selectedField })}
                      className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
                    >
                      Editează
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteField(selectedField)}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                    >
                      Șterge
                    </button>
                  </div>
                </div>
              </section>

              {/* Calendar + tarife */}
              <CalendarPanel fieldId={fieldId} />
              <PricingPanel key={fieldId} fieldId={fieldId} />
            </>
          )}
        </>
      )}

      {fieldModal && (
        <FieldFormModal
          venueId={venueId}
          field={fieldModal.field}
          onClose={() => setFieldModal(null)}
          onSaved={handleFieldSaved}
        />
      )}

      {venueModal && (
        <VenueFormModal
          venue={venueModal.venue}
          onClose={() => setVenueModal(null)}
          onSaved={handleVenueSaved}
        />
      )}
    </div>
  )
}
