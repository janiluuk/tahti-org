// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'governance-association-test-'

describe('association profile', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string
  let memberCookie: string
  let freeCookie: string

  async function cleanup() {
    await prisma.associationProfile.deleteMany({})
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
  }

  function read(who = memberCookie) {
    return app.inject({
      method: 'GET',
      url: '/api/v1/governance/association',
      headers: { cookie: who },
    })
  }

  function edit(payload: Record<string, unknown>, who = boardCookie) {
    return app.inject({
      method: 'PATCH',
      url: '/api/admin/governance/association',
      headers: { cookie: who },
      payload,
    })
  }

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanup()
    const make = (name: string, extra: Record<string, boolean>) =>
      createTestArtist(prisma, {
        email: `${PREFIX}${name}@example.com`,
        username: `governance-association-${name}`,
        ...extra,
      })
    boardCookie = await sessionCookieFor(
      prisma,
      (await make('board', { isMember: true, isBoard: true })).id,
    )
    memberCookie = await sessionCookieFor(prisma, (await make('member', { isMember: true })).id)
    freeCookie = await sessionCookieFor(prisma, (await make('free', {})).id)
  })

  afterAll(async () => {
    await cleanup()
    await app.close()
  })

  it('is empty until the board fills it in', async () => {
    const res = await read()
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({
      name: null,
      businessId: null,
      registerNumber: null,
      domicile: null,
      contactEmail: null,
      postalAddress: null,
      website: null,
      updatedAt: null,
    })
  })

  it('shows members what the board saves and audits the changed fields', async () => {
    const res = await edit({
      name: 'Tahti ry',
      businessId: '1234567-8',
      domicile: 'Helsinki',
      contactEmail: 'hallitus@tahti.live',
    })
    expect(res.statusCode).toBe(200)
    await edit({ domicile: 'Helsinki', website: 'https://tahti.live' })
    await edit({ name: 'Tahti ry' })

    const profile = (await read()).json()
    expect(profile).toMatchObject({
      name: 'Tahti ry',
      businessId: '1234567-8',
      domicile: 'Helsinki',
      contactEmail: 'hallitus@tahti.live',
      website: 'https://tahti.live',
      registerNumber: null,
    })
    expect(profile.updatedAt).not.toBeNull()

    await edit({ website: null })
    expect((await read()).json().website).toBeNull()

    const audits = await prisma.auditLog.findMany({
      where: { action: 'ASSOCIATION_PROFILE_UPDATE' },
      orderBy: { id: 'asc' },
    })
    expect(audits.slice(-3).map((a) => a.meta)).toEqual([
      { changed: ['name', 'businessId', 'domicile', 'contactEmail'] },
      { changed: ['website'] },
      { changed: ['website'] },
    ])
  })

  it('checks who asks and what is sent', async () => {
    expect((await read(freeCookie)).statusCode).toBe(403)
    expect((await edit({ name: 'Mine' }, memberCookie)).statusCode).toBe(403)
    expect((await edit({})).statusCode).toBe(400)
    expect((await edit({ businessId: '12345678' })).statusCode).toBe(400)
    expect((await edit({ contactEmail: 'not an email' })).statusCode).toBe(400)
  })
})
