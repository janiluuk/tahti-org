// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

const PROBE_TIMEOUT_MS = 1500
const CACHE_TTL_MS = 10_000

type HostCache = { at: number; primary: string; fallbacks: string[] }

let rtmpCache: HostCache | null = null
let icecastCache: HostCache | null = null

/** Comma-separated host list, or a single primary when env list is unset. */
export function parseIngestHostList(envList: string | undefined, primaryHost: string): string[] {
  if (envList?.trim()) {
    const fromEnv = envList
      .split(',')
      .map((h) => h.trim())
      .filter(Boolean)
    if (fromEnv.length > 0) return fromEnv
  }
  const host = primaryHost.replace(/^https?:\/\//, '').split('/')[0]?.split(':')[0]
  return host ? [host] : [primaryHost]
}

export function rtmpPublishUrl(host: string, port = 1935): string {
  const bare = host.replace(/^rtmp:\/\//, '').split('/')[0]?.split(':')[0] ?? host
  return `rtmp://${bare}:${port}/live`
}

export function icecastPublicBaseUrl(host: string, defaultScheme = 'https'): string {
  if (host.startsWith('http://') || host.startsWith('https://')) {
    return host.replace(/\/$/, '')
  }
  const bare = host.split('/')[0]
  return `${defaultScheme}://${bare}`
}

async function probeHttpHealth(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) })
    return res.ok
  } catch {
    return false
  }
}

async function rankHosts(
  hosts: string[],
  healthUrlForHost: (host: string) => string,
  cache: HostCache | null,
): Promise<{ primary: string; fallbacks: string[]; cache: HostCache }> {
  const now = Date.now()
  if (cache && now - cache.at < CACHE_TTL_MS) {
    return { primary: cache.primary, fallbacks: cache.fallbacks, cache }
  }

  if (hosts.length <= 1) {
    const only = hosts[0] ?? 'localhost'
    const next: HostCache = { at: now, primary: only, fallbacks: [] }
    return { primary: only, fallbacks: [], cache: next }
  }

  const probed = await Promise.all(
    hosts.map(async (host) => ({
      host,
      ok: await probeHttpHealth(healthUrlForHost(host)),
    })),
  )
  const healthy = probed.filter((p) => p.ok).map((p) => p.host)
  const unhealthy = probed.filter((p) => !p.ok).map((p) => p.host)
  const ordered = [...healthy, ...unhealthy]
  const primary = ordered[0] ?? hosts[0]
  const next: HostCache = { at: now, primary, fallbacks: ordered.slice(1) }
  return { primary, fallbacks: next.fallbacks, cache: next }
}

export async function resolveRtmpIngestHosts(opts: {
  hosts: string[]
  healthPort: number
  healthPath: string
  healthScheme?: string
}): Promise<{ server: string; fallbackServers: string[] }> {
  const scheme = opts.healthScheme ?? 'http'
  const ranked = await rankHosts(
    opts.hosts,
    (host) => {
      const bare = host.replace(/^https?:\/\//, '').split('/')[0]?.split(':')[0] ?? host
      return `${scheme}://${bare}:${opts.healthPort}${opts.healthPath}`
    },
    rtmpCache,
  )
  rtmpCache = ranked.cache
  return {
    server: rtmpPublishUrl(ranked.primary),
    fallbackServers: ranked.fallbacks.map((h) => rtmpPublishUrl(h)),
  }
}

export async function resolveIcecastIngestHosts(opts: {
  hosts: string[]
  defaultScheme?: string
}): Promise<{ server: string; fallbackServers: string[] }> {
  const scheme = opts.defaultScheme ?? 'https'
  const ranked = await rankHosts(
    opts.hosts,
    (host) => `${icecastPublicBaseUrl(host, scheme)}/`,
    icecastCache,
  )
  icecastCache = ranked.cache
  return {
    server: icecastPublicBaseUrl(ranked.primary, scheme),
    fallbackServers: ranked.fallbacks.map((h) => icecastPublicBaseUrl(h, scheme)),
  }
}

/** Test helper — reset in-memory health cache between cases. */
export function resetIngestHostCacheForTests(): void {
  rtmpCache = null
  icecastCache = null
}
