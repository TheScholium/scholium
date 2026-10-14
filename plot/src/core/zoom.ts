/**
 * Auto zoom: choose a window that shows what is interesting about the curves.
 *
 * For y = f(x) the interesting things are features: zeros, turning points,
 * inflection points, poles and the ends of the domain. We look for them over
 * a wide range, keep the ones nearest the origin (a periodic function has
 * infinitely many), and frame those. The y range then comes from the curve
 * over that window, ignoring the spikes next to poles.
 *
 * Closed curves (circles, roses, ellipses) are framed by their bounding box;
 * open implicit curves (hyperbolas) by how close they come to the origin.
 * Windows for these are widened so that one unit is the same length on both
 * axes, otherwise a circle would come out as an ellipse.
 */
import { Fn, Spec } from './expr';
import { parseLines } from './figure';
import { marchingSquares } from './implicit';
import { niceStep } from './ticks';

export interface Window { x: [number, number]; y: [number, number]; /** x ends are multiples of pi/2 */ pi: boolean; }

const SEARCH = 60;          // look for features in [-SEARCH, SEARCH]
const SAMPLES = 6000;
const KEEP = 5;             // frame the KEEP nearest feature distances of a periodic curve
const TRIG = /(sin|cos|tan|sec|csc|cot)/;

/** x positions where something happens to y = f(x). */
export function features(f: Fn, a = -SEARCH, b = SEARCH, n = SAMPLES): { x: number[]; poles: number[] } {
  const xs: number[] = [], ys: number[] = [];
  for (let i = 0; i <= n; i++) {
    const x = a + ((b - a) * (i + 0.0137)) / n;
    let y: number;
    try { y = f({ x }); } catch { y = NaN; }
    xs.push(x); ys.push(Number.isFinite(y) ? y : NaN);
  }
  const out: number[] = [], poles: number[] = [];
  const h = (b - a) / n;
  // typical size of a step, to tell a pole from a steep but smooth stretch
  const steps = ys.slice(1).map((y, i) => Math.abs(y - ys[i])).filter(Number.isFinite).sort((p, q) => p - q);
  const typical = steps.length ? steps[Math.floor(steps.length * 0.9)] : 1;
  for (let i = 1; i < xs.length; i++) {
    const y0 = ys[i - 1], y1 = ys[i];
    const d0 = Number.isNaN(y0), d1 = Number.isNaN(y1);
    if (d0 !== d1) { out.push(d0 ? xs[i] : xs[i - 1]); continue; }            // edge of the domain
    if (d0) continue;
    const jump = Math.abs(y1 - y0);
    if (jump > 50 * typical + 1e-9 && jump > 1 && isJump(f, xs[i - 1], xs[i])) { poles.push((xs[i] + xs[i - 1]) / 2); continue; }
    if ((y0 < 0) !== (y1 < 0) || y1 === 0) out.push((xs[i] + xs[i - 1]) / 2);  // zero
    if (i >= 2 && !Number.isNaN(ys[i - 2])) {
      const s0 = y0 - ys[i - 2], s1 = y1 - y0;
      if (s0 * s1 < 0) out.push(xs[i - 1]);                                     // turning point
      if (i >= 3 && !Number.isNaN(ys[i - 3])) {
        const c0 = s0 - (ys[i - 2] - ys[i - 3]), c1 = s1 - s0;
        const noise = 1e-9 * Math.max(1, Math.abs(y1));
        if (c0 * c1 < 0 && Math.abs(c0) > noise && Math.abs(c1) > noise) out.push(xs[i - 1]); // inflection
      }
    }
  }
  void h;
  return { x: dedupe(out, (b - a) / n * 3), poles: dedupe(poles, (b - a) / n * 3) };
}

/**
 * A big step between samples is either a real jump (a pole, a step) or just
 * a steep stretch, like e^x far out. Halve the interval, keeping the half
 * with the bigger step: a steep stretch flattens out, a jump does not.
 */
function isJump(f: Fn, a: number, b: number): boolean {
  const v = (x: number) => { try { return f({ x }); } catch { return NaN; } };
  let fa = v(a), fb = v(b);
  for (let k = 0; k < 40; k++) {
    const m = (a + b) / 2, fm = v(m);
    if (!Number.isFinite(fm)) return true;
    if (Math.abs(fm - fa) > Math.abs(fb - fm)) { b = m; fb = fm; } else { a = m; fa = fm; }
  }
  return Math.abs(fb - fa) > 1e-6 * Math.max(1, Math.abs(fa), Math.abs(fb));
}

function dedupe(v: number[], eps: number): number[] {
  const s = [...v].sort((p, q) => p - q);
  return s.filter((x, i) => i === 0 || x - s[i - 1] > eps);
}

