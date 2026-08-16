# omp-fork-in-tmux

An omp extension that adds `/fork-in-tmux`: fork the current conversation into a new tmux pane while the original pane keeps running and retains focus.

**Why:** omp's interactive `/fork` continues the current pane on the fork. This extension starts omp's built-in CLI fork in a sibling pane instead.

## Install

Requires tmux 3.2 or newer and an omp build containing [oh-my-pi#8664](https://github.com/can1357/oh-my-pi/pull/8664). Omp 17.3.4 predates the artifact-copy fix.

```sh
omp plugin install https://github.com/anatoli-tsinovoy/omp-fork-in-tmux
```

Omp links the plugin from git into `~/.omp/plugins`; `/fork-in-tmux` is then available in every session. Use `--scope project` to install only in the current project. Update later with `omp plugin upgrade`.

## Use

Run omp inside tmux, then type `/fork-in-tmux` with no arguments. The command:

1. Refuses when `TMUX` or `TMUX_PANE` is unset, while the agent is mid-turn, or before omp has persisted the first transcript entry.
2. Splits the current tmux pane, preserving the working directory and focus.
3. Starts `omp [--profile …] [--config …] --fork <current-session-file>` in the new pane. Explicit profile and config overlays are forwarded; ordinary global, profile, and project config is rediscovered by omp from the same profile and working directory.

The original pane and session are never modified. Omp owns the forked transcript, lineage, prompt-cache state, and artifact copy.

### Troubleshooting

- **"omp is not running inside tmux"** — start tmux, run omp in a pane, and invoke the command again.
- **"session has no transcript yet"** — omp writes the session file only after the first turn. Send a message first, then pane-fork.
- **Historical `artifact://` references do not resolve in the new pane** — upgrade from omp 17.3.4 to a build containing [oh-my-pi#8664](https://github.com/can1357/oh-my-pi/pull/8664).

## Develop

```sh
bun install
bun run typecheck
bun test
```

`omp plugin install /path/to/this/repo` links the local checkout for development. Tests exercise the registered-command seam with a fake tmux client; domain vocabulary lives in `CONTEXT.md`, and the fork-mechanism decision lives in `docs/adr/0001-use-omp-cli-fork.md`.
