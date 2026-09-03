// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/** Compact membership status readout shared across the Payment/Billing/Invoices tabs. */
export function MembershipStatusStrip({
  isMember,
  memberNumber,
  status,
}: {
  isMember: boolean
  memberNumber: number | null
  status: string
}) {
  if (isMember) {
    return (
      <p className="studio-member-card__badge" style={{ display: 'inline-flex' }}>
        Active member #{memberNumber ?? '—'}
      </p>
    )
  }
  const label = status === 'SUSPENDED' ? 'Membership lapsed' : 'No active membership'
  return <p className="studio-notice studio-notice--info">{label}</p>
}
