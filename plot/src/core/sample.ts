/**
 * Turning functions into ink: adaptive sampling, clipping and simplifying.
 *
 * A curve is a map t -> page pixel. We sample it on a coarse grid, then split
 * each interval until the midpoint sits within a fraction of a pixel of the
 * chord. Where the curve jumps (tan x at pi/2, 1/x at 0) the split never
 * converges; at the depth limit we lift the pen instead of drawing a false
 * vertical line. Then each piece is clipped to the plot box and simplified,
 * because every point we keep is a point the tablet has to store.
 */
import { Pt, Rect, finite, dist } from './types';

export interface SampleOpts {
  /** Initial uniform samples. */
  n?: number;
  /** Maximum bisection depth per interval. */
  depth?: number;
  /** Allowed distance (px) between the curve and the chord. */
  tol?: number;
  /** A gap larger than this (px) at full depth is a discontinuity. */
  jump?: number;
}

const BIG = 1e7;
const clampPt = (p: Pt): Pt => [Math.max(-BIG, Math.min(BIG, p[0])), Math.max(-BIG, Math.min(BIG, p[1]))];

/** Which side of the (padded) box a point is on, as bit flags; 0 = inside. */
function outcode(p: Pt, b: Rect, pad: number): number {
  let c = 0;
  if (p[0] < b.left - pad) c |= 1; else if (p[0] > b.right + pad) c |= 2;
  if (p[1] < b.top - pad) c |= 4; else if (p[1] > b.bottom + pad) c |= 8;
  return c;
}

/** Sample a curve, returning polylines in page pixels (not yet clipped). */
export function sampleCurve(P: (t: number) => Pt | null, t0: number, t1: number, box: Rect, o: SampleOpts = {}): Pt[][] {
  const n = o.n ?? 240, maxDepth = o.depth ?? 11, tol = o.tol ?? 0.35;
  const pad = Math.max(box.right - box.left, box.bottom - box.top) * 0.1;
  // At full depth neighbouring samples are a tiny fraction of a pixel apart in t,
  // so any visible gap is a real jump.
  const jump = o.jump ?? 3;
  const maxSeg = Math.max(box.right - box.left, box.bottom - box.top) * 0.25;
  const polys: Pt[][] = [];
  let cur: Pt[] = [];
  const flush = () => { if (cur.length > 1) polys.push(cur); cur = []; };
  const emit = (p: Pt) => { const q = clampPt(p); const last = cur[cur.length - 1]; if (!last || last[0] !== q[0] || last[1] !== q[1]) cur.push(q); };
  const ev = (t: number): Pt | null => { try { const p = P(t); return finite(p) ? p : null; } catch { return null; } };

  const refine = (ta: number, pa: Pt | null, tb: number, pb: Pt | null, d: number): void => {
    if (!pa && !pb) {
      // Both ends undefined. Peek inside once, at coarse depth, for islands.
      if (d < 3) { const tm = (ta + tb) / 2, pm = ev(tm); if (pm) { refine(ta, pa, tm, pm, d + 1); refine(tm, pm, tb, pb, d + 1); return; } }
      flush(); return;
    }
    if (d >= maxDepth) {
      if (pa && pb) {
        const ca = outcode(pa, box, pad), cb = outcode(pb, box, pad);
        if (dist(pa, pb) <= jump || (ca & cb) !== 0) emit(pb);
        else { flush(); emit(pb); }
      } else if (pb) { flush(); emit(pb); }
      else flush();
      return;
    }
    const tm = (ta + tb) / 2, pm = ev(tm);
    if (!pa || !pb || !pm) { refine(ta, pa, tm, pm, d + 1); refine(tm, pm, tb, pb, d + 1); return; }
    const ca = outcode(pa, box, pad), cm = outcode(pm, box, pad), cb = outcode(pb, box, pad);
    if ((ca & cm & cb) !== 0 && d >= 2) { emit(pb); return; } // all off the same side: invisible anyway
    const dev = chordDistance(pm, pa, pb);
    // A short, flat chord is drawn as is. A long chord is split even when it
    // looks flat: near an asymptote the midpoint can sit on a chord that
    // spans the whole screen.
    // The midpoint of a smooth piece also lands near the middle of the chord;
    // at a jump it stays next to one end, however flat things look.
    const L = dist(pa, pb);
    const mid = L < 0.5 || Math.abs(projection(pm, pa, pb) - 0.5) < 0.3;
    if (dev <= tol && d >= 1 && L <= maxSeg && mid) { emit(pb); return; }
    refine(ta, pa, tm, pm, d + 1);
    refine(tm, pm, tb, pb, d + 1);
  };

  // Shift interior samples off "round" values so x = 0 is not hit exactly.
  const ts: number[] = [];
  for (let i = 0; i <= n; i++) ts.push(i === 0 || i === n ? t0 + (t1 - t0) * (i / n) : t0 + (t1 - t0) * ((i + 0.0137) / n));
  let pa = ev(ts[0]);
  if (pa) emit(pa);
  for (let i = 1; i < ts.length; i++) {
    const pb = ev(ts[i]);
    refine(ts[i - 1], pa, ts[i], pb, 0);
    pa = pb;
  }
  flush();
  return polys;
}

