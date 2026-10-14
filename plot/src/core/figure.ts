/**
 * Compose a whole figure: axes, grid, ticks, numbers, curves and extras,
 * laid out in a rectangle of the page.
 */
import { compile, parseEquation, ParseError, Spec, Fn } from './expr';
import { trace, chunk, clipPolylines, simplify } from './sample';
import { marchingSquares } from './implicit';
import { ticks as niceTicks, piTicks, Tick, fmt } from './ticks';
import { strokes, measure } from './font';
import { Drawing, Ink, Item, Pt, Rect, Weight, path, circle, label, width, height, Anchor, LabelItem } from './types';

export type GridKind = 'none' | 'major' | 'minor';

export interface PlotOpts {
  lines: string[];
  inks?: Ink[];
  x: [number, number];
  y: [number, number];
  /** Parameter range for parametric and polar curves. */
  t: [number, number];
  equal: boolean;
  grid: GridKind;
  axes: boolean;
  arrows: boolean;
  numbers: boolean;
  /** Label the x axis in multiples of pi. */
  piX: 'auto' | 'on' | 'off';
  frame: boolean;
  axisNames: boolean;
  /** Mark zeros, turning points and crossings of y = f(x) curves. */
  marks: boolean;
  /** Slope field density: arrows across the width. */
  fieldDensity: number;
  tangentAt?: number | null;
  area?: [number, number] | null;
  riemann?: { a: number; b: number; n: number; rule: 'left' | 'right' | 'mid' } | null;
  /** Cap height of numbers in px; 0 = automatic. */
  textSize?: number;
}

export const DEFAULTS: PlotOpts = {
  lines: ['y = sin x'], x: [-10, 10], y: [-6, 6], t: [0, 2 * Math.PI], equal: false,
  grid: 'major', axes: true, arrows: true, numbers: true, piX: 'auto', frame: false, axisNames: true,
  marks: false, fieldDensity: 15, tangentAt: null, area: null, riemann: null, textSize: 0,
};

export interface LineResult { kind: Spec['kind'] | null; error: string | null; errorPos: number; }

export interface View {
  x0: number; x1: number; y0: number; y1: number;
  box: Rect;
  X: (x: number) => number;
  Y: (y: number) => number;
}

const MAX_PTS = 240;
const DEFAULT_INKS: Ink[] = [0, 157, 201];

export function parseLines(lines: string[]): { specs: (Spec | null)[]; results: LineResult[] } {
  const specs: (Spec | null)[] = [];
  const results: LineResult[] = [];
  for (const l of lines) {
    if (!l.trim()) { specs.push(null); results.push({ kind: null, error: null, errorPos: -1 }); continue; }
    try {
      const s = parseEquation(l);
      specs.push(s);
      results.push({ kind: s.kind, error: null, errorPos: -1 });
    } catch (e) {
      specs.push(null);
      results.push({ kind: null, error: (e as Error).message, errorPos: e instanceof ParseError ? e.pos : -1 });
    }
  }
  return { specs, results };
}

/** Cap height for numbers, scaled to the figure. */
export function autoTextSize(r: Rect): number {
  return Math.round(Math.max(15, Math.min(26, Math.min(width(r), height(r)) / 34)));
}

const TRIG = /(sin|cos|tan|sec|csc|cot)/;
/** Pi ticks suit y = f(x) curves with trig in them, not circles and roses. */
const wantsPi = (lines: string[], specs: (Spec | null)[]) => lines.some((l, i) => specs[i]?.kind === 'function' && TRIG.test(l));

