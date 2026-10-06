(function () {
  const D = window.SLD_INVERTERS, S = window.SLD, $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const AUTO = new Set(), RO = new Set(), manual = new Set(), brands = [...new Set(D.map(d => d.brand))];
  const firstOf = b => D.findIndex(d => d.brand == b);
  const today = () => new Date().toISOString().slice(0, 10);
  let MODE = 'nm';
  const HINT = { nm: 'Solar feeds the site load; surplus is exported. Load sits on the isolation-panel busbar.', na: 'Same connection as net metering; only the metering / billing arrangement differs (edit the meter label if needed).', np: 'All solar generation is exported to the grid. No site load is connected.', og: 'No utility connection. The main panel feeds the site load directly through a Load Distribution Board (LOAD DB) — no isolator, meter, or grid.' };
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
<label>Earth fault relay (EFR)<select id="efrIso">${YN('Not fitted', 'EFR fitted — CBCT + relay trips isolator')}</select></label>
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
  $('form').innerHTML = '<fieldset><legend>System configuration</legend><div class="seg">' + [['nm', 'Net metering'], ['na', 'Net accounting'], ['np', 'Net plus'], ['og', 'Off-grid']].map(([k, l]) => `<button type="button" class="alt${k == MODE ? ' on' : ''}" data-mode="${k}">${l}</button>`).join('') + '</div><div class="hint" id="modeHint"></div></fieldset>' + SPEC.map(([g, fs]) => g == 'INV'
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
    d.loadCable = S.cableFor($('loadBrk').value);
    AUTO.forEach(k => { const el = $(k); if (!manual.has(k)) el.value = d[k]; el.classList.toggle('man', manual.has(k)); });
    $('totalKw').value = ((invInfos.reduce((a, i) => a + i.mods, 0) + (LOC2.on ? invInfos2.reduce((a, i) => a + i.mods, 0) : 0)) * wp / 1000).toFixed(2);
    const V = { mode: MODE, loc2on: LOC2.on, loc2to: LOC2.to, loc2name: LOC2.name, loc2cable: LOC2.cableOv || (d2 ? d2.utilCable : ''), loc2earth: d2 ? d2.earthMain : '', loc2pvearth: LOC2.pvEarthOv || (LOC2.on ? S.pvEarth(invInfos2.length) : ''), loc2panel: d2 ? d2.panel : 0, loc2panelI: d2 ? d2.T : 0, panelI: d.T, loc2bus: d2 ? d2.bus : 0 }; document.querySelectorAll('#form input[id], #form select[id]').forEach(el => V[el.id] = el.value);
    $('modeHint').textContent = HINT[MODE]; ['loadName', 'loadBrk', 'loadCable'].forEach(k => $(k).parentElement.hidden = MODE == 'np' || MODE == 'og');
    $('ipL2Box').hidden = !LOC2.on; $('tab_loc2').textContent = LOC2.on ? 'Location 2 ●' : 'Location 2'; $('efrIso').parentElement.hidden = MODE == 'og'; $('isoPanelTitle').textContent = MODE == 'og' ? 'Load distribution board (Load DB)' : 'Isolation panel';
    $('efrMainSet').parentElement.hidden = !$('efrMain').value; $('efrIsoSet').parentElement.hidden = !$('efrIso').value || MODE == 'og';
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
    $('dl').hidden = $('pr').hidden = o == 'out3'; if (o == 'out3') drawHistory();
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
  const HKEY = 'sld_history_v1', HMAX = 60;
  const hLoad = () => { try { return JSON.parse(localStorage.getItem(HKEY)) || []; } catch (e) { return []; } };
  const hSave = list => { try { localStorage.setItem(HKEY, JSON.stringify(list.slice(0, HMAX))); } catch (e) { } };
  const flash = m => { $('msg').textContent = m; setTimeout(() => { if ($('msg').textContent == m) $('msg').textContent = ''; }, 2500); };
  $('sv').onclick = () => {
    const fields = {}; document.querySelectorAll('#form input[id], #form select[id]').forEach(el => fields[el.id] = el.value);
    const def = (fields.dno || 'Drawing') + ' — ' + (fields.opt || '') + ' (' + MODE + ')';
    const label = prompt('Save this revision as:', def); if (label == null) return;
    const list = hLoad();
    list.unshift({ id: Date.now(), ts: new Date().toISOString(), label: label || def, mode: MODE, fields, manual: [...manual], invs: JSON.parse(JSON.stringify(INVS)), bess: JSON.parse(JSON.stringify(BESSU)), loc2: JSON.parse(JSON.stringify(LOC2)), invs2: JSON.parse(JSON.stringify(INVS2)), bess2: JSON.parse(JSON.stringify(BESSU2)) });
    hSave(list); flash('Saved to history.'); if (cur == 'out3') drawHistory();
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
  function drawHistory() {
    const list = hLoad();
    $('out3').innerHTML = list.length ? list.map(e => `<div class="hist-item" data-id="${e.id}"><div><b>${esc(e.label)}</b><span>${new Date(e.ts).toLocaleString()}</span></div><div class="btns"><button type="button" class="alt" data-a="load">Load</button><button type="button" class="alt ic" data-a="del">Delete</button></div></div>`).join('')
      : '<p class="hist-empty">No saved revisions yet — use "💾 Save to history" above to keep a copy of the current configuration.</p>';
  }
  $('out3').addEventListener('click', e => {
    const item = e.target.closest('.hist-item'); if (!item) return;
    const id = +item.dataset.id, list = hLoad(), e2 = list.find(x => x.id == id); if (!e2) return;
    if (e.target.dataset.a == 'load') hApply(e2);
    else if (e.target.dataset.a == 'del') { if (confirm('Delete "' + e2.label + '"?')) { hSave(list.filter(x => x.id != id)); drawHistory(); } }
  });
  drawInvs(); drawBess(); drawLoc2Shell(); update();
})();
