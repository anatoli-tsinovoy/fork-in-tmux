import { cp, exists, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const SUPPORTED_HEADER_VERSION = 3;

export interface ForkCopy {
  /** Absolute path of the fork copy JSONL (inside the original's session dir). */
  file: string;
  /** The fork copy's fresh session id (UUIDv7, omp-native format). */
  newId: string;
  /** The original session's id, recorded as the fork copy's parentSession. */
  parentSession: string;
  /** Absolute path of the copied artifact directory, or null if the original had none. */
  artifactDir: string | null;
}

interface SessionHeader {
  type: "session";
  version: number;
  id: string;
  cwd: string;
  parentSession: string | null;
  providerPromptCacheKey?: string;
  [key: string]: unknown;
}

/**
 * Creates the fork copy of a session file (ADR-0001): a new JSONL in the
 * same session directory whose header (line 2) carries a fresh UUIDv7 id,
 * parentSession = the original id, and no prompt-cache key; every other
 * line is byte-identical. The sibling artifact directory is copied
 * recursively when present, so artifact:// references keep resolving.
 */
export async function createForkCopy(sessionFile: string): Promise<ForkCopy> {
  const file = Bun.file(sessionFile);
  if (!(await file.exists())) {
    throw new Error(
      `fork-in-tmux: session has no transcript yet — omp writes the session file on the first turn; send a message before forking (${sessionFile})`,
    );
  }
  const text = await file.text();
  const lines = text.split("\n");
  // Files end with a trailing newline; an empty final element is not a line.
  if (lines.at(-1) === "") lines.pop();

  const headerLine = lines[1];
  if (headerLine === undefined) {
    throw new Error(
      `fork-in-tmux: session file has no session header on line 2: ${sessionFile}`,
    );
  }
  let header: SessionHeader;
  try {
    header = JSON.parse(headerLine) as SessionHeader;
  } catch {
    throw new Error(
      `fork-in-tmux: session header on line 2 is not JSON: ${sessionFile}`,
    );
  }
  if (header.type !== "session") {
    throw new Error(
      `fork-in-tmux: session header is not on line 2 (found ${header.type}): ${sessionFile}`,
    );
  }
  if (header.version !== SUPPORTED_HEADER_VERSION) {
    throw new Error(
      `fork-in-tmux: session header version ${String(header.version)} unsupported (expected ${SUPPORTED_HEADER_VERSION}): ${sessionFile}`,
    );
  }
  if (typeof header.id !== "string" || header.id === "") {
    throw new Error(
      `fork-in-tmux: session header has no session id: ${sessionFile}`,
    );
  }
  const newId = Bun.randomUUIDv7();
  const { providerPromptCacheKey: _drop, ...rest } = header;
  const newHeader: SessionHeader = {
    ...rest,
    id: newId,
    parentSession: header.id,
  };

  const dir = dirname(sessionFile);
  const newFile = join(
    dir,
    `${new Date().toISOString().replace(/[:.]/g, "-").slice(0, -1)}_${newId}.jsonl`,
  );
  const content =
    [lines[0] ?? "", JSON.stringify(newHeader), ...lines.slice(2)].join("\n") +
    "\n";
  await mkdir(dir, { recursive: true });
  await writeFile(newFile, content, { flag: "wx" });

  const originalArtifactDir = sessionFile.slice(0, -".jsonl".length);
  let artifactDir: string | null = null;
  if (await exists(originalArtifactDir)) {
    artifactDir = newFile.slice(0, -".jsonl".length);
    await cp(originalArtifactDir, artifactDir, { recursive: true });
  }

  return { file: newFile, newId, parentSession: header.id, artifactDir };
}
