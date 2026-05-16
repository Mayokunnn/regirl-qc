import { createContext, useContext, useState } from 'react'

const SessionContext = createContext(null)

function generateId() {
  return `s-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

export function SessionProvider({ children }) {
  // All sessions ever created in this app launch (uploading / processing / completed)
  const [sessions, setSessions] = useState([])
  const [activeSessionId, setActiveSessionId] = useState(null)

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null
  const inProgressSessions = sessions.filter((s) => s.status !== 'completed')

  /** Create a brand-new session and make it active. Returns the new id. */
  function createSession({ skuId, skuLabel, stylistName, wigId }) {
    const id = generateId()
    setSessions((prev) => [
      ...prev,
      {
        id,
        status: 'uploading',
        skuId,
        skuLabel,
        stylistName,
        wigId,
        photos: {},
        result: null,
        createdAt: new Date().toISOString(),
      },
    ])
    setActiveSessionId(id)
    return id
  }

  /** Add / replace a photo on the active session. */
  function setPhoto(angleId, dataUrl) {
    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeSessionId
          ? { ...s, photos: { ...s.photos, [angleId]: dataUrl } }
          : s
      )
    )
  }

  /** Update the status of the active session (e.g. 'processing'). */
  function setActiveSessionStatus(status) {
    setSessions((prev) =>
      prev.map((s) => (s.id === activeSessionId ? { ...s, status } : s))
    )
  }

  /** Store the QC result and mark the active session as completed. */
  function setActiveSessionResult(result) {
    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeSessionId ? { ...s, status: 'completed', result } : s
      )
    )
  }

  /**
   * Same as above but takes an explicit session ID — safe to call from a
   * background promise after the user has already navigated away and the
   * active session may have changed.
   */
  function setSessionResult(sessionId, result) {
    setSessions((prev) =>
      prev.map((s) =>
        s.id === sessionId ? { ...s, status: 'completed', result } : s
      )
    )
  }

  /** Switch which session is "active" (shown in Upload / Results). */
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
        setPhoto,
        setActiveSessionStatus,
        setActiveSessionResult,
        setSessionResult,
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
