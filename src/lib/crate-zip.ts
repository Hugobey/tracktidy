import { zipSync } from 'fflate';

export function zipTracks(files: { name: string; bytes: Uint8Array }[]): Uint8Array {
  const entries: Record<string, Uint8Array> = {};
  const used = new Set<string>();
  for (const file of files) {
    let name = file.name.trim() || 'track.mp3';
    const key = name.toLowerCase();
    if (used.has(key)) {
      const dot = name.lastIndexOf('.');
      const stem = dot > 0 ? name.slice(0, dot) : name;
      const ext = dot > 0 ? name.slice(dot) : '.mp3';
      let index = 2;
      while (used.has(`${stem} (${index})${ext}`.toLowerCase())) index += 1;
      name = `${stem} (${index})${ext}`;
    }
    used.add(name.toLowerCase());
    entries[name] = file.bytes;
  }
  return zipSync(entries, { level: 0 });
}
