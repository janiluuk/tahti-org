// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, vi, beforeEach } from 'vitest'

const execCalls: string[] = []
let runningContainers = new Set<string>()
let failDockerRun = false

vi.mock('node:child_process', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:child_process')>()),
  exec: (
    cmd: string,
    cb: (err: Error | null, out?: { stdout: string; stderr: string }) => void,
  ) => {
    execCalls.push(cmd)
    const reply = (stdout: string) => cb(null, { stdout, stderr: '' })
    if (cmd.startsWith(`docker ps --format`)) {
      return reply([...runningContainers].join('\n'))
    }
    const byName = /name=\^\/([^$]+)\$/.exec(cmd)
    if (cmd.startsWith('docker ps -q') && byName) {
      return reply(runningContainers.has(byName[1]!) ? 'abc123\n' : '')
    }
    if (cmd.startsWith('docker volume inspect')) return reply('/var/lib/docker/volumes/cfg/_data\n')
    if (cmd.startsWith('docker run -d')) {
      if (failDockerRun) return cb(new Error('docker run failed'))
      const name = /--name (\S+)/.exec(cmd)![1]!
      runningContainers.add(name)
      return reply('newid\n')
    }
    return reply('')
  },
}))

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(async () => 'live = "{{LIVE_INPUT_URL}}"\n{{#RTMP_TARGETS}}x{{/RTMP_TARGETS}}'),
  writeFile: vi.fn(async () => undefined),
}))

const findMany = vi.fn()
const findUnique = vi.fn()
vi.mock('@tahti/db', () => ({
  prisma: {
    channel: {
      findMany: (...a: unknown[]) => findMany(...a),
      findUnique: (...a: unknown[]) => findUnique(...a),
    },
  },
}))

function liveChannel(
  slug: string,
  opts: { broadcastId?: string | null; rotation?: boolean; source?: string } = {},
) {
  const broadcastId = opts.broadcastId === undefined ? `b-${slug}` : opts.broadcastId
  return {
    id: `ch-${slug}`,
    slug,
    broadcasts: broadcastId ? [{ id: broadcastId, source: opts.source ?? 'ICECAST' }] : [],
    curatedRotationItems: opts.rotation ? [{ id: 'item-1' }] : [],
  }
}

function dockerRunFor(slug: string): string | undefined {
  return execCalls.find(
    (c) => c.startsWith('docker run -d') && c.includes(`--name tahti-channel-${slug} `),
  )
}

async function loadModule() {
  vi.resetModules()
  return import('./liquidsoap.js')
}

