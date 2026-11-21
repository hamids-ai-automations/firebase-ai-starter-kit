import { useState } from 'react';
import type { Functions } from 'firebase/functions';
import { api, normalizeError, type ApiError } from '../lib/api';
import type { ChatTurn } from '../types';
import { Badge, Button, Card, ErrorBanner, Field, inputClass } from './ui';

export function ChatPanel({ functions }: { functions: Functions }) {
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(false);
  const [mocked, setMocked] = useState(false);

  const send = async () => {
    const trimmed = message.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.chat(functions, {
        message: trimmed,
        conversationId,
        // Sent for the first call only; afterwards the server reads history from Firestore.
        history: conversationId ? undefined : turns,
      });
      setConversationId(result.conversationId);
      setMocked(result.mocked);
      setTurns((previous) => [
        ...previous,
        { role: 'user', text: trimmed },
        { role: 'model', text: result.text },
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
    try {
      await api.deleteConversation(functions, conversationId);
      setConversationId(undefined);
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
      description="Conversation history is persisted in Firestore and read back by the server on every turn."
      footer={
        conversationId ? (
          <span>
            conversationId: <code>{conversationId}</code>
          </span>
        ) : (
          <span>A conversation document is created on the first message.</span>
        )
      }
    >
      <div className="max-h-80 space-y-3 overflow-auto rounded-lg border border-slate-800 bg-slate-950/60 p-3">
        {turns.length === 0 ? (
          <p className="text-sm text-slate-500">No messages yet. Ask something to start.</p>
        ) : (
          turns.map((turn, index) => (
            <div
              key={`${turn.role}-${index}`}
              className={`rounded-lg px-3 py-2 text-sm ${
                turn.role === 'user'
                  ? 'ml-auto max-w-[85%] bg-indigo-500/20 text-indigo-100'
                  : 'mr-auto max-w-[85%] bg-slate-800/70 text-slate-200'
              }`}
            >
              <span className="mb-1 block text-[10px] uppercase tracking-wide text-slate-400">
                {turn.role === 'user' ? 'you' : 'assistant'}
              </span>
              <span className="whitespace-pre-wrap">{turn.text}</span>
            </div>
          ))
        )}
      </div>

      <Field label="Message">
        <textarea
          className={`${inputClass} min-h-20 resize-y`}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) void send();
          }}
          placeholder="Ask a follow-up… (Ctrl/Cmd + Enter to send)"
          maxLength={8000}
        />
      </Field>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => void send()} disabled={loading || message.trim().length === 0}>
          {loading ? 'Sending…' : 'Send'}
        </Button>
        <Button
          variant="danger"
          onClick={() => void remove()}
          disabled={loading || !conversationId}
        >
          Delete conversation
        </Button>
        {mocked ? <Badge tone="amber">mock mode</Badge> : null}
      </div>
      <ErrorBanner
        message={
          error ? `${error.message}${error.code !== 'unknown' ? ` (${error.code})` : ''}` : null
        }
      />
    </Card>
  );
}
