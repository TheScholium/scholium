/**
 * Stencils: the figures you draw again and again in math and physics
 * classes, ready to drop onto a page and write on.
 */
import { plot, DEFAULTS, autoTextSize, axisStroke } from './figure';
import { Drawing, Ink, Item, Pt, Rect, Weight, path, circle, label, width, height } from './types';
import { piLabel } from './ticks';

export type Choice = { key: string; label: string; options: { v: string; label: string }[] };

export interface Stencil {
  id: string;
  name: string;
  blurb: string;
  /** Preferred width / height, so the figure keeps its shape inside any area. */
  aspect: number;
  choices: Choice[];
  draw: (r: Rect, opt: Record<string, string>) => Item[];
}

const DEG = Math.PI / 180;
const r1 = (n: number) => Math.round(n * 10) / 10;
const P = (x: number, y: number): Pt => [r1(x), r1(y)];

/** An arrow from a to b, shaft and head in one stroke. */
export function arrow(a: Pt, b: Pt, head: number, ink: Ink = 0, w: Weight = 'pen'): Item {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
  const ux = dx / L, uy = dy / L;
  const back: Pt = [b[0] - ux * head, b[1] - uy * head];
  return path([a, b, P(back[0] - uy * head * 0.42, back[1] + ux * head * 0.42), b, P(back[0] + uy * head * 0.42, back[1] - ux * head * 0.42)], ink, w);
}

/** Arc around c from angle a0 to a1 (degrees, counter-clockwise on paper). */
export function arcPts(c: Pt, r: number, a0: number, a1: number, step = 4): Pt[] {
  const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) / step));
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = (a0 + ((a1 - a0) * i) / n) * DEG;
    return P(c[0] + r * Math.cos(a), c[1] - r * Math.sin(a));
  });
}

/** The largest box of the given aspect, centred in r. */
export function fit(r: Rect, aspect: number): Rect {
  const w = width(r), h = height(r);
  if (w / h > aspect) { const nw = h * aspect, l = r.left + (w - nw) / 2; return { left: l, top: r.top, right: l + nw, bottom: r.bottom }; }
  const nh = w / aspect, t = r.top + (h - nh) / 2;
  return { left: r.left, top: t, right: r.right, bottom: t + nh };
}

const ts = (r: Rect) => autoTextSize(r);

/* ---------- the stencils ---------- */

const plane: Stencil = {
  id: 'plane', name: 'Coordinate plane', blurb: 'Axes with numbers and a grid', aspect: 1,
  choices: [
    { key: 'range', label: 'Range', options: [{ v: '10', label: '±10' }, { v: '5', label: '±5' }, { v: 'q1', label: 'First quadrant' }] },
    { key: 'grid', label: 'Grid', options: [{ v: 'major', label: 'Squares' }, { v: 'minor', label: 'Fine' }, { v: 'none', label: 'None' }] },
  ],
  draw: (r, o) => {
    const n = o.range === '5' ? 5 : 10;
    const x: [number, number] = o.range === 'q1' ? [0, 10] : [-n, n];
    return plot({ ...DEFAULTS, lines: [], x, y: x, equal: true, grid: (o.grid as any) ?? 'major' }, r).drawing.items;
  },
};

const numberLine: Stencil = {
  id: 'numberline', name: 'Number line', blurb: 'For inequalities and intervals', aspect: 6,
  choices: [{ key: 'range', label: 'Range', options: [{ v: '10', label: '-10 to 10' }, { v: '5', label: '-5 to 5' }, { v: '0', label: '0 to 10' }] }],
  draw: (r, o) => {
    const lo = o.range === '0' ? 0 : -(Number(o.range) || 10), hi = o.range === '0' ? 10 : -lo;
    const s = Math.max(16, Math.min(26, width(r) / 40));
    const y = (r.top + r.bottom) / 2 - s * 0.6, pad = s * 1.2;
    const X = (v: number) => r.left + pad + ((v - lo) / (hi - lo)) * (width(r) - 2 * pad);
    const items: Item[] = [];
    const ticks: Pt[] = [];
    for (let v = lo; v <= hi; v++) ticks.push(P(X(v), y));
    const line = axisStroke(P(r.left, y), P(r.right, y), ticks, s * 0.45, s * 0.8);
    // an arrowhead at the left end too
    items.push(path(line, 0, 'fine'), arrow(P(r.left + s, y), P(r.left, y), s * 0.8, 0, 'fine'));
    for (let v = lo; v <= hi; v++) if (hi - lo <= 10 || v % 2 === 0) items.push(label(P(X(v), y + s * 0.8), String(v), s, 'n'));
    return items;
  },
};

