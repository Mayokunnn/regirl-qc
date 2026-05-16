import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { pollStatus, getSessionDetail, mapSessionResult } from '../api'

const SessionContext = createContext(null)

function generateLocalId() {
  return `s-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

export function SessionProvider({ children }) {
  const [sessions, setSessions] = useState([])
  const [activeSessionId, setActiveSessionId] = useState(null)
  const pollingRef = useRef({}) // { [localId]: intervalId }

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null
  const inProgressSessions = sessions.filter((s) => s.status !== 'completed')

  // Poll any sessions that are in 'processing' state
  useEffect(() => {
    sessions.forEach((session) => {
      if (session.status === 'processing' && session.apiSessionId && !pollingRef.current[session.id]) {
        pollingRef.current[session.id] = setInterval(async () => {
          try {
            const status = await pollStatus(session.apiSessionId)
            if (status.status === 'completed') {
              clearInterval(pollingRef.current[session.id])
              delete pollingRef.current[session.id]
              const detail = await getSessionDetail(session.apiSessionId)
              const result = mapSessionResult(detail)
              setSessions((prev) =>
                prev.map((s) =>
                  s.id === session.id ? { ...s, status: 'completed', result } : s
                )
              )
            } else if (status.status === 'failed') {
              clearInterval(pollingRef.current[session.id])
              delete pollingRef.current[session.id]
              setSessions((prev) =>
                prev.map((s) => (s.id === session.id ? { ...s, status: 'error' } : s))
              )
            }
          } catch {
            // network hiccup — keep polling
          }
        }, 3000)
      }
    })
  }, [sessions])

  // Clean up intervals on unmount
  useEffect(() => {
    return () => Object.values(pollingRef.current).forEach(clearInterval)
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

  return (
    <SessionContext.Provider
      value={{
        sessions,
        activeSession,
        activeSessionId,
        inProgressSessions,
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
