import { describe, expect, it } from "bun:test";
import { processRunner, TmuxClient, type Runner } from "../src/tmux-client";

function clientWith(stdout = "%9\n") {
  const seen: string[][] = [];
  const runner: Runner = {
    run: async (argv) => {
      seen.push([...argv]);
      return stdout;
    },
  };
  return { client: new TmuxClient(runner), seen };
}

describe("tmux client", () => {
  it("splits the current pane without changing focus and starts the supplied command", async () => {
    const { client, seen } = clientWith();
    const paneId = await client.splitPane({
      targetPane: "%4",
      cwd: "/repo with spaces",
      command: [
        "omp",
        "--profile",
        "work profile",
        "--fork",
        "/sessions/current.jsonl",
      ],
    });
    expect(paneId).toBe("%9");
    expect(seen).toEqual([
      [
        "split-window",
        "-d",
        "-c",
        "/repo with spaces",
        "-t",
        "%4",
        "-P",
        "-F",
        "#{pane_id}",
        "--",
        "omp",
        "--profile",
        "work profile",
        "--fork",
        "/sessions/current.jsonl",
      ],
    ]);
  });

  it("fails loudly when tmux returns no pane id", async () => {
    const { client } = clientWith("");
    await expect(
      client.splitPane({ targetPane: "%4", cwd: "/repo", command: ["omp"] }),
    ).rejects.toThrow(/no pane id/);
  });

  it("propagates runner failures", async () => {
    const runner: Runner = {
      run: async () => {
        throw new Error(
          "tmux split-window failed (exit 1): no space for new pane",
        );
      },
    };
    await expect(
      new TmuxClient(runner).splitPane({
        targetPane: "%4",
        cwd: "/repo",
        command: ["omp"],
      }),
    ).rejects.toThrow(/no space for new pane/);
  });

  it("processRunner surfaces exit code and stderr", async () => {
    await expect(
      processRunner.run(["definitely-not-a-tmux-command"]),
    ).rejects.toThrow(/exit \d+/);
  });
});
