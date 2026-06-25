import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchReferenceSets, createReferenceSet } from '../api'

const BRAND = '#3B0F0D'
const OFF_WHITE = '#FFFCF2'
const WARM_CREAM = '#FFF3DD'

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function AdminHomeScreen() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: sets = [], isLoading: loading } = useQuery({
    queryKey: ['reference-sets'],
    queryFn: fetchReferenceSets,
  })
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const activeSet = sets.find((s) => s.isActive)
  const draftSets = sets.filter((s) => !s.isActive)

  async function handleNewSet() {
    setCreating(true)
    setError('')
    try {
      const nextVersion = sets.length > 0 ? Math.max(...sets.map((s) => s.version)) + 1 : 1
      const styleId = activeSet?.styleId ?? sets[0]?.styleId
      if (!styleId) throw new Error('No style found')
      const newSet = await createReferenceSet({
        styleId,
        version: nextVersion,
        promptVersion: 'v1',
        description: `Reference set v${nextVersion}`,
      })
      queryClient.invalidateQueries({ queryKey: ['reference-sets'] })
      navigate('/admin/reference', { state: { referenceSetId: newSet.id } })
    } catch {
      setError('Failed to create reference set')
      setCreating(false)
    }
  }

  return (
    <div className="flex flex-col min-h-dvh pb-24" style={{ backgroundColor: OFF_WHITE, color: BRAND }}>
      <div className="px-5 pt-10 pb-6" style={{ backgroundColor: WARM_CREAM, borderBottom: `1px solid rgba(59,15,13,0.12)` }}>
        <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ opacity: 0.55 }}>Admin</p>
        <h1 className="text-2xl font-bold">Reference Images</h1>
        <p className="text-sm mt-1" style={{ opacity: 0.65 }}>Manage gold-standard reference photos for Soft Siren QC.</p>
      </div>

      <div className="flex-1 px-5 pt-6 space-y-5">
        {error && <p className="text-sm font-medium" style={{ color: '#dc2626' }}>{error}</p>}

        {loading ? (
          <p className="text-sm" style={{ opacity: 0.5 }}>Loading…</p>
        ) : (
          <>
            {activeSet && (
              <div className="rounded-xl p-4" style={{ backgroundColor: WARM_CREAM, border: `1.5px solid rgba(59,15,13,0.25)` }}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded" style={{ backgroundColor: '#16a34a', color: '#fff' }}>Active</span>
                    <p className="font-semibold mt-2">Version {activeSet.version}</p>
                    <p className="text-xs mt-0.5" style={{ opacity: 0.55 }}>{activeSet.description ?? ''} · Created {formatDate(activeSet.createdAt)}</p>
                    <p className="text-xs mt-0.5" style={{ opacity: 0.55 }}>{activeSet.images?.length ?? 0} images uploaded</p>
                  </div>
                </div>
                <button
                  onClick={() => navigate('/admin/reference', { state: { referenceSetId: activeSet.id } })}
                  className="mt-3 w-full py-2.5 rounded-lg text-sm font-semibold"
                  style={{ backgroundColor: 'rgba(59,15,13,0.08)', color: BRAND }}
                >
                  View / Edit
                </button>
              </div>
            )}

            {draftSets.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ opacity: 0.5 }}>Drafts</p>
                <div className="space-y-3">
                  {draftSets.map((s) => (
                    <div key={s.id} className="rounded-xl p-4" style={{ backgroundColor: WARM_CREAM, border: `1px solid rgba(59,15,13,0.15)` }}>
                      <p className="font-semibold">Version {s.version}</p>
                      <p className="text-xs mt-0.5" style={{ opacity: 0.55 }}>{s.images?.length ?? 0} images · Created {formatDate(s.createdAt)}</p>
                      <button
                        onClick={() => navigate('/admin/reference', { state: { referenceSetId: s.id } })}
                        className="mt-3 w-full py-2.5 rounded-lg text-sm font-semibold"
                        style={{ backgroundColor: 'rgba(59,15,13,0.08)', color: BRAND }}
                      >
                        Continue Editing
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!activeSet && sets.length === 0 && (
              <p className="text-sm text-center py-8" style={{ opacity: 0.45 }}>No reference sets yet. Create one to get started.</p>
            )}
          </>
        )}
      </div>

      <div className="px-5 pb-8">
        <button
          onClick={handleNewSet}
          disabled={creating}
          className="w-full py-4 rounded-xl text-base font-bold tracking-wide"
          style={{ backgroundColor: BRAND, color: OFF_WHITE, opacity: creating ? 0.5 : 1 }}
        >
          {creating ? 'Creating…' : '+ New Reference Set'}
        </button>
      </div>
    </div>
  )
}
