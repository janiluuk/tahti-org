// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { chromium } from 'playwright'

const baseUrl = (process.env.WEB_BASE_URL ?? 'http://127.0.0.1:17777').replace(/\/$/, '')
const routes = ['/', '/listen', '/feed', '/radio', '/transparency']

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()

try {
  for (const route of routes) {
    const response = await page.goto(`${baseUrl}${route}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    })
    if (!response || response.status() >= 400) {
      throw new Error(`${route} returned ${response?.status() ?? 'no response'}`)
    }
    await page.locator('body').waitFor({ state: 'visible', timeout: 10_000 })
    const bodyText = await page.locator('body').innerText()
    if (bodyText.trim().length < 20) {
      throw new Error(`${route} rendered an unexpectedly empty page`)
    }
    console.log(`✓ ${route} (${response.status()})`)
  }
} finally {
  await browser.close()
}
