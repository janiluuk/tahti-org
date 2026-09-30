// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

/** Board governance dashboard counters (Tahti Player /admin/governance Overview). */
export const AdminGovernanceOverviewSchema = z.object({
  /** Motions currently open for voting. */
  openMotions: z.number().int().nonnegative(),
  /** Venues in the directory that nobody has verified yet. */
  pendingVenueVerifications: z.number().int().nonnegative(),
  /** Year of the most recently generated annual report, or null if none. */
  lastAnnualReportYear: z.number().int().nullable(),
  /** Board resolutions voted since 1 January (UTC) of the current year. */
  boardResolutionsThisYear: z.number().int().nonnegative(),
})

export type AdminGovernanceOverview = z.infer<typeof AdminGovernanceOverviewSchema>
