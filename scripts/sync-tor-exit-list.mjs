#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>
//
// Refresh bundled Tor exit IPs (M18). Run manually or in ops cron; worker also syncs to Redis daily.

import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const URL = 'https://check.torproject.org/torbulkexitlist?ip=0.0.0.0'
const outPath = join(dirname(fileURLToPath(import.meta.url)), '../packages/shared/data/tor-exit-cidrs.txt')

const res = await fetch(URL, { headers: { 'User-Agent': 'Tahti-tor-exit-sync/1.0' } })
if (!res.ok) {
  console.error(`fetch failed: ${res.status} ${res.statusText}`)
  process.exit(1)
}
const body = await res.text()
const ips = []
for (const line of body.split('\n')) {
  const ip = line.trim()
  if (!ip || ip.startsWith('#')) continue
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) ips.push(ip)
}
writeFileSync(outPath, ips.length ? `${ips.join('\n')}\n` : '', 'utf8')
console.log(`wrote ${ips.length} Tor exit IPs to ${outPath}`)
