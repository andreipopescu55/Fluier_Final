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

// ── Rating baze ──────────────────────────────────────────────────
// Sumar public (media + numar); my_score vine completat daca esti logat.
export function getVenueRating(venueId) {
  return api.get(`/venues/${venueId}/rating`).then((r) => r.data)
}

export function rateVenue(venueId, score, comment) {
  return api.put(`/venues/${venueId}/rating`, { score, comment }).then((r) => r.data)
}

export function deleteVenueRating(venueId) {
  return api.delete(`/venues/${venueId}/rating`).then((r) => r.data)
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

// ── Admin: venues ────────────────────────────────────────────────
// Bazele pe care le detin (include pending/suspended, nu doar approved).
export function listMyVenues() {
  return api.get('/venues/me').then((r) => r.data)
}

export function createVenue(payload) {
  return api.post('/venues', payload).then((r) => r.data)
}

// ── Super-admin: moderare baze ───────────────────────────────────
export function listAllVenues(status) {
  return api.get('/admin/venues', { params: status ? { status } : {} }).then((r) => r.data)
}

export function setVenueStatus(venueId, status) {
  return api.patch(`/admin/venues/${venueId}/status`, { status }).then((r) => r.data)
}

export function updateVenue(venueId, payload) {
  return api.patch(`/venues/${venueId}`, payload).then((r) => r.data)
}

// ── Admin: abonament (mock v1, fara plata reala) ─────────────────
export function getVenueSubscription(venueId) {
  return api.get(`/venues/${venueId}/subscription`).then((r) => r.data)
}

export function subscribeVenue(venueId, plan) {
  return api.post(`/venues/${venueId}/subscription`, { plan }).then((r) => r.data)
}

export function cancelVenueSubscription(venueId) {
  return api.post(`/venues/${venueId}/subscription/cancel`).then((r) => r.data)
}

// ── Admin: fields (management) ───────────────────────────────────
// Toate terenurile (incl. inactive), indiferent de statusul bazei — owner only.
export function listVenueFieldsManage(venueId) {
  return api.get(`/venues/${venueId}/fields/manage`).then((r) => r.data)
}

export function createField(venueId, payload) {
  return api.post(`/venues/${venueId}/fields`, payload).then((r) => r.data)
}

export function updateField(fieldId, payload) {
  return api.patch(`/fields/${fieldId}`, payload).then((r) => r.data)
}

export function deleteField(fieldId) {
  return api.delete(`/fields/${fieldId}`).then((r) => r.data)
}

// ── Admin: pricing rules ─────────────────────────────────────────
// Listare pentru management (owner) — merge si pe baze neaprobate.
export function listFieldPricingManage(fieldId) {
  return api.get(`/fields/${fieldId}/pricing/manage`).then((r) => r.data)
}

export function addPricingRule(fieldId, payload) {
  return api.post(`/fields/${fieldId}/pricing`, payload).then((r) => r.data)
}

export function deletePricingRule(ruleId) {
  return api.delete(`/pricing/${ruleId}`).then((r) => r.data)
}

// ── Admin: calendar + blocare manuala ────────────────────────────
// from/to = string-uri ISO locale "YYYY-MM-DDTHH:MM:SS" (backend le citeste ca ora Bucuresti).
export function getFieldCalendar(fieldId, from, to) {
  return api
    .get(`/admin/fields/${fieldId}/calendar`, { params: { from, to } })
    .then((r) => r.data)
}

export function blockInterval(fieldId, payload) {
  return api.post(`/admin/fields/${fieldId}/block`, payload).then((r) => r.data)
}