const unitCircle: Stencil = {
  id: 'unitcircle', name: 'Unit circle', blurb: 'Special angles, ready to fill in', aspect: 1,
  choices: [{ key: 'labels', label: 'Angles', options: [{ v: 'rad', label: 'Radians' }, { v: 'deg', label: 'Degrees' }, { v: 'none', label: 'Blank' }] }],
  draw: (rr, o) => {
    const r = fit(rr, 1), s = ts(r);
    const c: Pt = [(r.left + r.right) / 2, (r.top + r.bottom) / 2];
    const R = width(r) * 0.33;
    const items: Item[] = [];
    const angles = [0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330];
    const at = (a: number, rad: number): Pt => P(c[0] + rad * Math.cos(a * DEG), c[1] - rad * Math.sin(a * DEG));
    // radii to every special angle, drawn as one star-shaped stroke through the centre
    const star: Pt[] = [];
    for (const a of angles) if (a % 90) star.push(at(a, R), c);
    items.push(path(star, 201, 'hair'));
    const L = R * 1.22;
    items.push(arrow(at(180, L), at(0, L), s * 0.8, 0, 'fine'), arrow(at(270, L), at(90, L), s * 0.8, 0, 'fine'));
    items.push(circle(c, R, 0, 'pen'));
    for (const a of angles) items.push(circle(at(a, R), s * 0.17, 0, 'pen'));
    if (o.labels !== 'none') {
      for (const a of angles) {
        const text = o.labels === 'deg' ? `${a}°` : piLabel(a / 15, 12);
        if (a % 90) {
          const ca = Math.cos(a * DEG);
          items.push(label(at(a, R + s * 0.55), text, s * 0.95, ca > 0 ? 'w' : 'e'));
        } else {
          // on an axis: tuck the label into the corner beside the point
          const p = at(a, R);
          const k = a / 90;
          const pos: Pt = [p[0] + (k === 2 ? -s * 0.35 : s * 0.35), p[1] + (k === 3 ? s * 0.35 : -s * 0.35)];
          items.push(label(P(pos[0], pos[1]), text, s * 0.95, k === 2 ? 'se' : k === 3 ? 'nw' : 'sw'));
        }
      }
    }
    items.push(label(P(c[0] + L, c[1] + s * 0.4), 'x', s, 'ne'), label(P(c[0] - s * 0.4, c[1] - L), 'y', s, 'ne'));
    return items;
  },
};

const polarGrid: Stencil = {
  id: 'polar', name: 'Polar grid', blurb: 'Rings and rays for r = f(θ)', aspect: 1,
  choices: [
    { key: 'rays', label: 'Rays', options: [{ v: '30', label: 'Every 30°' }, { v: '15', label: 'Every 15°' }] },
    { key: 'labels', label: 'Angles', options: [{ v: 'rad', label: 'Radians' }, { v: 'deg', label: 'Degrees' }] },
  ],
  draw: (rr, o) => {
    const r = fit(rr, 1), s = ts(r);
    const c: Pt = [(r.left + r.right) / 2, (r.top + r.bottom) / 2];
    const R = width(r) / 2 - s * 2.6, rings = 5, step = Number(o.rays) || 30;
    const items: Item[] = [];
    const at = (a: number, rad: number): Pt => P(c[0] + rad * Math.cos(a * DEG), c[1] - rad * Math.sin(a * DEG));
    const star: Pt[] = [];
    for (let a = 0; a < 360; a += step) if (a % 90) star.push(at(a, R), c);
    items.push(path(star, 201, 'hair'));
    for (let k = 1; k <= rings; k++) items.push(circle(c, (R * k) / rings, k === rings ? 157 : 201, k === rings ? 'fine' : 'hair'));
    items.push(path([at(180, R), at(0, R)], 0, 'fine'), path([at(270, R), at(90, R)], 0, 'fine'));
    for (let a = 0; a < 360; a += step) {
      const text = o.labels === 'deg' ? `${a}°` : piLabel(a / 15, 12);
      const ca = Math.cos(a * DEG), sa = Math.sin(a * DEG);
      const anchor = Math.abs(ca) < 0.2 ? (sa > 0 ? 's' : 'n') : ca > 0 ? 'w' : 'e';
      items.push(label(at(a, R + s * 0.5), text, s * 0.9, anchor));
    }
    for (let k = 1; k < rings; k++) items.push(label(P(c[0] + (R * k) / rings + s * 0.15, c[1] + s * 0.35), String(k), s * 0.8, 'nw'));
    return items;
  },
};

