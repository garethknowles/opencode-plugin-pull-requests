import { describe, expect, it } from "vitest";

import { defaultKind } from "./prompts.ts";
import { repositoryName, track, type PullRequest } from "./pull-request.ts";

const base: PullRequest = {
  repository: "o/r",
  number: 1,
  title: "t",
  url: "https://github.com/o/r/pull/1",
  author: "me",
  isDraft: false,
  updatedAt: "2026-01-01T00:00:00Z",
  reviewDecision: "APPROVED",
  mergeable: "MERGEABLE",
  unresolvedThreads: 0,
  checks: [],
};

it("displays the repository without its owner", () => {
  expect(repositoryName("eeveebank/graphql-server")).toBe("graphql-server");
  expect(repositoryName("graphql-server")).toBe("graphql-server");
});

describe("track", () => {
  it("is ready when nothing blocks", () => {
    expect(track("authored", base).health).toBe("ready");
  });

  it("is blocked by failing checks and names them", () => {
    const tracked = track("authored", {
      ...base,
      checks: [{ name: "build", state: "failing", url: null }],
    });
    expect(tracked.health).toBe("blocked");
    expect(tracked.blockers).toEqual([
      { _tag: "ChecksFailing", checks: [{ name: "build", state: "failing", url: null }] },
    ]);
  });

  it("is only pending while checks run or review is awaited", () => {
    const tracked = track("authored", {
      ...base,
      reviewDecision: "REVIEW_REQUIRED",
      checks: [{ name: "build", state: "pending", url: null }],
    });
    expect(tracked.health).toBe("pending");
  });

  it("is blocked by conflicts, changes requested, threads and draft", () => {
    const tags = track("authored", {
      ...base,
      isDraft: true,
      mergeable: "CONFLICTING",
      reviewDecision: "CHANGES_REQUESTED",
      unresolvedThreads: 2,
    }).blockers.map((b) => b._tag);
    expect(tags).toEqual(["Draft", "MergeConflict", "ChangesRequested", "UnresolvedThreads"]);
  });
});

describe("defaultKind", () => {
  it("reviews PRs awaiting my review", () => {
    expect(defaultKind(track("review", base))).toBe("review");
  });
  it("fixes my blocked PRs, summarizes the rest", () => {
    expect(defaultKind(track("authored", { ...base, mergeable: "CONFLICTING" }))).toBe("fix");
    expect(defaultKind(track("authored", base))).toBe("summarize");
  });
});
