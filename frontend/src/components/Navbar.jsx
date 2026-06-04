import { NavLink, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

// Eticheta prietenoasa pentru fiecare rol (afisata langa numele userului).
const ROLE_LABELS = {
  client: 'Client',
  venue_admin: 'Administrator',
  super_admin: 'Super Admin',
}

// Stilul unui link de navigatie. NavLink ne da automat isActive (ruta curenta).
function navLinkClass({ isActive }) {
  const base = 'rounded-lg px-3 py-2 text-sm font-semibold transition'
  return isActive
    ? `${base} bg-brand-50 text-brand-700`
    : `${base} text-slate-600 hover:bg-slate-100 hover:text-slate-900`
}

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth()
  const navigate = useNavigate()

  // venue_admin si super_admin folosesc ACELASI link/dashboard (cerinta ta).
  const isAdmin = user && (user.role === 'venue_admin' || user.role === 'super_admin')
  const isClient = user && user.role === 'client'

  function handleLogout() {
    logout()
    navigate('/') // dupa logout revenim pe pagina publica
  }

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 font-bold text-white">
            R
          </span>
          <span className="text-base font-extrabold text-slate-900">Rezervări Terenuri</span>
        </Link>

        {/* Link-uri centrale (condiționate de rol) */}
        <div className="hidden items-center gap-1 sm:flex">
          <NavLink to="/" end className={navLinkClass}>
            Acasă
          </NavLink>

          {isClient && (
            <NavLink to="/rezervarile-mele" className={navLinkClass}>
              Rezervările mele
            </NavLink>
          )}

          {isAdmin && (
            <NavLink to="/admin" className={navLinkClass}>
              Admin
            </NavLink>
          )}
        </div>

        {/* Zona de autentificare (dreapta) */}
        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <>
              <div className="hidden text-right sm:block">
                <p className="text-sm font-semibold leading-tight text-slate-900">
                  {user.full_name}
                </p>
                <p className="text-xs leading-tight text-slate-500">
                  {ROLE_LABELS[user.role] ?? user.role}
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
              >
                Autentificare
              </Link>
              <Link
                to="/register"
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
              >
                Cont nou
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  )
}
