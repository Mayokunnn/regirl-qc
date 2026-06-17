import { useState } from 'react'
import { rateCriterionVerdict } from '../api'

const BRAND = '#3B0F0D'
const WARM_CREAM = '#FFF3DD'

const CONFIDENCE_COLORS = {
  HIGH: '#16a34a',
  MEDIUM: '#d97706',
  LOW: '#dc2626',
}

const SEVERITY_COLORS = {
  MAJOR: '#dc2626',
  MINOR: '#d97706',
}

export default function CriterionCard({ criterion }) {
  const { id, label, status, confidence, severity, failureReason, failureLocation, reworkInstructions, captureAngle } =
    criterion
  const isPassed = status === 'PASS'

  const [verdictRating, setVerdictRating] = useState(criterion.verdictRating ?? null)
  const [saving, setSaving] = useState(false)

  async function rate(rating) {
    if (saving) return
    setSaving(true)
    // A "wrong" verdict implies the opposite of what the AI returned.
    const correctedVerdict = rating === 'wrong' ? (isPassed ? 'fail' : 'pass') : undefined
    try {
      await rateCriterionVerdict(id, rating, correctedVerdict)
      setVerdictRating(rating)
    } catch (err) {
      // non-blocking — rating failure should not disrupt the user
      console.error('[rate-verdict] failed', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{
        backgroundColor: WARM_CREAM,
        border: `1px solid rgba(59,15,13,0.18)`,
        color: BRAND,
      }}
      className="rounded-xl p-4"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="font-semibold text-base leading-tight">{label}</span>
        <div className="flex items-center gap-2 shrink-0">
          {!isPassed && severity && (
            <span
              style={{ backgroundColor: SEVERITY_COLORS[severity], color: '#fff' }}
              className="text-xs font-bold px-2 py-0.5 rounded"
            >
              {severity}
            </span>
          )}
          <span
            style={{
              backgroundColor: isPassed ? '#16a34a' : '#dc2626',
              color: '#fff',
            }}
            className="text-xs font-bold px-2.5 py-0.5 rounded"
          >
            {status}
          </span>
        </div>
      </div>

      {!isPassed && failureLocation && (
        <div className="mb-2">
          <span
            className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
            style={{ backgroundColor: 'rgba(59,15,13,0.08)', color: BRAND }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            {failureLocation}
          </span>
        </div>
      )}

      <div className="flex items-center gap-3 mb-2">
        <span className="text-xs" style={{ opacity: 0.65 }}>
          Confidence:&nbsp;
          <span style={{ color: CONFIDENCE_COLORS[confidence], fontWeight: 600 }}>
            {confidence}
          </span>
        </span>
        {captureAngle && (
          <span className="text-xs" style={{ opacity: 0.65 }}>
            · {captureAngle}
          </span>
        )}
      </div>

      {!isPassed && failureReason && (
        <div className="mt-2 space-y-2">
          <div>
            <p className="text-xs font-semibold mb-1" style={{ opacity: 0.7 }}>
              Issue detected
            </p>
            <p className="text-sm leading-relaxed">{failureReason}</p>
          </div>
          {reworkInstructions && (
            <div
              className="rounded-lg p-3"
              style={{ backgroundColor: 'rgba(59,15,13,0.06)' }}
            >
              <p className="text-xs font-semibold mb-1" style={{ opacity: 0.7 }}>
                Rework instructions
              </p>
              <p className="text-sm leading-relaxed">{reworkInstructions}</p>
            </div>
          )}
        </div>
      )}

      {/* Supervisor verdict-accuracy rating (optional) */}
      <div
        className="mt-3 pt-3 flex items-center gap-2"
        style={{ borderTop: '1px solid rgba(59,15,13,0.12)' }}
      >
        {verdictRating ? (
          <span className="text-xs font-medium" style={{ opacity: 0.7 }}>
            {verdictRating === 'correct'
              ? '✓ Marked accurate'
              : `✗ Marked wrong — should be ${isPassed ? 'FAIL' : 'PASS'}`}
          </span>
        ) : (
          <>
            <span className="text-xs" style={{ opacity: 0.6 }}>
              Was this verdict accurate?
            </span>
            <button
              onClick={() => rate('correct')}
              disabled={saving}
              className="text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{ backgroundColor: 'rgba(22,163,74,0.12)', color: '#16a34a' }}
            >
              Yes
            </button>
            <button
              onClick={() => rate('wrong')}
              disabled={saving}
              className="text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{ backgroundColor: 'rgba(220,38,38,0.12)', color: '#dc2626' }}
            >
              No
            </button>
          </>
        )}
      </div>
    </div>
  )
}
