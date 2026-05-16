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
