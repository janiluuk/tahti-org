// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, useTransition } from 'react'
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

const stateColor: Record<MotionSummary['state'], string> = {
  DRAFT: '#888',
  OPEN: '#16a34a',
  CLOSED: '#2563eb',
}

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

  return (
    <article
      style={{
        padding: '1.25rem 1.5rem',
        border: '1px solid #eee',
        borderRadius: 8,
        marginBottom: '1rem',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h3 style={{ margin: 0, fontSize: '1.05rem' }}>{motion.title}</h3>
        <span
          style={{
            fontSize: '0.7rem',
            fontWeight: 700,
            letterSpacing: '0.05em',
            color: stateColor[motion.state],
          }}
        >
          {motion.state}
        </span>
      </div>
      <p style={{ margin: '0.25rem 0 0.75rem', fontSize: '0.8rem', color: '#888' }}>
        Proposed by {motion.proposer} · closes{' '}
        {new Date(motion.closeAt).toLocaleDateString('fi-FI')}
        {motion.advisory && ' · advisory'}
      </p>

      {motion.state === 'OPEN' &&
        (motion.youVoted ? (
          <p style={{ fontSize: '0.875rem', color: '#16a34a', margin: 0 }}>
            You voted <strong>{motion.yourChoice}</strong>.
          </p>
        ) : (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {CHOICES.map((c) => (
              <button
                key={c}
                disabled={pending}
                onClick={() => vote(c)}
                style={{
                  padding: '0.4rem 0.9rem',
                  border: '1px solid #ccc',
                  borderRadius: 4,
                  background: '#fff',
                  cursor: pending ? 'default' : 'pointer',
                  fontSize: '0.8rem',
                }}
              >
                {c}
              </button>
            ))}
          </div>
        ))}

      {motion.state === 'CLOSED' && motion.tally && (
        <div style={{ fontSize: '0.875rem', color: '#444' }}>
          Result: <strong>{motion.tally.YES}</strong> yes · <strong>{motion.tally.NO}</strong> no ·{' '}
          <strong>{motion.tally.ABSTAIN}</strong> abstain
          {motion.advisory && (
            <span style={{ color: '#aaa' }}> (advisory — not legally binding)</span>
          )}
        </div>
      )}

      {motion.state === 'DRAFT' && (
        <p style={{ fontSize: '0.8rem', color: '#aaa', margin: 0 }}>Not yet open for voting.</p>
      )}

      {isBoard && motion.state !== 'CLOSED' && (
        <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
          {motion.state === 'DRAFT' && (
            <button
              disabled={pending}
              onClick={() => transition('OPEN')}
              style={boardBtn('#16a34a')}
            >
              Open voting
            </button>
          )}
          {motion.state === 'OPEN' && (
            <button
              disabled={pending}
              onClick={() => transition('CLOSED')}
              style={boardBtn('#2563eb')}
            >
              Close & publish result
            </button>
          )}
        </div>
      )}

      {error && (
        <p style={{ color: '#dc2626', fontSize: '0.8rem', margin: '0.5rem 0 0' }}>{error}</p>
      )}
    </article>
  )
}

function boardBtn(color: string): React.CSSProperties {
  return {
    padding: '0.35rem 0.8rem',
    border: `1px solid ${color}`,
    borderRadius: 4,
    background: '#fff',
    color,
    cursor: 'pointer',
    fontSize: '0.78rem',
  }
}
