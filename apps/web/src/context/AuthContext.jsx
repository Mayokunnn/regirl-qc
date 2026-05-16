import { createContext, useContext, useState, useEffect } from 'react'
import { login as apiLogin } from '../api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('auth_token'))
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('auth_user') ?? 'null') } catch { return null }
  })

  useEffect(() => {
    function handleLogout() { logout() }
    window.addEventListener('auth:logout', handleLogout)
    return () => window.removeEventListener('auth:logout', handleLogout)
  }, [])

  async function login(email, password) {
    const data = await apiLogin(email, password)
    localStorage.setItem('auth_token', data.accessToken)
    localStorage.setItem('auth_user', JSON.stringify(data.user))
    setToken(data.accessToken)
    setUser(data.user)
  }

  function logout() {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ token, user, login, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
