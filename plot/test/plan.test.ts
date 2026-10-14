import { plan, placeFigure, opsBounds, WIDTHS } from '../src/core/plan';
import { plot, DEFAULTS } from '../src/core/figure';
import { drawStencil, STENCILS } from '../src/core/stencils';
import { path, circle, label } from '../src/core/types';
import { ok, done } from './t';

const page = { width: 1404, height: 1872 };
const P = (labels: any = 'ink') => ({ labels, widths: WIDTHS.medium, page, retrace: true });
let ops = plan({ items: [path([[0, 0], [10, 0], [10, 10]])], bounds: { left: 0, top: 0, right: 10, bottom: 10 } }, P());
ok(ops.length === 1 && ops[0].t === 'geo' && ops[0].g.points.length === 5, 'open path retraced');
const g0 = ops[0].t === 'geo' ? ops[0].g : null;
ok(!!g0 && g0.points[4].x === 0 && g0.points[4].y === 0, 'retrace ends at start');
ops = plan({ items: [path([[0, 0], [10, 0]])], bounds: { left: 0, top: 0, right: 10, bottom: 10 } }, P());
ok(ops[0].t === 'geo' && ops[0].g.type === 'straightLine', 'two points -> straight line');
ops = plan({ items: [circle([50, 50], 20)], bounds: { left: 0, top: 0, right: 100, bottom: 100 } }, P());
ok(ops[0].t === 'geo' && ops[0].g.type === 'GEO_circle' && ops[0].g.ellipseMajorAxisRadius === 20, 'circle');
ops = plan({ items: [label([50, 50], '12', 20)], bounds: { left: 0, top: 0, right: 100, bottom: 100 } }, P('text'));
ok(ops[0].t === 'text' && ops[0].box.textContentFull === '12', 'text label');
ops = plan({ items: [label([50, 50], '12', 20)], bounds: { left: 0, top: 0, right: 100, bottom: 100 } }, P('none'));
ok(ops.length === 0, 'no labels');
ops = plan({ items: [path([[-50, 5], [3000, 5]])], bounds: { left: 0, top: 0, right: 10, bottom: 10 } }, P());
ok(ops[0].t === 'geo' && ops[0].g.points.every((p) => p.x >= 0 && p.x <= 1404), 'clamped to page');
// every geometry from real figures passes the SDK's own rules
const figs = [plot({ ...DEFAULTS, lines: ['y = tan x', 'x^2 + y^2 = 4', "y' = y, y(0)=1"], marks: true }, placeFigure(page, 'large', 4 / 3, null)).drawing,
  ...STENCILS.map((s) => drawStencil(s.id, placeFigure(page, 'medium', s.aspect, null), {}))];
let bad = 0, n = 0, maxPts = 0;
for (const f of figs) for (const op of plan(f, P())) {
  n++;
  if (op.t !== 'geo') continue;
  const g = op.g;
  if (!Number.isInteger(g.penColor) || g.penWidth < 100 || ![0, 157, 201].includes(g.penColor)) bad++;
  if (g.points.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))) bad++;
  maxPts = Math.max(maxPts, g.points.length);
}
ok(bad === 0, `all ${n} calls valid`);
ok(maxPts <= 480, `max points per call ${maxPts}`);
const r = placeFigure(page, 'medium', 4 / 3, { left: 100, top: 200, right: 500, bottom: 300 });
ok(r.top > 300 && r.bottom < 1872, 'placed under lasso');
const r2 = placeFigure(page, 'large', 4 / 3, { left: 100, top: 1500, right: 500, bottom: 1700 });
ok(r2.bottom < 1500, 'placed above when no room below');
ok(opsBounds(plan(figs[0], P()), page) !== null, 'bounds');
done('plan');
