// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import { createNewsletterDraft, sendNewsletterDraft } from './actions'

interface SubscriberStats {
  total: number
  confirmed: number
  newLast30Days: number
}

interface DraftRow {
  id: string
  subject: string
  state: string
  sentAt: string | null
  createdAt: string
  subscribersOnly: boolean
  _count: { sends: number }
}

export default function NewsletterPanel({
  initialStats,
  initialDrafts,
  hasFanNewsletterPerk,
  tier,
}: {
  initialStats: SubscriberStats
  initialDrafts: DraftRow[]
  hasFanNewsletterPerk: boolean
  tier: string
}) {
  const [stats] = useState(initialStats)
  const [drafts, setDrafts] = useState(initialDrafts)
  const [subject, setSubject] = useState('')
  const [bodyMd, setBodyMd] = useState('')
  const [subscribersOnly, setSubscribersOnly] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const weeklyHint =
    tier === 'STUDIO'
      ? 'Unlimited sends per week (Studio tier).'
      : tier === 'ARTIST'
        ? 'Up to 4 newsletters per week (Artist tier).'
        : 'Up to 1 newsletter per week (Free tier).'

  async function handleCreate() {
    const subj = subject.trim()
    const body = bodyMd.trim()
    if (!subj || !body) return
    if (subscribersOnly && !hasFanNewsletterPerk) {
      setError('Add FAN_NEWSLETTER to a fan tier before creating fan-only drafts.')
      return
    }
    setSaving(true)
    setError(null)
    setMessage(null)
    const result = await createNewsletterDraft({ subject: subj, bodyMd: body, subscribersOnly })
    if (result.error) {
      setError(result.error)
    } else if (result.draft) {
      setDrafts((prev) => [result.draft!, ...prev])
      setSubject('')
      setBodyMd('')
      setSubscribersOnly(false)
      setMessage('Draft saved.')
    }
    setSaving(false)
  }

  async function handleSend(draftId: string, audience: 'all' | 'fans') {
    setSendingId(draftId)
    setError(null)
    setMessage(null)
    const result = await sendNewsletterDraft({ draftId, audience })
    if (result.error) {
      setError(result.error)
    } else {
      setDrafts((prev) =>
        prev.map((d) =>
          d.id === draftId
            ? {
                ...d,
                state: 'QUEUED',
                _count: { sends: result.queued ?? d._count.sends },
              }
            : d,
        ),
      )
      setMessage(
        result.queued != null
          ? `Queued for ${result.queued} ${result.audience === 'fans' ? 'fan ' : ''}subscriber${result.queued === 1 ? '' : 's'}.`
          : 'Newsletter queued.',
      )
    }
    setSendingId(null)
  }

  return (
    <div
      style={{ marginTop: '2rem', padding: '1.5rem', border: '1px solid #eee', borderRadius: 8 }}
    >
      <h2 style={{ margin: '0 0 0.5rem' }}>Newsletter</h2>
      <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#666' }}>
        Email your subscribers from your artist profile. {weeklyHint}
      </p>

      <div
        style={{
          display: 'flex',
          gap: '1.5rem',
          marginBottom: '1.25rem',
          fontSize: '0.875rem',
          flexWrap: 'wrap',
        }}
      >
        <span>
          <strong>{stats.confirmed}</strong> confirmed
        </span>
        <span style={{ color: '#888' }}>{stats.total} total signups</span>
        <span style={{ color: '#888' }}>+{stats.newLast30Days} last 30 days</span>
      </div>

      <div style={{ marginBottom: '1.25rem' }}>
        <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.35rem' }}>
          Subject
        </label>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={200}
          disabled={saving}
          style={{
            width: '100%',
            padding: '0.45rem 0.6rem',
            border: '1px solid #ccc',
            borderRadius: 4,
            fontSize: '0.875rem',
            boxSizing: 'border-box',
          }}
        />
      </div>

      <div style={{ marginBottom: '0.75rem' }}>
        <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.35rem' }}>
          Body (Markdown)
        </label>
        <textarea
          value={bodyMd}
          onChange={(e) => setBodyMd(e.target.value)}
          rows={6}
          disabled={saving}
          style={{
            width: '100%',
            padding: '0.45rem 0.6rem',
            border: '1px solid #ccc',
            borderRadius: 4,
            fontSize: '0.875rem',
            fontFamily: 'inherit',
            boxSizing: 'border-box',
          }}
        />
      </div>

      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.875rem',
          marginBottom: '0.75rem',
          cursor: hasFanNewsletterPerk ? 'pointer' : 'not-allowed',
          opacity: hasFanNewsletterPerk ? 1 : 0.6,
        }}
      >
        <input
          type="checkbox"
          checked={subscribersOnly}
          onChange={(e) => setSubscribersOnly(e.target.checked)}
          disabled={!hasFanNewsletterPerk || saving}
        />
        Fan subscribers only (requires FAN_NEWSLETTER on a fan tier)
      </label>

      <button
        type="button"
        onClick={() => void handleCreate()}
        disabled={saving || !subject.trim() || !bodyMd.trim()}
        style={{
          padding: '0.45rem 1rem',
          background: '#111',
          color: '#fff',
          border: 'none',
          borderRadius: 4,
          cursor: 'pointer',
          fontSize: '0.875rem',
          opacity: saving || !subject.trim() || !bodyMd.trim() ? 0.5 : 1,
        }}
      >
        {saving ? 'Saving…' : 'Save draft'}
      </button>

      {drafts.length > 0 && (
        <div style={{ marginTop: '1.5rem' }}>
          <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>Drafts & sends</h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {drafts.map((d) => (
              <li
                key={d.id}
                style={{
                  padding: '0.75rem',
                  marginBottom: '0.5rem',
                  border: '1px solid #eee',
                  borderRadius: 6,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                  <div>
                    <strong style={{ fontSize: '0.9rem' }}>{d.subject}</strong>
                    {d.subscribersOnly && (
                      <span
                        style={{
                          marginLeft: '0.5rem',
                          fontSize: '0.75rem',
                          background: '#fef3c7',
                          padding: '0.1rem 0.4rem',
                          borderRadius: 3,
                        }}
                      >
                        fans only
                      </span>
                    )}
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#888' }}>
                      {d.state === 'DRAFT' && 'Draft'}
                      {d.state === 'QUEUED' && 'Sending…'}
                      {d.state === 'SENT' &&
                        `Sent ${d.sentAt ? new Date(d.sentAt).toLocaleDateString() : ''} · ${d._count.sends} recipients`}
                    </p>
                  </div>
                  {d.state === 'DRAFT' && (
                    <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                      {d.subscribersOnly ? (
                        <SendButton
                          label="Send to fans"
                          disabled={sendingId === d.id}
                          onClick={() => void handleSend(d.id, 'fans')}
                        />
                      ) : (
                        <>
                          <SendButton
                            label="Send to all"
                            disabled={sendingId === d.id}
                            onClick={() => void handleSend(d.id, 'all')}
                          />
                          {hasFanNewsletterPerk && (
                            <SendButton
                              label="Send to fans"
                              disabled={sendingId === d.id}
                              secondary
                              onClick={() => void handleSend(d.id, 'fans')}
                            />
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <p style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: '0.75rem' }}>{error}</p>
      )}
      {message && (
        <p style={{ color: '#16a34a', fontSize: '0.8rem', marginTop: '0.75rem' }}>{message}</p>
      )}
    </div>
  )
}

function SendButton({
  label,
  onClick,
  disabled,
  secondary,
}: {
  label: string
  onClick: () => void
  disabled: boolean
  secondary?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '0.35rem 0.65rem',
        background: secondary ? '#fff' : '#2563eb',
        color: secondary ? '#2563eb' : '#fff',
        border: secondary ? '1px solid #2563eb' : 'none',
        borderRadius: 4,
        cursor: disabled ? 'default' : 'pointer',
        fontSize: '0.8rem',
        opacity: disabled ? 0.5 : 1,
        whiteSpace: 'nowrap',
      }}
    >
      {disabled ? 'Sending…' : label}
    </button>
  )
}
