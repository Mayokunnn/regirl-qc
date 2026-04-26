// =============================================================================
// MOCK DATA — swap these out when the real backend is ready
// =============================================================================

export const SKUS = [
  { id: 'soft-siren-natural', label: 'Soft Siren — Natural Color with Dark Cherry Tones' },
  { id: 'soft-siren-dark-cherry', label: 'Soft Siren — Dark Cherry' },
]

export const CAPTURE_ANGLES = [
  {
    id: 'front-full',
    label: 'Front Full',
    instruction: 'Stand directly in front — full wig crown to hem visible, ruler visible on one side',
  },
  {
    id: 'left-profile',
    label: 'Left Profile',
    instruction: 'Stand directly to the left — full side profile visible, ruler visible',
  },
  {
    id: 'right-profile',
    label: 'Right Profile',
    instruction: 'Stand directly to the right — full side profile visible, ruler visible',
  },
  {
    id: 'back-full',
    label: 'Back Full',
    instruction: 'Stand directly behind — full back view visible, ruler visible',
  },
  {
    id: 'top-down',
    label: 'Top Down',
    instruction: 'Hold phone above mannequin head angled downward',
  },
  {
    id: 'closeup-lace',
    label: 'Close-up Lace',
    instruction: 'Camera 15–20cm from T-closure lace area',
  },
  {
    id: 'closeup-ends',
    label: 'Close-up Ends',
    instruction: 'Camera 15–20cm from the ends of the hair',
  },
]

export const QUALITY_CRITERIA = [
  { id: 'overall-length', label: 'Overall Length' },
  { id: 'layer-graduation', label: 'Layer Graduation' },
  { id: 'end-finish', label: 'End Finish' },
  { id: 'texture-consistency', label: 'Texture Consistency' },
  { id: 'volume-body', label: 'Volume and Body' },
  { id: 'left-right-symmetry', label: 'Left-Right Symmetry' },
  { id: 't-closure-lace', label: 'T-Closure Lace Condition' },
  { id: 'parting-cleanliness', label: 'Parting Cleanliness' },
  { id: 'surface-sheen', label: 'Surface Sheen' },
  { id: 'frizz-flyaways', label: 'Frizz and Flyaways' },
  { id: 'weft-track-visibility', label: 'Weft/Track Visibility' },
  { id: 'back-hemline', label: 'Back Hemline Evenness' },
]

export const DAILY_CHECKLIST_ITEMS = [
  'Mannequin head is on the stand at the taped floor position',
  'White/grey backdrop is in place behind the mannequin, clean and wrinkle-free',
  'Vertical ruler is positioned beside the mannequin, graduation marks visible',
  'Ring light is on and positioned at face height, approximately 60cm from mannequin',
  'No windows or bright light sources are behind the mannequin',
  'All six floor position tape markers for supervisor standing positions are visible',
  'Phone camera is clean — wipe lens before starting',
]

// Mock QC result returned by the AI for a session
export const MOCK_QC_RESULT = {
  verdict: 'FAIL',
  criteria: [
    {
      id: 'overall-length',
      label: 'Overall Length',
      status: 'PASS',
      confidence: 'HIGH',
      severity: null,
      failureReason: null,
      reworkInstructions: null,
      captureAngle: 'Front Full',
    },
    {
      id: 'layer-graduation',
      label: 'Layer Graduation',
      status: 'PASS',
      confidence: 'HIGH',
      severity: null,
      failureReason: null,
      reworkInstructions: null,
      captureAngle: 'Left Profile',
    },
    {
      id: 'end-finish',
      label: 'End Finish',
      status: 'FAIL',
      confidence: 'HIGH',
      severity: 'MAJOR',
      failureReason:
        'Hair ends are visibly blunt and uneven with multiple split ends detected along the bottom 3cm. The finishing cut shows inconsistent angles across left and right sides.',
      reworkInstructions:
        'Using sharp cutting shears, point-cut the ends at a consistent downward angle across the full width of the wig. Remove approximately 0.5–1cm of material to clear the split ends. Re-check symmetry against the reference image before resubmitting.',
      captureAngle: 'Close-up Ends',
    },
    {
      id: 'texture-consistency',
      label: 'Texture Consistency',
      status: 'PASS',
      confidence: 'MEDIUM',
      severity: null,
      failureReason: null,
      reworkInstructions: null,
      captureAngle: 'Front Full',
    },
    {
      id: 'volume-body',
      label: 'Volume and Body',
      status: 'PASS',
      confidence: 'HIGH',
      severity: null,
      failureReason: null,
      reworkInstructions: null,
      captureAngle: 'Front Full',
    },
    {
      id: 'left-right-symmetry',
      label: 'Left-Right Symmetry',
      status: 'FAIL',
      confidence: 'HIGH',
      severity: 'MAJOR',
      failureReason:
        'The left side of the wig sits approximately 2cm lower than the right side when measured from the crown. This asymmetry is clearly visible in both the Front Full and Back Full captures.',
      reworkInstructions:
        'Place the wig back on the mannequin and re-pin both sides at the temple area to match the reference measurements. Trim the left side to align with the right side length, using the ruler as a guide. Compare front and back captures before resubmitting.',
      captureAngle: 'Front Full',
    },
    {
      id: 't-closure-lace',
      label: 'T-Closure Lace Condition',
      status: 'PASS',
      confidence: 'HIGH',
      severity: null,
      failureReason: null,
      reworkInstructions: null,
      captureAngle: 'Close-up Lace',
    },
    {
      id: 'parting-cleanliness',
      label: 'Parting Cleanliness',
      status: 'PASS',
      confidence: 'MEDIUM',
      severity: null,
      failureReason: null,
      reworkInstructions: null,
      captureAngle: 'Top Down',
    },
    {
      id: 'surface-sheen',
      label: 'Surface Sheen',
      status: 'PASS',
      confidence: 'HIGH',
      severity: null,
      failureReason: null,
      reworkInstructions: null,
      captureAngle: 'Front Full',
    },
    {
      id: 'frizz-flyaways',
      label: 'Frizz and Flyaways',
      status: 'FAIL',
      confidence: 'MEDIUM',
      severity: 'MINOR',
      failureReason:
        'Moderate flyaways detected along the crown area, concentrated around the parting line. Frizz is within borderline tolerance but below the reference standard for this SKU.',
      reworkInstructions:
        'Apply a small amount of anti-frizz serum to the crown area using a fine-tooth comb. Smooth downward from root to tip, then allow to dry fully before re-photographing. A light flat-iron pass on the top layer may be used if serum alone is insufficient.',
      captureAngle: 'Top Down',
    },
    {
      id: 'weft-track-visibility',
      label: 'Weft/Track Visibility',
      status: 'PASS',
      confidence: 'HIGH',
      severity: null,
      failureReason: null,
      reworkInstructions: null,
      captureAngle: 'Back Full',
    },
    {
      id: 'back-hemline',
      label: 'Back Hemline Evenness',
      status: 'PASS',
      confidence: 'HIGH',
      severity: null,
      failureReason: null,
      reworkInstructions: null,
      captureAngle: 'Back Full',
    },
  ],
}

