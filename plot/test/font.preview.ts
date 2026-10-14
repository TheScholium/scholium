import { strokes, measure } from '../src/core/font';
import { path, Drawing } from '../src/core/types';
import { writeFileSync } from 'fs';
const lines = ['0123456789', '-3.5 + 2 = π/2  -3π/4', 'x y z r t θ a b c d', 'e f g h i k m n s v', 'A B C E F N P T W', 'σ μ α ∞ ° (2, 1)', 'mg  N  F  W  f  θ = 30°'];
const items = [];
let y = 90;
for (const l of lines) { for (const s of strokes(l, 30, y, 50)) items.push(path(s, 0, 'pen')); y += 95; }
const d: Drawing = { items, bounds: { left: 0, top: 0, right: 900, bottom: y } };
writeFileSync('build/preview/font.json', JSON.stringify({ font: d }));
console.log('strokes', items.length, 'w', measure(lines[0]));
