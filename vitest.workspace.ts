import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  'apps/api',
  'apps/worker',
  'packages/shared',
  'packages/db',
  'packages/ledger',
])
