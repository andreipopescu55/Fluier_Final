import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'

// Layout-ul comun pentru paginile "din aplicatie" (cele cu navbar).
// Outlet = locul unde React Router insereaza pagina rutei active (copilul).
export default function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-slate-200 py-6 text-center text-sm text-slate-400">
        Rezervări Terenuri · proiect de licență
      </footer>
    </div>
  )
}
