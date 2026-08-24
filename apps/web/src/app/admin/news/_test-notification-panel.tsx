// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import { Button, Field, Input } from '@tahti/ui'
import { sendTestNotification } from './actions'

export function TestNotificationPanel() {
  const [targetUsername, setTargetUsername] = useState('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [url, setUrl] = useState('')
  const [target, setTarget] = useState<'user' | 'group'>('user')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function handleSend() {
    setPending(true)
    setError(null)
    setSent(false)
    const result = await sendTestNotification({
      targetUsername: targetUsername.trim(),
      title: title.trim(),
      body: body.trim() || undefined,
      url: url.trim() || undefined,
    })
    setPending(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setSent(true)
  }

  return (
    <div>
      <p className="admin-text-muted">
        Send a one-off notification to check how it looks and behaves for the recipient.
      </p>

      <div className="admin-row" role="radiogroup" aria-label="Target" style={{ gap: '1rem' }}>
        <label>
          <input type="radio" checked={target === 'user'} onChange={() => setTarget('user')} />{' '}
          Single user
        </label>
        <label>
          <input
            type="radio"
            disabled
            checked={target === 'group'}
            onChange={() => setTarget('group')}
          />{' '}
          Group (coming soon)
        </label>
      </div>

      {target === 'user' && (
        <>
          <Field label="Username">
            <Input value={targetUsername} onChange={(e) => setTargetUsername(e.target.value)} />
          </Field>
          <Field label="Title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Body (optional)">
            <Input value={body} onChange={(e) => setBody(e.target.value)} />
          </Field>
          <Field label="Link URL (optional)">
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="/dashboard" />
          </Field>
          <Button
            variant="primary"
            disabled={pending || !targetUsername.trim() || !title.trim()}
            onClick={() => void handleSend()}
          >
            {pending ? 'Sending…' : 'Send'}
          </Button>
          {sent && <p className="studio-notice studio-notice--success studio-mt-sm">Sent.</p>}
          {error && <p className="admin-form-error">{error}</p>}
        </>
      )}
    </div>
  )
}
