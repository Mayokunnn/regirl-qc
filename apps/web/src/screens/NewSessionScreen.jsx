import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchSkus, createSession as apiCreateSession } from '../api'
import { useSession } from '../context/SessionContext'

const BRAND = '#3B0F0D'
const OFF_WHITE = '#FFFCF2'
const WARM_CREAM = '#FFF3DD'

function FieldLabel({ children }) {
  return (
    <label className="block text-sm font-semibold mb-1.5" style={{ color: BRAND }}>
      {children}
    </label>
  )
}

const inputStyle = {
  backgroundColor: WARM_CREAM,
  color: BRAND,
  border: `1.5px solid rgba(59,15,13,0.25)`,
  outline: 'none',
}

export default function NewSessionScreen() {
  const navigate = useNavigate()
  const { createSession, inProgressSessions } = useSession()

  const [skus, setSkus] = useState([])
  const [loadingSkus, setLoadingSkus] = useState(true)
  const [skuId, setSkuId] = useState('')
  const [stylistName, setStylistName] = useState('')
  const [wigId, setWigId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchSkus()
      .then(setSkus)
      .catch(() => setError('Failed to load SKUs — is the API running?'))
      .finally(() => setLoadingSkus(false))
  }, [])

  const selectedSku = skus.find((s) => s.id === skuId)
  const canContinue = skuId && stylistName.trim() && wigId.trim() && !submitting

  async function handleContinue() {
    if (!selectedSku) return
    setSubmitting(true)
    setError('')
    try {
      const session = await apiCreateSession({
        styleId: selectedSku.styleId,
        skuId: selectedSku.id,
        wigId: wigId.trim(),
        stylistName: stylistName.trim(),
      })
      createSession({
        apiSessionId: session.id,
        skuId: selectedSku.id,
        skuName: selectedSku.name,
        styleId: selectedSku.styleId,
        stylistName: stylistName.trim(),
        wigId: wigId.trim(),
      })
      navigate('/upload')
    } catch {
      setError('Failed to create session. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col min-h-dvh pb-20" style={{ backgroundColor: OFF_WHITE, color: BRAND }}>
      <div className="px-5 pt-10 pb-6">
        <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ opacity: 0.55 }}>
          Regirl QC
        </p>
        <h1 className="text-2xl font-bold leading-tight">New Session</h1>
        <p className="text-sm mt-1" style={{ opacity: 0.65 }}>
          Enter the wig details before uploading photos.
          {inProgressSessions.length > 0 && (
            <span>
              {' '}A new session will be created alongside your {inProgressSessions.length} in-progress session{inProgressSessions.length > 1 ? 's' : ''}.
            </span>
          )}
        </p>
      </div>

      <div className="flex-1 px-5 space-y-5">
        <div>
          <FieldLabel>Wig SKU</FieldLabel>
          {loadingSkus ? (
            <div className="w-full rounded-xl px-4 py-3.5 text-sm" style={{ ...inputStyle, opacity: 0.5 }}>
              Loading SKUs…
            </div>
          ) : (
            <select
              value={skuId}
              onChange={(e) => setSkuId(e.target.value)}
              className="w-full rounded-xl px-4 py-3.5 text-sm appearance-none"
              style={{ ...inputStyle, color: skuId ? BRAND : 'rgba(59,15,13,0.4)' }}
            >
              <option value="" disabled>Select a SKU…</option>
              {skus.map((s) => (
                <option key={s.id} value={s.id} style={{ color: BRAND }}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div>
          <FieldLabel>Stylist Name</FieldLabel>
          <input
            type="text"
            placeholder="e.g. Maria Santos"
            value={stylistName}
            onChange={(e) => setStylistName(e.target.value)}
            className="w-full rounded-xl px-4 py-3.5 text-sm"
            style={inputStyle}
          />
        </div>

        <div>
          <FieldLabel>Wig ID</FieldLabel>
          <input
            type="text"
            placeholder="e.g. WIG-20240328-001"
            value={wigId}
            onChange={(e) => setWigId(e.target.value)}
            className="w-full rounded-xl px-4 py-3.5 text-sm"
            style={inputStyle}
          />
        </div>

        {error && (
          <p className="text-sm font-medium" style={{ color: '#dc2626' }}>
            {error}
          </p>
        )}
      </div>

      <div className="px-5 pt-6 pb-8">
        <button
          onClick={handleContinue}
          disabled={!canContinue}
          className="w-full py-4 rounded-xl text-base font-bold tracking-wide transition-opacity"
          style={{
            backgroundColor: BRAND,
            color: OFF_WHITE,
            opacity: canContinue ? 1 : 0.35,
            cursor: canContinue ? 'pointer' : 'not-allowed',
          }}
        >
          {submitting ? 'Creating session…' : 'Continue'}
        </button>
      </div>
    </div>
  )
}
