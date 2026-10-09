import type { TrackedPullRequest } from "./pull-request.ts";

export type PullRequestState =
  | { readonly status: "loading"; readonly items: ReadonlyArray<TrackedPullRequest> }
  | { readonly status: "ready"; readonly items: ReadonlyArray<TrackedPullRequest> }
  | { readonly status: "error"; readonly items: ReadonlyArray<TrackedPullRequest>; readonly message: string };

export interface PullRequestMemory {
  value: PullRequestState;
}

export const publishState = (
  update: (mutation: (draft: PullRequestMemory) => void) => void,
  next: PullRequestState,
): void => {
  update((draft) => {
    draft.value = next;
  });
};
