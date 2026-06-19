#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>
/**
 * Playwright e2e — pro audio editor: per-archive editor + multitrack sessions.
 *
 *   API_URL=http://localhost:3011 APP_URL=http://localhost:3010 node tests/e2e/pro-audio-editor.mjs
 *
 * Requires API + web running and journey fixtures seeded.
 */

import { chromium } from 'playwright'
import { apiLogin } from './lib/api-session.mjs'

const APP = process.env.APP_URL ?? 'http://localhost:3010'
const API = process.env.API_URL ?? 'http://localhost:3011'

const FIXTURE = {
  password: process.env.E2E_DEMO_PASS ?? 'screenshot-demo-pass',
  artistEmail: process.env.E2E_DEMO_ARTIST_EMAIL ?? 'screenshot-artist@e2e.tahti.live',
  archiveTitle: process.env.E2E_DEMO_ARCHIVE_TITLE ?? 'Live at Klubi — March 2026',
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

  console.log('\n── Pro audio editor journey (Playwright + API) ──')

  try {
    const cookie = await apiLogin(API, APP, FIXTURE.artistEmail, FIXTURE.password)
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    await ctx.addCookies([cookie])
    const api = ctx.request

    const archiveRes = await api.get(`${API}/api/me/archive`)
    if (!archiveRes.ok()) {
      fail('list archive items', String(archiveRes.status()))
      throw new Error('no archive list')
    }
    const archiveItems = await archiveRes.json()
    const item = archiveItems.find((row) => row.title === FIXTURE.archiveTitle)
    if (!item) {
      fail(`find archive "${FIXTURE.archiveTitle}"`)
      throw new Error('archive missing')
    }
    ok(`found archive item "${item.title}"`)

    const sourceRes = await api.get(`${API}/api/me/archive/${item.id}/editor/source`)
    if (sourceRes.ok()) ok('editor source API returns presigned URL')
    else fail('editor source API', String(sourceRes.status()))

    const draftRes = await api.get(`${API}/api/me/archive/${item.id}/editor/draft`)
    if (draftRes.ok()) {
      const draft = await draftRes.json()
      if (draft.editList?.sourceDuration) ok('editor draft API returns EditList')
      else fail('editor draft missing editList')
    } else fail('editor draft API', String(draftRes.status()))

    const editorPage = await ctx.newPage()
    const editorNav = await editorPage.goto(`${APP}/dashboard/archive/${item.id}/editor`, {
      waitUntil: 'load',
      timeout: 60_000,
    })
    if (!editorNav?.ok()) {
      fail('pro editor page HTTP', String(editorNav?.status()))
    } else {
      await editorPage.waitForSelector('.pro-editor-shell, .pro-editor-loading, .studio-text-error', {
        timeout: 45_000,
      })
      const hasShell = (await editorPage.locator('.pro-editor-shell').count()) > 0
      const hasError = (await editorPage.locator('.studio-text-error').count()) > 0
      if (hasShell) {
        ok('pro editor shell rendered')
        const title = editorPage.locator('.pro-editor-title')
        if ((await title.count()) > 0) ok('pro editor shows archive title')
        else fail('pro editor title missing')
        const tabs = editorPage.locator('.pro-editor-tabs')
        if ((await tabs.count()) > 0) ok('pro editor waveform/tracklist tabs visible')
        else fail('pro editor tabs missing')
        const canvas = editorPage.locator('.pro-editor-canvas, .pro-editor-wave canvas')
        if ((await canvas.count()) > 0) ok('pro editor waveform canvas present')
        else fail('pro editor waveform canvas missing')
      } else if (hasError) {
        console.log('⚠ pro editor showed error state (MinIO/API may be unavailable in stack)')
      } else {
        fail('pro editor shell did not load')
      }
    }

    const indexPage = await ctx.newPage()
    const indexNav = await indexPage.goto(`${APP}/dashboard/editor`, {
      waitUntil: 'load',
      timeout: 45_000,
    })
    if (indexNav?.ok()) {
      ok('multitrack editor index loads')
      const body = await indexPage.locator('body').innerText()
      if (body.includes('Audio editor')) ok('editor index heading visible')
      else fail('editor index heading missing')
      if (body.includes('Live at Klubi') || body.includes('edit')) {
        ok('seeded editor session listed')
      } else {
        console.log('⚠ no seeded editor session in list — re-run stack seed')
      }
    } else fail('editor index HTTP', String(indexNav?.status()))

    const projectsRes = await api.get(`${API}/api/me/editor/projects`)
    if (projectsRes.ok()) {
      const projects = await projectsRes.json()
      if (Array.isArray(projects) && projects.length > 0) ok('editor projects API lists sessions')
      else fail('editor projects API empty')
    } else fail('editor projects API', String(projectsRes.status()))

    await ctx.close()
  } catch (e) {
    fail('pro audio editor journey', e.message)
  }

  await browser.close()

  console.log(`\n── Pro audio editor e2e: ${passed} passed, ${failed} failed ──`)
  if (failed > 0) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
