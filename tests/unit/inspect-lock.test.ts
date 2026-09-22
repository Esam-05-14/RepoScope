import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  clearInspectLock,
  livingInspectLock,
  writeInspectLock,
} from "../../apps/cli/src/inspect-lock.ts";
import { isAddressInUse } from "../../apps/cli/src/commands/inspect.ts";

describe("inspect lock", () => {
  const previous = process.env.REPOSCOPE_CACHE;

  afterEach(() => {
    if (previous === undefined) {
      delete process.env.REPOSCOPE_CACHE;
    } else {
      process.env.REPOSCOPE_CACHE = previous;
    }
  });

  it("treats a living pid as reopenable and drops a dead pid", () => {
    const cache = mkdtempSync(path.join(tmpdir(), "reposcope-lock-"));
    process.env.REPOSCOPE_CACHE = cache;
    writeInspectLock({ pid: process.pid, port: 8787, token: "a".repeat(32) });
    expect(livingInspectLock(8787)?.pid).toBe(process.pid);
    writeInspectLock({ pid: 2_147_483_647, port: 8787, token: "b".repeat(32) });
    expect(livingInspectLock(8787)).toBeUndefined();
    clearInspectLock(8787);
  });

  it("detects EADDRINUSE without hopping ports", () => {
    expect(isAddressInUse({ code: "EADDRINUSE" })).toBe(true);
    expect(isAddressInUse(new Error("listen EADDRINUSE: address already in use 127.0.0.1:8787"))).toBe(
      true,
    );
    expect(isAddressInUse(new Error("other"))).toBe(false);
  });
});
