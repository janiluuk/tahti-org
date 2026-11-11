// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { beforeEach, describe, expect, it, vi } from 'vitest'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { sound: { updateMany: vi.fn() } },
}))

vi.mock('@tahti/db', () => ({ prisma: prismaMock }))

import { markSoundTranscodeFailed, type FailedTranscodeJob } from './sound-transcode-failed.js'
import { soundProcessingErrorMessage } from './sound-processing-error.js'

function job(overrides: Partial<FailedTranscodeJob> = {}): FailedTranscodeJob {
  return {
    name: 'transcode-sound',
    data: { itemId: 'sound-1' },
    attemptsMade: 3,
    opts: { attempts: 3 },
    ...overrides,
  } as FailedTranscodeJob
}

describe('markSoundTranscodeFailed', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.sound.updateMany.mockResolvedValue({ count: 1 })
  })

  it('marks a still-pending sound ERROR once the last attempt failed', async () => {
    await expect(markSoundTranscodeFailed(job(), new Error('lane-mismatch'))).resolves.toBe(true)
    expect(prismaMock.sound.updateMany).toHaveBeenCalledWith({
      where: { id: 'sound-1', status: { in: ['PENDING', 'PROCESSING'] } },
      data: { status: 'ERROR', processingError: soundProcessingErrorMessage(null) },
    })
  })

  it('leaves the sound alone while BullMQ will retry', async () => {
    await markSoundTranscodeFailed(job({ attemptsMade: 2 }), new Error('boom'))
    expect(prismaMock.sound.updateMany).not.toHaveBeenCalled()
  })

  it('treats an UnrecoverableError as final', async () => {
    const err = Object.assign(new Error('nope'), { name: 'UnrecoverableError' })
    await markSoundTranscodeFailed(job({ attemptsMade: 1 }), err)
    expect(prismaMock.sound.updateMany).toHaveBeenCalled()
  })

  it('ignores other job names', async () => {
    await markSoundTranscodeFailed(job({ name: 'transcode-sound-version' }), new Error('x'))
    expect(prismaMock.sound.updateMany).not.toHaveBeenCalled()
  })

  it('reports false when the job already marked the sound', async () => {
    prismaMock.sound.updateMany.mockResolvedValue({ count: 0 })
    await expect(markSoundTranscodeFailed(job(), new Error('x'))).resolves.toBe(false)
  })
})
