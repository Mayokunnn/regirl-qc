import { createContext, useContext, useState } from 'react'

const ProfileContext = createContext(null)

const STORAGE_KEY = 'stylist_name'

export function ProfileProvider({ children }) {
  const [stylistName, setStylistNameState] = useState(
    () => localStorage.getItem(STORAGE_KEY) || null
  )

  function setStylistName(name) {
    const trimmed = (name ?? '').trim()
    if (trimmed) {
      localStorage.setItem(STORAGE_KEY, trimmed)
      setStylistNameState(trimmed)
    } else {
      localStorage.removeItem(STORAGE_KEY)
      setStylistNameState(null)
    }
  }

  return (
    <ProfileContext.Provider
      value={{ stylistName, setStylistName, hasProfile: !!stylistName }}
    >
      {children}
    </ProfileContext.Provider>
  )
}

export function useProfile() {
  const ctx = useContext(ProfileContext)
  if (!ctx) throw new Error('useProfile must be used inside ProfileProvider')
  return ctx
}
