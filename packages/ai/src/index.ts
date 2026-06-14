import { readFile } from 'node:fs/promises';
import { GoogleGenerativeAI, Part } from '@google/generative-ai';
import OpenAI from 'openai';
import { z } from 'zod';
import { getEnv } from '@regirl/config';
import {
  AnglePayload,
  ConfidenceLevel,
  EvaluationCriterionResult,
  EvaluationType,
  SessionEvaluationResult,
  SessionPayload,
  Severity,
  Verdict
} from '@regirl/types';
import { seededFloat } from '@regirl/utils';

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export interface VisionEvaluator {
  readonly providerName: string;
  evaluateSession(payload: SessionPayload): Promise<SessionEvaluationResult>;
}

// ---------------------------------------------------------------------------
// Verdict derivation (PRD §8.4)
// ---------------------------------------------------------------------------

function deriveSessionVerdict(criteria: EvaluationCriterionResult[]): Verdict {
  const hasMajorFail = criteria.some((c) => c.verdict === 'FAIL' && c.severity === Severity.MAJOR);
  if (hasMajorFail) return Verdict.FAIL;

  const hasLowConfidence = criteria.some((c) => c.confidence === 'LOW');
  if (hasLowConfidence) return Verdict.NEEDS_REVIEW;

  const hasMinorFail = criteria.some((c) => c.verdict === 'FAIL' && c.severity === Severity.MINOR);
  if (hasMinorFail) return Verdict.ADVISORY;

  return Verdict.PASS;
}

/**
 * When the same criterion is evaluated across multiple angles, keep only the
 * worst result per criterion key (FAIL beats PASS; among FAILs, prefer the
 * one that has a failure reason attached).
 */
function deduplicateCriteria(criteria: EvaluationCriterionResult[]): EvaluationCriterionResult[] {
  const map = new Map<string, EvaluationCriterionResult>();
  for (const r of criteria) {
    const existing = map.get(r.criterionKey);
    if (!existing) {
      map.set(r.criterionKey, r);
      continue;
    }
    // FAIL beats PASS
    if (existing.verdict === 'PASS' && r.verdict === 'FAIL') {
      map.set(r.criterionKey, r);
      continue;
    }
    // Among two FAILs, prefer the one with a failure reason
    if (existing.verdict === 'FAIL' && r.verdict === 'FAIL' && !existing.failureReason && r.failureReason) {
      map.set(r.criterionKey, r);
    }
  }
  return Array.from(map.values());
}

function buildReworkSummary(criteria: EvaluationCriterionResult[]): string {
  const failures = criteria.filter((c) => c.verdict === 'FAIL');
  if (failures.length === 0) return 'No rework required. All criteria passed.';
  const lines = failures
    .map((c) => `[${c.severity?.toUpperCase() ?? 'MINOR'}] ${c.criterionKey}: ${c.reworkInstruction ?? c.failureReason ?? 'Inspect and correct.'}`)
    .join('\n');
  return `${failures.length} criterion/criteria require rework:\n${lines}`;
}

function confidenceToFloat(level: ConfidenceLevel): number {
  if (level === 'HIGH') return 0.9;
  if (level === 'MEDIUM') return 0.7;
  return 0.3;
}

function averageConfidence(criteria: EvaluationCriterionResult[]): number {
  if (criteria.length === 0) return 0.5;
  return criteria.reduce((sum, c) => sum + confidenceToFloat(c.confidence), 0) / criteria.length;
}

// ---------------------------------------------------------------------------
// Prompt builder (PRD §8.3)
// ---------------------------------------------------------------------------

