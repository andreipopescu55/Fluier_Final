import { useRef, useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import { getFieldCalendar, blockInterval } from '../../api/resources'

// Date -> "YYYY-MM-DDTHH:MM:SS" in ora LOCALA (fara conversie UTC).
// Backend-ul interpreteaza string-ul ca ora Bucuresti, exact ce afiseaza calendarul.
function toLocalNaive(d) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:00`
}

function fmtRange(start, end) {
  const opts = { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }
  const s = new Intl.DateTimeFormat('ro-RO', opts).format(start)
  const e = new Intl.DateTimeFormat('ro-RO', { hour: '2-digit', minute: '2-digit' }).format(end)
  return `${s}–${e}`
}

export default function CalendarPanel({ fieldId }) {
  const calendarRef = useRef(null)

  // Modal de blocare manuala: {start, end} (Date) cand selectezi un interval.
  const [blockSel, setBlockSel] = useState(null)
  const [blockNotes, setBlockNotes] = useState('')
  const [blocking, setBlocking] = useState(false)
  const [blockError, setBlockError] = useState(null)

  // Detalii eveniment la click (rezervare sau blocaj).
  const [detail, setDetail] = useState(null)

  // FullCalendar cere evenimentele printr-o functie; e re-apelata la schimbarea
  // intervalului vizibil. Trimitem from/to ca ora locala.
  function loadEvents(info, success, failure) {
    getFieldCalendar(fieldId, toLocalNaive(info.start), toLocalNaive(info.end))
      .then((events) => success(events))
      .catch((err) => failure(err))
  }

  function onSelect(selectInfo) {
    setBlockError(null)
    setBlockNotes('')
    setBlockSel({ start: selectInfo.start, end: selectInfo.end })
  }

  async function confirmBlock() {
    if (!blockSel) return
    setBlocking(true)
    setBlockError(null)
    try {
      await blockInterval(fieldId, {
        start_time: toLocalNaive(blockSel.start),
        end_time: toLocalNaive(blockSel.end),
        notes: blockNotes.trim() || null,
      })
      setBlockSel(null)
      calendarRef.current?.getApi().refetchEvents()
      calendarRef.current?.getApi().unselect()
    } catch (err) {
      setBlockError(
        err.response?.status === 409
          ? 'Intervalul se suprapune cu o rezervare/blocaj existent.'
          : 'Blocarea a eșuat. Încearcă din nou.',
      )
    } finally {
      setBlocking(false)
    }
  }

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-slate-900">Calendar rezervări</h2>
        <p className="text-xs text-slate-400">
          Selectează un interval gol ca să-l blochezi (întreținere, eveniment privat).
        </p>
      </div>

      <FullCalendar
        key={fieldId}
        ref={calendarRef}
        plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        locale="ro"
        firstDay={1}
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'timeGridWeek,timeGridDay,dayGridMonth',
        }}
        buttonText={{ today: 'Azi', week: 'Săptămână', day: 'Zi', month: 'Lună' }}
        allDaySlot={false}
        slotMinTime="07:00:00"
        slotMaxTime="23:00:00"
        nowIndicator
        selectable
        selectMirror
        events={loadEvents}
        eventClick={(info) => {
          const p = info.event.extendedProps
          setDetail({
            title: info.event.title,
            range: fmtRange(info.event.start, info.event.end),
            ...p,
          })
        }}
        select={onSelect}
        height="auto"
      />

      {/* Modal blocare manuala */}
      {blockSel && (
        <Modal onClose={() => setBlockSel(null)}>
          <h3 className="text-lg font-bold text-slate-900">Blochează interval</h3>
          <p className="mt-1 text-sm text-slate-500">{fmtRange(blockSel.start, blockSel.end)}</p>
          <label className="mt-4 block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Motiv (opțional)</span>
            <input
              type="text"
              value={blockNotes}
              onChange={(e) => setBlockNotes(e.target.value)}
              placeholder="ex: întreținere, eveniment privat"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </label>
          {blockError && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {blockError}
            </p>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setBlockSel(null)}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
            >
              Renunță
            </button>
            <button
              type="button"
              onClick={confirmBlock}
              disabled={blocking}
              className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-900 disabled:opacity-50"
            >
              {blocking ? 'Se blochează…' : 'Blochează'}
            </button>
          </div>
        </Modal>
      )}

      {/* Modal detalii eveniment */}
      {detail && (
        <Modal onClose={() => setDetail(null)}>
          <h3 className="text-lg font-bold text-slate-900">{detail.title}</h3>
          <dl className="mt-3 space-y-1.5 text-sm">
            <Row label="Interval" value={detail.range} />
            <Row label="Tip" value={detail.source === 'manual' ? 'Blocaj manual' : 'Rezervare online'} />
            <Row label="Status" value={detail.status} />
            {detail.source !== 'manual' && (
              <Row label="Preț" value={`${Number(detail.total_price).toFixed(2)} ${detail.currency}`} />
            )}
            {detail.customer_name && <Row label="Client" value={detail.customer_name} />}
            {detail.customer_phone && <Row label="Telefon" value={detail.customer_phone} />}
            {detail.notes && <Row label="Note" value={detail.notes} />}
          </dl>
          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={() => setDetail(null)}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Închide
            </button>
          </div>
        </Modal>
      )}
    </section>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-semibold text-slate-900">{value}</dd>
    </div>
  )
}

function Modal({ children, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}
