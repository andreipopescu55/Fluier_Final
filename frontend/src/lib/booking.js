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

// 510 -> "08:30"   (1500 -> "25:00"; pentru afisare foloseste minutesToTimeWrapped)
export function minutesToTime(min) {
  const h = String(Math.floor(min / 60)).padStart(2, '0')
  const m = String(min % 60).padStart(2, '0')
  return `${h}:${m}`
}

// Ca minutesToTime, dar „infasoara" peste 24h: 1500 (25:00) -> "01:00".
// Pentru intervale care trec de miezul noptii.
export function minutesToTimeWrapped(min) {
  return minutesToTime(((min % 1440) + 1440) % 1440)
}

// Sfarsitul unei reguli in minute. end_time "00:00" inseamna miezul noptii (24:00).
function ruleEndMinutes(r) {
  const e = timeToMinutes(r.end_time)
  return e === 0 ? 1440 : e
}

// Toate minutele de start posibile intr-o zi, derivate DIN regulile de pret
// (afisam doar sloturi care au tarif -> sunt rezervabile). Pas = slotDuration.
export function buildDaySlots(rules, dow, slotDuration) {
  const set = new Set()
  for (const r of rules) {
    if (r.day_of_week !== dow) continue
    const start = timeToMinutes(r.start_time)
    const end = ruleEndMinutes(r)
    for (let t = start; t + slotDuration <= end; t += slotDuration) {
      set.add(t)
    }
  }
  return [...set].sort((a, b) => a - b)
}

// Tariful (price_per_hour) valabil la un minut dat; null daca nu exista regula.
// Daca minute >= 1440 (dupa miezul noptii), cautam in regulile ZILEI URMATOARE.
function rateAt(rules, dow, minute) {
  let d = dow
  let m = minute
  if (m >= 1440) { d = (dow + 1) % 7; m -= 1440 }
  const r = rules.find(
    (x) =>
      x.day_of_week === d &&
      timeToMinutes(x.start_time) <= m &&
      m < ruleEndMinutes(x),
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

// Ca localISO, dar daca minutul depaseste 24h (ex: 1500 = 01:00 a doua zi),
// trece in ziua urmatoare. Folosit pentru sfarsitul rezervarilor peste miezul noptii.
export function localISOFromMinutes(dateStr, minute) {
  const dayOffset = Math.floor(minute / 1440)
  const m = minute % 1440
  const d = new Date(`${dateStr}T00:00:00`)
  d.setDate(d.getDate() + dayOffset)
  return `${toDateStr(d)}T${minutesToTime(m)}:00`
}

// Prima data >= azi care are sloturi INCA disponibile (ca formularul sa nu
// porneasca pe o zi al carei program s-a terminat deja).
// Pentru azi cerem sa existe un slot care incepe in viitor SI permite durata
// minima; altfel trecem la ziua urmatoare.
export function defaultBookingDate(rules, slotDuration = 30, minBooking = 60) {
  const now = new Date()
  const nowMin = now.getHours() * 60 + now.getMinutes()
  for (let i = 0; i < 21; i++) {
    const d = new Date(now)
    d.setDate(now.getDate() + i)
    const ds = toDateStr(d)
    const dow = dowFromDate(ds)
    const slots = buildDaySlots(rules, dow, slotDuration)
    if (slots.length === 0) continue
    if (i === 0) {
      const usable = slots.some(
        (s) => s > nowMin && estimatePrice(rules, dow, s, minBooking, slotDuration) != null,
      )
      if (!usable) continue // azi s-a terminat -> incercam mâine
    }
    return ds
  }
  return toDateStr(now)
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
