// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  extensionFromDriveFile,
  googleDriveCloudImportProvider,
  isAllowedDriveAudioMime,
  titleFromDriveFileName,
} from './google-drive.js'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('google-drive helpers', () => {
  it('accepts audio mime types and common extensions', () => {
    expect(isAllowedDriveAudioMime('audio/flac', 'set.flac')).toBe(true)
    expect(isAllowedDriveAudioMime(undefined, 'mix.mp3')).toBe(true)
    expect(isAllowedDriveAudioMime('application/pdf', 'readme.pdf')).toBe(false)
  })

  it('derives title without extension', () => {
    expect(titleFromDriveFileName('Midnight Run.flac')).toBe('Midnight Run')
  })

  it('maps mime and filename to storage extension', () => {
    expect(extensionFromDriveFile('track.flac', 'audio/flac')).toBe('flac')
    expect(extensionFromDriveFile('track', 'audio/mpeg')).toBe('mp3')
  })

  it('implements listing, streaming, and token revocation through the provider contract', async () => {
    const stream = new ReadableStream<Uint8Array>()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            files: [{ id: 'file-1', name: 'Live Set.flac', mimeType: 'audio/flac', size: '42' }],
            nextPageToken: 'next-page',
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'file-1',
            name: 'Live Set.flac',
            mimeType: 'audio/flac',
            size: '42',
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response(stream, { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const page = await googleDriveCloudImportProvider.listFiles('access-token', { pageSize: 20 })
    const download = await googleDriveCloudImportProvider.getDownloadStream(
      'access-token',
      'file-1',
    )
    await googleDriveCloudImportProvider.revokeToken('refresh-token')

    expect(googleDriveCloudImportProvider.id).toBe('google-drive')
    expect(page).toEqual({
      files: [{ id: 'file-1', name: 'Live Set.flac', mimeType: 'audio/flac', size: '42' }],
      nextPageToken: 'next-page',
    })
    expect(download).toEqual({ file: page.files[0], body: stream })

    const listUrl = new URL(String(fetchMock.mock.calls[0]?.[0]))
    expect(listUrl.searchParams.get('pageSize')).toBe('20')
    expect(listUrl.searchParams.get('q')).toBe('trashed = false')
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      headers: { Authorization: 'Bearer access-token' },
    })
    expect(fetchMock.mock.calls[3]?.[1]).toMatchObject({
      method: 'POST',
      body: new URLSearchParams({ token: 'refresh-token' }),
    })
  })
})
