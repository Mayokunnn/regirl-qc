import { useState, useEffect, useRef, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { fetchReferenceSetAngles, uploadReferenceImage, activateReferenceSet, fetchReferenceSets } from '../api'

const BRAND = '#3B0F0D'
const OFF_WHITE = '#FFFCF2'
const WARM_CREAM = '#FFF3DD'

const ALL_ANGLES = [
  { key: 'FRONT_FULL', label: 'Front — Full View', instruction: 'Stand directly in front of mannequin at face height. Wig fully visible crown to hem. Vertical ruler visible on one side.' },
  { key: 'LEFT_PROFILE', label: 'Left Profile', instruction: 'Stand directly to the left of the mannequin at face height. Full side profile visible. Vertical ruler visible.' },
  { key: 'RIGHT_PROFILE', label: 'Right Profile', instruction: 'Stand directly to the right of the mannequin at face height. Full side profile visible. Vertical ruler visible.' },
  { key: 'BACK_FULL', label: 'Back — Full View', instruction: 'Stand directly behind the mannequin at face height. Full back view visible. Vertical ruler visible.' },
  { key: 'TOP_DOWN', label: 'Top Down', instruction: 'Hold phone directly above mannequin head angled downward. Shows crown and parting area.' },
  { key: 'CLOSEUP_LACE', label: 'Close-up Lace', instruction: 'Camera 15–20cm from the T-closure lace area. Fills frame with lace/parting zone.' },
  { key: 'CLOSEUP_ENDS', label: 'Close-up Ends', instruction: 'Camera 15–20cm from the ends of the hair. Supervisor lifts a section to show ends clearly against neutral background.' },
]

function AngleSection({ angle, images, referenceSetId, onUploaded }) {
  const inputRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [annotation, setAnnotation] = useState(images[0]?.annotationNote ?? '')
  const atMax = images.length >= 5

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const reader = new FileReader()
      reader.onload = async (ev) => {
        const base64 = ev.target.result.split(',')[1]
        await uploadReferenceImage(referenceSetId, angle.key, base64, annotation || undefined)
        onUploaded()
        setUploading(false)
      }
      reader.readAsDataURL(file)
    } catch {
      setUploading(false)
    }
    e.target.value = ''
  }

  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: WARM_CREAM, border: `1px solid rgba(59,15,13,0.15)` }}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">{angle.label}</p>
          <p className="text-xs mt-0.5 leading-relaxed" style={{ opacity: 0.6 }}>{angle.instruction}</p>
        </div>
        <span className="shrink-0 text-xs font-bold" style={{ opacity: 0.45 }}>{images.length}/5</span>
      </div>

      {images.length > 0 && (
        <div className="grid grid-cols-5 gap-1.5 mb-3">
          {images.map((img) => (
            <div key={img.id} className="aspect-square rounded-lg overflow-hidden" style={{ backgroundColor: 'rgba(59,15,13,0.07)' }}>
              {img.url && !img.url.startsWith('file://') ? (
                <img src={img.url} alt={angle.label} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center" style={{ opacity: 0.3 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <textarea
        placeholder="Annotation note (e.g. 'Hem aligns with 22cm ruler mark')"
        value={annotation}
        onChange={(e) => setAnnotation(e.target.value)}
        rows={2}
        className="w-full rounded-lg px-3 py-2 text-xs mb-2 resize-none"
        style={{ backgroundColor: 'rgba(59,15,13,0.05)', border: `1px solid rgba(59,15,13,0.15)`, color: BRAND, outline: 'none' }}
      />

      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading || atMax}
        className="w-full py-2 rounded-lg text-xs font-bold tracking-wide"
        style={{ backgroundColor: BRAND, color: OFF_WHITE, opacity: (uploading || atMax) ? 0.4 : 1 }}
      >
        {uploading ? 'Uploading…' : atMax ? 'Max 5 photos' : '+ Add Photo'}
      </button>
    </div>
  )
}

export default function AdminReferenceScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const referenceSetId = location.state?.referenceSetId
  const [angleImages, setAngleImages] = useState({})
  const [loading, setLoading] = useState(true)
  const [activating, setActivating] = useState(false)
  const [isActive, setIsActive] = useState(false)
  const [error, setError] = useState('')

  const totalImages = Object.values(angleImages).flat().length
  const anglesWithImages = ALL_ANGLES.filter((a) => (angleImages[a.key] ?? []).length > 0).length
  const canActivate = anglesWithImages === ALL_ANGLES.length && !isActive

  const load = useCallback(async () => {
    if (!referenceSetId) return
    try {
      const [imagesData, sets] = await Promise.all([
        fetchReferenceSetAngles(referenceSetId),
        fetchReferenceSets(),
      ])
      setAngleImages(imagesData)
      const thisSet = sets.find((s) => s.id === referenceSetId)
      setIsActive(thisSet?.isActive ?? false)
    } catch {
      setError('Failed to load reference images')
    } finally {
      setLoading(false)
    }
  }, [referenceSetId])

  useEffect(() => { load() }, [load])

  async function handleActivate() {
    setActivating(true)
    setError('')
    try {
      await activateReferenceSet(referenceSetId)
      setIsActive(true)
    } catch {
      setError('Failed to activate reference set')
    } finally {
      setActivating(false)
    }
  }

  if (!referenceSetId) {
    return (
      <div className="flex items-center justify-center min-h-full" style={{ backgroundColor: OFF_WHITE, color: BRAND }}>
        <p className="text-sm" style={{ opacity: 0.5 }}>No reference set selected.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-full" style={{ backgroundColor: OFF_WHITE, color: BRAND }}>
      <div className="px-5 pt-10 pb-5" style={{ backgroundColor: WARM_CREAM, borderBottom: `1px solid rgba(59,15,13,0.12)` }}>
        <button onClick={() => navigate('/admin')} className="text-xs font-semibold mb-3 flex items-center gap-1" style={{ opacity: 0.6, background: 'none', border: 'none', color: BRAND, cursor: 'pointer', padding: 0 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          Back
        </button>
        <h1 className="text-xl font-bold">Reference Images</h1>
        <p className="text-sm mt-1" style={{ opacity: 0.65 }}>
          {anglesWithImages}/{ALL_ANGLES.length} angles · {totalImages} photos
          {isActive && <span className="ml-2 text-xs font-bold px-2 py-0.5 rounded" style={{ backgroundColor: '#16a34a', color: '#fff' }}>Active</span>}
        </p>
        {error && <p className="text-xs mt-1 font-medium" style={{ color: '#dc2626' }}>{error}</p>}
      </div>

      <div className="flex-1 px-5 pt-5 space-y-4">
        {loading ? (
          <p className="text-sm py-8 text-center" style={{ opacity: 0.45 }}>Loading…</p>
        ) : (
          ALL_ANGLES.map((angle) => (
            <AngleSection
              key={angle.key}
              angle={angle}
              images={angleImages[angle.key] ?? []}
              referenceSetId={referenceSetId}
              onUploaded={load}
            />
          ))
        )}
      </div>

      {!isActive && (
        <div className="sticky bottom-0 left-0 right-0 px-5 pt-3 pb-4" style={{ backgroundColor: OFF_WHITE, borderTop: '1px solid rgba(59,15,13,0.08)' }}>
          <button
            onClick={handleActivate}
            disabled={!canActivate || activating}
            className="w-full py-4 rounded-xl text-base font-bold tracking-wide"
            style={{ backgroundColor: BRAND, color: OFF_WHITE, opacity: (!canActivate || activating) ? 0.35 : 1 }}
          >
            {activating ? 'Activating…' : canActivate ? 'Activate Reference Set' : `Upload all 7 angles to activate`}
          </button>
        </div>
      )}
    </div>
  )
}
