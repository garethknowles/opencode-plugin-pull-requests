import { expect, it } from "vitest";
import { refreshThenShow } from "./list.ts";

it("waits for fetched PRs before opening the dialog", async () => {
  let items: string[] = [];
  let shown: string[] = [];
  await refreshThenShow(
    async () => {
      await Promise.resolve();
      items = ["owner/repo#1"];
    },
    async () => {
      shown = [...items];
    },
  );
  expect(shown).toEqual(["owner/repo#1"]);
});
