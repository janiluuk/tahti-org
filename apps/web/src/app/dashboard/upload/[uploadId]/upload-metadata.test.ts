import { afterEach, describe, expect, it, vi } from 'vitest'
import { extractUploadTags } from './upload-metadata.js'

describe('extractUploadTags', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('parses the complete WAV blob instead of a truncated copy', async () => {
    const file = new File([new Uint8Array(2 * 1024 * 1024)], 'recording.wav', {
      type: 'audio/wav',
    })
    const parseBlob = vi.fn(async () => ({
      common: { title: 'Studio take' },
      format: { duration: 61.6, lossless: true, codec: 'PCM' },
    }))

    const tags = await extractUploadTags(file, { parseBlob })

    expect(parseBlob).toHaveBeenCalledWith(file, { skipCovers: false })
    expect(tags).toMatchObject({
      title: 'Studio take',
      durationSec: 62,
      isLossless: true,
      codec: 'PCM',
    })
  })

  it('falls back when metadata parsing stalls', async () => {
    vi.useFakeTimers()
    const file = new File([new Uint8Array(44)], 'recording.wav', { type: 'audio/wav' })
    const parseBlob = vi.fn(() => new Promise<never>(() => {}))

    const tagsPromise = extractUploadTags(file, { parseBlob, timeoutMs: 100 })
    await vi.advanceTimersByTimeAsync(100)

    await expect(tagsPromise).resolves.toEqual({ fromTag: new Set() })
  })
})
