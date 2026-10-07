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

## Breaker ratings (MCB / MCCB / ACB)
Only these standard ratings are used for every auto-selected breaker (inverter, BESS, main panel, Location 2 panel, isolator):
- **MCB:** 32, 40, 63 A
- **MCCB:** 100, 160, 250, 400, 630, 800, 1000, 1250, 1600 A
- **ACB:** 2000, 2500, 3200, 4000 A

The rating is the smallest one that is ≥ 1.25 × the load current. The family (MCB / MCCB / ACB) follows from the rating. If the load current is **below 20 % of a MCCB's or ACB's rating** (normally only when you override the rating, or the breaker is oversized), the breaker is labelled **ADJ.** (adjustable trip unit), e.g. "MCCB ADJ.". Edit `MCB / MCCB / ACB` and `S.brkType` in `js/rules.js` to change the lists or the 20 % threshold.

## Bigger text for key labels
The smaller labels that are easy to miss — earth cable sizes, "SPD Type 1+2", main cable sizes, and every "switchgear panel" / earth-bus heading — are all a point or two larger now, on both diagrams.

## PDF quality raised again
The exported PDF is now a lossless PNG at ~354dpi (up from a compressed JPEG at 300dpi) — sharper still, at the cost of a somewhat larger file.

## Font size vs. number of units (SLD)
Text in the inverter/PV/battery columns no longer keeps growing when there are only a few units. It is held at the size it has with 4 units for 1–4 units, follows the layout between 4 and 6 units, and is held at the 6-unit size for 7+ units so it stays readable in print. With 7+ units the columns get narrower than that text, so long labels (inverter title and model, cable sizes, DC cable, earth labels) wrap onto extra lines, the SPD gets more room, and with 10+ units the bottom earth labels alternate between two heights. Layouts beyond roughly 10 units become very crowded on a single A4 sheet.

## Second location (SLD only)

For sites with inverters/BESS split across two physical switchgear locations, there's now a "Second location" section (below Battery/BESS) in the form:

- **+ Add second location** reveals: a "Connects to" choice (Main switchgear panel, or the Isolation panel / Load DB in off-grid mode), a location name, an interconnecting-cable override, and their own independent Inverters and Battery (BESS) lists — same cards, same fields, same MCB/MCCB and AC-cable-override behaviour as the main location.
- The single-line diagram draws Location 2's panel directly below the main panel, left of the main inverters (the main panel does not move). Its inverters, PV arrays, BESS PCS/battery and hybrid units use exactly the same symbols and size as the main location. The dashed outline wraps only the busbar and its breakers (incomer + one per unit). Its feeder carries a breaker at **each** end, sized from Location 2's own current only (it does not change when main inverters/BESS are added). If it feeds the main panel, the main panel breaker/busbar is sized on both locations; if it feeds the isolation panel, the isolator/utility cable carry the total. Its panel earth joins the main panel's earth conductor, so no earth lines overlap.
- Total kWp, the title and the title block include both locations. The block diagram also shows Location 2: its own rows (same box sizes), its own dashed switchgear panel and busbar, and the interconnecting cable with a breaker at each end (tapped from the main busbar or the isolation panel / LOAD DB).
- With a lot of main-location inverters and a second location both present, the page gets dense; the layout has been tested up to 8 main inverters plus a Location 2 of its own, but very large combined systems will be tight on one A4 sheet.

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