function buildAnglePrompt(styleName: string, styleNuanceContext: string, angle: AnglePayload): string {
  const hasProportionalOrPositional = angle.criteria.some(
    (c) => c.evaluationType === EvaluationType.PROPORTIONAL || c.evaluationType === EvaluationType.POSITIONAL
  );

  const criteriaJson = JSON.stringify(
    angle.criteria.map((c) => ({
      criterion_key: c.key,
      criterion_name: c.label,
      description: c.description,
      acceptable_standard: c.acceptableStandard,
      severity_if_failed: c.severityIfFailed.toUpperCase(),
      evaluation_type: c.evaluationType.toUpperCase()
    })),
    null,
    2
  );

  const annotationBlock =
    angle.referenceAnnotationNotes.length > 0
      ? angle.referenceAnnotationNotes.map((n, i) => `Reference image ${i + 1}: ${n}`).join('\n')
      : 'No ruler annotations provided — assess proportionally against reference images.';

  return `You are a quality control evaluator for Regirl, a wig manufacturing brand.
You are evaluating a submitted wig photo against reference images for the ${styleName} style.

STYLE NUANCE CONTEXT:
${styleNuanceContext}

CAPTURE ANGLE: ${angle.angleKey} — ${angle.angleLabel}

REFERENCE NOTES:
${annotationBlock}
${
  hasProportionalOrPositional
    ? `
For PROPORTIONAL and POSITIONAL evaluations: a vertical ruler is visible in both the reference and submission images. Use the ruler graduations as a scale reference when assessing whether measurements are consistent with the reference.
`
    : ''
}
The images provided are: first the reference images (${angle.referenceImagesBase64.length} images), then the submission image (1 image, last in the list).

Evaluate the submission image against each criterion listed below, comparing it to the reference images.

IMPORTANT:
- Do NOT evaluate based on hair colour — colour variations are expected and intentional. Evaluate style, structure, and texture only.
- If the image quality or lighting makes a criterion impossible to assess reliably, return LOW confidence for that criterion.
- Return ONLY a valid JSON array. No explanation, no markdown, no text outside the JSON.

Criteria to evaluate:
${criteriaJson}

For each criterion return a JSON object with exactly these fields:
{
  "criterion_key": string,
  "result": "PASS" | "FAIL",
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "failure_reason": null | "plain-English description of the specific deviation observed",
  "failure_location": null | "front" | "back" | "ends" | "lace" | "crown" | "left-side" | "right-side",
  "severity": null | "MAJOR" | "MINOR",
  "rework_instruction": null | "2-3 sentence plain-English instruction to the stylist describing exactly what to fix and how"
}

Rules:
- severity must be null when result is PASS
- failure_reason, failure_location and rework_instruction must be null when result is PASS
- severity must match the criterion's severity_if_failed when result is FAIL
- failure_location must identify where on the wig the issue was found when result is FAIL
- rework_instruction must reference the specific capture angle (${angle.angleLabel})`;
}

// ---------------------------------------------------------------------------
// Image fetcher — handles file:// and https:// URLs
// ---------------------------------------------------------------------------

