import { useEffect, useRef, useState } from 'react'
import { listMatchMessages, sendMatchMessage } from '../api/resources'

// Cat de des cerem mesajele noi cat timp chatul e pe ecran.
const POLL_MS = 4000
const MAX_LEN = 500

function timeRo(iso) {
  return new Date(iso).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })
}
function dayRo(iso) {
  return new Date(iso).toLocaleDateString('ro-RO', { day: 'numeric', month: 'long' })
}

/*
  Conversatia echipei unui meci (Find Party).

  - Vizibila DOAR membrilor (parintele decide daca o randeaza).
  - Polling INCREMENTAL: dupa incarcarea initiala cerem doar mesajele de dupa
    ultimul id vazut (`after`) -> raspuns gol in majoritatea tick-urilor.
  - Polling-ul se opreste cat timp tab-ul browserului e ascuns.
  - `readOnly` (meci expirat/anulat): istoricul ramane, inputul dispare.
*/
export default function MatchChat({ matchId, currentUserId, readOnly }) {
  const [messages, setMessages] = useState(null) // null = neincarcat
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const [lostAccess, setLostAccess] = useState(false)
  const listRef = useRef(null)
  const lastIdRef = useRef(null) // cursorul pentru `after`

  // Adauga mesaje fara duplicate (raspunsul POST si polling-ul se pot suprapune).
  function appendMessages(incoming) {
    if (incoming.length === 0) return
    setMessages((prev) => {
      const seen = new Set((prev ?? []).map((m) => m.id))
      const fresh = incoming.filter((m) => !seen.has(m.id))
      return fresh.length ? [...(prev ?? []), ...fresh] : prev ?? []
    })
    lastIdRef.current = incoming[incoming.length - 1].id
  }

  // Incarcare initiala + polling incremental.
  useEffect(() => {
    let active = true

    function fetchNew(force = false) {
      // Polling-ul face pauza cat timp tab-ul e ascuns; incarcarea initiala
      // si revenirea pe tab (visibilitychange) trec de garda cu force=true.
      if (!force && document.visibilityState === 'hidden') return
      listMatchMessages(matchId, lastIdRef.current)
        .then((data) => active && appendMessages(data))
        .catch((err) => {
          if (!active) return
          // Scos din echipa intre timp -> chatul se inchide politicos.
          if (err.response?.status === 403) setLostAccess(true)
        })
    }

    fetchNew(true)
    const t = setInterval(fetchNew, POLL_MS)
    // Cand tab-ul redevine vizibil, aducem imediat ce s-a strans intre timp.
    function onVisible() {
      if (document.visibilityState === 'visible') fetchNew(true)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      active = false
      clearInterval(t)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [matchId])

  // Auto-scroll jos la mesaje noi — dar NU fura scroll-ul cuiva care citeste istoricul.
  useEffect(() => {
    const el = listRef.current
    if (!el) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    if (nearBottom || el.dataset.first !== 'done') {
      el.scrollTop = el.scrollHeight
      el.dataset.first = 'done'
    }
  }, [messages])

  async function handleSend(e) {
    e?.preventDefault()
    const body = text.trim()
    if (!body || sending) return
    setError(null)
    setSending(true)
    try {
      const msg = await sendMatchMessage(matchId, body)
      appendMessages([msg])
      setText('')
    } catch (err) {
      setError(err.response?.data?.detail ?? 'Mesajul nu a putut fi trimis. Încearcă din nou.')
    } finally {
      setSending(false)
    }
  }

  function handleKeyDown(e) {
    // Enter trimite; Shift+Enter face rand nou.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (lostAccess) {
    return (
      <section className="rounded-2xl bg-panel p-6 ring-1 ring-line">
        <h2 className="text-base font-bold text-white">Conversația echipei</h2>
        <p className="mt-3 text-sm text-slate-400">
          Nu mai faci parte din acest meci, așa că nu mai ai acces la conversație.
        </p>
      </section>
    )
  }

  return (
    <section className="rounded-2xl bg-panel p-6 ring-1 ring-line">
      <h2 className="mb-4 text-base font-bold text-white">
        Conversația echipei
        <span className="ml-2 text-xs font-medium text-slate-500">
          vizibilă doar jucătorilor din meci
        </span>
      </h2>

      {/* Lista de mesaje */}
      <div
        ref={listRef}
        className="max-h-80 space-y-3 overflow-y-auto rounded-xl bg-ink/60 p-4"
      >
        {messages === null ? (
          <p className="py-4 text-center text-sm text-slate-500">Se încarcă…</p>
        ) : messages.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-500">
            Niciun mesaj încă — deschide tu discuția!
          </p>
        ) : (
          messages.map((m) =>
            m.is_system ? (
              // Mesaj de sistem: centrat, discret — cronologia meciului.
              <p key={m.id} className="text-center text-xs italic text-slate-500">
                {m.body} · {dayRo(m.created_at)}, {timeRo(m.created_at)}
              </p>
            ) : (
              <div
                key={m.id}
                className={`flex flex-col ${m.user_id === currentUserId ? 'items-end' : 'items-start'}`}
              >
                <span className="mb-0.5 px-1 text-[11px] text-slate-500">
                  {m.user_id === currentUserId ? 'Tu' : m.author_name} · {timeRo(m.created_at)}
                </span>
                <div
                  className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm ${
                    m.user_id === currentUserId
                      ? 'rounded-br-sm bg-accent-400 font-medium text-ink'
                      : 'rounded-bl-sm bg-panel-2 text-slate-200'
                  }`}
                >
                  {m.body}
                </div>
              </div>
            ),
          )
        )}
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm font-medium text-red-400 ring-1 ring-red-500/20">
          {error}
        </p>
      )}

      {/* Input — sau nota de inchidere, cand meciul nu mai e valabil */}
      {readOnly ? (
        <p className="mt-4 rounded-xl bg-panel-2 px-4 py-3 text-center text-sm text-slate-400">
          Conversația s-a închis — meciul nu mai este valabil.
        </p>
      ) : (
        <form onSubmit={handleSend} className="mt-4">
          <div className="flex items-end gap-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, MAX_LEN))}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder="Scrie un mesaj echipei…"
              className="min-h-[42px] flex-1 resize-none rounded-xl border border-line bg-panel-2 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-accent-400"
            />
            <button
              type="submit"
              disabled={sending || !text.trim()}
              className="rounded-xl bg-accent-400 px-4 py-2.5 text-sm font-bold text-ink transition hover:bg-accent-300 disabled:opacity-50"
            >
              Trimite
            </button>
          </div>
          <p className="mt-1 px-1 text-right text-[11px] text-slate-600">
            {text.length}/{MAX_LEN} · Enter trimite, Shift+Enter = rând nou
          </p>
        </form>
      )}
    </section>
  )
}
