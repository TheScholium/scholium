import { autoWindow } from '../src/core/zoom';
import { plot, DEFAULTS, inkLabels, PlotOpts } from '../src/core/figure';
import { writeFileSync } from 'fs';
const R = { left: 40, top: 40, right: 840, bottom: 640 };
const cases = [
  ['y = x^2 - 4'], ['y = sin x'], ['y = tan x'], ['y = 1/(x - 3)'], ['y = e^x'], ['y = ln x'],
  ['y = x^3 - 6x^2 + 9x + 1'], ['y = (x - 50)^2'], ['y = sqrt(9 - x^2)'], ['y = sin(10x)'],
  ['x^2 + y^2 = 25'], ['x^2/16 + y^2/4 = 1'], ['x^2 - y^2 = 1'], ['r = 1 + cos θ'], ['(3cos t, 2sin 3t)'],
  ['y = x^2', 'y = 2x + 3'], ["y' = x - y, y(0) = 1"], ['x = y^2 - 4'], ['y = 1000x^2'], ['y = 0.001 sin(x)'],
];
const out: any = {};
cases.forEach((lines, i) => {
  const w = autoWindow(lines, [0, 2 * Math.PI], 800 / 600);
  console.log(lines.join(' ; ').padEnd(28), w ? `x [${w.x.map((v) => +v.toFixed(3))}]  y [${w.y.map((v) => +v.toFixed(3))}]` : 'null');
  if (w) out[String(i).padStart(2, '0')] = { ...inkLabels(plot({ ...DEFAULTS, lines, x: w.x, y: w.y, t: [0, 2 * Math.PI], marks: true } as PlotOpts, R).drawing), page: [880, 680], scale: 0.5 };
});
writeFileSync('build/preview/zoom.json', JSON.stringify(out));
