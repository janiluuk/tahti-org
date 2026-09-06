'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useCallback, useEffect, useMemo, useState } from 'react'
import { LogViewer } from '@tahti/ui'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001'
const REFRESH_MS = 5_000

const SERVICES = [
  'api',
  'web',
  'worker',
  'orchestrator',
  'postgres',
  'pgbouncer',
  'redis',
  'minio',
  'minio-init',
  'chat',
  'mailhog',
  'icecast',
  'icecast-b',
  'rtmp-ingest',
  'rtmp-ingest-b',
  'db-push',
  'website',
] as const

interface LogEntry {
  timestampMs: number
  service: string
  line: string
}

interface LogsResponse {
  entries: LogEntry[]
  lokiReachable: boolean
}

export default function AdminLogsPage() {
  const [service, setService] = useState('')
  const [search, setSearch] = useState('')
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [lokiReachable, setLokiReachable] = useState(true)
  const [loading, setLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)

  const loadLogs = useCallback(
    async (signal?: AbortSignal) => {
      const params = new URLSearchParams({ limit: '1000' })
      if (service) params.set('service', service)
      if (search.trim()) params.set('search', search.trim())

      try {
        const response = await fetch(`${API_BASE}/api/admin/logs?${params}`, {
          credentials: 'include',
          signal,
        })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const data = (await response.json()) as LogsResponse
        setEntries(data.entries)
        setLokiReachable(data.lokiReachable)
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setLokiReachable(false)
      } finally {
        if (!signal?.aborted) setLoading(false)
      }
    },
    [search, service],
  )

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    void loadLogs(controller.signal)
    return () => controller.abort()
  }, [loadLogs])

  useEffect(() => {
    if (!autoRefresh) return
    const id = window.setInterval(() => void loadLogs(), REFRESH_MS)
    return () => window.clearInterval(id)
  }, [autoRefresh, loadLogs])

  const visibleEntries = useMemo(() => entries.slice(-1000), [entries])

  return (
    <>
      <div className="admin-page-heading-row">
        <div>
          <h1 className="admin-section-title">System logs</h1>
          <p className="admin-stat-sub">
            Live output from every Tahti stack service, collected in vimage6 Loki.
          </p>
        </div>
        <button type="button" className="admin-btn admin-btn--sm" onClick={() => void loadLogs()}>
          Refresh
        </button>
      </div>

      <div className="admin-log-controls">
        <label>
          Service
          <select value={service} onChange={(event) => setService(event.target.value)}>
            <option value="">All services</option>
            {SERVICES.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Search
          <input
            type="search"
            value={search}
            placeholder="error, timeout, refused…"
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <label className="admin-log-controls__toggle">
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(event) => setAutoRefresh(event.target.checked)}
          />
          Follow live ({REFRESH_MS / 1000}s)
        </label>
      </div>

      {!lokiReachable && (
        <p className="admin-err" role="alert">
          Loki is unreachable or the API could not load logs.
        </p>
      )}

      <div className="admin-log-meta">
        {loading ? 'Loading…' : `${visibleEntries.length} entries`} · last hour ·{' '}
        {service || 'all services'}
      </div>

      <LogViewer
        live
        loading={loading}
        entries={visibleEntries.map((entry, index) => ({
          id: `${entry.timestampMs}-${index}`,
          timestamp: entry.timestampMs,
          source: entry.service,
          title: entry.line,
        }))}
        emptyMessage="No log entries match the current filters."
      />
    </>
  )
}
