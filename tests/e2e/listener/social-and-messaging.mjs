#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>
/**
 * Playwright e2e — sign in, follow two other users, DM one of them, post a
 * chat message on your own channel page, and confirm both the follow and the
 * DM produce notifications for the recipients. Then have one friend reply in
 * channel chat (real-time round trip) and reply to the DM, and confirm the
 * DM reply produces a notification for the original sender.
 *
 *   node tests/e2e/social-and-messaging.mjs
 *
 * Requires API + web running locally and the stack DB reachable via pgbouncer
 * on the host (the default local docker-compose.stack.yml port mapping).
 * Seeds its own three throwaway accounts (apps/api/scripts/seed-e2e-social.ts)
 * — safe to re-run, each run wipes and recreates them.
 */

import { chromium } from 'playwright'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const APP = process.env.APP_URL ?? 'http://localhost:17777'
const API = process.env.API_URL ?? 'http://localhost:15011'
const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://tahti:tahti_dev@localhost:16432/tahti?pgbouncer=true'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..', '..')

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

function seedFixtures() {
  const out = execFileSync(
    'pnpm',
    ['--filter', '@tahti/api', 'exec', 'tsx', 'scripts/seed-e2e-social.ts'],
    {
      cwd: REPO_ROOT,
      env: { ...process.env, DATABASE_URL },
      encoding: 'utf8',
    },
  )
  const line = out.trim().split('\n').at(-1)
  return JSON.parse(line)
}

async function signIn(page, email, password, label) {
  // A busy host (or a local Next.js dev server JIT-compiling a route on
  // first hit) can occasionally outrun a single generous timeout — retry
  // rather than fail the whole journey on what's really just slow load,
  // not a broken sign-in.
  for (let attempt = 1; attempt <= 3; attempt++) {
    await page.goto(`${APP}/login`, { waitUntil: 'load' })
    await page.fill('input[name=email]', email)
    await page.fill('input[name=password]', password)
    await Promise.all([
      page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 25_000 }).catch(() => {}),
      page.click('button[type=submit]'),
    ])
    const stillOnLogin = new URL(page.url()).pathname.startsWith('/login')
    if (!stillOnLogin) {
      ok(`${label} signs in`)
      return true
    }
    if (attempt < 3) console.log(`⚠ ${label} sign-in slow, retrying (attempt ${attempt})…`)
  }
  fail(`${label} signs in`, `still on ${page.url()}`)
  return false
}

async function followUser(page, username, label) {
  await page.goto(`${APP}/u/${username}`, { waitUntil: 'load' })
  const btn = page.locator('.ch-follow-btn')
  try {
    await btn.waitFor({ timeout: 10_000 })
  } catch {
    fail(`${label} follows @${username}`, 'follow button not found')
    return
  }
  const before = (await btn.innerText()).trim()
  await btn.click()
  await page
    .waitForFunction(
      () => document.querySelector('.ch-follow-btn')?.classList.contains('ch-follow-btn--active'),
      { timeout: 10_000 },
    )
    .catch(() => {})
  const after = (await btn.innerText()).trim()
  if (after.startsWith('Following') && after !== before) {
    ok(`${label} follows @${username}`)
  } else {
    fail(`${label} follows @${username}`, `button read "${after}"`)
  }
}

async function sendDirectMessage(page, recipientUsername, text, label) {
  await page.goto(`${APP}/dashboard/messages`, { waitUntil: 'load' })
  await page.click('button:has-text("New message")')
  const search = page.locator('input[placeholder="Search for an artist to message…"]')
  await search.fill(recipientUsername)
  const result = page.locator('.dm-new-message__result', { hasText: recipientUsername })
  try {
    await result.first().waitFor({ timeout: 10_000 })
  } catch {
    fail(`${label} starts a DM with @${recipientUsername}`, 'recipient not found in search')
    return false
  }
  await result.first().click()
  await page.waitForURL(/\/dashboard\/messages\/.+/, { timeout: 10_000 }).catch(() => {})

  const composer = page.locator('textarea').first()
  try {
    await composer.waitFor({ timeout: 10_000 })
  } catch {
    fail(`${label} starts a DM with @${recipientUsername}`, 'composer not found')
    return false
  }
  await composer.fill(text)
  await page.click('button:has-text("Send")')
  await page.waitForFunction(
    (needle) =>
      Array.from(document.querySelectorAll('.dm-message__bubble')).some((el) =>
        (el.textContent ?? '').includes(needle),
      ),
    text,
    { timeout: 10_000 },
  )
  ok(`${label} sends a DM to @${recipientUsername}: "${text}"`)
  return true
}

async function replyToDm(page, fromLabel, expectedFromDisplayName, text) {
  await page.goto(`${APP}/dashboard/messages`, { waitUntil: 'load' })
  const row = page.locator('.dm-conversation-row', { hasText: expectedFromDisplayName })
  try {
    await row.first().waitFor({ timeout: 10_000 })
  } catch {
    fail(
      `${fromLabel} opens the conversation with ${expectedFromDisplayName}`,
      'conversation not found',
    )
    return false
  }
  await row.first().click()
  const composer = page.locator('textarea').first()
  await composer.waitFor({ timeout: 10_000 })
  await composer.fill(text)
  await page.click('button:has-text("Send")')
  await page.waitForFunction(
    (needle) =>
      Array.from(document.querySelectorAll('.dm-message__bubble')).some((el) =>
        (el.textContent ?? '').includes(needle),
      ),
    text,
    { timeout: 10_000 },
  )
  ok(`${fromLabel} replies to the DM: "${text}"`)
  return true
}

