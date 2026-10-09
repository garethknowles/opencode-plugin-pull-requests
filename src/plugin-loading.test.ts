import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Host } from "../node_modules/@opencode/plugin/dist/host.js";

describe("local plugin configuration", () => {
  it("resolves both entrypoints for a local directory", () => {
    const entries = Host.resolve({ directory: process.cwd() });
    expect(entries.server).toBeDefined();
    expect(entries.tui).toBeDefined();
  });
  it("uses an explicit relative path recognised by OpenCode", () => {
    const config = readFileSync(new URL("../opencode.jsonc", import.meta.url), "utf8");
    expect(config).toContain('"./"');
  });
});
