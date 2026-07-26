'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AllyMark } from '@/components/AllyMark';
import { filterCitedSources } from '@/lib/chat-sources';

interface FindingContext {
  wcag: string[];
  level: string;
  rule: string;
  severity: string;
  message: string;
  snippet: string;
  file: string;
  line: number;
}

interface Source {
  label: string;
  criterion: string | null;
  level: string | null;
  version: string | null;
  url: string | null;
  title: string | null;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
}

const MIN_WIDTH = 340;
const MAX_WIDTH = 720;
const DEFAULT_WIDTH = 440;
const WIDTH_KEY = 'ally.assistant.width';
const MARKDOWN_PLUGINS = [remarkGfm];

export function AllyChatPanel() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [finding, setFinding] = useState<FindingContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setMounted(true);
    const stored = Number(window.localStorage.getItem(WIDTH_KEY));
    if (Number.isFinite(stored) && stored >= MIN_WIDTH && stored <= MAX_WIDTH) {
      setWidth(stored);
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (open) {
      root.classList.add('assistant-open');
      root.style.setProperty('--assistant-w', `${width}px`);
    } else {
      root.classList.remove('assistant-open');
      root.style.removeProperty('--assistant-w');
    }
    return () => {
      root.classList.remove('assistant-open');
      root.style.removeProperty('--assistant-w');
    };
  }, [open, width]);

  const resize = useCallback((value: number) => {
    const next = Math.min(Math.max(value, MIN_WIDTH), MAX_WIDTH);
    setWidth(next);
    window.localStorage.setItem(WIDTH_KEY, String(next));
  }, []);

  const ask = useCallback(async (
    question: string,
    context: FindingContext | null,
    priorMessages: Message[],
  ) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const userMessage: Message = { role: 'user', content: question };
    setMessages([
      ...priorMessages,
      userMessage,
      { role: 'assistant', content: '' },
    ]);
    setLoading(true);

    const updateAssistant = (update: (message: Message) => Message) => {
      setMessages((current) => current.map((message, index) =>
        index === current.length - 1 ? update(message) : message,
      ));
    };

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          message: question,
          finding: context,
          history: priorMessages.map(({ role, content }) => ({ role, content })),
        }),
      });

      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => null) as
          | { error?: string }
          | null;
        throw new Error(data?.error ?? `Assistant request failed (${response.status}).`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const applyEvent = (line: string) => {
        if (!line.trim()) return;
        const event = JSON.parse(line) as {
          type: 'metadata' | 'delta' | 'done' | 'error';
          content?: string;
          error?: string;
          sources?: Source[];
        };
        if (event.type === 'metadata') {
          updateAssistant((message) => ({ ...message, sources: event.sources }));
        } else if (event.type === 'delta' && event.content) {
          updateAssistant((message) => ({
            ...message,
            content: message.content + event.content,
          }));
        } else if (event.type === 'error') {
          updateAssistant((message) => ({
            ...message,
            content: message.content || event.error || 'The answer stream stopped.',
          }));
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) applyEvent(line);
        if (done) break;
      }
      if (buffer.trim()) applyEvent(buffer);
    } catch (error) {
      if ((error as Error).name === 'AbortError') return;
      updateAssistant((message) => ({
        ...message,
        content: message.content ||
          (error instanceof Error ? error.message : 'The assistant is unavailable.'),
      }));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    function handleFindingClick(event: MouseEvent) {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
      const anchor = (event.target as HTMLElement).closest<HTMLAnchorElement>(
        'a[data-ally-finding]',
      );
      if (!anchor?.dataset.allyFinding) return;

      event.preventDefault();
      try {
        const context = JSON.parse(anchor.dataset.allyFinding) as FindingContext;
        setFinding(context);
        setMessages([]);
        setOpen(true);
        void ask(
          `Explain this ${context.wcag.join(', ')} finding and show me the safest fix.`,
          context,
          [],
        );
      } catch {
        // Ignore malformed context and keep the WCAG link usable.
      }
    }

    document.addEventListener('click', handleFindingClick);
    return () => document.removeEventListener('click', handleFindingClick);
  }, [ask]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        launcherRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  useEffect(() => {
    if (open && !loading) inputRef.current?.focus();
  }, [open, loading]);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight });
  }, [messages]);

  useEffect(() => () => abortRef.current?.abort(), []);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const question = input.trim();
    if (!question || loading) return;
    setInput('');
    void ask(question, finding, messages);
  }

  function handleResizePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = width;
    document.documentElement.classList.add('assistant-resizing');

    const move = (pointerEvent: PointerEvent) => {
      resize(startWidth + startX - pointerEvent.clientX);
    };
    const stop = () => {
      document.documentElement.classList.remove('assistant-resizing');
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
  }

  function handleResizeKeyDown(event: React.KeyboardEvent) {
    const step = event.shiftKey ? 64 : 16;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      resize(width + step);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      resize(width - step);
    } else if (event.key === 'Home') {
      event.preventDefault();
      resize(MAX_WIDTH);
    } else if (event.key === 'End') {
      event.preventDefault();
      resize(MIN_WIDTH);
    }
  }

  const panel = mounted && open
    ? createPortal(
        <aside
          id="ally-assistant"
          className="chat-panel"
          style={{ width }}
          role="complementary"
          aria-label="Ally accessibility assistant"
        >
          <div
            className="chat-panel__handle"
            role="separator"
            tabIndex={0}
            aria-label="Resize assistant panel"
            aria-orientation="vertical"
            aria-valuemin={MIN_WIDTH}
            aria-valuemax={MAX_WIDTH}
            aria-valuenow={width}
            onPointerDown={handleResizePointerDown}
            onKeyDown={handleResizeKeyDown}
          />

          <div className="chat-panel__header">
            <div className="chat-panel__title">
              <AllyMark />
              <span>Ally Assistant</span>
            </div>
            <button
              type="button"
              className="btn-ghost chat-panel__close"
              onClick={() => {
                setOpen(false);
                launcherRef.current?.focus();
              }}
              aria-label="Close assistant"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {finding && (
            <div className="chat-panel__context">
              <div className="chat-ctx-row">
                <span className="chat-ctx-label">Criteria</span>
                <span className="chat-ctx-value">{finding.wcag.join(', ')}</span>
              </div>
              <div className="chat-ctx-row">
                <span className="chat-ctx-label">Rule</span>
                <code className="chat-ctx-value chat-ctx-mono">{finding.rule}</code>
              </div>
              {finding.file && (
                <div className="chat-ctx-row">
                  <span className="chat-ctx-label">Location</span>
                  <code className="chat-ctx-value chat-ctx-mono">
                    {finding.file}{finding.line > 0 ? `:${finding.line}` : ''}
                  </code>
                </div>
              )}
            </div>
          )}

          <div className="chat-panel__body" ref={bodyRef} aria-busy={loading}>
            {messages.length === 0 && (
              <div className="chat-welcome">
                <p className="chat-welcome__eyebrow">WCAG 2.2 knowledge</p>
                <h2>What are you working through?</h2>
                <p>Ask about a criterion, a scan finding, or the safest implementation pattern.</p>
              </div>
            )}

            {messages.map((message, index) => {
              const sources = filterCitedSources(message.content, message.sources);
              return (
                <article
                  className={`chat-message chat-message--${message.role}`}
                  key={`${message.role}-${index}`}
                >
                  <p className="chat-message__role">
                    {message.role === 'user' ? 'You' : 'Ally'}
                  </p>
                  {message.role === 'assistant' ? (
                    <Markdown text={message.content} />
                  ) : (
                    <p>{message.content}</p>
                  )}
                  {sources.length > 0 && (
                    <ul className="chat-sources" aria-label="Sources">
                      {sources.map((source) => (
                        <li key={`${source.label}-${source.url}`}>
                          {source.url ? (
                            <a href={source.url} target="_blank" rel="noreferrer">
                              {source.label} · {source.title ?? source.criterion ?? 'WCAG source'}
                            </a>
                          ) : (
                            <span>{source.label} · {source.title ?? source.criterion}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              );
            })}

            {loading && !messages.at(-1)?.content && (
              <div className="chat-loading" role="status">
                <div className="chat-loading__dots" aria-hidden="true">
                  <span /><span /><span />
                </div>
                <span className="chat-loading__text">Writing answer…</span>
              </div>
            )}
          </div>

          <form className="chat-panel__input" onSubmit={submit}>
            <label className="visually-hidden" htmlFor="ally-question">
              Ask Ally an accessibility question
            </label>
            <input
              id="ally-question"
              ref={inputRef}
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask about accessibility…"
              disabled={loading}
              maxLength={4000}
              autoComplete="off"
            />
            <button
              type="submit"
              className="btn-primary chat-send"
              disabled={loading || !input.trim()}
              aria-label="Send question"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M2 8h12M10 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </form>
        </aside>,
        document.body,
      )
    : null;

  return (
    <>
      <button
        ref={launcherRef}
        type="button"
        className="btn-ghost assistant-launcher"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls="ally-assistant"
      >
        <AllyMark />
        <span>Assistant</span>
      </button>
      {panel}
    </>
  );
}

function Markdown({ text }: { text: string }) {
  return (
    <div className="chat-response">
      <ReactMarkdown remarkPlugins={MARKDOWN_PLUGINS} skipHtml>
        {text}
      </ReactMarkdown>
    </div>
  );
}
