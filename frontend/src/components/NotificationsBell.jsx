import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  listNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} from '../api/resources'
import { BellIcon } from './ui/icons'

// Cat de des intrebam serverul cate necitite sunt (badge-ul de pe clopotel).
const POLL_MS = 30_000

// Unde duce click-ul pe o notificare, in functie de tip.
function targetFor(n) {
  const meta = n.metadata || {}
  if (n.type.startsWith('match_')) {
    return meta.match_id ? `/meciuri/${meta.match_id}` : '/meciuri'
  }
  if (n.type.startsWith('venue_') || n.type === 'admin_field_change') {
    return '/admin'
  }
  // booking_confirmed / booking_cancelled / booking_reminder
  return '/rezervarile-mele'
}

// "chiar acum", "acum 5 min", "acum 3 h", "ieri", "21.06"
function timeAgo(iso) {
  const then = new Date(iso)
  const diffMin = Math.floor((Date.now() - then.getTime()) / 60_000)
  if (diffMin < 1) return 'chiar acum'
  if (diffMin < 60) return `acum ${diffMin} min`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `acum ${diffH} h`
  if (diffH < 48) return 'ieri'
  return then.toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit' })
}

export default function NotificationsBell() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState('new') // 'new' = necitite | 'history' = citite
  const [unread, setUnread] = useState(0)
  const [items, setItems] = useState(null) // null = neincarcat inca
  const wrapRef = useRef(null)

  const refreshUnread = useCallback(() => {
    getUnreadCount()
      .then((d) => setUnread(d.unread))
      .catch(() => {}) // badge-ul nu are voie sa strice pagina
  }, [])

  // Polling usor: doar contorul, nu lista intreaga.
  useEffect(() => {
    refreshUnread()
    const t = setInterval(refreshUnread, POLL_MS)
    return () => clearInterval(t)
  }, [refreshUnread])

  // La deschidere aducem lista (noi + istoric) si aratam tabul "Noi".
  useEffect(() => {
    if (!open) return
    setTab('new')
    listNotifications({ limit: 50 })
      .then((list) => {
        setItems(list)
        // Sincronizam badge-ul cu lista proaspata (nu asteptam urmatorul poll).
        setUnread(list.filter((n) => !n.is_read).length)
      })
      .catch(() => setItems([]))
  }, [open])

  // Inchidere la click in afara / Escape.
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

  function handleItemClick(n) {
    setOpen(false)
    if (!n.is_read) {
      // Vazuta -> trece in istoric: badge-ul scade imediat, serverul confirma in fundal.
      setUnread((u) => Math.max(u - 1, 0))
      setItems((list) =>
        list ? list.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)) : list
      )
      markNotificationRead(n.id).catch(() => {})
    }
    navigate(targetFor(n))
  }

  function handleMarkAll() {
    // Toate vazute -> toate trec in istoric.
    setUnread(0)
    setItems((list) => (list ? list.map((n) => ({ ...n, is_read: true })) : list))
    markAllNotificationsRead().catch(() => {})
  }

  const fresh = items ? items.filter((n) => !n.is_read) : null
  const history = items ? items.filter((n) => n.is_read) : null
  const shown = tab === 'new' ? fresh : history

  const tabBase = 'flex-1 rounded-lg px-3 py-1.5 text-xs font-bold transition'
  const tabOn = `${tabBase} bg-accent-400 text-ink`
  const tabOff = `${tabBase} text-slate-400 hover:text-white`

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={unread > 0 ? `Notificări (${unread} necitite)` : 'Notificări'}
        aria-expanded={open}
        className="relative rounded-lg p-2 text-slate-300 transition hover:bg-panel-2 hover:text-white"
      >
        <BellIcon className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-400 px-1 text-[10px] font-bold leading-none text-ink">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-4 top-16 z-40 overflow-hidden rounded-xl border border-line bg-panel shadow-xl shadow-black/40 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <p className="text-sm font-bold text-white">Notificări</p>
            {tab === 'new' && fresh && fresh.length > 0 && (
              <button
                type="button"
                onClick={handleMarkAll}
                className="text-xs font-semibold text-accent-400 transition hover:text-accent-300"
              >
                Marchează tot ca citit
              </button>
            )}
          </div>

          {/* Comutator: mesaje noi (necitite) / istoric (citite) */}
          <div className="flex gap-1 border-b border-line bg-panel-2/40 p-1.5">
            <button type="button" onClick={() => setTab('new')} className={tab === 'new' ? tabOn : tabOff}>
              Noi{fresh && fresh.length > 0 ? ` (${fresh.length})` : ''}
            </button>
            <button type="button" onClick={() => setTab('history')} className={tab === 'history' ? tabOn : tabOff}>
              Istoric
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {shown === null ? (
              <p className="px-4 py-6 text-center text-sm text-slate-400">Se încarcă…</p>
            ) : shown.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-400">
                {tab === 'new' ? 'Nicio notificare nouă.' : 'Istoricul e gol.'}
              </p>
            ) : (
              shown.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleItemClick(n)}
                  className={`block w-full border-b border-line/60 px-4 py-3 text-left transition last:border-b-0 hover:bg-panel-2 ${
                    n.is_read ? '' : 'bg-panel-2/60'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!n.is_read && (
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent-400" />
                    )}
                    <div className="min-w-0">
                      <p className={`text-sm ${n.is_read ? 'font-medium text-slate-300' : 'font-semibold text-white'}`}>
                        {n.title}
                      </p>
                      {n.body && (
                        <p className="mt-0.5 line-clamp-2 text-xs text-slate-400">{n.body}</p>
                      )}
                      <p className="mt-1 text-[11px] text-slate-500">{timeAgo(n.created_at)}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
