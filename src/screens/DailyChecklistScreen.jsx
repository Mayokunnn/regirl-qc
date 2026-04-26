import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { DAILY_CHECKLIST_ITEMS } from '../mockData'

const BRAND = '#3B0F0D'
const WARM_CREAM = '#FFF3DD'

const CHECKLIST_KEY = 'regirl_checklist_date'

function todayString() {
  return new Date().toISOString().slice(0, 10)
}

export default function DailyChecklistScreen() {
  const navigate = useNavigate()
  const [checked, setChecked] = useState(new Array(DAILY_CHECKLIST_ITEMS.length).fill(false))

  // If already completed today, skip straight to new session
  useEffect(() => {
    if (localStorage.getItem(CHECKLIST_KEY) === todayString()) {
      navigate('/new-session', { replace: true })
    }
  }, [navigate])

  const allChecked = checked.every(Boolean)

  function toggle(i) {
    setChecked((prev) => {
      const next = [...prev]
      next[i] = !next[i]
      return next
    })
  }

  function handleStart() {
    localStorage.setItem(CHECKLIST_KEY, todayString())
    navigate('/new-session')
  }

  return (
    <div
      className="flex flex-col min-h-dvh pb-20"
      style={{ backgroundColor: WARM_CREAM, color: BRAND }}
    >
      {/* Header */}
      <div className="px-5 pt-10 pb-6">
        <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ opacity: 0.55 }}>
          Regirl QC
        </p>
        <h1 className="text-2xl font-bold leading-tight">Daily Setup Checklist</h1>
        <p className="text-sm mt-1" style={{ opacity: 0.65 }}>
          Tick all items before starting your first session today.
        </p>
      </div>

      {/* Checklist */}
      <div className="flex-1 px-5 space-y-3">
        {DAILY_CHECKLIST_ITEMS.map((item, i) => (
          <button
            key={i}
            onClick={() => toggle(i)}
            className="w-full flex items-start gap-4 text-left rounded-xl p-4 transition-all active:scale-[0.98]"
            style={{
              backgroundColor: checked[i] ? 'rgba(59,15,13,0.08)' : '#FFFCF2',
              border: `1.5px solid ${checked[i] ? BRAND : 'rgba(59,15,13,0.2)'}`,
            }}
          >
            {/* Checkbox */}
            <div
              className="shrink-0 mt-0.5 w-6 h-6 rounded flex items-center justify-center"
              style={{
                border: `2px solid ${BRAND}`,
                backgroundColor: checked[i] ? BRAND : 'transparent',
              }}
            >
              {checked[i] && (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <polyline
                    points="2,7 5.5,10.5 12,3.5"
                    stroke="#FFFCF2"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </div>
            <span
              className="text-sm leading-relaxed font-medium"
              style={{ textDecoration: checked[i] ? 'line-through' : 'none', opacity: checked[i] ? 0.55 : 1 }}
            >
              {item}
            </span>
          </button>
        ))}
      </div>

      {/* Progress + CTA */}
      <div className="px-5 pt-6 pb-8">
        <p className="text-sm text-center mb-4" style={{ opacity: 0.6 }}>
          {checked.filter(Boolean).length} of {DAILY_CHECKLIST_ITEMS.length} items checked
        </p>
        <button
          onClick={handleStart}
          disabled={!allChecked}
          className="w-full py-4 rounded-xl text-base font-bold tracking-wide transition-opacity"
          style={{
            backgroundColor: BRAND,
            color: '#FFFCF2',
            opacity: allChecked ? 1 : 0.35,
            cursor: allChecked ? 'pointer' : 'not-allowed',
          }}
        >
          Start QC Session
        </button>
      </div>
    </div>
  )
}
