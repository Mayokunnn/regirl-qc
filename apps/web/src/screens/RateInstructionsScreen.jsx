import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { rateCriterion } from '../api'

const BRAND = '#3B0F0D'
const OFF_WHITE = '#FFFCF2'
const WARM_CREAM = '#FFF3DD'

export default function RateInstructionsScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const criteria = location.state?.criteria ?? []
  const [ratings, setRatings] = useState({})
  const [saving, setSaving] = useState(false)

  const failedCriteria = criteria.filter((c) => c.status === 'FAIL' && c.reworkInstructions)

  function setRating(criterionId, rating) {
    setRatings((prev) => ({ ...prev, [criterionId]: rating }))
  }

  async function handleDone() {
    setSaving(true)
    try {
      await Promise.all(
        Object.entries(ratings).map(([id, rating]) => rateCriterion(id, rating))
      )
    } catch {
      // non-blocking — rating failure should not block the user
    } finally {
      navigate('/upload')
    }
  }

  useEffect(() => {
    if (failedCriteria.length === 0) {
      navigate('/upload', { replace: true })
    }
  }, [failedCriteria.length, navigate])

  if (failedCriteria.length === 0) return null

  return (
    <div className="flex flex-col min-h-full" style={{ backgroundColor: OFF_WHITE, color: BRAND }}>
      <div className="px-5 pt-10 pb-6" style={{ backgroundColor: WARM_CREAM, borderBottom: `1px solid rgba(59,15,13,0.12)` }}>
        <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ opacity: 0.55 }}>Before you start</p>
        <h1 className="text-xl font-bold leading-tight">Rate previous rework instructions</h1>
        <p className="text-sm mt-1" style={{ opacity: 0.65 }}>
          Were the rework instructions from the last QC session helpful?
        </p>
      </div>

      <div className="flex-1 px-5 pt-5 space-y-4">
        {failedCriteria.map((c) => (
          <div key={c.id} className="rounded-xl p-4" style={{ backgroundColor: WARM_CREAM, border: `1px solid rgba(59,15,13,0.15)` }}>
            <p className="font-semibold text-sm mb-1">{c.label}</p>
            <p className="text-xs leading-relaxed mb-3" style={{ opacity: 0.7 }}>{c.reworkInstructions}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setRating(c.id, 'helpful')}
                className="flex-1 py-2 rounded-lg text-sm font-semibold border-2"
                style={{
                  borderColor: ratings[c.id] === 'helpful' ? '#16a34a' : 'rgba(59,15,13,0.2)',
                  backgroundColor: ratings[c.id] === 'helpful' ? '#f0fdf4' : 'transparent',
                  color: ratings[c.id] === 'helpful' ? '#16a34a' : BRAND,
                }}
              >
                👍 Helpful
              </button>
              <button
                onClick={() => setRating(c.id, 'not_helpful')}
                className="flex-1 py-2 rounded-lg text-sm font-semibold border-2"
                style={{
                  borderColor: ratings[c.id] === 'not_helpful' ? '#dc2626' : 'rgba(59,15,13,0.2)',
                  backgroundColor: ratings[c.id] === 'not_helpful' ? '#fef2f2' : 'transparent',
                  color: ratings[c.id] === 'not_helpful' ? '#dc2626' : BRAND,
                }}
              >
                👎 Not helpful
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="px-5 pb-8 space-y-3">
        <button
          onClick={handleDone}
          disabled={saving}
          className="w-full py-4 rounded-xl text-base font-bold tracking-wide"
          style={{ backgroundColor: BRAND, color: OFF_WHITE, opacity: saving ? 0.5 : 1 }}
        >
          {saving ? 'Saving…' : 'Done — Start New Session'}
        </button>
        <button
          onClick={() => navigate('/upload')}
          className="w-full py-3 rounded-xl text-sm font-semibold"
          style={{ backgroundColor: 'transparent', color: BRAND, opacity: 0.55 }}
        >
          Skip
        </button>
      </div>
    </div>
  )
}
