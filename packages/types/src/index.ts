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
  UNCERTAIN = 'uncertain'
}

export enum Severity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high'
}

export interface EvaluationCriterionResult {
  criterionKey: string;
  verdict: Verdict;
  confidence: number;
  severity: Severity;
  message: string;
}

export interface SessionEvaluationResult {
  verdict: Verdict;
  confidence: number;
  criteria: EvaluationCriterionResult[];
  reworkInstructions: string;
  promptVersion: string;
  referenceSetVersion: string;
  provider: string;
  fallbackUsed: boolean;
}

export interface AnglePayload {
  angleKey: string;
  imageObjectKey: string;
  skuCode: string;
  stylistName: string;
  criteriaKeys: string[];
  seedHint: string;
}

export interface SessionPayload {
  sessionId: string;
  skuCode: string;
  styleName: string;
  stylistName: string;
  angles: Array<{ angleKey: string; imageObjectKey: string }>;
  criteriaKeys: string[];
  referenceSetVersion: string;
  promptVersion: string;
}
