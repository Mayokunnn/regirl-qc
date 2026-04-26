import { useNavigate } from 'react-router-dom'
import { useSession } from '../context/SessionContext'
import VerdictBadge from '../components/VerdictBadge'
import CriterionCard from '../components/CriterionCard'
import SessionSwitcher from '../components/SessionSwitcher'

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
  const { activeSession } = useSession()

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

      {/* Other sessions (uploading, processing, or completed) */}
      <div className="pt-4">
        <SessionSwitcher />
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
            <CriterionCard key={c.id} criterion={c} />
          ))}
        </div>
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
