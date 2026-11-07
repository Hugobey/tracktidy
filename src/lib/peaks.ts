export function decorativePeaks(count: number): number[] {
  return Array.from({ length: count }, (_, index) => {
    const t = index / Math.max(1, count - 1);
    const value =
      0.2 +
      0.36 * Math.abs(Math.sin(t * Math.PI * 5.2)) +
      0.22 * Math.abs(Math.sin(t * Math.PI * 12.5 + 0.5)) +
      0.14 * Math.abs(Math.sin(t * Math.PI * 27));
    return Math.min(1, value);
  });
}
