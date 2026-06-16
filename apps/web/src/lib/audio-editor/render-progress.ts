// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

export interface RenderProgressEvent {
  status: string
  pct: number
  phase?: string
  segment?: number
  segmentCount?: number
  versionNumber?: number
  versionLabel?: string
}

/** PERF-08: SSE progress for server-side archive edit render. */
export function watchArchiveVersionProgress(
  archiveId: string,
  versionId: string,
  onEvent: (event: RenderProgressEvent) => void,
): () => void {
  const es = new EventSource(`/dashboard/archive/${archiveId}/editor/progress/${versionId}`)

  es.onmessage = (msg) => {
    try {
      const data = JSON.parse(msg.data) as RenderProgressEvent
      onEvent(data)
      if (data.status === 'READY' || data.status === 'ERROR') {
        es.close()
      }
    } catch {
      /* ignore malformed events */
    }
  }

  return () => es.close()
}

export function waitForRenderViaProgress(
  archiveId: string,
  versionId: string,
  onProgress?: (event: RenderProgressEvent) => void,
  maxMs = 180_000,
): Promise<RenderProgressEvent> {
  return new Promise((resolve, reject) => {
    const stop = watchArchiveVersionProgress(archiveId, versionId, (event) => {
      onProgress?.(event)
      if (event.status === 'READY') {
        stop()
        clearTimeout(timer)
        resolve(event)
      } else if (event.status === 'ERROR') {
        stop()
        clearTimeout(timer)
        reject(new Error('Render failed on server'))
      }
    })

    const timer = setTimeout(() => {
      stop()
      reject(new Error('Render timed out'))
    }, maxMs)
  })
}
