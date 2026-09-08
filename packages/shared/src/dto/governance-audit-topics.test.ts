// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it } from 'vitest'
import {
  actionsForGovernanceAuditTopic,
  describeGovernanceAuditItem,
  GOVERNANCE_AUDIT_ACTIONS,
  GOVERNANCE_AUDIT_TOPICS,
  redactSecretBallotAuditMeta,
  topicForAuditAction,
} from './governance-audit-topics.js'

describe('governance audit topics', () => {
  it('maps finance, subscription, and meeting actions onto topics', () => {
    expect(topicForAuditAction('LEDGER_ENTRY_CREATE')).toBe('finance')
    expect(topicForAuditAction('FAN_SUBSCRIPTION_CREATE')).toBe('subscriptions')
    expect(topicForAuditAction('MEETING_CREATE')).toBe('meetings')
    expect(topicForAuditAction('CHAT_BAN')).toBeNull()
  })

  it('maps notices, minutes-workflow, and official-vote actions onto their own topics', () => {
    expect(topicForAuditAction('MEETING_NOTICE_PUBLISH')).toBe('notices')
    expect(topicForAuditAction('MINUTES_UPLOAD')).toBe('minutes')
    expect(topicForAuditAction('MINUTES_APPROVE')).toBe('minutes')
    expect(topicForAuditAction('MINUTES_SIGN')).toBe('minutes')
    expect(topicForAuditAction('RESOLUTION_CREATE')).toBe('official-votes')
    expect(topicForAuditAction('RESOLUTION_UPDATE')).toBe('official-votes')
  })

  it('keeps vote-change and vote-retract actions in the same topic as the original ballot', () => {
    expect(topicForAuditAction('VOTE_CHANGE')).toBe('decisions')
    expect(topicForAuditAction('VOTE_RETRACT')).toBe('decisions')
  })

  it('returns all governance actions when no topic is selected', () => {
    const all = actionsForGovernanceAuditTopic()
    expect(all).toEqual(GOVERNANCE_AUDIT_ACTIONS)
    expect(all).toContain('GRANT_RUN')
    expect(all).not.toContain('USER_LOGIN')
  })

  it('rejects unknown topic ids', () => {
    expect(actionsForGovernanceAuditTopic('not-a-topic')).toBeNull()
  })

  it('keeps topic action lists unique across the catalog', () => {
    const seen = new Set<string>()
    for (const topic of GOVERNANCE_AUDIT_TOPICS) {
      for (const action of topic.actions) {
        expect(seen.has(action)).toBe(false)
        seen.add(action)
      }
    }
  })

  it('redacts ballot choice from vote audit meta, including change/retract', () => {
    expect(redactSecretBallotAuditMeta('VOTE_CAST', { choice: 'YES' })).toEqual({
      ballot: 'secret',
    })
    expect(redactSecretBallotAuditMeta('VOTE_CHANGE', { choice: 'NO' })).toEqual({
      ballot: 'secret',
    })
    expect(redactSecretBallotAuditMeta('VOTE_RETRACT', { choice: 'ABSTAIN' })).toEqual({
      ballot: 'secret',
    })
    expect(redactSecretBallotAuditMeta('GRANT_RUN', { year: 2026 })).toEqual({ year: 2026 })
  })

  it('describes a ledger row for LogViewer', () => {
    const line = describeGovernanceAuditItem({
      action: 'LEDGER_ENTRY_CREATE',
      actorDisplayName: 'Aino Board',
      actorUsername: 'aino',
      actorId: 'user-1',
      targetId: 'entry-9',
      meta: { amountCents: 4000 },
    })
    expect(line.source).toBe('Finance & grants')
    expect(line.title).toBe('Ledger entry created')
    expect(line.detail).toContain('Aino Board')
    expect(line.detail).toContain('entry-9')
  })
})
