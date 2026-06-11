import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'

// Coloana de footer reutilizabila.
function FooterCol({ title, items }) {
  return (
    <div>
      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">{title}</h4>
      <ul className="mt-3 space-y-2 text-sm">
        {items.map((it) => (
          <li key={it}>
            <a href="#" className="text-slate-400 transition hover:text-accent-400">
              {it}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
        <Outlet />
      </main>

      <footer className="border-t border-line bg-ink-2">
        <div className="mx-auto max-w-7xl px-4 py-12">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
            <div>
              <span className="text-lg font-extrabold uppercase tracking-tight text-accent-400">
                Fluier Final
              </span>
              <p className="mt-3 max-w-xs text-sm text-slate-400">
                Misiunea noastră este să conectăm comunitățile sportive prin tehnologie și pasiune.
              </p>
              <div className="mt-4 flex gap-2">
                {['🌐', '@'].map((s) => (
                  <span
                    key={s}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-slate-300"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
            <FooterCol title="Resurse" items={['Despre noi', 'Cum funcționează', 'Blog']} />
            <FooterCol title="Legal" items={['Termeni și condiții', 'Politica de confidențialitate']} />
            <FooterCol title="Suport" items={['Centru de ajutor', 'Contact']} />
          </div>

          <div className="mt-10 flex flex-col items-center justify-between gap-2 border-t border-line pt-6 text-sm text-slate-500 sm:flex-row">
            <span>© 2026 Fluier Final · Precision in Play · proiect de licență</span>
            <span>RO / RON</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