## Layout notes (block diagram)
- The block diagram's switchgear panel has clear gaps between its outline, the row breakers, the busbar and the main breaker; the main cable label sits in the gap between the main panel and the isolation panel outlines.
- A **second earth bus bar** (labelled with the second location's name) is drawn between the main and second-location inverter sets; the second location's earths bond there and continue to the main earth bus bar.
- Labels were checked automatically for overlaps: clean up to ~10 rows in the block diagram and ~11 inverters in the SLD (about 9 main + second location). Beyond that the A4 sheet is simply too small for readable text.

## Earthing of PV arrays and hybrid batteries
- Module-side (roof) earths are no longer run one-by-one to the earth bus bar. All arrays of a location join one **PV array roof earth** line (solid), kept apart from the equipment earth (dashed), and a single "4mm² Cu — PV array main earth (from roof)" conductor lands on that location's earth bus bar. Block diagram: with a second location, Location 1's earth bus bar sits between the two inverter sets and Location 2's is at the bottom.
- Block diagram: a hybrid inverter's row is taller (bigger battery box with its DC cable and earth); the rows below move down.

## PV array main earth (roof) size
The single conductor that collects the PV-module (roof) earths of a location is sized by the number of PV arrays (= inverters) bonded to it, using the step table `PVE` in `js/rules.js`:
1 array → 4 mm² Cu, 2–3 → 6, 4–6 → 10, 7–10 → 16, 11–16 → 25, 17+ → 35 mm² Cu (practice following IEC 62548 / IEC 60364-5-54). This is an editable rule-of-thumb table — verify against your standard/project. Main location: field "PV array main earth (roof)" (AUTO, type to override). Second location: "PV array main earth (roof) override" in the Second location section. Both locations' roof earth collectors are drawn at the same position in the block diagram.

## Title block
ISO 7200-style ruled grid, identical on both drawings and the same distance (6 px between border lines) from the left, right and bottom page border — equal to the 6 px gap between the drawing frame and the title block: logo | title + Drawing No / Revision / Date strip | four equipment cells (Solar modules, Inverters, BESS PCS, Batteries — grouped counts, hybrid integrated batteries listed under Batteries) | ruled approvals table.

## Second location — SLD layout (right-hand side) and earthing
In the SLD the Location 2 columns/panel sit to the RIGHT of the main (Location 1) columns, below the main panel. Its feeder comes from a tap breaker on the main busbar, or (isolation-panel option) from the isolation panel, routed above the main panel and down across the main busbar.
Earthing: Location 2 has its own panel earth conductor, its own earth bus bar and its own earth pit (size from Location 2's own current); Location 1 keeps its own bar and pit. The two bars are tied by an "Equipotential bond" line between them.

## Hybrid inverter battery (SLD) and Location 2 refinements
- The hybrid inverter's battery is drawn to the LEFT of the inverter; its earth joins the inverter's own earth line (one common earth conductor) which then runs to the earth bus bar.
- Location 2's panel earth bus sits at the same height/size as the main panel's, and its earth drop starts from the middle of that bar.
- The two earth bus bars are joined by a plain earth conductor sized from the Location 2 interconnecting AC cable per IEC 60364-5-54 Table 54.2 (PE = phase size up to 16 mm², 16 mm² up to 35 mm², half the phase size above 35 mm²; rounded up to a standard size).
- With Location 2 fed from the isolation panel, the main panel is shortened (right → left) and the isolation panel extended (left → right, meter/GRID follow) so the Location 2 feeder drops straight down with no crossings.

## SLD column spacing
All columns share a 230-unit pitch; only a hybrid column gets extra room on its left (its battery sits between the inverter and its own earth line, so the battery DC cable never crosses the earth). The symbol scale is solved so margins, columns and the gap between the two locations fill the page width — no large empty areas left/middle/right. With Location 2 on the isolation panel the right-hand margin only has to hold Location 2's last column.

## Balanced layout (SLD)
- The SPD stays right after the LAST MAIN column in every Location 2 case, so the right-hand part of the page belongs to Location 2's inverters (symbols as large as the width allows).
- Location 2's panel box starts clear of the last main inverter's text; with Location 2 on the isolation panel its feeder x is limited so the extended isolation panel still leaves room for meter + GRID.
- A hybrid column's earth label sits to the right of its (left-shifted) earth line; its battery DC cable leaves the inverter's left side.
- Very dense sheets (12+ columns): text scales down slightly with the geometry instead of overlapping.
- Automated check used during development: text/text, text/line, text/panel-outline and symbol-box overlaps over 1–9 main inverters × Location 2 (main / isolation / off-grid / net-plus) × hybrid / BESS combinations — no overlaps reported (block diagram: clean up to ~12 rows).

## CAD export (DXF)
The **⬇ Download CAD (.dxf)** button (replaces the old SVG download) exports whichever drawing tab is showing (block diagram or SLD) as an AutoCAD **DXF (R12 / AC1009, ASCII)** — opens in every AutoCAD version, BricsCAD, DraftSight, LibreCAD, QCAD. Generated in the browser by `js/dxf.js` (`SLD.toDXF(svgElement)`); nothing is uploaded.
- Millimetres on a real A4 landscape sheet (297 × 210), origin lower-left, Y up → plots 1:1.
- Layers: `SLD-AC`, `SLD-DC`, `SLD-EARTH`, `SLD-SPD`, `SLD-SYMBOLS`, `TEXT`, `TITLEBLOCK`, `TITLEBLOCK-TEXT` (ACI colours match the screen). Dashed lines use DASH_* linetypes.
- Entities: LINE, POLYLINE (boxes; heavy cables/earth bars carry a width), CIRCLE, SOLID (load arrow), TEXT (Arial / Arial Bold styles, real text — editable).
- The raster logo can't be stored in R12, so the logo cell holds the text "REGEN". DWG can't be written in a browser; open the DXF in AutoCAD and Save As DWG.

## Panels & protection (form section "Panels & protection")
- **IP rating** per panel — main switchgear panel, isolation panel (Load DB in off-grid) and the second-location panel: *Indoor — IP54* / *Outdoor — IP66*. Shown on every drawing (badge inside the main/L2 panel outline in the block diagram and main-panel SLD; after the title for the isolation panel).
- **EFR (earth fault relay)** — optional on the main switchgear panel and on the isolation panel (not on a Load DB). SLD: CBCT (circle on the conductor) + relay box (`EFR`, `50N/51N` or your own setting text) with a dashed trip link to the breaker / isolator, plus an "EFR trip signal" legend entry. Block diagram: EFR box with trip link.
- **Indicators** — optional phase indicator lamps R-Y-B (IEC signal-lamp symbol: circle with cross) tapped off the busbar with a common neutral, on the main, isolation and (with a second location) the Location 2 panel.
- Layout: with a main-panel EFR the panel contents sit a little lower so the CBCT + relay are inside the dashed panel outline; the isolation panel's earth bus bar sits low in the panel with its earth conductor leaving the enclosure; each panel (incl. Location 2 on the SLD) shows its IP rating. With an isolation-panel EFR the panel is drawn taller (busbar, breakers and meter sit lower) so the CBCT + relay have clear space above the busbar. The main panel (and Location 2's panel) also sit a little lower so the cable labels and panel titles between the panels have their own clear lines.
- **DC side** — optional **DC isolator** (disconnector symbol cutting the DC cable) and **DC SPD** (tap to earth) on every PV-array → inverter DC cable, each with an editable rating text (defaults `1000V DC`, `Type 2 · 1000V DC`). The PV array moves down to make room; the block diagram shows them as two small boxes in the DC link.
- Isolation-panel (and Load DB) earthing point now leaves the enclosure: the earth bus bar stays inside, the conductor and ground symbol sit below the panel outline.
- Also: `[hidden]` CSS fix so fields that are meant to disappear (e.g. EFR setting when no EFR) really do.
- All these options are saved/restored with "Save to history" and export to the DXF like the rest of the drawing.

## Screen layout (laptop / desktop)
- The drawing panel on the right stays fixed and is scaled so the whole A4 sheet fits the window; only the left settings panel scrolls.
- The settings are grouped into tabs: **System** (metering mode, panel Wp, inverters, BESS), **Location 2**, **Cables & breakers**, **Protection** (IP ratings, EFR, indicators, DC isolator / SPD) and **Project** (drawing details, sign-off). The last tab used is remembered. "Location 2 ●" shows when a second location is on.
- On phones / narrow windows the page scrolls normally (settings above, drawing below).

- SLD and block-diagram sheets: the diagram sits inside its own drawing window (inner frame) above the title block; the DXF carries it on a `FRAME` layer.

## Installing on a phone (PWA)
`js/pwa.js` builds the web-app manifest in code (icons embedded), so the app is installable even when only the single-file `index.html` is uploaded. Its manifest `id` is `<folder URL>regen-sld-generator`, unique to this app, so Chrome does not confuse it with other apps on the same github.io address. `sw.js` (optional) adds offline use. If you reuse this project for another app, change `id`, `name` and `short_name` in `js/pwa.js`. After deploying: uninstall the old icon (long-press → Uninstall), in Chrome open the site, pull down to reload twice, then ⋮ → Install app.

## Off-grid backup source (ATS)
In **Off-grid** mode the System tab has a *Backup source* choice; the automatic transfer switch(es) are drawn inside the **isolation panel** with the standard changeover (ATS) symbol — inputs I / II, common load terminal:
- **Diesel generator (DG)** or **Grid** — one ATS: input I = solar side (main switchgear panel, plus Location 2 if it feeds the isolation panel), input II = DG / grid, output → load.
- **DG + grid** — two ATS: ATS-1 selects DG (I) or grid (II); its output feeds ATS-2 input II; ATS-2 input I = solar side; ATS-2 output → load.
- **None** — the original Load DB with no utility connection.
The grid is drawn with its kWh meter (label *UTILITY IMPORT METER*, editable), the DG with the generator symbol (G~) and optional kVA rating. An optional isolation-panel EFR (Protection tab) is drawn as a CBCT on the ATS output with its relay tripping the ATS (ATS-2 when there are two). ATS rating defaults to the isolator size (auto, overridable); the DG cable and load cable default to the utility cable size.

## Save / reset
**💾 Save to history** keeps a named copy of the whole configuration in this browser (History tab → Load / Delete). **↺ Reset to default** returns every setting, inverter, battery and Location 2 to the start-up project; the current drawing is saved to History automatically first (labelled "Auto-saved before reset"), so it can be loaded back.

## Team sync (shared History through GitHub)
History tab → **Team sync (GitHub)**. Everyone using the same web link shares one History, stored as `history.json` on a separate branch `sld-data` of the same repository (so saving never redeploys the site).
- Repository is detected from the github.io link (owner/repo); edit it if needed.
- **Without a token**: the team's saved drawings are loaded and can be opened; your own saves stay in your browser.
- **With a token** (GitHub → Settings → Developer settings → Fine-grained tokens; only this repository; *Contents: Read and write*): every Save / Delete is synced; opening the History tab or the app fetches the latest. Simultaneous saves are merged (re-read + retry), deletions propagate.
- Each entry shows who saved it ("Your name"). Export / Import file is available for backup or for offline sharing.
- The token is kept only in that browser's local storage; share tokens only with your team.

### Restricting access (team only)
The website itself is public, so real protection comes from keeping the **drawings in a PRIVATE repository**:
1. Create a private repository for the data (e.g. `sld-team-data`, can be empty).
2. In `index.html` (top, *TEAM SETTINGS*): `dataRepo: "owner/sld-team-data"` and, to put a sign-in screen in front of the app, `requireToken: true`.
3. For each team member, create a fine-grained token (*Only select repositories* → the data repo, *Contents: Read and write*, with an expiry date) and give it to that person.
4. To remove someone: delete/revoke their token on GitHub — the app locks them out the next time it starts, and the private data cannot be read without a valid token.
Note: the sign-in screen only hides the app; the drawing tool's code is public by nature. The shared drawings are what is protected.

### Username + password sign-in
Instead of handing out tokens, give each person a **username and password**:
1. Open the app link with `#admin` at the end (e.g. `https://owner.github.io/repo/#admin`).
2. For each person enter username, display name, a password (8+ characters) and **their own** GitHub token → *Create user line*. Their token is encrypted with their password (PBKDF2-SHA256 250k rounds + AES-256-GCM) in your browser; nothing is sent anywhere.
3. Paste the lines into `users: { … }` in the TEAM SETTINGS block of `index.html`, with `dataRepo` = your private data repository and `requireToken: true`; upload `index.html`.
4. People now sign in with username + password (remembered on that device until *Sign out*).
- **Remove someone**: delete their token on GitHub (they are locked out immediately on next start) and remove their line.
- **Change a password**: create a new line for that user and replace the old one.
- Use strong passwords: the encrypted lines are inside the public page, so a weak password could be guessed offline.
