import { expect, it } from "vitest";
import { defaultActionLabel, HEALTH_INDICATORS, panelTitle, pullRequestLabel, statusDescription } from "./presentation.ts";
import stringWidth from "string-width";
import { track, type PullRequest } from "./pull-request.ts";

const pr: PullRequest = {
  repository: "owner/repo", number: 1, title: "Change", url: "https://github.com/owner/repo/pull/1",
  author: "me", isDraft: false, updatedAt: "2026-10-09", reviewDecision: null,
  mergeable: "MERGEABLE", unresolvedThreads: 0, checks: [],
};

it("labels Enter's real action for each role and health", () => {
  expect(defaultActionLabel(track("review", { ...pr, mergeable: "CONFLICTING" }))).toBe("↵ Review");
  expect(defaultActionLabel(track("authored", { ...pr, mergeable: "CONFLICTING" }))).toBe("↵ Fix");
  expect(defaultActionLabel(track("authored", pr))).toBe("↵ Summarize");
  expect(defaultActionLabel(track("authored", { ...pr, reviewDecision: "REVIEW_REQUIRED" }))).toBe("↵ Summarize");
});

it("distinguishes overall health while retaining every blocker", () => {
  expect(new Set(Object.values(HEALTH_INDICATORS).map((i) => i.icon)).size).toBe(3);
  expect(statusDescription(track("authored", { ...pr, mergeable: "CONFLICTING", unresolvedThreads: 2 })))
    .toBe("Blocked: merge conflict · 2 unresolved threads");
  expect(statusDescription(track("authored", pr))).toBe("No detected blockers");
});

it("marks drafts pending without starting a fix for draft status alone", () => {
  const draft = track("authored", { ...pr, isDraft: true });
  expect(draft.health).toBe("pending");
  expect(pullRequestLabel(draft.pullRequest)).toBe("📝 repo#1");
  expect(statusDescription(draft)).toBe("Pending: draft");
  expect(defaultActionLabel(draft)).toBe("↵ Summarize");
  expect(pullRequestLabel(pr)).toBe("   repo#1");
});

it("keeps real blockers red on draft PRs", () => {
  const draft = track("authored", {
    ...pr, isDraft: true, checks: [{ name: "test", state: "failing", url: null }],
  });
  expect(draft.health).toBe("blocked");
  expect(pullRequestLabel(draft.pullRequest)).toBe("📝 repo#1");
  expect(statusDescription(draft)).toBe("Blocked: draft · failing: test");
  expect(defaultActionLabel(draft)).toBe("↵ Fix");
});

it("aligns reasoning after short, long, draft and wide-character titles", () => {
  const titles = ["Short", "A long description ".repeat(10), "更新 ✅", "Fix e\u0301", "e\u0301".repeat(60)];
  for (const title of titles) {
    for (const isDraft of [false, true]) {
      const formatted = panelTitle(track("authored", { ...pr, title, isDraft }));
      expect(stringWidth(formatted)).toBe(56);
      expect(formatted.length).toBeLessThanOrEqual(61);
    }
  }
  expect(panelTitle(track("authored", { ...pr, title: "x".repeat(100) })).trimEnd()).toMatch(/…$/);
});
