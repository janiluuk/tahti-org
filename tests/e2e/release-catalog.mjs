#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>
/**
 * Playwright e2e — artist uploads ALBUM (5 tracks), EP (3), SINGLE (1) with distinct
 * color schemes; album stays draft/stash; fan stash share is created for album masters.
 *
 *   API_URL=http://localhost:3011 APP_URL=http://localhost:3010 node tests/e2e/release-catalog.mjs
 *
 * Requires API + web running. MinIO optional (track byte upload skipped when unreachable).
 */

import { chromium } from 'playwright'
import {
  apiLogin,
  CATALOG_COLOR_SCHEMES,
  createRelease,
  makeSilentWav,
  patchReleaseVisual,
  publishRelease,
  uploadTrack,
} from './lib/release-api.mjs'

const APP = process.env.APP_URL ?? 'http://localhost:3010'
const API = process.env.API_URL ?? 'http://localhost:3011'

const FIXTURE = {
  password: process.env.E2E_DEMO_PASS ?? 'screenshot-demo-pass',
  artistEmail: process.env.E2E_DEMO_ARTIST_EMAIL ?? 'screenshot-artist@e2e.tahti.live',
  fanUsername: process.env.E2E_DEMO_FAN_USER ?? 'screenshot-fan',
}

let passed = 0
let failed = 0

function ok(label) {
  console.log(`✓ ${label}`)
  passed++
}

function fail(label, err) {
  console.error(`✗ ${label}${err ? ` — ${err}` : ''}`)
  failed++
}

