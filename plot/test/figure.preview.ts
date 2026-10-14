import { plot, DEFAULTS, inkLabels, PlotOpts, autoY } from '../src/core/figure';
import { writeFileSync } from 'fs';
const R = { left: 100, top: 100, right: 1300, bottom: 1000 };
const cases: Record<string, Partial<PlotOpts>> = {
  trig: { lines: ['y = sin x', 'y = cos x', 'y = tan x'], x: [-2 * Math.PI, 2 * Math.PI], y: [-3, 3], marks: true },
  poly: { lines: ['y = x^3 - 3x', 'y = x'], x: [-3, 3], y: [-4, 4], marks: true, grid: 'minor', tangentAt: 1.5 },
  implicit: { lines: ['x^2 + y^2 = 9', 'x^2/16 + y^2/4 = 1', 'y^2 = x^3 - x'], x: [-5, 5], y: [-4, 4], equal: true },
  polar: { lines: ['r = 1 + cos θ', 'r = cos(3θ)', '(cos 3t, sin 2t)'], x: [-2, 2.5], y: [-1.5, 1.5], equal: true, grid: 'none' },
  slope: { lines: ["y' = x - y, y(0) = 1", "y' = x - y, y(0) = -1"], x: [-3, 3], y: [-3, 3], equal: true, grid: 'none', inks: [0, 0, 0] },
  area: { lines: ['y = 4 - x^2'], x: [-1, 3], y: [-1, 5], area: [0, 2], riemann: { a: 0, b: 2, n: 6, rule: 'mid' }, frame: true, grid: 'none' },
  framed: { lines: ['y = e^(-x^2/2)/sqrt(2pi)'], x: [-4, 4], y: [0, 0.5], frame: true, grid: 'major' },
};
const out: any = {}, outInk: any = {};
for (const [k, c] of Object.entries(cases)) {
  const r = plot({ ...DEFAULTS, ...c } as PlotOpts, R);
  if (r.results.some((x) => x.error)) console.log(k, r.results);
  out[k] = { ...r.drawing, page: [1404, 1100], scale: 0.6 };
  const ink = inkLabels(r.drawing);
  outInk[k] = { ...ink, page: [1404, 1100], scale: 0.6 };
  const paths = ink.items.length, pts = ink.items.reduce((s, i: any) => s + (i.pts ? i.pts.length : 0), 0);
  console.log(k.padEnd(9), 'items', r.drawing.items.length, 'ink calls', paths, 'points', pts);
}
console.log('autoY', autoY(['y = x^2'], -3, 3), autoY(['y = 1/x'], -5, 5));
writeFileSync('build/preview/fig.json', JSON.stringify(outInk));
