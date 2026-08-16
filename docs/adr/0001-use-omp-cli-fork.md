# Use omp's CLI fork, not plugin-side session copies

`/fork-in-tmux` needs a history-carrying session fork in a new pane while leaving the
original pane untouched. Omp exposes exactly that startup operation as
`omp --fork <session-file>`: `createSessionManager()` resolves the source and delegates
to `SessionManager.forkFrom()`, which creates a fresh session with copied history and
lineage.

The extension therefore owns only pane orchestration. It passes the current absolute
session path to `omp --fork` in `tmux split-window`; it does not parse, rewrite, or copy
omp session files.

Rejected: invoking interactive `/fork` in the original process. That operation adopts
the fork in the original pane, which violates the pane-fork contract.

Rejected: copying JSONL and artifact directories in the extension. It preserves
artifacts, but duplicates omp's session-format logic and couples the extension to an
internal on-disk schema.

## Consequences

- Omp owns session ids, format migration, lineage, prompt-cache handling, and transcript
  persistence.
- The source session must have been persisted before the pane is created.
- Omp builds containing [oh-my-pi#8664](https://github.com/can1357/oh-my-pi/pull/8664)
  copy the source artifact directory in the CLI fork path, preserving historical
  `artifact://` references. Omp 17.3.4 predates that fix.
