// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  maxRuntimeSecFromEnv,
  overdueChildren,
  parseProcStat,
  startFfmpegWatchdog,
} from './ffmpeg-watchdog.js'

// Field 22 (starttime) is 500000 ticks = 5000s after boot.
const FFMPEG_STAT =
  '4242 (ffmpeg) S 77 4242 1 0 -1 4194560 100 0 0 0 10 2 0 0 20 0 1 0 500000 1000 100 0 0 0'

describe('parseProcStat', () => {
  it('reads pid, parent, command and runtime', () => {
    expect(parseProcStat(FFMPEG_STAT, 6000)).toEqual({
      pid: 4242,
      ppid: 77,
      command: 'ffmpeg',
      runtimeSec: 1000,
    })
  })

  it('keeps a command name that contains spaces and parentheses', () => {
    const stat = FFMPEG_STAT.replace('(ffmpeg)', '(odd (name) x)')
    expect(parseProcStat(stat, 6000)?.command).toBe('odd (name) x')
  })

  it('ignores a malformed line', () => {
    expect(parseProcStat('garbage', 10)).toBeNull()
  })
})

describe('overdueChildren', () => {
  it('returns only processes past the limit', () => {
    const children = [
      { pid: 1, command: 'ffmpeg', runtimeSec: 100 },
      { pid: 2, command: 'ffprobe', runtimeSec: 3000 },
    ]
    expect(overdueChildren(children, 2700)).toEqual([children[1]])
  })
})

describe('maxRuntimeSecFromEnv', () => {
  it('uses the env value when it is a positive number', () => {
    expect(maxRuntimeSecFromEnv('600')).toBe(600)
  })

  it('falls back to 45 minutes otherwise', () => {
    expect(maxRuntimeSecFromEnv(undefined)).toBe(2700)
    expect(maxRuntimeSecFromEnv('nope')).toBe(2700)
    expect(maxRuntimeSecFromEnv('0')).toBe(2700)
  })
})

describe('startFfmpegWatchdog', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('kills and logs overdue ffmpeg children on each tick', async () => {
    const kill = vi.fn()
    const list = vi.fn().mockResolvedValue([
      { pid: 10, command: 'ffmpeg', runtimeSec: 50 },
      { pid: 11, command: 'ffmpeg', runtimeSec: 4000 },
    ])
    const stop = startFfmpegWatchdog({ maxRuntimeSec: 2700, intervalMs: 1000, kill, list })

    await vi.advanceTimersByTimeAsync(1000)
    stop()

    expect(list).toHaveBeenCalledWith(process.pid)
    expect(kill).toHaveBeenCalledTimes(1)
    expect(kill).toHaveBeenCalledWith(11)
    expect(String(vi.mocked(console.warn).mock.calls[0]![0])).toContain('"pid":11')
  })

  it('keeps running when a scan fails', async () => {
    const kill = vi.fn()
    const list = vi
      .fn()
      .mockRejectedValueOnce(new Error('no /proc'))
      .mockResolvedValue([{ pid: 12, command: 'ffprobe', runtimeSec: 9999 }])
    const stop = startFfmpegWatchdog({ maxRuntimeSec: 60, intervalMs: 1000, kill, list })

    await vi.advanceTimersByTimeAsync(2000)
    stop()

    expect(kill).toHaveBeenCalledWith(12)
  })
})
