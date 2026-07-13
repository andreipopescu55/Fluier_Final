import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { updateProfile, changePassword } from '../api/resources'
import FormField from '../components/FormField'

const ROLE_LABELS = {
  client: 'Client',
  venue_admin: 'Administrator de bază',
  super_admin: 'Super Admin',
}

// Mesaj de stare (succes/eroare) sub fiecare formular.
function StatusNote({ note }) {
  if (!note) return null
  return (
    <p
      className={`rounded-lg px-3 py-2 text-sm font-semibold ${
        note.ok
          ? 'bg-accent-400/10 text-accent-300'
          : 'bg-red-500/10 text-red-400'
      }`}
    >
      {note.text}
    </p>
  )
}

export default function ProfilePage() {
  const { user, refreshUser } = useAuth()

  // ── Datele contului ────────────────────────────────────────────
  const [fullName, setFullName] = useState(user.full_name)
  const [phone, setPhone] = useState(user.phone ?? '')
  const [profileNote, setProfileNote] = useState(null)
  const [savingProfile, setSavingProfile] = useState(false)

  // ── Schimbare parola ───────────────────────────────────────────
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwNote, setPwNote] = useState(null)
  const [savingPw, setSavingPw] = useState(false)

  async function handleProfileSave(e) {
    e.preventDefault()
    setProfileNote(null)
    setSavingProfile(true)
    try {
      await updateProfile({ full_name: fullName.trim(), phone: phone.trim() || null })
      await refreshUser() // navbar-ul preia imediat numele nou
      setProfileNote({ ok: true, text: 'Datele au fost salvate.' })
    } catch (err) {
      setProfileNote({
        ok: false,
        text: err.response?.data?.detail ?? 'A apărut o eroare. Încearcă din nou.',
      })
    } finally {
      setSavingProfile(false)
    }
  }

  async function handlePasswordChange(e) {
    e.preventDefault()
    setPwNote(null)
    if (newPw !== confirmPw) {
      setPwNote({ ok: false, text: 'Parola nouă nu coincide cu confirmarea.' })
      return
    }
    setSavingPw(true)
    try {
      await changePassword(currentPw, newPw)
      setCurrentPw('')
      setNewPw('')
      setConfirmPw('')
      setPwNote({ ok: true, text: 'Parola a fost schimbată.' })
    } catch (err) {
      setPwNote({
        ok: false,
        text: err.response?.data?.detail ?? 'A apărut o eroare. Încearcă din nou.',
      })
    } finally {
      setSavingPw(false)
    }
  }

  const submitClass =
    'rounded-lg bg-accent-400 px-4 py-2 text-sm font-bold text-ink transition hover:bg-accent-300 disabled:opacity-60'

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-3xl font-extrabold text-white">Profilul meu</h1>
      <p className="mt-1 text-slate-400">
        Gestionează datele contului tău.
      </p>

      {/* ── Datele contului ── */}
      <section className="mt-8 rounded-xl border border-line bg-panel p-6">
        <h2 className="text-lg font-bold text-white">Datele contului</h2>
        <form onSubmit={handleProfileSave} className="mt-4 space-y-4">
          <FormField
            label="Nume complet"
            value={fullName}
            onChange={setFullName}
            required
            minLength={2}
            autoComplete="name"
          />
          <FormField
            label="Telefon"
            type="tel"
            value={phone}
            onChange={setPhone}
            placeholder="07xx xxx xxx"
            autoComplete="tel"
          />
          {/* Email + rol: doar afisate — emailul e identitatea contului,
              rolul il gestioneaza super-adminul. */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <span className="mb-1 block text-sm font-semibold text-slate-300">Email</span>
              <p className="rounded-lg border border-line bg-ink px-3 py-2 text-sm text-slate-400">
                {user.email}
              </p>
            </div>
            <div>
              <span className="mb-1 block text-sm font-semibold text-slate-300">Rol</span>
              <p className="rounded-lg border border-line bg-ink px-3 py-2 text-sm text-slate-400">
                {ROLE_LABELS[user.role] ?? user.role}
              </p>
            </div>
          </div>
          <StatusNote note={profileNote} />
          <button type="submit" disabled={savingProfile} className={submitClass}>
            {savingProfile ? 'Se salvează…' : 'Salvează modificările'}
          </button>
        </form>
      </section>

      {/* ── Schimbare parola ── */}
      <section className="mt-6 rounded-xl border border-line bg-panel p-6">
        <h2 className="text-lg font-bold text-white">Schimbă parola</h2>
        <form onSubmit={handlePasswordChange} className="mt-4 space-y-4">
          <FormField
            label="Parola curentă"
            type="password"
            value={currentPw}
            onChange={setCurrentPw}
            required
            autoComplete="current-password"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Parola nouă"
              type="password"
              value={newPw}
              onChange={setNewPw}
              required
              minLength={8}
              autoComplete="new-password"
            />
            <FormField
              label="Confirmă parola nouă"
              type="password"
              value={confirmPw}
              onChange={setConfirmPw}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          <StatusNote note={pwNote} />
          <button type="submit" disabled={savingPw} className={submitClass}>
            {savingPw ? 'Se schimbă…' : 'Schimbă parola'}
          </button>
        </form>
      </section>
    </div>
  )
}
