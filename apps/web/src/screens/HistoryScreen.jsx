import { useState, useEffect } from 'react'
import { fetchHistory } from '../api'
import VerdictBadge from '../components/VerdictBadge'
import CriterionCard from '../components/CriterionCard'
import { CAPTURE_ANGLES } from '../mockData'

const BRAND = '#3B0F0D'
const OFF_WHITE = '#FFFCF2'
const WARM_CREAM = '#FFF3DD'

function formatDateTime(iso) {
  const d = new Date(iso)
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function toDateInput(d) {
  return d.toISOString().slice(0, 10)
}

function ChevronIcon({ open }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

function HistoryRow({ entry }) {
  const [open, setOpen] = useState(false)

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        backgroundColor: WARM_CREAM,
        border: `1px solid rgba(59,15,13,0.15)`,
      }}
    >
      {/* Row header — always visible */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left px-4 py-4 flex items-start justify-between gap-3"
        style={{ backgroundColor: 'transparent', border: 'none', cursor: 'pointer', color: BRAND }}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <VerdictBadge verdict={entry.verdict} />
          </div>
          <p className="text-sm font-semibold leading-snug">{entry.sku}</p>
          <p className="text-xs mt-0.5" style={{ opacity: 0.65 }}>
            {entry.stylistName} · {entry.wigId}
          </p>
          <p className="text-xs mt-0.5" style={{ opacity: 0.45 }}>
            {formatDateTime(entry.timestamp)}
          </p>
        </div>
        <div className="shrink-0 mt-1" style={{ opacity: 0.55 }}>
          <ChevronIcon open={open} />
        </div>
      </button>

      {/* Expanded detail */}
      {open && (
        <div className="px-4 pb-5 border-t" style={{ borderColor: 'rgba(59,15,13,0.1)' }}>
          {/* Photo thumbnails */}
          <div className="mt-4 mb-4">
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ opacity: 0.5 }}>
              Photos
            </p>
            <div className="grid grid-cols-4 gap-2">
              {CAPTURE_ANGLES.map((angle) => {
                const src = entry.photos?.[angle.id]
                return (
                  <div key={angle.id} className="flex flex-col items-center gap-1">
                    <div
                      className="w-full rounded-lg overflow-hidden flex items-center justify-center"
                      style={{ aspectRatio: '1', backgroundColor: 'rgba(59,15,13,0.07)' }}
                    >
                      {src ? (
                        <img src={src} alt={angle.label} className="w-full h-full object-cover" />
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.3 }}>
                          <rect x="3" y="3" width="18" height="18" rx="2"/>
                          <circle cx="8.5" cy="8.5" r="1.5"/>
                          <polyline points="21 15 16 10 5 21"/>
                        </svg>
                      )}
                    </div>
                    <span className="text-center leading-tight" style={{ fontSize: '9px', opacity: 0.55 }}>
                      {angle.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Criteria */}
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ opacity: 0.5 }}>
            Quality Criteria
          </p>
          <div className="space-y-2">
            {[
              ...entry.criteria.filter((c) => c.status === 'FAIL'),
              ...entry.criteria.filter((c) => c.status === 'PASS'),
            ].map((c) => (
              <CriterionCard key={c.id} criterion={c} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function HistoryScreen() {
  const today = new Date()
  const threeDaysAgo = new Date(today)
  threeDaysAgo.setDate(today.getDate() - 3)

  const [fromDate, setFromDate] = useState(toDateInput(threeDaysAgo))
  const [toDate, setToDate] = useState(toDateInput(today))
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetchHistory(new Date(fromDate), new Date(toDate)).then((data) => {
      setEntries(data)
      setLoading(false)
    })
  }, [fromDate, toDate])

  const inputStyle = {
    backgroundColor: WARM_CREAM,
    color: BRAND,
    border: `1.5px solid rgba(59,15,13,0.25)`,
    outline: 'none',
  }

  return (
    <div className="flex flex-col min-h-dvh pb-20" style={{ backgroundColor: OFF_WHITE, color: BRAND }}>
      {/* Header */}
      <div className="px-5 pt-10 pb-5">
        <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ opacity: 0.55 }}>
          Regirl QC
        </p>
        <h1 className="text-2xl font-bold leading-tight">Session History</h1>
      </div>

      {/* Date filter */}
      <div className="px-5 mb-5">
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-xs font-semibold mb-1" style={{ opacity: 0.6 }}>
              From
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full rounded-xl px-3 py-2.5 text-sm"
              style={inputStyle}
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-semibold mb-1" style={{ opacity: 0.6 }}>
              To
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full rounded-xl px-3 py-2.5 text-sm"
              style={inputStyle}
            />
          </div>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 px-5 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-16" style={{ opacity: 0.4 }}>
            <svg className="animate-spin" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2" style={{ opacity: 0.45 }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <p className="text-sm font-medium">No sessions in this date range</p>
          </div>
        ) : (
          entries.map((entry) => <HistoryRow key={entry.id} entry={entry} />)
        )}
      </div>
    </div>
  )
}
