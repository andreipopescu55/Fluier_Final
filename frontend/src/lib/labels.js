// Traduceri prietenoase pentru valorile enum din backend.

export const SPORT_LABELS = {
  football_5: 'Fotbal 5',
  football_7: 'Fotbal 7',
  football_11: 'Fotbal 11',
  tennis: 'Tenis',
  basketball: 'Baschet',
  volleyball: 'Volei',
}

export const SURFACE_LABELS = {
  synthetic_grass: 'Gazon sintetic',
  natural_grass: 'Gazon natural',
  clay: 'Zgură',
  hard_court: 'Suprafață dură',
  parquet: 'Parchet',
}

// status -> { eticheta, clase Tailwind pentru "badge" }
export const BOOKING_STATUS = {
  pending: { label: 'În așteptare', cls: 'bg-amber-100 text-amber-800' },
  confirmed: { label: 'Confirmată', cls: 'bg-mint-50 text-mint-600' },
  cancelled: { label: 'Anulată', cls: 'bg-slate-100 text-slate-500' },
  completed: { label: 'Finalizată', cls: 'bg-blue-100 text-blue-700' },
  no_show: { label: 'Neprezentat', cls: 'bg-red-100 text-red-700' },
}
