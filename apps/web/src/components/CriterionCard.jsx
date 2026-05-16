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
  const { label, status, confidence, severity, failureReason, reworkInstructions, captureAngle } =
    criterion
  const isPassed = status === 'PASS'

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
    </div>
  )
}
