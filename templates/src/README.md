# Template source

`build.py` renders every template from HTML and CSS with a headless Chromium browser, then saves grayscale PNG files with license metadata to `../nomad/`.

```bash
pip install playwright pillow
playwright install chromium
python3 build.py
```

Each grid and ruled area snaps to a whole number of cells, so no line is cut at a section edge. The page size is set by `W` and `H` at the top of the script.

License: MIT. The fonts in `fonts/` are subsets of EB Garamond and Cormorant Garamond, under the SIL Open Font License 1.1.
