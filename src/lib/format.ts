// Shared formatting helpers. Place at src/lib/format.ts
// Used by Dashboard.tsx, ForensicPanel.tsx and reportDocx.ts so the same
// number always renders the same way everywhere.

export const fmtCr = (v: number | null | undefined): string => {
  if (v == null || isNaN(Number(v))) return '—';
  const n = Number(v);
  const sign = n < 0 ? '-' : '';
  const a = Math.abs(n);
  if (a >= 100000) return `${sign}₹${(a / 100000).toFixed(2)}L Cr`;
  if (a >= 1000)   return `${sign}₹${(a / 1000).toFixed(1)}K Cr`;
  return `${sign}₹${a.toFixed(1)} Cr`;
};

export const fmtPct = (v: number | null | undefined, d = 1): string =>
  v == null || isNaN(Number(v)) ? '—' : `${Number(v).toFixed(d)}%`;

export const fmtInt = (v: number | null | undefined): string =>
  v == null || isNaN(Number(v)) ? '—' : Number(v).toLocaleString('en-IN', { maximumFractionDigits: 0 });

/**
 * Format a ratio value based on what its KEY implies, so percentages, ₹-Crore
 * amounts, day-counts and multiples don't all render as a bare 2-dp number.
 */
export function fmtRatio(key: string, v: number | null | undefined): string {
  if (v == null || isNaN(Number(v))) return '—';
  const n = Number(v);
  const k = key.toLowerCase();

  if (k.includes('%')) return `${n.toFixed(2)}%`;
  if (k.includes('(cr)')) return fmtCr(n);
  if (k.includes('day')) return `${n.toFixed(0)} days`;
  if (k.includes('(₹)') || k.includes('per unit')) return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  if (
    k.includes('(x)') || k.includes('/ebitda') || k.includes('cfo/pat') ||
    k.includes('debt/equity') || k.includes('coverage')
  ) return `${n.toFixed(2)}x`;

  return n.toFixed(2);
}
