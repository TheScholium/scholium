/**
 * Scholium Plot: graphs and diagrams, drawn onto the page in real ink.
 */
import React, { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { plot, parseLines, PlotOpts, PlotResult } from './src/core/figure';
import { evalNumber } from './src/core/expr';
import { STENCILS, drawStencil } from './src/core/stencils';
import { plan, placeFigure, opsBounds, WIDTHS } from './src/core/plan';
import { cleanRecognized } from './src/core/recog';
import { autoWindow } from './src/core/zoom';
import { piLabel } from './src/core/ticks';
import type { Drawing, Rect } from './src/core/types';
import { Preview } from './src/ui/Preview';
import { Keypad, MathField, applyKey, KeyAction } from './src/ui/Keypad';
import { Button, C, Chip, Choice, Row, SERIF, Toggle } from './src/ui/kit';
import { settings as S, getLaunch, onLaunch, Launch } from './src/ui/store';
import * as device from './src/device';

type FieldId = 'line0' | 'line1' | 'line2' | 'x0' | 'x1' | 'y0' | 'y1' | 't0' | 't1' | 'tangent' | 'areaA' | 'areaB' | 'riemannN';

const getField = (id: FieldId): string => (id.startsWith('line') ? S.lines[Number(id[4])] : (S as any)[id]) ?? '';
const setField = (id: FieldId, v: string) => { if (id.startsWith('line')) S.lines[Number(id[4])] = v; else (S as any)[id] = v; };

const KIND_NAME: Record<string, string> = {
  function: 'y = f(x)', xfunction: 'x = g(y)', polar: 'polar r(θ)', parametric: 'parametric (x(t), y(t))',
  implicit: 'implicit curve', slope: 'slope field', vertical: 'vertical line',
};

const PRESETS: { label: string; x: [string, string]; y: [string, string] }[] = [
  { label: '±10', x: ['-10', '10'], y: ['-10', '10'] },
  { label: '±5', x: ['-5', '5'], y: ['-5', '5'] },
  { label: 'Trig', x: ['-2π', '2π'], y: ['-2', '2'] },
  { label: 'Unit', x: ['-1.5', '1.5'], y: ['-1.5', '1.5'] },
  { label: 'First quadrant', x: ['0', '10'], y: ['0', '10'] },
];

function num(s: string): number | null { try { return evalNumber(s); } catch { return null; } }

export default function App(): React.JSX.Element {
  const [, force] = useReducer((x: number) => x + 1, 0);
  const set = (patch: Partial<typeof S>) => { Object.assign(S, patch); force(); };
  const setOpt = (patch: Partial<typeof S.opts>) => { Object.assign(S.opts, patch); force(); };
  // The plugin view's own size (the whole screen on the tablet).
  const win = useWindowDimensions();
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const winW = box?.w ?? win.width, winH = box?.h ?? win.height;

  const [page, setPage] = useState<device.PageInfo | null>(null);
  const [lasso, setLasso] = useState<Rect | null>(null);
  const [launch, setLaunchState] = useState<Launch>(getLaunch());
  const [focus, setFocus] = useState<FieldId | null>('line0');
  const [cursor, setCursor] = useState(S.lines[0].length);
  const [busy, setBusy] = useState<{ done: number; total: number } | null>(null);
  const [note, setNote] = useState<string>('');
  const [abc, setAbc] = useState<string | null>(null);
  const cancel = useRef(false);

  // Each time a button opens the plugin, read the page and the selection again.
  useEffect(() => {
    const init = async (l: Launch) => {
      setLaunchState(l);
      setNote('');
      const p = await device.pageInfo();
      setPage(p);
      if (l.from === 'lasso') {
        const r = await device.lassoRect();
        setLasso(r);
        const typed = await device.lassoText();
        const lines = cleanRecognized(typed);
        if (lines.length) { S.lines = [...lines, '', ''].slice(0, 3); setFocus('line0'); setCursor(S.lines[0].length); setNote('Read the typed text in your selection.'); }
      } else setLasso(null);
      force();
    };
    init(getLaunch());
    return onLaunch(init);
  }, []);

  /* ---------- keypad ---------- */
  const onKey = (k: KeyAction) => {
    if (!focus) return;
    if ('act' in k && k.act === 'abc') { setAbc(getField(focus)); return; }
    if (['x0', 'x1', 'y0', 'y1'].includes(focus)) S.auto = false; // typing a window turns auto zoom off
    const r = applyKey(getField(focus), cursor, k);
    setField(focus, r.text);
    setCursor(r.cursor);
    force();
  };
  const focusField = (id: FieldId) => { setFocus(id); setCursor(getField(id).length); };

  /* ---------- the figure ---------- */
  const pageSize = page ?? { width: 1404, height: 1872, isNote: true, path: '', page: 0 };
  // Auto zoom: while it is on, the window follows the equations.
  const autoWin = useMemo(
    () => (S.auto && S.tab === 'graph' ? autoWindow(S.lines, [num(S.t0) ?? 0, num(S.t1) ?? 2 * Math.PI], 4 / 3) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [S.auto, S.tab, JSON.stringify(S.lines), S.t0, S.t1],
  );
  if (autoWin) {
    const px = (v: number) => (autoWin.pi ? piLabel(Math.round(v / (Math.PI / 2)), 2) : fmtNum(v));
    S.x0 = px(autoWin.x[0]); S.x1 = px(autoWin.x[1]);
    S.y0 = fmtNum(autoWin.y[0]); S.y1 = fmtNum(autoWin.y[1]);
  }
  const numbers = { x0: num(S.x0), x1: num(S.x1), y0: num(S.y0), y1: num(S.y1), t0: num(S.t0), t1: num(S.t1) };
  const stencil = STENCILS.find((x) => x.id === S.stencil) ?? STENCILS[0];
  const aspect = S.tab === 'stencils'
    ? stencil.aspect
    : S.opts.equal && numbers.x0 !== null && numbers.x1 !== null && numbers.y0 !== null && numbers.y1 !== null
      ? Math.max(0.6, Math.min(1.8, (numbers.x1 - numbers.x0) / Math.max(1e-9, numbers.y1 - numbers.y0)))
      : 4 / 3;
  const target = placeFigure(pageSize, S.size, aspect, lasso, S.place);
  const labelMode = S.labels === 'text' && !pageSize.isNote ? 'ink' : S.labels;

  const result: PlotResult | null = useMemo(() => {
    if (S.tab !== 'graph') return null;
    const { x0, x1, y0, y1, t0, t1 } = numbers;
    if (x0 === null || x1 === null || y0 === null || y1 === null) return null;
    const ex = S.extras;
    const o: PlotOpts = {
      ...S.opts, lines: S.lines, x: [x0, x1], y: [y0, y1], t: [t0 ?? 0, t1 ?? 2 * Math.PI],
      numbers: S.opts.numbers && labelMode !== 'none',
      tangentAt: ex === 'tangent' ? num(S.tangent) : null,
      area: ex === 'area' && num(S.areaA) !== null && num(S.areaB) !== null ? [num(S.areaA)!, num(S.areaB)!] : null,
      riemann: ex === 'riemann' && num(S.areaA) !== null && num(S.areaB) !== null ? { a: num(S.areaA)!, b: num(S.areaB)!, n: num(S.riemannN) ?? 4, rule: S.riemannRule } : null,
    };
    try { return plot(o, target); } catch { return null; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify([S.tab, S.lines, S.x0, S.x1, S.y0, S.y1, S.t0, S.t1, S.opts, S.extras, S.tangent, S.areaA, S.areaB, S.riemannN, S.riemannRule, target, labelMode])]);

  const stencilDrawing: Drawing | null = useMemo(
    () => (S.tab === 'stencils' ? drawStencil(S.stencil, target, S.stencilOpts[S.stencil] ?? {}) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [S.tab, S.stencil, JSON.stringify(S.stencilOpts), JSON.stringify(target)],
  );
  const drawing = S.tab === 'graph' ? result?.drawing ?? null : stencilDrawing;
  const kinds = S.tab === 'graph' ? parseLines(S.lines).results : [];
  const needsT = kinds.some((k) => k.kind === 'polar' || k.kind === 'parametric');

  const ops = useMemo(() => (drawing ? plan(drawing, { labels: labelMode, widths: WIDTHS[S.weight], page: pageSize, retrace: true }) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [drawing, labelMode, S.weight, pageSize.width, pageSize.height]);

  const drawNow = async () => {
    if (!ops.length || busy) return;
    cancel.current = false;
    setBusy({ done: 0, total: ops.length });
    const res = await device.run(ops, (p) => setBusy({ done: p.done, total: p.total }), () => cancel.current);
    setBusy(null);
    if (res.failed && res.failed === res.done) { setNote(`The tablet refused the drawing: ${res.lastError ?? 'unknown error'}`); return; }
    if (S.selectAfter && !cancel.current) { const b = opsBounds(ops, pageSize); if (b) await device.selectArea(b); }
    if (res.failed) { setNote(`${res.failed} of ${res.done} strokes failed (${res.lastError}). The rest are on the page.`); return; }
    await device.close();
  };

  const readHandwriting = async () => {
    if (!page) return;
    setNote('Reading…');
    try {
      const text = await device.lassoHandwriting(page);
      const lines = cleanRecognized(text);
      if (!lines.length) { setNote('No handwriting found in the selection.'); return; }
      S.lines = [...lines, '', ''].slice(0, 3);
      setFocus('line0'); setCursor(S.lines[0].length);
      setNote(`Read: ${lines.join('  ·  ')}. Check it before drawing.`);
    } catch (e) { setNote((e as Error).message); }
    force();
  };


  /* ---------- layout ---------- */
  const pad = Math.round(winW * 0.035);
  const inner = winW - 2 * pad;
  const prevH = Math.min(winH * 0.3, inner / aspect);
  const prevW = Math.min(inner, prevH * aspect);

  const field = (id: FieldId, ph?: string, small = true, error = false, style?: object) => (
    <MathField value={getField(id)} focused={focus === id} cursor={cursor} onFocus={() => focusField(id)} placeholder={ph} small={small} error={error} style={style} />
  );

  return (
    <View style={[st.root, { paddingHorizontal: pad }]} onLayout={(e) => { const { width, height } = e.nativeEvent.layout; if (!box || box.w !== width || box.h !== height) setBox({ w: width, h: height }); }}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <View style={st.header}>
        <Text style={st.title}>Scholium <Text style={{ fontStyle: 'italic' }}>Plot</Text></Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Chip label="Graph" on={S.tab === 'graph'} onPress={() => set({ tab: 'graph' })} />
          <Chip label="Stencils" on={S.tab === 'stencils'} onPress={() => set({ tab: 'stencils' })} />
          <Pressable onPress={() => device.close()} style={st.close}><Text style={st.closeText}>✕</Text></Pressable>
        </View>
      </View>

      <View style={{ alignItems: 'center', marginBottom: 8 }}>
        <Preview drawing={drawing} w={prevW} h={prevH} inkLabels={labelMode === 'ink'} />
        <Text style={st.caption}>
          {lasso ? 'Goes under your selection' : `${S.size[0].toUpperCase() + S.size.slice(1)}, ${S.place} of the page`} · {ops.length} strokes{note ? ` · ${note}` : ''}
        </Text>
      </View>

      <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="always">
        {S.tab === 'graph' ? (
          <>
            {[0, 1, 2].map((i) => {
              const k = kinds[i];
              return (
                <View key={i} style={st.lineRow}>
                  <View style={[st.swatch, { backgroundColor: ['#000', '#555', '#a0a0a0'][i] }]} />
                  {field(`line${i}` as FieldId, i === 0 ? 'y = …' : 'another curve (optional)', false, !!k?.error, { flex: 1 })}
                  <Text style={[st.kind, k?.error && { color: C.ink, fontWeight: '600' }]} numberOfLines={2}>{k?.error ?? (k?.kind ? KIND_NAME[k.kind] : '')}</Text>
                </View>
              );
            })}
            {launch.from === 'lasso' && <Row><Chip label="Read my handwriting" onPress={readHandwriting} /></Row>}

            <Row label="Window">
              <Text style={st.wl}>x</Text>{field('x0', 'min', true, numbers.x0 === null, st.num)}<Text style={st.wl}>to</Text>{field('x1', 'max', true, numbers.x1 === null, st.num)}
              <Text style={st.wl}>y</Text>{field('y0', 'min', true, numbers.y0 === null, st.num)}<Text style={st.wl}>to</Text>{field('y1', 'max', true, numbers.y1 === null, st.num)}
              <Chip label={S.auto ? '■ Auto' : '□ Auto'} on={false} onPress={() => set({ auto: !S.auto })} />
            </Row>
            {needsT && (
              <Row label="t, θ from">
                {field('t0', '0', true, numbers.t0 === null, st.num)}<Text style={st.wl}>to</Text>{field('t1', '2π', true, numbers.t1 === null, st.num)}
              </Row>
            )}
            <Row label="Presets">
              {PRESETS.map((p) => <Chip key={p.label} label={p.label} onPress={() => set({ auto: false, x0: p.x[0], x1: p.x[1], y0: p.y[0], y1: p.y[1] })} />)}
            </Row>
          </>
        ) : (
          <>
            <Row label="Stencil">
              {STENCILS.map((x) => <Chip key={x.id} label={x.name} on={x.id === S.stencil} onPress={() => set({ stencil: x.id })} />)}
            </Row>
            <Text style={st.blurb}>{stencil.blurb}</Text>
            {stencil.choices.map((c) => (
              <Row key={c.key} label={c.label}>
                <Choice value={(S.stencilOpts[stencil.id] ?? {})[c.key] ?? c.options[0].v} options={c.options}
                  onChange={(v) => { S.stencilOpts[stencil.id] = { ...(S.stencilOpts[stencil.id] ?? {}), [c.key]: v }; force(); }} />
              </Row>
            ))}
          </>
        )}

        {S.tab === 'graph' && (
          <>
            <Row label="Grid">
              <Choice value={S.opts.grid} options={[{ v: 'none', label: 'None' }, { v: 'major', label: 'Squares' }, { v: 'minor', label: 'Fine' }]} onChange={(v) => setOpt({ grid: v })} />
            </Row>
            <Row label="Show">
              <Toggle label="Axes" on={S.opts.axes} onChange={(v) => setOpt({ axes: v })} />
              <Toggle label="Numbers" on={S.opts.numbers} onChange={(v) => setOpt({ numbers: v })} />
              <Toggle label="Frame" on={S.opts.frame} onChange={(v) => setOpt({ frame: v })} />
              <Toggle label="Equal scale" on={S.opts.equal} onChange={(v) => setOpt({ equal: v })} />
              <Toggle label="Key points" on={S.opts.marks} onChange={(v) => setOpt({ marks: v })} />
              <Toggle label="π on x" on={S.opts.piX !== 'off'} onChange={(v) => setOpt({ piX: v ? 'auto' : 'off' })} />
            </Row>
            <Row label="Calculus">
              <Choice value={S.extras} options={[{ v: 'none', label: 'Off' }, { v: 'tangent', label: 'Tangent' }, { v: 'area', label: 'Area' }, { v: 'riemann', label: 'Riemann sum' }]} onChange={(v) => set({ extras: v })} />
            </Row>
            {S.extras === 'tangent' && <Row label=""><Text style={st.wl}>at x =</Text>{field('tangent', 'a', true, num(S.tangent) === null, st.num)}</Row>}
            {(S.extras === 'area' || S.extras === 'riemann') && (
              <Row label="">
                <Text style={st.wl}>from</Text>{field('areaA', 'a', true, num(S.areaA) === null, st.num)}<Text style={st.wl}>to</Text>{field('areaB', 'b', true, num(S.areaB) === null, st.num)}
                {S.extras === 'riemann' && <><Text style={st.wl}>n =</Text>{field('riemannN', 'n', true, num(S.riemannN) === null, st.num)}</>}
              </Row>
            )}
            {S.extras === 'riemann' && (
              <Row label=""><Choice value={S.riemannRule} options={[{ v: 'left', label: 'Left' }, { v: 'mid', label: 'Midpoint' }, { v: 'right', label: 'Right' }]} onChange={(v) => set({ riemannRule: v })} /></Row>
            )}
          </>
        )}

        <Row label="Size">
          <Choice value={S.size} options={[{ v: 'small', label: 'Small' }, { v: 'medium', label: 'Medium' }, { v: 'large', label: 'Large' }]} onChange={(v) => set({ size: v })} />
          {!lasso && <Choice value={S.place} options={[{ v: 'top', label: 'Top' }, { v: 'middle', label: 'Middle' }, { v: 'bottom', label: 'Bottom' }]} onChange={(v) => set({ place: v })} />}
        </Row>
        <Row label="Ink">
          <Choice value={S.weight} options={[{ v: 'light', label: 'Light' }, { v: 'medium', label: 'Medium' }, { v: 'heavy', label: 'Heavy' }]} onChange={(v) => set({ weight: v })} />
          <Choice value={S.labels} options={[{ v: 'ink', label: 'Numbers in ink' }, { v: 'text', label: 'As text boxes' }, { v: 'none', label: 'No numbers' }]} onChange={(v) => set({ labels: v })} />
        </Row>
        <Row label="After">
          <Toggle label="Select the figure, so I can move it" on={S.selectAfter} onChange={(v) => set({ selectAfter: v })} />
        </Row>
        <View style={{ height: 12 }} />
      </ScrollView>

      {S.tab === 'graph' && focus && (
        <View style={{ marginTop: 6 }}>
          <Pressable onPress={() => setFocus(null)} style={{ alignSelf: 'flex-end', paddingVertical: 4, paddingHorizontal: 8 }}>
            <Text style={st.hide}>hide keys ⌄</Text>
          </Pressable>
          <Keypad onKey={onKey} width={inner} />
        </View>
      )}

      <View style={st.footer}>
        {busy ? (
          <>
            <Text style={st.progress}>Drawing… {busy.done} / {busy.total}</Text>
            <Button label="Stop" onPress={() => { cancel.current = true; }} />
          </>
        ) : (
          <View style={{ flex: 1 }}><Button label={`Draw on the page  →`} primary onPress={drawNow} disabled={!ops.length} /></View>
        )}
      </View>

      <Modal visible={abc !== null} transparent onRequestClose={() => setAbc(null)}>
        <View style={st.modalBack}>
          <View style={st.modal}>
            <Text style={st.modalTitle}>Type it</Text>
            <TextInput value={abc ?? ''} onChangeText={setAbc} autoFocus autoCapitalize="none" autoCorrect={false} style={st.modalInput} />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 }}>
              <Button label="Cancel" onPress={() => setAbc(null)} />
              <View style={{ width: 12 }} />
              <Button label="Done" primary onPress={() => { if (focus) { setField(focus, abc ?? ''); setCursor((abc ?? '').length); } setAbc(null); }} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function fmtNum(v: number): string {
  const r = Math.round(v * 1000) / 1000;
  return String(r);
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#ffffff', paddingTop: 12, paddingBottom: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 2, borderColor: C.ink, paddingBottom: 6, marginBottom: 10 },
  title: { fontSize: 30, fontFamily: SERIF, color: C.ink },
  close: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center', marginLeft: 4, marginBottom: 8 },
  closeText: { fontSize: 28, color: C.ink },
  caption: { fontSize: 15, color: C.mid, marginTop: 6, fontFamily: SERIF, fontStyle: 'italic', textAlign: 'center' },
  lineRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  swatch: { width: 18, height: 18, borderRadius: 9, marginRight: 10 },
  kind: { width: 170, fontSize: 15, color: C.mid, marginLeft: 10, fontStyle: 'italic', fontFamily: SERIF },
  wl: { fontSize: 18, color: C.ink, marginHorizontal: 6, fontFamily: SERIF, fontStyle: 'italic', marginBottom: 8 },
  num: { minWidth: 76, marginBottom: 8 },
  blurb: { fontSize: 17, fontFamily: SERIF, fontStyle: 'italic', color: C.mid, marginBottom: 10, marginLeft: 110 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 2, borderColor: C.ink, paddingTop: 10, marginTop: 6 },
  hide: { fontSize: 15, color: C.mid, fontFamily: SERIF, fontStyle: 'italic' },
  progress: { fontSize: 20, fontFamily: SERIF, color: C.ink },
  modalBack: { flex: 1, backgroundColor: 'rgba(255,255,255,0.6)', justifyContent: 'center', padding: 40 },
  modal: { backgroundColor: '#ffffff', borderWidth: 2, borderColor: C.ink, padding: 20 },
  modalTitle: { fontSize: 22, fontFamily: SERIF, marginBottom: 10, color: C.ink },
  modalInput: { borderBottomWidth: 2, borderColor: C.ink, fontSize: 24, paddingVertical: 8, color: C.ink },
});
