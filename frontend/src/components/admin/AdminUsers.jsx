import { useEffect, useState } from 'react'
import { listAdminUsers, createAdminUser } from '../../api/resources'

const ROLE = {
  venue_admin: { label: 'Administrator bază', cls: 'bg-accent-400/15 text-accent-400' },
  super_admin: { label: 'Super Admin', cls: 'bg-amber-400/15 text-amber-300' },
}

const inputCls =
  'w-full rounded-lg border border-line bg-panel-2 px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none focus:border-accent-400'

const EMPTY = { email: '', full_name: '', phone: '', password: '', role: 'venue_admin' }

export default function AdminUsers() {
  const [admins, setAdmins] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [ok, setOk] = useState(null)

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  useEffect(() => {
    let active = true
    listAdminUsers()
      .then((us) => active && setAdmins(us))
      .catch(() => {})
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setOk(null)
    if (form.password.length < 8) {
      setError('Parola trebuie să aibă minim 8 caractere.')
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
      setError(
        s === 409
          ? 'Emailul este deja folosit.'
          : err.response?.data?.detail || 'Crearea contului a eșuat.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-2xl bg-panel p-4 ring-1 ring-line sm:p-6">
      <h2 className="text-lg font-bold text-white">Administratori</h2>
      <p className="mt-1 text-sm text-slate-400">
        Creează conturi pentru administratorii de bază. Le comunici email-ul și parola, apoi ei își adaugă bazele.
      </p>

      {/* Formular creare */}
      <form onSubmit={handleSubmit} className="mt-4 grid gap-3 sm:grid-cols-2">
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

      {ok && (
        <p className="mt-3 rounded-lg bg-accent-400/10 px-3 py-2 text-sm font-medium text-accent-400 ring-1 ring-accent-400/20">
          ✓ {ok}
        </p>
      )}
      {error && (
        <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm font-medium text-red-400 ring-1 ring-red-500/20">
          {error}
        </p>
      )}

      {/* Lista administratori */}
      <h3 className="mt-6 mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">
        Administratori existenți {!loading && `(${admins.length})`}
      </h3>
      {loading ? (
        <p className="text-sm text-slate-400">Se încarcă…</p>
      ) : admins.length === 0 ? (
        <p className="text-sm text-slate-400">Niciun administrator încă.</p>
      ) : (
        <ul className="space-y-2">
          {admins.map((u) => {
            const r = ROLE[u.role] ?? { label: u.role, cls: 'bg-panel-2 text-slate-400' }
            return (
              <li key={u.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line p-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">{u.full_name}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${r.cls}`}>{r.label}</span>
                  </div>
                  <p className="text-sm text-slate-400">{u.email}</p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
