type DirReader = { readEntries: (ok: (entries: FileSystemEntry[]) => void, err?: (error: DOMException) => void) => void };

function readEntries(reader: DirReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => {
    const all: FileSystemEntry[] = [];
    const pull = () => {
      reader.readEntries((batch) => {
        if (batch.length === 0 || all.length > 500) {
          resolve(all);
          return;
        }
        all.push(...batch);
        pull();
      }, reject);
    };
    pull();
  });
}

async function walk(entry: FileSystemEntry, into: File[]): Promise<void> {
  if (entry.isFile) {
    const fileEntry = entry as FileSystemFileEntry;
    const file = await new Promise<File>((resolve, reject) => fileEntry.file(resolve, reject));
    into.push(file);
    return;
  }
  if (!entry.isDirectory) return;
  const reader = (entry as FileSystemDirectoryEntry).createReader();
  const children = await readEntries(reader);
  for (const child of children) await walk(child, into);
}

/** Files from a drop, including a folder dropped from the desktop. */
export async function filesFromDrop(transfer: DataTransfer): Promise<File[]> {
  const entries = [...transfer.items]
    .map((item) => item.webkitGetAsEntry())
    .filter((entry): entry is FileSystemEntry => Boolean(entry));
  if (entries.length === 0) return [...transfer.files];
  const files: File[] = [];
  for (const entry of entries) await walk(entry, files);
  return files.length > 0 ? files : [...transfer.files];
}
