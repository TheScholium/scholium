import sys
from PIL import Image
files = sys.argv[2:]; cols = 2
ims = [Image.open(f) for f in files]
w = max(i.width for i in ims); h = max(i.height for i in ims)
rows = (len(ims) + cols - 1) // cols
M = Image.new('RGB', (w * cols, h * rows), 'white')
for k, im in enumerate(ims): M.paste(im, ((k % cols) * w, (k // cols) * h))
M.save(sys.argv[1])
