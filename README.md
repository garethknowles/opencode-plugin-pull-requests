# opencode-pull-requests

OpenCode v2 plugin tracking GitHub PRs awaiting your review or opened by you.

- Polls every 2 min via `gh` (must be authenticated).
- Footer status: `PRs 3 to review · 5 mine · 2 blocked`.
- Session sidebar: counts and up to three PRs per group, blocked first. Click a PR to open the full list with it selected.
- Toast when one of your PRs becomes newly blocked.
- `/prs` (or palette "Pull requests") lists PRs with blockers: failing checks, conflicts, changes requested, unresolved threads, draft.
- Opens cached results immediately, shows `loading…`, and updates in place as the background refresh finishes.
- Indicators: ❌ blocked, ⏳ pending, ✅ no detected blockers. Sidebar indicators use theme colours; picker uses coloured emoji.
- Drafts have a second icon, 📝. Draft alone is pending (yellow); drafts with failing checks, conflicts or review issues remain blocked (red).
- Each picker row shows Enter's default action: `↵ Review` for review requests, `↵ Fix` for your blocked PRs, otherwise `↵ Summarize`.
- In the list: `enter` default action, `ctrl+f` fix, `ctrl+e` explain, `ctrl+s` summarize, `ctrl+r` review, `ctrl+o` open in browser.
  Each action starts a new session in the current directory with a PR-specific prompt, using `github-copilot/gpt-6-luna`.

## Install

```sh
opencode plugin add github:eeveebank/opencode-plugin-pull-requests
```

## Dev

```sh
bun install && bunx tsc --noEmit && bunx vitest run
```
