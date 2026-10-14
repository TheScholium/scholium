/**
 * Turn a Drawing into the exact calls the tablet will receive.
 * Kept free of the SDK so it can be tested on a laptop.
 */
import { Drawing, Item, Pt, Weight, Rect } from './types';
import { labelInk } from './figure';
import { measure } from './font';

export type LabelMode = 'ink' | 'text' | 'none';

export interface GeometryCall {
  penColor: number;
  penType: number;
  penWidth: number;
  type: 'straightLine' | 'GEO_circle' | 'GEO_ellipse' | 'GEO_polygon';
  points: { x: number; y: number }[];
  ellipseCenterPoint: { x: number; y: number } | null;
  ellipseMajorAxisRadius: number;
  ellipseMinorAxisRadius: number;
  ellipseAngle: number;
  showLassoAfterInsert: boolean;
}

export interface TextCall {
  textContentFull: string;
  textRect: Rect;
  fontSize: number;
  textAlign: number;
  textBold: number;
  textItalics: number;
  textFrameWidthType: number;
  textFrameStyle: number;
  textEditable: number;
}

export type Op = { t: 'geo'; g: GeometryCall } | { t: 'text'; box: TextCall };

export interface PlanOpts {
  labels: LabelMode;
  /** Pen width for each weight; the SDK minimum is 100. */
  widths: Record<Weight, number>;
  page: { width: number; height: number };
  /** Draw each open path forward and back, so a closing edge cannot appear. */
  retrace: boolean;
}

export const WIDTHS: Record<'light' | 'medium' | 'heavy', Record<Weight, number>> = {
  light: { hair: 100, fine: 100, pen: 150, bold: 250 },
  medium: { hair: 100, fine: 150, pen: 220, bold: 350 },
  heavy: { hair: 100, fine: 200, pen: 320, bold: 500 },
};

const TECHNICAL_PEN = 10;

export function plan(d: Drawing, o: PlanOpts): Op[] {
  const W = o.page.width, H = o.page.height;
  const cl = ([x, y]: Pt) => ({ x: Math.round(Math.max(0, Math.min(W, x))), y: Math.round(Math.max(0, Math.min(H, y))) });
  const ops: Op[] = [];
  const base = (ink: number, w: Weight) => ({
    penColor: ink, penType: TECHNICAL_PEN, penWidth: Math.max(100, Math.round(o.widths[w])),
    ellipseCenterPoint: null, ellipseMajorAxisRadius: 0, ellipseMinorAxisRadius: 0, ellipseAngle: 0, showLassoAfterInsert: false,
  });
  const pushPath = (it: Extract<Item, { kind: 'path' }>) => {
    // drop repeated points after rounding
    const pts: { x: number; y: number }[] = [];
    for (const p of it.pts) { const q = cl(p); const l = pts[pts.length - 1]; if (!l || l.x !== q.x || l.y !== q.y) pts.push(q); }
    if (pts.length < 2) return;
    if (pts.length === 2) { ops.push({ t: 'geo', g: { ...base(it.ink, it.weight), type: 'straightLine', points: pts } }); return; }
    const closed = pts[0].x === pts[pts.length - 1].x && pts[0].y === pts[pts.length - 1].y;
    const out = closed || !o.retrace ? pts : [...pts, ...pts.slice(0, -1).reverse()];
    ops.push({ t: 'geo', g: { ...base(it.ink, it.weight), type: 'GEO_polygon', points: out } });
  };
  for (const it of d.items) {
    if (it.kind === 'path') pushPath(it);
    else if (it.kind === 'ellipse') {
      const circ = Math.abs(it.rx - it.ry) < 0.5;
      ops.push({ t: 'geo', g: {
        ...base(it.ink, it.weight), type: circ ? 'GEO_circle' : 'GEO_ellipse', points: [],
        ellipseCenterPoint: cl(it.c), ellipseMajorAxisRadius: Math.round(Math.max(it.rx, it.ry) * 10) / 10,
        ellipseMinorAxisRadius: Math.round(Math.min(it.rx, it.ry) * 10) / 10,
        ellipseAngle: it.rx >= it.ry ? it.angle : it.angle + Math.PI / 2,
      } });
    } else if (it.kind === 'label') {
      if (o.labels === 'none') continue;
      if (o.labels === 'ink') { for (const p of labelInk(it)) if (p.kind === 'path') pushPath(p); continue; }
      // a text box around the label, with a little air for the font's side bearings
      const w = measure(it.text) * it.size * 1.3 + it.size * 1.2, h = it.size * 2.2;
      const a = it.anchor;
      const left = a.includes('e') ? it.at[0] - w + it.size * 0.6 : a.includes('w') ? it.at[0] - it.size * 0.6 : it.at[0] - w / 2;
      const top = a.includes('n') ? it.at[1] - h * 0.2 : a.includes('s') ? it.at[1] - h * 0.8 : it.at[1] - h / 2;
      const r = { left: Math.round(left), top: Math.round(top), right: Math.round(left + w), bottom: Math.round(top + h) };
      ops.push({ t: 'text', box: {
        textContentFull: it.text, textRect: r, fontSize: Math.round(it.size * 1.45), textAlign: a.includes('e') ? 2 : a.includes('w') ? 0 : 1,
        textBold: 0, textItalics: 0, textFrameWidthType: 0, textFrameStyle: 0, textEditable: 0,
      } });
    }
  }
  return ops;
}

