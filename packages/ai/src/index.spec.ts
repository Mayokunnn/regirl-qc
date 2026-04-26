import { describe, expect, it } from 'vitest';
import { pickEvaluator } from './index';

describe('AI provider fallback', () => {
  it('falls back to mock when external keys missing', () => {
    process.env.AI_PROVIDER = 'gemini';
    delete process.env.GEMINI_API_KEY;
    const evaluator = pickEvaluator();
    expect(evaluator.providerName).toBe('mock');
  });
});