export function makeView(o: PlotOpts, rect: Rect, ts: number): View {
  let [x0, x1] = o.x, [y0, y1] = o.y;
  if (!(x1 > x0)) [x0, x1] = [Math.min(x0, x1) - 1, Math.max(x0, x1) + 1];
  if (!(y1 > y0)) [y0, y1] = [Math.min(y0, y1) - 1, Math.max(y0, y1) + 1];
  // Room for numbers when they sit outside the plot (axis off-screen or frame on).
  const xAxisInside = o.axes && y0 < 0 && y1 > 0 && !o.frame;
  const yAxisInside = o.axes && x0 < 0 && x1 > 0 && !o.frame;
  const padIn = 2;
  const names = o.axisNames && o.frame ? 1 : 0;
  const bottom = (o.numbers && !xAxisInside ? ts * 2.2 : padIn) + names * ts * 1.6;
  const left = (o.numbers && !yAxisInside ? ts * 0.72 * 5 + ts : padIn) + names * ts * 1.4;
  const box: Rect = { left: rect.left + left, top: rect.top + padIn, right: rect.right - padIn, bottom: rect.bottom - bottom };
  if (o.equal) {
    const sx = width(box) / (x1 - x0), sy = height(box) / (y1 - y0);
    if (sx > sy) { const c = (x0 + x1) / 2, h = width(box) / sy / 2; x0 = c - h; x1 = c + h; }
    else { const c = (y0 + y1) / 2, h = height(box) / sx / 2; y0 = c - h; y1 = c + h; }
  }
  const X = (x: number) => box.left + ((x - x0) / (x1 - x0)) * width(box);
  const Y = (y: number) => box.bottom - ((y - y0) / (y1 - y0)) * height(box);
  return { x0, x1, y0, y1, box, X, Y };
}

/** Serpentine: one continuous stroke that draws many parallel lines. */
function serpentine(lines: [Pt, Pt][]): Pt[] {
  const out: Pt[] = [];
  lines.forEach(([a, b], i) => { if (i % 2) out.push(b, a); else out.push(a, b); });
  return out;
}

function gridItems(v: View, xt: number[], yt: number[], ink: Ink, weight: Weight): Item[] {
  const { box } = v;
  const items: Item[] = [];
  const vx = xt.map((x) => v.X(x)).filter((x) => x > box.left + 0.5 && x < box.right - 0.5);
  const hy = yt.map((y) => v.Y(y)).filter((y) => y > box.top + 0.5 && y < box.bottom - 0.5);
  if (vx.length) items.push(path(serpentine(vx.map((x) => [[x, box.top], [x, box.bottom]] as [Pt, Pt])), ink, weight));
  if (hy.length) items.push(path(serpentine(hy.map((y) => [[box.left, y], [box.right, y]] as [Pt, Pt])), ink, weight));
  // The serpentine leaves every other piece of the border; a frame closes it.
  if (items.length) items.push(frameItem(box, ink, weight));
  return items;
}

function frameItem(b: Rect, ink: Ink = 0, w: Weight = 'fine'): Item {
  return path([[b.left, b.top], [b.right, b.top], [b.right, b.bottom], [b.left, b.bottom], [b.left, b.top]], ink, w);
}

/** An axis with its tick marks (and an arrowhead) as a single stroke. */
export function axisStroke(a: Pt, b: Pt, tickAt: Pt[], tickLen: number, arrow: number): Pt[] {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
  const ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
  const out: Pt[] = [a];
  const ts = tickAt.map((p) => ({ p, s: (p[0] - a[0]) * ux + (p[1] - a[1]) * uy })).filter((q) => q.s > 1 && q.s < L - Math.max(arrow * 1.5, 1)).sort((p, q) => p.s - q.s);
  for (const { p } of ts) {
    out.push(p, [p[0] + nx * tickLen, p[1] + ny * tickLen], [p[0] - nx * tickLen, p[1] - ny * tickLen], p);
  }
  out.push(b);
  if (arrow > 0) {
    const back: Pt = [b[0] - ux * arrow, b[1] - uy * arrow];
    out.push([back[0] + nx * arrow * 0.45, back[1] + ny * arrow * 0.45], b, [back[0] - nx * arrow * 0.45, back[1] - ny * arrow * 0.45]);
  }
  return out;
}

/** Drop labels that would collide with their neighbour (keep every k-th). */
function thin(ticks: Tick[], pxPos: (v: number) => number, size: number, horizontal: boolean): Tick[] {
  if (ticks.length < 2) return ticks;
  const extent = (t: Tick) => (horizontal ? measure(t.label) * size : size * 1.1);
  for (let k = 1; k <= ticks.length; k++) {
    let okAll = true;
    for (let i = k; i < ticks.length; i += k) {
      const gap = Math.abs(pxPos(ticks[i].v) - pxPos(ticks[i - k].v));
      if (gap < (extent(ticks[i]) + extent(ticks[i - k])) / 2 + size * 1.1) { okAll = false; break; }
    }
    if (okAll) return ticks.filter((_, i) => i % k === 0);
  }
  return [];
}

