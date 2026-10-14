import { STENCILS, drawStencil } from '../src/core/stencils';
import { inkLabels } from '../src/core/figure';
import { writeFileSync } from 'fs';
const out: any = {};
const R = { left: 60, top: 60, right: 760, bottom: 660 };
const variants: [string, Record<string, string>][] = [
  ['plane', {}], ['unitcircle', {}], ['numberline', {}], ['polar', {}], ['triangle', {}], ['axes3d', {}],
  ['incline', {}], ['fbd', {}], ['normal', {}], ['venn', { sets: '3' }], ['solids', { shape: 'cube' }], ['solids', { shape: 'cylinder' }],
  ['solids', { shape: 'cone' }], ['solids', { shape: 'sphere' }], ['unitcircle', { labels: 'deg' }], ['venn', {}],
];
variants.forEach(([id, o], i) => {
  const d = inkLabels(drawStencil(id, R, o));
  out[`${String(i).padStart(2, '0')}-${id}`] = { ...d, page: [820, 720], scale: 0.5 };
  console.log(id.padEnd(11), JSON.stringify(o).padEnd(20), 'calls', d.items.length);
});
writeFileSync('build/preview/st.json', JSON.stringify(out));
