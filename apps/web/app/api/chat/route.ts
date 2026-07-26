import { createClient } from '@/lib/supabase/server';
import {
  CASUAL_ASSISTANT_PROMPT,
  technicalAssistantPrompt,
} from '@/lib/assistant-prompt';
import { needsKnowledgeSearch } from '@/lib/chat-intent';
import {
  streamWithConfiguredLlm,
  type CompletionMessage,
} from '@/lib/completion';
import { searchWcagKnowledge, type KnowledgeHit } from '@/lib/knowledge';
import { createReasoningStripper } from '@/lib/strip-reasoning';

interface FindingContext {
  wcag?: string[] | string;
  level?: string;
  rule?: string;
  severity?: string;
  message?: string;
  snippet?: string;
  file?: string;
  line?: number;
}

interface ChatRequest {
  message?: string;
  finding?: FindingContext | null;
  history?: CompletionMessage[];
}

const MAX_SOURCES = 4;

function cleanText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function criteriaFrom(value: FindingContext['wcag']): string[] {
  const raw = Array.isArray(value) ? value : value ? [value] : [];
  return raw
    .map((criterion) => cleanText(criterion, 16))
    .filter((criterion) => /^\d+\.\d+\.\d+$/.test(criterion));
}

function sourceKey(hit: KnowledgeHit): string {
  return [
    hit.citation.criterion,
    hit.citation.url,
    hit.citation.title,
    hit.content.slice(0, 120),
  ].join('|');
}

function prepareSources(results: KnowledgeHit[]): KnowledgeHit[] {
  const seen = new Set<string>();
  return results
    .map((hit, index) => {
      const title = hit.citation.title ?? '';
      const normative =
        (/\bsuccess criterion\b/i.test(title) ? 4 : 0) +
        (hit.citation.criterion ? 3 : 0) +
        (/\bsuccess criterion(?:\s*\(sc\))?\b/i.test(hit.content) ? 2 : 0);
      return { hit, index, normative };
    })
    .sort((left, right) =>
      right.normative - left.normative || left.index - right.index,
    )
    .map(({ hit }) => hit)
    .filter((hit) => {
      const key = sourceKey(hit);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_SOURCES);
}

function formatSources(hits: KnowledgeHit[]): string {
  return hits
    .map((hit, index) => {
      const heading = [
        hit.citation.title ?? 'WCAG guidance',
        hit.citation.criterion,
        hit.citation.level && `Level ${hit.citation.level}`,
      ].filter(Boolean).join(' — ');
      return `[S${index + 1}] ${heading}\n${hit.content.slice(0, 1600)}`;
    })
    .join('\n\n');
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: 'Authentication required.' }, { status: 401 });
  }

  let body: ChatRequest;
  try {
    body = await request.json() as ChatRequest;
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const message = cleanText(body.message, 4000);
  if (!message) {
    return Response.json({ error: 'A message is required.' }, { status: 400 });
  }

  const finding = body.finding ?? null;
  const criteria = criteriaFrom(finding?.wcag);
  const shouldSearch = needsKnowledgeSearch(message, Boolean(finding));
  let sources: KnowledgeHit[] = [];
  let retrievalMode = 'none';
  let retrievalWarning: string | undefined;

  if (shouldSearch) {
    const query = [
      message,
      criteria.join(' '),
      cleanText(finding?.rule, 120),
      cleanText(finding?.message, 700),
    ].filter(Boolean).join(' ');

    try {
      const knowledge = await searchWcagKnowledge(query, {
        version: '2.2',
        criteria: criteria.length > 0 ? criteria : undefined,
        levels: cleanText(finding?.level, 4)
          ? [cleanText(finding?.level, 4)]
          : undefined,
        matchCount: MAX_SOURCES * 2,
      });
      sources = prepareSources(knowledge.results);
      retrievalMode = knowledge.mode;
      retrievalWarning = knowledge.warning;
    } catch (error) {
      retrievalWarning =
        error instanceof Error ? error.message : 'Knowledge retrieval failed.';
    }
  }

  const history = (Array.isArray(body.history) ? body.history : [])
    .slice(-6)
    .filter(
      (item): item is CompletionMessage =>
        item?.role === 'user' || item?.role === 'assistant',
    )
    .map((item) => ({
      role: item.role,
      content: cleanText(item.content, 2000),
    }))
    .filter((item) => item.content);

  const findingContext = finding
    ? [
        `Criteria: ${criteria.join(', ') || 'unknown'}`,
        `Level: ${cleanText(finding.level, 4) || 'unknown'}`,
        `Rule: ${cleanText(finding.rule, 120)}`,
        `Severity: ${cleanText(finding.severity, 40)}`,
        `Location: ${cleanText(finding.file, 500)}${finding.line ? `:${finding.line}` : ''}`,
        `Scanner message: ${cleanText(finding.message, 700)}`,
        cleanText(finding.snippet, 2000)
          ? `Code:\n${cleanText(finding.snippet, 2000)}`
          : '',
      ].filter(Boolean).join('\n')
    : '';

  const userContent = shouldSearch
    ? [
        `Question:\n${message}`,
        findingContext ? `\nScan context:\n${findingContext}` : '',
        sources.length > 0
          ? `\nNumbered evidence:\n${formatSources(sources)}`
          : '\nNo relevant knowledge-base evidence was retrieved.',
      ].filter(Boolean).join('\n')
    : message;

  let completion;
  try {
    completion = await streamWithConfiguredLlm({
      system: shouldSearch
        ? technicalAssistantPrompt(Boolean(finding))
        : CASUAL_ASSISTANT_PROMPT,
      messages: [
        ...history,
        { role: 'user' as const, content: userContent },
      ],
      maxTokens: shouldSearch ? 700 : 180,
    });
  } catch (error) {
    return Response.json({
      error: error instanceof Error ? error.message : 'The assistant is unavailable.',
    }, { status: 503 });
  }

  const encoder = new TextEncoder();
  const responseStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: object) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      send({
        type: 'metadata',
        retrievalMode,
        warning: retrievalWarning,
        sources: sources.map((hit, index) => ({
          ...hit.citation,
          label: `S${index + 1}`,
        })),
        completionProvider: completion.provider,
        completionModel: completion.model,
      });

      const stripper = createReasoningStripper();
      let emitted = false;

      try {
        for await (const delta of completion.chunks) {
          let content = stripper.push(delta);
          if (!emitted) content = content.replace(/^\s+/, '');
          if (content) {
            emitted = true;
            send({ type: 'delta', content });
          }
        }

        let tail = stripper.flush();
        if (!emitted) tail = tail.replace(/^\s+/, '');
        if (tail) send({ type: 'delta', content: tail });
        send({ type: 'done' });
      } catch (error) {
        send({
          type: 'error',
          error: error instanceof Error
            ? error.message
            : 'The answer stream stopped unexpectedly.',
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(responseStream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      'X-Accel-Buffering': 'no',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
