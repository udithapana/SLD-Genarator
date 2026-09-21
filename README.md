# Solar SLD Generator

Browser app that turns a few inputs into a **block diagram** and a **single line diagram (standard symbols)** for solar PV (+ BESS) projects. No build step, no dependencies.

## Run
Open `index.html` in a browser, or publish with GitHub Pages (a workflow is included: push to `main`, then Settings → Pages → Source: GitHub Actions).

## Use
0. Choose the **System configuration**: Net metering, Net accounting (solar feeds the load, surplus exported; load sits on the isolation-panel busbar) or Net plus (all generation exported, no load drawn).
1. Fill the drawing details.
2. **Inverters** – pick brand + model, enter PV modules and strings (e.g. `18x2+15x2+9+9`). Use **Add inverter** for more; the ✕ icon removes an inverter.
3. Cables, MCCBs, main cable, isolator, busbar, main panel and earthing are **auto-selected** from the inverter currents. Edit any field to override it (orange border); **Reset all to auto** undoes overrides.
4. Switch between the two diagram tabs, then **Download SVG** or **Print / save PDF** (A3 landscape).

## Update the inverter list
Edit `data/Supporting_file.xlsx`, then run:

    pip install openpyxl
    python tools/xlsx_to_data.py

This regenerates `js/inverter-data.js`. Duplicate model names are skipped. Empty cable/earth cells are derived from the inverter current.

## Selection rules (`js/rules.js`)
- Inverter MCCB = next standard size ≥ 1.25 × inverter current.
- Isolator / main panel = next standard size ≥ 1.25 × total current (inverters + BESS PCS); busbar = next standard busbar size ≥ that.
- Main / utility cable and earth bus feeder are sized from total current (parallel sets above 250 A). Tables are at the top of the file.
- Check every result against your design standards before issuing a drawing.

## Logo
The company logo is embedded in the title block. To change it, replace `assets/regen-logo.png` and run `pip install pillow && python tools/logo_to_js.py`.

## Files
`index.html` · `css/style.css` · `js/app.js` (UI) · `js/rules.js` (auto-select) · `js/renderer.js` (SVG drawing) · `js/inverter-data.js` + `js/logo.js` (generated) · `tools/xlsx_to_data.py`
