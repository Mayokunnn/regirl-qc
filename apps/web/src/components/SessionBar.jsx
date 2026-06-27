import { useNavigate } from 'react-router-dom'
import { useSession } from '../context/SessionContext'

const TOTAL_ANGLES = 7

const BRAND = '#3B0F0D'
const OFF_WHITE = '#FFFCF2'
const WARM_CREAM = '#FFF3DD'

/**
 * Global, horizontally-scrollable strip of ALL sessions, including the active one.
 * Rendered once at the top of the app shell so it persists across screens.
 * - Active session is highlighted.
 * - Tap a session to switch to it and jump to its screen.
 * - Processing sessions show "Analysing…" and are non-navigating.
 * Hidden when there are no sessions.
 */
export default function SessionBar() {
  const navigate = useNavigate()
  const { sessions, activeSessionId, switchSession, removeSession } = useSession()

  if (sessions.length === 0) return null

  function handleTap(s) {
    if (s.status === 'processing') return
    switchSession(s.id)
    if (s.status === 'completed') navigate('/results')
    else navigate('/upload')
  }

  return (
    <div
      className="shrink-0 px-4 py-2.5"
      style={{ backgroundColor: OFF_WHITE, borderBottom: '1px solid rgba(59,15,13,0.1)' }}
    >
      <div
        className="flex gap-2 overflow-x-auto"
        style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
      >
        {sessions.map((s) => {
          const isActive = s.id === activeSessionId
          const isProcessing = s.status === 'processing'
          const isCompleted = s.status === 'completed'
          const uploadedCount = Object.values(s.uploads ?? {}).filter((u) => u.uploaded).length

          let statusLine
          if (isProcessing) statusLine = 'Analysing…'
          else if (isCompleted) statusLine = 'Done'
          else statusLine = `${uploadedCount} / ${TOTAL_ANGLES} photos`

          const statusColor = isCompleted ? '#16a34a' : isProcessing ? '#d97706' : BRAND

          return (
            <div
              key={s.id}
              onClick={() => handleTap(s)}
              role="button"
              className="relative shrink-0 flex flex-col items-start rounded-xl pl-3 pr-7 py-2 text-left"
              style={{
                backgroundColor: isActive ? BRAND : WARM_CREAM,
                color: isActive ? OFF_WHITE : BRAND,
                border: isActive
                  ? '1.5px solid ' + BRAND
                  : isCompleted
                  ? '1.5px solid rgba(22,163,74,0.4)'
                  : '1.5px solid rgba(59,15,13,0.2)',
                minWidth: '120px',
                cursor: isProcessing ? 'default' : 'pointer',
              }}
            >
              <button
                type="button"
                aria-label="Close session"
                onClick={(e) => {
                  e.stopPropagation()
                  removeSession(s.id)
                }}
                className="absolute top-1 right-1 flex items-center justify-center rounded-full"
                style={{
                  width: '18px',
                  height: '18px',
                  color: isActive ? OFF_WHITE : BRAND,
                  opacity: 0.65,
                  lineHeight: 1,
                }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                  <line x1="5" y1="5" x2="19" y2="19" />
                  <line x1="19" y1="5" x2="5" y2="19" />
                </svg>
              </button>
              <span className="text-xs font-bold truncate w-full max-w-[150px]">{s.wigId}</span>
              <span
                className="text-xs mt-0.5 font-medium"
                style={{ color: isActive ? OFF_WHITE : statusColor, opacity: isActive ? 0.9 : 1 }}
              >
                {statusLine}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