const triangle: Stencil = {
  id: 'triangle', name: 'Right triangle', blurb: 'SOH CAH TOA, with a right-angle mark', aspect: 1.5,
  choices: [{ key: 'labels', label: 'Labels', options: [{ v: 'abc', label: 'a, b, c, θ' }, { v: 'trig', label: 'Opp, adj, hyp' }, { v: 'none', label: 'None' }] }],
  draw: (rr, o) => {
    const r = fit(rr, 1.5), s = ts(r) * 1.1;
    const A: Pt = P(r.left + s * 2, r.bottom - s * 2), B: Pt = P(r.right - s * 2.5, r.bottom - s * 2), C: Pt = P(r.right - s * 2.5, r.top + s * 1.5);
    const items: Item[] = [path([A, B, C, A], 0, 'pen')];
    const q = s * 1.1;
    items.push(path([P(B[0] - q, B[1]), P(B[0] - q, B[1] - q), P(B[0], B[1] - q)], 0, 'fine'));
    const ang = Math.atan2(A[1] - C[1], C[0] - A[0]) / DEG;
    items.push(path(arcPts(A, s * 2.4, 0, ang), 0, 'fine'));
    if (o.labels !== 'none') {
      const [hyp, opp, adj] = o.labels === 'trig' ? ['hyp', 'opp', 'adj'] : ['c', 'a', 'b'];
      const mid = (p: Pt, q2: Pt): Pt => [(p[0] + q2[0]) / 2, (p[1] + q2[1]) / 2];
      const n = [-(C[1] - A[1]), C[0] - A[0]]; const nl = Math.hypot(n[0], n[1]);
      const hm = mid(A, C);
      items.push(label(P(hm[0] + (n[0] / nl) * s * 0.9 * -1, hm[1] - Math.abs((n[1] / nl) * s * 0.9)), hyp, s, 'se'));
      items.push(label(P(B[0] + s * 0.5, (B[1] + C[1]) / 2), opp, s, 'w'));
      items.push(label(P((A[0] + B[0]) / 2, B[1] + s * 0.5), adj, s, 'n'));
      items.push(label(P(A[0] + s * 2.9, A[1] - s * 0.55), 'θ', s, 'w'));
    }
    return items;
  },
};

const axes3d: Stencil = {
  id: 'axes3d', name: '3D axes', blurb: 'x, y and z in oblique projection', aspect: 1,
  choices: [{ key: 'ticks', label: 'Ticks', options: [{ v: 'yes', label: 'Ticks' }, { v: 'no', label: 'Plain' }] }],
  draw: (rr, o) => {
    const r = fit(rr, 1), s = ts(r);
    const O: Pt = P(r.left + width(r) * 0.42, r.top + height(r) * 0.56);
    const L = width(r) * 0.4;
    const dirs: [string, number, number][] = [['x', 225, 0.75], ['y', 0, 1], ['z', 90, 1]];
    const items: Item[] = [];
    for (const [name, a, k] of dirs) {
      const end: Pt = P(O[0] + L * k * Math.cos(a * DEG), O[1] - L * k * Math.sin(a * DEG));
      const neg: Pt = P(O[0] - L * 0.35 * k * Math.cos(a * DEG), O[1] + L * 0.35 * k * Math.sin(a * DEG));
      items.push(path([neg, O], 201, 'fine'));
      const tk: Pt[] = [];
      if (o.ticks !== 'no') for (let i = 1; i <= 4; i++) tk.push(P(O[0] + ((L * k * i) / 5) * Math.cos(a * DEG), O[1] - ((L * k * i) / 5) * Math.sin(a * DEG)));
      items.push(path(axisStroke(O, end, tk, s * 0.3, s * 0.9), 0, 'fine'));
      const lp: Pt = P(end[0] + s * 0.9 * Math.cos(a * DEG), end[1] - s * 0.9 * Math.sin(a * DEG));
      items.push(label(lp, name, s * 1.2, 'c'));
    }
    return items;
  },
};

