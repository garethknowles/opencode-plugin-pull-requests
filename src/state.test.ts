import { createStore, produce } from "solid-js/store";
import { expect, it } from "vitest";
import { publishState, type PullRequestMemory } from "./state.ts";
import { track } from "./pull-request.ts";

it("publishes fetched PRs through a mutation-only store", () => {
  const [state, setState] = createStore<PullRequestMemory>({ value: { status: "loading", items: [] } });
  const items = [track("authored", {
    repository: "owner/repo", number: 1, title: "Change", url: "https://github.com/owner/repo/pull/1",
    author: "me", isDraft: false, updatedAt: "2026-10-09", reviewDecision: null,
    mergeable: "MERGEABLE", unresolvedThreads: 0, checks: [],
  })];
  publishState((mutation) => setState(produce(mutation)), { status: "ready", items });
  expect(state.value.status).toBe("ready");
  expect(state.value.items).toEqual(items);
});

it("publishes errors rather than leaving an empty loading state", () => {
  const [state, setState] = createStore<PullRequestMemory>({ value: { status: "loading", items: [] } });
  publishState((mutation) => setState(produce(mutation)), {
    status: "error", items: [], message: "GitHub unavailable",
  });
  expect(state.value).toEqual({ status: "error", items: [], message: "GitHub unavailable" });
});
