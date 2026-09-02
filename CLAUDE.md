# Instructions for Claude Code

## Workflow

- Work on features in a git worktree, not directly in this checkout. Use the `EnterWorktree` tool
  to create one before starting feature work (bug fixes/small tweaks can stay in the main
  checkout unless the user says otherwise).
- Always run `pnpm format` (Prettier) on changed files before pushing — CI's `format:check` fails
  the build otherwise. `pnpm exec eslint`/`tsc --noEmit` catch logic issues but not formatting.
