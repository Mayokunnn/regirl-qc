// =============================================================================
// API LAYER — all backend/AI calls go here.
// Currently returns mock data. Wire up real endpoints by replacing these
// function bodies without touching any component code.
// =============================================================================

import { MOCK_QC_RESULT, MOCK_HISTORY } from './mockData'

// Simulate network latency
const delay = (ms) => new Promise((res) => setTimeout(res, ms))

/**
 * Submit a QC session with photos and session details.
 * Returns AI analysis result with verdict and per-criterion results.
 *
 * @param {Object} session - { skuId, skuLabel, stylistName, wigId, photos }
 * @returns {Promise<Object>} QC result
 */
export async function submitQCSession(session) {
  await delay(2200) // simulate AI processing time
  return {
    ...MOCK_QC_RESULT,
    sessionId: `session-${Date.now()}`,
    timestamp: new Date().toISOString(),
    sku: session.skuLabel,
    skuId: session.skuId,
    stylistName: session.stylistName,
    wigId: session.wigId,
  }
}

/**
 * Fetch QC session history between two dates.
 *
 * @param {Date} from - start date (inclusive)
 * @param {Date} to   - end date (inclusive)
 * @returns {Promise<Array>} array of session history entries
 */
export async function fetchHistory(from, to) {
  await delay(400)
  const fromMs = from.getTime()
  const toMs = to.getTime() + 1000 * 60 * 60 * 24 // inclusive of end day
  return MOCK_HISTORY.filter((entry) => {
    const t = new Date(entry.timestamp).getTime()
    return t >= fromMs && t <= toMs
  }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
}
