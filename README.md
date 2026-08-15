# fork-in-tmux

An omp extension that adds `/fork-in-tmux`: fork the current conversation into a new tmux pane. The new pane gets the full transcript and artifacts; the original pane keeps running and retains focus.

**Why:** omp's built-in `/fork` continues the current pane on the fork. A pane-fork keeps the original conversation in place and starts the divergent conversation beside it.

## Install

Requires omp 17.2.x and tmux 3.2 or newer.

```sh
omp plugin install https://github.com/anatoli-tsinovoy/fork-in-tmux
```

Omp links the plugin from git into `~/.omp/plugins`; `/fork-in-tmux` is then available in every session. Use `--scope project` to install only in the current project. Update later with `omp plugin upgrade`.

## Use

Run omp inside tmux, then type `/fork-in-tmux` with no arguments. The command:

1. Refuses when `TMUX` or `TMUX_PANE` is unset, or while the agent is mid-turn. No fork copy or pane is created.
2. Creates a fork copy of the current session with a fresh session id, `parentSession` pointing at the original, and a recursive copy of its artifact directory.
3. Splits the current tmux pane, preserving the working directory and focus, and starts `omp --resume <fork-id>` in the new pane.

The original pane is never modified. If the fork copy exists but tmux cannot create the pane, the error names the session id and the manual `omp --resume <id>` recovery command.

### Troubleshooting

- **"omp is not running inside tmux"** — start tmux, run omp in a pane, and invoke the command again.
- **"session has no transcript yet"** — omp writes the session file only after the first turn. Send a message first, then pane-fork.
- **"session header version N unsupported"** — the on-disk session format changed; the plugin pins header version 3.

## Develop

```sh
bun install
bun run typecheck
bun test
```

`omp plugin install /path/to/this/repo` links the local checkout for development. Tests exercise the registered-command seam with a fake tmux client and real temporary session files; domain vocabulary lives in `CONTEXT.md`, and the fork-copy mechanism decision lives in `docs/adr/0001-fork-by-plugin-side-session-copy.md`.
