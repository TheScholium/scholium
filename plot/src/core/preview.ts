/** Flatten a Drawing into straight segments for an on-screen preview. */
import { Drawing, Pt, Weight } from './types';
import { labelInk } from './figure';
import { simplify } from './sample';

export interface Seg { x: number; y: number; len: number; angle: number; w: number; color: string; }
export interface PText { x: number; y: number; text: string; size: number; anchor: string; color: string; }

export const INK_CSS: Record<number, string> = { 0: '#000000', 157: '#555555', 201: '#a0a0a0' };
const PAGE_W: Record<Weight, number> = { hair: 1.4, fine: 2.0, pen: 3.0, bold: 4.5 };

export function flatten(d: Drawing, view: { w: number; h: number }, opts: { inkLabels: boolean; maxSegs?: number }) {
  const b = d.bounds;
  const s = Math.min(view.w / (b.right - b.left), view.h / (b.bottom - b.top));
  const ox = (view.w - (b.right - b.left) * s) / 2 - b.left * s;
  const oy = (view.h - (b.bottom - b.top) * s) / 2 - b.top * s;
  const T = ([x, y]: Pt): Pt => [x * s + ox, y * s + oy];
  const segs: Seg[] = [];
  const texts: PText[] = [];
  const addPath = (pts: Pt[], ink: number, weight: Weight) => {
    const q = simplify(pts.map(T), 0.25);
    const w = Math.max(1, PAGE_W[weight] * s);
    for (let i = 1; i < q.length; i++) {
      const [x0, y0] = q[i - 1], [x1, y1] = q[i];
      const len = Math.hypot(x1 - x0, y1 - y0);
      if (len < 0.3) continue;
      segs.push({ x: (x0 + x1) / 2, y: (y0 + y1) / 2, len: len + w * 0.5, angle: Math.atan2(y1 - y0, x1 - x0), w, color: INK_CSS[ink] ?? '#000' });
    }
  };
  for (const it of d.items) {
    if (it.kind === 'path') addPath(it.pts, it.ink, it.weight);
    else if (it.kind === 'ellipse') {
      const pts: Pt[] = [];
      for (let k = 0; k <= 48; k++) {
        const a = (2 * Math.PI * k) / 48, ca = Math.cos(it.angle), sa = Math.sin(it.angle);
        const ex = it.rx * Math.cos(a), ey = it.ry * Math.sin(a);
        pts.push([it.c[0] + ex * ca - ey * sa, it.c[1] + ex * sa + ey * ca]);
      }
      addPath(pts, it.ink, it.weight);
    } else if (opts.inkLabels) {
      for (const p of labelInk(it)) if (p.kind === 'path') addPath(p.pts, p.ink, p.weight);
    } else {
      const [x, y] = T(it.at);
      texts.push({ x, y, text: it.text, size: it.size * s * 1.4, anchor: it.anchor, color: INK_CSS[it.ink] });
    }
  }
  const max = opts.maxSegs ?? 2500;
  return { segs: segs.length > max ? segs.filter((_, i) => i % Math.ceil(segs.length / max) === 0) : segs, texts, scale: s };
}
