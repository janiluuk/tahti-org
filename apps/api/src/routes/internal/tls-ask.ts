// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'

// Caddy's on_demand TLS refuses to start without a permission ("ask") endpoint to
// prevent cert-issuance abuse (arbitrary hostnames exhausting Let's Encrypt rate
// limits). Caddy calls this with ?domain=<host> before requesting a cert and expects
// 200 to proceed, any other status to refuse. Protected by the same SEC-001
// onRequest hook as every other /internal/* route (private network or internalSecret).
//
// Call sites needing this: the *.tahti.live wildcard channel-subdomain block and
// the :443 custom-domain catch-all (PLAT-051) in infra/Caddyfile, plus the
// *.staging.tahti.live wildcard in infra/Caddyfile.staging.
const RESERVED_SUBDOMAINS = new Set([
  'www',
  'app',
  'api',
  'chat',
  'stream',
  'cdn',
  'ingest-icecast',
  'ingest-icecast-b',
  'minio',
  'grafana',
])

/** True for a single, non-reserved label directly under the given base domain. */
function isValidWildcardLabel(domain: string, base: string): boolean {
  if (!domain.endsWith(`.${base}`)) return false
  const label = domain.slice(0, -(base.length + 1))
  return Boolean(label) && !label.includes('.') && !RESERVED_SUBDOMAINS.has(label)
}

const tlsAskRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/internal/tls-ask', async (request, reply) => {
    const query = request.query as Record<string, string>
    const domain = query.domain?.toLowerCase().trim()
    if (!domain) return reply.status(400).send('domain is required')

    if (
      isValidWildcardLabel(domain, 'tahti.live') ||
      isValidWildcardLabel(domain, 'staging.tahti.live')
    ) {
      return reply.status(200).send('ok')
    }
    if (domain.endsWith('.tahti.live')) {
      return reply.status(403).send('reserved or invalid subdomain')
    }

    const channel = await fastify.prisma.channel.findFirst({
      where: { customDomain: domain, customDomainVerified: true },
      select: { id: true },
    })
    if (channel) return reply.status(200).send('ok')

    return reply.status(403).send('unknown domain')
  })
}

export default tlsAskRoute