beforeEach(() => {
  vi.clearAllMocks()
  execCalls.length = 0
  runningContainers = new Set()
  failDockerRun = false
  findMany.mockReset()
  findUnique.mockReset()
  findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => ({
    id: where.id,
    slug: where.id.replace(/^ch-/, ''),
    liveSourcePass: 'pass',
    liveInputOverrideSlug: null,
    rtmpTargets: [],
    streamOverlayTitle: null,
    streamOverlaySubtitle: null,
    streamOverlayShowTitle: false,
    streamOverlayTextColor: null,
    streamOverlayScrimEnabled: false,
    streamOverlayCoverUrl: null,
    streamOverlayBackdropUrl: null,
    streamOverlayVisualPreset: null,
    user: { displayName: 'Artist', avatarUrl: null },
  }))
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

describe('reconcileActiveChannelsOnBoot', () => {
  it('registers LIVE channels whose container is still running without respawning them', async () => {
    findMany.mockResolvedValue([liveChannel('tahti-radio')])
    runningContainers.add('tahti-channel-tahti-radio')
    const mod = await loadModule()

    const result = await mod.reconcileActiveChannelsOnBoot()

    expect(result).toEqual({ registered: ['tahti-radio'], respawned: [], failed: [], skipped: [] })
    expect(mod.getContainerNameForChannel('ch-tahti-radio')).toBe('tahti-channel-tahti-radio')
    expect(dockerRunFor('tahti-radio')).toBeUndefined()
  })

  it('respawns a LIVE curated-rotation channel whose container is gone, with the rotation template', async () => {
    findMany.mockResolvedValue([liveChannel('tahti-selects', { rotation: true })])
    const mod = await loadModule()
    const fs = await import('node:fs/promises')

    const result = await mod.reconcileActiveChannelsOnBoot()

    expect(result.respawned).toEqual(['tahti-selects'])
    expect(dockerRunFor('tahti-selects')).toContain('-e BROADCAST_ID=b-tahti-selects')
    expect(vi.mocked(fs.readFile)).toHaveBeenCalledWith(
      '/srv/liquidsoap-rotation.liq.template',
      'utf8',
    )
    expect(mod.getContainerNameForChannel('ch-tahti-selects')).toBe('tahti-channel-tahti-selects')
  })

  it('respawns a LIVE non-rotation channel (Tahti Radio, fallback artist channel) with the channel template', async () => {
    findMany.mockResolvedValue([liveChannel('tahti-radio'), liveChannel('artist-a')])
    const mod = await loadModule()
    const fs = await import('node:fs/promises')

    const result = await mod.reconcileActiveChannelsOnBoot()

    expect(result.respawned).toEqual(['tahti-radio', 'artist-a'])
    expect(vi.mocked(fs.readFile)).toHaveBeenCalledWith(
      '/srv/liquidsoap-channel.liq.template',
      'utf8',
    )
    expect(vi.mocked(fs.readFile)).not.toHaveBeenCalledWith(
      '/srv/liquidsoap-rotation.liq.template',
      'utf8',
    )
  })

  it('only respawns Liquidsoap, never the recorder / edge-encoder sidecars', async () => {
    findMany.mockResolvedValue([liveChannel('artist-rtmp', { source: 'RTMP' })])
    const mod = await loadModule()

    await mod.reconcileActiveChannelsOnBoot()

    const runs = execCalls.filter((c) => c.startsWith('docker run -d'))
    expect(runs).toHaveLength(1)
    expect(runs[0]).toContain('--name tahti-channel-artist-rtmp ')
  })

  it('skips a LIVE channel with no open broadcast', async () => {
    findMany.mockResolvedValue([liveChannel('orphan', { broadcastId: null })])
    const mod = await loadModule()

    const result = await mod.reconcileActiveChannelsOnBoot()

    expect(result.skipped).toEqual(['orphan'])
    expect(dockerRunFor('orphan')).toBeUndefined()
  })

  it('keeps going when one respawn fails', async () => {
    findMany.mockResolvedValue([liveChannel('broken'), liveChannel('tahti-radio')])
    runningContainers.add('tahti-channel-tahti-radio')
    failDockerRun = true
    const mod = await loadModule()

    const result = await mod.reconcileActiveChannelsOnBoot()

    expect(result.failed).toEqual(['broken'])
    expect(result.registered).toEqual(['tahti-radio'])
    expect(mod.getContainerNameForChannel('broken')).toBeUndefined()
  })
})

describe('spawnLiquidsoapContainer', () => {
  it('respawns a tracked channel whose container was removed after it was registered', async () => {
    findMany.mockResolvedValue([liveChannel('tahti-radio')])
    runningContainers.add('tahti-channel-tahti-radio')
    const mod = await loadModule()
    await mod.reconcileActiveChannelsOnBoot()

    runningContainers.delete('tahti-channel-tahti-radio')
    await mod.spawnLiquidsoapContainer('ch-tahti-radio', 'tahti-radio', 'b-tahti-radio')

    expect(dockerRunFor('tahti-radio')).toBeDefined()
    expect(runningContainers.has('tahti-channel-tahti-radio')).toBe(true)
  })

  it('is a no-op while the container is running', async () => {
    runningContainers.add('tahti-channel-tahti-radio')
    const mod = await loadModule()

    await mod.spawnLiquidsoapContainer('ch-tahti-radio', 'tahti-radio', 'b-tahti-radio')

    expect(dockerRunFor('tahti-radio')).toBeUndefined()
    expect(mod.getContainerNameForChannel('ch-tahti-radio')).toBe('tahti-channel-tahti-radio')
  })
})
