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
    await prisma.governanceAuditor.deleteMany({ where: { name: { startsWith: 'Test auditor' } } })
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
      auditors: [],
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

  describe('auditors', () => {
    function appoint(payload: Record<string, unknown>, who = boardCookie) {
      return app.inject({
        method: 'POST',
        url: '/api/admin/governance/auditors',
        headers: { cookie: who },
        payload,
      })
    }

    function endTerm(id: string, termEnd: string) {
      return app.inject({
        method: 'PATCH',
        url: `/api/admin/governance/auditors/${id}`,
        headers: { cookie: boardCookie },
        payload: { termEnd },
      })
    }

    const day = 86400000
    const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * day).toISOString()

    it('shows members the auditors whose term covers today', async () => {
      const current = await appoint({
        kind: 'OPERATIONS_INSPECTOR',
        name: 'Test auditor Current',
        termStart: iso(-30),
        termEnd: iso(300),
      })
      expect(current.statusCode).toBe(201)
      await appoint({
        kind: 'OPERATIONS_INSPECTOR',
        deputy: true,
        name: 'Test auditor Deputy',
        termStart: iso(-30),
      })
      await appoint({ kind: 'AUDITOR', name: 'Test auditor Future', termStart: iso(30) })
      const past = await appoint({
        kind: 'AUDITOR',
        name: 'Test auditor Past',
        termStart: iso(-400),
      })
      expect((await endTerm(past.json().id, iso(-35))).statusCode).toBe(200)

      const names = ((await read()).json().auditors as Array<{ name: string }>).map((a) => a.name)
      expect(names).toEqual(['Test auditor Current', 'Test auditor Deputy'])

      const all = await app.inject({
        method: 'GET',
        url: '/api/admin/governance/auditors',
        headers: { cookie: boardCookie },
      })
      expect((all.json() as unknown[]).length).toBeGreaterThanOrEqual(4)

      const audits = await prisma.auditLog.findMany({
        where: {
          action: { in: ['AUDITOR_APPOINT', 'AUDITOR_TERM_END'] },
          targetId: past.json().id,
        },
        orderBy: { id: 'asc' },
      })
      expect(audits.map((a) => a.action)).toEqual(['AUDITOR_APPOINT', 'AUDITOR_TERM_END'])
    })

    it('checks terms, meetings and who asks', async () => {
      expect(
        (
          await appoint({
            kind: 'AUDITOR',
            name: 'Test auditor X',
            termStart: iso(0),
            termEnd: iso(-1),
          })
        ).statusCode,
      ).toBe(400)
      expect(
        (
          await appoint({
            kind: 'AUDITOR',
            name: 'Test auditor X',
            termStart: iso(0),
            meetingId: 'cjld2cjxh0000qzrmn831i7rn',
          })
        ).statusCode,
      ).toBe(400)
      expect(
        (
          await appoint(
            { kind: 'AUDITOR', name: 'Test auditor X', termStart: iso(0) },
            memberCookie,
          )
        ).statusCode,
      ).toBe(403)
      const made = await appoint({ kind: 'AUDITOR', name: 'Test auditor Y', termStart: iso(0) })
      expect((await endTerm(made.json().id, iso(-10))).statusCode).toBe(400)
      expect((await endTerm('missing-auditor', iso(10))).statusCode).toBe(404)
    })
  })
})