async function joinChat(page, handle, label) {
  const handleInput = page.locator(
    'input[placeholder="Your handle"], input[aria-label="Chat handle"]',
  )
  try {
    // The channel page's chat panel joins Centrifugo and fetches a viewer
    // token client-side after mount — waitUntil:'load' on the preceding
    // goto() only covers the initial document load, not that async work.
    await handleInput.waitFor({ timeout: 15_000 })
  } catch {
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
  ok(`${label} joins channel chat as "${handle}"`)
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
  if (cleared) ok(`${label} sends chat message "${text}"`)
  else fail(`${label} — chat message input did not clear after send`)
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
    ok(`${label} sees chat message "${text}"`)
  } catch {
    fail(`${label} — never received chat message "${text}"`)
  }
}

async function expectNotification(page, needle, label) {
  await page.goto(`${APP}/dashboard`, { waitUntil: 'load' })
  const bellBtn = page.locator('.studio-top-nav__notif-btn')
  try {
    await bellBtn.waitFor({ timeout: 10_000 })
  } catch {
    fail(`${label} sees a notification for "${needle}"`, 'notification bell not found')
    return
  }
  await bellBtn.click()
  try {
    await page.waitForFunction(
      (text) =>
        Array.from(document.querySelectorAll('.studio-top-nav__notif-item')).some((el) =>
          (el.textContent ?? '').includes(text),
        ),
      needle,
      { timeout: 10_000 },
    )
    ok(`${label} sees a notification for "${needle}"`)
  } catch {
    fail(`${label} — no notification found for "${needle}"`)
  }
}

async function main() {
  const health = await fetch(`${API}/health`)
  if (!health.ok) {
    console.error(`API not healthy at ${API}`)
    process.exit(1)
  }
  ok('API health')

  const fixtures = seedFixtures()
  ok('seeded main + 2 friend accounts')
  const { password, main, friendA, friendB } = fixtures
  const stamp = Date.now() % 100_000
  const dmText = `Hey friend A, good to connect! (${stamp})`
  const dmReplyText = `Hey main, likewise! (${stamp})`
  const chatText = `Welcome to my channel! (${stamp})`
  const chatReplyText = `Great to be here! (${stamp})`

  const browser = await chromium.launch({ headless: true })
  console.log('\n── Follow, DM, and channel chat journey (Playwright) ──')

  // Only main + friend A are active for the real-time chat/DM core of this
  // journey — friend B's context opens later, just for a quick notification
  // check, so it isn't competing for resources (and isn't left idling, which
  // risks the WebSocket chat connection dropping) during that part.
  let ctxMain, ctxA, ctxB
  try {
    ctxMain = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    ctxA = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    const pageMain = await ctxMain.newPage()
    const pageA = await ctxA.newPage()

    // ── Main signs in, follows both friends, DMs friend A ──────────────────
    if (!(await signIn(pageMain, main.email, password, 'main')))
      throw new Error('main sign-in failed')
    await followUser(pageMain, friendA.username, 'main')
    await followUser(pageMain, friendB.username, 'main')
    await sendDirectMessage(pageMain, friendA.username, dmText, 'main')

    // ── Main joins their own channel's chat (message comes after friend A
    // also joins below — chat is live pub/sub, not a history feed, so a
    // message sent before someone joins is never backfilled to them) ───────
    await pageMain.goto(`${APP}/c/${main.username}`, { waitUntil: 'load' })
    const mainHandle = `main-${stamp}`
    const joinedMain = await joinChat(pageMain, mainHandle, 'main')

    // ── Friend A signs in, sees the follow notification, joins the same
    // channel chat, and main posts — friend A receives it live ─────────────
    if (await signIn(pageA, friendA.email, password, 'friend A')) {
      await expectNotification(pageA, main.displayName, 'friend A')
    }
    await pageA.goto(`${APP}/c/${main.username}`, { waitUntil: 'load' })
    const friendAHandle = `friendA-${stamp}`
    const joinedA = joinedMain && (await joinChat(pageA, friendAHandle, 'friend A'))
    if (joinedA) {
      await sendChatMessage(pageMain, chatText, 'main')
      await expectMessageVisible(pageA, chatText, 'friend A')
      await sendChatMessage(pageA, chatReplyText, 'friend A')
      await expectMessageVisible(pageMain, chatReplyText, 'main')
    } else {
      console.log('⚠ skipping channel chat exchange — join failed')
    }

    // ── Friend A replies to the DM; main should get a notification back ────
    const replied = await replyToDm(pageA, 'friend A', main.displayName, dmReplyText)
    if (replied) {
      await expectNotification(pageMain, friendA.displayName, 'main')
    }

    // ── Friend B signs in last, just to confirm the follow notification.
    // Close out main + friend A's contexts first — both are still holding an
    // open chat WebSocket connection, and leaving those alive has been the
    // difference between a fast, reliable sign-in here and an occasional
    // slow one. ──────────────────────────────────────────────────────────
    await ctxMain.close()
    await ctxA.close()
    ctxMain = null
    ctxA = null

    ctxB = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    const pageB = await ctxB.newPage()
    if (await signIn(pageB, friendB.email, password, 'friend B')) {
      await expectNotification(pageB, main.displayName, 'friend B')
    }
  } catch (e) {
    fail('social and messaging journey', e.message)
  } finally {
    if (ctxMain) await ctxMain.close()
    if (ctxA) await ctxA.close()
    if (ctxB) await ctxB.close()
  }

  await browser.close()

  console.log(`\n── Social and messaging e2e: ${passed} passed, ${failed} failed ──`)
  if (failed > 0) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
