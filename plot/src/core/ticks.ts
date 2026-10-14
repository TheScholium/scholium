/** Tick marks: "nice" steps (1, 2, 5 x 10^k) and multiples of pi. */

export interface Tick { v: number; label: string; }

export function niceStep(span: number, target: number): number {
  const raw = Math.abs(span) / Math.max(1, target);
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const m = raw / p;
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
}

/** Format a tick value with no float noise: 0.30000000000000004 -> "0.3". */
export function fmt(v: number, step: number): string {
  if (Math.abs(v) < step * 1e-6) return '0';
  const dec = Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
  let s = v.toFixed(Math.min(dec, 8));
  if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
  if (Math.abs(v) >= 1e6 || (Math.abs(v) < 1e-4 && v !== 0)) s = v.toExponential(1).replace('e+', 'e');
  return s;
}

export function ticks(min: number, max: number, target = 8): Tick[] {
  const step = niceStep(max - min, target);
  const out: Tick[] = [];
  const first = Math.ceil(min / step - 1e-9);
  for (let i = first; i * step <= max + step * 1e-9; i++) {
    const v = i * step;
    out.push({ v: Math.abs(v) < step * 1e-9 ? 0 : v, label: fmt(v, step) });
    if (out.length > 200) break;
  }
  return out;
}

function gcd(a: number, b: number): number { return b ? gcd(b, a % b) : Math.abs(a); }

/** "π/2", "-3π/4", "2π". */
export function piLabel(num: number, den: number): string {
  if (num === 0) return '0';
  const g = gcd(num, den); num /= g; den /= g;
  const sign = num < 0 ? '-' : '';
  const n = Math.abs(num);
  const top = (n === 1 ? '' : String(n)) + 'π';
  return sign + (den === 1 ? top : `${top}/${den}`);
}

/** Ticks at multiples of pi/d, with d chosen so there are about `target` of them. */
export function piTicks(min: number, max: number, target = 8): Tick[] {
  const span = (max - min) / Math.PI;
  const options = [12, 6, 4, 2, 1, 0.5, 0.25];
  let den = 1;
  for (const d of options) { den = d; if (span * d <= target * 1.3) break; }
  if (den < 1) {
    // big ranges: steps of 2pi, 4pi
    const k = 1 / den;
    const out: Tick[] = [];
    for (let i = Math.ceil(min / (k * Math.PI) - 1e-9); i * k * Math.PI <= max + 1e-9; i++) out.push({ v: i * k * Math.PI, label: piLabel(i * k, 1) });
    return out;
  }
  const out: Tick[] = [];
  for (let i = Math.ceil((min * den) / Math.PI - 1e-9); (i * Math.PI) / den <= max + 1e-9; i++) out.push({ v: (i * Math.PI) / den, label: piLabel(i, den) });
  return out;
}
