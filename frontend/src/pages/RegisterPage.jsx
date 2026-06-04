import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import FormField from '../components/FormField'

export default function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      // register() creeaza contul (rol "client") apoi face login automat si intoarce userul.
      await register({
        full_name: fullName,
        email,
        phone: phone || null,
        password,
      })
      // Contul nou e mereu "client" -> il ducem pe pagina principala.
      navigate('/', { replace: true })
    } catch (err) {
      const status = err.response?.status
      if (status === 409) {
        setError('Există deja un cont cu acest email.')
      } else if (status === 422) {
        setError('Verifică datele introduse (parola trebuie să aibă minim 8 caractere).')
      } else {
        setError('A apărut o eroare. Încearcă din nou.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-6">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl ring-1 ring-slate-100">
        <Link to="/" className="mb-6 flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 font-bold text-white">
            R
          </span>
          <span className="text-base font-extrabold text-slate-900">Rezervări Terenuri</span>
        </Link>

        <h1 className="text-2xl font-extrabold text-slate-900">Cont nou</h1>
        <p className="mt-1 text-sm text-slate-500">Înregistrează-te ca să poți rezerva.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <FormField
            label="Nume complet"
            value={fullName}
            onChange={setFullName}
            required
            minLength={2}
            autoComplete="name"
            placeholder="Ion Popescu"
          />
          <FormField
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            required
            autoComplete="email"
            placeholder="nume@exemplu.ro"
          />
          <FormField
            label="Telefon (opțional)"
            value={phone}
            onChange={setPhone}
            autoComplete="tel"
            placeholder="07xx xxx xxx"
          />
          <FormField
            label="Parolă"
            type="password"
            value={password}
            onChange={setPassword}
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="minim 8 caractere"
          />

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {submitting ? 'Se creează contul…' : 'Creează cont'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Ai deja cont?{' '}
          <Link to="/login" className="font-semibold text-brand-600 hover:underline">
            Autentifică-te
          </Link>
        </p>
      </div>
    </div>
  )
}
