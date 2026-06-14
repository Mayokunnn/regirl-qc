import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { SessionProvider } from './context/SessionContext'
import BottomNav from './components/BottomNav'
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
      <div
        className="relative w-full max-w-[430px] mx-auto min-h-dvh flex flex-col"
        style={{ backgroundColor: '#FFFCF2' }}
      >
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
        <BottomNav />
      </div>
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
