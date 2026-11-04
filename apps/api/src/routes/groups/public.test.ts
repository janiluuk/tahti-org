// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@tahti/db'
import { buildApp } from '../../server.js'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'artist-groups-public-'

describe('GET /api/v1/groups', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let ownerId: string
  let memberCookie: string
  let outsiderCookie: string
  let suspendedId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const owner = await createTestArtist(prisma, {
      email: `${PREFIX}owner@example.com`,
      username: `${PREFIX}owner`,
      displayName: 'owner@example.com',
    })
    const member = await createTestArtist(prisma, {
      email: `${PREFIX}member@example.com`,
      username: `${PREFIX}member`,
      displayName: 'Member Person',
    })
    const outsider = await createTestArtist(prisma, {
      email: `${PREFIX}outsider@example.com`,
      username: `${PREFIX}outsider`,
    })
    const suspended = await createTestArtist(prisma, {
      email: `${PREFIX}suspended@example.com`,
      username: `${PREFIX}suspended`,
    })
    ownerId = owner.id
    suspendedId = suspended.id
    memberCookie = await sessionCookieFor(prisma, member.id)
    outsiderCookie = await sessionCookieFor(prisma, outsider.id)
    const ownerCookie = await sessionCookieFor(prisma, owner.id)
    const suspendedCookie = await sessionCookieFor(prisma, suspended.id)

    await app.inject({
      method: 'POST',
      url: '/api/me/groups',
      headers: { cookie: ownerCookie },
      payload: { name: 'Pub Group', description: 'Open to all', joinPolicy: 'REQUEST' },
    })
    await app.inject({
      method: 'POST',
      url: '/api/me/groups',
      headers: { cookie: ownerCookie },
      payload: { name: 'Hidden Group', isPublic: false },
    })
    await app.inject({
      method: 'POST',
      url: '/api/me/groups',
      headers: { cookie: suspendedCookie },
      payload: { name: 'Suspended Founder Group' },
    })
    const pubGroup = await prisma.artistGroup.findUniqueOrThrow({ where: { slug: 'pub-group' } })
    await prisma.artistGroupMember.create({
      data: { groupId: pubGroup.id, userId: member.id, role: 'MEMBER' },
    })
    await prisma.artistGroupJoinRequest.create({
      data: { groupId: pubGroup.id, userId: outsider.id },
    })
    await prisma.user.update({ where: { id: suspendedId }, data: { suspendedAt: new Date() } })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('lists public groups for anyone, without private or suspended-founder ones', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/groups?q=group' })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { items: Array<{ slug: string }>; total: number }
    const slugs = body.items.map((g) => g.slug)
    expect(slugs).toContain('pub-group')
    expect(slugs).not.toContain('hidden-group')
    expect(slugs).not.toContain('suspended-founder-group')
    expect(body.total).toBe(slugs.length)
  })

  it('validates the query', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/groups?limit=500' })
    expect(res.statusCode).toBe(400)
  })

  it('shows a public group with safe names and the viewer state', async () => {
    const anon = await app.inject({ method: 'GET', url: '/api/v1/groups/pub-group' })
    expect(anon.statusCode).toBe(200)
    const body = anon.json() as {
      name: string
      memberCount: number
      collectionSlug: string
      createdBy: { username: string; displayName: string }
      members: Array<{ username: string; displayName: string; role: string }>
      viewer: { role: string | null; joinRequestPending: boolean }
    }
    expect(body).toMatchObject({
      name: 'Pub Group',
      memberCount: 2,
      collectionSlug: 'group-pub-group',
      viewer: { role: null, joinRequestPending: false },
    })
    expect(body.createdBy).toEqual({
      username: `${PREFIX}owner`,
      displayName: `${PREFIX}owner`,
    })
    expect(JSON.stringify(body)).not.toContain('@example.com')
    expect(body.members.map((m) => m.role)).toEqual(['OWNER', 'MEMBER'])

    const asMember = await app.inject({
      method: 'GET',
      url: '/api/v1/groups/pub-group',
      headers: { cookie: memberCookie },
    })
    expect((asMember.json() as typeof body).viewer).toEqual({
      role: 'MEMBER',
      joinRequestPending: false,
    })
    const asRequester = await app.inject({
      method: 'GET',
      url: '/api/v1/groups/pub-group',
      headers: { cookie: outsiderCookie },
    })
    expect((asRequester.json() as typeof body).viewer).toEqual({
      role: null,
      joinRequestPending: true,
    })
  })

  it('opens the group playlist through the public collection route', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/collections/group-pub-group' })
    expect(res.statusCode).toBe(200)
  })

  it('404s a private group for non-members, and a suspended founder group for all', async () => {
    const anon = await app.inject({ method: 'GET', url: '/api/v1/groups/hidden-group' })
    expect(anon.statusCode).toBe(404)
    const outsider = await app.inject({
      method: 'GET',
      url: '/api/v1/groups/hidden-group',
      headers: { cookie: outsiderCookie },
    })
    expect(outsider.statusCode).toBe(404)
    const suspended = await app.inject({
      method: 'GET',
      url: '/api/v1/groups/suspended-founder-group',
    })
    expect(suspended.statusCode).toBe(404)
    const missing = await app.inject({ method: 'GET', url: '/api/v1/groups/nope-nope' })
    expect(missing.statusCode).toBe(404)
  })

  it('shows a private group to its own members', async () => {
    const ownerCookie = await sessionCookieFor(prisma, ownerId)
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/groups/hidden-group',
      headers: { cookie: ownerCookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ isPublic: false, viewer: { role: 'OWNER' } })
  })
})
