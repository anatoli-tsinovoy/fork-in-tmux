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

const ORIGINAL_ID = "01a0028a-3480-7000-8a93-16440ac9433f";
let sessionDir: string;

function fixtureSession(id: string): string {
  const file = join(sessionDir, `2026-08-14T22-55-27-165Z_${id}.jsonl`);
  writeFileSync(
    file,
    [
      JSON.stringify({
        type: "title",
        v: 1,
        title: "",
        updatedAt: "2026-08-14T22:55:27.165Z",
      }),
      JSON.stringify({
        type: "session",
        version: 3,
        id,
        timestamp: "2026-08-14T22:55:27.165Z",
        cwd: "/repo",
        parentSession: null,
      }),
    ].join("\n") + "\n",
  );
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
    sessionFile: fixtureSession(ORIGINAL_ID),
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
  it("copies the session and resumes the fork in a detached pane beside the original", async () => {
    const { tmux, calls } = fakeTmux();
    const ctx = handlerCtx({ tmux });
    await runForkInTmux(ctx);

    const forkFile = readdirSync(sessionDir).find(
      (file) =>
        file.endsWith(".jsonl") && !file.endsWith(`${ORIGINAL_ID}.jsonl`),
    );
    expect(forkFile).toBeDefined();
    const header = JSON.parse(
      (await Bun.file(join(sessionDir, forkFile!)).text()).split("\n")[1]!,
    ) as {
      id: string;
      parentSession: string;
    };
    expect(header.parentSession).toBe(ORIGINAL_ID);
    expect(calls).toEqual([
      {
        targetPane: "%4",
        cwd: "/repo",
        command: ["omp", "--resume", header.id],
      },
    ]);
    expect(
      (await Bun.file(ctx.sessionFile).text()).trimEnd().split("\n"),
    ).toHaveLength(2);
  });

  it("forwards the running omp profile to the forked omp", async () => {
    const { tmux, calls } = fakeTmux();
    await runForkInTmux(handlerCtx({ tmux, ompArgs: ["--profile", "work"] }));
    expect(calls[0]?.command.slice(0, 4)).toEqual([
      "omp",
      "--profile",
      "work",
      "--resume",
    ]);
  });

  it("refuses outside tmux before creating a fork copy", async () => {
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
    const before = readdirSync(sessionDir);
    await expect(runForkInTmux(ctx)).rejects.toThrow(/TMUX_PANE/);
    expect(calls).toEqual([]);
    expect(readdirSync(sessionDir)).toEqual(before);
  });

  it("refuses while the agent is busy before creating a fork copy", async () => {
    const { tmux, calls } = fakeTmux();
    const ctx = handlerCtx({ tmux, busy: true });
    const before = readdirSync(sessionDir);
    await expect(runForkInTmux(ctx)).rejects.toThrow(/busy/);
    expect(calls).toEqual([]);
    expect(readdirSync(sessionDir)).toEqual(before);
  });

  it("reports recovery instructions when tmux cannot create the pane", async () => {
    const { tmux } = fakeTmux(
      new Error("tmux split-window failed (exit 1): no space for new pane"),
    );
    await expect(runForkInTmux(handlerCtx({ tmux }))).rejects.toThrow(
      /omp --resume/,
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
