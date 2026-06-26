import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchSkus, createSession as apiCreateSession, fetchSessionsForWig, getSessionDetail, mapSessionResult } from '../api'
import { useQuery } from '@tanstack/react-query'
import { useSession } from '../context/SessionContext'
import { useProfile } from '../context/ProfileContext'
import { nextWigId } from '../lib/wigId'

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
  const { stylistName: savedName, hasProfile, setStylistName: saveStylistName } = useProfile()

  const { data: skus = [], isLoading: loadingSkus } = useQuery({
    queryKey: ['skus'],
    queryFn: fetchSkus,
  })
  const [skuId, setSkuId] = useState('')
  const [nameInput, setNameInput] = useState('') // only used when no profile yet
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Effective stylist name: stored profile, or what the user is entering first time.
  const stylistName = hasProfile ? savedName : nameInput

  const selectedSku = skus.find((s) => s.id === skuId)
  const canContinue = skuId && stylistName.trim() && !submitting

  async function handleContinue() {
    if (!selectedSku) return
    setSubmitting(true)
    setError('')
    // First-time stylist: persist the name as the profile so it's never asked again.
    if (!hasProfile) saveStylistName(nameInput.trim())
    const wigId = nextWigId()
    try {
      // Check for previous failed sessions on this wig that need rating
      let previousFailedCriteria = []
      try {
        const priorSessions = await fetchSessionsForWig(wigId.trim())
        const latestFailed = priorSessions.find(
          (s) => s.verdict === 'FAIL' || s.verdict === 'ADVISORY'
        )
        if (latestFailed) {
          const detail = await getSessionDetail(latestFailed.id)
          const mapped = mapSessionResult(detail)
          if (mapped) {
            previousFailedCriteria = mapped.criteria.filter(
              (c) => c.status === 'FAIL' && c.reworkInstructions && !c.instructionRating
            )
          }
        }
      } catch {
        // non-blocking — skip rating if lookup fails
      }

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

      if (previousFailedCriteria.length > 0) {
        navigate('/rate-instructions', { state: { criteria: previousFailedCriteria } })
      } else {
        navigate('/upload')
      }
    } catch {
      setError('Failed to create session. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col min-h-full" style={{ backgroundColor: OFF_WHITE, color: BRAND }}>
      <div className="px-5 pt-10 pb-6">
        <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ opacity: 0.55 }}>
          Regirl QC
        </p>
        <h1 className="text-2xl font-bold leading-tight">New Session</h1>
        <p className="text-sm mt-1" style={{ opacity: 0.65 }}>
          Pick the SKU — a Wig ID is assigned automatically.
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

        {hasProfile ? (
          <div>
            <FieldLabel>Stylist</FieldLabel>
            <div
              className="w-full rounded-xl px-4 py-3.5 text-sm flex items-center justify-between"
              style={inputStyle}
            >
              <span>{savedName}</span>
              <button
                type="button"
                onClick={() => saveStylistName('')}
                className="text-xs font-semibold underline"
                style={{ color: BRAND, opacity: 0.6 }}
              >
                Change
              </button>
            </div>
          </div>
        ) : (
          <div>
            <FieldLabel>Stylist Name</FieldLabel>
            <input
              type="text"
              placeholder="e.g. Maria Santos"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              className="w-full rounded-xl px-4 py-3.5 text-sm"
              style={inputStyle}
            />
            <p className="text-xs mt-1.5" style={{ opacity: 0.55 }}>
              We'll remember this so you won't need to enter it again.
            </p>
          </div>
        )}

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
