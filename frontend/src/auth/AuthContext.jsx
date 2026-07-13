import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import api, { getToken, setToken } from '../api/client'

// Contextul = "cutia" prin care orice componenta afla starea de autentificare,
// fara sa pasam manual userul prin props de la parinte la copil (prop drilling).
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  // loading=true cat verificam la pornire daca tokenul salvat e inca valid.
  // Evita "clipirea" in care utilizatorul logat pare neautentificat o fractiune de secunda.
  const [loading, setLoading] = useState(true)

  // La montarea aplicatiei: daca exista token salvat, aflam cine e userul (/auth/me).
  useEffect(() => {
    const token = getToken()
    if (!token) {
      setLoading(false)
      return
    }
    api
      .get('/auth/me')
      .then((res) => setUser(res.data))
      .catch(() => setToken(null)) // token invalid/expirat -> il stergem
      .finally(() => setLoading(false))
  }, [])

  // LOGIN: /auth/login cere form-urlencoded cu campurile username + password (standard OAuth2).
  const login = useCallback(async (email, password) => {
    const form = new URLSearchParams()
    form.append('username', email) // "username" = emailul, asa cere OAuth2PasswordRequestForm
    form.append('password', password)

    const res = await api.post('/auth/login', form, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
    setToken(res.data.access_token)

    // Dupa ce avem tokenul, aflam profilul (rol etc.) ca sa stim unde sa-l ducem.
    const me = await api.get('/auth/me')
    setUser(me.data)
    return me.data
  }, [])

  // REGISTER: creeaza contul, apoi il logheaza automat.
  const register = useCallback(
    async ({ email, full_name, phone, password }) => {
      await api.post('/auth/register', { email, full_name, phone, password })
      return login(email, password)
    },
    [login],
  )

  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
  }, [])

  // Re-citeste profilul de pe server (dupa o modificare din pagina de profil),
  // ca navbar-ul si restul UI-ului sa arate imediat datele noi.
  const refreshUser = useCallback(async () => {
    const res = await api.get('/auth/me')
    setUser(res.data)
    return res.data
  }, [])

  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    refreshUser,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// Hook scurt pentru a folosi contextul: const { user, login } = useAuth()
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (ctx === null) {
    throw new Error('useAuth trebuie folosit in interiorul <AuthProvider>')
  }
  return ctx
}
