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

  return `You are a quality control inspector for Regirl, a wig manufacturing brand.
Your job is to compare a submitted wig photo to approved reference images and decide whether the submission matches the reference closely enough to pass — not whether the wig is perfect in absolute terms.

STYLE: ${styleName}
CAPTURE ANGLE: ${angle.angleKey} — ${angle.angleLabel}

STYLE NUANCE CONTEXT:
${styleNuanceContext}

REFERENCE NOTES:
${annotationBlock}
${
  hasProportionalOrPositional
    ? `
For PROPORTIONAL and POSITIONAL evaluations: a vertical ruler is visible in both the reference and submission images. Use the ruler as a scale reference to compare measurements between reference and submission.
`
    : ''
}
IMAGES: You are given ${angle.referenceImagesBase64.length} reference image${angle.referenceImagesBase64.length === 1 ? '' : 's'} followed by 1 submission image (the last image).

YOUR TASK — COMPARISON, NOT PERFECTION:
The reference images are approved passing examples. A submission PASSES when it looks like the reference on a given criterion. A submission FAILS only when it is visibly and clearly worse than the reference on that specific criterion.

Do NOT apply your own standard of quality. Do NOT fail something because it could theoretically be better. The question for every criterion is: "Does the submission look like the reference on this?"

Step-by-step for each criterion:
1. Look at the reference image(s) for this criterion.
2. Look at the submission image for the same criterion.
3. Ask: Is there a clear, visible difference between them that makes the submission worse?
   - YES and you can describe exactly what you see → FAIL (HIGH or MEDIUM confidence)
   - NO or you cannot clearly see a difference → PASS

CONFIDENCE:
- HIGH: you can point to a specific, unambiguous defect visible in the submission that is absent in the reference. State exactly what and where.
- MEDIUM: you see a likely issue but lighting or angle limits certainty.
- LOW: you cannot clearly assess this criterion from these images. Result MUST be PASS.
- NEVER return FAIL with LOW confidence — if you cannot clearly see it, it is not a defect.
- Dark fibers (dark wigs) absorb light and hide detail. Do not claim HIGH confidence on dark-fiber wigs unless the defect is unmistakably visible despite the color.

IMPORTANT:
- Do NOT evaluate based on hair colour — colour variations are expected and intentional.
- Return ONLY a valid JSON array. No explanation, no markdown, no text outside the JSON.

Criteria to evaluate:
${criteriaJson}

For each criterion return a JSON object with exactly these fields:
{
  "criterion_key": string,
  "result": "PASS" | "FAIL",
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "failure_reason": null | "plain-English description of the specific, observable deviation — must reference what you can see, not what you assume",
  "failure_location": null | "front" | "back" | "ends" | "lace" | "crown" | "left-side" | "right-side",
  "severity": null | "MAJOR" | "MINOR",
  "rework_instruction": null | "2-3 sentence plain-English instruction to the stylist describing exactly what to fix and how"
}

Rules:
- severity must be null when result is PASS
- failure_reason, failure_location and rework_instruction must be null when result is PASS
- severity must match the criterion's severity_if_failed when result is FAIL
- failure_location must identify where on the wig the issue was found when result is FAIL
- rework_instruction must reference the specific capture angle (${angle.angleLabel})
- NEVER return result "FAIL" with confidence "LOW" — if confidence is LOW, result must be "PASS"`;
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
  // Accept a single object as well as an array — the model occasionally returns one object.
  const items = Array.isArray(parsed) ? parsed : [parsed];
  // Parse each item independently so one malformed criterion does not discard
  // the whole angle's evaluation. Invalid items are skipped and logged.
  const results: CriterionResponse[] = [];
  for (const item of items) {
    const parsedItem = CriterionResponseSchema.safeParse(item);
    if (parsedItem.success) {
      results.push(parsedItem.data);
    } else {
      console.warn(
        `[ai] skipping malformed criterion response: ${JSON.stringify(item)?.slice(0, 200)}`
      );
    }
  }
  return results;
}

function mapCriterionResponse(r: CriterionResponse): EvaluationCriterionResult {
  // Enforce: LOW confidence must always be PASS regardless of what the model returned
  const verdict = r.confidence === 'LOW' ? 'PASS' : r.result;
  const isFail = verdict === 'FAIL';
  return {
    criterionKey: r.criterion_key,
    verdict,
    confidence: r.confidence,
    severity: isFail ? ((r.severity?.toLowerCase() ?? 'minor') as Severity) : null,
    failureReason: isFail ? r.failure_reason : null,
    failureLocation: isFail ? (r.failure_location ?? null) : null,
    reworkInstruction: isFail ? r.rework_instruction : null
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
        temperature: 0,
        messages: [
          {
            role: 'user',
            content: [{ type: 'text', text: prompt }, ...imageContent]
          }
        ]
      });

      const responseText = response.choices[0]?.message?.content ?? '[]';
      console.log(`[ai/openai] angle=${angle.angleKey} refImages=${angle.referenceImagesBase64.length} rawResponse=${responseText.slice(0, 1200)}`);

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