/** Round a range outward to tidy ends. */
function tidy(lo: number, hi: number, pi: boolean): [number, number] {
  if (pi) {
    const q = Math.PI / 2;
    // features are found on a grid, so allow them to sit a hair past a tidy end
    return [Math.floor(lo / q + 0.03) * q, Math.ceil(hi / q - 0.03) * q];
  }
  const st = niceStep(hi - lo, 10);
  return [Math.floor(lo / st + 0.01) * st, Math.ceil(hi / st - 0.01) * st];
}

/** The x window for one y = f(x). */
function xWindowFor(f: Fn): [number, number] {
  const { x, poles } = features(f);
  const all = [...x, ...poles];
  if (!all.length) return [-5, 5];
  let pts = all;
  if (all.length > 12) {
    // periodic or wiggly: frame the features nearest the origin, counting
    // each distance once (sin x has features at both +pi/2 and -pi/2)
    const dists = dedupe(all.map(Math.abs), 1e-3);
    const R = dists[Math.min(KEEP, dists.length) - 1];
    return [-R, R];
  }
  let lo = Math.min(...pts), hi = Math.max(...pts);
  const span = hi - lo;
  // keep the y axis in view when the features are not far from it
  if (lo > 0 && lo < 1.5 * Math.max(span, 2)) lo = 0;
  if (hi < 0 && -hi < 1.5 * Math.max(span, 2)) hi = 0;
  const pad = Math.max((hi - lo) * 0.4, 1.5);
  lo -= pad; hi += pad;
  if (hi - lo < 4) { const c = (lo + hi) / 2; lo = c - 2; hi = c + 2; }
  return [lo, hi];
}

/** The y window for y = f(x) curves over [x0, x1]. */
function yWindowFor(fs: Fn[], x0: number, x1: number, extra: number[]): [number, number] | null {
  const ys: number[] = [...extra];
  let poles = false;
  for (const f of fs) {
    const { poles: p } = features(f, x0, x1, 1500);
    if (p.length) poles = true;
    for (let i = 0; i <= 600; i++) {
      const x = x0 + ((x1 - x0) * (i + 0.0137)) / 600;
      try { const y = f({ x }); if (Number.isFinite(y)) ys.push(y); } catch { /* skip */ }
    }
  }
  if (ys.length < 2) return null;
  ys.sort((a, b) => a - b);
  // next to a pole the curve runs off to infinity; frame the body of the curve instead
  let lo = poles ? ys[Math.floor(ys.length * 0.08)] : ys[0];
  let hi = poles ? ys[Math.ceil(ys.length * 0.92) - 1] : ys[ys.length - 1];
  if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
  const span = hi - lo;
  if (lo > 0 && lo < span * 0.6) lo = 0;
  if (hi < 0 && -hi < span * 0.6) hi = 0;
  const pad = (hi - lo) * 0.12;
  return [lo - pad, hi + pad];
}

type Box = { x0: number; x1: number; y0: number; y1: number };
const grow = (b: Box | null, x: number, y: number): Box => b
  ? { x0: Math.min(b.x0, x), x1: Math.max(b.x1, x), y0: Math.min(b.y0, y), y1: Math.max(b.y1, y) }
  : { x0: x, x1: x, y0: y, y1: y };

/** Bounding box of a curve given by t -> (x, y). */
function curveBox(P: (t: number) => [number, number], t0: number, t1: number): Box | null {
  let b: Box | null = null;
  for (let i = 0; i <= 2000; i++) {
    const t = t0 + ((t1 - t0) * i) / 2000;
    try { const [x, y] = P(t); if (Number.isFinite(x) && Number.isFinite(y) && Math.abs(x) < 1e6 && Math.abs(y) < 1e6) b = grow(b, x, y); } catch { /* skip */ }
  }
  return b;
}

/** Implicit curves: the box of a closed curve, or a window around where an open one comes close. */
function implicitBox(F: Fn): Box | null {
  const R = 64;
  const pts = marchingSquares((x, y) => F({ x, y }), { x0: -R, x1: R, y0: -R, y1: R, nx: 160, ny: 160 }).flat();
  if (!pts.length) {
    // maybe it is small: look closer
    const small = marchingSquares((x, y) => F({ x, y }), { x0: -4, x1: 4, y0: -4, y1: 4, nx: 120, ny: 120 }).flat();
    if (!small.length) return null;
    return small.reduce<Box | null>((b, [x, y]) => grow(b, x, y), null);
  }
  const far = Math.max(...pts.map(([x, y]) => Math.max(Math.abs(x), Math.abs(y))));
  if (far < R * 0.7) {
    // closed: refine on a finer grid around it, so small loops are not missed
    const r = far * 1.3 + 0.5;
    const fine = marchingSquares((x, y) => F({ x, y }), { x0: -r, x1: r, y0: -r, y1: r, nx: 160, ny: 160 }).flat();
    return (fine.length ? fine : pts).reduce<Box | null>((b, [x, y]) => grow(b, x, y), null);
  }
  // open: frame the part of the curve near the origin
  const near = Math.min(...pts.map(([x, y]) => Math.hypot(x, y)));
  const r = Math.max(5, Math.min(R, near * 3));
  return { x0: -r, x1: r, y0: -r, y1: r };
}

