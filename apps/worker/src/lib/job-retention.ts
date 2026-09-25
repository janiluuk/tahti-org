// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/**
 * How many finished job records BullMQ keeps in Redis. Applied both as job
 * options and as Worker options: a job whose own options lack these falls
 * back to the Worker's, and without either BullMQ keeps every record forever.
 */
export const JOB_RETENTION = {
  removeOnComplete: { count: 500 },
  removeOnFail: { count: 1000 },
}