export interface PlotResult { drawing: Drawing; results: LineResult[]; view: View; textSize: number; }

export function plot(o: PlotOpts, rect: Rect): PlotResult {
  const ts = o.textSize || autoTextSize(rect);
  const { specs, results } = parseLines(o.lines);
  const v = makeView(o, rect, ts);
  const { box, X, Y } = v;
  const items: Item[] = [];
  const inks = o.inks ?? DEFAULT_INKS;

  // Ticks
  const usePi = o.piX === 'on' || (o.piX === 'auto' && wantsPi(o.lines, specs) && v.x1 - v.x0 >= 1.5 && v.x1 - v.x0 <= 60);
  const targetX = Math.max(3, Math.round(width(box) / (ts * 4.2)));
  const targetY = Math.max(3, Math.round(height(box) / (ts * 3.2)));
  const xt = usePi ? piTicks(v.x0, v.x1, targetX) : niceTicks(v.x0, v.x1, targetX);
  // With equal units the grid should be square too: reuse the x step.
  const yTicks = o.equal && !usePi && xt.length > 1 ? stepTicks(v.y0, v.y1, xt[1].v - xt[0].v) : niceTicks(v.y0, v.y1, targetY);

  // Grid
  if (o.grid !== 'none') {
    if (o.grid === 'minor') {
      const sub = (t: Tick[], lo: number, hi: number) => {
        if (t.length < 2) return [];
        const major = t[1].v - t[0].v;
        const px = t === xt ? width(box) / (v.x1 - v.x0) : height(box) / (v.y1 - v.y0);
        const div = [5, 4, 2].find((d) => (major / d) * px >= ts * 0.85 && !(usePi && t === xt && d === 5));
        if (!div) return [];
        const step = major / div;
        const out: number[] = [];
        for (let k = Math.ceil(lo / step - 1e-9); k * step <= hi + 1e-9; k++) out.push(k * step);
        return out;
      };
      items.push(...gridItems(v, sub(xt, v.x0, v.x1), sub(yTicks, v.y0, v.y1), 201, 'hair'));
    }
    items.push(...gridItems(v, xt.map((t) => t.v), yTicks.map((t) => t.v), 201, o.grid === 'minor' ? 'fine' : 'hair'));
  }
  if (o.frame) items.push(frameItem(box));

  // Axes
  const ax = { y: v.y0 < 0 && v.y1 > 0 && !o.frame ? 0 : v.y0, x: v.x0 < 0 && v.x1 > 0 && !o.frame ? 0 : v.x0 };
  const axisY = Y(ax.y), axisX = X(ax.x);
  const tickLen = ts * 0.32;
  const arrow = o.arrows && !o.frame ? ts * 0.8 : 0;
  if (o.axes) {
    const xEnd: Pt = [box.right, axisY], yEnd: Pt = [axisX, box.top];
    const tickXs: Pt[] = xt.filter((t) => Math.abs(t.v - ax.x) > 1e-9).map((t) => [X(t.v), axisY]);
    const tickYs: Pt[] = yTicks.filter((t) => Math.abs(t.v - ax.y) > 1e-9).map((t) => [axisX, Y(t.v)]);
    items.push(path(axisStroke([box.left, axisY], xEnd, tickXs, tickLen, arrow), 0, 'fine'));
    items.push(path(axisStroke([axisX, box.bottom], yEnd, tickYs, tickLen, arrow), 0, 'fine'));
  }
  if (o.numbers && (o.axes || o.frame)) {
    // Where the axes cross, the zeros are left off (as in a textbook), and
    // numbers that would sit on top of the other axis are dropped.
    const xIn = ax.y === 0, yIn = ax.x === 0;
    const xs = thin(xt.filter((t) => !(yIn && Math.abs(X(t.v) - axisX) < measure(t.label) * ts / 2 + ts * 0.5))
      .filter((t) => X(t.v) < box.right - arrow * 1.2 - ts * 0.4 || !o.axes), X, ts, true);
    for (const t of xs) items.push(label([X(t.v), axisY + tickLen + ts * 0.45], t.label, ts, 'n'));
    const ys = thin(yTicks.filter((t) => !(xIn && Math.abs(Y(t.v) - axisY) < ts * 1.9))
      .filter((t) => Y(t.v) > box.top + arrow * 1.2 + ts * 0.4 || !o.axes), (y) => Y(y), ts, false);
    for (const t of ys) items.push(label([axisX - tickLen - ts * 0.4, Y(t.v)], t.label, ts, 'e'));
  }
  if (o.axisNames && o.axes && !o.frame) {
    items.push(label([box.right - ts * 0.2, axisY - ts * 0.6], 'x', ts * 1.1, 'se'));
    items.push(label([axisX + ts * 0.6, box.top + ts * 0.1], 'y', ts * 1.1, 'nw'));
  } else if (o.axisNames && o.frame) {
    items.push(label([(box.left + box.right) / 2, box.bottom + ts * (o.numbers ? 2.3 : 0.8)], 'x', ts * 1.1, 'n'));
    items.push(label([rect.left + ts * 0.2, (box.top + box.bottom) / 2], 'y', ts * 1.1, 'w'));
  }

  // Curves
  const tr = (P: (t: number) => Pt | null, t0: number, t1: number, n?: number) => trace(P, t0, t1, box, { n });
  const funcs: { f: Fn; ink: Ink }[] = [];
  const fields = new Set<string>();
  specs.forEach((s, i) => {
    if (!s) return;
    const ink = inks[i % inks.length];
    let polys: Pt[][] = [];
    try {
      switch (s.kind) {
        case 'function':
          funcs.push({ f: s.f, ink });
          polys = tr((t) => [X(t), Y(s.f({ x: t }))], v.x0, v.x1);
          break;
        case 'xfunction':
          polys = tr((t) => [X(s.f({ y: t })), Y(t)], v.y0, v.y1);
          break;
        case 'vertical':
          if (s.x >= v.x0 && s.x <= v.x1) polys = [[[X(s.x), box.bottom], [X(s.x), box.top]]];
          break;
        case 'polar': {
          const [t0, t1] = o.t;
          polys = tr((t) => { const r = s.f({ theta: t, t }); return [X(r * Math.cos(t)), Y(r * Math.sin(t))]; }, t0, t1, 360);
          break;
        }
        case 'parametric': {
          const [t0, t1] = o.t;
          polys = tr((t) => [X(s.x({ t })), Y(s.y({ t }))], t0, t1, 360);
          break;
        }
        case 'implicit': {
          const cells = Math.round(Math.min(140, Math.max(60, width(box) / 7)));
          const ny = Math.round(cells * (height(box) / width(box)));
          const F = (x: number, y: number) => s.f({ x, y });
          const raw = marchingSquares(F, { x0: v.x0, x1: v.x1, y0: v.y0, y1: v.y1, nx: cells, ny: Math.max(20, ny) });
          polys = raw.map((p) => p.map(([x, y]) => [X(x), Y(y)] as Pt));
          break;
        }
        case 'slope': {
          // two solutions of the same equation share one field
          const key = s.label.split(',')[0].replace(/\s+/g, '');
          if (!fields.has(key)) { fields.add(key); items.push(...slopeField(s.f, v, o.fieldDensity, ink === 0 ? 157 : ink)); }
          if (s.init) {
            const px = solution(s.f, s.init, v).map(([x, y]) => [X(x), Y(y)] as Pt);
            polys = clipPolylines([px], box).map((p) => simplify(p, 0.4));
          }
          break;
        }
      }
    } catch (e) {
      results[i] = { kind: s.kind, error: (e as Error).message, errorPos: -1 };
    }
    for (const p of polys) for (const c of chunk(p, MAX_PTS)) items.push(path(c.map(([px, py]) => [round1(px), round1(py)] as Pt), ink, 'pen'));
  });

  // Extras on the first y = f(x)
  const f0 = funcs[0];
  if (f0) {
    const f = (x: number) => f0.f({ x });
    if (o.area && o.area[1] !== o.area[0]) items.push(...hatch(f, Math.min(...o.area), Math.max(...o.area), v, ts * 0.55));
    if (o.riemann && o.riemann.n > 0) items.push(...riemann(f, o.riemann, v));
    if (o.tangentAt != null && Number.isFinite(o.tangentAt)) items.push(...tangent(f, o.tangentAt, v, ts));
  }
  if (o.marks) items.push(...keyPoints(funcs, v, ts));

  // Numbers that would hang over the edge of the figure are left off.
  const inside = items.filter((it) => {
    if (it.kind !== 'label') return true;
    const w = measure(it.text) * it.size, a = it.anchor;
    const l = a.includes('e') ? it.at[0] - w : a.includes('w') ? it.at[0] : it.at[0] - w / 2;
    const t = a.includes('n') ? it.at[1] : a.includes('s') ? it.at[1] - it.size : it.at[1] - it.size / 2;
    const e = 2;
    return l >= rect.left - e && l + w <= rect.right + e && t >= rect.top - e && t + it.size <= rect.bottom + e;
  });
  return { drawing: { items: inside, bounds: rect }, results, view: v, textSize: ts };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

function stepTicks(min: number, max: number, step: number): Tick[] {
  const out: Tick[] = [];
  for (let i = Math.ceil(min / step - 1e-9); i * step <= max + 1e-9; i++) {
    out.push({ v: i * step, label: fmt(i * step, step) });
    if (out.length > 200) break;
  }
  return out;
}

/** Short strokes showing the slope at grid points. One stroke each. */
function slopeField(f: Fn, v: View, density: number, ink: Ink): Item[] {
  const { box } = v;
  const nx = Math.max(4, Math.min(30, Math.round(density)));
  const step = width(box) / nx;
  const ny = Math.max(2, Math.floor(height(box) / step));
  const len = step * 0.62;
  const sx = width(box) / (v.x1 - v.x0), sy = height(box) / (v.y1 - v.y0);
  const out: Item[] = [];
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const px = box.left + (i + 0.5) * step, py = box.top + (j + 0.5) * (height(box) / ny);
      const x = v.x0 + (px - box.left) / sx, y = v.y0 + (box.bottom - py) / sy;
      let m: number;
      try { m = f({ x, y }); } catch { continue; }
      let dx: number, dy: number;
      if (!Number.isFinite(m)) { dx = 0; dy = 1; } else { dx = sx; dy = -m * sy; }
      const L = Math.hypot(dx, dy) || 1;
      dx = (dx / L) * len / 2; dy = (dy / L) * len / 2;
      out.push(path([[round1(px - dx), round1(py - dy)], [round1(px + dx), round1(py + dy)]], ink, 'fine'));
    }
  }
  return out;
}

