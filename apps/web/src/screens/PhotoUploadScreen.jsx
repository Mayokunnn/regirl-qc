import { useRef, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '../context/SessionContext'
import { uploadAngleFile, submitSession, fetchAngles } from '../api'
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

function AngleSlot({ angle, upload, onUpload }) {
  const inputRef = useRef(null)
  const hasPreview = !!upload?.preview
  const isUploaded = !!upload?.uploaded
  const isUploading = hasPreview && !isUploaded

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        backgroundColor: WARM_CREAM,
        border: `1px solid rgba(59,15,13,${isUploaded ? '0.35' : '0.15'})`,
      }}
    >
      <div className="relative" style={{ aspectRatio: '4/3' }}>
        {hasPreview ? (
          <>
            <img src={upload.preview} alt={angle.label} className="w-full h-full object-cover" />
            {isUploading && (
              <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: 'rgba(59,15,13,0.45)' }}>
                <svg className="animate-spin" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
              </div>
            )}
            {isUploaded && (
              <div className="absolute top-2 right-2 rounded-full p-1" style={{ backgroundColor: '#16a34a' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2" style={{ backgroundColor: 'rgba(59,15,13,0.04)', color: BRAND }}>
            <div style={{ opacity: 0.3 }}><UploadIcon /></div>
            <span className="text-xs" style={{ opacity: 0.4 }}>No photo yet</span>
          </div>
        )}
      </div>

      <div className="p-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm" style={{ color: BRAND }}>{angle.label}</p>
            <p className="text-xs mt-0.5 leading-relaxed" style={{ color: BRAND, opacity: 0.6 }}>{angle.instruction}</p>
          </div>
          <button
            onClick={() => inputRef.current?.click()}
            disabled={isUploading}
            className="shrink-0 px-3 py-2 rounded-lg text-xs font-bold tracking-wide"
            style={{ backgroundColor: BRAND, color: OFF_WHITE, opacity: isUploading ? 0.5 : 1 }}
          >
            {isUploading ? 'Uploading…' : hasPreview ? 'Retake' : 'Upload'}
          </button>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (!file) return
          onUpload(angle.key, file)
          e.target.value = ''
        }}
      />
    </div>
  )
}

