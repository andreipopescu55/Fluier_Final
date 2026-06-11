import { useState } from 'react'
import { NavLink, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { MenuIcon, CloseIcon } from './ui/icons'

const ROLE_LABELS = {
  client: 'Client',
  venue_admin: 'Administrator',
  super_admin: 'Super Admin',
}

function navLinkClass({ isActive }) {
  const base = 'rounded-lg px-3 py-2 text-sm font-semibold transition'
  return isActive
    ? `${base} text-accent-400`
    : `${base} text-slate-300 hover:text-white`
}

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const isAdmin = user && (user.role === 'venue_admin' || user.role === 'super_admin')
  const isClient = user && user.role === 'client'

  function handleLogout() {
    logout()
    setOpen(false)
    navigate('/')
  }

  const links = (
    <>
      <NavLink to="/" end className={navLinkClass} onClick={() => setOpen(false)}>
        Acasă
      </NavLink>
      {isClient && (
        <NavLink to="/rezervarile-mele" className={navLinkClass} onClick={() => setOpen(false)}>
          Rezervările mele
        </NavLink>
      )}
      {isAdmin && (
        <NavLink to="/admin" className={navLinkClass} onClick={() => setOpen(false)}>
          Admin
        </NavLink>
      )}
    </>
  )

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-ink/80 backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        {/* Wordmark */}
        <Link to="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
          <span className="text-xl font-extrabold uppercase tracking-tight text-accent-400">
            Fluier&nbsp;Final
          </span>
        </Link>

        {/* Link-uri centrale (desktop) */}
        <div className="hidden items-center gap-1 sm:flex">{links}</div>

        {/* Zona auth (desktop) */}
        <div className="hidden items-center gap-3 sm:flex">
          {isAuthenticated ? (
            <>
              <div className="text-right">
                <p className="text-sm font-semibold leading-tight text-white">{user.full_name}</p>
                <p className="text-xs leading-tight text-slate-400">
                  {ROLE_LABELS[user.role] ?? user.role}
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="rounded-lg border border-line bg-panel-2 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:border-line-2 hover:text-white"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-300 transition hover:text-white"
              >
                Autentificare
              </Link>
              <Link
                to="/register"
                className="rounded-lg bg-accent-400 px-4 py-2 text-sm font-bold text-ink transition hover:bg-accent-300"
              >
                Cont nou
              </Link>
            </>
          )}
        </div>

        {/* Buton meniu (mobil) */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? 'Închide meniul' : 'Deschide meniul'}
          aria-expanded={open}
          className="rounded-lg p-2 text-slate-200 transition hover:bg-panel-2 sm:hidden"
        >
          {open ? <CloseIcon /> : <MenuIcon />}
        </button>
      </nav>

      {/* Panou mobil */}
      {open && (
        <div className="animate-fade-in border-t border-line bg-ink px-4 py-3 sm:hidden">
          <div className="flex flex-col gap-1">{links}</div>
          <div className="mt-3 border-t border-line pt-3">
            {isAuthenticated ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">{user.full_name}</p>
                  <p className="text-xs text-slate-400">{ROLE_LABELS[user.role] ?? user.role}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="rounded-lg border border-line bg-panel-2 px-3 py-2 text-sm font-semibold text-slate-200"
                >
                  Logout
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Link
                  to="/login"
                  onClick={() => setOpen(false)}
                  className="flex-1 rounded-lg border border-line px-3 py-2 text-center text-sm font-semibold text-slate-200"
                >
                  Autentificare
                </Link>
                <Link
                  to="/register"
                  onClick={() => setOpen(false)}
                  className="flex-1 rounded-lg bg-accent-400 px-3 py-2 text-center text-sm font-bold text-ink"
                >
                  Cont nou
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
