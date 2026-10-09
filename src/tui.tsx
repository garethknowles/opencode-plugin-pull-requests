/** @jsxImportSource @opentui/solid */
import { Plugin } from "@opencode/plugin/tui";
import { execFile } from "node:child_process";

import { fetchTracked } from "./github.ts";
import { refreshThenShow } from "./list.ts";
import { defaultKind, promptFor, type PromptKind } from "./prompts.ts";
import { describeBlocker, type Health, type TrackedPullRequest } from "./pull-request.ts";
import { publishState, type PullRequestMemory } from "./state.ts";

const REFRESH_MS = 2 * 60_000;

const ICON: Record<Health, string> = { blocked: "✗", pending: "◌", ready: "✓" };

const key = ({ pullRequest: pr }: TrackedPullRequest) => `${pr.repository}#${pr.number}`;

const openUrl = (url: string): void => {
  const opener = process.platform === "darwin" ? "open" : "xdg-open";
  execFile(opener, [url], () => {});
};

const summaryLine = (items: ReadonlyArray<TrackedPullRequest>): string => {
  const review = items.filter((i) => i.role === "review").length;
  const mine = items.filter((i) => i.role === "authored");
  const blocked = mine.filter((i) => i.health === "blocked").length;
  return `PRs ${review} to review · ${mine.length} mine${blocked > 0 ? ` · ${blocked} blocked` : ""}`;
};

/** Tracks PRs awaiting my review or opened by me, with one-key follow-up sessions. */
export default Plugin.define({
  id: "boxed.pull-requests.tui",
  setup(context) {
    const [state, updateState] = context.storage.memory<PullRequestMemory>("pull-requests-v2", {
      initial: { value: { status: "loading", items: [] } },
    });

    let previouslyBlocked = new Set<string>();
    let firstLoad = true;

    const refresh = async (): Promise<void> => {
      try {
        const items = await fetchTracked();
        const blocked = new Set(items.filter((i) => i.role === "authored" && i.health === "blocked").map(key));
        const fresh = items.filter((i) => blocked.has(key(i)) && !previouslyBlocked.has(key(i)));
        if (!firstLoad && fresh.length > 0) {
          context.ui.toast.show({
            title: "PR blocked",
            message: fresh.map((i) => `${key(i)}: ${i.blockers.map(describeBlocker)[0]}`).join("\n"),
            variant: "warning",
          });
        }
        previouslyBlocked = blocked;
        firstLoad = false;
        publishState(updateState, { status: "ready", items });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        publishState(updateState, { status: "error", items: state.value.items, message });
      }
    };

    const startSession = async (kind: PromptKind, tracked: TrackedPullRequest): Promise<void> => {
      const pr = tracked.pullRequest;
      try {
        const session = await context.client.session.create({
          title: `PR ${pr.repository}#${pr.number}: ${kind}`,
          ...(context.location ? { location: context.location } : {}),
        });
        await context.client.session.prompt({ sessionID: session.id, text: promptFor(kind, tracked) });
        context.ui.router.navigate({ type: "session", sessionID: session.id });
      } catch (error) {
        context.ui.toast.show({
          title: "Could not start session",
          message: error instanceof Error ? error.message : String(error),
          variant: "error",
        });
      }
    };

    const showList = (): Promise<void> => refreshThenShow(refresh, async () => {
      if (state.value.status === "error") {
        await context.ui.dialog.alert({ title: "Could not load pull requests", message: state.value.message });
        return;
      }
      context.ui.dialog.set({ size: "xlarge" });
      const picked = await context.ui.dialog.select<TrackedPullRequest>({
        title: summaryLine(state.value.items),
        options: state.value.items.map((tracked) => ({
          title: `${ICON[tracked.health]} ${tracked.pullRequest.repository}#${tracked.pullRequest.number} ${tracked.pullRequest.title}`,
          description:
            tracked.blockers.map(describeBlocker).join(" · ") ||
            (tracked.role === "review" ? `by ${tracked.pullRequest.author}` : "ready"),
          value: tracked,
          category: tracked.role === "review" ? "Awaiting my review" : "Opened by me",
        })),
        actions: [
          { bind: "ctrl+f", title: "Fix", onTrigger: (v) => void startSession("fix", v) },
          { bind: "ctrl+e", title: "Explain", onTrigger: (v) => void startSession("investigate", v) },
          { bind: "ctrl+s", title: "Summarize", onTrigger: (v) => void startSession("summarize", v) },
          { bind: "ctrl+r", title: "Review", onTrigger: (v) => void startSession("review", v) },
          { bind: "ctrl+o", title: "Open", onTrigger: (v) => openUrl(v.pullRequest.url) },
        ],
      });
      if (picked !== undefined) await startSession(defaultKind(picked), picked);
    });

    context.keymap.layer(() => ({
      mode: "global",
      commands: [
        {
          id: "boxed.pull-requests.list",
          title: "Pull requests",
          group: "GitHub",
          palette: true,
          slash: { name: "prs" },
          run: () => void showList(),
        },
        {
          id: "boxed.pull-requests.refresh",
          title: "Refresh pull requests",
          group: "GitHub",
          palette: true,
          run: () => void refresh(),
        },
      ],
    }));

    const dispose = context.ui.slot({
      append: "home.footer.status",
      render: () => (
        <text fg={context.theme.text.muted}>
          {state.value.status === "error" ? "PRs unavailable" : state.value.status === "loading" ? "PRs loading…" : summaryLine(state.value.items)}
        </text>
      ),
    });

    void refresh();
    const timer = setInterval(() => void refresh(), REFRESH_MS);
    return () => {
      clearInterval(timer);
      dispose();
    };
  },
});