const incline: Stencil = {
  id: 'incline', name: 'Inclined plane', blurb: 'Block on a ramp with weight, normal and friction', aspect: 1.6,
  choices: [
    { key: 'angle', label: 'Angle', options: [{ v: '30', label: '30°' }, { v: '20', label: '20°' }, { v: '40', label: '40°' }] },
    { key: 'forces', label: 'Forces', options: [{ v: 'yes', label: 'Drawn' }, { v: 'no', label: 'Leave blank' }] },
  ],
  draw: (rr, o) => {
    const r = fit(rr, 1.6), s = ts(r) * 1.1;
    const th = (Number(o.angle) || 30) * DEG;
    const A: Pt = P(r.left + s, r.bottom - s * 0.8);
    const B: Pt = P(r.right - s, r.bottom - s * 0.8);
    const C: Pt = P(B[0], B[1] - (B[0] - A[0]) * Math.tan(th));
    const items: Item[] = [path([A, B, C, A], 0, 'pen')];
    // hatching under the ground line
    const g: Pt[] = [];
    for (let x = A[0]; x < B[0]; x += s * 0.9) g.push(P(x, B[1]), P(x - s * 0.5, B[1] + s * 0.5), P(x, B[1]));
    items.push(path([...g, B], 157, 'hair'));
    items.push(path(arcPts(A, s * 2.6, 0, th / DEG), 0, 'fine'), label(P(A[0] + s * 3, A[1] - s * 0.6), 'θ', s, 'w'));
    // block on the slope
    const u: Pt = [Math.cos(th), -Math.sin(th)], n: Pt = [Math.sin(th), Math.cos(th)];
    const side = Math.min(width(r), height(r)) * 0.2;
    const t = Math.hypot(C[0] - A[0], C[1] - A[1]) * 0.5;
    const b0: Pt = [A[0] + u[0] * (t - side / 2), A[1] + u[1] * (t - side / 2)];
    const corner = (a: number, b: number): Pt => P(b0[0] + u[0] * a - n[0] * b, b0[1] + u[1] * a - n[1] * b);
    items.push(path([corner(0, 0), corner(side, 0), corner(side, side), corner(0, side), corner(0, 0)], 0, 'pen'));
    if (o.forces !== 'no') {
      const ctr = corner(side / 2, side / 2);
      const F = side * 1.25, h = s * 0.8;
      const mg: Pt = P(ctr[0], ctr[1] + F);
      const N: Pt = P(ctr[0] - n[0] * F * 0.9, ctr[1] - n[1] * F * 0.9);
      const fr: Pt = P(ctr[0] + u[0] * F * 0.8, ctr[1] + u[1] * F * 0.8);
      items.push(arrow(ctr, mg, h), arrow(ctr, N, h), arrow(ctr, fr, h), circle(ctr, s * 0.12, 0, 'pen'));
      items.push(label(P(mg[0] + s * 0.4, mg[1]), 'mg', s, 'w'), label(P(N[0] - s * 0.3, N[1]), 'N', s, 'e'), label(P(fr[0] + s * 0.2, fr[1] - s * 0.3), 'f', s, 'sw'));
    }
    return items;
  },
};

const fbd: Stencil = {
  id: 'fbd', name: 'Free-body diagram', blurb: 'A body and four forces', aspect: 1,
  choices: [{ key: 'forces', label: 'Forces', options: [{ v: 'four', label: 'N, mg, f, F' }, { v: 'two', label: 'Up and down' }, { v: 'none', label: 'Body only' }] }],
  draw: (rr, o) => {
    const r = fit(rr, 1), s = ts(r) * 1.15;
    const c: Pt = [(r.left + r.right) / 2, (r.top + r.bottom) / 2];
    const b = width(r) * 0.12, L = width(r) * 0.36, h = s * 0.9;
    const items: Item[] = [path([P(c[0] - b, c[1] - b), P(c[0] + b, c[1] - b), P(c[0] + b, c[1] + b), P(c[0] - b, c[1] + b), P(c[0] - b, c[1] - b)], 0, 'pen')];
    items.push(circle(c, s * 0.12, 0, 'pen'));
    const add = (dx: number, dy: number, name: string, anchor: 'n' | 's' | 'e' | 'w') => {
      const end: Pt = P(c[0] + dx * L, c[1] + dy * L);
      items.push(arrow(c, end, h));
      items.push(label(P(end[0] + dx * s * 0.5 + (dy ? s * 0.5 : 0), end[1] + dy * s * 0.3 + (dx ? -s * 0.4 : 0)), name, s, anchor));
    };
    if (o.forces !== 'none') { add(0, -1, 'N', 'w'); add(0, 1, 'mg', 'w'); }
    if (o.forces === 'four' || !o.forces) { add(-1, 0, 'f', 'e'); add(1, 0, 'F', 'w'); }
    return items;
  },
};

