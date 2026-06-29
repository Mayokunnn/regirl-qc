import { useState } from 'react'
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

const LogoutIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16 17 21 12 16 7"/>
    <line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
)

export default function BottomNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const { inProgressSessions } = useSession()
  const { role, logout } = useAuth()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const isHistory = location.pathname === '/history'
  const isAdmin = location.pathname.startsWith('/admin')
  const isSession = !isHistory && !isAdmin

  return (
    <nav
      style={{ backgroundColor: BRAND, color: CREAM }}
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

      <button
        onClick={() => setConfirmOpen(true)}
        className="flex flex-col items-center justify-center py-3 px-4 gap-1 border-0 cursor-pointer transition-opacity"
        style={{ backgroundColor: 'transparent', color: CREAM, opacity: 0.45 }}
        aria-label="Logout"
      >
        <LogoutIcon />
      </button>

      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => setConfirmOpen(false)}
        >
          <div
            className="w-full max-w-[430px] rounded-t-2xl p-6 flex flex-col gap-4"
            style={{ backgroundColor: CREAM }}
            onClick={e => e.stopPropagation()}
          >
            <p className="text-base font-semibold text-center" style={{ color: BRAND }}>Log out?</p>
            <p className="text-sm text-center text-gray-500">You'll need to sign in again to continue.</p>
            <button
              onClick={() => { logout(); navigate('/') }}
              className="w-full py-3 rounded-xl font-semibold text-sm"
              style={{ backgroundColor: BRAND, color: CREAM }}
            >
              Log out
            </button>
            <button
              onClick={() => setConfirmOpen(false)}
              className="w-full py-3 rounded-xl font-semibold text-sm"
              style={{ backgroundColor: '#f3ede0', color: BRAND }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </nav>
  )
}
