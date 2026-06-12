// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PeaksPyramid } from '@tahti/audio-edit'
import { peaksCacheKey } from '@tahti/audio-edit'

const DB_NAME = 'tahti-audio-editor'
const STORE = 'peaks'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onerror = () => reject(req.error)
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE)
    }
  })
}

export async function loadPeaksCache(
  archiveId: string,
  sourceKey: string,
): Promise<PeaksPyramid | null> {
  try {
    const db = await openDb()
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).get(peaksCacheKey(archiveId, sourceKey))
      req.onsuccess = () => resolve((req.result as PeaksPyramid) ?? null)
      req.onerror = () => reject(req.error)
    })
  } catch {
    return null
  }
}

export async function savePeaksCache(
  archiveId: string,
  sourceKey: string,
  pyramid: PeaksPyramid,
): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(pyramid, peaksCacheKey(archiveId, sourceKey))
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