const normal: Stencil = {
  id: 'normal', name: 'Normal curve', blurb: 'Bell curve with σ marks for statistics', aspect: 2,
  choices: [{ key: 'lines', label: 'Lines', options: [{ v: 'sd', label: 'At ±1, 2, 3σ' }, { v: 'none', label: 'Curve only' }] }],
  draw: (rr, o) => {
    const r = fit(rr, 2), s = ts(r);
    const base = r.bottom - s * 2.2, top = r.top + s * 0.5;
    const X = (z: number) => r.left + ((z + 3.6) / 7.2) * width(r);
    const pdf = (z: number) => Math.exp((-z * z) / 2);
    const Y = (z: number) => base - pdf(z) * (base - top);
    const pts: Pt[] = [];
    for (let i = 0; i <= 180; i++) { const z = -3.6 + (7.2 * i) / 180; pts.push(P(X(z), Y(z))); }
    const items: Item[] = [path(pts, 0, 'pen')];
    const ticks: Pt[] = [-3, -2, -1, 0, 1, 2, 3].map((z) => P(X(z), base));
    items.push(path(axisStroke(P(r.left, base), P(r.right, base), ticks, s * 0.3, 0), 0, 'fine'));
    if (o.lines !== 'none') for (const z of [-3, -2, -1, 0, 1, 2, 3]) items.push(path([P(X(z), base), P(X(z), Y(z))], z === 0 ? 157 : 201, 'fine'));
    const names = ['-3σ', '-2σ', '-σ', 'μ', 'σ', '2σ', '3σ'];
    [-3, -2, -1, 0, 1, 2, 3].forEach((z, i) => items.push(label(P(X(z), base + s * 0.6), names[i], s, 'n')));
    return items;
  },
};

const venn: Stencil = {
  id: 'venn', name: 'Venn diagram', blurb: 'Two or three sets in a universe', aspect: 1.4,
  choices: [{ key: 'sets', label: 'Sets', options: [{ v: '2', label: 'A and B' }, { v: '3', label: 'A, B and C' }] }],
  draw: (rr, o) => {
    const r = fit(rr, 1.4), s = ts(r) * 1.1;
    const items: Item[] = [path([P(r.left, r.top), P(r.right, r.top), P(r.right, r.bottom), P(r.left, r.bottom), P(r.left, r.top)], 0, 'fine')];
    items.push(label(P(r.left + s * 0.5, r.top + s * 0.5), 'U', s, 'nw'));
    const cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2;
    if (o.sets === '3') {
      const R = height(r) * 0.27, d = R * 0.62;
      const cs: [string, Pt][] = [['A', P(cx - d, cy - d * 0.45)], ['B', P(cx + d, cy - d * 0.45)], ['C', P(cx, cy + d * 0.85)]];
      for (const [n, c] of cs) {
        items.push(circle(c, R, 0, 'pen'));
        const away: Pt = [c[0] - cx, c[1] - cy]; const al = Math.hypot(away[0], away[1]) || 1;
        items.push(label(P(c[0] + (away[0] / al) * R * 1.12, c[1] + (away[1] / al) * R * 1.12), n, s, 'c'));
      }
    } else {
      const R = height(r) * 0.32, d = R * 0.62;
      items.push(circle(P(cx - d, cy), R, 0, 'pen'), circle(P(cx + d, cy), R, 0, 'pen'));
      items.push(label(P(cx - d - R * 0.75, cy - R * 0.85), 'A', s, 'c'), label(P(cx + d + R * 0.75, cy - R * 0.85), 'B', s, 'c'));
    }
    return items;
  },
};

