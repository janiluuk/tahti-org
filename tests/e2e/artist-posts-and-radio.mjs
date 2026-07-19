#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>
/**
 * Playwright e2e — artist "stories" scheduling + featured-post display, and the
 * Tahti Radio next-live countdown announcement. Practical edge cases:
 *
 *   - scheduled (future publishAt) posts stay hidden from every public page
 *     until they publish, but are visible (with a "Scheduled for" badge) to
 *     the owner in the dashboard
 *   - only the single latest post is featured on the artist/channel page; the
 *     Updates list below does not duplicate it
 *   - the dashboard editor rejects an empty and a past schedule time before
 *     hitting the API
 *   - the radio next-live countdown only appears when nobody is live and the
 *     next booked slot starts within the 2-hour window (boundary-tested at
 *     119/121 minutes), is mutually exclusive with the "Live now" banner, and
 *     degrades cleanly when a slot has no note or no slot is booked at all
 *
 * Self-seeding — does not depend on seed-e2e-screenshots.ts fixtures. Seeds via
 * apps/api/scripts/seed-e2e-posts-radio.ts (direct DB access), then drives the
 * real running API + web over HTTP/browser.
 *
 *   DATABASE_URL=postgresql://tahti:tahti_dev@localhost:5432/tahti \
 *   API_URL=http://localhost:3001 APP_URL=http://localhost:3010 \
 *     node tests/e2e/artist-posts-and-radio.mjs
 *
 * Requires API + web running against that same database.
 *
 * The radio journey alone makes ~7 requests that share the strict IP-keyed
 * auth rate-limit bucket (10/min — every /radio load fires a chat viewer-token
 * POST), so back-to-back runs within the same minute can 429. Leave ~60s
 * between local reruns; a single CI run starts from a clean bucket.
 */

import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { apiLogin } from './lib/api-session.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const API_DIR = join(__dirname, '../../apps/api')

const APP = process.env.APP_URL ?? 'http://localhost:3010'
const API = process.env.API_URL ?? 'http://localhost:3001'
const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://tahti:tahti_dev@localhost:5432/tahti'

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

/** Format a Date as a `datetime-local` input value in *local* time (not UTC). */
function toDatetimeLocalValue(date) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function seed(...args) {
  const res = spawnSync('npx', ['tsx', 'scripts/seed-e2e-posts-radio.ts', ...args], {
    cwd: API_DIR,
    env: { ...process.env, DATABASE_URL },
    encoding: 'utf8',
  })
  if (res.status !== 0) {
    throw new Error(`seed ${args.join(' ')} failed: ${res.stderr || res.stdout}`)
  }
  const lastLine = res.stdout.trim().split('\n').pop()
  return JSON.parse(lastLine)
}

