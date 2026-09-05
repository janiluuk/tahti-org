# Instructions for Claude Code

## Workflow

- Work on features in a git worktree, not directly in this checkout. Use the `EnterWorktree` tool
  to create one before starting feature work (bug fixes/small tweaks can stay in the main
  checkout unless the user says otherwise).
- Always run `pnpm format` (Prettier) on changed files before pushing — CI's `format:check` fails
  the build otherwise. `pnpm exec eslint`/`tsc --noEmit` catch logic issues but not formatting.

## Todos → HISTORY.md

`docs/todo/` is **open work only**. Done work goes to `docs/todo/HISTORY.md`.

- For every task with a technical implementation (not a one-line fix), write one file under
  `docs/todo/` named for what it tracks — plan and status live there, not only in chat.
- Session worklogs (`docs/worklogs/`) exist only while that session still has open follow-ups.
- **When the task ships** (PR merged or landed on main): append a compact dated section to
  `docs/todo/HISTORY.md` (original filename, what shipped, PR link). Then delete the todo file
  and any matching worklog. Do not overwrite HISTORY; append.
- Move leftover open items into `docs/remaining-work.md` or a new slim todo file. Strip `[x]` /
  done rows from remaining-work, worklogs, and other plan docs.
- Before starting new work, skim `docs/todo/` (not HISTORY) and fold anything already shipped
  into HISTORY first.

See `.cursor/rules/todo-history.mdc`.
