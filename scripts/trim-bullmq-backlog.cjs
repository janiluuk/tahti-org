// Batch-deletes finished BullMQ job records older than 1 hour from the `media`
// queue. Runs inside the production worker container (uses its bullmq).
// Env: TRIM_BATCH (default 2000), TRIM_PAUSE_MS (default 200), TRIM_MAX_BATCHES.
const { Queue } = require('bullmq')

const u = new URL(process.env.REDIS_URL)
const q = new Queue('media', { connection: { host: u.hostname, port: +(u.port || 6379) } })
const GRACE = 60 * 60 * 1000
const BATCH = +(process.env.TRIM_BATCH || 2000)
const PAUSE = +(process.env.TRIM_PAUSE_MS || 200)
const MAX_BATCHES = +(process.env.TRIM_MAX_BATCHES || Infinity)

;(async () => {
  const totals = { completed: 0, failed: 0 }
  let batches = 0
  let slowest = 0
  for (const type of ['completed', 'failed']) {
    for (;;) {
      if (batches >= MAX_BATCHES) break
      const t0 = Date.now()
      const removed = await q.clean(GRACE, BATCH, type)
      const ms = Date.now() - t0
      slowest = Math.max(slowest, ms)
      batches++
      totals[type] += removed.length
      if (batches % 25 === 0 || removed.length < BATCH) {
        console.log(`${type} removed=${totals[type]} lastBatchMs=${ms} slowestMs=${slowest}`)
      }
      if (removed.length < BATCH) break
      await new Promise((r) => setTimeout(r, PAUSE))
    }
  }
  console.log('done', JSON.stringify({ ...totals, batches, slowestMs: slowest }))
  await q.close()
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
