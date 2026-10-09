import { describe, expect, it } from "vitest";
import { parseOptions } from "./config.ts";

describe("plugin options", () => {
  it("keeps Luna and personal queries as defaults", () => {
    const options = parseOptions({});
    expect(options.model).toEqual({ providerID: "github-copilot", id: "gpt-6-luna" });
    expect(options.queries).toEqual({
      review: "is:pr is:open archived:false sort:updated-desc review-requested:@me",
      assigned: "is:pr is:open archived:false sort:updated-desc assignee:@me -author:@me",
      authored: "is:pr is:open archived:false sort:updated-desc author:@me",
    });
  });

  it("parses a custom model and reasoning variant, including model IDs containing slashes", () => {
    expect(parseOptions({ model: " provider/model-name#high " }).model)
      .toEqual({ providerID: "provider", id: "model-name", variant: "high" });
    expect(parseOptions({ model: "provider/namespace/model" }).model)
      .toEqual({ providerID: "provider", id: "namespace/model" });
  });

  it("applies shared organization and repository filters to every group", () => {
    const options = parseOptions({ query: " org:example-org -repo:example-org/archive " });
    for (const query of Object.values(options.queries)) {
      expect(query).toContain("is:pr is:open archived:false");
      expect(query).toMatch(/org:example-org -repo:example-org\/archive$/);
    }
  });

  it("overrides one group selector without losing shared filters or other defaults", () => {
    const options = parseOptions({
      query: "org:example-org",
      queries: { review: 'team-review-requested:example-org/reviewers label:"ready for review"' },
    });
    expect(options.queries.review).toBe('is:pr is:open archived:false sort:updated-desc team-review-requested:example-org/reviewers label:"ready for review" org:example-org');
    expect(options.queries.assigned).toContain("assignee:@me -author:@me");
    expect(options.queries.authored).toContain("author:@me");
  });

  it.each(["", "gpt-6-luna", "/model", "provider/", "provider/model#", "provider/model#high#extra"])
    ("rejects invalid model %j", (model) => {
      expect(() => parseOptions({ model })).toThrow("model must be provider/model");
    });

  it.each([{ model: 3 }, { query: [] }, { queries: { authored: null } }, { queries: { review: " " } }, { modle: "provider/model" }])
    ("rejects malformed or misspelled options %j", (options) => {
      expect(() => parseOptions(options)).toThrow();
    });
});
