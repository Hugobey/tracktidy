let waiting: File[] = [];
const listeners = new Set<() => void>();

export function offerCrateFiles(files: File[]): void {
  if (files.length === 0) return;
  waiting = files;
  for (const listener of listeners) listener();
}

export function takeCrateFiles(): File[] {
  const next = waiting;
  waiting = [];
  return next;
}

export function onCrateFiles(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
