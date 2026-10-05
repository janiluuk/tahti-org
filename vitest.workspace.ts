import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  'apps/api',
  'apps/worker',
  'apps/web',
  'packages/shared',
  'packages/db',
  'packages/ledger',
  'packages/ui',
  // Runs against a real API instance, so a route change that breaks the
  // published SDK's own tests fails the PR, not the publish job on main.
  'packages/api-client',
  'services/orchestrator',
])