function chordDistance(p: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const L = Math.hypot(dx, dy);
  if (L < 1e-9) return dist(p, a);
  return Math.abs((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) / L;
}

function projection(p: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const L2 = dx * dx + dy * dy;
  return L2 < 1e-12 ? 0.5 : ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2;
}

/** Liang-Barsky: clip segment ab to the box. Returns [t0, t1] or null. */
function clipSeg(a: Pt, b: Pt, r: Rect): [number, number] | null {
  let t0 = 0, t1 = 1;
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const p = [-dx, dx, -dy, dy];
  const q = [a[0] - r.left, r.right - a[0], a[1] - r.top, r.bottom - a[1]];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) { if (q[i] < 0) return null; continue; }
    const t = q[i] / p[i];
    if (p[i] < 0) { if (t > t1) return null; if (t > t0) t0 = t; }
    else { if (t < t0) return null; if (t < t1) t1 = t; }
  }
  return [t0, t1];
}

const lerp = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

/** Clip polylines to a box; a polyline that leaves and re-enters becomes two. */
export function clipPolylines(polys: Pt[][], r: Rect): Pt[][] {
  const out: Pt[][] = [];
  for (const poly of polys) {
    let cur: Pt[] = [];
    for (let i = 1; i < poly.length; i++) {
      const a = poly[i - 1], b = poly[i];
      const c = clipSeg(a, b, r);
      if (!c) { if (cur.length > 1) out.push(cur); cur = []; continue; }
      const pa = c[0] > 0 ? lerp(a, b, c[0]) : a;
      const pb = c[1] < 1 ? lerp(a, b, c[1]) : b;
      if (c[0] > 0 || cur.length === 0) { if (cur.length > 1) out.push(cur); cur = [pa]; }
      cur.push(pb);
      if (c[1] < 1) { out.push(cur); cur = []; }
    }
    if (cur.length > 1) out.push(cur);
  }
  return out.filter((p) => p.length > 1);
}

/** Ramer-Douglas-Peucker, iterative. */
export function simplify(pts: Pt[], tol: number): Pt[] {
  if (pts.length < 3) return pts.slice();
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [i, j] = stack.pop()!;
    let best = -1, bd = tol;
    for (let k = i + 1; k < j; k++) {
      const d = chordDistance(pts[k], pts[i], pts[j]);
      if (d > bd) { bd = d; best = k; }
    }
    if (best >= 0) { keep[best] = 1; stack.push([i, best], [best, j]); }
  }
  return pts.filter((_, k) => keep[k]);
}

/** Split long polylines so no single pen stroke carries too many points. */
export function chunk(pts: Pt[], max: number): Pt[][] {
  if (pts.length <= max) return [pts];
  const out: Pt[][] = [];
  for (let i = 0; i < pts.length - 1; i += max - 1) out.push(pts.slice(i, Math.min(pts.length, i + max)));
  return out.filter((p) => p.length > 1);
}

/** Sample, clip and simplify in one go. */
export function trace(P: (t: number) => Pt | null, t0: number, t1: number, box: Rect, o: SampleOpts & { simplifyTol?: number } = {}): Pt[][] {
  const raw = sampleCurve(P, t0, t1, box, o);
  return clipPolylines(raw, box).map((p) => simplify(p, o.simplifyTol ?? 0.4)).filter((p) => p.length > 1);
}