// Mock history entries
export const MOCK_HISTORY = [
  {
    id: 'h-001',
    timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 min ago
    sku: 'Soft Siren — Dark Cherry',
    skuId: 'soft-siren-dark-cherry',
    stylistName: 'Maria Santos',
    wigId: 'WIG-20240328-001',
    verdict: 'FAIL',
    photos: {
      'front-full': null,
      'left-profile': null,
      'right-profile': null,
      'back-full': null,
      'top-down': null,
      'closeup-lace': null,
      'closeup-ends': null,
    },
    criteria: MOCK_QC_RESULT.criteria,
  },
  {
    id: 'h-002',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(), // 3 hours ago
    sku: 'Soft Siren — Natural Color with Dark Cherry Tones',
    skuId: 'soft-siren-natural',
    stylistName: 'Aisha Okonkwo',
    wigId: 'WIG-20240328-002',
    verdict: 'PASS',
    photos: {},
    criteria: MOCK_QC_RESULT.criteria.map((c) => ({
      ...c,
      status: 'PASS',
      severity: null,
      failureReason: null,
      reworkInstructions: null,
    })),
  },
  {
    id: 'h-003',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(), // yesterday
    sku: 'Soft Siren — Dark Cherry',
    skuId: 'soft-siren-dark-cherry',
    stylistName: 'Maria Santos',
    wigId: 'WIG-20240327-005',
    verdict: 'ADVISORY',
    photos: {},
    criteria: MOCK_QC_RESULT.criteria.map((c, i) => ({
      ...c,
      status: i === 9 ? 'FAIL' : 'PASS',
      severity: i === 9 ? 'MINOR' : null,
      failureReason:
        i === 9
          ? 'Light flyaways detected along crown — within advisory threshold.'
          : null,
      reworkInstructions:
        i === 9
          ? 'Apply anti-frizz serum and re-photograph if possible before shipping.'
          : null,
    })),
  },
  {
    id: 'h-004',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(), // 2 days ago
    sku: 'Soft Siren — Natural Color with Dark Cherry Tones',
    skuId: 'soft-siren-natural',
    stylistName: 'Priya Nair',
    wigId: 'WIG-20240326-003',
    verdict: 'PASS',
    photos: {},
    criteria: MOCK_QC_RESULT.criteria.map((c) => ({
      ...c,
      status: 'PASS',
      severity: null,
      failureReason: null,
      reworkInstructions: null,
    })),
  },
  {
    id: 'h-005',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 50).toISOString(), // ~2 days ago
    sku: 'Soft Siren — Dark Cherry',
    skuId: 'soft-siren-dark-cherry',
    stylistName: 'Aisha Okonkwo',
    wigId: 'WIG-20240326-004',
    verdict: 'NEEDS REVIEW',
    photos: {},
    criteria: MOCK_QC_RESULT.criteria.map((c, i) => ({
      ...c,
      status: i === 2 ? 'FAIL' : 'PASS',
      confidence: i === 2 ? 'LOW' : c.confidence,
      severity: i === 2 ? 'MAJOR' : null,
      failureReason:
        i === 2
          ? 'Image quality too low to assess end finish definitively — manual review required.'
          : null,
      reworkInstructions: i === 2 ? 'Retake Close-up Ends photo in better lighting and resubmit.' : null,
    })),
  },
]
