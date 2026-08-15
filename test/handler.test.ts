import { beforeEach, describe, expect, it } from "bun:test";
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { forkInTmux, runForkInTmux } from "../src/index";
import type {
  ExtensionApiLike,
  ExtensionCommandCtx,
  HandlerCtx,
  TmuxLike,
} from "../src/index";

let sessionDir: string;

function fixtureSession(): string {
  const file = join(sessionDir, "current.jsonl");
  writeFileSync(file, '{"type":"session","version":3,"id":"original"}\n');
  return file;
}

function fakeTmux(failure?: Error) {
  const calls: {
    targetPane: string;
    cwd: string;
    command: readonly string[];
  }[] = [];
  const tmux: TmuxLike = {
    splitPane: async (opts) => {
      calls.push(opts);
      if (failure) throw failure;
      return "%9";
    },
  };
  return { tmux, calls };
}

function handlerCtx(overrides: Partial<HandlerCtx> = {}): HandlerCtx {
  return {
    tmux: fakeTmux().tmux,
    cwd: "/repo",
    sessionFile: fixtureSession(),
    env: { TMUX: "/tmp/tmux-1000/default,123,0", TMUX_PANE: "%4" },
    busy: false,
    notify: () => {},
    ompArgs: [],
    ...overrides,
  };
}

beforeEach(() => {
  sessionDir = `/tmp/fit-handler-${process.pid}-${Date.now()}-${crypto.randomUUID()}`;
  mkdirSync(sessionDir, { recursive: true });
});

describe("runForkInTmux", () => {
  it("starts omp's built-in fork in a detached pane beside the original", async () => {
    const { tmux, calls } = fakeTmux();
    const ctx = handlerCtx({ tmux });
    await runForkInTmux(ctx);

    expect(calls).toEqual([
      {
        targetPane: "%4",
        cwd: "/repo",
        command: ["omp", "--fork", ctx.sessionFile],
      },
    ]);
    expect(readdirSync(sessionDir)).toEqual(["current.jsonl"]);
  });

  it("forwards the running omp profile to the forked omp", async () => {
    const { tmux, calls } = fakeTmux();
    const ctx = handlerCtx({ tmux, ompArgs: ["--profile", "work"] });
    await runForkInTmux(ctx);
    expect(calls[0]?.command).toEqual([
      "omp",
      "--profile",
      "work",
      "--fork",
      ctx.sessionFile,
    ]);
  });

  it("refuses outside tmux before touching the session", async () => {
    const { tmux, calls } = fakeTmux();
    const ctx = handlerCtx({ tmux, env: {} });
    const before = readdirSync(sessionDir);
    await expect(runForkInTmux(ctx)).rejects.toThrow(/inside tmux/);
    expect(calls).toEqual([]);
    expect(readdirSync(sessionDir)).toEqual(before);
  });

  it("refuses a stale tmux environment without the current pane id", async () => {
    const { tmux, calls } = fakeTmux();
    const ctx = handlerCtx({
      tmux,
      env: { TMUX: "/tmp/tmux-1000/default,123,0" },
    });
    await expect(runForkInTmux(ctx)).rejects.toThrow(/TMUX_PANE/);
    expect(calls).toEqual([]);
  });

  it("refuses while the agent is busy", async () => {
    const { tmux, calls } = fakeTmux();
    await expect(
      runForkInTmux(handlerCtx({ tmux, busy: true })),
    ).rejects.toThrow(/busy/);
    expect(calls).toEqual([]);
  });

  it("refuses before splitting when omp has not persisted the transcript", async () => {
    const { tmux, calls } = fakeTmux();
    const missing = join(sessionDir, "missing.jsonl");
    await expect(
      runForkInTmux(handlerCtx({ tmux, sessionFile: missing })),
    ).rejects.toThrow(/no transcript/);
    expect(calls).toEqual([]);
  });

  it("surfaces tmux pane creation failures", async () => {
    const { tmux } = fakeTmux(
      new Error("tmux split-window failed (exit 1): no space for new pane"),
    );
    await expect(runForkInTmux(handlerCtx({ tmux }))).rejects.toThrow(
      /no space for new pane/,
    );
  });
});

describe("registration", () => {
  it("registers /fork-in-tmux with a description and rejects arguments", async () => {
    let name = "";
    let description: string | undefined;
    let handler:
      | ((args: string, ctx: ExtensionCommandCtx) => Promise<void>)
      | undefined;
    const api: ExtensionApiLike = {
      registerCommand: (registeredName, options) => {
        name = registeredName;
        description = options.description;
        handler = options.handler;
      },
    };
    forkInTmux(api);
    expect(name).toBe("fork-in-tmux");
    expect(description).toMatch(/tmux/i);
    expect(handler).toBeDefined();
    await expect(handler!("extra", {} as ExtensionCommandCtx)).rejects.toThrow(
      /argument/,
    );
  });
});
