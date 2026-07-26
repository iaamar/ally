export interface CompletionMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface CompletionRequest {
  system: string;
  messages: CompletionMessage[];
  maxTokens?: number;
}

export interface CompletionResult {
  content: string;
  provider: 'groq' | 'gemma' | 'anthropic';
  model: string;
  warning?: string;
}

export interface StreamingCompletionResult {
  chunks: AsyncIterable<string>;
  provider: 'groq' | 'gemma' | 'anthropic';
  model: string;
}

export class NoCompletionProviderError extends Error {
  constructor(message = 'No text-completion provider is configured or available.') {
    super(message);
    this.name = 'NoCompletionProviderError';
  }
}

function timeoutMs(): number {
  const configured = Number(
    process.env.LLM_REQUEST_TIMEOUT_MS ??
    process.env.GEMMA_REQUEST_TIMEOUT_MS,
  );
  return Number.isFinite(configured) && configured >= 1_000
    ? Math.min(configured, 300_000)
    : 300_000;
}

function groqModel(): string {
  return process.env.GROQ_MODEL?.trim() || 'qwen/qwen3.6-27b';
}

function openAiMessages(request: CompletionRequest) {
  return [
    { role: 'system' as const, content: request.system },
    ...request.messages,
  ];
}

async function groqRequest(
  request: CompletionRequest,
  stream: boolean,
  fetchImpl: typeof fetch,
): Promise<Response> {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) throw new NoCompletionProviderError('Groq is not configured.');

  const send = (reasoningControls: boolean) =>
    fetchImpl('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(timeoutMs()),
      body: JSON.stringify({
        model: groqModel(),
        messages: openAiMessages(request),
        stream,
        temperature: 0.2,
        max_tokens: request.maxTokens ?? 700,
        ...(reasoningControls
          ? { reasoning_effort: 'none', reasoning_format: 'hidden' }
          : {}),
      }),
    });

  let response = await send(true);
  if (!response.ok && response.status === 400) response = await send(false);
  return response;
}

