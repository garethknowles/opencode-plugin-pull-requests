import { defaultKind, type PromptKind } from "./prompts.ts";
import stringWidth from "string-width";
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

const TITLE_COLUMNS = 56;
const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/** Fixed terminal-cell width aligns reasons; stay below the picker's built-in title truncation. */
export const panelTitle = (tracked: TrackedPullRequest): string => {
  const title = `${HEALTH_INDICATORS[tracked.health].icon} ${pullRequestLabel(tracked.pullRequest)} ${tracked.pullRequest.title}`;
  const width = stringWidth(title);
  if (width <= TITLE_COLUMNS && title.length + TITLE_COLUMNS - width <= 61) {
    return title + " ".repeat(TITLE_COLUMNS - width);
  }
  let shortened = "";
  for (const { segment } of graphemes.segment(title)) {
    const candidate = shortened + segment;
    const candidateWidth = stringWidth(candidate);
    if (candidateWidth > TITLE_COLUMNS - 1 || candidate.length + TITLE_COLUMNS - candidateWidth > 61) break;
    shortened += segment;
  }
  const truncated = `${shortened}…`;
  return truncated + " ".repeat(TITLE_COLUMNS - stringWidth(truncated));
};

export const statusDescription = (tracked: TrackedPullRequest): string => {
  const reasons = tracked.blockers.map(describeBlocker).join(" · ");
  const label = HEALTH_INDICATORS[tracked.health].label;
  return reasons.length > 0 ? `${label}: ${reasons}` : label;
};
