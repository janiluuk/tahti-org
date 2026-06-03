// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import './env.js'
import { prisma } from '@tahti/db'
import { afterAll } from 'vitest'

afterAll(async () => {
  await prisma.$disconnect()
})
