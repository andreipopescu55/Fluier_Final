import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listVenues } from '../api/resources'
import { useAuth } from '../auth/AuthContext'

export default function HomePage() {
  const { user } = useAuth()
  const [venues, setVenues] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Incarcam bazele sportive aprobate (endpoint public) la montare.
  useEffect(() => {
    let active = true
    listVenues()
      .then((data) => active && setVenues(data))
      .catch(() => active && setError('Nu am putut încărca bazele sportive.'))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [])

  return (
    <div className="space-y-10">
      {/* Hero */}
      <section className="rounded-3xl bg-white p-10 text-center shadow-xl ring-1 ring-slate-100">
        <span className="inline-block rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
          Rezervări online
        </span>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-slate-900">
          Rezervă terenul tău <span className="text-brand-600">în câteva secunde</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-slate-500">
          {user
            ? `Bine ai venit, ${user.full_name}! Alege o bază sportivă mai jos.`
            : 'Caută baze sportive, vezi disponibilitatea și rezervă online.'}
        </p>
      </section>

      {/* Lista baze sportive */}
      <section>
        <h2 className="mb-4 text-xl font-extrabold text-slate-900">Baze sportive</h2>

        {loading && <p className="text-slate-500">Se încarcă…</p>}
        {error && <p className="text-red-600">{error}</p>}
        {!loading && !error && venues.length === 0 && (
          <p className="text-slate-500">Nu există baze sportive disponibile momentan.</p>
        )}

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {venues.map((v) => (
            <Link
              key={v.id}
              to={`/venue/${v.slug}`}
              className="group rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100 transition hover:shadow-lg hover:ring-brand-200"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-xl">
                ⚽
              </div>
              <h3 className="mt-4 text-lg font-bold text-slate-900 group-hover:text-brand-700">
                {v.name}
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                {v.city}, {v.county}
              </p>
              <span className="mt-4 inline-block text-sm font-semibold text-brand-600">
                Vezi terenurile →
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