export default function PhotoUploadScreen() {
  const navigate = useNavigate()
  const { activeSession, setAngleUpload, setActiveSessionStatus } = useSession()
  const [angles, setAngles] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (!activeSession?.styleId) return
    fetchAngles(activeSession.styleId)
      .then((data) => setAngles(data.map((a) => ({
        key: a.key,
        label: a.label,
        instruction: a.supervisorInstruction ?? '',
      }))))
      .catch(() => {
        setAngles([
          { key: 'FRONT_FULL', label: 'Front — Full View', instruction: 'Stand directly in front of mannequin at face height. Wig fully visible crown to hem. Vertical ruler visible on one side.' },
          { key: 'LEFT_PROFILE', label: 'Left Profile', instruction: 'Stand directly to the left — full side profile visible, ruler visible.' },
          { key: 'RIGHT_PROFILE', label: 'Right Profile', instruction: 'Stand directly to the right — full side profile visible, ruler visible.' },
          { key: 'BACK_FULL', label: 'Back — Full View', instruction: 'Stand directly behind — full back view visible, ruler visible.' },
          { key: 'TOP_DOWN', label: 'Top Down', instruction: 'Hold phone above mannequin head angled downward.' },
          { key: 'CLOSEUP_LACE', label: 'Close-up Lace', instruction: 'Camera 15–20cm from T-closure lace area.' },
          { key: 'CLOSEUP_ENDS', label: 'Close-up Ends', instruction: 'Camera 15–20cm from the ends of the hair.' },
        ])
      })
  }, [activeSession?.styleId])

  if (!activeSession) {
    navigate('/new-session', { replace: true })
    return null
  }

  const uploads = activeSession.uploads ?? {}
  const uploadedCount = angles.filter((a) => uploads[a.key]?.uploaded).length
  const allUploaded = uploadedCount === angles.length

  async function handleUpload(angleKey, file) {
    console.log(`[upload] selected file for angle=${angleKey} name=${file.name} size=${file.size} type=${file.type}`)
    const reader = new FileReader()
    reader.onload = async () => {
      const dataUrl = reader.result
      console.log(`[upload] FileReader done for angle=${angleKey}, setting preview`)
      setAngleUpload(angleKey, dataUrl, false)

      const base64 = dataUrl.split(',')[1]
      console.log(`[upload] calling API — sessionId=${activeSession.apiSessionId} angleKey=${angleKey} base64Length=${base64?.length}`)
      try {
        const result = await uploadAngleFile(activeSession.apiSessionId, angleKey, base64)
        console.log(`[upload] SUCCESS for angle=${angleKey}`, result)
        setAngleUpload(angleKey, dataUrl, true)
      } catch (err) {
        console.error(`[upload] FAILED for angle=${angleKey}`, err)
        setAngleUpload(angleKey, dataUrl, false)
        setSubmitError(`Upload failed for ${angleKey}: ${err?.message ?? 'Unknown error'}`)
      }
    }
    reader.onerror = (err) => {
      console.error(`[upload] FileReader error for angle=${angleKey}`, err)
      setSubmitError(`Could not read file for ${angleKey}`)
    }
    reader.readAsDataURL(file)
  }

  async function handleSubmit() {
    setSubmitting(true)
    setSubmitError('')
    try {
      await submitSession(activeSession.apiSessionId)
      setActiveSessionStatus('processing')
      setSubmitted(true)
    } catch (err) {
      setSubmitError(err.message ?? 'Submission failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col min-h-dvh pb-20" style={{ backgroundColor: OFF_WHITE, color: BRAND }}>
      <div className="px-5 pt-10 pb-4">
        <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ opacity: 0.55 }}>Regirl QC</p>
        <h1 className="text-2xl font-bold leading-tight">Upload Photos</h1>
        <p className="text-sm mt-1" style={{ opacity: 0.65 }}>{activeSession.skuLabel}</p>
      </div>

      <SessionSwitcher />

      <div className="px-5 mb-5">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm font-semibold">
            {uploadedCount} of {angles.length} photos uploaded
          </span>
          {allUploaded && (
            <span className="text-xs font-bold" style={{ color: '#16a34a' }}>Ready to submit</span>
          )}
        </div>
        <div className="w-full h-2 rounded-full" style={{ backgroundColor: 'rgba(59,15,13,0.12)' }}>
          <div
            className="h-2 rounded-full transition-all duration-300"
            style={{ width: `${(uploadedCount / angles.length) * 100}%`, backgroundColor: BRAND }}
          />
        </div>
      </div>

      <div className="flex-1 px-5 space-y-4">
        {angles.map((angle) => (
          <AngleSlot
            key={angle.key}
            angle={angle}
            upload={uploads[angle.key] ?? null}
            onUpload={handleUpload}
          />
        ))}
      </div>

      {submitError && (
        <p className="px-5 pt-3 text-sm font-medium" style={{ color: '#dc2626' }}>{submitError}</p>
      )}

      <div className="px-5 pt-6 pb-8">
        {submitted ? (
          <div className="w-full py-4 rounded-xl text-base font-bold tracking-wide text-center" style={{ backgroundColor: '#16a34a', color: '#fff' }}>
            Submitted — processing…
          </div>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!allUploaded || submitting}
            className="w-full py-4 rounded-xl text-base font-bold tracking-wide transition-opacity"
            style={{
              backgroundColor: BRAND,
              color: OFF_WHITE,
              opacity: allUploaded && !submitting ? 1 : 0.35,
              cursor: allUploaded && !submitting ? 'pointer' : 'not-allowed',
            }}
          >
            {submitting ? 'Submitting…' : 'Submit for QC'}
          </button>
        )}
      </div>
    </div>
  )
}
