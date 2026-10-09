import { Schema } from "effect";

const Check = Schema.Struct({
  name: Schema.String,
  state: Schema.Literals(["passing", "failing", "pending"]),
  url: Schema.NullOr(Schema.String),
});

export const PullRequest = Schema.Struct({
  repository: Schema.String,
  number: Schema.Number,
  title: Schema.String,
  url: Schema.String,
  author: Schema.String,
  isDraft: Schema.Boolean,
  updatedAt: Schema.String,
  reviewDecision: Schema.NullOr(Schema.Literals(["APPROVED", "CHANGES_REQUESTED", "REVIEW_REQUIRED"])),
  mergeable: Schema.Literals(["MERGEABLE", "CONFLICTING", "UNKNOWN"]),
  unresolvedThreads: Schema.Number,
  checks: Schema.Array(Check),
});

export type PullRequest = typeof PullRequest.Type;
export type Check = typeof Check.Type;

/** Why a pull request cannot merge or progress. */
export type Blocker =
  | { readonly _tag: "ChecksFailing"; readonly checks: ReadonlyArray<Check> }
  | { readonly _tag: "ChecksPending"; readonly checks: ReadonlyArray<Check> }
  | { readonly _tag: "ChangesRequested" }
  | { readonly _tag: "ReviewRequired" }
  | { readonly _tag: "MergeConflict" }
  | { readonly _tag: "UnresolvedThreads"; readonly count: number }
  | { readonly _tag: "Draft" };

export type Health = "blocked" | "pending" | "ready";

export const blockersOf = (pr: PullRequest): ReadonlyArray<Blocker> => {
  const failing = pr.checks.filter((check) => check.state === "failing");
  const pending = pr.checks.filter((check) => check.state === "pending");
  return [
    ...(pr.isDraft ? [{ _tag: "Draft" } as const] : []),
    ...(pr.mergeable === "CONFLICTING" ? [{ _tag: "MergeConflict" } as const] : []),
    ...(failing.length > 0 ? [{ _tag: "ChecksFailing", checks: failing } as const] : []),
    ...(pr.reviewDecision === "CHANGES_REQUESTED" ? [{ _tag: "ChangesRequested" } as const] : []),
    ...(pr.unresolvedThreads > 0
      ? [{ _tag: "UnresolvedThreads", count: pr.unresolvedThreads } as const]
      : []),
    ...(pending.length > 0 ? [{ _tag: "ChecksPending", checks: pending } as const] : []),
    ...(pr.reviewDecision === "REVIEW_REQUIRED" ? [{ _tag: "ReviewRequired" } as const] : []),
  ];
};

export const healthOf = (blockers: ReadonlyArray<Blocker>): Health => {
  if (blockers.some((b) => b._tag !== "ChecksPending" && b._tag !== "ReviewRequired")) return "blocked";
  return blockers.length > 0 ? "pending" : "ready";
};

export const describeBlocker = (blocker: Blocker): string => {
  switch (blocker._tag) {
    case "Draft":
      return "draft";
    case "MergeConflict":
      return "merge conflict";
    case "ChecksFailing":
      return `failing: ${blocker.checks.map((c) => c.name).join(", ")}`;
    case "ChecksPending":
      return `${blocker.checks.length} checks running`;
    case "ChangesRequested":
      return "changes requested";
    case "ReviewRequired":
      return "awaiting review";
    case "UnresolvedThreads":
      return `${blocker.count} unresolved threads`;
  }
};

export type Role = "review" | "authored";

/** Compact display only; repository identity always retains owner/name. */
export const repositoryName = (repository: string): string => repository.split("/").at(-1) ?? repository;

export interface TrackedPullRequest {
  readonly role: Role;
  readonly pullRequest: PullRequest;
  readonly blockers: ReadonlyArray<Blocker>;
  readonly health: Health;
}

export const track = (role: Role, pullRequest: PullRequest): TrackedPullRequest => {
  const blockers = blockersOf(pullRequest);
  return { role, pullRequest, blockers, health: healthOf(blockers) };
};
