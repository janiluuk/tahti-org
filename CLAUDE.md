# Instructions for Claude Code

## Workflow

- Work on features in a git worktree, not directly in this checkout. Use the `EnterWorktree` tool
  to create one before starting feature work (bug fixes/small tweaks can stay in the main
  checkout unless the user says otherwise).
- Always run `pnpm format` (Prettier) on changed files before pushing — CI's `format:check` fails
  the build otherwise. `pnpm exec eslint`/`tsc --noEmit` catch logic issues but not formatting.
- If `apps/api` or `packages/api-client` changed, run `pnpm --filter @tahti/api-client generate`
  and commit the result — CI's "Typecheck + SDK drift" job fails on a stale `schema.d.ts`.
- Both checks run automatically as a pre-push hook (`.githooks/pre-push`, wired up via the
  `prepare` script on `pnpm install`) and block the push locally instead of failing in CI.
- Once a task's commits are done and passing locally, push the branch — don't leave
  finished work sitting only in the local worktree. Push once at the end of the task,
  not after every individual commit.

## Todos → HISTORY.md

`docs/todo/` is **open work only**. Done work goes to `docs/todo/HISTORY.md`.

- For every task with a technical implementation (not a one-line fix), write one file under
  `docs/todo/` named for what it tracks — plan and status live there, not only in chat.
- Session worklogs (`docs/worklogs/`) exist only while that session still has open follow-ups.
- Keep plan/status in `docs/todo/<task>.md` while the PR is in progress. Do **not**
  edit `docs/remaining-work.md`, `docs/features.md`, or `docs/todo/HISTORY.md` on
  intermediate commits.
- **When the PR is otherwise ready to merge:** in one commit, append a compact dated
  section to `docs/todo/HISTORY.md` (original filename, what shipped, PR link), move
  leftovers into `docs/remaining-work.md` or a new slim todo, and update `features.md`
  only if the product surface changed. Do not overwrite HISTORY; append. After merge,
  delete the todo file and any matching worklog.
- Stack related PRs (branch B from A). Do not open parallel PRs from `main` that all
  rewrite the same catalogs or the same test `describe`.
- Before starting new work, skim `docs/todo/` (not HISTORY). Do not start by rewriting
  the shared catalogs.

See `.cursor/rules/todo-history.mdc` and `.cursor/rules/pr-stacking.mdc`.
