// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@tahti/db'
import { buildApp } from '../../server.js'
import {
  cleanupUsersByEmailPrefix,
  createReadySound,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'artist-groups-'

type Json = Record<string, unknown>

describe('artist groups — lifecycle, membership and member-gated adds', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  const cookies: Record<string, string> = {}
  const ids: Record<string, string> = {}
  const sounds: Record<string, string> = {}

  const call = (
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    url: string,
    who?: string,
    payload?: Json,
  ) =>
    app.inject({
      method,
      url,
      headers: who ? { cookie: cookies[who]! } : {},
      ...(payload ? { payload } : {}),
    })

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    for (const name of ['owner', 'admin', 'member', 'joiner', 'outsider']) {
      const user = await createTestArtist(prisma, {
        email: `${PREFIX}${name}@example.com`,
        username: `${PREFIX}${name}`,
      })
      ids[name] = user.id
      cookies[name] = await sessionCookieFor(prisma, user.id)
      sounds[name] = (await createReadySound(prisma, user.channel!.id, `${name} track`)).id
    }
    const hidden = await prisma.sound.update({
      where: { id: sounds.member },
      data: { isPublic: false },
    })
    expect(hidden.isPublic).toBe(false)
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  describe('create / list / patch / delete', () => {
    it('creates a group with a PLAYLIST collection and an OWNER member', async () => {
      const res = await call('POST', '/api/me/groups', 'owner', {
        name: 'Night Shift Crew',
        description: 'After-hours selectors',
      })
      expect(res.statusCode).toBe(201)
      const body = res.json() as Json
      expect(body).toMatchObject({
        slug: 'night-shift-crew',
        name: 'Night Shift Crew',
        isPublic: true,
        joinPolicy: 'OPEN',
        submitPolicy: 'OPEN',
        role: 'OWNER',
        memberCount: 1,
        itemCount: 0,
      })

      const group = await prisma.artistGroup.findUniqueOrThrow({
        where: { slug: 'night-shift-crew' },
        include: { collection: true, members: true },
      })
      expect(group.createdByUserId).toBe(ids.owner)
      expect(group.collection).toMatchObject({
        style: 'PLAYLIST',
        collaborative: false,
        userId: ids.owner,
        isPublic: true,
      })
      expect(group.members).toEqual([expect.objectContaining({ userId: ids.owner, role: 'OWNER' })])
      expect(body.collectionSlug).toBe(group.collection.slug)
    })

    it('rejects an email address as name or description', async () => {
      const name = await call('POST', '/api/me/groups', 'owner', { name: 'me@example.com' })
      expect(name.statusCode).toBe(400)
      expect((name.json() as { error: string }).error).toMatch(/email/i)
      const desc = await call('POST', '/api/me/groups', 'owner', {
        name: 'Fine name',
        description: 'write to boss@example.com',
      })
      expect(desc.statusCode).toBe(400)
    })

    it('409s on a taken slug and requires auth', async () => {
      const taken = await call('POST', '/api/me/groups', 'outsider', {
        name: 'Other',
        slug: 'night-shift-crew',
      })
      expect(taken.statusCode).toBe(409)
      const anon = await call('POST', '/api/me/groups', undefined, { name: 'Anon' })
      expect(anon.statusCode).toBe(401)
    })

    it('lists only my groups', async () => {
      const mine = await call('GET', '/api/me/groups', 'owner')
      expect(mine.statusCode).toBe(200)
      expect((mine.json() as Json[]).map((g) => g.slug)).toEqual(['night-shift-crew'])
      const theirs = await call('GET', '/api/me/groups', 'outsider')
      expect(theirs.json()).toEqual([])
    })

    it('lets owner/admin edit and syncs the playlist, but not plain members', async () => {
      await prisma.artistGroupMember.createMany({
        data: [
          { groupId: await groupId(), userId: ids.admin!, role: 'ADMIN' },
          { groupId: await groupId(), userId: ids.member!, role: 'MEMBER' },
        ],
      })
      const denied = await call('PATCH', '/api/me/groups/night-shift-crew', 'member', {
        name: 'Hijacked',
      })
      expect(denied.statusCode).toBe(403)
      const outsider = await call('PATCH', '/api/me/groups/night-shift-crew', 'outsider', {
        name: 'Hijacked',
      })
      expect(outsider.statusCode).toBe(404)

      const ok = await call('PATCH', '/api/me/groups/night-shift-crew', 'admin', {
        name: 'Night Shift',
        submitPolicy: 'APPROVE',
        joinPolicy: 'REQUEST',
      })
      expect(ok.statusCode).toBe(200)
      expect(ok.json()).toMatchObject({
        name: 'Night Shift',
        submitPolicy: 'APPROVE',
        joinPolicy: 'REQUEST',
        role: 'ADMIN',
      })
      const group = await prisma.artistGroup.findUniqueOrThrow({
        where: { slug: 'night-shift-crew' },
        include: { collection: true },
      })
      expect(group.collection.name).toBe('Night Shift')

      const email = await call('PATCH', '/api/me/groups/night-shift-crew', 'owner', {
        name: 'x@y.com',
      })
      expect(email.statusCode).toBe(400)
    })

    it('keeps the playlist visibility in step with the group', async () => {
      await call('POST', '/api/me/groups', 'owner', {
        name: 'Secret Club',
        isPublic: false,
      })
      const col = await prisma.artistGroup.findUniqueOrThrow({
        where: { slug: 'secret-club' },
        include: { collection: true },
      })
      expect(col.collection).toMatchObject({ isPublic: false, visibility: 'DRAFT' })
      await call('PATCH', '/api/me/groups/secret-club', 'owner', { isPublic: true })
      const after = await prisma.collection.findUniqueOrThrow({ where: { id: col.collectionId } })
      expect(after).toMatchObject({ isPublic: true, visibility: 'PUBLIC' })
      await call('DELETE', '/api/me/groups/secret-club', 'owner')
    })

    it('only the owner deletes, and the playlist goes with the group', async () => {
      await call('POST', '/api/me/groups', 'owner', { name: 'Short Lived' })
      const group = await prisma.artistGroup.findUniqueOrThrow({ where: { slug: 'short-lived' } })
      await prisma.artistGroupMember.create({
        data: { groupId: group.id, userId: ids.admin!, role: 'ADMIN' },
      })
      expect((await call('DELETE', '/api/me/groups/short-lived', 'admin')).statusCode).toBe(403)
      expect((await call('DELETE', '/api/me/groups/short-lived', 'outsider')).statusCode).toBe(404)
      expect((await call('DELETE', '/api/me/groups/short-lived', 'owner')).statusCode).toBe(204)
      expect(await prisma.artistGroup.count({ where: { slug: 'short-lived' } })).toBe(0)
      expect(await prisma.collection.count({ where: { id: group.collectionId } })).toBe(0)
    })
  })

  async function groupId() {
    return (await prisma.artistGroup.findUniqueOrThrow({ where: { slug: 'night-shift-crew' } })).id
  }

  describe('the group playlist is not open or deletable by other routes', () => {
    it('cannot be made collaborative or deleted through the collection routes', async () => {
      const group = await prisma.artistGroup.findUniqueOrThrow({
        where: { slug: 'night-shift-crew' },
        include: { collection: true },
      })
      const slug = group.collection.slug
      const collab = await call('PATCH', `/api/me/collections/${slug}`, 'owner', {
        collaborative: true,
      })
      expect(collab.statusCode).toBe(409)
      const del = await call('DELETE', `/api/me/collections/${slug}`, 'owner')
      expect(del.statusCode).toBe(409)
      expect(await prisma.artistGroup.count({ where: { id: group.id } })).toBe(1)
    })

    it('rejects adds through the open collaborative route', async () => {
      const group = await prisma.artistGroup.findUniqueOrThrow({
        where: { slug: 'night-shift-crew' },
        include: { collection: true },
      })
      const res = await call(
        'POST',
        `/api/v1/collections/${group.collection.slug}/items`,
        'outsider',
        { soundId: sounds.outsider },
      )
      expect(res.statusCode).toBe(404)
      expect(
        await prisma.collectionItem.count({ where: { collectionId: group.collectionId } }),
      ).toBe(0)
    })
  })

  describe('join / leave / requests (REQUEST policy)', () => {
    it('a REQUEST group queues the join instead of adding the member', async () => {
      const res = await call('POST', '/api/me/groups/night-shift-crew/join', 'joiner')
      expect(res.statusCode).toBe(202)
      expect((res.json() as Json).status).toBe('REQUESTED')
      expect(
        await prisma.artistGroupMember.count({
          where: { groupId: await groupId(), userId: ids.joiner },
        }),
      ).toBe(0)
    })

    it('shows pending requests to admins only, with safe names', async () => {
      await prisma.user.update({
        where: { id: ids.joiner },
        data: { displayName: 'joiner@example.com' },
      })
      const forbidden = await call('GET', '/api/me/groups/night-shift-crew/join-requests', 'member')
      expect(forbidden.statusCode).toBe(403)
      const outsider = await call(
        'GET',
        '/api/me/groups/night-shift-crew/join-requests',
        'outsider',
      )
      expect(outsider.statusCode).toBe(404)

      const res = await call('GET', '/api/me/groups/night-shift-crew/join-requests', 'admin')
      expect(res.statusCode).toBe(200)
      const list = res.json() as Array<{ user: { username: string; displayName: string } }>
      expect(list).toHaveLength(1)
      expect(list[0]!.user).toEqual({
        username: `${PREFIX}joiner`,
        displayName: `${PREFIX}joiner`,
      })
      expect(JSON.stringify(list)).not.toContain('@example.com')

      const mine = await call('GET', '/api/me/groups', 'admin')
      expect((mine.json() as Json[])[0]).toMatchObject({ pendingJoinRequestCount: 1 })
    })

    it('a cancelled request can be withdrawn with the leave route', async () => {
      const res = await call('DELETE', '/api/me/groups/night-shift-crew/members/me', 'joiner')
      expect(res.statusCode).toBe(204)
      expect(await prisma.artistGroupJoinRequest.count({ where: { userId: ids.joiner } })).toBe(0)
      const again = await call('DELETE', '/api/me/groups/night-shift-crew/members/me', 'joiner')
      expect(again.statusCode).toBe(404)
    })

    it('approving adds the member; resolving twice 409s; rejecting does not add', async () => {
      await call('POST', '/api/me/groups/night-shift-crew/join', 'joiner')
      await call('POST', '/api/me/groups/night-shift-crew/join', 'outsider')
      const pending = await prisma.artistGroupJoinRequest.findMany({
        where: { groupId: await groupId() },
      })
      const joinerReq = pending.find((r) => r.userId === ids.joiner)!
      const outsiderReq = pending.find((r) => r.userId === ids.outsider)!

      const memberTry = await call(
        'POST',
        `/api/me/groups/night-shift-crew/join-requests/${joinerReq.id}/resolve`,
        'member',
        { action: 'APPROVE' },
      )
      expect(memberTry.statusCode).toBe(403)

      const approve = await call(
        'POST',
        `/api/me/groups/night-shift-crew/join-requests/${joinerReq.id}/resolve`,
        'admin',
        { action: 'APPROVE' },
      )
      expect(approve.statusCode).toBe(200)
      expect(approve.json()).toMatchObject({ status: 'APPROVED' })
      expect(
        await prisma.artistGroupMember.findUnique({
          where: { groupId_userId: { groupId: await groupId(), userId: ids.joiner! } },
        }),
      ).toMatchObject({ role: 'MEMBER' })

      const twice = await call(
        'POST',
        `/api/me/groups/night-shift-crew/join-requests/${joinerReq.id}/resolve`,
        'owner',
        { action: 'REJECT' },
      )
      expect(twice.statusCode).toBe(409)

      const reject = await call(
        'POST',
        `/api/me/groups/night-shift-crew/join-requests/${outsiderReq.id}/resolve`,
        'owner',
        { action: 'REJECT' },
      )
      expect(reject.statusCode).toBe(200)
      expect(
        await prisma.artistGroupMember.count({
          where: { groupId: await groupId(), userId: ids.outsider },
        }),
      ).toBe(0)
    })

    it('rejects joining twice, owner leaving, and a bad resolve body', async () => {
      const already = await call('POST', '/api/me/groups/night-shift-crew/join', 'joiner')
      expect(already.statusCode).toBe(409)
      const ownerLeaves = await call(
        'DELETE',
        '/api/me/groups/night-shift-crew/members/me',
        'owner',
      )
      expect(ownerLeaves.statusCode).toBe(409)
      const bad = await call(
        'POST',
        '/api/me/groups/night-shift-crew/join-requests/whatever/resolve',
        'owner',
        { action: 'MAYBE' },
      )
      expect(bad.statusCode).toBe(400)
    })

    it('an OPEN group adds the joiner immediately and members can leave', async () => {
      await call('POST', '/api/me/groups', 'owner', { name: 'Open House' })
      const join = await call('POST', '/api/me/groups/open-house/join', 'outsider')
      expect(join.statusCode).toBe(201)
      expect(join.json()).toMatchObject({ status: 'JOINED', role: 'MEMBER' })
      const leave = await call('DELETE', '/api/me/groups/open-house/members/me', 'outsider')
      expect(leave.statusCode).toBe(204)
      await call('DELETE', '/api/me/groups/open-house', 'owner')
    })

    it('private groups cannot be joined by outsiders', async () => {
      await call('POST', '/api/me/groups', 'owner', { name: 'Invite Only', isPublic: false })
      const res = await call('POST', '/api/me/groups/invite-only/join', 'outsider')
      expect(res.statusCode).toBe(404)
      await call('DELETE', '/api/me/groups/invite-only', 'owner')
    })
  })

  describe('adding sounds (APPROVE policy)', () => {
    let submissionId: string

    it('only members add; non-members are refused', async () => {
      const res = await call('POST', '/api/me/groups/night-shift-crew/sounds', 'outsider', {
        soundId: sounds.outsider,
      })
      expect(res.statusCode).toBe(403)
      const anon = await call('POST', '/api/me/groups/night-shift-crew/sounds', undefined, {
        soundId: sounds.outsider,
      })
      expect(anon.statusCode).toBe(401)
    })

    it('a plain member submission waits for approval', async () => {
      const res = await call('POST', '/api/me/groups/night-shift-crew/sounds', 'joiner', {
        soundId: sounds.joiner,
        note: 'for the closing hour',
      })
      expect(res.statusCode).toBe(202)
      const body = res.json() as { status: string; submission: { id: string } }
      expect(body.status).toBe('PENDING')
      submissionId = body.submission.id
      const group = await prisma.artistGroup.findUniqueOrThrow({
        where: { slug: 'night-shift-crew' },
      })
      expect(
        await prisma.collectionItem.count({ where: { collectionId: group.collectionId } }),
      ).toBe(0)

      const dup = await call('POST', '/api/me/groups/night-shift-crew/sounds', 'joiner', {
        soundId: sounds.joiner,
      })
      expect(dup.statusCode).toBe(409)
    })

    it('shows pending submissions to admins and group-membership flags them', async () => {
      const forbidden = await call('GET', '/api/me/groups/night-shift-crew/submissions', 'joiner')
      expect(forbidden.statusCode).toBe(403)
      const list = await call('GET', '/api/me/groups/night-shift-crew/submissions', 'admin')
      expect(list.statusCode).toBe(200)
      expect((list.json() as Json[])[0]).toMatchObject({
        id: submissionId,
        note: 'for the closing hour',
        sound: { id: sounds.joiner, title: 'joiner track' },
      })

      const membership = await call(
        'GET',
        `/api/me/sound/${sounds.joiner}/group-membership`,
        'joiner',
      )
      expect(membership.statusCode).toBe(200)
      expect(membership.json()).toEqual([
        expect.objectContaining({
          slug: 'night-shift-crew',
          collectionSlug: 'group-night-shift-crew',
          submitPolicy: 'APPROVE',
          role: 'MEMBER',
          member: false,
          itemId: null,
          submissionPending: true,
        }),
      ])
    })

    it('a plain member cannot approve; an admin can, and the track lands attributed', async () => {
      const denied = await call(
        'POST',
        `/api/me/groups/night-shift-crew/submissions/${submissionId}/approve`,
        'joiner',
      )
      expect(denied.statusCode).toBe(403)

      const ok = await call(
        'POST',
        `/api/me/groups/night-shift-crew/submissions/${submissionId}/approve`,
        'admin',
      )
      expect(ok.statusCode).toBe(200)
      const { itemId } = ok.json() as { itemId: string }
      const item = await prisma.collectionItem.findUniqueOrThrow({ where: { id: itemId } })
      expect(item).toMatchObject({
        soundId: sounds.joiner,
        addedByUserId: ids.joiner,
        addNote: 'for the closing hour',
        position: 1,
      })

      const again = await call(
        'POST',
        `/api/me/groups/night-shift-crew/submissions/${submissionId}/approve`,
        'admin',
      )
      expect(again.statusCode).toBe(409)

      const membership = await call(
        'GET',
        `/api/me/sound/${sounds.joiner}/group-membership`,
        'joiner',
      )
      expect(membership.json()).toEqual([
        expect.objectContaining({ member: true, itemId, submissionPending: false, itemCount: 1 }),
      ])
      const dup = await call('POST', '/api/me/groups/night-shift-crew/sounds', 'joiner', {
        soundId: sounds.joiner,
      })
      expect(dup.statusCode).toBe(409)
    })

    it('owners and admins add directly even under APPROVE', async () => {
      const res = await call('POST', '/api/me/groups/night-shift-crew/sounds', 'admin', {
        soundId: sounds.admin,
      })
      expect(res.statusCode).toBe(201)
      expect(res.json()).toMatchObject({ status: 'ADDED', item: { position: 2 } })
    })

    it('rejecting a submission leaves the playlist alone and allows a resubmit', async () => {
      const sub = await call('POST', '/api/me/groups/night-shift-crew/sounds', 'member', {
        soundId: sounds.owner,
      })
      expect(sub.statusCode).toBe(202)
      const id = (sub.json() as { submission: { id: string } }).submission.id
      const reject = await call(
        'POST',
        `/api/me/groups/night-shift-crew/submissions/${id}/reject`,
        'owner',
      )
      expect(reject.statusCode).toBe(200)
      expect(reject.json()).toMatchObject({ status: 'REJECTED' })
      const again = await call('POST', '/api/me/groups/night-shift-crew/sounds', 'member', {
        soundId: sounds.owner,
      })
      expect(again.statusCode).toBe(202)
    })

    it("refuses someone else's private track and unknown tracks", async () => {
      const privateTrack = await call('POST', '/api/me/groups/night-shift-crew/sounds', 'joiner', {
        soundId: sounds.member,
      })
      expect(privateTrack.statusCode).toBe(400)
      const unknown = await call('POST', '/api/me/groups/night-shift-crew/sounds', 'joiner', {
        soundId: 'nope',
      })
      expect(unknown.statusCode).toBe(400)
    })
  })

  describe('adding sounds (OPEN policy)', () => {
    it('a member appends at once, in order, attributed to them', async () => {
      await call('POST', '/api/me/groups', 'owner', { name: 'Free For All' })
      await call('POST', '/api/me/groups/free-for-all/join', 'member')

      const first = await call('POST', '/api/me/groups/free-for-all/sounds', 'member', {
        soundId: sounds.member,
        note: 'mine',
      })
      expect(first.statusCode).toBe(201)
      const second = await call('POST', '/api/me/groups/free-for-all/sounds', 'member', {
        soundId: sounds.owner,
      })
      expect(second.statusCode).toBe(201)

      const group = await prisma.artistGroup.findUniqueOrThrow({
        where: { slug: 'free-for-all' },
      })
      const items = await prisma.collectionItem.findMany({
        where: { collectionId: group.collectionId },
        orderBy: { position: 'asc' },
      })
      expect(items.map((i) => [i.soundId, i.position, i.addedByUserId])).toEqual([
        [sounds.member, 1, ids.member],
        [sounds.owner, 2, ids.member],
      ])

      const dup = await call('POST', '/api/me/groups/free-for-all/sounds', 'member', {
        soundId: sounds.owner,
      })
      expect(dup.statusCode).toBe(409)
    })

    it('rejects adds from someone blocked by the group founder', async () => {
      await prisma.userBlock.create({
        data: { blockerUserId: ids.owner!, blockedUserId: ids.member! },
      })
      const res = await call('POST', '/api/me/groups/free-for-all/sounds', 'member', {
        soundId: sounds.member,
      })
      expect(res.statusCode).toBe(404)
      await prisma.userBlock.deleteMany({ where: { blockerUserId: ids.owner } })
    })
  })
})
