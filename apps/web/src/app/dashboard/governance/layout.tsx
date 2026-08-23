// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ReactNode } from 'react'
import '@tahti/ui/src/styles/brand-channel.css'
import '@tahti/ui/src/styles/brand-public.css'

/** Governance (motions, voting, topics/feature-requests) lives in the dashboard
 * URL space now, but its components (MotionCard, FeatureRequestCard, etc. —
 * shared verbatim with the public /governance pages) are styled against
 * brand-channel.css/brand-public.css's dark "brand" theme, not brand-studio.css's
 * studio theme. Scoping data-tahti-ui="brand" + .brand-public-shell here remaps
 * the --tahti-* tokens Button/Input/Textarea/Alert read (see the comment on
 * .brand-public-shell in brand-channel.css) so those shared components render
 * correctly nested inside the studio dashboard shell, without a full redesign. */
export default function DashboardGovernanceLayout({ children }: { children: ReactNode }) {
  return (
    <div data-tahti-ui="brand" className="brand-public-shell dashboard-governance">
      <div className="brand-public">{children}</div>
    </div>
  )
}
