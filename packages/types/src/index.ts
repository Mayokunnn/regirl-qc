export enum UserRole {
  SUPERVISOR = 'supervisor',
  ADMIN = 'admin'
}

export enum SessionStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export enum Verdict {
  PASS = 'pass',
  FAIL = 'fail',
  ADVISORY = 'advisory',
  NEEDS_REVIEW = 'needs_review'
}

export enum Severity {
  MAJOR = 'major',
  MINOR = 'minor'
}

export enum EvaluationType {
  CONFORMITY = 'conformity',
  PROPORTIONAL = 'proportional',
  POSITIONAL = 'positional',
  SURFACE = 'surface'
}

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export interface CriterionPayload {
  key: string;
  label: string;
  description: string;
  acceptableStandard: string;
  severityIfFailed: Severity;
  evaluationType: EvaluationType;
  /**
   * Few-shot learning: human-reviewed corrections of past AI verdicts for this
   * criterion on this style. Injected into the prompt so the model avoids
   * repeating mistakes. Undefined/empty when there is no correction history.
   */
  correctionNotes?: string;
}

export interface AnglePayload {
  angleKey: string;
  angleLabel: string;
  supervisorInstruction: string;
  /** Base64-encoded JPEG of the supervisor's submission photo */
  submissionImageBase64: string;
  /** Base64-encoded JPEGs of the reference images for this angle */
  referenceImagesBase64: string[];
  /** Admin-entered annotation notes — one per reference image */
  referenceAnnotationNotes: string[];
  /** Criteria that apply to this angle */
  criteria: CriterionPayload[];
}

export interface SessionPayload {
  sessionId: string;
  skuCode: string;
  styleName: string;
  styleNuanceContext: string;
  stylistName: string;
  wigId: string;
  angles: AnglePayload[];
  referenceSetVersion: number;
  promptVersion: string;
}

export interface EvaluationCriterionResult {
  criterionKey: string;
  /** PASS or FAIL — session-level ADVISORY/NEEDS_REVIEW is derived by the worker */
  verdict: 'PASS' | 'FAIL';
  confidence: ConfidenceLevel;
  /** null when verdict is PASS */
  severity: Severity | null;
  failureReason: string | null;
  failureLocation: string | null;
  reworkInstruction: string | null;
}

export interface SessionEvaluationResult {
  verdict: Verdict;
  criteria: EvaluationCriterionResult[];
  /** Human-readable summary of all rework actions needed */
  reworkInstructions: string;
  promptVersion: string;
  referenceSetVersion: number;
  provider: string;
  fallbackUsed: boolean;
}
