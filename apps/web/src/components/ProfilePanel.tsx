import { useEffect, useState } from 'react';
import type { Firestore } from 'firebase/firestore';
import { doc, getDoc } from 'firebase/firestore';
import { api, normalizeError, type ApiError } from '../lib/api';
import type { UsageSummary } from '../types';
import { Button, Card, ErrorBanner, Field, inputClass } from './ui';

export function ProfilePanel({ db, uid }: { db: Firestore; uid: string }) {
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setError(null);
    try {
      const snapshot = await getDoc(doc(db, 'users', uid));
      if (snapshot.exists()) {
        const data = snapshot.data();
        setDisplayName(typeof data.displayName === 'string' ? data.displayName : '');
        setBio(typeof data.bio === 'string' ? data.bio : '');
      } else {
        // First visit: let the rules-visible document exist before any update.
        await api.ensureProfile();
      }
      setUsage(await api.usageSummary());
    } catch (cause) {
      setError(normalizeError(cause));
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  const save = async () => {
    setLoading(true);
    setStatus(null);
    setError(null);
    try {
      const { updated } = await api.updateProfile({ displayName, bio });
      setStatus(`Profile saved (${updated.join(', ')}).`);
      await load();
    } catch (cause) {
      setError(normalizeError(cause));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card
      title="Profile and usage"
      description="Firestore rules allow you to edit only displayName, bio and preferences on your own profile document."
      footer={
        <span>
          Usage events are append-only in your own subcollection: readable by you, writable by you,
          never shared with another uid.
        </span>
      }
    >
      <Field label="Display name">
        <input
          className={inputClass}
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          maxLength={80}
          placeholder="Your name"
        />
      </Field>
      <Field label="Bio" hint="Maximum 280 characters (enforced in rules and on the client).">
        <textarea
          className={`${inputClass} min-h-20 resize-y`}
          value={bio}
          onChange={(event) => setBio(event.target.value)}
          maxLength={280}
        />
      </Field>
      <div className="flex items-center gap-2">
        <Button onClick={() => void save()} disabled={loading}>
          {loading ? 'Saving…' : 'Save profile'}
        </Button>
        {status ? <span className="text-sm text-emerald-300">{status}</span> : null}
      </div>
      <ErrorBanner
        message={
          error ? `${error.message}${error.code !== 'unknown' ? ` (${error.code})` : ''}` : null
        }
      />

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-200">AI usage</h3>
        {usage ? (
          <p className="text-xs text-slate-500">
            {usage.totalEvents ?? 0} events recorded (counted with a Firestore count() aggregation).
          </p>
        ) : null}
        {usage && usage.months.length > 0 ? (
          <ul className="space-y-1 text-sm text-slate-300">
            {usage.months.map((month) => (
              <li key={month.id} className="flex justify-between border-b border-slate-800 pb-1">
                <span>{month.month ?? month.id}</span>
                <span className="text-slate-400">
                  {month.requests ?? 0} requests · {month.tokens ?? 0} tokens
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">No AI calls recorded for this account yet.</p>
        )}
      </div>
    </Card>
  );
}
