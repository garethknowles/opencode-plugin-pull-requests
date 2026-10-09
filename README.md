# opencode-pull-requests

OpenCode v2 plugin tracking GitHub PRs awaiting your review or opened by you.

- Polls every 2 min via `gh` (must be authenticated).
- Footer status: `PRs 3 to review · 5 mine · 2 blocked`.
- Toast when one of your PRs becomes newly blocked.
- `/prs` (or palette "Pull requests") lists PRs with blockers: failing checks, conflicts, changes requested, unresolved threads, draft.
- In the list: `enter` default action, `ctrl+f` fix, `ctrl+e` explain, `ctrl+s` summarize, `ctrl+r` review, `ctrl+o` open in browser.
  Each action starts a new session in the current directory with a PR-specific prompt.

## Install

```sh
opencode plugin add github:eeveebank/opencode-plugin-pull-requests
```

## Dev

```sh
bun install && bunx tsc --noEmit && bunx vitest run
```
