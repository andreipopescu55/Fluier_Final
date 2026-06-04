import axios from 'axios'

// Cheia sub care tinem tokenul JWT in localStorage (persista intre refresh-uri de pagina).
const TOKEN_KEY = 'rt_access_token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token)
  } else {
    localStorage.removeItem(TOKEN_KEY)
  }
}

// Instanta axios reutilizabila pentru tot frontend-ul.
// baseURL = /api/v1 -> in dev, proxy-ul din vite.config.js trimite catre http://localhost:8001.
const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
})

// Interceptor de cerere: daca avem token, il atasam automat pe fiecare request
// in headerul Authorization (Bearer <token>) -> nu mai punem manual peste tot.
api.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Interceptor de raspuns: daca backend-ul raspunde 401 (token invalid/expirat),
// stergem tokenul local. Componentele/rutele protejate vor reactiona si vor cere re-login.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      setToken(null)
    }
    return Promise.reject(error)
  },
)

export default api
