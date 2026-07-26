import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  completeWithConfiguredLlm,
  NoCompletionProviderError,
  streamWithGemma,
} from '@/lib/completion';

const originalEnv = {
  GEMMA_BASE_URL: process.env.GEMMA_BASE_URL,
  GEMMA_MODEL: process.env.GEMMA_MODEL,
  GEMMA_API_KEY: process.env.GEMMA_API_KEY,
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
  restore('GEMMA_BASE_URL');
  restore('GEMMA_MODEL');
  restore('GEMMA_API_KEY');
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
    process.env.GEMMA_BASE_URL = 'http://localhost:11434';
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

  it('prefers the configured local Gemma service', async () => {
    delete process.env.GROQ_API_KEY;
    process.env.GEMMA_BASE_URL = 'http://localhost:11434/';
    process.env.GEMMA_MODEL = 'gemma-3-4b-it';
    delete process.env.ANTHROPIC_API_KEY;
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      model: 'gemma-3-4b-it',
      choices: [{ message: { role: 'assistant', content: 'Normal text needs 4.5:1 [S1].' } }],
    }), { status: 200 }));

    const result = await completeWithConfiguredLlm(request, fetchMock);

    expect(result.provider).toBe('gemma');
    expect(result.content).toContain('4.5:1');
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:11434/v1/chat/completions');
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.model).toBe('gemma-3-4b-it');
    expect(body.messages[0]).toEqual({ role: 'system', content: request.system });
  });

  it('sends the optional Gemma bearer token', async () => {
    delete process.env.GROQ_API_KEY;
    process.env.GEMMA_BASE_URL = 'http://localhost:11434';
    process.env.GEMMA_API_KEY = 'local-gemma-token';
    delete process.env.ANTHROPIC_API_KEY;
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      model: 'gemma-3-4b-it',
      choices: [{ message: { role: 'assistant', content: 'Token accepted.' } }],
    }), { status: 200 }));

    await completeWithConfiguredLlm(request, fetchMock);

    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({
      Authorization: 'Bearer local-gemma-token',
    });
  });

  it('falls back to Anthropic when local Gemma is unavailable', async () => {
    delete process.env.GROQ_API_KEY;
    process.env.GEMMA_BASE_URL = 'http://localhost:11434';
    process.env.ANTHROPIC_API_KEY = 'test-key';
    process.env.ANTHROPIC_MODEL = 'test-claude';
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('unavailable', { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        content: [{ type: 'text', text: 'Anthropic fallback answer.' }],
      }), { status: 200 }));

    const result = await completeWithConfiguredLlm(request, fetchMock);

    expect(result.provider).toBe('anthropic');
    expect(result.model).toBe('test-claude');
    expect(result.warning).toContain('Gemma was unavailable');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('streams Gemma completion deltas', async () => {
    delete process.env.GROQ_API_KEY;
    process.env.GEMMA_BASE_URL = 'http://localhost:11434';
    process.env.GEMMA_MODEL = 'gemma-3-4b-it';
    const body = [
      'data: {"choices":[{"delta":{"content":"Normal text "}}]}',
      '',
      'data: {"choices":[{"delta":{"content":"needs 4.5:1."}}]}',
      '',
      'data: [DONE]',
      '',
    ].join('\n');
    const fetchMock = vi.fn().mockResolvedValue(new Response(body, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    }));

    const result = await streamWithGemma(request, fetchMock);
    let content = '';
    for await (const chunk of result.chunks) content += chunk;

    expect(content).toBe('Normal text needs 4.5:1.');
    const requestBody = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(requestBody.stream).toBe(true);
    expect(requestBody.max_tokens).toBe(220);
  });

  it('reports that no provider is available when none is configured', async () => {
    delete process.env.GROQ_API_KEY;
    delete process.env.GEMMA_BASE_URL;
    delete process.env.ANTHROPIC_API_KEY;

    await expect(completeWithConfiguredLlm(request, vi.fn()))
      .rejects.toBeInstanceOf(NoCompletionProviderError);
  });
});
