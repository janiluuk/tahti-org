// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/** Suspended and deleted accounts are hidden from lists, search, messaging and radio. */
export const availableUserWhere = { deletedAt: null, suspendedAt: null } as const
