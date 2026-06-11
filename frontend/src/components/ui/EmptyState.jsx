import { Link } from 'react-router-dom'

// Stare goala consistenta: iconita + titlu + descriere + actiune optionala.
// Inlocuieste "Nu există…" simplu (regula UX: forms-&-feedback / claritate).
export default function EmptyState({ icon, title, description, actionLabel, actionTo, onAction }) {
  return (
    <div className="flex flex-col items-center rounded-2xl bg-panel px-6 py-12 text-center ring-1 ring-line">
      {icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-400/10 text-accent-400">
          {icon}
        </div>
      )}
      <h3 className="text-base font-bold text-white">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-400">{description}</p>}
      {actionLabel &&
        (actionTo ? (
          <Link
            to={actionTo}
            className="mt-5 inline-flex items-center rounded-lg bg-accent-400 px-4 py-2 text-sm font-bold text-ink transition hover:bg-accent-300"
          >
            {actionLabel}
          </Link>
        ) : (
          <button
            type="button"
            onClick={onAction}
            className="mt-5 inline-flex items-center rounded-lg bg-accent-400 px-4 py-2 text-sm font-bold text-ink transition hover:bg-accent-300"
          >
            {actionLabel}
          </button>
        ))}
    </div>
  )
}
