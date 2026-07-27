// src/version.ts — pure version-string comparison (no native imports, so the
// kill-switch logic is unit-testable without mocking the RN runtime).

/** "1.2.10" vs "1.2.9" → 1. Missing segments count as 0. */
export function cmpVersions(a: string, b: string): number {
  const pa = a.split('.').map(n => parseInt(n, 10) || 0);
  const pb = b.split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}
