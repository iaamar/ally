import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  completeWithConfiguredLlm,
  NoCompletionProviderError,
} from '@/lib/completion';

const originalEnv = {
  GROQ_API_KEY: process.env.GROQ_API_KEY,
  GROQ_MODEL: process.env.GROQ_MODEL,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL,
};

function restore(name: keyof typeof originalEnv) {
  const value = originalEnv[name];
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

afterEach(() => {
  restore('GROQ_API_KEY');
  restore('GROQ_MODEL');
  restore('ANTHROPIC_API_KEY');
  restore('ANTHROPIC_MODEL');
  vi.restoreAllMocks();
});

const request = {
  system: 'Answer only from the supplied WCAG context.',
  messages: [{ role: 'user' as const, content: 'What contrast is required?' }],
};

describe('completeWithConfiguredLlm', () => {
  it('prefers Groq Qwen when its API key is configured', async () => {
    process.env.GROQ_API_KEY = 'groq-test-key';
    process.env.GROQ_MODEL = 'qwen/qwen3.6-27b';
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      model: 'qwen/qwen3.6-27b',
      choices: [{ message: { content: 'Use an informative alt attribute.' } }],
    }), { status: 200 }));

    const result = await completeWithConfiguredLlm(request, fetchMock);

    expect(result.provider).toBe('groq');
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.groq.com/openai/v1/chat/completions',
    );
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({
      Authorization: 'Bearer groq-test-key',
    });
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.model).toBe('qwen/qwen3.6-27b');
    expect(body.reasoning_format).toBe('hidden');
  });

  it('falls back to Anthropic when Groq is not configured', async () => {
    delete process.env.GROQ_API_KEY;
    process.env.ANTHROPIC_API_KEY = 'test-key';
    process.env.ANTHROPIC_MODEL = 'test-claude';
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      content: [{ type: 'text', text: 'Anthropic fallback answer.' }],
    }), { status: 200 }));

    const result = await completeWithConfiguredLlm(request, fetchMock);

    expect(result.provider).toBe('anthropic');
    expect(result.model).toBe('test-claude');
    expect(result.content).toBe('Anthropic fallback answer.');
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.anthropic.com/v1/messages');
  });

  it('reports that no provider is available when none is configured', async () => {
    delete process.env.GROQ_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    await expect(completeWithConfiguredLlm(request, vi.fn()))
      .rejects.toBeInstanceOf(NoCompletionProviderError);
  });
});
