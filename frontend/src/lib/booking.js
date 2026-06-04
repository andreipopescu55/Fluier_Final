// Helpere pentru fluxul de rezervare: zile, sloturi, estimare pret, format.

// "YYYY-MM-DD" local pentru un obiect Date.
export function toDateStr(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Backend foloseste day_of_week 0=luni..6=duminica. JS getDay() are 0=duminica.
// Convertim: (getDay()+6) % 7.
export function dowFromDate(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`)
  return (d.getDay() + 6) % 7
}

// "08:30[:00]" -> minute de la miezul noptii (510)
export function timeToMinutes(t) {
  const [h, m] = t.split(':')
  return Number(h) * 60 + Number(m)
}

// 510 -> "08:30"
export function minutesToTime(min) {
  const h = String(Math.floor(min / 60)).padStart(2, '0')
  const m = String(min % 60).padStart(2, '0')
  return `${h}:${m}`
}

// Toate minutele de start posibile intr-o zi, derivate DIN regulile de pret
// (afisam doar sloturi care au tarif -> sunt rezervabile). Pas = slotDuration.
export function buildDaySlots(rules, dow, slotDuration) {
  const set = new Set()
  for (const r of rules) {
    if (r.day_of_week !== dow) continue
    const start = timeToMinutes(r.start_time)
    const end = timeToMinutes(r.end_time)
    for (let t = start; t + slotDuration <= end; t += slotDuration) {
      set.add(t)
    }
  }
  return [...set].sort((a, b) => a - b)
}

// Tariful (price_per_hour) valabil la un anumit minut intr-o zi; null daca nu exista.
function rateAt(rules, dow, minute) {
  const r = rules.find(
    (x) =>
      x.day_of_week === dow &&
      timeToMinutes(x.start_time) <= minute &&
      minute < timeToMinutes(x.end_time),
  )
  return r ? Number(r.price_per_hour) : null
}

// Estimeaza pretul pentru [startMin, startMin+durationMin), mergand pe sloturi.
// null daca vreun slot nu are tarif (interval neacoperit) -> nerezervabil.
export function estimatePrice(rules, dow, startMin, durationMin, slotDuration) {
  let total = 0
  for (let t = startMin; t < startMin + durationMin; t += slotDuration) {
    const rate = rateAt(rules, dow, t)
    if (rate === null) return null
    total += (rate * slotDuration) / 60
  }
  return Math.round(total * 100) / 100
}

// Construieste datetime LOCAL naiv "YYYY-MM-DDTHH:MM:00".
// Backend-ul il interpreteaza ca ora Bucuresti (ensure_tz), exact cum vrea userul.
export function localISO(dateStr, minute) {
  return `${dateStr}T${minutesToTime(minute)}:00`
}

// Prima data >= azi care are reguli de pret (ca formularul sa porneasca pe o zi utila).
export function defaultBookingDate(rules) {
  const today = new Date()
  for (let i = 0; i < 21; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    const ds = toDateStr(d)
    if (rules.some((r) => r.day_of_week === dowFromDate(ds))) return ds
  }
  return toDateStr(today)
}

// "1 iunie 2026, luni" pentru afisare.
export function formatDateRo(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`)
  return new Intl.DateTimeFormat('ro-RO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d)
}

// Format pentru un datetime ISO din backend (UTC) -> ora locala "1 iun. 2026, 18:00".
export function formatDateTimeRo(iso) {
  const d = new Date(iso)
  return new Intl.DateTimeFormat('ro-RO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}
