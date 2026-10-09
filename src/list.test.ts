import { expect, it } from "vitest";
import { refreshAndShow } from "./list.ts";

it("opens cached PRs before the refresh finishes", async () => {
  const events: string[] = [];
  let items = ["cached/repo#1"];
  await refreshAndShow(
    async () => {
      await Promise.resolve();
      items = ["fresh/repo#2"];
      events.push("loaded");
    },
    async () => {
      events.push(`shown: ${items.join(",")}`);
    },
  );
  expect(events).toEqual(["shown: cached/repo#1", "loaded"]);
});
