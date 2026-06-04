import { useAuth } from '../auth/AuthContext'

// Placeholder. Dashboard-ul real (FullCalendar + management) vine la Pasul 6.
// venue_admin si super_admin folosesc ACEASTA pagina; optiunile super_admin
// vor fi afisate conditionat (isSuperAdmin) tot aici.
export default function AdminPage() {
  const { user } = useAuth()
  const isSuperAdmin = user?.role === 'super_admin'

  return (
    <section>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-slate-900">Dashboard administrator</h1>
        {isSuperAdmin && (
          <span className="rounded-full bg-mint-50 px-3 py-1 text-xs font-semibold text-mint-600">
            mod Super Admin
          </span>
        )}
      </div>
      <p className="mt-2 text-slate-500">
        Calendarul cu rezervări, blocarea manuală și managementul terenurilor vin la Pasul 6.
      </p>
      {isSuperAdmin && (
        <p className="mt-2 text-sm text-mint-600">
          (Ești super admin — aici vei vedea în plus toate bazele sportive + aprobarea lor.)
        </p>
      )}
    </section>
  )
}
