(function () {
  const D = window.SLD_INVERTERS, S = window.SLD, $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const AUTO = new Set(), RO = new Set(), manual = new Set(), brands = [...new Set(D.map(d => d.brand))];
  const firstOf = b => D.findIndex(d => d.brand == b);
  const today = () => new Date().toISOString().slice(0, 10);
  let MODE = 'nm';
  const HINT = { nm: 'Solar feeds the site load; surplus is exported. Load sits on the isolation-panel busbar.', na: 'Same connection as net metering; only the metering / billing arrangement differs (edit the meter label if needed).', np: 'All solar generation is exported to the grid. No site load is connected.', og: 'Off-grid: solar (+ battery) supplies the site load. Pick a backup source below — an ATS in the isolation panel switches the load between solar and the DG / grid; with both DG and grid, ATS-1 selects DG or grid and ATS-2 selects solar or that backup. Choose "None" for a plain Load DB with no utility connection.' };
  let INVS = [{ m: Math.max(0, D.findIndex(d => d.model == 'STT-45KTL')), mods: 84, cfg: '18x2+15x2+9+9', ov: '', acOv: '', dc: '4mm² DC Cable', battKwh: '', battDc: 'Battery DC cable' }];
  let BESSU = []; // { kwh, kw, model, ov, acOv, dc }
  let LOC2 = { on: false, to: 'main', name: 'Location 2', cableOv: '', pvEarthOv: '' }; // a second physical switchgear location, wired back with a breaker at each end of the interconnecting cable
  let INVS2 = [], BESSU2 = [];
  // [group, [[id, label, default, flag]]]  flag: 1 = auto (overridable), 2 = auto (read-only, always computed)
  const SPEC = [
    ['Drawing', [['proj', 'Project title (use {kW} for the auto total)', 'PROPOSED {kW} kW SOLAR POWER SYSTEM FOR RODESHA ENTERPRISES MORATUWA'], ['loc', 'Location', '25 Lunawa Station Rd, Moratuwa'], ['dno', 'Drawing no', 'RR_2026_118'], ['rev', 'Revision', 'Preliminary'], ['date', 'Date', today(), 3], ['totalKw', 'Total DC capacity (kWp)', '', 2], ['opt', 'Option label', 'Option 1']]],
    ['INV'], ['BESS'], ['LOC2'],
    ['Solar array', [['modWp', 'Panel Wp', '620']]],
    ['Cables & switchgear', [['mainCable', 'Main cable to isolator', '', 1], ['utilCable', 'Utility cable', '', 1], ['earthMain', 'Earth bus feeder', '', 1], ['pvEarth', 'PV array main earth (roof)', '', 1], ['panel', 'Main switchgear panel (A)', '', 1], ['bus', 'Common coupling busbar (A)', '', 1], ['iso', 'Isolator (A)', '', 1], ['isoBus', 'Isolation panel busbar (A)', '', 1], ['meterLbl', 'Meter label', '', 1], ['earthR', 'Earth resistance (Ω max)', '10'], ['loadName', 'Load / DB name', 'LOAD'], ['loadBrk', 'Load feeder MCCB (A)', '100'], ['loadCable', 'Load feeder cable', '', 1]]],
    ['PROT'],
    ['Sign-off', [['designed', 'Designed by', 'K.U.S.Panagoda'], ['drawn', 'Drawn by', 'K.U.S.Panagoda'], ['checked', 'Checked by', 'Kavish / Uditha'], ['director', 'Director / CTO', 'Champika Periyapperuma'], ['exec', 'Project executive', 'Kavish Weerasinghe']]]];
  const fld = ([k, l, v, flag]) => {
    if (flag == 1) AUTO.add(k); if (flag == 2) RO.add(k);
    const tag = flag == 2 ? ' <span class="tag">auto</span>' : flag == 1 ? ' <span class="tag">auto</span>' : '';
    if (flag == 3) return `<label>${l}<input type="date" id="${k}" value="${esc(v)}"></label>`;
    return `<label>${l}${tag}<input id="${k}" value="${esc(v)}"${flag == 2 ? ' readonly' : ''}></label>`;
  };
  // Panels & protection: enclosure IP rating per panel, optional earth-fault relay (EFR) + phase indicator lamps, DC-side isolators / SPDs
  const IPOPT = '<option value="IP54">Indoor — IP54</option><option value="IP66">Outdoor — IP66</option>', YN = (n, y) => `<option value="">${n}</option><option value="1">${y}</option>`;
  const PROT_HTML = `<fieldset><legend>Panels &amp; protection</legend>
<div class="sub"><b>Main switchgear panel</b>
<label>Enclosure (IP rating)<select id="ipMain">${IPOPT}</select></label>
<label>Earth fault relay (EFR)<select id="efrMain">${YN('Not fitted', 'EFR fitted — CBCT + relay trips main breaker')}</select></label>
<label>EFR setting <span class="tag">optional</span><input id="efrMainSet" placeholder="e.g. 0.3 A / 0.1 s"></label>
<label>Indicators<select id="indMain">${YN('None', 'Phase indicator lamps (R-Y-B)')}</select></label></div>
<div class="sub"><b id="isoPanelTitle">Isolation panel</b>
<label>Enclosure (IP rating)<select id="ipIso">${IPOPT}</select></label>
<label>Earth fault relay (EFR)<select id="efrIso">${YN('Not fitted', 'EFR fitted — CBCT + relay trips isolator (off-grid: trips the ATS)')}</select></label>
<label>EFR setting <span class="tag">optional</span><input id="efrIsoSet" placeholder="e.g. 0.3 A / 0.1 s"></label>
<label>Indicators<select id="indIso">${YN('None', 'Phase indicator lamps (R-Y-B)')}</select></label></div>
<div class="sub" id="ipL2Box"><b>Second-location panel</b>
<label>Enclosure (IP rating)<select id="ipL2">${IPOPT}</select></label>
<label>Indicators<select id="indL2">${YN('None', 'Phase indicator lamps (R-Y-B)')}</select></label></div>
<div class="sub"><b>DC side (PV array → inverter)</b>
<label>DC isolator<select id="dcIso">${YN('Not shown (inverter built-in)', 'DC isolator on each PV array DC cable')}</select></label>
<label>DC isolator rating text<input id="dcIsoTxt" value="1000V DC"></label>
<label>DC surge protection (SPD)<select id="dcSpd">${YN('Not shown (inverter built-in)', 'DC SPD on each PV array DC cable')}</select></label>
<label>DC SPD rating text<input id="dcSpdTxt" value="Type 2 · 1000V DC"></label></div></fieldset>`;
  // Off-grid backup source(s): automatic transfer switch(es) built into the isolation panel (ATS-1 = DG / grid, ATS-2 = solar / backup)
  AUTO.add('atsA'); AUTO.add('dgCable');
  const OG_HTML = `<div class="sub" id="ogBox"><b>Backup source — ATS in the isolation panel</b>
<label>Backup source<select id="ogSrc"><option value="dg" selected>Diesel generator (DG) — one ATS</option><option value="grid">Grid (utility) — one ATS</option><option value="both">DG + grid — two ATS</option><option value="">None — solar / battery only (no ATS)</option></select></label>
<label>ATS rating (A) <span class="tag">auto</span><input id="atsA"></label>
<label>DG rating (kVA) <span class="tag">optional</span><input id="dgKva" placeholder="e.g. 100"></label>
<label>DG cable <span class="tag">auto</span><input id="dgCable"></label></div>`;
  $('form').innerHTML = '<fieldset><legend>System configuration</legend><div class="seg">' + [['nm', 'Net metering'], ['na', 'Net accounting'], ['np', 'Net plus'], ['og', 'Off-grid']].map(([k, l]) => `<button type="button" class="alt${k == MODE ? ' on' : ''}" data-mode="${k}">${l}</button>`).join('') + '</div><div class="hint" id="modeHint"></div>' + OG_HTML + '</fieldset>' + SPEC.map(([g, fs]) => g == 'INV'
    ? '<fieldset><legend>Inverters</legend><div id="invList"></div><button type="button" class="alt" id="addInv"><svg width="12" height="12" viewBox="0 0 14 14"><path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg> Add inverter</button></fieldset>'
    : g == 'BESS' ? '<fieldset><legend>Battery (BESS)</legend><div id="bessList"></div><button type="button" class="alt" id="addBess"><svg width="12" height="12" viewBox="0 0 14 14"><path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg> Add battery</button></fieldset>'
    : g == 'LOC2' ? '<fieldset><legend>Second location</legend><div id="loc2Body"></div></fieldset>'
    : g == 'PROT' ? PROT_HTML
    : `<fieldset><legend>${g}</legend>` + fs.map(fld).join('') + (g == 'Cables & switchgear' ? '<button type="button" class="alt" id="rst">↺ Reset all to auto</button>' : '') + '</fieldset>').join('');
  // ---- Left panel tabs: the form's sections grouped into a few short tabs (all fields stay in the page, only hidden) ----
  const TABS = [['sys', 'System', ['System configuration', 'Solar array', 'Inverters', 'Battery (BESS)']], ['loc2', 'Location 2', ['Second location']],
    ['sw', 'Cables & breakers', ['Cables & switchgear']], ['prot', 'Protection', ['Panels & protection']], ['proj', 'Project', ['Drawing', 'Sign-off']]];
  (() => {
    const form = $('form'), fsets = [...form.querySelectorAll(':scope > fieldset')], byName = n => fsets.find(f => f.querySelector('legend').textContent.trim() == n);
    const bar = document.createElement('div'); bar.className = 'tabs'; bar.setAttribute('role', 'tablist');
    bar.innerHTML = TABS.map(([k, l]) => `<button type="button" class="alt" role="tab" data-tab="${k}" id="tab_${k}">${l}</button>`).join('');
    form.prepend(bar);
    TABS.forEach(([k, , names]) => { const p = document.createElement('div'); p.className = 'pane'; p.dataset.pane = k; p.setAttribute('role', 'tabpanel'); names.forEach(n => { const f = byName(n); if (f) p.appendChild(f); }); form.appendChild(p); });
    const show = k => { form.querySelectorAll('.pane').forEach(p => p.hidden = p.dataset.pane != k); bar.querySelectorAll('button').forEach(b => { const on = b.dataset.tab == k; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); }); form.scrollTop = 0; try { localStorage.setItem('sld_tab', k); } catch (e) { } };
    bar.addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) show(b.dataset.tab); });
    let k0 = 'sys'; try { k0 = localStorage.getItem('sld_tab') || 'sys'; } catch (e) { } show(TABS.some(t => t[0] == k0) ? k0 : 'sys');
  })();
  const RM = '<svg width="12" height="12" viewBox="0 0 14 14"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  const AD = '<svg width="12" height="12" viewBox="0 0 14 14"><path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  const invCard = (s, i, canRemove) => { const b = D[s.m].brand, hyb = D[s.m].type == 'hybrid'; return `<div class="inv" data-i="${i}"><div class="ih"><b>Inverter ${i + 1}</b>${canRemove ? `<button type="button" class="ic" data-a="rm" title="Remove inverter" aria-label="Remove inverter ${i + 1}">${RM}</button>` : ''}</div>
<label>Brand<select data-a="b">${brands.map(x => `<option${x == b ? ' selected' : ''}>${x}</option>`).join('')}</select></label>
<label>Model<select data-a="m">${D.map((d, j) => d.brand == b ? `<option value="${j}"${j == s.m ? ' selected' : ''}>${esc(d.model)} (${d.current} A)${d.type == 'hybrid' ? ' — hybrid' : ''}</option>` : '').join('')}</select></label>
<div class="two"><label>PV modules<input data-a="mods" type="number" min="0" value="${s.mods}"></label><label>Strings<input data-a="cfg" value="${esc(s.cfg)}"></label></div>
<label>DC cable <span class="tag">site-specific</span><input data-a="dc" value="${esc(s.dc)}" placeholder="depends on array-to-inverter distance"></label>
${hyb ? `<label>Integrated battery — capacity (kWh) <span class="tag">hybrid</span><input data-a="battKwh" type="number" min="0" value="${esc(s.battKwh)}" placeholder="0 = none"></label>
<label>Battery DC cable <span class="tag">site-specific</span><input data-a="battDc" value="${esc(s.battDc)}"></label>` : ''}
<label>Breaker override (A) — blank = auto<input data-a="ov" value="${esc(s.ov)}"></label>
<label>AC cable override — blank = auto<input data-a="acOv" value="${esc(s.acOv || '')}" placeholder="e.g. 35mm²/4C/Cu/XLPE/PVC"></label><div class="inf"></div></div>`; };
  const bessCard = (s, i) => `<div class="inv" data-i="${i}"><div class="ih"><b>BESS ${i + 1}</b><button type="button" class="ic" data-a="rm" title="Remove battery" aria-label="Remove BESS ${i + 1}">${RM}</button></div>
<div class="two"><label>Capacity (kWh)<input data-a="kwh" type="number" min="0" value="${s.kwh}"></label><label>PCS rating (kW)<input data-a="kw" type="number" min="0" value="${s.kw}"></label></div>
<label>Model<input data-a="model" value="${esc(s.model)}"></label>
<label>DC cable <span class="tag">site-specific</span><input data-a="dc" value="${esc(s.dc)}"></label>
<label>Breaker override (A) — blank = auto<input data-a="ov" value="${esc(s.ov)}"></label>
<label>AC cable override — blank = auto<input data-a="acOv" value="${esc(s.acOv || '')}" placeholder="e.g. 35mm²/4C/Cu/XLPE/PVC"></label><div class="inf"></div></div>`;
  function drawInvs() { $('invList').innerHTML = INVS.map((s, i) => invCard(s, i, i > 0)).join(''); }
  function drawBess() { $('bessList').innerHTML = BESSU.map(bessCard).join('') || '<p class="hint">No battery added — off-grid or hybrid-only sites can skip this.</p>'; }
  function drawInvs2() { $('invList2').innerHTML = INVS2.map((s, i) => invCard(s, i, true)).join('') || '<p class="hint">No inverters at this location yet.</p>'; }
  function drawBess2() { $('bessList2').innerHTML = BESSU2.map(bessCard).join('') || '<p class="hint">No battery at this location.</p>'; }
  function drawLoc2Shell() {
    if (!LOC2.on) { $('loc2Body').innerHTML = '<p class="hint">A second physical switchgear location on site, wired back with a breaker at each end of the interconnecting cable — to either the main switchgear panel or the isolation panel.</p><button type="button" class="alt" id="addLoc2">' + AD + ' Add second location</button>'; return; }
    $('loc2Body').innerHTML = `<label>Connects to<select id="loc2To"><option value="main"${LOC2.to == 'main' ? ' selected' : ''}>Main switchgear panel</option><option value="iso"${LOC2.to == 'iso' ? ' selected' : ''}>Isolation panel${MODE == 'og' ? ' (Load DB)' : ''}</option></select></label>
<label>Location name<input id="loc2Name" value="${esc(LOC2.name)}"></label>
<label>Interconnecting cable override — blank = auto<input id="loc2Cable" value="${esc(LOC2.cableOv || '')}"></label>
<label>PV array main earth (roof) override — blank = auto by no. of inverters<input id="loc2PvEarth" value="${esc(LOC2.pvEarthOv || '')}" placeholder="e.g. 16mm² Cu"></label>
<button type="button" class="alt" id="rmLoc2">✕ Remove second location</button>
<div class="sub"><b>Inverters — ${esc(LOC2.name)}</b><div id="invList2"></div><button type="button" class="alt" id="addInv2">${AD} Add inverter</button></div>
<div class="sub"><b>Battery (BESS) — ${esc(LOC2.name)}</b><div id="bessList2"></div><button type="button" class="alt" id="addBess2">${AD} Add battery</button></div>`;
    drawInvs2(); drawBess2();
  }
  $('invList').addEventListener('input', e => {
    const a = e.target.dataset.a, i = +e.target.closest('.inv').dataset.i;
    if (a == 'b') { INVS[i].m = firstOf(e.target.value); drawInvs(); } else if (a == 'm') { INVS[i].m = +e.target.value; drawInvs(); } else INVS[i][a] = e.target.value;
    update();
  });
  $('invList').addEventListener('click', e => { const b = e.target.closest('[data-a=rm]'); if (b) { INVS.splice(+b.closest('.inv').dataset.i, 1); drawInvs(); update(); } });
  $('addInv').onclick = () => { INVS.push({ ...INVS[INVS.length - 1] }); drawInvs(); update(); };
  $('bessList').addEventListener('input', e => { const a = e.target.dataset.a, i = +e.target.closest('.inv').dataset.i; BESSU[i][a] = e.target.value; update(); });
  $('bessList').addEventListener('click', e => { const b = e.target.closest('[data-a=rm]'); if (b) { BESSU.splice(+b.closest('.inv').dataset.i, 1); drawBess(); update(); } });
  $('addBess').onclick = () => { BESSU.push(BESSU.length ? { ...BESSU[BESSU.length - 1] } : { kwh: 100, kw: 50, model: 'BESS', ov: '', acOv: '', dc: 'DC cable' }); drawBess(); update(); };
  $('loc2Body').addEventListener('input', e => {
    const a = e.target.dataset.a;
    if (e.target.id == 'loc2To') { LOC2.to = e.target.value; update(); return; }
    if (e.target.id == 'loc2Name') { LOC2.name = e.target.value; drawLoc2Shell(); update(); return; }
    if (e.target.id == 'loc2Cable') { LOC2.cableOv = e.target.value; update(); return; }
    if (e.target.id == 'loc2PvEarth') { LOC2.pvEarthOv = e.target.value; update(); return; }
    const card = e.target.closest('.inv'); if (!card || !a) return;
    const i = +card.dataset.i;
    if (e.target.closest('#invList2')) { if (a == 'b') { INVS2[i].m = firstOf(e.target.value); drawInvs2(); } else if (a == 'm') { INVS2[i].m = +e.target.value; drawInvs2(); } else INVS2[i][a] = e.target.value; update(); }
    else if (e.target.closest('#bessList2')) { BESSU2[i][a] = e.target.value; update(); }
  });
  $('loc2Body').addEventListener('click', e => {
    if (e.target.closest('#addLoc2')) { LOC2.on = true; if (!INVS2.length) INVS2.push({ ...INVS[0] }); drawLoc2Shell(); update(); return; }
    if (e.target.closest('#rmLoc2')) { LOC2.on = false; drawLoc2Shell(); update(); return; }
    if (e.target.closest('#addInv2')) { INVS2.push(INVS2.length ? { ...INVS2[INVS2.length - 1] } : { ...INVS[0] }); drawInvs2(); update(); return; }
    if (e.target.closest('#addBess2')) { BESSU2.push(BESSU2.length ? { ...BESSU2[BESSU2.length - 1] } : { kwh: 100, kw: 50, model: 'BESS', ov: '', acOv: '', dc: 'DC cable' }); drawBess2(); update(); return; }
    const rm = e.target.closest('[data-a=rm]'); if (!rm) return;
    if (rm.closest('#invList2')) { INVS2.splice(+rm.closest('.inv').dataset.i, 1); drawInvs2(); update(); }
    else if (rm.closest('#bessList2')) { BESSU2.splice(+rm.closest('.inv').dataset.i, 1); drawBess2(); update(); }
  });
  document.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { MODE = b.dataset.mode; document.querySelectorAll('[data-mode]').forEach(x => x.classList.toggle('on', x == b)); if (LOC2.on) drawLoc2Shell(); update(); });
  $('rst').onclick = () => { manual.clear(); update(); };
  $('form').addEventListener('input', e => { if (AUTO.has(e.target.id)) manual.add(e.target.id); update(); });
  function mkInvInfos(list) { return list.map(s => { const e = D[s.m], x = S.info(e), o = parseFloat(s.ov); return { ...x, mods: +s.mods || 0, cfg: s.cfg, dc: s.dc, strs: S.strCount(s.cfg), mccb: o > 0 ? o : x.mccb, ac: s.acOv || x.ac, acOverridden: !!s.acOv, battKwh: +s.battKwh || 0, battDc: s.battDc }; }); }
  function mkBessInfos(list) { return list.map(s => { const x = S.bessInfo(+s.kw || 0), o = parseFloat(s.ov); return { ...x, kwh: +s.kwh || 0, kw: +s.kw || 0, model: s.model, dc: s.dc, mccb: o > 0 ? o : x.mccb, ac: s.acOv || x.ac, acOverridden: !!s.acOv }; }); }
  function update() {
    const wp = +$('modWp').value || 0;
    const invInfos = mkInvInfos(INVS), bessInfos = mkBessInfos(BESSU);
    const invInfos2 = LOC2.on ? mkInvInfos(INVS2) : [], bessInfos2 = LOC2.on ? mkBessInfos(BESSU2) : [];
    // Location 2's own incomer breaker (both ends of its interconnecting cable) is sized from Location 2's own current only —
    // it never changes when main-location inverters/BESS are added, and is recalculated whenever Location 2's own units change.
    const d2 = LOC2.on ? S.derive(invInfos2.map(i => i.I), bessInfos2.map(b => b.I), MODE) : null;
    // System sizing: if Location 2 feeds the MAIN panel, that panel (breaker, busbar, cable) carries both locations; if it feeds the
    // ISOLATION panel, the main panel stays main-only while the isolator / isolation busbar / utility cable carry the total.
    const allI = invInfos.concat(LOC2.on ? invInfos2 : []).map(i => i.I), allB = bessInfos.concat(LOC2.on ? bessInfos2 : []).map(b => b.I);
    const dMain = S.derive(invInfos.map(i => i.I), bessInfos.map(b => b.I), MODE), dTot = S.derive(allI, allB, MODE);
    const d = LOC2.on ? { ...dTot } : dMain;
    if (LOC2.on && LOC2.to == 'iso') { d.panel = dMain.panel; d.bus = dMain.bus; d.mainCable = dMain.mainCable; d.T = dMain.T; }
    dMain.pvEarth = d.pvEarth = S.pvEarth(invInfos.length);
    const ogSrc = MODE == 'og' ? $('ogSrc').value : '';
    d.atsA = d.iso; d.dgCable = d.utilCable;
    d.loadCable = ogSrc ? d.utilCable : S.cableFor($('loadBrk').value);
    AUTO.forEach(k => { const el = $(k); if (!manual.has(k)) el.value = d[k]; el.classList.toggle('man', manual.has(k)); });
    $('totalKw').value = ((invInfos.reduce((a, i) => a + i.mods, 0) + (LOC2.on ? invInfos2.reduce((a, i) => a + i.mods, 0) : 0)) * wp / 1000).toFixed(2);
    const V = { mode: MODE, loc2on: LOC2.on, loc2to: LOC2.to, loc2name: LOC2.name, loc2cable: LOC2.cableOv || (d2 ? d2.utilCable : ''), loc2earth: d2 ? d2.earthMain : '', loc2pvearth: LOC2.pvEarthOv || (LOC2.on ? S.pvEarth(invInfos2.length) : ''), loc2panel: d2 ? d2.panel : 0, loc2panelI: d2 ? d2.T : 0, panelI: d.T, loc2bus: d2 ? d2.bus : 0 }; document.querySelectorAll('#form input[id], #form select[id]').forEach(el => V[el.id] = el.value);
    $('modeHint').textContent = HINT[MODE]; ['loadName', 'loadBrk', 'loadCable'].forEach(k => $(k).parentElement.hidden = MODE == 'np' || (MODE == 'og' && !(ogSrc && k != 'loadBrk')));
    $('ogBox').hidden = MODE != 'og'; $('atsA').parentElement.hidden = !ogSrc; ['dgKva', 'dgCable'].forEach(k => $(k).parentElement.hidden = !(ogSrc == 'dg' || ogSrc == 'both'));
    $('ipL2Box').hidden = !LOC2.on; $('tab_loc2').textContent = LOC2.on ? 'Location 2 ●' : 'Location 2'; $('efrIso').parentElement.hidden = MODE == 'og' && !ogSrc; $('isoPanelTitle').textContent = MODE == 'og' ? (ogSrc ? 'Isolation panel (ATS)' : 'Load distribution board (Load DB)') : 'Isolation panel';
    $('efrMainSet').parentElement.hidden = !$('efrMain').value; $('efrIsoSet').parentElement.hidden = !$('efrIso').value || (MODE == 'og' && !ogSrc);
    $('dcIsoTxt').parentElement.hidden = !$('dcIso').value; $('dcSpdTxt').parentElement.hidden = !$('dcSpd').value;
    $('out').innerHTML = S.renderBlock(V, invInfos, bessInfos, invInfos2, bessInfos2); $('out2').innerHTML = S.renderSLD(V, invInfos, bessInfos, invInfos2, bessInfos2);
    document.querySelectorAll('#invList .inf').forEach((el, i) => { const x = invInfos[i]; el.textContent = `${x.kw} kW · ${x.I} A · AC ${x.ac} · ${S.brkType(x.mccb, x.I)} ${x.mccb} A · ${x.earth}${x.derived ? ' (cable derived – not in file)' : ''}${x.hybrid && x.battKwh ? ` · + ${x.battKwh} kWh integrated battery` : ''}`; });
    document.querySelectorAll('#bessList .inf').forEach((el, i) => { const x = bessInfos[i]; el.textContent = `${x.I.toFixed(1)} A · AC ${x.ac} · ${S.brkType(x.mccb, x.I)} ${x.mccb} A · ${x.earth}`; });
    if (LOC2.on) {
      document.querySelectorAll('#invList2 .inf').forEach((el, i) => { const x = invInfos2[i]; el.textContent = `${x.kw} kW · ${x.I} A · AC ${x.ac} · ${S.brkType(x.mccb, x.I)} ${x.mccb} A · ${x.earth}${x.hybrid && x.battKwh ? ` · + ${x.battKwh} kWh integrated battery` : ''}`; });
      document.querySelectorAll('#bessList2 .inf').forEach((el, i) => { const x = bessInfos2[i]; el.textContent = `${x.I.toFixed(1)} A · AC ${x.ac} · ${S.brkType(x.mccb, x.I)} ${x.mccb} A · ${x.earth}`; });
    }
  }
  let cur = 'out';
  [['t1', 'out'], ['t2', 'out2'], ['t3', 'out3']].forEach(([b, o]) => $(b).onclick = () => {
    cur = o; $('out').hidden = o != 'out'; $('out2').hidden = o != 'out2'; $('out3').hidden = o != 'out3';
    $('t1').classList.toggle('on', o == 'out'); $('t2').classList.toggle('on', o == 'out2'); $('t3').classList.toggle('on', o == 'out3');
    $('dl').hidden = $('pr').hidden = o == 'out3'; if (o == 'out3') { drawHistory(); sync(true); }
  });
  $('pr').onclick = () => {
    const svgEl = $(cur).querySelector('svg'); if (!svgEl) return;
    const svgUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(svgEl));
    const img = new Image();
    img.onload = () => {
      const W = 4134, H = 2925; // ~354dpi A4 landscape — pushed further for maximum sharpness
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      const ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); ctx.drawImage(img, 0, 0, W, H);
      try {
        const pdf = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
        pdf.addImage(cv.toDataURL('image/png'), 'PNG', 0, 0, 297, 210);
        pdf.save(($('dno').value || 'SLD') + (cur == 'out' ? '_block' : '_SLD') + '_' + MODE + '.pdf');
      } catch (err) { alert('PDF export failed (' + err.message + '). Print to PDF from your browser instead.'); }
    };
    img.onerror = () => alert('PDF export failed — your browser blocked rendering the drawing (this needs an internet connection the first time, to load the PDF library). Print to PDF from your browser instead.');
    img.src = svgUrl;
  };
  $('dl').onclick = () => {
    const svgEl = $(cur).querySelector('svg'); if (!svgEl) return;
    try {
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([SLD.toDXF(svgEl)], { type: 'application/dxf' }));
      a.download = ($('dno').value || 'SLD') + (cur == 'out' ? '_block' : '_SLD') + '_' + MODE + '.dxf'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } catch (err) { alert('CAD export failed (' + err.message + ').'); }
  };

  // ---- History: saved revisions kept in this browser (localStorage), so a project's past states can be reopened later ----
  const HKEY = 'sld_history_v1', HMAX = 200;
  const hLoad = () => { try { return JSON.parse(localStorage.getItem(HKEY)) || []; } catch (e) { return []; } };
  const hSave = list => { try { localStorage.setItem(HKEY, JSON.stringify(list.slice(0, HMAX))); } catch (e) { } };
  const flash = m => { $('msg').textContent = m; setTimeout(() => { if ($('msg').textContent == m) $('msg').textContent = ''; }, 2500); };
  const snap = label => { // snapshot of the whole configuration (same shape as a history entry)
    const fields = {}; document.querySelectorAll('#form input[id], #form select[id]').forEach(el => fields[el.id] = el.value);
    const def = (fields.dno || 'Drawing') + ' — ' + (fields.opt || '') + ' (' + MODE + ')';
    return { id: Date.now(), ts: new Date().toISOString(), label: label || def, mode: MODE, fields, manual: [...manual], invs: JSON.parse(JSON.stringify(INVS)), bess: JSON.parse(JSON.stringify(BESSU)), loc2: JSON.parse(JSON.stringify(LOC2)), invs2: JSON.parse(JSON.stringify(INVS2)), bess2: JSON.parse(JSON.stringify(BESSU2)) };
  };
  let DEFAULT = null; // the untouched start-up configuration (set after the first render)
  $('sv').onclick = () => {
    const e = snap(), label = prompt('Save this revision as:', e.label); if (label == null) return;
    const list = hLoad(); e.label = label || e.label; e.by = SY().name || ''; list.unshift(e);
    hSave(list); flash('Saved to history.'); if (cur == 'out3') drawHistory(); if (SY().token) sync(true);
  };
  // Reset: back to the default project. The current configuration is first saved to history (so nothing is lost), unless the user declines.
  $('rs').onclick = () => {
    const keep = confirm('Reset to the default project?\n\nOK = save the current drawing to History first, then reset.\nCancel = go back (nothing changes).'); if (!keep) return;
    const e = snap('Auto-saved before reset — ' + new Date().toLocaleString()), list = hLoad(); list.unshift(e); hSave(list);
    hApply(Object.assign({}, DEFAULT, { label: 'default project' })); flash('Reset to default. Previous drawing saved in History.');
    $('out').hidden = false; $('out2').hidden = true; $('out3').hidden = true; $('t1').classList.add('on'); $('t2').classList.remove('on'); $('t3').classList.remove('on'); cur = 'out';
  };
  function hApply(e) {
    MODE = e.mode; document.querySelectorAll('[data-mode]').forEach(x => x.classList.toggle('on', x.dataset.mode == MODE));
    manual.clear(); (e.manual || []).forEach(k => manual.add(k));
    INVS = JSON.parse(JSON.stringify(e.invs || INVS)); BESSU = JSON.parse(JSON.stringify(e.bess || []));
    LOC2 = JSON.parse(JSON.stringify(e.loc2 || { on: false, to: 'main', name: 'Location 2', cableOv: '', pvEarthOv: '' })); INVS2 = JSON.parse(JSON.stringify(e.invs2 || [])); BESSU2 = JSON.parse(JSON.stringify(e.bess2 || []));
    drawInvs(); drawBess(); drawLoc2Shell();
    Object.keys(e.fields || {}).forEach(k => { const el = $(k); if (el) el.value = e.fields[k]; });
    update(); flash('Loaded "' + e.label + '".');
    cur = 'out'; $('out').hidden = false; $('out2').hidden = true; $('out3').hidden = true;
    $('t1').classList.add('on'); $('t2').classList.remove('on'); $('t3').classList.remove('on');
  }
  // ---- Team sync: the shared history lives in ONE file (history.json) on a separate branch (sld-data) of the same GitHub repository, so every
  // person using the same web link sees the same saved drawings. Reading needs nothing (public repo); saving needs a GitHub access token (fine-grained,
  // this repository only, "Contents: read and write"), entered once per browser. Merging is by entry id; deletions are remembered so they sync too. ----
  const SYK = 'sld_sync_v1', DELK = 'sld_deleted_v1', BR = 'sld-data', FILE = 'history.json';
  const lsGet = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } }, lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } };
  const guessRepo = () => { const h = location.hostname; return /\.github\.io$/.test(h) ? h.split('.')[0] + '/' + (location.pathname.split('/')[1] || h) : ''; };
  // Team settings fixed by the admin in index.html (SLD_CONFIG): dataRepo = the (private) repository holding the shared history; requireToken = lock the app until a valid token is entered
  const CFG = window.SLD_CONFIG || {}, CREPO = /^[\w.-]+\/[\w.-]+$/.test(CFG.dataRepo || '') ? CFG.dataRepo : '';
  // Username + password sign-in: SLD_CONFIG.users = { username: "<sealed>" } — each person's GitHub token (and display name) is encrypted with THEIR password
  // (PBKDF2-SHA256, 250 000 rounds -> AES-256-GCM). Nobody needs to see a token: they type a username and password; a wrong password cannot unlock anything.
  const USERS = CFG.users && Object.keys(CFG.users).length ? Object.fromEntries(Object.entries(CFG.users).map(([k, v]) => [k.trim().toLowerCase(), v])) : null;
  const ub64 = u8 => { let b = ''; u8.forEach(c => b += String.fromCharCode(c)); return btoa(b); }, b64u = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const kdf = async (pass, salt) => crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 250000, hash: 'SHA-256' }, await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']), { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  const seal = async (pass, obj) => { const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12)), ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await kdf(pass, salt), new TextEncoder().encode(JSON.stringify(obj)))); const o = new Uint8Array(28 + ct.length); o.set(salt); o.set(iv, 16); o.set(ct, 28); return ub64(o); };
  const unseal = async (blob, pass) => { try { const u = b64u(blob); return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: u.slice(16, 28) }, await kdf(pass, u.slice(0, 16)), u.slice(28)))); } catch (e) { return null; } };
  const SY = () => { const o = Object.assign({ repo: guessRepo(), token: '', name: '' }, lsGet(SYK, {})); if (CREPO) o.repo = CREPO; return o; };
  const b64e = str => { const by = new TextEncoder().encode(str); let b = ''; by.forEach(c => b += String.fromCharCode(c)); return btoa(b); };
  let syState = '', syBusy = false;
  const gh = async (path, o = {}) => {
    const c = SY(), r = await fetch('https://api.github.com/repos/' + c.repo + path, Object.assign({}, o, { headers: Object.assign({ Accept: 'application/vnd.github+json' }, c.token ? { Authorization: 'Bearer ' + c.token } : {}, o.headers || {}) }));
    return r;
  };
  async function getRemote() { // -> { data, sha } | null (no file yet)
    const r = await gh('/contents/' + FILE + '?ref=' + BR + '&t=' + Date.now());
    if (r.status == 404) return null; if (!r.ok) throw new Error(r.status == 403 ? 'GitHub rate limit / no access (403)' : 'GitHub error ' + r.status);
    const j = await r.json(); let txt = j.content ? decodeURIComponent(escape(atob(j.content.replace(/\s/g, '')))) : ''; if (!txt && j.download_url) txt = await (await fetch(j.download_url)).text();
    let data = {}; try { data = JSON.parse(txt) || {}; } catch (e) { }
    return { data, sha: j.sha };
  }
  async function putRemote(data, sha) {
    const body = { message: 'SLD history sync' + (SY().name ? ' — ' + SY().name : ''), content: b64e(JSON.stringify(data)), branch: BR }; if (sha) body.sha = sha;
    return gh('/contents/' + FILE, { method: 'PUT', body: JSON.stringify(body) });
  }
  async function ensureBranch() {
    const r = await gh('/branches/' + BR); if (r.ok) return;
    const rr = await gh(''); if (!rr.ok) throw new Error(rr.status == 404 ? 'Repository not found (check name / token access)' : 'GitHub error ' + rr.status);
    const def = (await rr.json()).default_branch, ref = await gh('/git/ref/heads/' + def); if (!ref.ok) throw new Error('Cannot read the default branch (' + ref.status + ')');
    const sha = (await ref.json()).object.sha, mk = await gh('/git/refs', { method: 'POST', body: JSON.stringify({ ref: 'refs/heads/' + BR, sha }) });
    if (!mk.ok && mk.status != 422) throw new Error('Cannot create the ' + BR + ' branch (' + mk.status + ' — token needs Contents: write)');
  }
  const mergeH = (a, b, del) => { const m = new Map(); a.concat(b).forEach(e => { if (e && e.id != null && !del.has(String(e.id)) && !m.has(String(e.id))) m.set(String(e.id), e) }); return [...m.values()].sort((x, y) => (y.ts || '').localeCompare(x.ts || '')).slice(0, HMAX); };
  async function sync(quiet) {
    const c = SY(); if (!/^[\w.-]+\/[\w.-]+$/.test(c.repo)) { syState = 'Enter the repository as owner/name.'; if (cur == 'out3') drawHistory(); return; }
    if (syBusy) return; syBusy = true; syState = 'Syncing…'; if (cur == 'out3') drawHistory();
    try {
      for (let k = 0; k < 4; k++) {
        const rem = await getRemote(), rd = (rem && rem.data) || {}, del = new Set((rd.deleted || []).concat(lsGet(DELK, [])).map(String));
        const merged = mergeH(hLoad(), rd.entries || [], del); hSave(merged); lsSet(DELK, [...del].slice(-500));
        const same = rem && JSON.stringify((rd.entries || []).map(e => e.id)) == JSON.stringify(merged.map(e => e.id)) && (rd.deleted || []).length >= del.size;
        if (!rem && !c.token && !(await gh('')).ok) { syState = '🔒 Team history is private — enter your GitHub token to see and share it.'; break; }
        if (same || !c.token) { syState = (same ? 'In sync' : 'Read-only (no token): team drawings loaded — your own saves stay in this browser') + ' · ' + new Date().toLocaleTimeString(); break; }
        if (!rem) await ensureBranch();
        const r = await putRemote({ entries: merged, deleted: [...del].slice(-500) }, rem && rem.sha);
        if (r.ok) { syState = 'Synced ' + merged.length + ' entries · ' + new Date().toLocaleTimeString(); break; }
        if (r.status == 409 || r.status == 422) continue; // someone else saved at the same moment: re-read and merge again
        throw new Error(r.status == 401 || r.status == 403 || r.status == 404 ? 'Token rejected or has no write access (' + r.status + ')' : 'GitHub error ' + r.status);
      }
    } catch (e) { syState = 'Sync failed: ' + (e.message || e); }
    syBusy = false; if (cur == 'out3') drawHistory(); if (!quiet) flash(syState);
  }
  function syncBox() {
    const c = SY();
    return `<div class="sync-box"><div class="sync-h"><b>Team sync (GitHub)</b><span class="sync-st">${esc(syState || (c.token ? 'Connected — press Sync now' : 'Not connected'))}</span></div>
<div class="sync-g"><label>Repository (owner/name)<input id="syRepo" value="${esc(c.repo)}" placeholder="yourname/repo-name"${CREPO ? ' readonly title="Set by the admin (SLD_CONFIG in index.html)"' : ''}></label>
${USERS ? `<div class="sync-who">${c.token ? 'Signed in as <b>' + esc(c.name) + '</b>' : 'Not signed in'}</div>` : `<label>Your name<input id="syName" value="${esc(c.name)}" placeholder="shown next to what you save"></label>
<label>GitHub token (to save &amp; share)<input id="syTok" type="password" value="${esc(c.token)}" placeholder="optional — leave empty to only read"></label>`}</div>
<div class="btns">${USERS && !c.token ? '<button type="button" class="alt on" data-a="sy-in">🔑 Sign in</button>' : ''}<button type="button" class="alt${USERS && !c.token ? '' : ' on'}" data-a="sy-go">⟳ ${USERS ? 'Sync now' : 'Save settings &amp; sync'}</button><button type="button" class="alt" data-a="sy-exp">⬇ Export file</button><button type="button" class="alt" data-a="sy-imp">⬆ Import file</button><button type="button" class="alt" data-a="sy-off">${USERS ? 'Sign out' : 'Disconnect'}</button></div>
<details><summary>How to set it up (once)</summary><ol><li>On GitHub: <b>Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token</b>.</li><li>Repository access: <b>Only select repositories</b> → this app's repository. Permissions → <b>Contents: Read and write</b>.</li><li>Paste the token above (stored only in this browser) and press <b>Save settings &amp; sync</b>. Everyone who uses the same link and the same repository sees the same History; people without a token can still open and load shared drawings.</li></ol>The history is stored in the <code>${BR}</code> branch (file <code>${FILE}</code>), so saving never redeploys the website. Anyone with a token for the repository can write there — share tokens only with your team.</details></div>`;
  }
  function drawHistory() {
    const list = hLoad();
    $('out3').innerHTML = syncBox() + (list.length ? list.map(e => `<div class="hist-item" data-id="${e.id}"><div><b>${esc(e.label)}</b><span>${esc(e.by ? e.by + ' · ' : '')}${new Date(e.ts).toLocaleString()}</span></div><div class="btns"><button type="button" class="alt" data-a="load">Load</button><button type="button" class="alt ic" data-a="del">Delete</button></div></div>`).join('')
      : '<p class="hist-empty">No saved revisions yet — use "💾 Save to history" above to keep a copy of the current configuration.</p>');
  }
  $('out3').addEventListener('click', e => {
    const a = e.target.dataset && e.target.dataset.a;
    if (a == 'sy-in') { lockScreen('', true); return; }
    if (a == 'sy-go' && USERS) { sync(); return; }
    if (a == 'sy-go') { lsSet(SYK, { repo: $('syRepo').value.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\/$/, ''), token: $('syTok').value.trim(), name: $('syName').value.trim() }); sync(); return; }
    if (a == 'sy-off') { if (confirm(USERS ? 'Sign out on this device?' : 'Disconnect: remove the saved token and repository from this browser? (Saved history stays.)')) { lsSet(SYK, { repo: SY().repo, token: '', name: SY().name, user: SY().user || '' }); lsSet(OKK, ''); syState = 'Disconnected'; drawHistory(); if (CFG.requireToken) lockScreen('Signed out.'); } return; }
    if (a == 'sy-exp') { const u = URL.createObjectURL(new Blob([JSON.stringify({ entries: hLoad(), deleted: lsGet(DELK, []) }, null, 1)], { type: 'application/json' })), x = document.createElement('a'); x.href = u; x.download = 'sld-history.json'; document.body.appendChild(x); x.click(); x.remove(); setTimeout(() => URL.revokeObjectURL(u), 2000); return; }
    if (a == 'sy-imp') { const f = document.createElement('input'); f.type = 'file'; f.accept = '.json,application/json'; f.onchange = () => { const r = new FileReader(); r.onload = () => { try { const d = JSON.parse(r.result), del = new Set(lsGet(DELK, [])); hSave(mergeH(hLoad(), d.entries || [], del)); drawHistory(); flash('Imported ' + (d.entries || []).length + ' entries.'); if (SY().token) sync(true); } catch (er) { flash('Not a valid history file.'); } }; r.readAsText(f.files[0]); }; f.click(); return; }
    const item = e.target.closest('.hist-item'); if (!item) return;
    const id = +item.dataset.id, list = hLoad(), e2 = list.find(x => x.id == id); if (!e2) return;
    if (e.target.dataset.a == 'load') hApply(e2);
    else if (e.target.dataset.a == 'del') { if (confirm('Delete "' + e2.label + '"?' + (SY().token ? '\n(Also removed from the shared history.)' : ''))) { hSave(list.filter(x => x.id != id)); lsSet(DELK, lsGet(DELK, []).concat(String(id))); drawHistory(); if (SY().token) sync(true); } }
  });
  drawInvs(); drawBess(); drawLoc2Shell(); update(); DEFAULT = snap('default project');
  // ---- Optional sign-in lock (SLD_CONFIG.requireToken): the app stays covered until the person enters a GitHub token that can open the team's data repository.
  // The admin cuts someone off by revoking / deleting their token on GitHub — they are locked out the next time the app starts. ----
  const OKK = 'sld_ok_v1';
  async function tokenOk(tok) { try { const r = await fetch('https://api.github.com/repos/' + SY().repo, { headers: { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + tok } }); return r.ok ? 1 : 0; } catch (e) { return -1; } } // -1 = offline
  function lockScreen(msg, optional) {
    let d = $('lock'); if (!d) { d = document.createElement('div'); d.id = 'lock'; document.body.appendChild(d); }
    const close = optional ? '<button type="button" class="alt" id="lkX">Cancel</button>' : '';
    d.innerHTML = USERS ? `<form class="lock-card" onsubmit="return false"><h2>🔒 Team sign-in</h2><p>${optional ? 'Sign in to see and share the team History.' : 'This SLD generator is for the team only.'}</p>
<label>Username<input id="lkUser" autocomplete="username" autocapitalize="none" value="${esc(SY().user || '')}"></label><label>Password<input id="lkPass" type="password" autocomplete="current-password"></label>
<button type="submit" id="lkGo">Sign in</button>${close}<p class="lock-msg">${esc(msg || '')}</p></form>`
      : `<form class="lock-card" onsubmit="return false"><h2>🔒 Team sign-in</h2><p>Enter your name and the GitHub access token you were given.</p>
<label>Your name<input id="lkName" value="${esc(SY().name)}"></label><label>GitHub token<input id="lkTok" type="password" placeholder="github_pat_…"></label>
<button type="submit" id="lkGo">Sign in</button>${close}<p class="lock-msg">${esc(msg || '')}</p></form>`;
    if (optional) $('lkX').onclick = () => d.remove();
    (USERS ? $('lkUser').value ? $('lkPass') : $('lkUser') : $('lkTok')).focus();
    $('lkGo').onclick = async () => {
      let tok, nm, user = '';
      if (USERS) {
        user = $('lkUser').value.trim().toLowerCase(); const pw = $('lkPass').value; if (!user || !pw) return lockScreen('Enter your username and password.', optional);
        $('lkGo').disabled = true; $('lkGo').textContent = 'Checking…';
        const o = USERS[user] ? await unseal(USERS[user], pw) : null; if (!o || !o.t) return lockScreen('Wrong username or password.', optional);
        tok = o.t; nm = o.n || user;
      } else { tok = $('lkTok').value.trim(); nm = $('lkName').value.trim(); if (!tok) return lockScreen('Enter a token.', optional); $('lkGo').disabled = true; $('lkGo').textContent = 'Checking…'; }
      const ok = await tokenOk(tok);
      if (ok == 1) { lsSet(SYK, Object.assign(SY(), { token: tok, name: nm, user })); lsSet(OKK, SY().repo); d.remove(); flash('Signed in as ' + nm + '.'); sync(true); }
      else lockScreen(ok == 0 ? 'Your access has been removed or has expired. Ask your admin.' : 'No internet connection — try again.', optional);
    };
  }
  // ---- Admin page (open the app with #admin at the end of the link): create the sealed line for each user, to paste into SLD_CONFIG.users in index.html ----
  function adminPage() {
    const d = document.createElement('div'); d.id = 'lock'; document.body.appendChild(d);
    d.innerHTML = `<form class="lock-card wide" onsubmit="return false"><h2>👤 Admin — add a team member</h2><p>Runs only in this browser; nothing is sent anywhere. Give each person their own GitHub token (fine-grained, the data repository only, Contents: Read and write) — to remove someone later, delete their token on GitHub.</p>
<label>Username (for signing in)<input id="adU" autocapitalize="none"></label><label>Display name (shown in History)<input id="adN"></label>
<label>Password (min 8 characters)<input id="adP" type="password"></label><label>Repeat password<input id="adP2" type="password"></label>
<label>That person's GitHub token<input id="adT" type="password" placeholder="github_pat_…"></label>
<button type="submit" id="adGo">Create user line</button><p class="lock-msg" id="adM"></p>
<label>Paste these lines inside <code>users: { … }</code> in index.html (TEAM SETTINGS):<textarea id="adOut" rows="6" readonly></textarea></label>
<button type="button" class="alt" id="adX">Close</button></form>`;
    $('adX').onclick = () => { d.remove(); history.replaceState(null, '', location.pathname + location.search); };
    $('adGo').onclick = async () => {
      const u = $('adU').value.trim().toLowerCase(), n = $('adN').value.trim() || u, p = $('adP').value, t = $('adT').value.trim();
      if (!/^[a-z0-9._-]{2,32}$/.test(u)) return $('adM').textContent = 'Username: 2–32 letters / numbers / . _ -';
      if (p.length < 8) return $('adM').textContent = 'Password must be at least 8 characters.'; if (p != $('adP2').value) return $('adM').textContent = 'Passwords do not match.';
      if (!t) return $('adM').textContent = 'Enter the GitHub token.';
      $('adM').textContent = 'Encrypting…'; const line = `    "${u}": "${await seal(p, { t, n })}",`;
      $('adOut').value += ($('adOut').value ? '\n' : '') + line; $('adM').textContent = '✓ ' + u + ' added below. Tell them their username and password.'; $('adM').style.cssText = 'color:#0a7a2f!important'; $('adP').value = $('adP2').value = $('adT').value = '';
    };
  }
  (async () => {
    const http = /^https?:$/.test(location.protocol), c = SY();
    if (location.hash == '#admin') return adminPage();
    if (CFG.requireToken && http) {
      if (!c.token) return lockScreen();
      const ok = await tokenOk(c.token);
      if (ok == 0) { lsSet(SYK, Object.assign(c, { token: '' })); lsSet(OKK, ''); return lockScreen('Your access has ended (token expired or revoked). Ask your admin for a new token.'); }
      if (ok == -1 && lsGet(OKK, '') != c.repo) return lockScreen('No internet connection — sign-in needs internet the first time.');
    }
    if (/^[\w.-]+\/[\w.-]+$/.test(c.repo) && http) sync(true); // pick up what the team has saved
  })();
})();
