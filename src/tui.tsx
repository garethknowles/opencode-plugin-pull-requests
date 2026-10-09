/** @jsxImportSource @opentui/solid */
import { Plugin } from "@opencode/plugin/tui";
import { execFile } from "node:child_process";
import { For, Show } from "solid-js";

import { fetchTracked } from "./github.ts";
import { refreshAndShow } from "./list.ts";
import { defaultKind, promptFor, type PromptKind } from "./prompts.ts";
import {
  defaultActionLabel,
  HEALTH_INDICATORS,
  panelTitle,
  pullRequestLabel,
  statusDescription,
} from "./presentation.ts";
import {
  describeBlocker,
  sidebarItems,
  type Health,
  type Role,
  type TrackedPullRequest,
} from "./pull-request.ts";
import { publishState, type PullRequestMemory } from "./state.ts";

const REFRESH_MS = 5 * 60_000;

const SIDEBAR_ROLES: ReadonlyArray<Role> = ["review", "authored"];

const key = ({ pullRequest: pr }: TrackedPullRequest) =>
  `${pr.repository}#${pr.number}`;

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
  id: "pull-requests.tui",
  setup(context) {
    const indicatorColor = (health: Health) => {
      switch (health) {
        case "blocked":
          return context.theme.text.feedback.error.base;
        case "pending":
          return "#facc15";
        case "ready":
          return context.theme.text.feedback.success.base;
      }
    };
    const [state, updateState] = context.storage.memory<PullRequestMemory>(
      "pull-requests-v2",
      {
        initial: { value: { status: "loading", items: [] } },
      },
    );
    const [sidebar, updateSidebar] = context.storage.memory(
      "pull-requests-sidebar",
      {
        initial: { expanded: true },
      },
    );

    let previouslyBlocked = new Set<string>();
    let firstLoad = true;

    const load = async (): Promise<void> => {
      publishState(updateState, {
        status: "loading",
        items: state.value.items,
      });
      try {
        const items = await fetchTracked();
        const blocked = new Set(
          items
            .filter((i) => i.role === "authored" && i.health === "blocked")
            .map(key),
        );
        const fresh = items.filter(
          (i) => blocked.has(key(i)) && !previouslyBlocked.has(key(i)),
        );
        if (!firstLoad && fresh.length > 0) {
          context.ui.toast.show({
            title: "PR blocked",
            message: fresh
              .map((i) => `${key(i)}: ${i.blockers.map(describeBlocker)[0]}`)
              .join("\n"),
            variant: "warning",
          });
        }
        previouslyBlocked = blocked;
        firstLoad = false;
        publishState(updateState, { status: "ready", items });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        publishState(updateState, {
          status: "error",
          items: state.value.items,
          message,
        });
        context.ui.toast.show({
          title: "Could not refresh PRs",
          message,
          variant: "error",
        });
      }
    };

    let refreshing: Promise<void> | undefined;
    const refresh = (): Promise<void> => {
      if (refreshing !== undefined) return refreshing;
      refreshing = load().finally(() => {
        refreshing = undefined;
      });
      return refreshing;
    };

    const startSession = async (
      kind: PromptKind,
      tracked: TrackedPullRequest,
    ): Promise<void> => {
      const pr = tracked.pullRequest;
      try {
        const session = await context.client.session.create({
          title: `PR ${pr.repository}#${pr.number}: ${kind}`,
          model: { providerID: "github-copilot", id: "gpt-6-luna" },
          ...(context.location ? { location: context.location } : {}),
        });
        await context.client.session.prompt({
          sessionID: session.id,
          text: promptFor(kind, tracked),
        });
        context.ui.router.navigate({ type: "session", sessionID: session.id });
      } catch (error) {
        context.ui.toast.show({
          title: "Could not start session",
          message: error instanceof Error ? error.message : String(error),
          variant: "error",
        });
      }
    };

    const showList = (selected?: TrackedPullRequest): Promise<void> =>
      refreshAndShow(refresh, async () => {
        const selection = context.ui.dialog.select<TrackedPullRequest>({
          ...(selected === undefined ? {} : { current: selected }),
          get title() {
            const suffix =
              state.value.status === "loading"
                ? " · loading…"
                : state.value.status === "error"
                  ? " · refresh failed"
                  : "";
            return `${summaryLine(state.value.items)}${suffix}`;
          },
          get options() {
            return state.value.items.map((tracked) => ({
              title: panelTitle(tracked),
              description: statusDescription(tracked),
              footer: defaultActionLabel(tracked),
              value: tracked,
              category:
                tracked.role === "review"
                  ? "Awaiting my review"
                  : "Opened by me",
            }));
          },
          actions: [
            {
              bind: "ctrl+f",
              title: "Fix",
              onTrigger: (v) => void startSession("fix", v),
            },
            {
              bind: "ctrl+e",
              title: "Explain",
              onTrigger: (v) => void startSession("investigate", v),
            },
            {
              bind: "ctrl+s",
              title: "Summarize",
              onTrigger: (v) => void startSession("summarize", v),
            },
            {
              bind: "ctrl+r",
              title: "Review",
              onTrigger: (v) => void startSession("review", v),
            },
            {
              bind: "ctrl+o",
              title: "Open",
              onTrigger: (v) => openUrl(v.pullRequest.url),
            },
          ],
        });
        context.ui.dialog.set({ size: "xlarge" });
        const picked = await selection;
        if (picked !== undefined)
          await startSession(defaultKind(picked), picked);
      });

    context.keymap.layer(() => ({
      mode: "global",
      commands: [
        {
          id: "pull-requests.list",
          title: "Pull requests",
          group: "GitHub",
          palette: true,
          slash: { name: "prs" },
          run: () => void showList(),
        },
        {
          id: "pull-requests.refresh",
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
          {state.value.status === "error"
            ? "PRs unavailable"
            : state.value.status === "loading"
              ? "PRs loading…"
              : summaryLine(state.value.items)}
        </text>
      ),
    });

    const disposeSidebar = context.ui.slot({
      append: "sidebar.content",
      render: () => (
        <box gap={1}>
          <text
            fg={context.theme.text.base}
            onMouseUp={() =>
              updateSidebar((draft) => {
                draft.expanded = !draft.expanded;
              })
            }
          >
            <b>{sidebar.expanded ? "▼" : "▶"} Pull requests</b>
          </text>
          <Show when={sidebar.expanded}>
            <Show
              when={
                state.value.status === "ready" || state.value.items.length > 0
              }
              fallback={
                <text
                  fg={context.theme.text.muted}
                  onMouseUp={() => void showList()}
                >
                  {state.value.status === "error"
                    ? "Unavailable · click to retry"
                    : "Loading…"}
                </text>
              }
            >
              <For each={SIDEBAR_ROLES}>
                {(role) => (
                  <box>
                    <text
                      fg={context.theme.text.muted}
                      onMouseUp={() => void showList()}
                    >
                      {role === "review" ? "To review" : "Opened by me"} (
                      {state.value.items.filter((i) => i.role === role).length})
                    </text>
                    <For each={sidebarItems(state.value.items, role)}>
                      {(item) => (
                        <text
                          fg={context.theme.text.base}
                          truncate
                          wrapMode="none"
                          onMouseUp={() => void showList(item)}
                        >
                          <span style={{ fg: indicatorColor(item.health) }}>
                            {HEALTH_INDICATORS[item.health].icon}
                          </span>{" "}
                          {pullRequestLabel(item.pullRequest)}
                        </text>
                      )}
                    </For>
                  </box>
                )}
              </For>
              <text
                fg={context.theme.text.muted}
                onMouseUp={() => void showList()}
              >
                View all · /prs
              </text>
            </Show>
          </Show>
        </box>
      ),
    });

    void refresh();
    const timer = setInterval(() => void refresh(), REFRESH_MS);
    return () => {
      clearInterval(timer);
      dispose();
      disposeSidebar();
    };
  },
});