const solids: Stencil = {
  id: 'solids', name: 'Solids', blurb: 'Cube, cylinder, cone and sphere, hidden edges in gray', aspect: 1,
  choices: [{ key: 'shape', label: 'Shape', options: [{ v: 'cube', label: 'Cube' }, { v: 'cylinder', label: 'Cylinder' }, { v: 'cone', label: 'Cone' }, { v: 'sphere', label: 'Sphere' }] }],
  draw: (rr, o) => {
    const r = fit(rr, 1);
    const c: Pt = [(r.left + r.right) / 2, (r.top + r.bottom) / 2];
    const S = width(r) * 0.3;
    const items: Item[] = [];
    const ell = (ctr: Pt, rx: number, ry: number, a0: number, a1: number, ink: Ink, w: Weight) =>
      path(Array.from({ length: 61 }, (_, i) => { const a = (a0 + ((a1 - a0) * i) / 60) * DEG; return P(ctr[0] + rx * Math.cos(a), ctr[1] - ry * Math.sin(a)); }), ink, w);
    switch (o.shape) {
      case 'cylinder': {
        const rx = S, ry = S * 0.3, top = c[1] - S * 1.1, bot = c[1] + S * 1.1;
        items.push({ kind: 'ellipse', c: P(c[0], top), rx, ry, angle: 0, ink: 0, weight: 'pen' });
        items.push(ell(P(c[0], bot), rx, ry, 180, 360, 0, 'pen'), ell(P(c[0], bot), rx, ry, 0, 180, 201, 'fine'));
        items.push(path([P(c[0] - rx, top), P(c[0] - rx, bot)], 0, 'pen'), path([P(c[0] + rx, top), P(c[0] + rx, bot)], 0, 'pen'));
        break;
      }
      case 'cone': {
        const rx = S, ry = S * 0.3, apex: Pt = P(c[0], c[1] - S * 1.25), bot = c[1] + S * 1.0;
        items.push(ell(P(c[0], bot), rx, ry, 180, 360, 0, 'pen'), ell(P(c[0], bot), rx, ry, 0, 180, 201, 'fine'));
        items.push(path([P(c[0] - rx, bot), apex, P(c[0] + rx, bot)], 0, 'pen'));
        items.push(path([apex, P(c[0], bot), P(c[0] + rx, bot)], 201, 'fine'));
        break;
      }
      case 'sphere': {
        const R = S * 1.15;
        items.push(circle(P(c[0], c[1]), R, 0, 'pen'));
        items.push(ell(P(c[0], c[1]), R, R * 0.28, 180, 360, 0, 'fine'), ell(P(c[0], c[1]), R, R * 0.28, 0, 180, 201, 'fine'));
        items.push(path([P(c[0], c[1]), P(c[0] + R, c[1])], 157, 'fine'), circle(P(c[0], c[1]), S * 0.03, 0, 'pen'));
        break;
      }
      default: {
        // cube, oblique projection: depth at 35 degrees, half length
        const a = S * 1.6, dx = a * 0.42, dy = a * 0.3;
        const F = (x: number, y: number): Pt => P(c[0] - a * 0.6 + x, c[1] + a * 0.4 - y);
        const B = (x: number, y: number): Pt => P(F(x, y)[0] + dx, F(x, y)[1] - dy);
        items.push(path([F(0, 0), F(a, 0), F(a, a), F(0, a), F(0, 0)], 0, 'pen'));
        items.push(path([F(0, a), B(0, a), B(a, a), B(a, 0), F(a, 0)], 0, 'pen'), path([F(a, a), B(a, a)], 0, 'pen'));
        items.push(path([F(0, 0), B(0, 0), B(a, 0)], 201, 'fine'), path([B(0, 0), B(0, a)], 201, 'fine'));
      }
    }
    return items;
  },
};

export const STENCILS: Stencil[] = [plane, unitCircle, numberLine, polarGrid, triangle, axes3d, incline, fbd, normal, venn, solids];

export function drawStencil(id: string, r: Rect, opt: Record<string, string>): Drawing {
  const st = STENCILS.find((s) => s.id === id) ?? STENCILS[0];
  const o: Record<string, string> = {};
  for (const c of st.choices) o[c.key] = opt[c.key] ?? c.options[0].v;
  return { items: st.draw(r, o), bounds: r };
}
