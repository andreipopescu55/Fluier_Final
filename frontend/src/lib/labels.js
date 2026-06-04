// Traduceri prietenoase pentru valorile enum din backend.

// Aplicatia e dedicata fotbalului. Formatul "X+1" = X jucatori de camp + portar.
export const SPORT_LABELS = {
  football_5: 'Fotbal 5+1',
  football_7: 'Fotbal 7+1',
  football_11: 'Fotbal 11+1',
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
  'Fotbal 11+1': 'football_11',
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
