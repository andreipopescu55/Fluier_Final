import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../auth/AuthContext'
import {
  listAdminUsers, createAdminUser, listAllVenues, setVenueStatus, setAdminActive,
} from '../../api/resources'

const ROLE = {
  venue_admin: { label: 'Administrator bază', cls: 'bg-accent-400/15 text-accent-400' },
  super_admin: { label: 'Super Admin', cls: 'bg-amber-400/15 text-amber-300' },
}
const STATUS = {
  pending: { label: 'În așteptare', cls: 'bg-amber-400/15 text-amber-300' },
  approved: { label: 'Aprobată', cls: 'bg-accent-400/15 text-accent-400' },
  suspended: { label: 'Suspendată', cls: 'bg-red-500/15 text-red-400' },
}

const inputCls =
  'w-full rounded-lg border border-line bg-panel-2 px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none focus:border-accent-400'
const EMPTY = { email: '', full_name: '', phone: '', password: '', role: 'venue_admin' }

function summarize(vs) {
  const s = { total: vs.length, pending: 0, approved: 0, suspended: 0 }
  for (const v of vs) {
    if (v.status === 'pending') s.pending++
    else if (v.status === 'approved') s.approved++
    else if (v.status === 'suspended') s.suspended++
  }
  return s
}

export default function AdminHub() {
  const { user } = useAuth()
  const [admins, setAdmins] = useState([])
  const [venues, setVenues] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [expandedId, setExpandedId] = useState(null)
  const [busyVenueId, setBusyVenueId] = useState(null)
  const [confirmId, setConfirmId] = useState(null) // adminul pentru care cerem confirmarea dezactivarii
  const [busyAdminId, setBusyAdminId] = useState(null)

  // Formular creare cont
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [ok, setOk] = useState(null)
  const [createError, setCreateError] = useState(null)
  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  useEffect(() => {
    let active = true
    Promise.all([listAdminUsers(), listAllVenues()])
      .then(([us, vs]) => {
        if (!active) return
        setAdmins(us)
        setVenues(vs)
      })
      .catch(() => active && setError('Nu am putut încărca datele.'))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [])

  // Grupare baze pe proprietar + bucket pentru proprietari care nu sunt in lista de admini.
  const { groups, others } = useMemo(() => {
    const adminIds = new Set(admins.map((a) => a.id))
    const g = admins.map((a) => ({
      admin: a,
      venues: venues.filter((v) => v.owner_id === a.id),
    }))
    const o = venues.filter((v) => !adminIds.has(v.owner_id))
    return { groups: g, others: o }
  }, [admins, venues])

  const totalPending = venues.filter((v) => v.status === 'pending').length

  async function changeStatus(venue, status) {
    setBusyVenueId(venue.id)
    setError(null)
    try {
      const updated = await setVenueStatus(venue.id, status)
      setVenues((prev) => prev.map((v) => (v.id === updated.id ? updated : v)))
    } catch {
      setError('Acțiunea a eșuat.')
    } finally {
      setBusyVenueId(null)
    }
  }

  async function toggleActive(admin, isActive) {
    setBusyAdminId(admin.id)
    setError(null)
    try {
      const updated = await setAdminActive(admin.id, isActive)
      setAdmins((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
      setConfirmId(null)
    } catch (err) {
      setError(err.response?.data?.detail || 'Acțiunea a eșuat.')
    } finally {
      setBusyAdminId(null)
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    setCreateError(null)
    setOk(null)
    if (form.password.length < 8) {
      setCreateError('Parola trebuie să aibă minim 8 caractere.')
      return
    }
    setSaving(true)
    try {
      const created = await createAdminUser({
        email: form.email.trim(),
        full_name: form.full_name.trim(),
        phone: form.phone.trim() || null,
        password: form.password,
        role: form.role,
      })
      setAdmins((prev) => [created, ...prev])
      setOk(`Cont creat: ${created.email}. Comunică-i parola noului administrator.`)
      setForm(EMPTY)
    } catch (err) {
      const s = err.response?.status
      setCreateError(
        s === 409 ? 'Emailul este deja folosit.' : err.response?.data?.detail || 'Crearea contului a eșuat.',
      )
    } finally {
      setSaving(false)
    }
  }

  function venueRow(v) {
    const st = STATUS[v.status] ?? { label: v.status, cls: 'bg-panel-2 text-slate-400' }
    return (
      <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-panel-2 px-3 py-2.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white">{v.name}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${st.cls}`}>{st.label}</span>
          </div>
          <p className="text-sm text-slate-400">{v.city}, {v.county}</p>
        </div>
        <div className="flex gap-2">
          {v.status !== 'approved' && (
            <button type="button" onClick={() => changeStatus(v, 'approved')} disabled={busyVenueId === v.id}
              className="rounded-lg bg-accent-400 px-3 py-1.5 text-sm font-bold text-ink transition hover:bg-accent-300 disabled:opacity-50">
              {v.status === 'suspended' ? 'Reactivează' : 'Aprobă'}
            </button>
          )}
          {v.status !== 'suspended' && (
            <button type="button" onClick={() => changeStatus(v, 'suspended')} disabled={busyVenueId === v.id}
              className="rounded-lg border border-red-500/30 px-3 py-1.5 text-sm font-semibold text-red-400 transition hover:bg-red-500/10 disabled:opacity-50">
              Suspendă
            </button>
          )}
        </div>
      </li>
    )
  }

  return (
    <section className="rounded-2xl bg-panel p-4 ring-1 ring-line sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-white">Administratori</h2>
        {totalPending > 0 && (
          <span className="rounded-full bg-amber-400/15 px-2.5 py-0.5 text-xs font-semibold text-amber-300">
            {totalPending} {totalPending === 1 ? 'bază în așteptare' : 'baze în așteptare'}
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-slate-400">
        Creează conturi de administrator și moderează bazele fiecăruia. Apasă pe un administrator ca să-i vezi bazele.
      </p>

      {/* Formular creare cont */}
      <form onSubmit={handleCreate} className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-300">Nume complet</span>
          <input type="text" required value={form.full_name} onChange={(e) => set('full_name', e.target.value)}
            placeholder="ex: Ion Popescu" className={inputCls} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-300">Email</span>
          <input type="email" required value={form.email} onChange={(e) => set('email', e.target.value)}
            placeholder="admin@baza.ro" className={inputCls} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-300">Telefon (opțional)</span>
          <input type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)}
            placeholder="07xxxxxxxx" className={inputCls} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-300">Parolă (minim 8 caractere)</span>
          <input type="text" required value={form.password} onChange={(e) => set('password', e.target.value)}
            placeholder="parolă inițială" className={inputCls} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-300">Rol</span>
          <select value={form.role} onChange={(e) => set('role', e.target.value)} className={inputCls}>
            <option value="venue_admin">Administrator bază</option>
            <option value="super_admin">Super Admin</option>
          </select>
        </label>
        <div className="flex items-end">
          <button type="submit" disabled={saving}
            className="w-full rounded-lg bg-accent-400 px-4 py-2 text-sm font-bold text-ink transition hover:bg-accent-300 disabled:opacity-50">
            {saving ? 'Se creează…' : 'Creează cont'}
          </button>
        </div>
      </form>
      {ok && <p className="mt-3 rounded-lg bg-accent-400/10 px-3 py-2 text-sm font-medium text-accent-400 ring-1 ring-accent-400/20">✓ {ok}</p>}
      {createError && <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm font-medium text-red-400 ring-1 ring-red-500/20">{createError}</p>}

      {/* Lista administratori (accordion) */}
      <h3 className="mt-6 mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">
        Administratori {!loading && `(${admins.length})`}
      </h3>
      {error && <p className="mb-2 text-sm text-red-400">{error}</p>}
      {loading ? (
        <p className="text-sm text-slate-400">Se încarcă…</p>
      ) : (
        <ul className="space-y-2">
          {groups.map(({ admin, venues: vs }) => {
            const r = ROLE[admin.role] ?? { label: admin.role, cls: 'bg-panel-2 text-slate-400' }
            const s = summarize(vs)
            const open = expandedId === admin.id
            const canManage = admin.role !== 'super_admin' && admin.id !== user?.id
            const confirming = confirmId === admin.id
            const busy = busyAdminId === admin.id
            return (
              <li key={admin.id} className="overflow-hidden rounded-xl border border-line">
                <div className="flex items-center justify-between gap-3 p-3">
                  {/* Zona de expandare (buton separat) */}
                  <button type="button" onClick={() => setExpandedId(open ? null : admin.id)}
                    className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                    <span className={`text-slate-500 transition ${open ? 'rotate-90' : ''}`}>▸</span>
                    <div className={`min-w-0 ${!admin.is_active ? 'opacity-60' : ''}`}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-white">{admin.full_name}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${r.cls}`}>{r.label}</span>
                        {!admin.is_active && (
                          <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-semibold text-red-400">
                            Inactiv
                          </span>
                        )}
                      </div>
                      <p className="truncate text-sm text-slate-400">{admin.email}</p>
                    </div>
                  </button>

                  {/* Sumar + actiuni */}
                  <div className="flex shrink-0 items-center gap-2 text-xs">
                    <span className="text-slate-400">{s.total} {s.total === 1 ? 'bază' : 'baze'}</span>
                    {s.pending > 0 && (
                      <span className="rounded-full bg-amber-400/15 px-2 py-0.5 font-semibold text-amber-300">
                        {s.pending} în așteptare
                      </span>
                    )}

                    {canManage && (
                      admin.is_active ? (
                        confirming ? (
                          <span className="flex items-center gap-1.5">
                            <span className="text-slate-300">Sigur?</span>
                            <button type="button" onClick={() => toggleActive(admin, false)} disabled={busy}
                              className="rounded-lg bg-red-500/90 px-2.5 py-1 font-bold text-white transition hover:bg-red-500 disabled:opacity-50">
                              {busy ? '…' : 'Da, dezactivează'}
                            </button>
                            <button type="button" onClick={() => setConfirmId(null)} disabled={busy}
                              className="rounded-lg border border-line px-2.5 py-1 font-semibold text-slate-300 transition hover:text-white">
                              Renunță
                            </button>
                          </span>
                        ) : (
                          <button type="button" onClick={() => setConfirmId(admin.id)}
                            className="rounded-lg border border-red-500/30 px-2.5 py-1 font-semibold text-red-400 transition hover:bg-red-500/10">
                            Dezactivează
                          </button>
                        )
                      ) : (
                        <button type="button" onClick={() => toggleActive(admin, true)} disabled={busy}
                          className="rounded-lg bg-accent-400 px-2.5 py-1 font-bold text-ink transition hover:bg-accent-300 disabled:opacity-50">
                          {busy ? '…' : 'Reactivează'}
                        </button>
                      )
                    )}
                  </div>
                </div>

                {open && (
                  <div className="border-t border-line p-3">
                    {vs.length === 0 ? (
                      <p className="text-sm text-slate-500">Acest administrator nu are nicio bază încă.</p>
                    ) : (
                      <ul className="space-y-2">{vs.map(venueRow)}</ul>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {/* Baze fara proprietar in lista (edge case) */}
      {others.length > 0 && (
        <>
          <h3 className="mt-6 mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">Alți proprietari</h3>
          <ul className="space-y-2">{others.map(venueRow)}</ul>
        </>
      )}
    </section>
  )
}