/** Bounding box of everything drawn, padded, clamped to the page. */
export function opsBounds(ops: Op[], page: { width: number; height: number }, pad = 8): Rect | null {
  let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
  const add = (x: number, y: number) => { l = Math.min(l, x); t = Math.min(t, y); r = Math.max(r, x); b = Math.max(b, y); };
  for (const op of ops) {
    if (op.t === 'text') { add(op.box.textRect.left, op.box.textRect.top); add(op.box.textRect.right, op.box.textRect.bottom); continue; }
    const g = op.g;
    if (g.ellipseCenterPoint) { const R = g.ellipseMajorAxisRadius; add(g.ellipseCenterPoint.x - R, g.ellipseCenterPoint.y - R); add(g.ellipseCenterPoint.x + R, g.ellipseCenterPoint.y + R); }
    for (const p of g.points) add(p.x, p.y);
  }
  if (!Number.isFinite(l)) return null;
  return { left: Math.max(0, Math.floor(l - pad)), top: Math.max(0, Math.floor(t - pad)), right: Math.min(page.width, Math.ceil(r + pad)), bottom: Math.min(page.height, Math.ceil(b + pad)) };
}

/** Where to put a figure: under the lasso if it fits, else above, else the middle of the page. */
export function placeFigure(page: { width: number; height: number }, size: 'small' | 'medium' | 'large', aspect: number, lasso: Rect | null, position: 'top' | 'middle' | 'bottom' = 'middle'): Rect {
  const frac = size === 'small' ? 0.5 : size === 'large' ? 0.9 : 0.72;
  const margin = Math.round(page.width * 0.05);
  let w = Math.round(page.width * frac);
  let h = Math.round(w / aspect);
  const maxH = page.height - 2 * margin;
  if (h > maxH) { h = maxH; w = Math.round(h * aspect); }
  const cxFrom = (cx: number) => Math.round(Math.max(margin, Math.min(page.width - margin - w, cx - w / 2)));
  if (lasso) {
    const cx = (lasso.left + lasso.right) / 2, gap = Math.round(page.height * 0.015);
    if (lasso.bottom + gap + h <= page.height - margin) return { left: cxFrom(cx), top: lasso.bottom + gap, right: cxFrom(cx) + w, bottom: lasso.bottom + gap + h };
    if (lasso.top - gap - h >= margin) return { left: cxFrom(cx), top: lasso.top - gap - h, right: cxFrom(cx) + w, bottom: lasso.top - gap };
  }
  const left = Math.round((page.width - w) / 2);
  const top = position === 'top' ? margin * 2 : position === 'bottom' ? page.height - margin * 2 - h : Math.round((page.height - h) / 2);
  return { left, top, right: left + w, bottom: top + h };
}
