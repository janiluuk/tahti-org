// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { PeaksPyramid } from '@tahti/audio-edit'
import { loadPeaksCache, savePeaksCache } from './peaks-cache.js'

class FakeRequest {
  result: unknown
  error: unknown
  onsuccess: (() => void) | null = null
  onerror: (() => void) | null = null
  onupgradeneeded: (() => void) | null = null
}

class FakeObjectStore {
  constructor(private readonly map: Map<string, unknown>) {}

  get(key: string): FakeRequest {
    const req = new FakeRequest()
    queueMicrotask(() => {
      req.result = this.map.get(key)
      req.onsuccess?.()
    })
    return req
  }

  put(value: unknown, key: string): FakeRequest {
    const req = new FakeRequest()
    queueMicrotask(() => {
      this.map.set(key, value)
      req.onsuccess?.()
    })
    return req
  }
}

class FakeTransaction {
  oncomplete: (() => void) | null = null
  onerror: (() => void) | null = null

  constructor(private readonly store: FakeObjectStore) {}

  objectStore(): FakeObjectStore {
    // Fire oncomplete once the underlying request has resolved.
    queueMicrotask(() => queueMicrotask(() => this.oncomplete?.()))
    return this.store
  }
}

class FakeDatabase {
  private readonly stores = new Map<string, Map<string, unknown>>()

  createObjectStore(name: string): void {
    this.stores.set(name, new Map())
  }

  transaction(name: string): FakeTransaction {
    return new FakeTransaction(new FakeObjectStore(this.stores.get(name)!))
  }
}

function installFakeIndexedDb() {
  const databases = new Map<string, FakeDatabase>()
  vi.stubGlobal('indexedDB', {
    open(name: string): FakeRequest {
      const req = new FakeRequest()
      queueMicrotask(() => {
        let db = databases.get(name)
        const isNew = !db
        if (!db) {
          db = new FakeDatabase()
          databases.set(name, db)
        }
        req.result = db
        if (isNew) req.onupgradeneeded?.()
        req.onsuccess?.()
      })
      return req
    },
  })
}

function installFailingIndexedDb() {
  vi.stubGlobal('indexedDB', {
    open(): FakeRequest {
      const req = new FakeRequest()
      req.error = new Error('indexeddb unavailable')
      queueMicrotask(() => req.onerror?.())
      return req
    },
  })
}

const pyramid: PeaksPyramid = {
  sampleRate: 8000,
  durationSec: 12.5,
  levels: [[0, 1, 2, 1, 0]],
}

describe('peaks-cache', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns null when nothing has been cached yet', async () => {
    installFakeIndexedDb()

    const result = await loadPeaksCache('archive-1', 'source-1')
    expect(result).toBeNull()
  })

  it('round-trips a saved pyramid', async () => {
    installFakeIndexedDb()

    await savePeaksCache('archive-1', 'source-1', pyramid)
    const result = await loadPeaksCache('archive-1', 'source-1')

    expect(result).toEqual(pyramid)
  })

  it('keeps caches for different archives/sources independent', async () => {
    installFakeIndexedDb()

    await savePeaksCache('archive-1', 'source-1', pyramid)
    const other = await loadPeaksCache('archive-2', 'source-1')
    const differentSource = await loadPeaksCache('archive-1', 'source-2')

    expect(other).toBeNull()
    expect(differentSource).toBeNull()
  })

  it('returns null instead of throwing when indexedDB is unavailable', async () => {
    installFailingIndexedDb()

    const result = await loadPeaksCache('archive-1', 'source-1')
    expect(result).toBeNull()
  })
})
