import { execFile } from "node:child_process";
import { Schema } from "effect";

import { PullRequest, track, type TrackedPullRequest } from "./pull-request.ts";

const QUERY = `
query($q: String!) {
  search(query: $q, type: ISSUE, first: 20) {
    nodes {
      ... on PullRequest {
        number title url isDraft updatedAt reviewDecision mergeable
        repository { nameWithOwner }
        author { login }
        reviewThreads(first: 30) { nodes { isResolved isOutdated } }
        commits(last: 1) { nodes { commit { statusCheckRollup { contexts(first: 40) { nodes {
          __typename
          ... on CheckRun { name status conclusion detailsUrl }
          ... on StatusContext { context state targetUrl }
        } } } } } }
      }
    }
  }
}`;

const FAILING = new Set(["FAILURE", "TIMED_OUT", "CANCELLED", "ACTION_REQUIRED", "STARTUP_FAILURE", "ERROR"]);
const PASSING = new Set(["SUCCESS", "NEUTRAL", "SKIPPED"]);

const CheckNode = Schema.Union([
  Schema.Struct({
    __typename: Schema.Literal("CheckRun"),
    name: Schema.String,
    status: Schema.String,
    conclusion: Schema.NullOr(Schema.String),
    detailsUrl: Schema.NullOr(Schema.String),
  }),
  Schema.Struct({
    __typename: Schema.Literal("StatusContext"),
    context: Schema.String,
    state: Schema.String,
    targetUrl: Schema.NullOr(Schema.String),
  }),
]);

const Node = Schema.Struct({
  number: Schema.Number,
  title: Schema.String,
  url: Schema.String,
  isDraft: Schema.Boolean,
  updatedAt: Schema.String,
  reviewDecision: PullRequest.fields.reviewDecision,
  mergeable: PullRequest.fields.mergeable,
  repository: Schema.Struct({ nameWithOwner: Schema.String }),
  author: Schema.NullOr(Schema.Struct({ login: Schema.String })),
  reviewThreads: Schema.Struct({
    nodes: Schema.Array(Schema.Struct({ isResolved: Schema.Boolean, isOutdated: Schema.Boolean })),
  }),
  commits: Schema.Struct({
    nodes: Schema.Array(
      Schema.Struct({
        commit: Schema.Struct({
          statusCheckRollup: Schema.NullOr(
            Schema.Struct({ contexts: Schema.Struct({ nodes: Schema.Array(Schema.NullOr(CheckNode)) }) }),
          ),
        }),
      }),
    ),
  }),
});

const Response = Schema.Struct({
  data: Schema.Struct({ search: Schema.Struct({ nodes: Schema.Array(Schema.NullOr(Node)) }) }),
});

type CheckState = PullRequest["checks"][number]["state"];

const checkState = (status: string, conclusion: string | null): CheckState => {
  if (conclusion !== null && FAILING.has(conclusion)) return "failing";
  if (conclusion !== null && PASSING.has(conclusion)) return "passing";
  return status === "COMPLETED" ? "passing" : "pending";
};

const statusContextState = (state: string): CheckState => {
  if (FAILING.has(state)) return "failing";
  return state === "SUCCESS" ? "passing" : "pending";
};

const toPullRequest = (node: typeof Node.Type): PullRequest => ({
  repository: node.repository.nameWithOwner,
  number: node.number,
  title: node.title,
  url: node.url,
  author: node.author?.login ?? "ghost",
  isDraft: node.isDraft,
  updatedAt: node.updatedAt,
  reviewDecision: node.reviewDecision,
  mergeable: node.mergeable,
  unresolvedThreads: node.reviewThreads.nodes.filter((t) => !t.isResolved && !t.isOutdated).length,
  checks: (node.commits.nodes[0]?.commit.statusCheckRollup?.contexts.nodes ?? []).flatMap((check) => {
    if (check === null) return [];
    return check.__typename === "CheckRun"
      ? [{ name: check.name, state: checkState(check.status, check.conclusion), url: check.detailsUrl }]
      : [{ name: check.context, state: statusContextState(check.state), url: check.targetUrl }];
  }),
});

const gh = (args: ReadonlyArray<string>): Promise<string> =>
  new Promise((resolve, reject) => {
    execFile("gh", [...args], { maxBuffer: 16 * 1024 * 1024 }, (error, stdout, stderr) =>
      error ? reject(new Error(stderr.trim() || error.message)) : resolve(stdout),
    );
  });

const search = async (query: string): Promise<ReadonlyArray<PullRequest>> => {
  const stdout = await gh(["api", "graphql", "-f", `query=${QUERY}`, "-f", `q=${query}`]);
  const parsed = Schema.decodeUnknownSync(Response)(JSON.parse(stdout));
  return parsed.data.search.nodes.flatMap((node) => (node === null ? [] : [toPullRequest(node)]));
};

const BASE = "is:pr is:open archived:false sort:updated-desc";

/** Open PRs awaiting my review (or assigned to me), then PRs I opened. A PR is listed once. */
export const fetchTracked = async (): Promise<ReadonlyArray<TrackedPullRequest>> => {
  const [review, assigned, authored] = await Promise.all([
    search(`${BASE} review-requested:@me`),
    search(`${BASE} assignee:@me -author:@me`),
    search(`${BASE} author:@me`),
  ]);
  const seen = new Set<string>();
  const dedupe = (role: "review" | "authored", prs: ReadonlyArray<PullRequest>) =>
    prs.flatMap((pr) => {
      const key = `${pr.repository}#${pr.number}`;
      if (seen.has(key)) return [];
      seen.add(key);
      return [track(role, pr)];
    });
  return [...dedupe("authored", authored), ...dedupe("review", [...review, ...assigned])];
};
