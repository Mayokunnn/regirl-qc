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

export interface PhotoClassification {
  isWigPhoto: boolean;
  detectedAngle: string; // one of KNOWN_ANGLE_KEYS or 'UNKNOWN'
  description: string;
}

export interface PhotoIssue {
  angleKey: string;
  angleLabel: string;
  problem: string;
}

export interface VisionEvaluator {
  readonly providerName: string;
  evaluateSession(payload: SessionPayload): Promise<SessionEvaluationResult>;
  // Focused, single-image check: is this a wig and which angle? Optional so the
  // mock evaluator can skip it.
  classifyPhoto?(imageBase64: string): Promise<PhotoClassification>;
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

function buildAnglePrompt(
  styleName: string,
  styleNuanceContext: string,
  angle: AnglePayload,
  styleStrictnessNote = ''
): string {
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

  // Few-shot learning: human corrections of past verdicts for these criteria.
  const correctionEntries = angle.criteria
    .filter((c) => c.correctionNotes)
    .map((c) => `- ${c.label} (${c.key}): ${c.correctionNotes}`);
  const correctionBlock =
    correctionEntries.length > 0
      ? `
LEARNED FROM PAST HUMAN REVIEWS (apply these corrections — they come from supervisors who reviewed your previous verdicts on this exact style):
${correctionEntries.join('\n')}
`
      : '';

  const strictnessBlock = styleStrictnessNote
    ? `
CALIBRATION FROM SUPERVISORS (overall feedback on your past verdicts for this style — adjust your overall strictness accordingly):
${styleStrictnessNote}
`
    : '';

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

YOUR TASK — STRICT CONFORMITY TO THE REFERENCE STANDARD:
This is a rule-enforced visual conformity check, not a lenient pass-through. Every wig that ships must be visually indistinguishable from the approved reference for this style. Enforce the standard mechanically and remove tolerance creep — do NOT give the submission the benefit of the doubt.

THE GOLDEN RULE: every criterion is judged on its own. A good result on one criterion NEVER compensates for a deviation on another. If a criterion deviates from its acceptable standard, mark THAT criterion FAIL — regardless of how good everything else looks.

Each criterion below has an "acceptable_standard". A criterion PASSES only when the submission clearly meets that standard and matches the reference. If you can see the submission deviate from the standard, it FAILS. Judge against the reference standard, not against absolute perfection — but a real, visible deviation from the standard is a FAIL, not a PASS.

SEVERITY — do not decide the overall wig verdict; that is computed downstream from your per-criterion results. Your job is only to assign each criterion's result and its severity. When a criterion FAILS, its "severity" MUST equal that criterion's "severity_if_failed" exactly — never downgrade a MAJOR criterion to MINOR or upgrade a MINOR one. A MAJOR fail will fail the whole wig; a MINOR-only fail is advisory and may be overridden by a supervisor — so assign severity faithfully and do not soften a real MAJOR deviation just because it seems small.

GATING — CHECK THIS FIRST, BEFORE SCORING ANY CRITERION (never pass by default):
Confirm the submission is actually the correct, assessable photo for this capture angle (${angle.angleKey} — ${angle.angleLabel}):
- If the submission does NOT show this wig at the expected capture angle, shows the wrong view, shows something that is not this wig, or is framed so the region a criterion needs is not shown → you CANNOT confirm conformity. Do NOT return PASS. Return FAIL for criteria that plainly cannot be satisfied by this image (it is not the required shot), with a failure_reason that says exactly what is wrong with the photo.
- If the submission is simply too blurry, too dark, or too poorly lit to see the detail a criterion needs → return LOW confidence for that criterion (a human will review it). Not being able to see something is NOT the same as it being acceptable.

Step-by-step for each criterion:
1. Read the criterion's acceptable_standard and look at the reference image(s).
2. Look at the submission image for the same region.
3. Decide:
   - Submission clearly meets the standard and matches the reference → PASS (HIGH or MEDIUM confidence).
   - You can see a deviation from the standard, or the gating check above failed for this criterion → FAIL (HIGH or MEDIUM confidence). Describe exactly what you see and where.
   - You genuinely cannot see the detail well enough to judge (blur, darkness, framing) → LOW confidence.

CONFIDENCE:
- HIGH: you can clearly see the relevant area and judge it with certainty — whether PASS or FAIL.
- MEDIUM: you can see it but lighting or angle limits certainty.
- LOW: you cannot clearly assess this criterion. This routes the wig to a human reviewer — it is the correct response to bad lighting, blur, framing, or a missing view. When your confidence is LOW, set result to PASS so the system flags the session for human review; do NOT use FAIL to express uncertainty. NEVER return FAIL with LOW confidence — a FAIL means you can actually see the deviation.
- Dark fibers (dark wigs) absorb light and hide detail. On dark fiber, judge using sheen patterns, clear silhouette edges, and shadow depth. If those clues are not visible enough to judge, return LOW confidence rather than guessing — do NOT default to PASS.

IMPORTANT:
- Do NOT evaluate based on hair colour — colour variations are expected and intentional.
- Return ONLY a valid JSON array, one object per criterion. No explanation, no markdown, no text outside the JSON.
${correctionBlock}${strictnessBlock}
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
// Dedicated photo validation (is this a wig, and which angle?)
// ---------------------------------------------------------------------------

const KNOWN_ANGLE_KEYS = [
  'FRONT_FULL',
  'LEFT_PROFILE',
  'RIGHT_PROFILE',
  'BACK_FULL',
  'TOP_DOWN',
  'CLOSEUP_LACE',
  'CLOSEUP_ENDS'
] as const;

const ANGLE_LABELS: Record<string, string> = {
  FRONT_FULL: 'front',
  LEFT_PROFILE: 'left profile',
  RIGHT_PROFILE: 'right profile',
  BACK_FULL: 'back',
  TOP_DOWN: 'top-down',
  CLOSEUP_LACE: 'close-up lace',
  CLOSEUP_ENDS: 'close-up ends'
};

// Some viewpoints genuinely overlap and the model cannot tell them apart, so we
// only treat a photo as the "wrong angle" when it falls in a clearly different
// group. Within a group, any photo is accepted:
//   - crown/parting from above: TOP_DOWN and CLOSEUP_LACE look the same
//   - body/length from the front or sides: FRONT, both PROFILES, and CLOSEUP_ENDS
//     all show hair length/ends and are easily confused
//   - the back is distinct
// This still catches gross errors (a back shot in a front slot, a top-down in a
// back slot) without false-positiving on legitimate close-ups.
const ANGLE_GROUPS: string[][] = [
  ['TOP_DOWN', 'CLOSEUP_LACE'],
  ['FRONT_FULL', 'LEFT_PROFILE', 'RIGHT_PROFILE', 'CLOSEUP_ENDS'],
  ['BACK_FULL']
];

function anglesCompatible(detected: string, expected: string): boolean {
  if (detected === expected) return true;
  return ANGLE_GROUPS.some((g) => g.includes(detected) && g.includes(expected));
}

export const PHOTO_CLASSIFIER_PROMPT = `You are validating a single photo submitted for wig quality control. Look ONLY at this one image and report what it actually is. Do NOT assume it is a wig.

Return ONLY strict JSON, no markdown:
{
  "is_wig_photo": boolean,  // true ONLY if the image clearly shows a hair wig (on a mannequin head, a stand, or held up). false for documents, QR codes, screenshots, invitations, photos of people's faces, random objects, or blank/unclear images.
  "detected_angle": "FRONT_FULL" | "LEFT_PROFILE" | "RIGHT_PROFILE" | "BACK_FULL" | "TOP_DOWN" | "CLOSEUP_LACE" | "CLOSEUP_ENDS" | "UNKNOWN",  // which wig viewpoint this photo best matches; UNKNOWN if not a wig or unclear
  "description": "a few words describing what the image actually shows"
}`;

const PhotoClassificationSchema = z.object({
  is_wig_photo: z.boolean(),
  detected_angle: z.string(),
  description: z.string().nullable()
});

function parsePhotoClassification(raw: string): PhotoClassification {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/im, '')
    .replace(/\s*```\s*$/im, '')
    .trim();
  const parsed = PhotoClassificationSchema.parse(JSON.parse(cleaned));
  const detected = parsed.detected_angle?.toUpperCase();
  return {
    isWigPhoto: parsed.is_wig_photo,
    detectedAngle: (KNOWN_ANGLE_KEYS as readonly string[]).includes(detected) ? detected : 'UNKNOWN',
    description: parsed.description ?? ''
  };
}

/**
 * Runs the dedicated photo-validation pass over every submitted angle using the
 * configured provider. Returns one issue per photo that is not a wig, or that
 * clearly shows the wrong capture angle. Returns [] when the provider cannot
 * classify (e.g. mock) so evaluation proceeds normally.
 */
export async function validatePhotos(angles: AnglePayload[]): Promise<PhotoIssue[]> {
  const evaluator = pickEvaluator();
  if (!evaluator.classifyPhoto) return [];

  const issues: PhotoIssue[] = [];
  for (const angle of angles) {
    let cls: PhotoClassification;
    try {
      cls = await evaluator.classifyPhoto(angle.submissionImageBase64);
    } catch (err) {
      console.warn(`[ai] photo classification failed for ${angle.angleKey}:`, err instanceof Error ? err.message : err);
      continue; // don't block evaluation on a classifier hiccup
    }

    if (!cls.isWigPhoto) {
      issues.push({
        angleKey: angle.angleKey,
        angleLabel: angle.angleLabel,
        problem: `not a wig photo${cls.description ? ` (looks like: ${cls.description})` : ''}`
      });
    } else if (cls.detectedAngle !== 'UNKNOWN' && !anglesCompatible(cls.detectedAngle, angle.angleKey)) {
      issues.push({
        angleKey: angle.angleKey,
        angleLabel: angle.angleLabel,
        problem: `looks like a ${ANGLE_LABELS[cls.detectedAngle] ?? cls.detectedAngle} shot, not ${angle.angleLabel}`
      });
    }
  }
  return issues;
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

  async classifyPhoto(imageBase64: string): Promise<PhotoClassification> {
    const model = this.client.getGenerativeModel({ model: this.model });
    const data = await fetchImageBase64(imageBase64);
    const result = await model.generateContent([
      PHOTO_CLASSIFIER_PROMPT,
      { inlineData: { data, mimeType: 'image/jpeg' } }
    ]);
    return parsePhotoClassification(result.response.text());
  }

  async evaluateSession(payload: SessionPayload): Promise<SessionEvaluationResult> {
    const model = this.client.getGenerativeModel({ model: this.model });
    const allCriteria: EvaluationCriterionResult[] = [];

    for (const angle of payload.angles) {
      const prompt = buildAnglePrompt(payload.styleName, payload.styleNuanceContext, angle, payload.styleStrictnessNote);

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

  async classifyPhoto(imageBase64: string): Promise<PhotoClassification> {
    const data = await fetchImageBase64(imageBase64);
    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: 300,
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: PHOTO_CLASSIFIER_PROMPT },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${data}`, detail: 'low' } }
          ]
        }
      ]
    });
    return parsePhotoClassification(response.choices[0]?.message?.content ?? '{}');
  }

  async evaluateSession(payload: SessionPayload): Promise<SessionEvaluationResult> {
    const allCriteria: EvaluationCriterionResult[] = [];

    for (const angle of payload.angles) {
      const prompt = buildAnglePrompt(payload.styleName, payload.styleNuanceContext, angle, payload.styleStrictnessNote);

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
