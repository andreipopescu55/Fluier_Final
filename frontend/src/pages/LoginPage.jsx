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

        <h1 className="text-2xl font-extrabold text-slate-900">Autentificare</h1>
        <p className="mt-1 text-sm text-slate-500">Intră în contul tău.</p>

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
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {submitting ? 'Se autentifică…' : 'Autentificare'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Nu ai cont?{' '}
          <Link to="/register" className="font-semibold text-brand-600 hover:underline">
            Creează unul
          </Link>
        </p>
      </div>
    </div>
  )
}
