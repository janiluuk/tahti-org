// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/**
 * Realistic end-to-end coverage of the member-governance system: 10 members + 1
 * board account, multiple motions with varied vote outcomes, the full
 * propose -> open -> vote -> close -> tally lifecycle, the discussion/comment
 * thread, and the manual bridge to the public transparency page
 * (BoardResolution). Complements the narrower boundary-condition tests in
 * motions.test.ts.
 *
 * Also exercises two known gaps on purpose (see comments below): voting twice
 * is rejected even though the UI implies a vote can be changed, and a closed
 * Motion's tally does not automatically appear on the public transparency page.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { hashPassword } from '../../lib/password.js'
import { createSession } from '../../lib/session.js'

const PREFIX = 'gov-e2e-'

function cookie(sessionId: string) {
  return `tahti_session=${sessionId}`
}

interface Member {
  id: string
  username: string
  cookie: string
}

describe('Governance E2E — 10 members, multiple motions, full lifecycle', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let board: Member
  let members: Member[]

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()

    await prisma.motion.deleteMany({
      where: { proposer: { email: { startsWith: PREFIX } } },
    })
    await prisma.boardResolution.deleteMany({
      where: { createdBy: { email: { startsWith: PREFIX } } },
    })
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })

    const passwordHash = await hashPassword('testpassword')
    const maxMemberNumber = await prisma.user.aggregate({ _max: { memberNumber: true } })
    let nextNumber = (maxMemberNumber._max.memberNumber ?? 10_000) + 1

    async function createMember(n: number, isBoard: boolean): Promise<Member> {
      const username = isBoard ? `${PREFIX}board` : `${PREFIX}member-${n}`
      const user = await prisma.user.create({
        data: {
          email: `${PREFIX}${isBoard ? 'board' : `member-${n}`}@example.com`,
          passwordHash,
          username,
          displayName: isBoard ? 'Test Board Member' : `Test Member ${n}`,
          emailVerifiedAt: new Date(),
          isMember: true,
          isBoard,
          memberNumber: nextNumber++,
          memberSince: new Date(),
          membership: { create: { status: 'ACTIVE', activatedAt: new Date() } },
        },
      })
      const session = await createSession(prisma, user.id)
      return { id: user.id, username, cookie: cookie(session.id) }
    }

    board = await createMember(0, true)
    members = []
    for (let n = 1; n <= 10; n++) {
      members.push(await createMember(n, false))
    }
  })

  afterAll(async () => {
    await prisma.motion.deleteMany({
      where: { proposer: { email: { startsWith: PREFIX } } },
    })
    await prisma.boardResolution.deleteMany({
      where: { createdBy: { email: { startsWith: PREFIX } } },
    })
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })
    await app.close()
  })

  it('GAP (b): ordinary members cannot propose a motion — only board can', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/governance/motions',
      headers: { cookie: members[0].cookie },
      payload: {
        title: 'A feature a member wants to propose',
        description: 'Members cannot actually create motions under the current design.',
        openAt: new Date().toISOString(),
        closeAt: new Date(Date.now() + 86400000).toISOString(),
      },
    })
    expect(res.statusCode).toBe(403)
  })

  async function proposeAndOpen(title: string, description: string) {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/governance/motions',
      headers: { cookie: board.cookie },
      payload: {
        title,
        description,
        openAt: new Date(Date.now() - 1000).toISOString(),
        closeAt: new Date(Date.now() + 14 * 86400000).toISOString(),
      },
    })
    expect(createRes.statusCode).toBe(201)
    const motionId = createRes.json().id as string

    const openRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/governance/motions/${motionId}`,
      headers: { cookie: board.cookie },
      payload: { state: 'OPEN' },
    })
    expect(openRes.statusCode).toBe(200)
    return motionId
  }

  async function castVotes(motionId: string, choices: Array<'YES' | 'NO' | 'ABSTAIN'>) {
    for (let i = 0; i < choices.length; i++) {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/governance/motions/${motionId}/vote`,
        headers: { cookie: members[i].cookie },
        payload: { choice: choices[i] },
      })
      expect(res.statusCode).toBe(201)
    }
  }

  async function closeAndGetTally(motionId: string) {
    const closeRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/governance/motions/${motionId}`,
      headers: { cookie: board.cookie },
      payload: { state: 'CLOSED' },
    })
    expect(closeRes.statusCode).toBe(200)

    const detail = await app.inject({
      method: 'GET',
      url: `/api/v1/governance/motions/${motionId}`,
      headers: { cookie: board.cookie },
    })
    expect(detail.statusCode).toBe(200)
    return detail.json().tally as { YES: number; NO: number; ABSTAIN: number }
  }

  it('motion 1 (7 YES / 2 NO / 1 ABSTAIN) — tally matches votes cast exactly', async () => {
    const motionId = await proposeAndOpen(
      'Add lossless FLAC streaming for all listeners',
      'Proposal: enable FLAC as a listener-facing playback option, not just download.',
    )
    const choices: Array<'YES' | 'NO' | 'ABSTAIN'> = [
      'YES',
      'YES',
      'YES',
      'YES',
      'YES',
      'YES',
      'YES',
      'NO',
      'NO',
      'ABSTAIN',
    ]
    await castVotes(motionId, choices)
    const tally = await closeAndGetTally(motionId)
    expect(tally).toEqual({ YES: 7, NO: 2, ABSTAIN: 1 })

    // The list endpoint (not just the detail one) must also carry the tally —
    // the /governance page has no per-motion detail fetch, so this is the
    // only place a closed motion's result is ever shown.
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/v1/governance/motions',
      headers: { cookie: board.cookie },
    })
    const listed = (
      listRes.json() as Array<{ id: string; tally?: { YES: number; NO: number; ABSTAIN: number } }>
    ).find((m) => m.id === motionId)
    expect(listed?.tally).toEqual({ YES: 7, NO: 2, ABSTAIN: 1 })
  })

  it('motion 2 (3 YES / 6 NO / 1 ABSTAIN) — a motion that fails', async () => {
    const motionId = await proposeAndOpen(
      'Raise the distribution fee from €8 to €12 per release',
      'Proposal: increase per-release distribution fee to fund additional storage capacity.',
    )
    const choices: Array<'YES' | 'NO' | 'ABSTAIN'> = [
      'NO',
      'NO',
      'NO',
      'NO',
      'NO',
      'NO',
      'YES',
      'YES',
      'YES',
      'ABSTAIN',
    ]
    await castVotes(motionId, choices)
    const tally = await closeAndGetTally(motionId)
    expect(tally).toEqual({ YES: 3, NO: 6, ABSTAIN: 1 })
    expect(tally.NO).toBeGreaterThan(tally.YES) // fails
  })

  it('motion 3 (5 YES / 5 NO) — an exact tie, board also votes', async () => {
    const motionId = await proposeAndOpen(
      'Switch grant disbursement from annual to quarterly',
      'Proposal: disburse grants four times a year instead of once, smaller amounts each time.',
    )
    const memberChoices: Array<'YES' | 'NO' | 'ABSTAIN'> = [
      'YES',
      'YES',
      'YES',
      'YES',
      'YES',
      'NO',
      'NO',
      'NO',
      'NO',
      'NO',
    ]
    await castVotes(motionId, memberChoices)
    // Board also votes — it's a member too, and requireMember doesn't exclude board accounts.
    const boardVote = await app.inject({
      method: 'POST',
      url: `/api/v1/governance/motions/${motionId}/vote`,
      headers: { cookie: board.cookie },
      payload: { choice: 'ABSTAIN' },
    })
    expect(boardVote.statusCode).toBe(201)

    const tally = await closeAndGetTally(motionId)
    expect(tally).toEqual({ YES: 5, NO: 5, ABSTAIN: 1 })
    return motionId
  })

  it('GAP (a): a member cannot change their vote — UI implies otherwise', async () => {
    const motionId = await proposeAndOpen(
      'Sanity check motion for the double-vote gap',
      'Exists only to exercise the double-vote rejection path.',
    )
    const first = await app.inject({
      method: 'POST',
      url: `/api/v1/governance/motions/${motionId}/vote`,
      headers: { cookie: members[0].cookie },
      payload: { choice: 'YES' },
    })
    expect(first.statusCode).toBe(201)

    // motion-card.tsx shows "✓ You voted · change before close" once youVoted is
    // true, implying a second vote updates the first. The API has no such path.
    const second = await app.inject({
      method: 'POST',
      url: `/api/v1/governance/motions/${motionId}/vote`,
      headers: { cookie: members[0].cookie },
      payload: { choice: 'NO' },
    })
    expect(second.statusCode).toBe(409)

    // Confirm the original YES vote is unchanged.
    const detail = await app.inject({
      method: 'GET',
      url: `/api/v1/governance/motions/${motionId}`,
      headers: { cookie: members[0].cookie },
    })
    expect(detail.json().yourChoice).toBe('YES')
  })

  it('GAP (d): a closed motion tally is NOT automatically on the public transparency page', async () => {
    const motionId = await proposeAndOpen(
      'Motion whose result is never bridged to a public resolution',
      'Deliberately left un-bridged to demonstrate Motion/BoardResolution are disconnected.',
    )
    await castVotes(motionId, [
      'YES',
      'YES',
      'YES',
      'YES',
      'YES',
      'YES',
      'NO',
      'NO',
      'ABSTAIN',
      'ABSTAIN',
    ])
    const tally = await closeAndGetTally(motionId)
    expect(tally).toEqual({ YES: 6, NO: 2, ABSTAIN: 2 })

    const year = new Date().getFullYear()
    const publicRes = await app.inject({
      method: 'GET',
      url: `/api/v1/transparency/resolutions?year=${year}`,
    })
    expect(publicRes.statusCode).toBe(200)
    const titles = (publicRes.json() as Array<{ title: string }>).map((r) => r.title)
    expect(titles).not.toContain('Motion whose result is never bridged to a public resolution')
  })

  it('bridging a motion result to the public transparency page requires a separate manual write', async () => {
    const motionId = await proposeAndOpen(
      'Motion whose result IS manually bridged to a resolution',
      'This one gets the extra POST /api/admin/resolutions + publish step.',
    )
    await castVotes(motionId, ['YES', 'YES', 'YES', 'YES', 'YES', 'YES', 'YES', 'YES', 'NO', 'NO'])
    const tally = await closeAndGetTally(motionId)
    expect(tally).toEqual({ YES: 8, NO: 2, ABSTAIN: 0 })

    // Manual bridge: board re-types the result into a BoardResolution.
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/admin/resolutions',
      headers: { cookie: board.cookie },
      payload: {
        title: 'Motion whose result IS manually bridged to a resolution',
        body: 'Passed 8-2. See member governance motion for full discussion.',
        votedAt: new Date().toISOString(),
        outcome: 'PASSED',
        voteFor: tally.YES,
        voteAgainst: tally.NO,
        voteAbstain: tally.ABSTAIN,
      },
    })
    expect(createRes.statusCode).toBe(201)
    const resolutionId = createRes.json().id as string

    // Not public until published.
    const beforePublish = await app.inject({
      method: 'GET',
      url: `/api/v1/transparency/resolutions?year=${new Date().getFullYear()}`,
    })
    let titles = (beforePublish.json() as Array<{ title: string }>).map((r) => r.title)
    expect(titles).not.toContain('Motion whose result IS manually bridged to a resolution')

    const publishRes = await app.inject({
      method: 'PATCH',
      url: `/api/admin/resolutions/${resolutionId}`,
      headers: { cookie: board.cookie },
      payload: { publishedAt: new Date().toISOString() },
    })
    expect(publishRes.statusCode).toBe(200)

    const afterPublish = await app.inject({
      method: 'GET',
      url: `/api/v1/transparency/resolutions?year=${new Date().getFullYear()}`,
    })
    titles = (afterPublish.json() as Array<{ title: string }>).map((r) => r.title)
    expect(titles).toContain('Motion whose result IS manually bridged to a resolution')
    const published = (
      afterPublish.json() as Array<{
        title: string
        voteFor: number
        voteAgainst: number
      }>
    ).find((r) => r.title === 'Motion whose result IS manually bridged to a resolution')
    expect(published?.voteFor).toBe(8)
    expect(published?.voteAgainst).toBe(2)
  })

  it('discussion thread: members can comment during DRAFT circulation, in order, attributed', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/governance/motions',
      headers: { cookie: board.cookie },
      payload: {
        title: 'Motion sitting in the "discussion" DRAFT state',
        description: 'Exercises the comment thread during the 7-day circulation period.',
        openAt: new Date(Date.now() + 7 * 86400000).toISOString(),
        closeAt: new Date(Date.now() + 14 * 86400000).toISOString(),
      },
    })
    expect(createRes.statusCode).toBe(201)
    const motionId = createRes.json().id as string

    const post = (cookie: string, body: string) =>
      app.inject({
        method: 'POST',
        url: `/api/v1/governance/motions/${motionId}/comments`,
        headers: { cookie },
        payload: { body },
      })

    const c1 = await post(members[0].cookie, 'I support this in principle.')
    expect(c1.statusCode).toBe(201)
    expect(c1.json().authorDisplayName).toBe('Test Member 1')

    const c2 = await post(members[1].cookie, 'What is the expected cost?')
    expect(c2.statusCode).toBe(201)

    const empty = await post(members[2].cookie, '   ')
    expect(empty.statusCode).toBe(400)

    const list = await app.inject({
      method: 'GET',
      url: `/api/v1/governance/motions/${motionId}/comments`,
      headers: { cookie: members[0].cookie },
    })
    expect(list.statusCode).toBe(200)
    const comments = list.json() as Array<{ body: string; authorDisplayName: string | null }>
    expect(comments).toHaveLength(2)
    expect(comments[0].body).toBe('I support this in principle.')
    expect(comments[1].body).toBe('What is the expected cost?')

    // commentCount surfaces on the list/detail endpoints so the UI can show a
    // count without an extra fetch.
    const motionList = await app.inject({
      method: 'GET',
      url: '/api/v1/governance/motions',
      headers: { cookie: members[0].cookie },
    })
    const summary = (motionList.json() as Array<{ id: string; commentCount: number }>).find(
      (m) => m.id === motionId,
    )
    expect(summary?.commentCount).toBe(2)
  })

  it('discussion thread stays open once voting starts, but closes with the motion', async () => {
    const motionId = await proposeAndOpen(
      'Motion discussed during OPEN voting',
      'Comments should still be postable while OPEN, not just DRAFT.',
    )
    const duringOpen = await app.inject({
      method: 'POST',
      url: `/api/v1/governance/motions/${motionId}/comments`,
      headers: { cookie: members[0].cookie },
      payload: { body: 'Voting YES, here is why.' },
    })
    expect(duringOpen.statusCode).toBe(201)

    await castVotes(motionId, [
      'YES',
      'YES',
      'YES',
      'NO',
      'NO',
      'NO',
      'ABSTAIN',
      'ABSTAIN',
      'ABSTAIN',
      'YES',
    ])
    await closeAndGetTally(motionId)

    const afterClose = await app.inject({
      method: 'POST',
      url: `/api/v1/governance/motions/${motionId}/comments`,
      headers: { cookie: members[1].cookie },
      payload: { body: 'Too late to add this.' },
    })
    expect(afterClose.statusCode).toBe(409)

    // Existing comments remain readable after close — the discussion record persists.
    const list = await app.inject({
      method: 'GET',
      url: `/api/v1/governance/motions/${motionId}/comments`,
      headers: { cookie: members[0].cookie },
    })
    expect(list.statusCode).toBe(200)
    expect((list.json() as unknown[]).length).toBe(1)
  })

  it('a non-member cannot read or post to a motion discussion thread', async () => {
    const motionId = await proposeAndOpen(
      'Motion a non-member should not be able to comment on',
      'x',
    )
    const nonMemberCookie = 'tahti_session=not-a-real-session'
    const listRes = await app.inject({
      method: 'GET',
      url: `/api/v1/governance/motions/${motionId}/comments`,
      headers: { cookie: nonMemberCookie },
    })
    expect(listRes.statusCode).toBe(401)

    const postRes = await app.inject({
      method: 'POST',
      url: `/api/v1/governance/motions/${motionId}/comments`,
      headers: { cookie: nonMemberCookie },
      payload: { body: 'x' },
    })
    expect(postRes.statusCode).toBe(401)
  })
})
