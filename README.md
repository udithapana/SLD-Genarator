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
- Inverter MCCB = next standard size ≥ 1.25 × inverter current. Each BESS unit's MCCB is sized the same way from its PCS kW.
- Isolator / main panel = next standard size ≥ 1.25 × total current (every inverter + every BESS unit); busbar = next standard busbar size ≥ that.
- Main / utility cable and earth bus feeder are sized from total current (parallel sets above 250 A). Tables are at the top of the file.
- **DC cable is not auto-selected.** It depends on the physical run length between the array (or battery) and its inverter/PCS, so each inverter and each BESS unit has its own free-text DC cable field — fill it in per unit.
- Check every result against your design standards before issuing a drawing.

## Multiple inverters / batteries
"Add inverter" and "Add battery" add more units, each independently selectable and removable. Totals (panel count, kWp, kW, busbar/isolator/cable sizing) update automatically across all units. **Total DC capacity (kWp)** in the Drawing section is computed automatically from every inverter's PV module count and can't be typed over; use `{kW}` inside the Project title to insert that same total automatically (e.g. `PROPOSED {kW} kW SOLAR POWER SYSTEM FOR ...`).

## Paper size
Both diagrams are drawn directly on one fixed A4 landscape sheet — the outer border, title block and earth section always sit at the same page position. Only the repeating inverter/BESS symbols move: with few units they're centred in the available space at full size; once they'd overflow, they compress evenly (spacing and text shrink together, no stretching) to keep everything on the one page. Print / save PDF is set to A4 landscape.

## Logo
The company logo is embedded in the title block. To change it, replace `assets/regen-logo.png` and run `pip install pillow && python tools/logo_to_js.py`.

## Files
`index.html` · `css/style.css` · `js/app.js` (UI) · `js/rules.js` (auto-select) · `js/renderer.js` (SVG drawing) · `js/inverter-data.js` + `js/logo.js` (generated) · `tools/xlsx_to_data.py`


## History (saved revisions)
Click **💾 Save to history** at any time to store a labelled snapshot of the current form — all fields, every inverter and BESS unit, and the mode — in this browser (`localStorage`, so it's per-browser/device, not shared). The **History** tab lists saved revisions newest first; **Load** restores that exact configuration (including any manual overrides), **Delete** removes it. Nothing is sent anywhere; it's local to the browser it was saved in, so it won't follow you to a different computer or browser profile.

## Load feeder cable
**Load feeder cable** (Cables & switchgear) is auto-sized from the **Load feeder MCCB (A)** rating, same override pattern as the other cable fields (edit it directly to override, "↺ Reset all to auto" to clear). It's shown on the drawing next to the load feeder line and is hidden automatically in Net plus mode (no load).

## Switchgear panel earth
Both diagrams now show a dedicated earthing connection from the main switchgear panel enclosure into the main earth bus/trunk, alongside the individual inverter/BESS earths.
