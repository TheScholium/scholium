/**
 * Browser simulator: a Supernote page with the plugin view on top.
 */
import React, { useEffect, useReducer, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AppRegistry } from 'react-native';
import App from '../App';
import { sim } from './mock';
import { setLaunch } from '../src/ui/store';
import { strokes as fontStrokes } from '../src/core/font';

const SCALE = 0.5; // 1404 x 1872 page shown at 702 x 936, about one dp per px on a Nomad
const INK: Record<number, string> = { 0: '#111', 157: '#5c5c5c', 201: '#a6a6a6' };

function drawPage(cv: HTMLCanvasElement) {
  const dpr = window.devicePixelRatio || 1;
  cv.width = sim.page.width * SCALE * dpr; cv.height = sim.page.height * SCALE * dpr;
  const g = cv.getContext('2d')!;
  g.setTransform(SCALE * dpr, 0, 0, SCALE * dpr, 0, 0);
  g.fillStyle = '#fbfbf8'; g.fillRect(0, 0, sim.page.width, sim.page.height);
  // dot paper
  g.fillStyle = '#c9c9c9';
  for (let y = 60; y < sim.page.height; y += 52) for (let x = 50; x < sim.page.width; x += 52) { g.beginPath(); g.arc(x, y, 1.6, 0, 7); g.fill(); }
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const s of sim.strokes) { g.strokeStyle = '#111'; g.lineWidth = 3.4; g.beginPath(); s.pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); }
  for (const geo of sim.geometries) {
    g.strokeStyle = INK[geo.penColor] ?? '#111';
    g.lineWidth = geo.penWidth / 70;
    g.beginPath();
    if (geo.type === 'GEO_circle' || geo.type === 'GEO_ellipse') {
      const c = geo.ellipseCenterPoint;
      g.ellipse(c.x, c.y, geo.ellipseMajorAxisRadius, geo.ellipseMinorAxisRadius, geo.ellipseAngle, 0, Math.PI * 2);
    } else geo.points.forEach((p: any, i: number) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
    g.stroke();
  }
  for (const t of sim.texts) {
    g.fillStyle = '#111'; g.font = `${t.fontSize}px serif`; g.textBaseline = 'middle';
    g.textAlign = t.textAlign === 2 ? 'right' : t.textAlign === 0 ? 'left' : 'center';
    const r = t.textRect, x = t.textAlign === 2 ? r.right : t.textAlign === 0 ? r.left : (r.left + r.right) / 2;
    g.fillText(t.textContentFull, x, (r.top + r.bottom) / 2);
  }
  if (sim.lasso) {
    const r = sim.lasso; g.setLineDash([14, 10]); g.strokeStyle = '#111'; g.lineWidth = 2.5;
    g.strokeRect(r.left, r.top, r.right - r.left, r.bottom - r.top); g.setLineDash([]);
  }
}

function handwriting(text: string, x: number, y: number, size: number) {
  // the stroke font with a little wobble, standing in for real handwriting
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5);
  return fontStrokes(text, x, y, size).map((s) => ({ pts: s.map(([px, py]) => [px + rnd() * 2.2, py + rnd() * 2.2] as [number, number]) }));
}

function Sim() {
  const [, force] = useReducer((n: number) => n + 1, 0);
  const [open, setOpen] = useState<boolean>(true);
  const cv = useRef<HTMLCanvasElement>(null);
  useEffect(() => { sim.listeners.add(force); sim.closed = () => { setOpen(false); force(); }; return () => { sim.listeners.delete(force); }; }, []);
  useEffect(() => { if (cv.current) drawPage(cv.current); });
  useEffect(() => { AppRegistry.runApplication('ScholiumPlot', { rootTag: document.getElementById('rn') }); }, []);
  const toolbar = () => { setOpen(true); setLaunch('toolbar'); };
  const lassoDemo = () => {
    // "y = x", a small raised 2, then "- 4", as you would write it
    sim.strokes = [...handwriting('y = x', 180, 260, 64), ...handwriting('2', 362, 224, 34), ...handwriting('- 4', 410, 260, 64)];
    sim.recognized = 'y = x2 - 4';
    sim.lasso = { left: 150, top: 170, right: 640, bottom: 300 };
    force();
    setTimeout(() => { setOpen(true); setLaunch('lasso'); }, 400);
  };
  const clear = () => { sim.geometries = []; sim.texts = []; sim.strokes = []; sim.lasso = null; sim.calls = 0; force(); };
  return (
    <div className="wrap">
      <div className="device">
        <canvas ref={cv} style={{ width: sim.page.width * SCALE, height: sim.page.height * SCALE, display: 'block' }} />
        <div className="plugin" style={{ display: open ? 'flex' : 'none' }}><div id="rn" /></div>
      </div>
      <div className="side">
        <h1>Scholium <i>Plot</i></h1>
        <p>A plugin for Supernote that draws graphs and class diagrams onto your page, in real ink.</p>
        <p>This is a stand-in for a Nomad, running in your browser. The plugin on the left is the real code; only the tablet is pretend.</p>
        <button onClick={toolbar}>Tap the Plot button</button>
        <button onClick={lassoDemo}>Write an equation, lasso it, tap Plot</button>
        <button onClick={clear}>Clear the page</button>
        <p className="small">{sim.geometries.length} pen strokes and {sim.texts.length} text boxes on the page.</p>
        <p><a href="ScholiumPlot.snplg" download>Download ScholiumPlot.snplg</a> · <a href="https://github.com/TheScholium/scholium/tree/main/plot">Source and install steps</a></p>
        <p className="small">Version 0.1, an early test version. It has not been tried on a real Supernote yet; if it misbehaves on yours, please open an issue.</p>
      </div>
    </div>
  );
}

AppRegistry.registerComponent('ScholiumPlot', () => App);
const root = document.getElementById('root')!;
createRoot(root).render(<Sim />);