/**
 * The window for a set of lines. `aspect` is width / height of the figure,
 * used to keep units equal for circles and other closed shapes.
 */
export function autoWindow(lines: string[], t: [number, number], aspect: number): Window | null {
  const { specs } = parseLines(lines);
  const live = specs.filter((s): s is Spec => !!s);
  if (!live.length) return null;
  const funcs = live.filter((s): s is Extract<Spec, { kind: 'function' }> => s.kind === 'function');
  const trig = lines.some((l, i) => specs[i]?.kind === 'function' && TRIG.test(l));
  let box: Box | null = null;
  let shape = false; // something that should keep equal units

  // x from the y = f(x) curves
  let xr: [number, number] | null = null;
  for (const f of funcs) {
    const w = xWindowFor(f.f);
    xr = xr ? [Math.min(xr[0], w[0]), Math.max(xr[1], w[1])] : w;
  }
  // where two curves cross is worth seeing too
  const crossings: number[] = [];
  for (let i = 0; i < funcs.length; i++) for (let j = i + 1; j < funcs.length; j++) {
    const g = (e: { x: number }) => funcs[i].f(e) - funcs[j].f(e);
    const { x: c } = features((e) => g(e as { x: number }), -SEARCH, SEARCH, SAMPLES);
    // only the zeros of the difference are crossings
    for (const x0 of c) { try { if (Math.abs(g({ x: x0 })) < 1e-2 * (1 + Math.abs(funcs[i].f({ x: x0 })))) crossings.push(x0); } catch { /* skip */ } }
  }
  if (xr && crossings.length) {
    const near = crossings.sort((a, b) => Math.abs(a) - Math.abs(b)).slice(0, 4);
    const pad = Math.max((xr[1] - xr[0]) * 0.1, 1);
    xr = [Math.min(xr[0], Math.min(...near) - pad), Math.max(xr[1], Math.max(...near) + pad)];
  }
  for (const s of live) {
    switch (s.kind) {
      case 'polar': { const b = curveBox((u) => { const r = s.f({ theta: u, t: u }); return [r * Math.cos(u), r * Math.sin(u)]; }, t[0], t[1]); if (b) { box = merge(box, b); shape = true; } break; }
      case 'parametric': { const b = curveBox((u) => [s.x({ t: u }), s.y({ t: u })], t[0], t[1]); if (b) { box = merge(box, b); shape = true; } break; }
      case 'implicit': { const b = implicitBox(s.f); if (b) { box = merge(box, b); shape = true; } break; }
      case 'xfunction': { // x = g(y): swap the roles
        const w = xWindowFor((e) => s.f({ y: e.x }));
        const b = curveBox((u) => [s.f({ y: u }), u], w[0], w[1]);
        if (b) box = merge(box, { ...b, y0: Math.min(b.y0, w[0]), y1: Math.max(b.y1, w[1]) });
        break;
      }
      case 'vertical': box = merge(box, { x0: s.x - 1, x1: s.x + 1, y0: -1, y1: 1 }); break;
      case 'slope': {
        const [a, b] = s.init ?? [0, 0];
        box = merge(box, { x0: a - 4, x1: a + 4, y0: b - 3, y1: b + 3 });
        break;
      }
      default: break;
    }
  }

  let x: [number, number], y: [number, number];
  if (xr) {
    x = box ? [Math.min(xr[0], box.x0), Math.max(xr[1], box.x1)] : xr;
    const yf = yWindowFor(funcs.map((f) => f.f), x[0], x[1], []);
    y = yf ?? [-5, 5];
    if (box) y = [Math.min(y[0], box.y0), Math.max(y[1], box.y1)];
  } else if (box) {
    const px = Math.max((box.x1 - box.x0) * 0.06, 0.2), py = Math.max((box.y1 - box.y0) * 0.06, 0.2);
    x = [box.x0 - px, box.x1 + px];
    y = [box.y0 - py, box.y1 + py];
  } else return null;

  if (shape && !xr) {
    // equal units: widen the short side to match the figure's shape
    const w = x[1] - x[0], h = y[1] - y[0];
    if (w / h < aspect) { const c = (x[0] + x[1]) / 2, half = (h * aspect) / 2; x = [c - half, c + half]; }
    else { const c = (y[0] + y[1]) / 2, half = w / aspect / 2; y = [c - half, c + half]; }
  }
  const pi = trig && !box && x[1] - x[0] >= 2 && x[1] - x[0] <= 60;
  return { x: tidy(x[0], x[1], pi), y: tidy(y[0], y[1], false), pi };
}

function merge(a: Box | null, b: Box): Box {
  return a ? { x0: Math.min(a.x0, b.x0), x1: Math.max(a.x1, b.x1), y0: Math.min(a.y0, b.y0), y1: Math.max(a.y1, b.y1) } : b;
}
