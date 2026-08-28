export function fmtAmount(n: number): string {
  const v = Math.floor(n);
  const abs = Math.abs(v);
  if (abs < 1_000) return String(v);
  const units: [number, string][] = [
    [1e12, 'T'],
    [1e9, 'B'],
    [1e6, 'M'],
    [1e3, 'K'],
  ];
  for (const [base, suffix] of units) {
    if (abs >= base) {
      const scaled = v / base;
      const digits = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
      return `${scaled.toFixed(digits)}${suffix}`;
    }
  }
  return String(v);
}

export function fmtRate(n: number): string {
  const abs = Math.abs(n);
  if (abs < 10) return `${Math.round(n * 100) / 100}`;
  return fmtAmount(Math.round(n));
}

export function fmtDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m >= 1) return `${m}m`;
  return `${Math.max(1, Math.floor(ms / 1000))}s`;
}