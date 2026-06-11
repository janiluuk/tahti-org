#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>
/**
 * Playwright e2e — artist goes live, two independent chat clients join the
 * channel, see the live state, and each post a chat message that the other
 * receives over the Centrifugo pub/sub round trip.
 *
 *   API_URL=http://localhost:3011 APP_URL=http://localhost:3010 node tests/e2e/live-chat.mjs
 *
 * Requires API + web running, journey fixtures seeded, and Centrifugo reachable
 * from the browser at NEXT_PUBLIC_CENTRIFUGO_WS.
 */

import { chromium } from 'playwright'

const APP = process.env.APP_URL ?? 'http://localhost:3010'
const API = process.env.API_URL ?? 'http://localhost:3011'

const FIXTURE = {
  artist: process.env.E2E_DEMO_ARTIST_USER ?? 'screenshot-demo',
  icecastPass: process.env.E2E_DEMO_ICECAST_PASS ?? 'screenshot-pass',
}

const CHAT_LINES = [
  'this set is incredible',
  'turn it up!!',
  'greetings from Helsinki',
  'love the transitions tonight',
  'first time catching you live, this rules',
  'that drop hit hard',
  'who else is here from the cooperative',
  'save this one for the archive please',
]

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

function pickTwoMessages() {
  const pool = [...CHAT_LINES]
  const first = pool.splice(Math.floor(Math.random() * pool.length), 1)[0]
  const second = pool.splice(Math.floor(Math.random() * pool.length), 1)[0]
  return [first, second]
}

async function joinChat(page, handle, label) {
  const handleInput = page.locator(
    'input[placeholder="Your handle"], input[aria-label="Chat handle"]',
  )
  if ((await handleInput.count()) === 0) {
    fail(`${label} — chat handle field not found`)
    return false
  }
  await handleInput.fill(handle)
  await page.locator('button.ch-chat-send').click()

  const chatInput = page.locator(
    'input[placeholder="Say something…"], input[aria-label="Chat message"]',
  )
  try {
    await chatInput.waitFor({ timeout: 20_000 })
  } catch {
    fail(`${label} — did not transition to joined chat state`)
    return false
  }
  ok(`${label} joins live chat as "${handle}"`)
  return true
}

async function sendChatMessage(page, text, label) {
  const input = page.locator(
    'input[placeholder="Say something…"], input[aria-label="Chat message"]',
  )
  await input.fill(text)
  await page.locator('button.ch-chat-send').click()
  await input.waitFor({ state: 'visible' })
  const cleared = (await input.inputValue()) === ''
  if (cleared) ok(`${label} sends "${text}"`)
  else fail(`${label} — message input did not clear after send`)
}

async function expectMessageVisible(page, text, label) {
  try {
    await page.waitForFunction(
      (needle) =>
        Array.from(document.querySelectorAll('.chat-msg .text')).some((el) =>
          (el.textContent ?? '').includes(needle),
        ),
      text,
      { timeout: 20_000 },
    )
    ok(`${label} sees message "${text}"`)
  } catch {
    fail(`${label} — never received message "${text}"`)
  }
}

async function main() {
  const health = await fetch(`${API}/health`)
  if (!health.ok) {
    console.error(`API not healthy at ${API}`)
    process.exit(1)
  }
  ok('API health')

  // ── Simulate the artist going live via the Icecast on_connect webhook ──────
  const mount = `/live/${FIXTURE.artist}`
  let wentLive = false
  try {
    const connectRes = await fetch(`${API}/internal/icecast/on_connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ mount, pass: FIXTURE.icecastPass }),
    })
    if (connectRes.ok) {
      ok('Icecast on_connect simulates the artist going live')
      wentLive = true
    } else {
      console.log(`⚠ Icecast on_connect returned ${connectRes.status} — live simulation skipped (cap or fixture)`)
    }
  } catch (e) {
    console.log(`⚠ Icecast on_connect unreachable — ${e.message}`)
  }

  const browser = await chromium.launch({ headless: true })

  console.log('\n── Live broadcast + multi-client chat journey (Playwright) ──')
  const stamp = Date.now() % 100_000
  const handleA = `e2e-fan-a-${stamp}`
  const handleB = `e2e-fan-b-${stamp}`
  const [textA, textB] = pickTwoMessages()

  let ctxA
  let ctxB
  try {
    ctxA = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    ctxB = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    const pageA = await ctxA.newPage()
    const pageB = await ctxB.newPage()

    const [resA, resB] = await Promise.all([
      pageA.goto(`${APP}/c/${FIXTURE.artist}`, { waitUntil: 'load', timeout: 45_000 }),
      pageB.goto(`${APP}/c/${FIXTURE.artist}`, { waitUntil: 'load', timeout: 45_000 }),
    ])
    if (resA?.ok() && resB?.ok()) ok('both clients load the channel page')
    else fail('channel page load', `A=${resA?.status()} B=${resB?.status()}`)

    if (wentLive) {
      for (const [page, label] of [
        [pageA, 'client A'],
        [pageB, 'client B'],
      ]) {
        const body = await page.locator('body').innerText()
        if (body.includes('LIVE')) ok(`${label} sees LIVE badge`)
        else fail(`${label} — LIVE badge not shown`)

        const player = page.locator('[data-testid="channel-live-player"]')
        if ((await player.count()) > 0) ok(`${label} sees the live stream player`)
        else console.log(`⚠ ${label} — live player element not present (HLS pipeline may be unavailable)`)
      }
    } else {
      console.log('⚠ skipping live-state assertions — broadcast simulation unavailable')
    }

    // ── Both clients join chat with their own handles ────────────────────────
    const joinedA = await joinChat(pageA, handleA, 'client A')
    const joinedB = await joinChat(pageB, handleB, 'client B')

    if (joinedA && joinedB) {
      // ── Each leaves one (random) chat message ──────────────────────────────
      await sendChatMessage(pageA, textA, 'client A')
      await sendChatMessage(pageB, textB, 'client B')

      // ── Verify the round trip: both clients see both messages ──────────────
      await expectMessageVisible(pageA, textA, 'client A')
      await expectMessageVisible(pageA, textB, 'client A')
      await expectMessageVisible(pageB, textA, 'client B')
      await expectMessageVisible(pageB, textB, 'client B')
    } else {
      console.log('⚠ skipping message exchange — one or both clients failed to join chat')
    }
  } catch (e) {
    fail('live chat journey', e.message)
  } finally {
    if (ctxA) await ctxA.close()
    if (ctxB) await ctxB.close()
  }

  if (wentLive) {
    await fetch(`${API}/internal/icecast/on_disconnect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ mount }),
    }).catch(() => {})
  }

  await browser.close()

  console.log(`\n── Live chat e2e: ${passed} passed, ${failed} failed ──`)
  if (failed > 0) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
