// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.fi>

import { Queue } from 'bullmq'
import { config } from '../config.js'

const connection = {
  host: new URL(config.redisUrl).hostname,
  port: parseInt(new URL(config.redisUrl).port || '6379', 10),
}

export const mediaQueue = new Queue('media', { connection })

export async function enqueueTranscode(itemId: string): Promise<void> {
  await mediaQueue.add('transcode-archive', { itemId })
}
