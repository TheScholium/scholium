/**
 * Everything that talks to the tablet. The rest of the plugin is plain math.
 */
import { PluginCommAPI, PluginFileAPI, PluginManager, PluginNoteAPI } from 'sn-plugin-lib';
import type { Op } from './core/plan';
import type { Rect } from './core/types';

export interface PageInfo {
  path: string;
  page: number;
  width: number;
  height: number;
  /** NOTE files take text boxes; DOC (PDF, EPUB) files do not. */
  isNote: boolean;
}

/** SDK calls answer either { success, result, error } or a bare value. */
function unwrap<T>(r: any, what: string): T {
  if (r && typeof r === 'object' && 'success' in r) {
    if (!r.success) throw new Error(`${what}: ${r.error?.message ?? 'failed'}`);
    return r.result as T;
  }
  return r as T;
}

export async function pageInfo(): Promise<PageInfo> {
  let path = '', page = 0, width = 0, height = 0;
  try { path = unwrap<string>(await PluginCommAPI.getCurrentFilePath(), 'getCurrentFilePath') ?? ''; } catch { /* keep defaults */ }
  try { page = unwrap<number>(await PluginCommAPI.getCurrentPageNum(), 'getCurrentPageNum') ?? 0; } catch { /* keep defaults */ }
  try {
    const s = unwrap<{ width: number; height: number }>(await PluginFileAPI.getPageSize(path, page), 'getPageSize');
    width = s?.width ?? 0; height = s?.height ?? 0;
  } catch { /* fall back below */ }
  if (!(width > 0 && height > 0)) {
    let type = 4;
    try { type = await PluginManager.getDeviceType(); } catch { /* assume Nomad */ }
    [width, height] = type === 5 ? [1920, 2560] : [1404, 1872];
  }
  return { path, page, width, height, isNote: /\.note$/i.test(path) || path === '' };
}

export async function lassoRect(): Promise<Rect | null> {
  try {
    const r = unwrap<Rect>(await PluginCommAPI.getLassoRect(), 'getLassoRect');
    if (r && r.right > r.left && r.bottom > r.top) return r;
  } catch { /* no lasso */ }
  return null;
}

/** Typed text in the lasso (NOTE only, no permission needed). */
export async function lassoText(): Promise<string> {
  try {
    const boxes = unwrap<any[]>(await PluginNoteAPI.getLassoText(), 'getLassoText') ?? [];
    return boxes.map((b) => b?.textContentFull ?? '').filter(Boolean).join('\n');
  } catch { return ''; }
}

const READ = 'plugin.permission.FILE:READ';

/**
 * Handwriting in the lasso, turned into text by the tablet's own recognizer.
 * Needs FILE:READ, which the user is asked for the first time.
 */
export async function lassoHandwriting(page: PageInfo): Promise<string> {
  let ok = await PluginManager.hasPermission(READ);
  if (ok !== 1) ok = await PluginManager.requestPermission(READ, 'Scholium Plot reads the handwriting you selected, to turn it into an equation.');
  if (ok !== 1 && ok !== 2) throw new Error('Permission to read the selection was not given.');
  const els = unwrap<any[]>(await PluginCommAPI.getLassoElements(), 'getLassoElements') ?? [];
  const strokes = els.filter((e) => e && e.type === 0); // Element.TYPE_STROKE
  if (!strokes.length) return '';
  return unwrap<string>(await PluginCommAPI.recognizeElements(strokes, { width: page.width, height: page.height }), 'recognizeElements') ?? '';
}

export interface DrawProgress { done: number; total: number; failed: number; lastError?: string; }

/**
 * Send the calls one by one. Every call is awaited, so the tablet is never
 * flooded, and a failed call does not stop the rest of the figure.
 */
export async function run(ops: Op[], onProgress: (p: DrawProgress) => void, cancelled: () => boolean): Promise<DrawProgress> {
  const st: DrawProgress = { done: 0, total: ops.length, failed: 0 };
  try { await PluginCommAPI.setLassoBoxState(2); } catch { /* no lasso to clear */ }
  for (const op of ops) {
    if (cancelled()) break;
    try {
      const r = op.t === 'geo' ? await PluginCommAPI.insertGeometry(op.g) : await PluginNoteAPI.insertText(op.box);
      unwrap(r, op.t === 'geo' ? 'insertGeometry' : 'insertText');
    } catch (e) {
      st.failed++;
      st.lastError = (e as Error).message;
    }
    st.done++;
    if (st.done % 4 === 0 || st.done === st.total) onProgress({ ...st });
  }
  return st;
}

/** Select the new figure so it can be moved or resized straight away. */
export async function selectArea(r: Rect): Promise<void> {
  try { unwrap(await PluginCommAPI.lassoElements(r), 'lassoElements'); } catch { /* selection is a nicety */ }
}

export async function close(): Promise<void> {
  try { await PluginManager.closePluginView(); } catch { /* already closed */ }
}
