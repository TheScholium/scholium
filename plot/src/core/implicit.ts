/**
 * Implicit curves F(x, y) = 0 by marching squares.
 *
 * The grid is sampled once; each cell edge with a sign change gets a root,
 * found by bisection on the real function rather than linear interpolation,
 * so circles come out round even on a coarse grid. A sign change can also be
 * a pole (tan x = y, 1/x = y): if |F| at the "root" is not small compared
 * with the corners, the crossing is thrown away. Segments are then joined
 * into polylines through shared edge ids.
 */
import { Pt } from './types';

export interface Grid { x0: number; x1: number; y0: number; y1: number; nx: number; ny: number; }

export function marchingSquares(F: (x: number, y: number) => number, g: Grid): Pt[][] {
  const { x0, x1, y0, y1, nx, ny } = g;
  const dx = (x1 - x0) / nx, dy = (y1 - y0) / ny;
  // nudge the grid so exact zeros on grid lines are rare
  const ox = dx * 0.0071, oy = dy * 0.0053;
  const X = (i: number) => x0 + i * dx + ox, Y = (j: number) => y0 + j * dy + oy;
  const safe = (x: number, y: number) => { try { const v = F(x, y); return Number.isFinite(v) ? v : NaN; } catch { return NaN; } };
  const v = new Float64Array((nx + 1) * (ny + 1));
  const at = (i: number, j: number) => v[j * (nx + 1) + i];
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) v[j * (nx + 1) + i] = safe(X(i), Y(j));

  // Edge ids: horizontal edge (i,j)-(i+1,j) = 2*(j*(nx+1)+i), vertical (i,j)-(i,j+1) = that + 1
  const roots = new Map<number, Pt | null>();
  const edgeRoot = (i: number, j: number, horiz: boolean): Pt | null => {
    const id = 2 * (j * (nx + 1) + i) + (horiz ? 0 : 1);
    if (roots.has(id)) return roots.get(id)!;
    let ax = X(i), ay = Y(j), bx = horiz ? X(i + 1) : ax, by = horiz ? ay : Y(j + 1);
    let fa = at(i, j), fb = horiz ? at(i + 1, j) : at(i, j + 1);
    const scale = Math.max(Math.abs(fa), Math.abs(fb));
    for (let k = 0; k < 18; k++) {
      const mx = (ax + bx) / 2, my = (ay + by) / 2, fm = safe(mx, my);
      if (Number.isNaN(fm)) break;
      if ((fm < 0) === (fa < 0)) { ax = mx; ay = my; fa = fm; } else { bx = mx; by = my; fb = fm; }
    }
    const fr = Math.min(Math.abs(fa), Math.abs(fb));
    // a pole: the function is huge right where the sign flips
    const r: Pt | null = fr > Math.max(1e-6, scale) * 0.5 && fr > 1e-3 ? null : [(ax + bx) / 2, (ay + by) / 2];
    roots.set(id, r);
    return r;
  };
  const eid = (i: number, j: number, horiz: boolean) => 2 * (j * (nx + 1) + i) + (horiz ? 0 : 1);

  const segs: [number, number][] = [];
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const a = at(i, j), b = at(i + 1, j), c = at(i + 1, j + 1), d = at(i, j + 1);
      if ([a, b, c, d].some(Number.isNaN)) continue;
      // corners: a=(i,j) b=(i+1,j) c=(i+1,j+1) d=(i,j+1); edges: bottom, right, top, left
      const E = [eid(i, j, true), eid(i + 1, j, false), eid(i, j + 1, true), eid(i, j, false)];
      const crosses = [(a < 0) !== (b < 0), (b < 0) !== (c < 0), (c < 0) !== (d < 0), (d < 0) !== (a < 0)];
      const live = [0, 1, 2, 3].filter((k) => crosses[k]);
      if (live.length === 2) segs.push([E[live[0]], E[live[1]]]);
      else if (live.length === 4) {
        // saddle: decide by the centre value
        const m = safe((X(i) + X(i + 1)) / 2, (Y(j) + Y(j + 1)) / 2);
        if ((m < 0) === (a < 0)) { segs.push([E[0], E[1]], [E[2], E[3]]); }
        else { segs.push([E[0], E[3]], [E[1], E[2]]); }
      }
    }
  }
  // Resolve roots; drop segments that touch a pole.
  const pt = new Map<number, Pt>();
  const good: [number, number][] = [];
  for (const [p, q] of segs) {
    const rp = rootFor(p), rq = rootFor(q);
    if (rp && rq) { pt.set(p, rp); pt.set(q, rq); good.push([p, q]); }
  }
  function rootFor(id: number): Pt | null {
    const horiz = id % 2 === 0;
    const k = (id - (horiz ? 0 : 1)) / 2;
    const j = Math.floor(k / (nx + 1)), i = k % (nx + 1);
    return edgeRoot(i, j, horiz);
  }
  // Join segments through shared edges.
  const adj = new Map<number, number[]>();
  good.forEach(([p, q], s) => {
    (adj.get(p) ?? adj.set(p, []).get(p)!).push(s);
    (adj.get(q) ?? adj.set(q, []).get(q)!).push(s);
  });
  const used = new Uint8Array(good.length);
  const out: Pt[][] = [];
  const walk = (start: number, from: number): number[] => {
    const chain: number[] = [from];
    let node = from, s = start;
    for (;;) {
      used[s] = 1;
      const [p, q] = good[s];
      node = p === node ? q : p;
      chain.push(node);
      const next = (adj.get(node) ?? []).find((t) => !used[t]);
      if (next === undefined) return chain;
      s = next;
    }
  };
  // open chains first (start at an end with one segment), then loops
  for (const pass of [0, 1]) {
    for (let s = 0; s < good.length; s++) {
      if (used[s]) continue;
      const [p, q] = good[s];
      if (pass === 0) {
        const ep = (adj.get(p) ?? []).length === 1, eq = (adj.get(q) ?? []).length === 1;
        if (!ep && !eq) continue;
        out.push(walk(s, ep ? p : q).map((id) => pt.get(id)!));
      } else {
        out.push(walk(s, p).map((id) => pt.get(id)!));
      }
    }
  }
  return out.filter((c) => c.length > 1);
}
