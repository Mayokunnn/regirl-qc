import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { pollStatus, getSessionDetail, mapSessionResult } from '../api'

const SessionContext = createContext(null)

function generateLocalId() {
  return `s-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

const SESSIONS_KEY = 'qc_sessions'
const ACTIVE_KEY = 'qc_active_session_id'

// Strips heavy base64 data-URL previews before persisting — we keep upload
// status but not the image bytes, to avoid blowing past the localStorage quota.
function stripPreviews(sessions) {
  return sessions.map((s) => ({
    ...s,
    uploads: Object.fromEntries(
      Object.entries(s.uploads ?? {}).map(([k, v]) => [k, { uploaded: !!v?.uploaded }])
    ),
  }))
}

function loadSessions() {
  try {
    const raw = JSON.parse(localStorage.getItem(SESSIONS_KEY) ?? '[]')
    return Array.isArray(raw) ? raw : []
  } catch {
    return []
  }
}

export function SessionProvider({ children }) {
  const [sessions, setSessions] = useState(loadSessions)
  const [activeSessionId, setActiveSessionId] = useState(
    () => localStorage.getItem(ACTIVE_KEY) || null
  )
  const pollingRef = useRef({}) // { [localId]: intervalId }

  // Persist sessions (without preview bytes) and the active id across reloads.
  useEffect(() => {
    try {
      localStorage.setItem(SESSIONS_KEY, JSON.stringify(stripPreviews(sessions)))
    } catch {
      // quota exceeded or serialization issue — non-fatal
    }
  }, [sessions])

  useEffect(() => {
    if (activeSessionId) localStorage.setItem(ACTIVE_KEY, activeSessionId)
    else localStorage.removeItem(ACTIVE_KEY)
  }, [activeSessionId])

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null
  const inProgressSessions = sessions.filter((s) => s.status !== 'completed')

  // Poll every session that is in 'processing' state (including ones restored
  // from localStorage). One interval per session; started once, torn down when
  // the session leaves 'processing' or its apiSessionId disappears.
  useEffect(() => {
    function stopPolling(localId) {
      if (pollingRef.current[localId]) {
        clearInterval(pollingRef.current[localId])
        delete pollingRef.current[localId]
      }
    }

    async function pollOnce(session) {
      try {
        const status = await pollStatus(session.apiSessionId)
        if (status.status === 'completed') {
          stopPolling(session.id)
          const detail = await getSessionDetail(session.apiSessionId)
          const result = mapSessionResult(detail)
          setSessions((prev) =>
            prev.map((s) => (s.id === session.id ? { ...s, status: 'completed', result } : s))
          )
        } else if (status.status === 'failed') {
          stopPolling(session.id)
          setSessions((prev) =>
            prev.map((s) => (s.id === session.id ? { ...s, status: 'error' } : s))
          )
        }
      } catch {
        // network hiccup — keep polling
      }
    }

    const processingIds = new Set()
    sessions.forEach((session) => {
      if (session.status === 'processing' && session.apiSessionId) {
        processingIds.add(session.id)
        if (!pollingRef.current[session.id]) {
          pollOnce(session) // fire immediately so status updates without a 3s wait
          pollingRef.current[session.id] = setInterval(() => pollOnce(session), 3000)
        }
      }
    })

    // Tear down intervals for sessions that are no longer processing.
    Object.keys(pollingRef.current).forEach((localId) => {
      if (!processingIds.has(localId)) stopPolling(localId)
    })
  }, [sessions])

  // Clear all intervals and reset the map on unmount (also handles StrictMode's
  // mount→unmount→remount so polling reliably restarts).
  useEffect(() => {
    return () => {
      Object.values(pollingRef.current).forEach(clearInterval)
      pollingRef.current = {}
    }
  }, [])

  function createSession({ apiSessionId, skuId, skuName, styleId, stylistName, wigId }) {
    const id = generateLocalId()
    setSessions((prev) => [
      ...prev,
      {
        id,
        apiSessionId,
        status: 'uploading',
        skuId,
        skuLabel: skuName,
        styleId,
        stylistName,
        wigId,
        uploads: {}, // { [angleKey]: { preview: dataUrl, uploaded: boolean } }
        result: null,
        createdAt: new Date().toISOString(),
      },
    ])
    setActiveSessionId(id)
    return id
  }

  function setAngleUpload(angleKey, preview, uploaded) {
    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeSessionId
          ? { ...s, uploads: { ...s.uploads, [angleKey]: { preview, uploaded } } }
          : s
      )
    )
  }

  function setActiveSessionStatus(status) {
    setSessions((prev) =>
      prev.map((s) => (s.id === activeSessionId ? { ...s, status } : s))
    )
  }

  function switchSession(id) {
    setActiveSessionId(id)
  }

  // Closes a session tab. Stops its polling and, if it was active, falls back to
  // another remaining session (or none). The persistence effect drops it from
  // localStorage automatically.
  function removeSession(id) {
    if (pollingRef.current[id]) {
      clearInterval(pollingRef.current[id])
      delete pollingRef.current[id]
    }
    setSessions((prev) => prev.filter((s) => s.id !== id))
    setActiveSessionId((current) =>
      current === id ? (sessions.find((s) => s.id !== id)?.id ?? null) : current
    )
  }

  // Patches a single criterion in the active session's result so a rating sticks
  // when the card remounts (e.g. switching tabs) and survives a reload.
  function patchActiveCriterion(criterionId, patch) {
    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeSessionId && s.result
          ? {
              ...s,
              result: {
                ...s.result,
                criteria: s.result.criteria.map((c) =>
                  c.id === criterionId ? { ...c, ...patch } : c
                ),
              },
            }
          : s
      )
    )
  }

  return (
    <SessionContext.Provider
      value={{
        sessions,
        activeSession,
        activeSessionId,
        inProgressSessions,
        patchActiveCriterion,
        removeSession,
        createSession,
        setAngleUpload,
        setActiveSessionStatus,
        switchSession,
      }}
    >
      {children}
    </SessionContext.Provider>
  )
}

export function useSession() {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used inside SessionProvider')
  return ctx
}
