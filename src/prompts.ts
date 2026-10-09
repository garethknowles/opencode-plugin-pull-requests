import { describeBlocker, type TrackedPullRequest } from "./pull-request.ts";

export type PromptKind = "fix" | "summarize" | "review" | "investigate";

const header = ({ pullRequest: pr, blockers }: TrackedPullRequest): string =>
  [
    `Pull request: ${pr.url} (${pr.repository}#${pr.number}) "${pr.title}" by ${pr.author}`,
    `Blockers: ${blockers.length === 0 ? "none" : blockers.map(describeBlocker).join("; ")}`,
  ].join("\n");

const INSTRUCTIONS: Record<PromptKind, string> = {
  fix: [
    "Fix what blocks this PR. Use `gh` to inspect failing checks (logs), unresolved review threads and merge conflicts.",
    "Work in an isolated checkout of the PR branch (e.g. `gh pr checkout` in a git worktree), make minimal changes, run relevant tests, then push to the PR branch.",
    "Never force-push over commits you did not make. Never merge, close or mark ready for review.",
  ].join("\n"),
  investigate: [
    "Explain why this PR is blocked. Use `gh` to read failing check logs, review threads and mergeability.",
    "Report root causes and recommended next steps. Make no changes.",
  ].join("\n"),
  summarize: [
    "Summarize this PR: intent, key changes, risk areas, and discussion so far.",
    "Use `gh pr view` and `gh pr diff`. Make no changes. Be concise.",
  ].join("\n"),
  review: [
    "Review this PR for correctness, tests, security and maintainability.",
    "Use `gh pr view` and `gh pr diff`; inspect the code in context where needed.",
    "Report findings grouped by severity with file:line references. Do not post comments or submit a review unless I ask.",
  ].join("\n"),
};

export const promptFor = (kind: PromptKind, tracked: TrackedPullRequest): string =>
  `${INSTRUCTIONS[kind]}\n\n${header(tracked)}`;

/** Default action for a PR: authors fix blockers; reviewers get a review. */
export const defaultKind = (tracked: TrackedPullRequest): PromptKind =>
  tracked.role === "review" ? "review" : tracked.health === "blocked" ? "fix" : "summarize";
