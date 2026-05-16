import { useNavigate } from 'react-router-dom'
import { useSession } from '../context/SessionContext'

const TOTAL_ANGLES = 7

const BRAND = '#3B0F0D'
const OFF_WHITE = '#FFFCF2'
const WARM_CREAM = '#FFF3DD'

/**
 * Horizontal scrollable strip showing all sessions except the currently active one.
 * - Uploading sessions: show photo count, tap → /upload
 * - Processing sessions: show "Analysing…", non-tappable (but still visible)
 * - Completed sessions: show "Done — tap to view", tap → /results
 *
 * Only renders when there is at least one other session to show.
 */
export default function SessionSwitcher() {
  const navigate = useNavigate()
  const { sessions, activeSessionId, switchSession } = useSession()

  const others = sessions.filter((s) => s.id !== activeSessionId)
  if (others.length === 0) return null

  function handleTap(s) {
    switchSession(s.id)
    if (s.status === 'completed') {
      navigate('/results')
    } else {
      navigate('/upload')
    }
  }

  return (
    <div className="px-5 mb-4">
      <p className="text-xs font-semibold mb-2" style={{ color: BRAND, opacity: 0.55 }}>
        Other sessions ({others.length})
      </p>
      <div
        className="flex gap-2 overflow-x-auto pb-1"
        style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
      >
        {others.map((s) => {
          const isProcessing = s.status === 'processing'
          const isCompleted = s.status === 'completed'
          const uploadedCount = Object.values(s.uploads ?? {}).filter((u) => u.uploaded).length

          let statusLine
          if (isProcessing) statusLine = 'Analysing…'
          else if (isCompleted) statusLine = 'Done — tap to view'
          else statusLine = `${uploadedCount} / ${TOTAL_ANGLES} photos`

          const chipBg = isCompleted ? 'rgba(22,163,74,0.12)' : WARM_CREAM
          const chipBorder = isCompleted
            ? '1.5px solid rgba(22,163,74,0.4)'
            : `1.5px solid rgba(59,15,13,0.2)`
          const statusColor = isCompleted
            ? '#16a34a'
            : isProcessing
            ? '#d97706'
            : BRAND

          return (
            <button
              key={s.id}
              onClick={() => !isProcessing && handleTap(s)}
              className="shrink-0 flex flex-col items-start rounded-xl px-3 py-2.5 text-left"
              style={{
                backgroundColor: chipBg,
                color: BRAND,
                border: chipBorder,
                minWidth: '130px',
                cursor: isProcessing ? 'default' : 'pointer',
                opacity: isProcessing ? 0.75 : 1,
              }}
            >
              <span className="text-xs font-bold truncate w-full max-w-[150px]">
                {s.wigId}
              </span>
              <span className="text-xs mt-0.5 font-medium" style={{ color: statusColor }}>
                {statusLine}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
