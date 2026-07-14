// Traduceri prietenoase pentru valorile enum din backend.

// Aplicatia e dedicata fotbalului. Formatul "X+1" = X jucatori de camp + portar.
export const SPORT_LABELS = {
  football_5: 'Fotbal 5+1',
  football_7: 'Fotbal 7+1',
  football_11: 'Fotbal 10+1',
}

export const SURFACE_LABELS = {
  synthetic_grass: 'Gazon sintetic',
  natural_grass: 'Gazon natural',
}

// Reverse: eticheta -> valoare enum. Folosit ca sa derivam sport_type (categoria
// structurata, pentru filtrare) din recomandarea libera, cand aceasta e standard.
export const SPORT_BY_LABEL = {
  'Fotbal 5+1': 'football_5',
  'Fotbal 7+1': 'football_7',
  'Fotbal 10+1': 'football_11',
}

// Formatul afisat al unui teren: recomandarea libera daca exista, altfel eticheta
// structurata derivata din sport_type.
export function fieldFormat(f) {
  return f?.recommended_format || SPORT_LABELS[f?.sport_type] || ''
}

// status -> { eticheta, clase Tailwind pentru "badge" }
export const BOOKING_STATUS = {
  pending: { label: 'În așteptare', cls: 'bg-amber-100 text-amber-800' },
  confirmed: { label: 'Confirmată', cls: 'bg-mint-50 text-mint-600' },
  cancelled: { label: 'Anulată', cls: 'bg-slate-100 text-slate-500' },
  completed: { label: 'Finalizată', cls: 'bg-blue-100 text-blue-700' },
  no_show: { label: 'Neprezentat', cls: 'bg-red-100 text-red-700' },
}

// ── Find Party (meciuri deschise) ────────────────────────────────
export const SKILL_LABELS = {
  any: 'Orice nivel',
  beginner: 'Începător',
  intermediate: 'Intermediar',
  advanced: 'Avansat',
}

// Doar nivelurile reale (fara "any") — pentru selectarea la creare/filtrare.
export const SKILL_OPTIONS = ['any', 'beginner', 'intermediate', 'advanced']

export const MATCH_STATUS = {
  open: { label: 'Caută jucători', cls: 'bg-accent-400/15 text-accent-400' },
  full: { label: 'Complet', cls: 'bg-panel-2 text-slate-300' },
  cancelled: { label: 'Anulat', cls: 'bg-red-500/10 text-red-400' },
  completed: { label: 'Încheiat', cls: 'bg-blue-500/10 text-blue-300' },
}

// Pseudo-status derivat pe frontend: meciul nu e anulat, dar timpul rezervarii
// a trecut (in DB statusul ramane open/full — nu ruleaza un scheduler care sa-l inchida).
export const MATCH_EXPIRED = { label: 'Expirat', cls: 'bg-panel-2 text-slate-400' }

// True daca meciul e deschis/complet dar intervalul lui a inceput deja.
export function isMatchExpired(m) {
  return (
    (m.status === 'open' || m.status === 'full') &&
    new Date(m.start_time) <= new Date()
  )
}

export const PARTICIPANT_STATUS = {
  requested: { label: 'Cerere trimisă', cls: 'bg-amber-400/15 text-amber-300' },
  approved: { label: 'Acceptat', cls: 'bg-accent-400/15 text-accent-400' },
  rejected: { label: 'Respins', cls: 'bg-red-500/10 text-red-400' },
  left: { label: 'Ai ieșit', cls: 'bg-panel-2 text-slate-400' },
}

// sport_type (string enum) -> eticheta fotbal; fallback pe valoarea brută.
export function sportLabel(sport) {
  return SPORT_LABELS[sport] || sport || ''
}
