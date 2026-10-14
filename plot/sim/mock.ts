/**
 * A stand-in for sn-plugin-lib, so the plugin runs in a browser.
 * Every call the plugin makes is recorded on a pretend page.
 */
export type Rect = { left: number; top: number; right: number; bottom: number };

export const sim = {
  page: { width: 1404, height: 1872 },
  path: '/storage/emulated/0/Note/Calculus.note',
  geometries: [] as any[],
  texts: [] as any[],
  strokes: [] as { pts: [number, number][] }[],
  lasso: null as Rect | null,
  recognized: '',
  typed: '',
  calls: 0,
  delay: 4,
  listeners: new Set<() => void>(),
  closed: () => {},
  changed() { this.listeners.forEach((f) => f()); },
};

const ok = <T>(result: T) => ({ success: true, result });
const wait = () => new Promise((r) => setTimeout(r, sim.delay));

export const PluginCommAPI = {
  async getCurrentFilePath() { return ok(sim.path); },
  async getCurrentPageNum() { return ok(0); },
  async getLassoRect() { return sim.lasso ? ok(sim.lasso) : { success: false, error: { message: 'no lasso' } }; },
  async setLassoBoxState(_s: number) { sim.lasso = null; sim.changed(); return ok(true); },
  async lassoElements(r: Rect) { sim.lasso = r; sim.changed(); return ok(true); },
  async getLassoElements() { return ok(sim.strokes.map((s, i) => ({ type: 0, uuid: String(i), ...s }))); },
  async recognizeElements() { return ok(sim.recognized); },
  async insertGeometry(g: any) { await wait(); sim.calls++; sim.geometries.push(g); if (sim.calls % 6 === 0) sim.changed(); return ok(true); },
};
export const PluginNoteAPI = {
  async getLassoText() { return ok(sim.typed ? [{ textContentFull: sim.typed }] : []); },
  async insertText(t: any) { await wait(); sim.calls++; sim.texts.push(t); return ok(true); },
};
export const PluginFileAPI = {
  async getPageSize() { return ok(sim.page); },
};
export const PluginManager = {
  init() {},
  async getDeviceType() { return 4; },
  async closePluginView() { sim.closed(); return true; },
  async hasPermission() { return 1; },
  async requestPermission() { return 2; },
  registerButton() { return Promise.resolve(true); },
  registerButtonListener() { return { remove() {} }; },
};
