// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

// Runs before any app modules load in Vitest (via setupFiles).
process.env.RTMP_KEY_ENC_KEY = 'dev0000000000000000000000000000000000000000000000000000000000000'
