// Auto-generates wig IDs in the form WIG-YYYYMMDD-NNN.
// The per-day counter lives in localStorage (key: wigCounter:<YYYYMMDD>) and
// resets each calendar day. Note: the counter is per-device, so the same wig ID
// could be issued on two devices on the same day.

function todayStamp(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

export function nextWigId() {
  const stamp = todayStamp()
  const key = `wigCounter:${stamp}`
  const current = parseInt(localStorage.getItem(key) ?? '0', 10) || 0
  const next = current + 1
  localStorage.setItem(key, String(next))
  return `WIG-${stamp}-${String(next).padStart(3, '0')}`
}
