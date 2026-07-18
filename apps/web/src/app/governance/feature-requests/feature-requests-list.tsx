// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, useTransition } from 'react'
import { Alert, Button, Input, Textarea } from '@tahti/ui'
import { type FeatureRequestRef, createFeatureRequest } from './actions'
import FeatureRequestCard from './feature-request-card'

function NewFeatureRequestForm({ onCreated }: { onCreated: (r: FeatureRequestRef) => void }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit() {
    if (!title.trim() || !description.trim()) {
      setError('Title and description are required')
      return
    }
    setError(null)
    startTransition(async () => {
      const res = await createFeatureRequest({
        title: title.trim(),
        description: description.trim(),
      })
      if (res.error || !res.request) {
        setError(res.error ?? 'Failed to submit')
        return
      }
      onCreated(res.request)
      setTitle('')
      setDescription('')
      setOpen(false)
    })
  }

  if (!open) {
    return (
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
        Suggest a feature
      </Button>
    )
  }

  return (
    <div className="gov-motion-card__comment-form">
      <Input
        placeholder="Feature title"
        maxLength={150}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        disabled={pending}
      />
      <Textarea
        rows={3}
        maxLength={3000}
        placeholder="What should Tahti build, and why?"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        disabled={pending}
      />
      <div className="gov-motion-card__vote-row">
        <Button variant="primary" size="sm" disabled={pending} onClick={submit}>
          {pending ? 'Submitting…' : 'Submit'}
        </Button>
        <Button variant="ghost" size="sm" disabled={pending} onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      {error && (
        <Alert variant="error" className="brand-card__error">
          {error}
        </Alert>
      )}
    </div>
  )
}

export default function FeatureRequestsList({
  initialRequests,
}: {
  initialRequests: FeatureRequestRef[]
}) {
  const [requests, setRequests] = useState(initialRequests)

  return (
    <>
      <NewFeatureRequestForm onCreated={(r) => setRequests((prev) => [r, ...prev])} />

      {requests.length === 0 ? (
        <div className="public-empty-card">
          <p className="public-empty-card__text">No feature requests yet.</p>
          <p className="public-empty-card__hint">Be the first to suggest one.</p>
        </div>
      ) : (
        requests.map((r) => <FeatureRequestCard key={r.id} request={r} />)
      )}
    </>
  )
}
