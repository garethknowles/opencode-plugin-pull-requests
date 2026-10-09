import { expect, it } from "vitest";
import { parseOptions } from "./config.ts";
import { fetchTracked } from "./github.ts";
import type { PullRequest } from "./pull-request.ts";

it("dispatches configured queries and deduplicates PRs with authored priority", async () => {
  const { queries } = parseOptions({ query: "org:example-org", queries: { review: "review-requested:@me -is:draft" } });
  const searched: string[] = [];
  const own: PullRequest = {
    repository: "example-org/api-service", number: 1, title: "Change", url: "https://github.com/example-org/api-service/pull/1",
    author: "me", isDraft: false, updatedAt: "2026-10-09", reviewDecision: null,
    mergeable: "MERGEABLE", unresolvedThreads: 0, checks: [],
  };
  const review = { ...own, number: 2, author: "review-author" };
  const assigned = { ...own, number: 3, author: "assigned-author" };
  const results = await fetchTracked(queries, async (query) => {
    searched.push(query);
    if (query === queries.authored) return [own];
    if (query === queries.review) return [own, review];
    return [review, assigned];
  });
  expect(searched).toEqual([queries.review, queries.assigned, queries.authored]);
  expect(results.map((item) => [item.role, item.pullRequest.number]))
    .toEqual([["authored", 1], ["review", 2], ["review", 3]]);
});
