import { getEnv } from '@regirl/config';
import {
  AnglePayload,
  SessionEvaluationResult,
  SessionPayload,
  Severity,
  Verdict
} from '@regirl/types';
import { seededFloat } from '@regirl/utils';

export interface VisionEvaluator {
  readonly providerName: string;
  evaluateAngle(payload: AnglePayload): Promise<{ verdict: Verdict; confidence: number }>;
  evaluateSession(payload: SessionPayload): Promise<SessionEvaluationResult>;
}

class MockVisionEvaluator implements VisionEvaluator {
  readonly providerName = 'mock';

  constructor(private readonly seedPrefix: string) {}

  async evaluateAngle(payload: AnglePayload) {
    const value = seededFloat(`${this.seedPrefix}:${payload.seedHint}:${payload.angleKey}`);
    if (value < 0.6) {
      return { verdict: Verdict.PASS, confidence: 0.72 + value * 0.2 };
    }
    if (value < 0.86) {
      return { verdict: Verdict.FAIL, confidence: 0.58 + value * 0.2 };
    }
    return { verdict: Verdict.UNCERTAIN, confidence: 0.35 + value * 0.2 };
  }

  async evaluateSession(payload: SessionPayload): Promise<SessionEvaluationResult> {
    const criteria = payload.criteriaKeys.map((criterionKey, idx) => {
      const noise = seededFloat(`${this.seedPrefix}:${payload.sessionId}:${criterionKey}:${idx}`);
      const verdict = noise < 0.63 ? Verdict.PASS : noise < 0.87 ? Verdict.FAIL : Verdict.UNCERTAIN;
      const severity = verdict === Verdict.FAIL ? (noise > 0.8 ? Severity.HIGH : Severity.MEDIUM) : Severity.LOW;
      return {
        criterionKey,
        verdict,
        confidence: verdict === Verdict.UNCERTAIN ? 0.45 : 0.64 + noise * 0.25,
        severity,
        message:
          verdict === Verdict.PASS
            ? `${criterionKey} looks acceptable against reference set.`
            : verdict === Verdict.FAIL
              ? `${criterionKey} needs correction for ${payload.styleName}.`
              : `${criterionKey} is inconclusive; request better lighting or angle.`
      };
    });

    const fails = criteria.filter((item) => item.verdict === Verdict.FAIL).length;
    const uncertain = criteria.filter((item) => item.verdict === Verdict.UNCERTAIN).length;

    const verdict = fails > 0 ? Verdict.FAIL : uncertain > 0 ? Verdict.UNCERTAIN : Verdict.PASS;
    const confidence = Math.max(
      0.4,
      criteria.reduce((acc, item) => acc + item.confidence, 0) / Math.max(criteria.length, 1)
    );

    const reworkInstructions =
      verdict === Verdict.PASS
        ? 'No rework required.'
        : verdict === Verdict.UNCERTAIN
          ? 'Retake images under neutral lighting and maintain all required angles.'
          : 'Fix stitching consistency and hem symmetry, then resubmit all required angles.';

    return {
      verdict,
      confidence,
      criteria,
      reworkInstructions,
      promptVersion: payload.promptVersion,
      referenceSetVersion: payload.referenceSetVersion,
      provider: this.providerName,
      fallbackUsed: false
    };
  }
}

class StubVisionEvaluator implements VisionEvaluator {
  constructor(readonly providerName: string) {}

  async evaluateAngle() {
    return { verdict: Verdict.UNCERTAIN, confidence: 0.2 };
  }

  async evaluateSession(payload: SessionPayload): Promise<SessionEvaluationResult> {
    return {
      verdict: Verdict.UNCERTAIN,
      confidence: 0.2,
      criteria: payload.criteriaKeys.map((criterionKey) => ({
        criterionKey,
        verdict: Verdict.UNCERTAIN,
        confidence: 0.2,
        severity: Severity.LOW,
        message: `${this.providerName} provider stub is not configured. Falling back advised.`
      })),
      reworkInstructions: `${this.providerName} is not configured. Use mock provider fallback.`,
      promptVersion: payload.promptVersion,
      referenceSetVersion: payload.referenceSetVersion,
      provider: this.providerName,
      fallbackUsed: false
    };
  }
}

export const buildEvaluators = () => {
  const env = getEnv();
  const mock = new MockVisionEvaluator(env.AI_MOCK_SEED);

  const gemini = env.GEMINI_API_KEY ? new StubVisionEvaluator('gemini') : null;
  const openai = env.OPENAI_API_KEY ? new StubVisionEvaluator('openai') : null;

  return { mock, gemini, openai };
};

export const pickEvaluator = () => {
  const env = getEnv();
  const { mock, gemini, openai } = buildEvaluators();

  if (env.AI_PROVIDER === 'mock') return mock;
  if (env.AI_PROVIDER === 'gemini') return gemini ?? mock;
  if (env.AI_PROVIDER === 'openai') return openai ?? mock;

  if (gemini) return gemini;
  if (openai) return openai;
  return mock;
};

export const pickFallbackEvaluator = (primaryName: string): VisionEvaluator | null => {
  const env = getEnv();
  const { mock, gemini, openai } = buildEvaluators();
  const fallback = env.AI_FALLBACK_PROVIDER;

  if (fallback === primaryName) {
    return null;
  }

  if (fallback === 'gemini') return gemini ?? mock;
  if (fallback === 'openai') return openai ?? mock;
  return mock;
};
