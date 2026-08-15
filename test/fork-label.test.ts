import { describe, expect, it } from "bun:test";
import { forkLabel } from "../src/fork-label";

describe("forkLabel", () => {
  it("appends f1 to a plain label", () => {
    expect(forkLabel("2", [])).toBe("2f1");
  });

  it("increments for each existing fork of the same base", () => {
    expect(forkLabel("2", ["2f1"])).toBe("2f2");
    expect(forkLabel("2", ["2f1", "2f2"])).toBe("2f3");
  });

  it("nests when forking a fork", () => {
    expect(forkLabel("2f1", ["2f1", "2"])).toBe("2f1f1");
  });

  it("reuses the first free number after a fork was closed", () => {
    expect(forkLabel("2", ["2f2"])).toBe("2f1");
    expect(forkLabel("2", ["2f1", "2f3"])).toBe("2f2");
  });

  it("ignores forks of other labels", () => {
    expect(forkLabel("2", ["3f1", "mainf1", "22f1"])).toBe("2f1");
  });

  it("works for non-numeric labels", () => {
    expect(forkLabel("main", ["mainf2"])).toBe("mainf1");
  });

  it("keeps scanning when only a higher-numbered nested fork exists", () => {
    expect(forkLabel("2", ["2f1f1"])).toBe("2f1");
  });
});
