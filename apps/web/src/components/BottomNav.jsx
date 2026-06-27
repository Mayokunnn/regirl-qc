import { useNavigate, useLocation } from 'react-router-dom'
import { useSession } from '../context/SessionContext'
import { useAuth } from '../context/AuthContext'

const BRAND = '#3B0F0D'
const CREAM = '#FFFCF2'

const CameraIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
    <circle cx="12" cy="13" r="4"/>
  </svg>
)

const HistoryIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>
)

const AdminIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
    <path d="M12 2v2M12 20v2M2 12h2M20 12h2"/>
  </svg>
)

export default function BottomNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const { inProgressSessions } = useSession()
  const { role } = useAuth()

  const isHistory = location.pathname === '/history'
  const isAdmin = location.pathname.startsWith('/admin')
  const isSession = !isHistory && !isAdmin

  return (
    <nav
      style={{
        backgroundColor: BRAND,
        color: CREAM,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
      className="shrink-0 flex z-50"
    >
      <button
        onClick={() => navigate('/new-session')}
        className="flex-1 flex flex-col items-center justify-center py-3 gap-1 border-0 cursor-pointer transition-opacity relative"
        style={{ backgroundColor: 'transparent', color: CREAM, opacity: isSession ? 1 : 0.55 }}
      >
        <div className="relative">
          <CameraIcon />
          {inProgressSessions.length > 0 && (
            <span
              className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] font-bold px-1"
              style={{ backgroundColor: '#d97706', color: '#fff' }}
            >
              {inProgressSessions.length}
            </span>
          )}
        </div>
        <span className="text-xs font-medium tracking-wide">New Session</span>
      </button>

      <button
        onClick={() => navigate('/history')}
        className="flex-1 flex flex-col items-center justify-center py-3 gap-1 border-0 cursor-pointer transition-opacity"
        style={{ backgroundColor: 'transparent', color: CREAM, opacity: isHistory ? 1 : 0.55 }}
      >
        <HistoryIcon />
        <span className="text-xs font-medium tracking-wide">History</span>
      </button>

      {role === 'admin' && (
        <button
          onClick={() => navigate('/admin')}
          className="flex-1 flex flex-col items-center justify-center py-3 gap-1 border-0 cursor-pointer transition-opacity"
          style={{ backgroundColor: 'transparent', color: CREAM, opacity: isAdmin ? 1 : 0.55 }}
        >
          <AdminIcon />
          <span className="text-xs font-medium tracking-wide">Admin</span>
        </button>
      )}
    </nav>
  )
}
