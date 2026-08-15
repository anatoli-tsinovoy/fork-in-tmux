# fork-in-tmux

An omp plugin whose `/fork-in-tmux` command pane-forks the current conversation: it opens a new tmux pane and starts omp's built-in session fork there.

## Language

**Pane**:
A single terminal surface managed by tmux. The pane running the original omp process is identified by `TMUX_PANE`; the pane-fork creates a sibling in the same tmux window.
_Avoid_: tab, frame

**Agent**:
The omp process running inside a pane. An agent is not a pane: a pane exists with or without one.
_Avoid_: bot, assistant

**Pane-fork**:
Creating a new tmux pane whose omp process starts from a built-in fork of the original pane's conversation. The plugin's core operation.
_Avoid_: tab-fork, duplicating or cloning the pane, bare fork

**Conversation-fork**:
omp's built-in `/fork`: duplicates the current omp session transcript inside the same pane. A different concept from pane-fork; do not conflate.
_Avoid_: applying "fork" to both concepts without a qualifier

**Session fork**:
The new session created by `omp --fork <source-session>`, with a fresh session id and `parentSession` pointing at the original. The extension delegates session semantics to omp.
_Avoid_: plugin-created copy, clone

**Original pane**:
The pane where the pane-fork command runs. A pane-fork never modifies or changes focus away from it.
