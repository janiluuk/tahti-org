# Instructions for Claude Code

## Workflow

- Work on features in a git worktree, not directly in this checkout. Use the `EnterWorktree` tool
  to create one before starting feature work (bug fixes/small tweaks can stay in the main
  checkout unless the user says otherwise).
- Always run `pnpm format` (Prettier) on changed files before pushing — CI's `format:check` fails
  the build otherwise. `pnpm exec eslint`/`tsc --noEmit` catch logic issues but not formatting.
- For every task with a technical implementation (not a one-line fix), write a todo file under
  `docs/todo/` documenting the plan/approach as you go — not inline in chat only — so there is
  always a durable trace of the work for longevity, even after the chat session is gone. One file
  per task/feature, named for what it tracks. Before starting new work, skim `docs/todo/` for docs
  that are obviously expired (task shipped, branch merged, or stale beyond the effort's lifetime)
  and fold their content into `docs/todo/HISTORY.md` (append, don't overwrite), then delete the
  expired file.
