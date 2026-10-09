import { defaultKind, type PromptKind } from "./prompts.ts";
import { describeBlocker, repositoryName, type Health, type PullRequest, type TrackedPullRequest } from "./pull-request.ts";

/** Emoji retain status colour in OpenCode's plain-text picker; sidebar also applies theme colours. */
export const HEALTH_INDICATORS: Readonly<Record<Health, { readonly icon: string; readonly label: string }>> = {
  blocked: { icon: "❌", label: "Blocked" },
  pending: { icon: "⏳", label: "Pending" },
  ready: { icon: "✅", label: "No detected blockers" },
};

const ACTION_LABELS: Readonly<Record<PromptKind, string>> = {
  fix: "Fix", review: "Review", summarize: "Summarize", investigate: "Explain",
};

export const defaultActionLabel = (tracked: TrackedPullRequest): string => `↵ ${ACTION_LABELS[defaultKind(tracked)]}`;

/** Reserve the draft icon's two terminal columns plus a separator on every row. */
export const pullRequestLabel = (pr: PullRequest): string =>
  `${pr.isDraft ? "📝 " : "   "}${repositoryName(pr.repository)}#${pr.number}`;

export const statusDescription = (tracked: TrackedPullRequest): string => {
  const reasons = tracked.blockers.map(describeBlocker).join(" · ");
  const label = HEALTH_INDICATORS[tracked.health].label;
  return reasons.length > 0 ? `${label}: ${reasons}` : label;
};
