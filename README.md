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

## PDF export
"Download PDF (A4)" renders the currently visible diagram straight to a one-page A4-landscape PDF (via a small canvas render + [jsPDF](https://github.com/parallax/jsPDF), loaded from cdnjs) — no browser print dialog, no margin/scaling guesswork. It needs an internet connection the first time a page loads (to fetch that library); "Download SVG" still works fully offline as a fallback.

## Hybrid inverters (integrated battery)
Selecting a "hybrid" model (Sunways Hybrid / ATESS Hybrid brands in the parts file) reveals an extra "Integrated battery" field on that inverter's card. This is for batteries wired straight into the hybrid unit's own DC input — no separate BESS PCS, no separate AC breaker — drawn as a small battery box hanging off that inverter on both diagrams. Use the separate "Battery (BESS)" section instead for a standalone battery with its own PCS and AC breaker. The hybrid battery is labelled plainly as "BATTERY" (not "integrated") and drawn with the same battery-cell symbol used for a standalone BESS. In the single-line diagram it's wired to its own dedicated DC point on the inverter, fully separate from the PV DC line — not a tap/junction on the PV cable — with each cable's size labelled on its own side (PV on the left, battery on the right) so they can't be confused. Earthing is also fully separated per component: the inverter's own earth is current-sized as before, while the PV array and the hybrid battery each get their own dashed 4mm² Cu earth conductor straight to the main earth bus — not bonded onto the inverter's earth run. In the single-line diagram, the PV array and inverter earth runs are both drawn on the left side (like the original inverter earth), spaced apart so their labels never sit under the array's own "PV ARRAY / Strings / kWp" text. A standalone BESS's (or a hybrid's) earth conductor is now labelled with a "(PCS earth)" suffix, since it's the PCS/inverter's own chassis earth. The main switchgear panel also now shows its own internal earth bus bar, with the panel's earth conductor drawn starting from that bus rather than straight off the panel's outline. That panel earth bus is drawn as a single busbar line (not a ground-symbol glyph), feeding into the main earth bus bar below. The PV array itself is also earthed (frame/array earth), alongside the inverter's own earth — shown on both diagrams.

## Main breaker sizing
The main switchgear panel's own breaker (and the isolator/busbar/main cable downstream of it) is sized on **whichever is larger — total solar-inverter current or total standalone-BESS current — not their sum**, since the battery only discharges through the panel while the inverters are off (night / outage), so the two loads are never coincident. A hybrid inverter's integrated battery doesn't add to this at all — it shares the inverter's own AC breaker.

## AC cable override
Like the MCCB override, each inverter and BESS card now has an "AC cable override" field (blank = auto, sized from the parts database / current). Type an exact cable spec there to use it verbatim on both diagrams instead of the derived one.

## Parts database
`data/Supporting_file.xlsx` now has 84 inverters, including a new **Sungrow** (string) and **Sungrow Hybrid** range. Re-run `python tools/xlsx_to_data.py` any time the spreadsheet is updated.

## Sticky header
The top bar (title, diagram tabs, Save/Download/PDF buttons) now stays pinned to the top of the window while the (often long) form scrolls underneath it.

## Earth bonding refinements
- A standalone BESS (or hybrid battery) now shows its **battery** and **PCS/inverter** earth points bonding together (a visible interconnect) before the combined run continues to the main earth bus — labelled "(PCS + battery earth)" — rather than each running as a fully separate conductor.
- The **isolation panel** now also has its own labelled earth bus (SLD) / earth point (block diagram), separate from the main switchgear panel's earth bus and the per-unit inverter/PV/battery earths.
- Fixed the SPD label overlapping the main panel's dashed border in the single-line diagram.

## Isolation panel earth routing (SLD)
The isolation panel's earth is a short local stub terminating in a ground symbol (matching the SPD's own earth symbol) right next to the panel — it does not run down to the main earth bus bar, so it can never be mistaken for feeding into the main switchgear panel's earth.

## Legibility
The smallest labels (earth conductor sizes, "Battery earth" call-outs, DC cable notes) are a point or two larger now, and the exported PDF renders at a slightly higher resolution — both aimed at keeping small text readable without bloating the file size.

