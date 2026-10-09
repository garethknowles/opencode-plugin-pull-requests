import { Plugin } from "@opencode/plugin";

/** Server half is intentionally empty; all behaviour lives in the `./tui` plugin. */
export default Plugin.define({
  id: "pull-requests",
  setup() {},
});