async function main() {
  const health = await fetch(`${API}/health`)
  if (!health.ok) {
    console.error(`API not healthy at ${API}`)
    process.exit(1)
  }
  ok('API health')

  const browser = await chromium.launch({ headless: true })

  // ── Stories: scheduling + featured-latest-post ────────────────────────────
  console.log('\n── Artist posts / stories journey ──')
  try {
    const artist = seed('posts')
    ok('seeded stories artist with older + latest + scheduled posts')

    // Login first, before any page visit that mounts a chat panel — the
    // channel/radio pages fire a viewer-token POST on mount which shares the
    // same strict auth-rate-limit bucket as login (both are IP-keyed), so
    // browsing several chat-bearing pages first can starve out a later login.
    const cookie = await apiLogin(API, APP, artist.email, artist.password)
    const dashCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    await dashCtx.addCookies([cookie])
    const dash = await dashCtx.newPage()
    const dashRes = await dash.goto(`${APP}/dashboard/posts`, {
      waitUntil: 'load',
      timeout: 45_000,
    })
    if (!dashRes?.ok()) fail('dashboard posts HTTP', String(dashRes?.status()))
    else ok('dashboard posts page loads')

    const dashText = await dash.locator('body').innerText()
    if (dashText.includes('Secret future post') && dashText.includes('Scheduled for')) {
      ok('dashboard shows the scheduled post with a "Scheduled for" badge')
    } else fail('dashboard missing scheduled-post badge')
    if (dashText.includes('Latest drop') && dashText.includes('Published')) {
      ok('dashboard shows the published post as "Published"')
    } else fail('dashboard missing published-post label')

    // Edge case: submitting "schedule for later" with no datetime filled in
    // must be rejected client-side, before ever hitting the API.
    await dash.getByLabel('Title (optional)').fill('Edge case draft')
    await dash.getByLabel("What's new?").fill('Testing schedule validation.')
    await dash.getByText('Schedule for later').click()
    const datetimeInput = dash.locator('input[type="datetime-local"]')
    if ((await datetimeInput.count()) === 1) ok('schedule toggle reveals the datetime picker')
    else fail('datetime picker did not appear after enabling schedule')

    await dash.getByRole('button', { name: /Schedule post/ }).click()
    const emptyError = dash.getByText('Pick a date and time to schedule for.')
    try {
      await emptyError.waitFor({ state: 'visible', timeout: 5_000 })
      ok('empty schedule datetime is rejected client-side')
    } catch {
      fail('empty schedule datetime was not rejected')
    }

    // Edge case: a past datetime must also be rejected, not silently published now.
    await datetimeInput.fill('2020-01-01T00:00')
    await dash.getByRole('button', { name: /Schedule post/ }).click()
    const pastError = dash.getByText('Scheduled time must be in the future.')
    try {
      await pastError.waitFor({ state: 'visible', timeout: 5_000 })
      ok('past schedule datetime is rejected client-side')
    } catch {
      fail('past schedule datetime was not rejected')
    }

    // Now a valid future schedule should succeed end-to-end through the real form.
    // datetime-local values are local-time, not UTC — build the fill string from
    // local date/time components (matching what the browser and the component's
    // `new Date(value)` both assume) rather than toISOString(), which would be
    // silently off by the runner's UTC offset and could even land in the past.
    await datetimeInput.fill(toDatetimeLocalValue(new Date(Date.now() + 2 * 60 * 60 * 1000)))
    await dash.getByRole('button', { name: /Schedule post/ }).click()
    try {
      await dash.getByText('Edge case draft').first().waitFor({ state: 'visible', timeout: 10_000 })
      ok('valid future schedule publishes through the real editor form')
    } catch {
      fail('scheduling a valid future post via the UI failed')
    }

    // Immediate (non-scheduled) publish through the same form.
    await dash.getByLabel('Title (optional)').fill('Immediate edge case')
    await dash.getByLabel("What's new?").fill('Publishing right now via the UI.')
    await dash.getByRole('button', { name: /^Publish$/ }).click()
    try {
      await dash
        .getByText('Immediate edge case')
        .first()
        .waitFor({ state: 'visible', timeout: 10_000 })
      ok('immediate publish through the real editor form appears instantly')
    } catch {
      fail('immediate publish via the UI failed')
    }

    await dashCtx.close()

    const pub = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    const profilePage = await pub.newPage()
    const profileRes = await profilePage.goto(`${APP}/u/${artist.username}`, {
      waitUntil: 'load',
      timeout: 45_000,
    })
    if (!profileRes?.ok()) fail('artist profile HTTP', String(profileRes?.status()))
    else ok('artist profile page loads')

    const profileText = await profilePage.locator('body').innerText()
    if (profileText.includes('Latest drop')) ok('profile features the newest post')
    else fail('profile missing featured latest post')

    if (profileText.includes('Older post')) ok('profile Updates list shows the older post')
    else fail('profile missing older post in Updates list')

    if (!profileText.includes('Secret future post')) {
      ok('profile hides the scheduled future post')
    } else fail('profile leaked a scheduled future post — SHOULD NEVER BE VISIBLE')

    const featuredOccurrences = profileText.split('Latest drop').length - 1
    if (featuredOccurrences === 1) ok('featured post is not duplicated in the Updates list')
    else fail('featured post duplicated', `found ${featuredOccurrences} occurrences`)

    const channelPage = await pub.newPage()
    const channelRes = await channelPage.goto(`${APP}/c/${artist.username}`, {
      waitUntil: 'load',
      timeout: 45_000,
    })
    if (!channelRes?.ok()) fail('channel page HTTP', String(channelRes?.status()))
    else ok('channel page loads')

    const channelText = await channelPage.locator('body').innerText()
    if (channelText.includes('Latest drop')) ok('channel page features the newest post')
    else fail('channel page missing featured latest post')
    if (!channelText.includes('Secret future post')) {
      ok('channel page hides the scheduled future post')
    } else fail('channel page leaked a scheduled future post')

    await pub.close()
  } catch (e) {
    fail('artist posts / stories journey', e.message)
  }

  // ── Tahti Radio next-live countdown ────────────────────────────────────────
  console.log('\n── Tahti Radio next-live countdown journey ──')
  try {
    const radioCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    const radioPage = await radioCtx.newPage()

    // The calendar grid below always renders each booked slot's artist name
    // (visible cell label, independent of the countdown), so body-text
    // `.includes(displayName)` is not a reliable signal for "the countdown
    // rendered" — it would false-positive off the calendar alone. Scope
    // countdown assertions to its own element instead. Its label is
    // upper-cased via CSS (text-transform), so match case-insensitively.
    // Navigates once and reads both signals off that single fresh load —
    // reading them off two separate navigations invites a stale-page race.
    // The page fetches with `next: { revalidate }`, so a cache-busting query
    // param forces each reload to be treated as a distinct request.
    async function loadRadioState() {
      await radioPage.goto(`${APP}/radio?_e2e=${Date.now()}`, {
        waitUntil: 'load',
        timeout: 45_000,
      })
      const liveNow = (await radioPage.locator('.ch-radio-live-now').count()) > 0
      const label = radioPage.locator('.ch-countdown-label')
      let note = null
      if (
        (await label.count()) > 0 &&
        /next live broadcast/i.test(await label.first().innerText())
      ) {
        const noteEl = radioPage.locator('.ch-countdown-note')
        note = (await noteEl.count()) > 0 ? await noteEl.first().innerText() : ''
      }
      return { liveNow, note }
    }

    // Nobody live, next slot in 45 minutes (well inside the 2h window).
    seed('radio-slot', '45', '60', 'Late Night Deep House Takeover')
    let state = await loadRadioState()
    if (state.note !== null) ok('countdown appears for a slot 45min out')
    else fail('countdown missing for a slot 45min out')
    if (state.note === 'E2E Radio DJ — Late Night Deep House Takeover') {
      ok('countdown mentions who is playing and the show name')
    } else fail('countdown missing artist name / show name', state.note ?? 'null')
    if (!state.liveNow) ok('"Live now" banner absent while nobody is live')
    else fail('"Live now" banner shown while nobody is live')

    // Boundary: just inside the 2h window (119min) must still show the countdown.
    seed('radio-slot', '119', '30')
    state = await loadRadioState()
    if (state.note !== null) ok('countdown appears exactly inside the 2h boundary (119min)')
    else fail('countdown missing at 119min boundary')

    // Boundary: just outside the 2h window (121min) must not show anything yet.
    seed('radio-slot', '121', '30')
    state = await loadRadioState()
    if (state.note === null) ok('countdown absent just outside the 2h boundary (121min)')
    else fail('countdown incorrectly shown at 121min boundary')
    if (!state.liveNow) ok('no live banner either, this far out')
    else fail('unexpected live banner far outside the window')

    // Slot with no note: name shown, no dangling separator artifact.
    seed('radio-slot', '30', '30')
    state = await loadRadioState()
    if (state.note !== null) ok('countdown works for a slot with no note')
    else fail('countdown broken for a no-note slot')
    if (state.note === 'E2E Radio DJ') ok('no dangling separator when a slot has no note')
    else fail('dangling separator artifact rendered for a no-note slot', state.note ?? 'null')

    // Currently live: banner replaces the countdown (mutually exclusive).
    seed('radio-slot', '-5', '30', 'On air right now')
    state = await loadRadioState()
    if (state.liveNow) ok('"Live now" banner appears once the slot has started')
    else fail('"Live now" banner missing while a slot is active')
    if (state.note === null) ok('countdown is suppressed while someone is already live')
    else fail('countdown incorrectly shown alongside "Live now"')

    // Nothing booked at all: clean baseline, neither element renders.
    seed('radio-clear')
    state = await loadRadioState()
    if (!state.liveNow && state.note === null) {
      ok('neither banner renders when no slot is booked')
    } else fail('unexpected live/countdown banner with no bookings at all')

    await radioCtx.close()
  } catch (e) {
    fail('radio next-live countdown journey', e.message)
  }

  await browser.close()

  console.log(`\n── Artist posts & radio countdown e2e: ${passed} passed, ${failed} failed ──`)
  if (failed > 0) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