## Using the full page width (SLD)
The single-line diagram used to reserve far more left/right margin than the layout actually needed, so even systems with 6–8 inverters left a lot of empty space on both sides. The margins are now sized correctly, and the inverter/PV/battery columns (and their text) grow to fill whatever room is left — up to 1.8× normal size for a single inverter — instead of leaving margin unused. The SPD's position (and the panel's right-hand edge) scales with that same growth and is now calculated so it can never run off the page however big the columns get. With enough inverters that they no longer fit at full size, it compresses smoothly, same as before. "Integrated DC/AC SPD" under each inverter wraps to two lines to help with this.

## PDF quality
Raised the exported PDF back up to a true 300dpi image at near-maximum JPEG quality — sized for clarity now rather than the smallest possible file (typically a few MB).

## Off-grid mode
A fourth system configuration, "Off-grid", is now available alongside Net metering / Net accounting / Net plus. It removes the isolator, meter, and grid connection entirely — the main switchgear panel feeds straight into a labelled "Load Distribution Board (LOAD DB)" box, on both diagrams. Use it for sites with no utility connection at all.

## Earth pit alignment
The main earth pit / grounding-rod symbol at the bottom of the single-line diagram is now aligned directly under the "Switchgear panel earth" line, instead of sitting a little to the side of it, so the panel's earth run reads as one continuous line down to the actual ground connection.

## Panel earth bus repositioned
With enough inverters growing large (3–6, before compression kicks back in), the main panel's earth bus used to sit near the middle of the page and could end up close to or crossing the first inverter's own PV array / earth line. It's now tucked into the panel's left corner — well clear of the inverter columns at any count — and the main earth pit at the bottom is aligned under it, same as before.

## Off-grid Load DB now has its own AC bus
The off-grid Load Distribution Board box now shows an actual AC busbar inside it (labelled with the panel's rating), fed by the main panel's own breaker — rather than just a plain wire passing through — on both diagrams.

## MCB vs MCCB
Every breaker rating in both diagrams now follows the standard convention automatically: under 63A it's labelled "MCB" (miniature circuit breaker), 63A and above it's "MCCB" (moulded-case) — including the main incomer, per-inverter/BESS breakers, and the load feeder breaker.

## Bigger text for key labels
The smaller labels that are easy to miss — earth cable sizes, "SPD Type 1+2", main cable sizes, and every "switchgear panel" / earth-bus heading — are all a point or two larger now, on both diagrams.

## PDF quality raised again
The exported PDF is now a lossless PNG at ~354dpi (up from a compressed JPEG at 300dpi) — sharper still, at the cost of a somewhat larger file.

## Font size vs. number of units (SLD)
Text in the inverter/PV/battery columns no longer keeps growing when there are only a few units. It is held at the size it has with 4 units for 1–4 units, follows the layout between 4 and 6 units, and is held at the 6-unit size for 7+ units so it stays readable in print. With 7+ units the columns get narrower than that text, so long labels (inverter title and model, cable sizes, DC cable, earth labels) wrap onto extra lines, the SPD gets more room, and with 10+ units the bottom earth labels alternate between two heights. Layouts beyond roughly 10 units become very crowded on a single A4 sheet.

## Selection rules (`js/rules.js`)
- Inverter MCCB = next standard size ≥ 1.25 × inverter current. Each BESS unit's MCCB is sized the same way from its PCS kW.
- Isolator / main panel = next standard size ≥ 1.25 × total current (every inverter + every BESS unit); busbar = next standard busbar size ≥ that.
- Main / utility cable and earth bus feeder are sized from total current (parallel sets above 250 A). Tables are at the top of the file.
- **DC cable is not auto-selected.** It depends on the physical run length between the array (or battery) and its inverter/PCS, so each inverter and each BESS unit has its own free-text DC cable field — fill it in per unit.
- Check every result against your design standards before issuing a drawing.
- Both diagrams now also draw a **main breaker (MCCB)** for the main switchgear/combiner panel itself, sized from the panel's total current — separate from each inverter/BESS unit's own MCCB.

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