async function fetchImageBase64(source: string): Promise<string> {
  if (source.startsWith('data:')) {
    // Already a data URL — strip the prefix
    return source.split(',')[1] ?? source;
  }
  if (source.startsWith('file://')) {
    const data = await readFile(source.replace('file://', ''));
    return data.toString('base64');
  }
  const res = await fetch(source);
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status} ${source}`);
  const buf = await res.arrayBuffer();
  return Buffer.from(buf).toString('base64');
}

// ---------------------------------------------------------------------------
// Gemini response parser
// ---------------------------------------------------------------------------

const CriterionResponseSchema = z.object({
  criterion_key: z.string(),
  result: z.enum(['PASS', 'FAIL']),
  confidence: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  failure_reason: z.string().nullable(),
  failure_location: z.string().nullable(),
  severity: z.enum(['MAJOR', 'MINOR']).nullable(),
  rework_instruction: z.string().nullable()
});

type CriterionResponse = z.infer<typeof CriterionResponseSchema>;

function parseAiResponse(raw: string): CriterionResponse[] {
  // Strip markdown code fences if present
  const cleaned = raw
    .replace(/^```(?:json)?\s*/im, '')
    .replace(/\s*```\s*$/im, '')
    .trim();
  const parsed = JSON.parse(cleaned);
  if (!Array.isArray(parsed)) throw new Error('AI response is not an array');
  return parsed.map((item) => CriterionResponseSchema.parse(item));
}

function mapCriterionResponse(r: CriterionResponse): EvaluationCriterionResult {
  return {
    criterionKey: r.criterion_key,
    verdict: r.result,
    confidence: r.confidence,
    severity: r.result === 'FAIL' ? ((r.severity?.toLowerCase() ?? 'minor') as Severity) : null,
    failureReason: r.failure_reason,
    failureLocation: r.failure_location ?? null,
    reworkInstruction: r.rework_instruction
  };
}

// ---------------------------------------------------------------------------
// Gemini evaluator
// ---------------------------------------------------------------------------

class GeminiVisionEvaluator implements VisionEvaluator {
  readonly providerName = 'gemini';
  private readonly client: GoogleGenerativeAI;
  private readonly model: string;

  constructor(apiKey: string) {
    this.client = new GoogleGenerativeAI(apiKey);
    this.model = 'gemini-2.0-flash';
  }

  async evaluateSession(payload: SessionPayload): Promise<SessionEvaluationResult> {
    const model = this.client.getGenerativeModel({ model: this.model });
    const allCriteria: EvaluationCriterionResult[] = [];

    for (const angle of payload.angles) {
      const prompt = buildAnglePrompt(payload.styleName, payload.styleNuanceContext, angle);

      // Build parts: reference images first, then submission image
      const imageParts: Part[] = [];
      for (const b64 of angle.referenceImagesBase64) {
        const data = await fetchImageBase64(b64);
        imageParts.push({ inlineData: { data, mimeType: 'image/jpeg' } });
      }
      const submissionData = await fetchImageBase64(angle.submissionImageBase64);
      imageParts.push({ inlineData: { data: submissionData, mimeType: 'image/jpeg' } });

      const result = await model.generateContent([prompt, ...imageParts]);
      const responseText = result.response.text();

      try {
        const parsed = parseAiResponse(responseText);
        allCriteria.push(...parsed.map(mapCriterionResponse));
      } catch {
        // If parsing fails for an angle, mark all its criteria as LOW confidence PASS
        for (const c of angle.criteria) {
          allCriteria.push({
            criterionKey: c.key,
            verdict: 'PASS',
            confidence: 'LOW',
            severity: null,
            failureReason: null,
            failureLocation: null,
            reworkInstruction: null
          });
        }
      }
    }

    const finalCriteria = deduplicateCriteria(allCriteria);
    const verdict = deriveSessionVerdict(finalCriteria);
    return {
      verdict,
      criteria: finalCriteria,
      reworkInstructions: buildReworkSummary(finalCriteria),
      promptVersion: payload.promptVersion,
      referenceSetVersion: payload.referenceSetVersion,
      provider: this.providerName,
      fallbackUsed: false
    };
  }
}

// ---------------------------------------------------------------------------
// OpenAI evaluator (fallback for LOW-confidence criteria)
// ---------------------------------------------------------------------------

class OpenAIVisionEvaluator implements VisionEvaluator {
  readonly providerName = 'openai';
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
    this.model = 'gpt-4o';
  }

  async evaluateSession(payload: SessionPayload): Promise<SessionEvaluationResult> {
    const allCriteria: EvaluationCriterionResult[] = [];

    for (const angle of payload.angles) {
      const prompt = buildAnglePrompt(payload.styleName, payload.styleNuanceContext, angle);

      const imageContent: OpenAI.Chat.ChatCompletionContentPart[] = [];

      for (const b64 of angle.referenceImagesBase64) {
        const data = await fetchImageBase64(b64);
        imageContent.push({
          type: 'image_url',
          image_url: { url: `data:image/jpeg;base64,${data}`, detail: 'high' }
        });
      }
      const submissionData = await fetchImageBase64(angle.submissionImageBase64);
      imageContent.push({
        type: 'image_url',
        image_url: { url: `data:image/jpeg;base64,${submissionData}`, detail: 'high' }
      });

      const response = await this.client.chat.completions.create({
        model: this.model,
        max_tokens: 2048,
        messages: [
          {
            role: 'user',
            content: [{ type: 'text', text: prompt }, ...imageContent]
          }
        ]
      });

      const responseText = response.choices[0]?.message?.content ?? '[]';

      try {
        const parsed = parseAiResponse(responseText);
        allCriteria.push(...parsed.map(mapCriterionResponse));
      } catch {
        for (const c of angle.criteria) {
          allCriteria.push({
            criterionKey: c.key,
            verdict: 'PASS',
            confidence: 'LOW',
            severity: null,
            failureReason: null,
            failureLocation: null,
            reworkInstruction: null
          });
        }
      }
    }

    const finalCriteria = deduplicateCriteria(allCriteria);
    const verdict = deriveSessionVerdict(finalCriteria);
    return {
      verdict,
      criteria: finalCriteria,
      reworkInstructions: buildReworkSummary(finalCriteria),
      promptVersion: payload.promptVersion,
      referenceSetVersion: payload.referenceSetVersion,
      provider: this.providerName,
      fallbackUsed: false
    };
  }
}

// ---------------------------------------------------------------------------
// Mock evaluator — deterministic seeded results, no external calls
// ---------------------------------------------------------------------------

class MockVisionEvaluator implements VisionEvaluator {
  readonly providerName = 'mock';

  constructor(private readonly seedPrefix: string) {}

  async evaluateSession(payload: SessionPayload): Promise<SessionEvaluationResult> {
    const allCriteria: EvaluationCriterionResult[] = [];

    for (const angle of payload.angles) {
      for (const criterion of angle.criteria) {
        const noise = seededFloat(`${this.seedPrefix}:${payload.sessionId}:${angle.angleKey}:${criterion.key}`);
        const isFail = noise > 0.62;
        const confidence: ConfidenceLevel = noise > 0.85 ? 'LOW' : noise > 0.72 ? 'MEDIUM' : 'HIGH';

        if (isFail) {
          allCriteria.push({
            criterionKey: criterion.key,
            verdict: 'FAIL',
            confidence,
            severity: criterion.severityIfFailed,
            failureReason: `${criterion.label} deviates from the reference at ${angle.angleLabel}. Mock evaluation detected a discrepancy.`,
            failureLocation: null,
            reworkInstruction: `Correct ${criterion.label.toLowerCase()} to match the reference images for the ${angle.angleLabel} angle, then resubmit.`
          });
        } else {
          allCriteria.push({
            criterionKey: criterion.key,
            verdict: 'PASS',
            confidence,
            severity: null,
            failureReason: null,
            failureLocation: null,
            reworkInstruction: null
          });
        }
      }
    }

    // Deduplicate: if same criterionKey appears in multiple angles, keep the worst result
    const deduped = new Map<string, EvaluationCriterionResult>();
    for (const r of allCriteria) {
      const existing = deduped.get(r.criterionKey);
      if (!existing || (existing.verdict === 'PASS' && r.verdict === 'FAIL')) {
        deduped.set(r.criterionKey, r);
      }
    }
    const finalCriteria = Array.from(deduped.values());

    const verdict = deriveSessionVerdict(finalCriteria);
    return {
      verdict,
      criteria: finalCriteria,
      reworkInstructions: buildReworkSummary(finalCriteria),
      promptVersion: payload.promptVersion,
      referenceSetVersion: payload.referenceSetVersion,
      provider: this.providerName,
      fallbackUsed: false
    };
  }
}

// ---------------------------------------------------------------------------
// Evaluator factory
// ---------------------------------------------------------------------------

export const buildEvaluators = () => {
  const env = getEnv();
  const mock = new MockVisionEvaluator(env.AI_MOCK_SEED);
  const gemini = env.GEMINI_API_KEY ? new GeminiVisionEvaluator(env.GEMINI_API_KEY) : null;
  const openai = env.OPENAI_API_KEY ? new OpenAIVisionEvaluator(env.OPENAI_API_KEY) : null;
  return { mock, gemini, openai };
};

export const pickEvaluator = (): VisionEvaluator => {
  const env = getEnv();
  const { mock, gemini, openai } = buildEvaluators();

  if (env.AI_PROVIDER === 'mock') return mock;
  if (env.AI_PROVIDER === 'gemini') return gemini ?? mock;
  if (env.AI_PROVIDER === 'openai') return openai ?? mock;

  // auto: prefer gemini, then openai, then mock
  return gemini ?? openai ?? mock;
};

/**
 * Returns a fallback evaluator for re-evaluating LOW-confidence criteria.
 * Per PRD: GPT-4o is used as fallback when Gemini returns LOW confidence.
 * Returns null if no suitable fallback exists.
 */
export const pickFallbackEvaluator = (primaryName: string): VisionEvaluator | null => {
  const { mock, gemini, openai } = buildEvaluators();

  if (primaryName === 'gemini') return openai ?? mock;
  if (primaryName === 'openai') return gemini ?? mock;
  return null; // mock has no fallback
};

// Re-export helpers for the worker
export { deriveSessionVerdict, averageConfidence, confidenceToFloat };
