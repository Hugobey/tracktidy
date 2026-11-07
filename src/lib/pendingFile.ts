export type PendingImport = { file: File; extra: boolean };

let pending: PendingImport | null = null;

export function stashPending(next: PendingImport) {
  pending = next;
}

export function peekPending(): PendingImport | null {
  return pending;
}

export function clearPending() {
  pending = null;
}
