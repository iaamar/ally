'use client';

import { useState } from 'react';

interface DeleteAccountProps {
  email: string;
  counts: {
    projects: number;
    scans: number;
    keys: number;
  };
}

export function DeleteAccount({ email, counts }: DeleteAccountProps) {
  const [expanded, setExpanded] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const confirmed =
    Boolean(email) && confirmation.trim().toLowerCase() === email.toLowerCase();

  async function deleteAccount() {
    if (!confirmed || busy) return;
    setBusy(true);
    setError('');

    try {
      const response = await fetch('/api/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: confirmation.trim() }),
      });
      const payload = await response.json().catch(() => null) as
        | { error?: string }
        | null;
      if (!response.ok) {
        throw new Error(payload?.error ?? `Deletion failed (${response.status}).`);
      }
      window.location.assign('/login');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Deletion failed.');
      setBusy(false);
    }
  }

  return (
    <div className="card settings-card settings-card--danger">
      <h2 className="settings-card__title settings-card__title--danger">
        Delete account
      </h2>
      <p className="danger-copy">
        Permanently deletes your login, {counts.projects} project
        {counts.projects === 1 ? '' : 's'}, {counts.scans} scan
        {counts.scans === 1 ? '' : 's'}, every finding, and {counts.keys} API key
        {counts.keys === 1 ? '' : 's'}. This cannot be undone.
      </p>

      {!expanded ? (
        <button type="button" className="btn-danger" onClick={() => setExpanded(true)}>
          Delete my account
        </button>
      ) : (
        <div className="danger-confirm">
          <label htmlFor="delete-account-email" className="danger-label">
            Type <strong className="detail-mono">{email}</strong> to confirm
          </label>
          <input
            id="delete-account-email"
            className="danger-input"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            autoComplete="off"
            spellCheck={false}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'delete-account-error' : undefined}
          />
          {error && (
            <p id="delete-account-error" className="danger-error" role="alert">
              {error}
            </p>
          )}
          <div className="danger-actions">
            <button
              type="button"
              className="btn-danger"
              disabled={!confirmed || busy}
              onClick={deleteAccount}
            >
              {busy ? 'Deleting…' : 'Permanently delete'}
            </button>
            <button
              type="button"
              className="btn-ghost"
              disabled={busy}
              onClick={() => {
                setExpanded(false);
                setConfirmation('');
                setError('');
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
