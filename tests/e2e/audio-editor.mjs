#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>
/**
 * Playwright e2e — artist opens the multitrack audio editor from a seeded archive item.
 * Captures a reference screenshot for visual audit (M21).
 *
 *   API_URL=http://localhost:15011 APP_URL=http://localhost:17777 node tests/e2e/audio-editor.mjs
 *
 * Requires Docker stack + seed (./scripts/stack-up.sh --seed).
 * Writes: docs/e2e-screenshots/artist/editor-multitrack.png
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '../../docs/e2e-screenshots')
const SCREENSHOT = join(OUT_DIR, 'artist/editor-multitrack.png')
const MANIFEST = join(OUT_DIR, 'manifest.json')

const APP = process.env.APP_URL ?? 'http://localhost:17777'
const API = process.env.API_URL ?? 'http://localhost:15011'

const FIXTURE = {
  password: process.env.E2E_DEMO_PASS ?? 'screenshot-demo-pass',
  artistEmail: process.env.E2E_DEMO_ARTIST_EMAIL ?? 'screenshot-artist@e2e.tahti.live',
  archiveTitle: 'Live at Klubi',
}

/** Minimal mono 16-bit PCM WAV (3s silence) for timeline audit when MinIO seed blob is absent. */
function makeSilentWav(durationSec = 3, sampleRate = 8000) {
  const numSamples = sampleRate * durationSec
  const dataSize = numSamples * 2
  const buf = Buffer.alloc(44 + dataSize)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + dataSize, 4)
  buf.write('WAVE', 8)
  buf.write('fmt ', 12)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20)
  buf.writeUInt16LE(1, 22)
  buf.writeUInt32LE(sampleRate, 24)
  buf.writeUInt32LE(sampleRate * 2, 28)
  buf.writeUInt16LE(2, 32)
  buf.writeUInt16LE(16, 34)
  buf.write('data', 36)
  buf.writeUInt32LE(dataSize, 40)
  return buf
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

async function apiLogin(email, password) {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) throw new Error(`login ${email}: ${res.status}`)
  const setCookie = res.headers.get('set-cookie') ?? ''
  const match = setCookie.match(/tahti_session=([^;]+)/)
  if (!match) throw new Error('no session cookie')
  const host = new URL(APP).hostname
  return {
    name: 'tahti_session',
    value: match[1],
    domain: host === 'localhost' ? 'localhost' : host,
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
  }
}

async function updateManifest() {
  const entry = {
    role: 'artist',
    id: 'editor-multitrack',
    file: 'artist/editor-multitrack.png',
    url: '/dashboard/editor/:id (from archive item)',
    label: 'Multitrack audio editor (archive edit session)',
  }
  try {
    const raw = await readFile(MANIFEST, 'utf8')
    const manifest = JSON.parse(raw)
    const idx = manifest.findIndex((m) => m.id === entry.id && m.role === entry.role)
    if (idx >= 0) manifest[idx] = entry
    else {
      const editorIdx = manifest.findIndex((m) => m.id === 'editor' && m.role === 'artist')
      if (editorIdx >= 0) manifest.splice(editorIdx + 1, 0, entry)
      else manifest.push(entry)
    }
    await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + '\n')
    ok('manifest.json updated')
  } catch (e) {
    fail('manifest.json update', e.message)
  }
}

async function main() {
  const health = await fetch(`${API}/health`)
  if (!health.ok) {
    console.error(`API not healthy at ${API}`)
    process.exit(1)
  }
  ok('API health')

  const browser = await chromium.launch({ headless: true })

  console.log('\n── Audio editor e2e (Playwright) ──')
  try {
    const cookie = await apiLogin(FIXTURE.artistEmail, FIXTURE.password)
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    await ctx.addCookies([cookie])
    const api = ctx.request

    const archRes = await api.get(`${API}/api/me/archive`)
    if (!archRes.ok()) {
      fail('list archive items', String(archRes.status()))
    } else {
      const items = await archRes.json()
      const item = items.find((i) => String(i.title).includes(FIXTURE.archiveTitle))
      if (!item?.id) {
        fail('find seeded archive item', `missing "${FIXTURE.archiveTitle}" — run stack seed`)
      } else {
        ok(`archive item "${item.title}" (${item.id})`)

        const createRes = await api.post(`${API}/api/me/editor/projects`, {
          data: { archiveItemId: item.id },
        })
        if (!createRes.ok()) {
          fail('create editor project', String(createRes.status()))
        } else {
          const project = await createRes.json()
          ok(`editor project ${project.id}`)

          const page = await ctx.newPage()
          const url = `${APP}/dashboard/editor/${project.id}`
          const nav = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 })
          if (!nav?.ok()) {
            console.log(`⚠ editor page HTTP ${nav?.status()} — checking rendered UI anyway`)
          } else ok('editor page loads')

          await page
            .getByRole('heading', { name: 'Multitrack editor' })
            .waitFor({ timeout: 15_000 })
          ok('multitrack editor heading')

          const editorRoot = page.locator('.studio-multitrack-editor')
          await editorRoot.waitFor({ timeout: 15_000 })
          ok('editor workspace mounted')

          // Seed blob may be absent in MinIO — add a local track so the timeline is auditable.
          const fileInput = page.locator('.studio-multitrack-editor input[type="file"]')
          if ((await fileInput.count()) > 0) {
            await fileInput.setInputFiles({
              name: 'e2e-editor-audit.wav',
              mimeType: 'audio/wav',
              buffer: makeSilentWav(),
            })
            ok('local audit track uploaded via Add track')
          }

          const playlist = page.locator('.studio-playlist-viz')
          await Promise.race([
            page.getByText('e2e-editor-audit').waitFor({ timeout: 25_000 }),
            playlist.waitFor({ state: 'visible', timeout: 25_000 }),
            page.waitForTimeout(8000),
          ])

          const transport = page.locator('.studio-editor-transport')
          if ((await transport.count()) > 0) ok('transport controls visible')
          else fail('transport controls missing')

          if ((await page.getByText('e2e-editor-audit').count()) > 0) ok('timeline clip visible')
          else if ((await playlist.count()) > 0) ok('waveform timeline visible')
          else console.log('⚠ timeline clip not found — chrome-only screenshot')

          const saveBtn = page.getByRole('button', { name: /Save mix to archive/i })
          if ((await saveBtn.count()) > 0) ok('export panel present')
          else fail('export panel missing')

          await mkdir(join(OUT_DIR, 'artist'), { recursive: true })
          await page.screenshot({ path: SCREENSHOT, fullPage: true })
          ok(`screenshot saved → ${SCREENSHOT}`)

          await updateManifest()
        }
      }
    }

    await ctx.close()
  } catch (e) {
    fail('audio editor journey', e.message)
  }

  await browser.close()

  console.log(`\n── Audio editor e2e: ${passed} passed, ${failed} failed ──`)
  if (failed > 0) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
