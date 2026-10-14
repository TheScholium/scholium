/** Shared types for the drawing engine. All coordinates are page pixels. */

export type Pt = [number, number];

export interface Rect { left: number; top: number; right: number; bottom: number; }

/** Supernote pen colors: black, dark gray, light gray. */
export type Ink = 0 | 157 | 201;

/** Stroke weight. The device adapter maps these to real pen widths. */
export type Weight = 'hair' | 'fine' | 'pen' | 'bold';

export interface PathItem { kind: 'path'; pts: Pt[]; ink: Ink; weight: Weight; }
export interface EllipseItem { kind: 'ellipse'; c: Pt; rx: number; ry: number; angle: number; ink: Ink; weight: Weight; }
/** Anchor: where the point sits on the text box. 'c' centre, 'n' top middle, 'sw' bottom left, ... */
export type Anchor = 'c' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
export interface LabelItem { kind: 'label'; at: Pt; text: string; size: number; anchor: Anchor; ink: Ink; }

export type Item = PathItem | EllipseItem | LabelItem;

export interface Drawing { items: Item[]; bounds: Rect; }

export const width = (r: Rect) => r.right - r.left;
export const height = (r: Rect) => r.bottom - r.top;
export const finite = (p: Pt | null): p is Pt => !!p && Number.isFinite(p[0]) && Number.isFinite(p[1]);
export const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);

export function path(pts: Pt[], ink: Ink = 0, weight: Weight = 'pen'): PathItem {
  return { kind: 'path', pts, ink, weight };
}
export function circle(c: Pt, r: number, ink: Ink = 0, weight: Weight = 'pen'): EllipseItem {
  return { kind: 'ellipse', c, rx: r, ry: r, angle: 0, ink, weight };
}
export function label(at: Pt, text: string, size: number, anchor: Anchor = 'c', ink: Ink = 0): LabelItem {
  return { kind: 'label', at, text, size, anchor, ink };
}
