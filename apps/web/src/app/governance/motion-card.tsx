// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, useTransition } from 'react'
import { Alert, Button, Heading, StatusPill, Text } from '@tahti/ui'
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

const CHOICES: Array<{ value: 'YES' | 'NO' | 'ABSTAIN'; label: string }> = [
  { value: 'YES', label: 'For' },
  { value: 'NO', label: 'Against' },
  { value: 'ABSTAIN', label: 'Abstain' },
]

export default function MotionCard({
  motion,
  motionRef,
  totalMembers,
  isBoard,
}: {
  motion: MotionSummary
  /** Display id, e.g. "M-2026-03". */
  motionRef: string
  totalMembers: number
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

  if (motion.state === 'DRAFT') {
    return (
      <article className="gov-motion-card">
        <div className="gov-motion-card__header">
          <Heading level={3} className="gov-motion-card__title">
            {motionRef} · {motion.title}
          </Heading>
          <StatusPill tone="amber">Discussion · 7-day circulation</StatusPill>
        </div>
        <Text size="sm" tone="muted">
          Voting opens {new Date(motion.openAt).toLocaleDateString('fi-FI')} after circulation
          period (bylaws §9).
        </Text>
        {isBoard && (
          <div className="gov-motion-card__actions">
            <Button variant="ghost" size="sm" disabled={pending} onClick={() => transition('OPEN')}>
              Open voting
            </Button>
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

  if (motion.state === 'OPEN') {
    return (
      <article className="gov-motion-card gov-motion-card--open">
        <div className="gov-motion-card__header">
          <Heading level={3} className="gov-motion-card__title">
            {motionRef} · {motion.title}
          </Heading>
          <StatusPill tone="green">Voting open</StatusPill>
        </div>
        <Text size="sm" tone="muted">
          Proposed by {motion.proposer} · closes{' '}
          {new Date(motion.closeAt).toLocaleDateString('fi-FI')}
          {motion.advisory && ' · advisory'}
        </Text>

        {motion.youVoted ? (
          <Text tone="success" size="sm">
            ✓ You voted · change before close
          </Text>
        ) : (
          <div className="gov-motion-card__vote-row">
            {CHOICES.map((c) => (
              <Button
                key={c.value}
                variant={c.value === 'YES' ? 'primary' : 'secondary'}
                size="sm"
                disabled={pending}
                onClick={() => vote(c.value)}
              >
                {c.label}
              </Button>
            ))}
            <span className="gov-motion-card__tally-note">
              {motion.totalVotes} of {totalMembers} members voted · tally revealed at close
            </span>
          </div>
        )}

        {isBoard && (
          <div className="gov-motion-card__actions">
            <Button
              variant="primary"
              size="sm"
              disabled={pending}
              onClick={() => transition('CLOSED')}
            >
              Close & publish result
            </Button>
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

  // CLOSED
  const tally = motion.tally
  const totalCast = tally ? tally.YES + tally.NO + tally.ABSTAIN : 0
  const pctFor = totalCast > 0 ? Math.round(((tally?.YES ?? 0) / totalCast) * 100) : 0
  const passed = (tally?.YES ?? 0) > (tally?.NO ?? 0)

  return (
    <article className="gov-motion-card gov-motion-card--closed">
      <div className="gov-motion-card__header">
        <Heading level={3} className="gov-motion-card__title gov-motion-card__title--closed">
          {motionRef} · {motion.title}
        </Heading>
        <StatusPill tone={passed ? 'cyan' : 'coral'}>
          {passed ? `Passed · ${pctFor}% for` : 'Failed'}
        </StatusPill>
      </div>
      {tally && (
        <Text size="sm" tone="muted">
          {totalCast} of {totalMembers} members voted · {tally.YES} for · {tally.NO} against ·{' '}
          {tally.ABSTAIN} abstained
          {motion.advisory && ' (advisory — not legally binding)'}
        </Text>
      )}
    </article>
  )
}
