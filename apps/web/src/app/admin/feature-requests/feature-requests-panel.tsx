// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@tahti/ui'
import { updateFeatureRequest } from './actions'

export type AdminFeatureRequestRow = {
  id: string
  title: string
  description: string
  status: 'OPEN' | 'PLANNED' | 'IN_PROGRESS' | 'DONE' | 'DECLINED' | 'DUPLICATE'
  proposer: string
  proposerUsername: string
  voteCount: number
  commentCount: number
  reviewNote: string | null
  reviewedAt: string | null
  mergedIntoId: string | null
  mergedIntoTitle: string | null
  createdAt: string
}

function RowActions({
  row,
  allRows,
}: {
  row: AdminFeatureRequestRow
  allRows: AdminFeatureRequestRow[]
}) {
  const router = useRouter()
  const [note, setNote] = useState('')
  const [mergeTarget, setMergeTarget] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function apply(params: { status?: string; mergedIntoId?: string | null }) {
    setPending(true)
    setError(null)
    const res = await updateFeatureRequest(row.id, {
      ...params,
      reviewNote: note.trim() || undefined,
    })
    setPending(false)
    if (res.error) {
      setError(res.error)
      return
    }
    router.refresh()
  }

  const terminal = row.status === 'DONE' || row.status === 'DECLINED' || row.status === 'DUPLICATE'

  return (
    <div className="admin-beta-approve-form">
      {terminal ? (
        <div className="admin-text-muted">
          {row.status === 'DUPLICATE'
            ? `Merged into ${row.mergedIntoTitle ?? row.mergedIntoId}`
            : row.status === 'DONE'
              ? 'Done'
              : 'Declined'}
          {row.reviewNote ? <p>{row.reviewNote}</p> : null}
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => apply({ status: 'OPEN', mergedIntoId: null })}
          >
            Reopen
          </Button>
        </div>
      ) : (
        <>
          <input
            placeholder="Review note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="admin-beta-action-row">
            <Button
              size="sm"
              variant="secondary"
              disabled={pending}
              onClick={() => apply({ status: 'PLANNED' })}
            >
              Mark planned
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={pending}
              onClick={() => apply({ status: 'IN_PROGRESS' })}
            >
              In progress
            </Button>
            <Button
              size="sm"
              variant="primary"
              disabled={pending}
              onClick={() => apply({ status: 'DONE' })}
            >
              Mark done
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => apply({ status: 'DECLINED' })}
            >
              Decline
            </Button>
          </div>
          <div className="admin-beta-action-row">
            <input
              list={`merge-targets-${row.id}`}
              placeholder="Merge into (paste request id)"
              value={mergeTarget}
              onChange={(e) => setMergeTarget(e.target.value)}
            />
            <datalist id={`merge-targets-${row.id}`}>
              {allRows
                .filter((r) => r.id !== row.id)
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title}
                  </option>
                ))}
            </datalist>
            <Button
              size="sm"
              variant="ghost"
              disabled={pending || !mergeTarget.trim()}
              onClick={() => apply({ mergedIntoId: mergeTarget.trim() })}
            >
              Close as duplicate
            </Button>
          </div>
        </>
      )}
      {error ? <p className="admin-form-error">{error}</p> : null}
    </div>
  )
}

export function FeatureRequestsPanel({ rows }: { rows: AdminFeatureRequestRow[] }) {
  if (rows.length === 0) {
    return <p className="admin-text-muted">No feature requests in this view.</p>
  }

  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Requested</th>
            <th>Title</th>
            <th>Votes</th>
            <th>Proposer</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{new Date(r.createdAt).toLocaleDateString()}</td>
              <td>
                {r.title}
                <br />
                <span className="admin-text-muted">{r.description}</span>
              </td>
              <td>{r.voteCount}</td>
              <td>
                {r.proposer}
                <br />
                <span className="admin-text-muted">@{r.proposerUsername}</span>
              </td>
              <td className={r.status === 'OPEN' ? 'admin-warn' : ''}>{r.status}</td>
              <td>
                <RowActions row={r} allRows={rows} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
