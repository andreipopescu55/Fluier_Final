import { useState } from 'react'

// Forma unei stele (plina sau conturată).
function StarShape({ filled, className = 'h-4 w-4' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3-5.8 3 1.1-6.5L2.6 9.4l6.5-.9z" />
    </svg>
  )
}

// Badge compact pentru afisare: ★ 4.5 (12). Fara evaluari -> text discret.
export function RatingBadge({ avg, count, className = '' }) {
  if (!count) {
    return <span className={`text-xs text-slate-500 ${className}`}>Fără evaluări</span>
  }
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <StarShape filled className="h-4 w-4 text-accent-400" />
      <span className="font-bold text-white">{Number(avg).toFixed(1)}</span>
      <span className="text-slate-400">({count})</span>
    </span>
  )
}

// Rând de 5 stele. readOnly=true -> doar afisare (media); altfel interactiv (hover + click).
export function StarRating({ value = 0, onRate, disabled = false, readOnly = false, size = 'h-8 w-8' }) {
  const [hover, setHover] = useState(0)

  if (readOnly) {
    return (
      <div className="flex gap-1 text-accent-400" aria-label={`${Number(value).toFixed(1)} din 5`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <StarShape key={n} filled={n <= Math.round(value)} className={size} />
        ))}
      </div>
    )
  }

  return (
    <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          aria-label={`${n} stele`}
          onMouseEnter={() => setHover(n)}
          onClick={() => onRate(n)}
          className="text-accent-400 transition hover:scale-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <StarShape filled={n <= (hover || value)} className={size} />
        </button>
      ))}
    </div>
  )
}