async function main() {
  const health = await fetch(`${API}/health`)
  if (!health.ok) {
    console.error(`API not healthy at ${API}`)
    process.exit(1)
  }
  ok('API health')

  const browser = await chromium.launch({ headless: true })
  const stamp = Date.now()
  const wavBytes = makeSilentWav()

  console.log('\n── Release catalog journey (album + EP + single) ──')

  try {
    const cookie = await apiLogin(API, APP, FIXTURE.artistEmail, FIXTURE.password)
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    await ctx.addCookies([cookie])
    const api = ctx.request
    api._apiUrl = API

    const album = await createRelease(api, {
      title: `E2E Catalog Album ${stamp}`,
      type: 'ALBUM',
      releaseDate: '2026-06-01',
      tracks: [
        'Opening',
        'Second Light',
        'Midnight Run',
        'Glass Horizon',
        'Closing Echo',
      ],
    })
    ok(`create ALBUM "${album.title}" with 5 tracks`)

    const ep = await createRelease(api, {
      title: `E2E Catalog EP ${stamp}`,
      type: 'EP',
      releaseDate: '2026-06-01',
      tracks: ['Side A', 'Side B', 'Side C'],
    })
    ok(`create EP "${ep.title}" with 3 tracks`)

    const single = await createRelease(api, {
      title: `E2E Catalog Single ${stamp}`,
      type: 'SINGLE',
      releaseDate: '2026-06-01',
      tracks: ['Radio Edit'],
    })
    ok(`create SINGLE "${single.title}"`)

    await patchReleaseVisual(api, album.id, {
      visualPreset: 'AURORA',
      colorScheme: CATALOG_COLOR_SCHEMES.ALBUM,
    })
    await patchReleaseVisual(api, ep.id, {
      visualPreset: 'PARTICLE_FIELD',
      colorScheme: CATALOG_COLOR_SCHEMES.EP,
    })
    await patchReleaseVisual(api, single.id, {
      visualPreset: 'REACTIVE_GRID',
      colorScheme: CATALOG_COLOR_SCHEMES.SINGLE,
    })
    ok('distinct color schemes saved on all three releases')

    let uploadsOk = 0
    for (const [release, names] of [
      [album, ['Opening', 'Second Light', 'Midnight Run', 'Glass Horizon', 'Closing Echo']],
      [ep, ['Side A', 'Side B', 'Side C']],
      [single, ['Radio Edit']],
    ]) {
      for (const name of names) {
        const result = await uploadTrack(api, release.id, name, wavBytes, API)
        if (result.ok) uploadsOk++
      }
    }
    if (uploadsOk > 0) {
      ok(`${uploadsOk} track(s) uploaded (MinIO-dependent)`)
    } else {
      console.log('⚠ track byte upload skipped — MinIO not reachable from test runner')
    }

    await publishRelease(api, ep.id)
    await publishRelease(api, single.id)
    ok('published EP and SINGLE')

    await publishRelease(api, album.id)
    ok('published album briefly to attach to stash collection')

    const vaultSlug = `e2e-album-stash-${stamp}`
    const colRes = await api.post(`${API}/api/me/collections`, {
      data: { name: 'Album stash vault', slug: vaultSlug, isPublic: false },
    })
    if (colRes.ok()) ok('created private stash collection for album')
    else fail('create private collection', String(colRes.status()))

    const addRes = await api.post(`${API}/api/me/collections/${vaultSlug}/items`, {
      data: { releaseId: album.id },
    })
    if (addRes.ok()) ok('linked album release to private collection')
    else fail('add album to private collection', String(addRes.status()))

    const draftAgain = await api.patch(`${API}/api/me/releases/${album.id}`, {
      data: { state: 'DRAFT' },
    })
    if (draftAgain.ok()) ok('album returned to draft/stash (not on public profile)')
    else fail('unpublish album to draft', String(draftAgain.status()))

    const pubCol = await api.get(`${API}/api/v1/collections/${vaultSlug}`)
    if (pubCol.status() === 404) ok('private collection hidden from public API')
    else fail('private collection should 404 publicly', String(pubCol.status()))

    const draftSmart = await api.get(`${API}/api/v1/r/${album.smartLinkSlug}`)
    if (draftSmart.status() === 404) ok('draft album smart link returns 404 (stash)')
    else fail('draft album smart link should be 404', String(draftSmart.status()))

    const epSmart = await api.get(`${API}/api/v1/r/${ep.smartLinkSlug}`)
    if (epSmart.ok()) {
      const body = await epSmart.json()
      if (body.colorScheme?.accent === CATALOG_COLOR_SCHEMES.EP.accent) {
        ok('EP smart link exposes purple accent color scheme')
      } else fail('EP smart link color scheme', JSON.stringify(body.colorScheme))
    } else fail('EP smart link', String(epSmart.status()))

    const meRes = await api.get(`${API}/api/auth/me`)
    const artistId = (await meRes.json()).id

    const stashReg = await api.post(`${API}/api/me/stash`, {
      data: {
        filename: `album-masters-${stamp}.zip`,
        objectKey: `stash/${artistId}/${stamp}-album-masters.zip`,
        contentType: 'application/zip',
        sizeBytes: 8_000_000,
        format: 'ZIP',
      },
    })
    if (stashReg.ok()) {
      const file = await stashReg.json()
      const shareRes = await api.post(`${API}/api/me/stash/${file.id}/share`, {
        data: { granteeUsername: FIXTURE.fanUsername, permission: 'READ', expiresInDays: 14 },
      })
      if (shareRes.ok()) ok(`stash share created for @${FIXTURE.fanUsername} (fans-only)`)
      else fail('stash share', String(shareRes.status()))
    } else {
      fail('register stash file', String(stashReg.status()))
    }

    const dash = await ctx.newPage()
    const dashRes = await dash.goto(`${APP}/dashboard/releases`, {
      waitUntil: 'load',
      timeout: 45_000,
    })
    if (dashRes?.ok()) {
      const body = await dash.locator('body').innerText()
      if (body.includes(ep.title)) ok('dashboard releases shows EP')
      else fail('dashboard missing EP')
      if (body.includes(single.title)) ok('dashboard releases shows SINGLE')
      else fail('dashboard missing SINGLE')
      if (body.includes(album.title)) ok('dashboard releases shows draft album')
      else fail('dashboard missing draft album')
    } else fail('dashboard HTTP', String(dashRes?.status()))

    const epPage = await ctx.newPage()
    const epUi = await epPage.goto(`${APP}/r/${ep.smartLinkSlug}`, {
      waitUntil: 'load',
      timeout: 45_000,
    })
    if (epUi?.ok()) ok('EP smart link page loads in browser')
    else fail('EP smart link page', String(epUi?.status()))

    await ctx.close()
  } catch (e) {
    fail('release catalog journey', e.message)
  }

  await browser.close()

  console.log(`\n── Release catalog e2e: ${passed} passed, ${failed} failed ──`)
  if (failed > 0) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
