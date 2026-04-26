import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { CAPTURE_ANGLES } from '../mockData'
import { useSession } from '../context/SessionContext'
import { submitQCSession } from '../api'
import SessionSwitcher from '../components/SessionSwitcher'

const BRAND = '#3B0F0D'
const OFF_WHITE = '#FFFCF2'
const WARM_CREAM = '#FFF3DD'

const UploadIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 16 12 12 8 16"/>
    <line x1="12" y1="12" x2="12" y2="21"/>
    <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
  </svg>
)

function AngleSlot({ angle, photo, onUpload }) {
  const inputRef = useRef(null)
  const hasPhoto = !!photo

  function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => onUpload(angle.id, reader.result)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        backgroundColor: WARM_CREAM,
        border: `1px solid rgba(59,15,13,${hasPhoto ? '0.35' : '0.15'})`,
      }}
    >
      <div className="relative" style={{ aspectRatio: '4/3' }}>
        {hasPhoto ? (
          <img src={photo} alt={angle.label} className="w-full h-full object-cover" />
        ) : (
          <div
            className="w-full h-full flex flex-col items-center justify-center gap-2"
            style={{ backgroundColor: 'rgba(59,15,13,0.04)', color: BRAND }}
          >
            <div style={{ opacity: 0.3 }}>
              <UploadIcon />
            </div>
            <span className="text-xs" style={{ opacity: 0.4 }}>
              No photo yet
            </span>
          </div>
        )}
      </div>

      <div className="p-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm" style={{ color: BRAND }}>
              {angle.label}
            </p>
            <p className="text-xs mt-0.5 leading-relaxed" style={{ color: BRAND, opacity: 0.6 }}>
              {angle.instruction}
            </p>
          </div>
          <button
            onClick={() => inputRef.current?.click()}
            className="shrink-0 px-3 py-2 rounded-lg text-xs font-bold tracking-wide"
            style={{ backgroundColor: BRAND, color: OFF_WHITE }}
          >
            {hasPhoto ? 'Retake' : 'Upload'}
          </button>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  )
}

export default function PhotoUploadScreen() {
  const navigate = useNavigate()
  const { activeSession, setPhoto, setActiveSessionStatus, setSessionResult } = useSession()

  // Guard: if no active session, go create one
  if (!activeSession) {
    navigate('/new-session', { replace: true })
    return null
  }

  const uploadedCount = CAPTURE_ANGLES.filter((a) => !!activeSession.photos[a.id]).length
  const allUploaded = uploadedCount === CAPTURE_ANGLES.length

  function handleSubmit() {
    // Capture the session ID now — the active session may change after navigation
    const sessionId = activeSession.id
    const sessionSnapshot = { ...activeSession }

    setActiveSessionStatus('processing')

    // Fire the API call — do NOT await it here. Navigate immediately so the
    // supervisor can start the next wig without waiting for the AI result.
    submitQCSession(sessionSnapshot)
      .then((result) => setSessionResult(sessionId, result))
      .catch(() => {
        // Put the session back to uploading so the supervisor can retry
        setActiveSessionStatus('uploading')
      })

    navigate('/new-session')
  }

  return (
    <div className="flex flex-col min-h-dvh pb-20" style={{ backgroundColor: OFF_WHITE, color: BRAND }}>
      {/* Header */}
      <div className="px-5 pt-10 pb-4">
        <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ opacity: 0.55 }}>
          Regirl QC
        </p>
        <h1 className="text-2xl font-bold leading-tight">Upload Photos</h1>
        <p className="text-sm mt-1" style={{ opacity: 0.65 }}>
          {activeSession.skuLabel}
        </p>
      </div>

      {/* Session switcher — appears when 2+ sessions are in progress */}
      <SessionSwitcher />

      {/* Progress bar */}
      <div className="px-5 mb-5">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm font-semibold">
            {uploadedCount} of {CAPTURE_ANGLES.length} photos uploaded
          </span>
          {allUploaded && (
            <span className="text-xs font-bold" style={{ color: '#16a34a' }}>
              Ready to submit
            </span>
          )}
        </div>
        <div className="w-full h-2 rounded-full" style={{ backgroundColor: 'rgba(59,15,13,0.12)' }}>
          <div
            className="h-2 rounded-full transition-all duration-300"
            style={{
              width: `${(uploadedCount / CAPTURE_ANGLES.length) * 100}%`,
              backgroundColor: BRAND,
            }}
          />
        </div>
      </div>

      {/* Angle slots */}
      <div className="flex-1 px-5 space-y-4">
        {CAPTURE_ANGLES.map((angle) => (
          <AngleSlot
            key={angle.id}
            angle={angle}
            photo={activeSession.photos[angle.id] ?? null}
            onUpload={setPhoto}
          />
        ))}
      </div>

      {/* Submit */}
      <div className="px-5 pt-6 pb-8">
        <button
          onClick={handleSubmit}
          disabled={!allUploaded}
          className="w-full py-4 rounded-xl text-base font-bold tracking-wide transition-opacity"
          style={{
            backgroundColor: BRAND,
            color: OFF_WHITE,
            opacity: allUploaded ? 1 : 0.35,
            cursor: allUploaded ? 'pointer' : 'not-allowed',
          }}
        >
          Submit for QC
        </button>
      </div>
    </div>
  )
}