async function completeWithGroq(
  request: CompletionRequest,
  fetchImpl: typeof fetch,
): Promise<CompletionResult> {
  const response = await groqRequest(request, false, fetchImpl);
  if (!response.ok) throw new Error(`Groq returned HTTP ${response.status}.`);

  const data = await response.json() as {
    model?: string;
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error('Groq returned an empty response.');
  return { content, provider: 'groq', model: data.model ?? groqModel() };
}

function gemmaHeaders(): HeadersInit {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const apiKey = process.env.GEMMA_API_KEY?.trim();
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  return headers;
}

async function completeWithGemma(
  request: CompletionRequest,
  fetchImpl: typeof fetch,
): Promise<CompletionResult> {
  const baseUrl = process.env.GEMMA_BASE_URL?.replace(/\/+$/, '');
  if (!baseUrl) throw new NoCompletionProviderError('Gemma is not configured.');

  const model = process.env.GEMMA_MODEL ?? 'gemma-3-4b-it';
  const response = await fetchImpl(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: gemmaHeaders(),
    signal: AbortSignal.timeout(timeoutMs()),
    body: JSON.stringify({
      model,
      messages: openAiMessages(request),
      stream: false,
      temperature: 0.2,
      max_tokens: Math.min(request.maxTokens ?? 400, 400),
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemma returned HTTP ${response.status}.`);
  }

  const data = await response.json() as {
    model?: string;
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error('Gemma returned an empty response.');

  return { content, provider: 'gemma', model: data.model ?? model };
}

async function* parseOpenAiSse(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;

      const event = JSON.parse(payload) as {
        choices?: Array<{ delta?: { content?: string } }>;
      };
      const content = event.choices?.[0]?.delta?.content;
      if (content) yield content;
    }

    if (done) break;
  }

  const finalLine = buffer.trim();
  if (finalLine.startsWith('data:')) {
    const payload = finalLine.slice(5).trim();
    if (payload && payload !== '[DONE]') {
      const event = JSON.parse(payload) as {
        choices?: Array<{ delta?: { content?: string } }>;
      };
      const content = event.choices?.[0]?.delta?.content;
      if (content) yield content;
    }
  }
}

export async function streamWithGemma(
  request: CompletionRequest,
  fetchImpl: typeof fetch = fetch,
): Promise<StreamingCompletionResult> {
  const baseUrl = process.env.GEMMA_BASE_URL?.replace(/\/+$/, '');
  if (!baseUrl) throw new NoCompletionProviderError('Gemma is not configured.');

  const model = process.env.GEMMA_MODEL ?? 'gemma-3-4b-it';
  const response = await fetchImpl(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: gemmaHeaders(),
    signal: AbortSignal.timeout(timeoutMs()),
    body: JSON.stringify({
      model,
      messages: openAiMessages(request),
      stream: true,
      temperature: 0.2,
      max_tokens: Math.min(request.maxTokens ?? 220, 300),
    }),
  });

  if (!response.ok || !response.body) {
    throw new Error(`Gemma returned HTTP ${response.status}.`);
  }

  return {
    chunks: parseOpenAiSse(response.body),
    provider: 'gemma',
    model,
  };
}

export async function streamWithGroq(
  request: CompletionRequest,
  fetchImpl: typeof fetch = fetch,
): Promise<StreamingCompletionResult> {
  const response = await groqRequest(request, true, fetchImpl);
  if (!response.ok || !response.body) {
    throw new Error(`Groq returned HTTP ${response.status}.`);
  }

  return {
    chunks: parseOpenAiSse(response.body),
    provider: 'groq',
    model: groqModel(),
  };
}

export async function streamWithConfiguredLlm(
  request: CompletionRequest,
  fetchImpl: typeof fetch = fetch,
): Promise<StreamingCompletionResult> {
  if (process.env.GROQ_API_KEY) {
    try {
      return await streamWithGroq(request, fetchImpl);
    } catch (error) {
      console.error(
        'Groq streaming failed:',
        error instanceof Error ? error.message : error,
      );
    }
  }

  if (process.env.GEMMA_BASE_URL) {
    try {
      return await streamWithGemma(request, fetchImpl);
    } catch (error) {
      console.error(
        'Gemma streaming failed:',
        error instanceof Error ? error.message : error,
      );
    }
  }

  if (process.env.ANTHROPIC_API_KEY) {
    const completion = await completeWithAnthropic(request, fetchImpl);
    return {
      chunks: (async function* () {
        yield completion.content;
      })(),
      provider: 'anthropic',
      model: completion.model,
    };
  }

  throw new NoCompletionProviderError(
    'No completion provider is available. Add GROQ_API_KEY, GEMMA_BASE_URL, or ANTHROPIC_API_KEY.',
  );
}

async function completeWithAnthropic(
  request: CompletionRequest,
  fetchImpl: typeof fetch,
): Promise<CompletionResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new NoCompletionProviderError('Anthropic is not configured.');

  const model = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-20250514';
  const response = await fetchImpl('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: request.maxTokens ?? 1200,
      system: request.system,
      messages: request.messages,
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic returned HTTP ${response.status}.`);
  }

  const data = await response.json() as {
    content?: Array<{ type: string; text?: string }>;
  };
  const content = data.content?.find((item) => item.type === 'text')?.text?.trim();
  if (!content) throw new Error('Anthropic returned an empty response.');

  return { content, provider: 'anthropic', model };
}

export async function completeWithConfiguredLlm(
  request: CompletionRequest,
  fetchImpl: typeof fetch = fetch,
): Promise<CompletionResult> {
  if (process.env.GROQ_API_KEY) {
    try {
      return await completeWithGroq(request, fetchImpl);
    } catch (error) {
      console.error(
        'Groq completion failed:',
        error instanceof Error ? error.message : error,
      );
    }
  }

  const gemmaConfigured = Boolean(process.env.GEMMA_BASE_URL);
  let gemmaFailure: string | undefined;

  if (gemmaConfigured) {
    try {
      return await completeWithGemma(request, fetchImpl);
    } catch (error) {
      gemmaFailure = error instanceof Error ? error.message : 'Gemma failed.';
      console.error('Local Gemma completion failed:', gemmaFailure);
    }
  }

  if (process.env.ANTHROPIC_API_KEY) {
    const result = await completeWithAnthropic(request, fetchImpl);
    return gemmaFailure
      ? { ...result, warning: `Local Gemma was unavailable; used Anthropic instead. ${gemmaFailure}` }
      : result;
  }

  if (gemmaFailure) {
    throw new NoCompletionProviderError(`Local Gemma was unavailable. ${gemmaFailure}`);
  }
  throw new NoCompletionProviderError();
}
