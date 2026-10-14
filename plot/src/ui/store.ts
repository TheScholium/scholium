/**
 * Plugin state. It lives at module level so it survives the plugin view
 * being closed and opened again: your last graph is still there.
 */
import { DEFAULTS, PlotOpts } from '../core/figure';
import type { LabelMode } from '../core/plan';

export type Launch = { from: 'toolbar' | 'lasso'; n: number };
export type Size = 'small' | 'medium' | 'large';
export type Place = 'top' | 'middle' | 'bottom';
export type Weight = 'light' | 'medium' | 'heavy';

export interface Settings {
  tab: 'graph' | 'stencils';
  /** Text of each field, as typed. Numbers are parsed when drawing. */
  lines: string[];
  x0: string; x1: string; y0: string; y1: string; t0: string; t1: string;
  opts: Omit<PlotOpts, 'lines' | 'x' | 'y' | 't'>;
  tangent: string; areaA: string; areaB: string; riemannN: string; riemannRule: 'left' | 'mid' | 'right';
  extras: 'none' | 'tangent' | 'area' | 'riemann';
  labels: LabelMode;
  size: Size;
  place: Place;
  weight: Weight;
  selectAfter: boolean;
  stencil: string;
  stencilOpts: Record<string, Record<string, string>>;
}

export const settings: Settings = {
  tab: 'graph',
  lines: ['y = sin x', '', ''],
  x0: '-2π', x1: '2π', y0: '-2', y1: '2', t0: '0', t1: '2π',
  opts: { ...DEFAULTS },
  tangent: '1', areaA: '0', areaB: 'π', riemannN: '6', riemannRule: 'mid',
  extras: 'none',
  labels: 'ink',
  size: 'medium',
  place: 'middle',
  weight: 'medium',
  selectAfter: true,
  stencil: 'plane',
  stencilOpts: {},
};

let launch: Launch = { from: 'toolbar', n: 0 };
const subs = new Set<(l: Launch) => void>();

export function setLaunch(from: Launch['from']) {
  launch = { from, n: launch.n + 1 };
  subs.forEach((f) => f(launch));
}
export function getLaunch() { return launch; }
export function onLaunch(f: (l: Launch) => void) { subs.add(f); return () => { subs.delete(f); }; }
