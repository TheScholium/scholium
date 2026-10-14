"""Drive the simulator and take screenshots. Usage: python3 sim/shoot.py OUTDIR"""
import sys, asyncio, http.server, threading, functools, os
from playwright.async_api import async_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else 'build/preview'
ROOT = os.path.abspath('build/sim')
def serve():
    class Q(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
    h = functools.partial(Q, directory=ROOT)
    s = http.server.ThreadingHTTPServer(('127.0.0.1', 8765), h)
    threading.Thread(target=s.serve_forever, daemon=True).start()
    return s

async def main():
    srv = serve()
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={'width': 1180, 'height': 1010}, device_scale_factor=2)
        logs = []
        pg.on('console', lambda m: logs.append(f'{m.type}: {m.text}'))
        pg.on('pageerror', lambda e: logs.append(f'pageerror: {e}'))
        await pg.goto('http://127.0.0.1:8765/index.html')
        await pg.wait_for_timeout(800)
        await pg.screenshot(path=f'{OUT}/sim-1-open.png')
        # options under the keypad
        await pg.get_by_text('hide keys', exact=False).click()
        await pg.wait_for_timeout(300)
        await pg.screenshot(path=f'{OUT}/sim-2-options.png')
        # stencils
        await pg.get_by_text('Stencils', exact=True).first.click()
        await pg.get_by_text('Inclined plane', exact=True).click()
        await pg.wait_for_timeout(300)
        await pg.screenshot(path=f'{OUT}/sim-3-stencils.png')
        await pg.get_by_text('Draw on the page', exact=False).click()
        await pg.wait_for_timeout(1500)
        await pg.screenshot(path=f'{OUT}/sim-4-incline-drawn.png')
        # handwriting flow
        await pg.get_by_text('Clear the page').click()
        await pg.get_by_text('Write an equation, lasso it').click()
        await pg.wait_for_timeout(900)
        await pg.get_by_text('Graph', exact=True).first.click()
        await pg.get_by_text('Read my handwriting').click()
        await pg.wait_for_timeout(300)
        await pg.get_by_text('Key points', exact=False).click()
        await pg.wait_for_timeout(300)
        await pg.screenshot(path=f'{OUT}/sim-5-lasso.png')
        await pg.get_by_text('Draw on the page', exact=False).click()
        await pg.wait_for_timeout(2500)
        await pg.screenshot(path=f'{OUT}/sim-6-drawn.png')
        for l in logs: print(l)
        await b.close()
    srv.shutdown()
asyncio.run(main())
