// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.fi>

import { prisma } from '@tahti/db'
import { afterAll } from 'vitest'

afterAll(async () => {
  await prisma.$disconnect()
})
