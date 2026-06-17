import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { listMyVenues, listVenueFieldsManage, deleteField } from '../api/resources'
import { SURFACE_LABELS, fieldFormat } from '../lib/labels'
import { Skeleton } from '../components/ui/Skeleton'
import CalendarPanel from '../components/admin/CalendarPanel'
import PricingPanel from '../components/admin/PricingPanel'
import FieldFormModal from '../components/admin/FieldFormModal'
import VenueFormModal from '../components/admin/VenueFormModal'
import SubscriptionPanel from '../components/admin/SubscriptionPanel'
import VenueModeration from '../components/admin/VenueModeration'
import AdminUsers from '../components/admin/AdminUsers'

const VENUE_STATUS = {
  pending: { label: 'În așteptare', cls: 'bg-amber-400/15 text-amber-300' },
  approved: { label: 'Aprobată', cls: 'bg-accent-400/15 text-accent-400' },
  suspended: { label: 'Suspendată', cls: 'bg-red-500/15 text-red-400' },
}

const panelCls = 'rounded-2xl bg-panel ring-1 ring-line'
const ghostBtn =
  'rounded-lg bg-panel-2 px-3 py-1.5 text-sm font-semibold text-slate-200 transition hover:text-white'
const dashedBtn =
  'rounded-lg border border-dashed border-line px-3 py-1.5 text-sm font-semibold text-accent-400 transition hover:bg-accent-400/10'

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

  const [fieldModal, setFieldModal] = useState(null)
  const [venueModal, setVenueModal] = useState(null)
  const [actionError, setActionError] = useState(null)

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
    } catch (err) {
      setActionError(err.response?.data?.detail || 'Ștergerea a eșuat. Încearcă din nou.')
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    )
  }
  if (error) return <p className="text-red-400">{error}</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-white">Dashboard administrator</h1>
        {isSuperAdmin && (
          <span className="rounded-full bg-accent-400/10 px-3 py-1 text-xs font-semibold text-accent-400">
            mod Super Admin
          </span>
        )}
      </div>

      {/* Moderare + gestionare administratori — doar super_admin */}
      {isSuperAdmin && <VenueModeration />}
      {isSuperAdmin && <AdminUsers />}

      {venues.length === 0 ? (
        isSuperAdmin ? null : (
          <div className={`${panelCls} p-10 text-center`}>
            <p className="text-slate-400">Nu ai nicio bază sportivă încă.</p>
            <button
              type="button"
              onClick={() => setVenueModal({ venue: null })}
              className="mt-4 inline-block rounded-lg bg-accent-400 px-4 py-2 text-sm font-bold text-ink transition hover:bg-accent-300"
            >
              + Adaugă prima bază
            </button>
          </div>
        )
      ) : (
        <>
          {/* Selector bază + terenuri */}
          <section className={`${panelCls} p-4 sm:p-6`}>
            <div className="flex flex-wrap items-end gap-4">
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-300">Bază sportivă</span>
                <select
                  value={venueId}
                  onChange={(e) => setVenueId(e.target.value)}
                  className="rounded-lg border border-line bg-panel-2 px-3 py-2 text-sm text-slate-200 outline-none focus:border-accent-400"
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
                    VENUE_STATUS[selectedVenue.status]?.cls ?? 'bg-panel-2 text-slate-400'
                  }`}
                >
                  {VENUE_STATUS[selectedVenue.status]?.label ?? selectedVenue.status}
                </span>
              )}

              <div className="mb-1 ml-auto flex gap-2">
                {selectedVenue && (
                  <button type="button" onClick={() => setVenueModal({ venue: selectedVenue })} className={ghostBtn}>
                    Editează baza
                  </button>
                )}
                <button type="button" onClick={() => setVenueModal({ venue: null })} className={dashedBtn}>
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
                        ? 'bg-accent-400 text-ink'
                        : 'bg-panel-2 text-slate-200 hover:bg-accent-400/10 hover:text-accent-400',
                      !f.is_active ? 'opacity-50' : '',
                    ].join(' ')}
                  >
                    {f.name}
                    {!f.is_active && <span className="ml-1.5 text-xs font-normal">(inactiv)</span>}
                  </button>
                )
              })}
              <button type="button" onClick={() => setFieldModal({ field: null })} className={dashedBtn}>
                + Adaugă teren
              </button>
            </div>

            {fieldsError && <p className="mt-4 text-sm text-slate-400">{fieldsError}</p>}
            {actionError && <p className="mt-3 text-sm text-red-400">{actionError}</p>}
          </section>

          {/* Abonament (nivel bază) */}
          {venueId && <SubscriptionPanel key={venueId} venueId={venueId} />}

          {selectedField && (
            <>
              {/* Setări teren */}
              <section className={`${panelCls} p-4 sm:p-6`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-white">{selectedField.name}</h2>
                    <p className="mt-1 text-sm text-slate-400">
                      {fieldFormat(selectedField)} ·{' '}
                      {SURFACE_LABELS[selectedField.surface_type] ?? selectedField.surface_type} ·{' '}
                      {selectedField.is_indoor ? 'Acoperit' : 'În aer liber'} · slot{' '}
                      {selectedField.slot_duration_minutes} min · minim{' '}
                      {selectedField.min_booking_minutes} min
                      {!selectedField.is_active && (
                        <span className="ml-2 rounded-full bg-panel-2 px-2 py-0.5 text-xs font-semibold text-slate-400">
                          inactiv
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setFieldModal({ field: selectedField })} className={ghostBtn}>
                      Editează
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteField(selectedField)}
                      className="rounded-lg border border-red-500/30 px-3 py-1.5 text-sm font-semibold text-red-400 transition hover:bg-red-500/10"
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
