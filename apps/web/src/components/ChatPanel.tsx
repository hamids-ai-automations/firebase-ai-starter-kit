import { useState } from 'react';
import { api, normalizeError, type ApiError } from '../lib/api';
import type { ChatTurn } from '../types';
import { Badge, Button, Card, ErrorBanner, Field, inputClass } from './ui';

export function ChatPanel() {
  const [message, setMessage] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [mocked, setMocked] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(false);

  const send = async () => {
    const text = message.trim();
    if (!text) return;

    setLoading(true);
    setError(null);
    try {
      const data = await api.chat({
        message: text,
        conversationId: conversationId ?? undefined,
        // Only the first turn needs the local copy; afterwards the browser reads
        // the last 20 messages back from Firestore.
        history: conversationId ? undefined : turns,
      });
      setConversationId(data.conversationId);
      setMocked(data.mocked);
      setTurns((previous) => [
        ...previous,
        { role: 'user', text },
        { role: 'model', text: data.text },
      ]);
      setMessage('');
    } catch (cause) {
      setError(normalizeError(cause));
    } finally {
      setLoading(false);
    }
  };

  const remove = async () => {
    if (!conversationId) return;
    setLoading(true);
    setError(null);
    try {
      await api.deleteConversation(conversationId);
      setConversationId(null);
      setTurns([]);
      setMocked(false);
    } catch (cause) {
      setError(normalizeError(cause));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card
      title="Multi-turn chat"
      description="Every turn is stored in Firestore under your own conversations subcollection, and this tab reads the last 20 messages back on each turn."
      footer={
        conversationId ? (
          <span>
            Conversation <code>{conversationId}</code> · {turns.length} messages in this tab
          </span>
        ) : (
          <span>A conversation document is created with your first message.</span>
        )
      }
    >
      <div className="max-h-72 space-y-2 overflow-auto">
        {turns.length === 0 ? (
          <p className="text-sm text-slate-500">No messages yet. Say something to get started.</p>
        ) : (
          turns.map((turn, index) => (
            <div
              key={`${turn.role}-${index}`}
              className={`rounded-lg border p-3 text-sm ${
                turn.role === 'user'
                  ? 'border-slate-700 bg-slate-900/70 text-slate-200'
                  : 'border-slate-800 bg-slate-950/70 text-slate-300'
              }`}
            >
              <span className="text-xs uppercase tracking-wide text-slate-500">{turn.role}</span>
              <p className="mt-1 whitespace-pre-wrap">{turn.text}</p>
            </div>
          ))
        )}
      </div>

      <Field label="Message" hint="Ctrl/Cmd + Enter sends.">
        <input
          className={inputClass}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
              event.preventDefault();
              void send();
            }
          }}
          maxLength={8000}
          placeholder="Ask a follow-up question…"
        />
      </Field>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => void send()} disabled={loading || message.trim().length === 0}>
          {loading ? 'Sending…' : 'Send'}
        </Button>
        <Button variant="ghost" onClick={() => void remove()} disabled={loading || !conversationId}>
          Delete conversation
        </Button>
        {mocked ? <Badge tone="amber">mock mode</Badge> : null}
        {conversationId ? <Badge tone="green">saved to Firestore</Badge> : null}
      </div>

      <ErrorBanner
        message={
          error ? `${error.message}${error.code !== 'unknown' ? ` (${error.code})` : ''}` : null
        }
      />
      {error?.code === 'gemini-key-missing' ? (
        <p className="text-sm text-amber-300">
          Open the <strong>Setup</strong> tab and paste your Gemini API key — it is kept in this
          tab&apos;s sessionStorage only. Nothing was written to Firestore for this turn.
        </p>
      ) : null}
    </Card>
  );
}
