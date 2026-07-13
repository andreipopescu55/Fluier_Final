import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { UserIcon, LogoutIcon } from './ui/icons'

const ROLE_LABELS = {
  client: 'Client',
  venue_admin: 'Administrator',
  super_admin: 'Super Admin',
}

// Initialele numelui — "logo-ul" contului (ex: "Owner Test" -> "OT").
function initials(fullName) {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
}

export default function AccountMenu() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  // Inchidere la click in afara / Escape (acelasi pattern ca la notificari).
  useEffect(() => {
    if (!open) return
    function onDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function go(path) {
    setOpen(false)
    navigate(path)
  }

  function handleLogout() {
    setOpen(false)
    logout()
    navigate('/')
  }

  // Optiunile meniului — lista e usor de extins cu intrari noi.
  const menuItemClass =
    'flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-semibold text-slate-200 transition hover:bg-panel-2 hover:text-white'

  return (
    <div ref={wrapRef} className="relative">
      {/* Butonul-cont: avatar cu initiale + nume/rol */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Meniul contului"
        aria-expanded={open}
        className="flex items-center gap-2.5 rounded-lg p-1.5 transition hover:bg-panel-2"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-400 text-sm font-extrabold text-ink">
          {initials(user.full_name)}
        </span>
        <span className="hidden text-left sm:block">
          <span className="block text-sm font-semibold leading-tight text-white">
            {user.full_name}
          </span>
          <span className="block text-xs leading-tight text-slate-400">
            {ROLE_LABELS[user.role] ?? user.role}
          </span>
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-60 overflow-hidden rounded-xl border border-line bg-panel shadow-xl shadow-black/40">
          {/* Antet: cine esti */}
          <div className="border-b border-line px-4 py-3">
            <p className="text-sm font-bold text-white">{user.full_name}</p>
            <p className="truncate text-xs text-slate-400">{user.email}</p>
          </div>

          <div className="py-1">
            <button type="button" onClick={() => go('/profil')} className={menuItemClass}>
              <UserIcon className="h-4 w-4 text-slate-400" />
              Modifică profilul
            </button>
            {/* Aici intra usor optiuni viitoare (setari, tema, etc.) */}
          </div>

          <div className="border-t border-line py-1">
            <button
              type="button"
              onClick={handleLogout}
              className={`${menuItemClass} text-red-400 hover:text-red-300`}
            >
              <LogoutIcon className="h-4 w-4" />
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
