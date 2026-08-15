/**
 * Computes the fork label for a tab: original label with `f<n>` appended,
 * where <n> is the smallest positive integer whose candidate label is not
 * already taken by an existing tab. Forking a fork nests by the same rule.
 */
export function forkLabel(original: string, existingLabels: readonly string[]): string {
  let n = 1;
  while (existingLabels.includes(`${original}f${n}`)) {
    n++;
  }
  return `${original}f${n}`;
}
