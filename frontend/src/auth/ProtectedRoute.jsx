import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'

/*
  Inveleste o ruta care necesita autentificare.
  - daca inca verificam sesiunea -> aratam un mic loader (evitam redirect gresit);
  - daca nu e logat -> il trimitem la /login (si retinem unde voia sa ajunga);
  - daca e logat dar rolul nu e permis -> 403;
  - altfel -> afisam continutul.

  Folosire:
    <ProtectedRoute>...</ProtectedRoute>                       // orice user logat
    <ProtectedRoute roles={['venue_admin','super_admin']}>...  // doar adminii
*/
export default function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        Se verifică sesiunea…
      </div>
    )
  }

  if (!user) {
    // Pastram in state ruta ceruta, ca dupa login sa-l redirectionam inapoi.
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (roles && !roles.includes(user.role)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-2 p-6 text-center">
        <h1 className="text-2xl font-extrabold text-slate-900">403 — Acces interzis</h1>
        <p className="text-slate-500">Nu ai permisiunile necesare pentru această zonă.</p>
      </div>
    )
  }

  return children
}
