import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import FormField from '../components/FormField'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  // Unde trimitem userul dupa login:
  //  - daca venea de la o ruta protejata (ProtectedRoute a salvat "from"), il ducem acolo;
  //  - altfel, adminii -> /admin, clientii -> pagina principala.
  function redirectByRole(user) {
    const from = location.state?.from?.pathname
    if (from && from !== '/login') {
      navigate(from, { replace: true })
      return
    }
    if (user.role === 'venue_admin' || user.role === 'super_admin') {
      navigate('/admin', { replace: true })
    } else {
      navigate('/', { replace: true })
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const user = await login(email, password)
      redirectByRole(user)
    } catch (err) {
      const status = err.response?.status
      if (status === 401) {
        setError('Email sau parolă incorecte.')
      } else if (status === 403) {
        setError('Contul este dezactivat.')
      } else if (status === 429) {
        // Rate limiting: serverul spune si cat mai ai de asteptat.
        setError(err.response?.data?.detail ?? 'Prea multe încercări. Așteaptă câteva minute.')
      } else {
        setError('A apărut o eroare. Încearcă din nou.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink p-6">
      <div className="w-full max-w-sm rounded-2xl bg-panel p-8 shadow-xl ring-1 ring-line">
        <Link to="/" className="mb-6 inline-block">
          <span className="text-lg font-extrabold uppercase tracking-tight text-accent-400">
            Fluier Final
          </span>
        </Link>

        <h1 className="text-2xl font-extrabold text-white">Autentificare</h1>
        <p className="mt-1 text-sm text-slate-400">Intră în contul tău.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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
            label="Parolă"
            type="password"
            value={password}
            onChange={setPassword}
            required
            autoComplete="current-password"
            placeholder="••••••••"
          />

          {error && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm font-medium text-red-400 ring-1 ring-red-500/20">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-accent-400 px-4 py-2.5 text-sm font-bold text-ink transition hover:bg-accent-300 disabled:opacity-50"
          >
            {submitting ? 'Se autentifică…' : 'Autentificare'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          Nu ai cont?{' '}
          <Link to="/register" className="font-semibold text-accent-400 hover:text-accent-300">
            Creează unul
          </Link>
        </p>
      </div>
    </div>
  )
}
