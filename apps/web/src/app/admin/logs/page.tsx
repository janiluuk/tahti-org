'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MobileNavSheet } from '@tahti/ui'
import { previewLogLine } from './preview-log-line'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001'
const REFRESH_MS = 5_000
const DESKTOP_LIMIT = 1000
const MOBILE_LIMIT = 80
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

function formatTimestamp(timestampMs: number): string {
  return new Date(timestampMs).toLocaleString('fi-FI', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function FollowLiveToggle({
  id,
  checked,
  onChange,
}: {
  id: string
  checked: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <label className="admin-log-controls__toggle" htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      Follow live ({REFRESH_MS / 1000}s)
    </label>
  )
}

export default function AdminLogsPage() {
  const [service, setService] = useState('')
  const [search, setSearch] = useState('')
  const [draftService, setDraftService] = useState('')
  const [draftSearch, setDraftSearch] = useState('')
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [lokiReachable, setLokiReachable] = useState(true)
  const [loading, setLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [filterOpen, setFilterOpen] = useState(false)
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [mobileLimit, setMobileLimit] = useState(false)
  const filterButtonRef = useRef<HTMLButtonElement>(null)
  const viewerRef = useRef<HTMLDivElement>(null)
  const autoRefreshRef = useRef(autoRefresh)
  const ignoreProgrammaticScroll = useRef(false)
  const limit = mobileLimit ? MOBILE_LIMIT : DESKTOP_LIMIT
  autoRefreshRef.current = autoRefresh

  useEffect(() => {
    const media = window.matchMedia('(max-width: 640px)')
    const sync = () => setMobileLimit(media.matches)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  const loadLogs = useCallback(
    async (signal?: AbortSignal) => {
      const params = new URLSearchParams({ limit: String(limit) })
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
    [limit, search, service],
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

  const visibleEntries = useMemo(() => entries.slice(-limit), [entries, limit])

  useEffect(() => {
    if (!autoRefresh) return
    const viewer = viewerRef.current
    if (!viewer) return
    ignoreProgrammaticScroll.current = true
    viewer.scrollTop = viewer.scrollHeight
    requestAnimationFrame(() => {
      ignoreProgrammaticScroll.current = false
    })
  }, [autoRefresh, visibleEntries])

  const filterActive = Boolean(service || search.trim())

  function openFilters() {
    setDraftService(service)
    setDraftSearch(search)
    setFilterOpen(true)
  }

  function applyFilters() {
    setService(draftService)
    setSearch(draftSearch)
    setFilterOpen(false)
  }

  async function copyLine(key: string, line: string) {
    try {
      await navigator.clipboard.writeText(line)
      setCopiedKey(key)
      window.setTimeout(() => setCopiedKey((current) => (current === key ? null : current)), 1500)
    } catch {
      setCopiedKey(null)
    }
  }

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

      <div className="admin-log-controls admin-log-controls--desktop">
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
        <FollowLiveToggle
          id="admin-logs-follow-desktop"
          checked={autoRefresh}
          onChange={setAutoRefresh}
        />
      </div>

      <div className="admin-log-toolbar">
        <button
          ref={filterButtonRef}
          type="button"
          className="admin-btn admin-btn--sm"
          aria-haspopup="dialog"
          aria-expanded={filterOpen}
          onClick={openFilters}
        >
          Filter{filterActive ? ' · on' : ''}
        </button>
        <FollowLiveToggle
          id="admin-logs-follow-mobile"
          checked={autoRefresh}
          onChange={setAutoRefresh}
        />
      </div>

      <MobileNavSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        triggerRef={filterButtonRef}
        ariaLabel="Log filters"
        closeLabel="Close filters"
      >
        <form
          className="admin-log-filter-sheet"
          onSubmit={(event) => {
            event.preventDefault()
            applyFilters()
          }}
        >
          <label>
            Service
            <select value={draftService} onChange={(event) => setDraftService(event.target.value)}>
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
              value={draftSearch}
              placeholder="error, timeout, refused…"
              onChange={(event) => setDraftSearch(event.target.value)}
            />
          </label>
          <button type="submit" className="admin-btn admin-btn--sm">
            Apply filters
          </button>
        </form>
      </MobileNavSheet>

      {!lokiReachable && (
        <p className="admin-err" role="alert">
          Loki is unreachable or the API could not load logs.
        </p>
      )}

      <div className="admin-log-meta">
        {loading ? 'Loading…' : `${visibleEntries.length} entries`} · last hour ·{' '}
        {service || 'all services'}
        {search.trim() ? ` · “${search.trim()}”` : ''}
      </div>

      <div
        ref={viewerRef}
        className="admin-log-viewer"
        aria-live="polite"
        onScroll={(event) => {
          if (ignoreProgrammaticScroll.current || !autoRefreshRef.current) return
          const viewer = event.currentTarget
          if (viewer.scrollTop + viewer.clientHeight < viewer.scrollHeight - 24) {
            setAutoRefresh(false)
          }
        }}
      >
        {visibleEntries.length === 0 && !loading ? (
          <p className="admin-stat-sub">No log entries match the current filters.</p>
        ) : (
          visibleEntries.map((entry, index) => {
            const key = `${entry.timestampMs}-${entry.service}-${index}`
            const open = expandedKey === key
            return (
              <div key={key} className={`admin-log-line${open ? ' admin-log-line--open' : ''}`}>
                <button
                  type="button"
                  className="admin-log-line__summary"
                  aria-expanded={open}
                  onClick={() => setExpandedKey(open ? null : key)}
                >
                  <time dateTime={new Date(entry.timestampMs).toISOString()}>
                    {formatTimestamp(entry.timestampMs)}
                  </time>
                  <strong>{entry.service}</strong>
                  <span className="admin-log-line__preview">{previewLogLine(entry.line)}</span>
                </button>
                <div className="admin-log-line__detail">
                  {entry.line.trim() ? (
                    <code>{entry.line}</code>
                  ) : (
                    <p className="admin-stat-sub">This entry has no message text.</p>
                  )}
                  <button
                    type="button"
                    className="admin-log-line__copy"
                    onClick={() => void copyLine(key, entry.line)}
                  >
                    {copiedKey === key ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </>
  )
}
