// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import { Button, Link } from '@tahti/ui'
import { resolveChannelUrl } from '@/lib/app-url'

export interface MemberDirectoryRow {
  memberNumber: number | null
  displayName: string
  username: string
  memberSince: string | null
  isBoard: boolean
  channelSlug: string | null
}

const PAGE_SIZE = 25

// The full list is already fetched server-side (it also feeds the turnout-%
// stat below), so "load more" here just reveals more of what's in memory
// rather than re-fetching — the association's membership is small enough
// today that this is the simpler correct choice over wiring a second,
// separately-paginated network round trip for the same data.
export default function MemberDirectoryTable({
  members,
  currentUsername,
}: {
  members: MemberDirectoryRow[]
  currentUsername: string
}) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const visible = members.slice(0, visibleCount)
  const remaining = members.length - visible.length

  return (
    <>
      <div className="brand-table-wrap">
        <table className="brand-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Member</th>
              <th>Channel</th>
              <th>Since</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((m) => (
              <tr key={m.username}>
                <td className="brand-muted">{m.memberNumber ?? '—'}</td>
                <td>
                  {m.displayName}
                  {m.username === currentUsername && <span className="brand-badge">you</span>}
                  {m.isBoard && <span className="brand-badge">board</span>}
                </td>
                <td>
                  {m.channelSlug ? (
                    <Link href={resolveChannelUrl(m.channelSlug)}>{m.channelSlug}</Link>
                  ) : (
                    <span className="brand-empty">—</span>
                  )}
                </td>
                <td className="brand-muted">
                  {m.memberSince ? new Date(m.memberSince).toLocaleDateString('fi-FI') : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {remaining > 0 && (
        <Button variant="ghost" size="sm" onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}>
          Show {Math.min(PAGE_SIZE, remaining)} more ({remaining} remaining)
        </Button>
      )}
    </>
  )
}
