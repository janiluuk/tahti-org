// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, useTransition } from 'react'
import { Alert, Button, Heading, Text } from '@tahti/ui'
import { castVote, transitionMotion } from './actions'

export interface MotionSummary {
  id: string
  title: string
  state: 'DRAFT' | 'OPEN' | 'CLOSED'
  advisory: boolean
  openAt: string
  closeAt: string
  proposer: string
  totalVotes: number
  youVoted: boolean
  yourChoice: 'YES' | 'NO' | 'ABSTAIN' | null
  tally?: { YES: number; NO: number; ABSTAIN: number }
}

const CHOICES: Array<'YES' | 'NO' | 'ABSTAIN'> = ['YES', 'NO', 'ABSTAIN']

export default function MotionCard({
  motion,
  isBoard,
}: {
  motion: MotionSummary
  isBoard: boolean
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function vote(choice: 'YES' | 'NO' | 'ABSTAIN') {
    setError(null)
    startTransition(async () => {
      const res = await castVote(motion.id, choice)
      if (res.error) setError(res.error)
    })
  }

  function transition(state: 'OPEN' | 'CLOSED') {
    setError(null)
    startTransition(async () => {
      const res = await transitionMotion(motion.id, state)
      if (res.error) setError(res.error)
    })
  }

  const statusClass = `brand-motion-status brand-motion-status--${motion.state.toLowerCase()}`

  return (
    <article className="brand-card">
      <div className="brand-card__header">
        <Heading level={3}>{motion.title}</Heading>
        <span className={statusClass}>{motion.state}</span>
      </div>
      <p className="brand-card__meta">
        Proposed by {motion.proposer} · closes{' '}
        {new Date(motion.closeAt).toLocaleDateString('fi-FI')}
        {motion.advisory && ' · advisory'}
      </p>

      {motion.state === 'OPEN' &&
        (motion.youVoted ? (
          <Text tone="success" size="sm">
            You voted <strong>{motion.yourChoice}</strong>.
          </Text>
        ) : (
          <div className="brand-vote-row">
            {CHOICES.map((c) => (
              <Button key={c} variant="ghost" size="sm" disabled={pending} onClick={() => vote(c)}>
                {c}
              </Button>
            ))}
          </div>
        ))}

      {motion.state === 'CLOSED' && motion.tally && (
        <Text size="sm">
          Result: <strong>{motion.tally.YES}</strong> yes · <strong>{motion.tally.NO}</strong> no ·{' '}
          <strong>{motion.tally.ABSTAIN}</strong> abstain
          {motion.advisory && (
            <span className="brand-muted"> (advisory — not legally binding)</span>
          )}
        </Text>
      )}

      {motion.state === 'DRAFT' && (
        <Text size="sm" tone="muted">
          Not yet open for voting.
        </Text>
      )}

      {isBoard && motion.state !== 'CLOSED' && (
        <div className="brand-board-actions">
          {motion.state === 'DRAFT' && (
            <Button variant="ghost" size="sm" disabled={pending} onClick={() => transition('OPEN')}>
              Open voting
            </Button>
          )}
          {motion.state === 'OPEN' && (
            <Button
              variant="primary"
              size="sm"
              disabled={pending}
              onClick={() => transition('CLOSED')}
            >
              Close & publish result
            </Button>
          )}
        </div>
      )}

      {error && (
        <Alert variant="error" className="brand-card__error">
          {error}
        </Alert>
      )}
    </article>
  )
}
