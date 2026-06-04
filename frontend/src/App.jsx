import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import ProtectedRoute from './auth/ProtectedRoute'
import Layout from './components/Layout'

import HomePage from './pages/HomePage'
import VenuePage from './pages/VenuePage'
import BookingPage from './pages/BookingPage'
import MyBookingsPage from './pages/MyBookingsPage'
import AdminPage from './pages/AdminPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Pagini "din aplicatie" — au navbar + footer (Layout cu Outlet) */}
          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/venue/:slug" element={<VenuePage />} />

            {/* Pagina de rezervare e publica: poti vedea sloturile/pretul fara cont,
                dar la "Rezervă" te trimite la login daca nu esti autentificat. */}
            <Route path="/rezervare/:fieldId" element={<BookingPage />} />

            {/* Doar clientii au "Rezervările mele" */}
            <Route
              path="/rezervarile-mele"
              element={
                <ProtectedRoute roles={['client']}>
                  <MyBookingsPage />
                </ProtectedRoute>
              }
            />

            {/* venue_admin + super_admin -> acelasi dashboard */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute roles={['venue_admin', 'super_admin']}>
                  <AdminPage />
                </ProtectedRoute>
              }
            />
          </Route>

          {/* Pagini standalone — fara navbar (ecran plin) */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Orice ruta necunoscuta -> acasa */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