/** RK4 solution of y' = f(x, y) through (x0, y0), both directions, in world units. */
export function solution(f: Fn, init: [number, number], v: View): Pt[] {
  const h0 = (v.x1 - v.x0) / 600;
  const ylo = v.y0 - (v.y1 - v.y0) * 0.5, yhi = v.y1 + (v.y1 - v.y0) * 0.5;
  const F = (x: number, y: number) => f({ x, y });
  const run = (h: number): Pt[] => {
    let [x, y] = init;
    const pts: Pt[] = [[x, y]];
    for (let k = 0; k < 4000; k++) {
      const k1 = F(x, y), k2 = F(x + h / 2, y + (h / 2) * k1), k3 = F(x + h / 2, y + (h / 2) * k2), k4 = F(x + h, y + h * k3);
      const ny = y + (h / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
      if (!Number.isFinite(ny)) break;
      x += h; y = ny;
      pts.push([x, y]);
      if (x < v.x0 || x > v.x1 || y < ylo || y > yhi) break;
    }
    return pts;
  };
  const fwd = run(h0), back = run(-h0);
  return [...back.reverse(), ...fwd.slice(1)];
}

/** Vertical hatching between the curve and the x axis, as one stroke. */
function hatch(f: (x: number) => number, a: number, b: number, v: View, gapPx: number): Item[] {
  const { box } = v;
  const pa = Math.max(v.X(a), box.left), pb = Math.min(v.X(b), box.right);
  if (pb <= pa) return [];
  const n = Math.max(2, Math.round((pb - pa) / gapPx));
  const clampY = (y: number) => Math.max(box.top, Math.min(box.bottom, y));
  const base = clampY(v.Y(0));
  const lines: [Pt, Pt][] = [];
  for (let i = 0; i <= n; i++) {
    const px = pa + ((pb - pa) * i) / n;
    const x = v.x0 + ((px - box.left) / width(box)) * (v.x1 - v.x0);
    let y: number;
    try { y = f(x); } catch { continue; }
    if (!Number.isFinite(y)) continue;
    lines.push([[round1(px), round1(base)], [round1(px), round1(clampY(v.Y(y)))]]);
  }
  return lines.length ? [path(serpentine(lines), 157, 'hair')] : [];
}

/** Riemann rectangles as a single stroke. */
function riemann(f: (x: number) => number, r: { a: number; b: number; n: number; rule: 'left' | 'right' | 'mid' }, v: View): Item[] {
  const { box } = v;
  const n = Math.min(200, Math.max(1, Math.round(r.n)));
  const a = Math.min(r.a, r.b), b = Math.max(r.a, r.b), w = (b - a) / n;
  const clampY = (y: number) => Math.max(box.top, Math.min(box.bottom, y));
  const clampX = (x: number) => Math.max(box.left, Math.min(box.right, x));
  const base = clampY(v.Y(0));
  const pts: Pt[] = [[clampX(v.X(a)), base]];
  for (let i = 0; i < n; i++) {
    const xl = a + i * w, xr = xl + w;
    const xs = r.rule === 'left' ? xl : r.rule === 'right' ? xr : (xl + xr) / 2;
    let h: number;
    try { h = f(xs); } catch { h = NaN; }
    const top = Number.isFinite(h) ? clampY(v.Y(h)) : base;
    pts.push([clampX(v.X(xl)), top], [clampX(v.X(xr)), top], [clampX(v.X(xr)), base]);
  }
  return [path(pts.map(([x, y]) => [round1(x), round1(y)] as Pt), 0, 'fine')];
}

function deriv(f: (x: number) => number, x: number, h: number): number {
  return (f(x + h) - f(x - h)) / (2 * h);
}

function tangent(f: (x: number) => number, a: number, v: View, ts: number): Item[] {
  const y = f(a);
  const m = deriv(f, a, (v.x1 - v.x0) * 1e-5);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return [];
  const line = (x: number) => y + m * (x - a);
  const polys = trace((t) => [v.X(t), v.Y(line(t))], v.x0, v.x1, v.box, { n: 4 });
  const out: Item[] = polys.map((p) => path(p, 0, 'fine'));
  const P: Pt = [v.X(a), v.Y(y)];
  if (P[1] >= v.box.top && P[1] <= v.box.bottom) out.push(circle(P, ts * 0.22, 0, 'pen'));
  return out;
}

/** Zeros, turning points and crossings of the y = f(x) curves, as small rings. */
function keyPoints(funcs: { f: Fn; ink: Ink }[], v: View, ts: number): Item[] {
  const pts: { p: Pt; ink: Ink }[] = [];
  const N = 800;
  const xs = Array.from({ length: N + 1 }, (_, i) => v.x0 + ((v.x1 - v.x0) * (i + 0.0137)) / N);
  const bisect = (g: (x: number) => number, a: number, b: number) => {
    let ga = g(a);
    for (let k = 0; k < 60; k++) { const m = (a + b) / 2, gm = g(m); if ((gm < 0) === (ga < 0)) { a = m; ga = gm; } else b = m; }
    return (a + b) / 2;
  };
  const scan = (g: (x: number) => number, onRoot: (x: number) => void, check: (x: number) => boolean) => {
    for (let i = 1; i < xs.length; i++) {
      const a = g(xs[i - 1]), b = g(xs[i]);
      if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
      if ((a < 0) !== (b < 0) || a === 0) { const r = bisect(g, xs[i - 1], xs[i]); if (check(r)) onRoot(r); }
    }
  };
  for (const { f, ink } of funcs) {
    const F = (x: number) => f({ x });
    const cont = (x: number) => { const y = F(x), h = (v.x1 - v.x0) * 1e-4; return Number.isFinite(y) && Math.abs(F(x - h) - F(x + h)) < (v.y1 - v.y0) * 0.05; };
    scan(F, (x) => pts.push({ p: [x, 0], ink }), (x) => cont(x) && Math.abs(F(x)) < (v.y1 - v.y0) * 1e-3);
    const h = (v.x1 - v.x0) * 1e-5;
    const D = (x: number) => deriv(F, x, h);
    scan(D, (x) => pts.push({ p: [x, F(x)], ink }), (x) => cont(x) && Math.abs(D(x)) < 1e-2 * (v.y1 - v.y0) / (v.x1 - v.x0) * 10);
  }
  for (let i = 0; i < funcs.length; i++) for (let j = i + 1; j < funcs.length; j++) {
    const g = (x: number) => funcs[i].f({ x }) - funcs[j].f({ x });
    scan(g, (x) => pts.push({ p: [x, funcs[i].f({ x })], ink: 0 }), (x) => Math.abs(g(x)) < (v.y1 - v.y0) * 1e-3);
  }
  const out: Item[] = [];
  const seen: Pt[] = [];
  for (const { p, ink } of pts) {
    const P: Pt = [v.X(p[0]), v.Y(p[1])];
    if (P[0] < v.box.left || P[0] > v.box.right || P[1] < v.box.top || P[1] > v.box.bottom) continue;
    if (seen.some((q) => Math.hypot(q[0] - P[0], q[1] - P[1]) < ts * 0.4)) continue;
    seen.push(P);
    out.push(circle([round1(P[0]), round1(P[1])], ts * 0.2, ink, 'pen'));
  }
  return out.slice(0, 40);
}

/* ---------- labels to ink ---------- */

/** Replace text labels by stroke-font ink, placed by their anchors. */
export function inkLabels(d: Drawing, weight: Weight = 'fine'): Drawing {
  const items: Item[] = [];
  for (const it of d.items) {
    if (it.kind !== 'label') { items.push(it); continue; }
    items.push(...labelInk(it, weight));
  }
  return { ...d, items };
}

export function labelInk(it: LabelItem, weight: Weight = 'fine'): Item[] {
  const w = measure(it.text) * it.size, h = it.size;
  const a = it.anchor as Anchor;
  const x = a.includes('e') ? it.at[0] - w : a.includes('w') ? it.at[0] : it.at[0] - w / 2;
  const yTop = a.includes('n') ? it.at[1] : a.includes('s') ? it.at[1] - h : it.at[1] - h / 2;
  return strokes(it.text, x, yTop + h, it.size).map((s) => path(s.map(([px, py]) => [round1(px), round1(py)] as Pt), it.ink, weight));
}

/* ---------- auto window ---------- */

/** A y window that shows the interesting part of every y = f(x) curve. */
export function autoY(lines: string[], x0: number, x1: number): [number, number] | null {
  const { specs } = parseLines(lines);
  const ys: number[] = [];
  for (const s of specs) {
    if (!s || s.kind !== 'function') continue;
    for (let i = 0; i <= 400; i++) {
      const x = x0 + ((x1 - x0) * (i + 0.0137)) / 400;
      try { const y = s.f({ x }); if (Number.isFinite(y)) ys.push(y); } catch { /* skip */ }
    }
  }
  if (ys.length < 10) return null;
  ys.sort((a, b) => a - b);
  let lo = ys[Math.floor(ys.length * 0.03)], hi = ys[Math.ceil(ys.length * 0.97) - 1];
  if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.12;
  lo -= pad; hi += pad;
  if (lo > 0 && lo < (hi - lo) * 0.5) lo = -(hi - lo) * 0.08;
  if (hi < 0 && -hi < (hi - lo) * 0.5) hi = (hi - lo) * 0.08;
  const step = niceTicks(lo, hi, 8);
  const st = step.length > 1 ? step[1].v - step[0].v : 1;
  return [Math.floor(lo / st) * st, Math.ceil(hi / st) * st];
}

export { compile };
