const BASE_URL = 'http://localhost:3000';

// Criterion key → display label (matches seed data)
const CRITERION_LABELS = {
  'overall-length': 'Overall Length',
  'layer-graduation': 'Layer Graduation',
  'end-finish': 'End Finish',
  'texture-consistency': 'Texture Consistency',
  'volume-body': 'Volume and Body',
  'left-right-symmetry': 'Left-Right Symmetry',
  't-closure-lace': 'T-Closure Lace Condition',
  'parting-cleanliness': 'Parting Cleanliness',
  'surface-sheen': 'Surface Sheen',
  'frizz-flyaways': 'Frizz and Flyaways',
  'weft-track-visibility': 'Weft/Track Visibility',
  'back-hemline-evenness': 'Back Hemline Evenness',
  'photo-validation': 'Photo Validation',
};

function getToken() {
  return localStorage.getItem('auth_token');
}

function getHeaders() {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function request(method, path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: getHeaders(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    localStorage.removeItem('auth_token');
    window.dispatchEvent(new Event('auth:logout'));
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }

  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export async function login(email, password) {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error('Invalid email or password');
  return res.json(); // { accessToken, user }
}

export async function fetchSkus() {
  const styles = await request('GET', '/styles');
  const groups = await Promise.all(
    styles.map((s) =>
      request('GET', `/styles/${s.id}/skus`).then((skus) =>
        skus.map((sku) => ({ ...sku, styleId: s.id, styleName: s.name }))
      )
    )
  );
  return groups.flat();
}

export async function createSession({ styleId, skuId, wigId, stylistName }) {
  return request('POST', '/sessions', { styleId, skuId, wigId, stylistName });
}

export async function uploadAngleFile(sessionId, angleKey, base64Data) {
  return request('POST', `/sessions/${sessionId}/angles/${angleKey}/upload-file`, {
    data: base64Data,
  });
}

export async function submitSession(sessionId) {
  return request('POST', `/sessions/${sessionId}/submit`);
}

export async function pollStatus(sessionId) {
  return request('GET', `/sessions/${sessionId}/status`);
}

export async function getSessionDetail(sessionId) {
  return request('GET', `/sessions/${sessionId}`);
}

export async function fetchHistory(from, to) {
  const fromStr = from.toISOString();
  const toStr = new Date(to.getTime() + 24 * 60 * 60 * 1000).toISOString();
  const data = await request('GET', `/sessions?from=${fromStr}&to=${toStr}&limit=100`);
  return data.items.map(mapHistoryItem);
}

// Maps a DB session (from GET /sessions or GET /sessions/:id) to the shape the UI expects
export function mapSessionResult(session) {
  const evaluation = session.evaluations?.[0] ?? null;
  if (!evaluation) return null;

  return {
    verdict: evaluation.overallVerdict.toUpperCase().replace('_', ' '),
    sku: session.sku?.name ?? '',
    skuId: session.skuId,
    stylistName: session.stylistName,
    wigId: session.wigId,
    timestamp: session.completedAt ?? session.updatedAt,
    criteria: evaluation.criteria.map((c) => ({
      id: c.id,
      criterionKey: c.criterionKey,
      label: CRITERION_LABELS[c.criterionKey] ?? c.criterionKey,
      status: c.verdict === 'pass' ? 'PASS' : 'FAIL',
      confidence: (c.confidence >= 0.8 ? 'HIGH' : c.confidence >= 0.5 ? 'MEDIUM' : 'LOW'),
      severity: c.severity ? c.severity.toUpperCase() : null,
      failureReason: c.failureReason ?? null,
      failureLocation: c.failureLocation ?? null,
      instructionRating: c.instructionRating ?? null,
      reworkInstructions: c.reworkInstruction ?? null,
      verdictRating: c.verdictRating ?? null,
      correctedVerdict: c.correctedVerdict ?? null,
      captureAngle: null,
    })),
  };
}

export async function fetchAngles(styleId) {
  return request('GET', `/styles/${styleId}/angles`);
}

export async function fetchReferenceSets() {
  return request('GET', '/admin/reference-sets');
}

export async function createReferenceSet({ styleId, version, promptVersion, description }) {
  return request('POST', '/admin/reference-sets', { styleId, version, promptVersion, description, images: [] });
}

export async function activateReferenceSet(referenceSetId) {
  return request('POST', `/admin/reference-sets/${referenceSetId}/activate`);
}

export async function fetchReferenceSetAngles(referenceSetId) {
  return request('GET', `/admin/reference-sets/${referenceSetId}/angles`);
}

export async function uploadReferenceImage(referenceSetId, angleKey, base64Data, annotationNote) {
  return request('POST', `/admin/reference-sets/${referenceSetId}/angles/${angleKey}/upload`, {
    data: base64Data,
    annotationNote: annotationNote || undefined,
  });
}

export async function rateCriterion(criterionResultId, rating) {
  return request('POST', `/sessions/criteria/${criterionResultId}/rate`, { rating });
}

// Supervisor rates whether the AI's verdict for a criterion was correct.
// rating: 'correct' | 'wrong'. correctedVerdict ('pass'|'fail') required when 'wrong'.
export async function rateCriterionVerdict(criterionResultId, rating, correctedVerdict) {
  return request('POST', `/sessions/criteria/${criterionResultId}/rate-verdict`, {
    rating,
    correctedVerdict,
  });
}

// Supervisor's overall agree/disagree on the session verdict.
export async function saveVerdictFeedback(sessionId, agreed, comment) {
  return request('POST', `/sessions/${sessionId}/verdict-feedback`, { agreed, comment });
}

export async function fetchSessionsForWig(wigId) {
  const data = await request('GET', `/sessions?limit=50`);
  return data.items.filter((s) => s.wigId === wigId && s.verdict);
}

function mapHistoryItem(item) {
  return {
    id: item.id,
    timestamp: item.completedAt ?? item.createdAt,
    sku: item.skuName,
    skuId: item.skuId,
    stylistName: item.stylistName,
    wigId: item.wigId,
    verdict: item.verdict ? item.verdict.toUpperCase().replace('_', ' ') : item.status.toUpperCase(),
    status: item.status,
    photos: {},
    criteria: [],
    apiSessionId: item.id,
  };
}
