import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

const BRAND = '#3B0F0D'
const OFF_WHITE = '#FFFCF2'
const WARM_CREAM = '#FFF3DD'

const inputStyle = {
  backgroundColor: WARM_CREAM,
  color: BRAND,
  border: `1.5px solid rgba(59,15,13,0.25)`,
  outline: 'none',
}

export default function LoginScreen() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email.trim(), password)
    } catch {
      setError('Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="flex flex-col items-center justify-center min-h-dvh px-6"
      style={{ backgroundColor: OFF_WHITE, color: BRAND }}
    >
      <div className="w-full max-w-sm">
        <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ opacity: 0.5 }}>
          Regirl QC
        </p>
        <h1 className="text-2xl font-bold mb-8">Sign in</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1.5" style={{ color: BRAND }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="supervisor@regirl.local"
              required
              className="w-full rounded-xl px-4 py-3.5 text-sm"
              style={inputStyle}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1.5" style={{ color: BRAND }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full rounded-xl px-4 py-3.5 text-sm"
              style={inputStyle}
            />
          </div>

          {error && (
            <p className="text-sm font-medium" style={{ color: '#dc2626' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full py-4 rounded-xl text-base font-bold tracking-wide transition-opacity mt-2"
            style={{
              backgroundColor: BRAND,
              color: OFF_WHITE,
              opacity: loading || !email || !password ? 0.35 : 1,
              cursor: loading || !email || !password ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
