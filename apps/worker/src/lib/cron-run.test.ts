// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { beforeEach, describe, expect, it, vi } from 'vitest'

const cronRunCreate = vi.hoisted(() => vi.fn())
const cronRunUpdate = vi.hoisted(() => vi.fn())

vi.mock('@tahti/db', () => ({
  prisma: {
    cronRun: {
      create: cronRunCreate,
      update: cronRunUpdate,
    },
  },
}))

import { runWithCronLog, serializeCronResult } from './cron-run.js'

describe('runWithCronLog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    cronRunCreate.mockResolvedValue({ id: 42n })
    cronRunUpdate.mockResolvedValue({})
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  it('persists and logs the result of a successful scheduled run', async () => {
    const result = await runWithCronLog('channel-watchdog', async () => ({
      checked: 3,
      restarted: 1,
    }))

    expect(result).toEqual({ checked: 3, restarted: 1 })
    expect(cronRunUpdate).toHaveBeenCalledWith({
      where: { id: 42n },
      data: expect.objectContaining({
        outcome: 'SUCCESS',
        resultJson: '{"checked":3,"restarted":1}',
        finishedAt: expect.any(Date),
      }),
    })
    expect(console.log).toHaveBeenCalledWith(
      expect.stringMatching(/^\[cron\] channel-watchdog success durationMs=\d+ result=/),
    )
  })

  it('persists and logs failed scheduled runs before rethrowing', async () => {
    await expect(
      runWithCronLog('channel-watchdog', async () => {
        throw new Error('probe failed')
      }),
    ).rejects.toThrow('probe failed')

    expect(cronRunUpdate).toHaveBeenCalledWith({
      where: { id: 42n },
      data: expect.objectContaining({ outcome: 'ERROR', errorMessage: 'probe failed' }),
    })
    expect(console.error).toHaveBeenCalledWith(
      expect.stringMatching(/^\[cron\] channel-watchdog error durationMs=\d+ error=probe failed$/),
    )
  })

  it('does not create run records for ordinary queue jobs', async () => {
    await expect(runWithCronLog('transcode-sound', async () => 'done')).resolves.toBe('done')
    expect(cronRunCreate).not.toHaveBeenCalled()
  })
})

describe('serializeCronResult', () => {
  it('supports bigint summaries and bounds unexpectedly large results', () => {
    expect(serializeCronResult({ cents: 12n })).toBe('{"cents":"12"}')
    expect(JSON.parse(serializeCronResult({ text: 'x'.repeat(20_000) }))).toMatchObject({
      truncated: true,
    })
  })
})
