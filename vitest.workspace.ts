import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  'apps/api',
  'apps/worker',
  'apps/web',
  'packages/shared',
  'packages/db',
  'packages/ledger',
])
