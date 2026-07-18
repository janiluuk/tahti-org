// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, useTransition } from 'react'
import { Alert, Button, Heading, StatusPill, Text, Textarea } from '@tahti/ui'
import {
  type FeatureRequestCommentRef,
  type FeatureRequestRef,
  listFeatureRequestComments,
  postFeatureRequestComment,
  unvoteFeatureRequest,
  voteFeatureRequest,
} from './actions'

const STATUS_TONE: Record<string, 'green' | 'amber' | 'purple' | 'coral' | 'cyan'> = {
  OPEN: 'cyan',
  PLANNED: 'amber',
  IN_PROGRESS: 'purple',
  DONE: 'green',
  DECLINED: 'coral',
  DUPLICATE: 'coral',
}

const STATUS_LABEL: Record<string, string> = {
  OPEN: 'Open',
  PLANNED: 'Planned',
  IN_PROGRESS: 'In progress',
  DONE: 'Done',
  DECLINED: 'Declined',
  DUPLICATE: 'Duplicate',
}

function DiscussionThread({ request }: { request: FeatureRequestRef }) {
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [comments, setComments] = useState<FeatureRequestCommentRef[]>([])
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function toggle() {
    const next = !open
    setOpen(next)
    if (next && !loaded) {
      startTransition(async () => {
        const res = await listFeatureRequestComments(request.id)
        if (res.error) setError(res.error)
        else setComments(res.comments)
        setLoaded(true)
      })
    }
  }

  function submit() {
    const body = draft.trim()
    if (!body) return
    setError(null)
    startTransition(async () => {
      const res = await postFeatureRequestComment(request.id, body)
      if (res.error || !res.comment) {
        setError(res.error ?? 'Failed to post comment')
      } else {
        setComments((prev) => [...prev, res.comment!])
        setDraft('')
      }
    })
  }

  return (
    <div className="gov-motion-card__discussion">
      <button type="button" className="gov-motion-card__discussion-toggle" onClick={toggle}>
        {open ? '▾' : '▸'}{' '}
        {request.commentCount === 0
          ? 'No comments yet'
          : `${request.commentCount} comment${request.commentCount === 1 ? '' : 's'}`}
      </button>

      {open && (
        <div className="gov-motion-card__discussion-body">
          {pending && !loaded && (
            <Text size="sm" tone="muted">
              Loading…
            </Text>
          )}
          {comments.length > 0 && (
            <ul className="gov-motion-card__comment-list">
              {comments.map((c) => (
                <li key={c.id} className="gov-motion-card__comment">
                  <Text size="sm" className="gov-motion-card__comment-meta">
                    <strong>{c.authorDisplayName ?? 'Former member'}</strong> ·{' '}
                    {new Date(c.createdAt).toLocaleDateString('fi-FI')}
                  </Text>
                  <Text size="sm">{c.body}</Text>
                </li>
              ))}
            </ul>
          )}

          <div className="gov-motion-card__comment-form">
            <Textarea
              rows={2}
              maxLength={2000}
              placeholder="Add to the discussion…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={pending}
            />
            <Button
              variant="secondary"
              size="sm"
              disabled={pending || !draft.trim()}
              onClick={submit}
            >
              Post
            </Button>
          </div>

          {error && (
            <Alert variant="error" className="brand-card__error">
              {error}
            </Alert>
          )}
        </div>
      )}
    </div>
  )
}

export default function FeatureRequestCard({ request }: { request: FeatureRequestRef }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function toggleVote() {
    setError(null)
    startTransition(async () => {
      const res = request.youVoted
        ? await unvoteFeatureRequest(request.id)
        : await voteFeatureRequest(request.id)
      if (res.error) setError(res.error)
    })
  }

  return (
    <article className="gov-motion-card">
      <div className="gov-motion-card__header">
        <Heading level={3} className="gov-motion-card__title">
          {request.title}
        </Heading>
        <StatusPill tone={STATUS_TONE[request.status] ?? 'cyan'}>
          {STATUS_LABEL[request.status] ?? request.status}
        </StatusPill>
      </div>

      <Text size="sm" tone="muted">
        Proposed by {request.proposer} · {new Date(request.createdAt).toLocaleDateString('fi-FI')}
      </Text>

      <Text size="sm">{request.description}</Text>

      {request.status === 'DUPLICATE' && request.mergedIntoTitle && (
        <Text size="sm" tone="muted">
          Merged into <strong>{request.mergedIntoTitle}</strong> — vote there instead.
        </Text>
      )}

      {request.reviewNote && (
        <Text size="sm" tone="muted">
          Board note: {request.reviewNote}
        </Text>
      )}

      {request.status !== 'DUPLICATE' && (
        <div className="gov-motion-card__vote-row">
          <Button
            variant={request.youVoted ? 'secondary' : 'primary'}
            size="sm"
            disabled={pending}
            onClick={toggleVote}
          >
            {request.youVoted ? '✓ Voted' : 'Vote'} · {request.voteCount}
          </Button>
        </div>
      )}

      {error && (
        <Alert variant="error" className="brand-card__error">
          {error}
        </Alert>
      )}

      <DiscussionThread request={request} />
    </article>
  )
}
