import { trace, clipPolylines, simplify, chunk } from '../src/core/sample';
import { compile } from '../src/core/expr';
import { Pt, Rect } from '../src/core/types';
import { ok, done } from './t';

const box: Rect = { left: 0, top: 0, right: 1000, bottom: 1000 };
// world [-10,10]^2 -> box
const X = (x: number) => (x + 10) * 50, Y = (y: number) => (10 - y) * 50;
const fnTrace = (s: string, a = -10, b = 10) => {
  const f = compile(s, ['x']).fn;
  return trace((t) => [X(t), Y(f({ x: t }))], a, b, box);
};
const inBox = (ps: Pt[][]) => ps.every((p) => p.every(([x, y]) => x >= -1e-6 && x <= 1000 + 1e-6 && y >= -1e-6 && y <= 1000 + 1e-6));
const count = (ps: Pt[][]) => ps.reduce((s, p) => s + p.length, 0);

let r = fnTrace('x');
ok(r.length === 1 && r[0].length === 2, `line simplifies to 2 points (${r.map((p) => p.length)})`);
r = fnTrace('tan x');
ok(r.length === 7 || r.length === 8, `tan has 7 branches in [-10,10], got ${r.length}`);
ok(inBox(r), 'tan clipped');
// no near-vertical connecting segment across an asymptote
const vert = r.some((p) => p.some((q, i) => i > 0 && Math.abs(q[1] - p[i - 1][1]) > 900 && Math.abs(q[0] - p[i - 1][0]) < 2));
ok(!vert, 'no false asymptote line');
r = fnTrace('1/x');
ok(r.length === 2, `1/x two branches got ${r.length}`);
r = fnTrace('1/x^2');
ok(r.length === 2, `1/x^2 two branches got ${r.length}`);
r = fnTrace('sqrt(x)');
ok(r.length === 1 && Math.abs(r[0][0][0] - 500) < 1, `sqrt starts at 0: ${r[0] && r[0][0]}`);
r = fnTrace('sqrt(1 - x^2)');
ok(r.length === 1 && Math.abs(r[0][0][0] - 450) < 1 && Math.abs(r[0][r[0].length - 1][0] - 550) < 1, 'semicircle domain ends');
r = fnTrace('sin(1/x)');
ok(r.length >= 1 && count(r) < 4000, `sin(1/x) bounded points ${count(r)}`);
r = fnTrace('floor(x)');
ok(r.length === 20 || r.length === 21, `floor steps ${r.length}`);
r = fnTrace('sin x');
ok(count(r) < 200, `sin x points ${count(r)}`);
r = fnTrace('x^2 sin(10x)');
console.log('x^2 sin 10x points', count(r));
// clipping keeps a polyline that leaves and comes back as two pieces
const c = clipPolylines([[[-10, 500], [500, 500], [500, 1200], [600, 1200], [600, 500], [700, 500]]], box);
ok(c.length === 2, 'clip splits');
ok(simplify([[0, 0], [1, 0.01], [2, 0]], 0.1).length === 2, 'simplify');
const ch = chunk(Array.from({ length: 1000 }, (_, i) => [i, 0] as Pt), 250);
ok(ch.length === 5 && ch[0][249][0] === ch[1][0][0], 'chunk overlaps');
// timing
const t0 = Date.now();
for (let i = 0; i < 20; i++) fnTrace('sin(x) + cos(3x)/3 + tan(x/4)');
console.log('ms per curve', (Date.now() - t0) / 20);
done('sample');
