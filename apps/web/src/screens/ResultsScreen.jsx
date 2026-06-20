import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '../context/SessionContext'
import { saveVerdictFeedback } from '../api'
import VerdictBadge from '../components/VerdictBadge'
import CriterionCard from '../components/CriterionCard'

const BRAND = '#3B0F0D'
const OFF_WHITE = '#FFFCF2'
const WARM_CREAM = '#FFF3DD'

function formatTimestamp(iso) {
  const d = new Date(iso)
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function ResultsScreen() {
  const navigate = useNavigate()
  const { activeSession, patchActiveCriterion } = useSession()

  const qcResult = activeSession?.result ?? null

  if (!qcResult) {
    // Active session exists but is still uploading — go back to upload
    if (activeSession?.status === 'uploading' || activeSession?.status === 'processing') {
      navigate('/upload', { replace: true })
    } else {
      navigate('/new-session', { replace: true })
    }
    return null
  }

  const passed = qcResult.criteria.filter((c) => c.status === 'PASS').length
  const failed = qcResult.criteria.filter((c) => c.status === 'FAIL').length

  return (
    <div className="flex flex-col min-h-dvh pb-20" style={{ backgroundColor: OFF_WHITE, color: BRAND }}>
      {/* Hero verdict banner */}
      <div
        className="px-5 pt-10 pb-6"
        style={{ backgroundColor: WARM_CREAM, borderBottom: `1px solid rgba(59,15,13,0.12)` }}
      >
        <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ opacity: 0.55 }}>
          QC Result
        </p>
        <div className="mb-4">
          <VerdictBadge verdict={qcResult.verdict} large />
        </div>

        <div className="space-y-1">
          <p className="text-sm font-semibold">{qcResult.sku}</p>
          <p className="text-sm" style={{ opacity: 0.65 }}>
            Stylist: {qcResult.stylistName} · Wig ID: {qcResult.wigId}
          </p>
          <p className="text-xs" style={{ opacity: 0.5 }}>
            {formatTimestamp(qcResult.timestamp)}
          </p>
        </div>

        {/* Summary pills */}
        <div className="flex gap-3 mt-4">
          <div
            className="flex-1 rounded-xl py-3 flex flex-col items-center"
            style={{ backgroundColor: 'rgba(22,163,74,0.1)' }}
          >
            <span className="text-xl font-bold" style={{ color: '#16a34a' }}>
              {passed}
            </span>
            <span className="text-xs font-semibold" style={{ color: '#16a34a' }}>
              Passed
            </span>
          </div>
          <div
            className="flex-1 rounded-xl py-3 flex flex-col items-center"
            style={{ backgroundColor: 'rgba(220,38,38,0.1)' }}
          >
            <span className="text-xl font-bold" style={{ color: '#dc2626' }}>
              {failed}
            </span>
            <span className="text-xs font-semibold" style={{ color: '#dc2626' }}>
              Failed
            </span>
          </div>
        </div>
      </div>

      {/* Criteria list */}
      <div className="px-5 pt-5 pb-4">
        <h2 className="text-base font-bold mb-4" style={{ color: BRAND }}>
          Quality Criteria
        </h2>
        <div className="space-y-3">
          {[
            ...qcResult.criteria.filter((c) => c.status === 'FAIL'),
            ...qcResult.criteria.filter((c) => c.status === 'PASS'),
          ].map((c) => (
            <CriterionCard key={c.id} criterion={c} onRated={patchActiveCriterion} />
          ))}
        </div>
      </div>

      {/* Overall verdict feedback (optional) */}
      <div className="px-5 pb-2">
        <VerdictFeedbackBox key={activeSession?.apiSessionId} sessionId={activeSession?.apiSessionId} />
      </div>

      {/* Start new session — does NOT reset existing sessions */}
      <div className="px-5 pt-2 pb-8">
        <button
          onClick={() => navigate('/new-session')}
          className="w-full py-4 rounded-xl text-base font-bold tracking-wide"
          style={{ backgroundColor: BRAND, color: OFF_WHITE }}
        >
          Start New Session
        </button>
      </div>
    </div>
  )
}

function verdictFeedbackKey(sessionId) {
  return `verdictFeedbackDone:${sessionId}`
}

function VerdictFeedbackBox({ sessionId }) {
  const [submitted, setSubmitted] = useState(
    () => !!sessionId && localStorage.getItem(verdictFeedbackKey(sessionId)) === '1'
  )
  const [showComment, setShowComment] = useState(false)
  const [agreed, setAgreed] = useState(null)
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)

  if (!sessionId) return null

  async function submit(agreeValue, withComment) {
    if (saving) return
    setSaving(true)
    try {
      await saveVerdictFeedback(sessionId, agreeValue, withComment ? comment.trim() || undefined : undefined)
      localStorage.setItem(verdictFeedbackKey(sessionId), '1')
      setSubmitted(true)
    } catch (err) {
      console.error('[verdict-feedback] failed', err)
    } finally {
      setSaving(false)
    }
  }

  if (submitted) {
    return (
      <div
        className="rounded-xl p-4 text-sm font-medium"
        style={{ backgroundColor: WARM_CREAM, color: BRAND, opacity: 0.85 }}
      >
        Thanks — your feedback was recorded.
      </div>
    )
  }

  return (
    <div
      className="rounded-xl p-4"
      style={{ backgroundColor: WARM_CREAM, color: BRAND, border: '1px solid rgba(59,15,13,0.18)' }}
    >
      <p className="text-sm font-semibold mb-3">Do you agree with this overall verdict?</p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => submit(true, false)}
          disabled={saving}
          className="text-sm font-semibold px-3 py-1.5 rounded-full"
          style={{ backgroundColor: 'rgba(22,163,74,0.12)', color: '#16a34a' }}
        >
          Agree
        </button>
        <button
          onClick={() => {
            setAgreed(false)
            setShowComment(true)
          }}
          disabled={saving}
          className="text-sm font-semibold px-3 py-1.5 rounded-full"
          style={{ backgroundColor: 'rgba(220,38,38,0.12)', color: '#dc2626' }}
        >
          Disagree
        </button>
      </div>

      {showComment && (
        <div className="mt-3">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="What was wrong? (optional)"
            rows={2}
            className="w-full text-sm rounded-lg p-2"
            style={{ border: '1px solid rgba(59,15,13,0.2)', backgroundColor: '#fff', color: BRAND }}
          />
          <button
            onClick={() => submit(agreed ?? false, true)}
            disabled={saving}
            className="mt-2 text-sm font-semibold px-3 py-1.5 rounded-full"
            style={{ backgroundColor: BRAND, color: OFF_WHITE }}
          >
            Submit feedback
          </button>
        </div>
      )}
    </div>
  )
}
