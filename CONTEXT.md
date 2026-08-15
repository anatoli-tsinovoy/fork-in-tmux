# fork-in-herdr

An omp plugin whose `/fork-herdr` command tab-forks the current herdr tab: it forks the current omp conversation, then creates a new herdr tab and resumes the forked conversation in it.

## Language

**Workspace**:
A herdr container of tabs; the outermost unit of the terminal workspace.
_Avoid_: session, window

**Tab**:
A herdr object that holds panes and has a user-visible string **label**. Identified as `<workspace-id>:t<n>`.
_Avoid_: window, omp session, "the fork" (as a noun for the tab itself)

**Pane**:
A single terminal surface inside a tab. A pane holds at most one recognized foreground process. Every tab has a root pane at creation.
_Avoid_: split, frame

**Agent**:
The recognized interactive process running inside a pane (omp, claude, …). An agent is not a pane: a pane exists with or without one.
_Avoid_: bot, assistant

**Label**:
The user-visible name string of a tab. Herdr defaults labels to tab numbers ("1", "2"). Labels are not documented as unique.

**Fork label**:
The new tab's label: original label with `f<n>` appended — `2` → `2f1`, `2f2`…; `2f1` → `2f1f1`. `<n>` counts existing forks of that tab. Always unique within the workspace.
_Avoid_: `-fork` suffix, `fork-2`, numbering the tabs themselves

**Tab-fork**:
Creating a new tab in the same workspace whose omp process resumes a forked copy of the original tab's conversation. The plugin's core operation.
_Avoid_: duplicating, cloning the tab, bare "fork"

**Conversation-fork**:
omp's built-in `/fork`: duplicates the current omp session transcript inside the *same* tab. A different concept from tab-fork; do not conflate.
_Avoid_: applying "fork" to both concepts without a qualifier

**Fork copy**:
The plugin-created session file: a copy of the original conversation's transcript with a fresh session id and `parentSession` pointing at the original. The new tab's omp resumes this file.
_Avoid_: clone, duplicate session

**Original tab**:
The tab where the tab-fork command runs. A tab-fork never modifies it.
