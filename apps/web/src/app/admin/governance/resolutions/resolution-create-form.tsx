// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import { createResolution } from '../../actions'

export function ResolutionCreateForm() {
  const [msg, setMsg] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    setMsg(null)
    const fd = new FormData(e.currentTarget)
    const { error } = await createResolution({
      title: String(fd.get('title')),
      body: String(fd.get('body')),
      votedAt: String(fd.get('votedAt')),
      outcome: String(fd.get('outcome')),
      voteFor: Number(fd.get('voteFor')),
      voteAgainst: Number(fd.get('voteAgainst')),
      voteAbstain: Number(fd.get('voteAbstain')),
    })
    setPending(false)
    if (error) {
      setMsg(error)
      return
    }
    window.location.reload()
  }

  return (
    <form onSubmit={onSubmit} className="admin-card" style={{ marginBottom: '1.5rem' }}>
      <h2>New resolution</h2>
      <div style={{ display: 'grid', gap: '0.75rem', maxWidth: '40rem' }}>
        <label>
          Title
          <input name="title" required maxLength={200} />
        </label>
        <label>
          Body (Markdown)
          <textarea name="body" required rows={6} />
        </label>
        <label>
          Voted at
          <input name="votedAt" type="datetime-local" required />
        </label>
        <label>
          Outcome
          <select name="outcome" defaultValue="PASSED">
            <option value="PASSED">Passed</option>
            <option value="FAILED">Failed</option>
            <option value="DEFERRED">Deferred</option>
          </select>
        </label>
        <label>
          Votes for
          <input name="voteFor" type="number" min={0} defaultValue={0} required />
        </label>
        <label>
          Votes against
          <input name="voteAgainst" type="number" min={0} defaultValue={0} required />
        </label>
        <label>
          Abstain
          <input name="voteAbstain" type="number" min={0} defaultValue={0} required />
        </label>
        <button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save draft'}
        </button>
        {msg ? <p className="admin-err">{msg}</p> : null}
      </div>
    </form>
  )
}
