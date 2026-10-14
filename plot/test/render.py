"""Render drawings (JSON from the engine) to PNG, roughly as the tablet would."""
import json, sys
from PIL import Image, ImageDraw, ImageFont
INK = {0: (0, 0, 0), 157: (95, 95, 95), 201: (165, 165, 165)}
W = {'hair': 1.4, 'fine': 2.0, 'pen': 3.0, 'bold': 4.4}
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'

def render(d, out, page=None, scale=1.0, ss=3):
    b = d['bounds']
    pw, ph = page or (b['right'] + 40, b['bottom'] + 40)
    im = Image.new('RGB', (int(pw * ss), int(ph * ss)), (255, 255, 255))
    dr = ImageDraw.Draw(im)
    for it in d['items']:
        col = INK[it['ink']]
        if it['kind'] == 'path':
            w = max(1, int(W[it['weight']] * ss))
            pts = [(x * ss, y * ss) for x, y in it['pts']]
            dr.line(pts, fill=col, width=w, joint='curve')
            r = w / 2
            for x, y in (pts[0], pts[-1]):
                dr.ellipse([x - r, y - r, x + r, y + r], fill=col)
        elif it['kind'] == 'ellipse':
            w = max(1, int(W[it['weight']] * ss))
            cx, cy = it['c']
            dr.ellipse([(cx - it['rx']) * ss, (cy - it['ry']) * ss, (cx + it['rx']) * ss, (cy + it['ry']) * ss], outline=col, width=w)
        elif it['kind'] == 'label':
            f = ImageFont.truetype(FONT, int(it['size'] * 1.35 * ss))
            anc = {'c': 'mm', 'n': 'mt', 's': 'mb', 'e': 'rm', 'w': 'lm', 'ne': 'rt', 'nw': 'lt', 'se': 'rb', 'sw': 'lb'}[it['anchor']]
            dr.text((it['at'][0] * ss, it['at'][1] * ss), it['text'], fill=col, font=f, anchor=anc)
    im = im.resize((int(pw * scale), int(ph * scale)), Image.LANCZOS)
    im.save(out)

if __name__ == '__main__':
    for path in sys.argv[1:]:
        d = json.load(open(path))
        for i, (name, dd) in enumerate(d.items()):
            render(dd, path.replace('.json', f'-{name}.png'), dd.get('page'), dd.get('scale', 1.0))
