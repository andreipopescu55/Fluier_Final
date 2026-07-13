import { useState } from 'react'
import { NavLink, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { MenuIcon, CloseIcon, HomeIcon, PitchIcon, CalendarIcon, GearIcon, UserIcon, LogoutIcon } from './ui/icons'
import NotificationsBell from './NotificationsBell'
import AccountMenu from './AccountMenu'

const ROLE_LABELS = {
  client: 'Client',
  venue_admin: 'Administrator',
  super_admin: 'Super Admin',
}

function navLinkClass({ isActive }) {
  const base = 'flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition'
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
  // Administratorul de baza face DOAR gestiunea terenului: fara Find Party / rezervare.
  const isVenueAdmin = user && user.role === 'venue_admin'

  function handleLogout() {
    logout()
    setOpen(false)
    navigate('/')
  }

  const links = (
    <>
      <NavLink to="/" end className={navLinkClass} onClick={() => setOpen(false)}>
        <HomeIcon className="h-4 w-4" />
        Acasă
      </NavLink>
      {!isVenueAdmin && (
        <NavLink to="/meciuri" className={navLinkClass} onClick={() => setOpen(false)}>
          <PitchIcon className="h-4 w-4" />
          Meciuri
        </NavLink>
      )}
      {isClient && (
        <NavLink to="/rezervarile-mele" className={navLinkClass} onClick={() => setOpen(false)}>
          <CalendarIcon className="h-4 w-4" />
          Rezervările mele
        </NavLink>
      )}
      {isAdmin && (
        <NavLink to="/admin" className={navLinkClass} onClick={() => setOpen(false)}>
          <GearIcon className="h-4 w-4" />
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
              <NotificationsBell />
              <AccountMenu />
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

        {/* Clopotel + buton meniu (mobil) */}
        <div className="flex items-center gap-1 sm:hidden">
          {isAuthenticated && <NotificationsBell />}
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? 'Închide meniul' : 'Deschide meniul'}
            aria-expanded={open}
            className="rounded-lg p-2 text-slate-200 transition hover:bg-panel-2"
          >
            {open ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </nav>

      {/* Panou mobil */}
      {open && (
        <div className="animate-fade-in border-t border-line bg-ink px-4 py-3 sm:hidden">
          <div className="flex flex-col gap-1">{links}</div>
          <div className="mt-3 border-t border-line pt-3">
            {isAuthenticated ? (
              <div className="space-y-2">
                {/* Cine esti: avatar cu initiale + nume/rol */}
                <div className="flex items-center gap-2.5 px-1">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-400 text-sm font-extrabold text-ink">
                    {user.full_name
                      .split(/\s+/)
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((w) => w[0].toUpperCase())
                      .join('')}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white">{user.full_name}</p>
                    <p className="text-xs text-slate-400">{ROLE_LABELS[user.role] ?? user.role}</p>
                  </div>
                </div>
                <Link
                  to="/profil"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-200 transition hover:bg-panel-2"
                >
                  <UserIcon className="h-4 w-4 text-slate-400" />
                  Modifică profilul
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-red-400 transition hover:bg-panel-2"
                >
                  <LogoutIcon className="h-4 w-4" />
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
