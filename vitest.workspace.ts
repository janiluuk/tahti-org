import { defineWorkspace } from 'vitest/config'

export default defineWorkspace(['apps/api', 'packages/shared', 'packages/db', 'packages/ledger'])
