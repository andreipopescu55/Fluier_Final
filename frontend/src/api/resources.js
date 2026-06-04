import api from './client'

// Functii subtiri peste API. Fiecare intoarce direct datele (res.data),
// ca paginile sa nu se ocupe de structura axios.

// ── Venues (public) ──────────────────────────────────────────────
export function listVenues(params) {
  return api.get('/venues', { params }).then((r) => r.data)
}

export function getVenue(slug) {
  return api.get(`/venues/${slug}`).then((r) => r.data)
}

export function listVenueFields(venueId) {
  return api.get(`/venues/${venueId}/fields`).then((r) => r.data)
}

// ── Fields (public) ──────────────────────────────────────────────
export function getField(fieldId) {
  return api.get(`/fields/${fieldId}`).then((r) => r.data)
}

export function getFieldPricing(fieldId) {
  return api.get(`/fields/${fieldId}/pricing`).then((r) => r.data)
}

// ── Bookings (necesita auth) ─────────────────────────────────────
export function createBooking(payload) {
  return api.post('/bookings', payload).then((r) => r.data)
}

export function listMyBookings() {
  return api.get('/bookings/me').then((r) => r.data)
}

export function cancelBooking(bookingId) {
  return api.post(`/bookings/${bookingId}/cancel`).then((r) => r.data)
}
