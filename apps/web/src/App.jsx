import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { SessionProvider } from './context/SessionContext'
import { ProfileProvider } from './context/ProfileContext'
import BottomNav from './components/BottomNav'
import SessionBar from './components/SessionBar'
import LoginScreen from './screens/LoginScreen'
import DailyChecklistScreen from './screens/DailyChecklistScreen'
import NewSessionScreen from './screens/NewSessionScreen'
import PhotoUploadScreen from './screens/PhotoUploadScreen'
import ResultsScreen from './screens/ResultsScreen'
import HistoryScreen from './screens/HistoryScreen'
import RateInstructionsScreen from './screens/RateInstructionsScreen'
import AdminHomeScreen from './screens/AdminHomeScreen'
import AdminReferenceScreen from './screens/AdminReferenceScreen'

function AdminRoute({ children }) {
  const { role } = useAuth()
  return role === 'admin' ? children : <Navigate to="/checklist" replace />
}

function ProtectedApp() {
  const { isAuthenticated } = useAuth()

  if (!isAuthenticated) return <LoginScreen />

  return (
    <SessionProvider>
      <ProfileProvider>
      <div
        className="relative w-full max-w-[430px] mx-auto h-full flex flex-col overflow-hidden"
        style={{
          backgroundColor: '#FFFCF2',
          paddingTop: 'env(safe-area-inset-top)',
          paddingLeft: 'env(safe-area-inset-left)',
          paddingRight: 'env(safe-area-inset-right)',
        }}
      >
        <SessionBar />
        <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain pb-4">
          <Routes>
            <Route path="/" element={<Navigate to="/checklist" replace />} />
            <Route path="/checklist" element={<DailyChecklistScreen />} />
            <Route path="/new-session" element={<NewSessionScreen />} />
            <Route path="/upload" element={<PhotoUploadScreen />} />
            <Route path="/results" element={<ResultsScreen />} />
            <Route path="/history" element={<HistoryScreen />} />
            <Route path="/rate-instructions" element={<RateInstructionsScreen />} />
            <Route path="/admin" element={<AdminRoute><AdminHomeScreen /></AdminRoute>} />
            <Route path="/admin/reference" element={<AdminRoute><AdminReferenceScreen /></AdminRoute>} />
            <Route path="*" element={<Navigate to="/checklist" replace />} />
          </Routes>
        </main>
        <BottomNav />
      </div>
      </ProfileProvider>
    </SessionProvider>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ProtectedApp />
      </AuthProvider>
    </BrowserRouter>
  )
}
