# fork-in-herdr

An omp extension whose `/fork-herdr` command tab-forks the current herdr tab: it forks the current omp conversation, then creates a new herdr tab and resumes the forked conversation in it.

Full design: see `CONTEXT.md` (glossary), `docs/adr/0001` (fork-mechanism decision), and [spec issue #1](https://github.com/onsails/omp-herdr-fork/issues/1).

## Install

Add the module path to omp's extension settings (`~/.omp/agent/config.yml`):

```yaml
extensions:
  - /home/wb/dev/os/omp-herdr-fork/src/index.ts
```

(omp loads explicit `.ts` entries directly; JSON settings use `"extensions": ["..."]`.)

## Use

Inside a herdr workspace tab running omp: type `/fork-herdr`. The command:

1. Refuses outside herdr (`HERDR_ENV` unset) or while the agent is mid-turn.
2. Creates a fork copy of the session (fresh id, `parentSession` = original, artifacts copied).
3. Creates a new herdr tab labeled `<original-label>f<n>` (e.g. `2` → `2f1`, next free number).
4. Starts omp in the new tab resumed at the fork copy's session id.

The original tab is never modified. If the tab is created but omp fails to start, the error names the session id — resume manually with `omp --resume <id>`.

## Develop

```sh
bun install
bun x tsc --noEmit   # typecheck
bun test             # unit suite (handler seam; no real herdr/omp)
```

Manual smoke checklist: inside a real herdr workspace run `/fork-herdr`; verify new tab label, original stays focused, transcript present in the forked tab; fork twice → `f2`; run outside herdr and mid-turn → both refusals.

Supported: session header version 3 (omp 17.2.x), herdr 0.8.x. The plugin fails loudly on other header versions.
