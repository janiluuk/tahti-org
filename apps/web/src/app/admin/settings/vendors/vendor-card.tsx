// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { Badge } from '@tahti/ui'

interface VendorCardProps {
  name: string
  service: string
  notes?: string
  envVars?: string
  dpaRequired?: boolean
  dpaNote?: string | null
  portalUrl?: string | null
  statusBadge?: { variant: 'success' | 'warning'; label: string } | null
}

export function VendorCard({
  name,
  service,
  notes,
  envVars,
  dpaRequired,
  dpaNote,
  portalUrl,
  statusBadge,
}: VendorCardProps) {
  return (
    <div className="admin-card" style={{ padding: '1rem' }}>
      <div style={{ fontWeight: 500, marginBottom: '0.25rem' }}>{name}</div>
      <div style={{ fontSize: '0.8125rem', color: 'var(--muted)', marginBottom: '0.375rem' }}>
        {service}
      </div>
      {notes && <div style={{ fontSize: '0.8125rem', marginBottom: '0.5rem' }}>{notes}</div>}
      {envVars && (
        <code
          style={{
            fontSize: '0.75rem',
            background: 'rgba(255,255,255,0.06)',
            padding: '2px 5px',
            borderRadius: 4,
            display: 'block',
            marginBottom: '0.5rem',
            wordBreak: 'break-all',
          }}
        >
          {envVars}
        </code>
      )}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {statusBadge && <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>}
        {dpaRequired && <Badge variant="error">DPA required</Badge>}
        {portalUrl && (
          <a
            href={portalUrl}
            rel="noopener noreferrer"
            style={{ fontSize: '0.8125rem', color: 'var(--accent)' }}
          >
            Portal ↗
          </a>
        )}
      </div>
      {dpaNote && (
        <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.375rem' }}>
          {dpaNote}
        </div>
      )}
    </div>
  )
}
