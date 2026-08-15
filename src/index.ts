import { TmuxClient } from "./tmux-client";
import { createForkCopy } from "./fork-copy";

/**
 * The omp extension factory surface fork-in-tmux needs. omp's real
 * ExtensionAPI is broader; this structural type avoids importing omp internals.
 */
export interface ExtensionApiLike {
  registerCommand(
    name: string,
    options: {
      description?: string;
      handler: (args: string, ctx: ExtensionCommandCtx) => Promise<void>;
    },
  ): void;
}

/** The subset of omp's ExtensionCommandContext used by /fork-in-tmux. */
export interface ExtensionCommandCtx {
  cwd: string;
  isIdle(): boolean;
  ui: { notify(message: string, type?: "info" | "warning" | "error"): void };
  sessionManager: { getSessionFile(): string | undefined };
}

/** Injected handler dependencies keep tmux process creation testable. */
export interface HandlerCtx {
  tmux: TmuxLike;
  cwd: string;
  sessionFile: string;
  env: Record<string, string | undefined>;
  busy: boolean;
  notify: (message: string) => void;
  /** Bootstrap args of the running omp process (for example, ["--profile", "work"]). */
  ompArgs: readonly string[];
}

export interface TmuxLike {
  splitPane(opts: {
    targetPane: string;
    cwd: string;
    command: readonly string[];
  }): Promise<string>;
}

function ompProcessArgs(): string[] {
  // Drop argv[0]/argv[1] (runtime + script); keep bootstrap flags like --profile.
  const scriptArgs = process.argv.slice(2);
  const profile = scriptArgs.findIndex(
    (arg) => arg === "--profile" || arg.startsWith("--profile="),
  );
  if (profile === -1) return [];
  const flag = scriptArgs[profile]!;
  if (flag.includes("=")) return [flag];
  const value = scriptArgs[profile + 1];
  return value === undefined ? [flag] : [flag, value];
}

function handlerCtx(ctx: ExtensionCommandCtx): HandlerCtx {
  const sessionFile = ctx.sessionManager.getSessionFile();
  if (!sessionFile)
    throw new Error("fork-in-tmux: current session has no session file");
  return {
    tmux: new TmuxClient(),
    cwd: ctx.cwd,
    sessionFile,
    env: process.env,
    busy: !ctx.isIdle(),
    notify: (message) => ctx.ui.notify(message, "info"),
    ompArgs: ompProcessArgs(),
  };
}

export async function runForkInTmux(ctx: HandlerCtx): Promise<void> {
  const { TMUX, TMUX_PANE } = ctx.env;
  if (!TMUX || !TMUX_PANE) {
    throw new Error(
      "fork-in-tmux: omp is not running inside tmux (TMUX/TMUX_PANE unset)",
    );
  }
  if (ctx.busy) {
    throw new Error(
      "fork-in-tmux: agent is busy — wait for the current turn to finish",
    );
  }

  ctx.notify("fork-in-tmux: creating fork copy…");
  const fork = await createForkCopy(ctx.sessionFile);

  try {
    const paneId = await ctx.tmux.splitPane({
      targetPane: TMUX_PANE,
      cwd: ctx.cwd,
      command: ["omp", ...ctx.ompArgs, "--resume", fork.newId],
    });
    ctx.notify(`fork-in-tmux: forked into ${paneId} (session ${fork.newId})`);
  } catch (err) {
    throw new Error(
      `fork-in-tmux: fork copy ${fork.newId} exists; start it manually in another tmux pane with: omp ${[...ctx.ompArgs, "--resume", fork.newId].join(" ")}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export function forkInTmux(pi: ExtensionApiLike): void {
  pi.registerCommand("fork-in-tmux", {
    description: "Pane-fork this conversation into a new tmux pane",
    handler: async (args, ctx) => {
      if (args.trim() !== "") {
        throw new Error("fork-in-tmux takes no arguments");
      }
      await runForkInTmux(handlerCtx(ctx));
    },
  });
}

export default forkInTmux;
