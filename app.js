(function () {
  const D = window.SLD_INVERTERS, S = window.SLD, $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const AUTO = new Set(), RO = new Set(), manual = new Set(), brands = [...new Set(D.map(d => d.brand))];
  const firstOf = b => D.findIndex(d => d.brand == b);
  const today = () => new Date().toISOString().slice(0, 10);
  let MODE = 'nm';
  const HINT = { nm: 'Solar feeds the site load; surplus is exported. Load sits on the isolation-panel busbar.', na: 'Same connection as net metering; only the metering / billing arrangement differs (edit the meter label if needed).', np: 'All solar generation is exported to the grid. No site load is connected.' };
  let INVS = [{ m: Math.max(0, D.findIndex(d => d.model == 'STT-45KTL')), mods: 84, cfg: '18x2+15x2+9+9', ov: '', dc: '4mm² DC Cable' }];
  let BESSU = []; // { kwh, kw, model, ov, dc }
  // [group, [[id, label, default, flag]]]  flag: 1 = auto (overridable), 2 = auto (read-only, always computed)
  const SPEC = [
    ['Drawing', [['proj', 'Project title (use {kW} for the auto total)', 'PROPOSED {kW} kW SOLAR POWER SYSTEM FOR RODESHA ENTERPRISES MORATUWA'], ['loc', 'Location', '25 Lunawa Station Rd, Moratuwa'], ['dno', 'Drawing no', 'RR_2026_118'], ['rev', 'Revision', 'Preliminary'], ['date', 'Date', today(), 3], ['totalKw', 'Total DC capacity (kWp)', '', 2], ['opt', 'Option label', 'Option 1']]],
    ['INV'], ['BESS'],
    ['Solar array', [['modWp', 'Panel Wp', '620']]],
    ['Cables & switchgear', [['mainCable', 'Main cable to isolator', '', 1], ['utilCable', 'Utility cable', '', 1], ['earthMain', 'Earth bus feeder', '', 1], ['panel', 'Main switchgear panel (A)', '', 1], ['bus', 'Common coupling busbar (A)', '', 1], ['iso', 'Isolator (A)', '', 1], ['isoBus', 'Isolation panel busbar (A)', '', 1], ['meterLbl', 'Meter label', '', 1], ['earthR', 'Earth resistance (Ω max)', '10'], ['loadName', 'Load / DB name', 'LOAD'], ['loadBrk', 'Load feeder MCCB (A)', '100'], ['loadCable', 'Load feeder cable', '', 1]]],
    ['Sign-off', [['designed', 'Designed by', 'K.U.S.Panagoda'], ['drawn', 'Drawn by', 'K.U.S.Panagoda'], ['checked', 'Checked by', 'Kavish / Uditha'], ['director', 'Director / CTO', 'Champika Periyapperuma'], ['exec', 'Project executive', 'Kavish Weerasinghe']]]];
  const fld = ([k, l, v, flag]) => {
    if (flag == 1) AUTO.add(k); if (flag == 2) RO.add(k);
    const tag = flag == 2 ? ' <span class="tag">auto</span>' : flag == 1 ? ' <span class="tag">auto</span>' : '';
    if (flag == 3) return `<label>${l}<input type="date" id="${k}" value="${esc(v)}"></label>`;
    return `<label>${l}${tag}<input id="${k}" value="${esc(v)}"${flag == 2 ? ' readonly' : ''}></label>`;
  };
  $('form').innerHTML = '<fieldset><legend>System configuration</legend><div class="seg">' + [['nm', 'Net metering'], ['na', 'Net accounting'], ['np', 'Net plus']].map(([k, l]) => `<button type="button" class="alt${k == MODE ? ' on' : ''}" data-mode="${k}">${l}</button>`).join('') + '</div><div class="hint" id="modeHint"></div></fieldset>' + SPEC.map(([g, fs]) => g == 'INV'
    ? '<fieldset><legend>Inverters</legend><div id="invList"></div><button type="button" class="alt" id="addInv"><svg width="12" height="12" viewBox="0 0 14 14"><path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg> Add inverter</button></fieldset>'
    : g == 'BESS' ? '<fieldset><legend>Battery (BESS)</legend><div id="bessList"></div><button type="button" class="alt" id="addBess"><svg width="12" height="12" viewBox="0 0 14 14"><path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg> Add battery</button></fieldset>'
    : `<fieldset><legend>${g}</legend>` + fs.map(fld).join('') + (g == 'Cables & switchgear' ? '<button type="button" class="alt" id="rst">↺ Reset all to auto</button>' : '') + '</fieldset>').join('');
  const RM = '<svg width="12" height="12" viewBox="0 0 14 14"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  function drawInvs() {
    $('invList').innerHTML = INVS.map((s, i) => { const b = D[s.m].brand; return `<div class="inv" data-i="${i}"><div class="ih"><b>Inverter ${i + 1}</b>${i ? `<button type="button" class="ic" data-a="rm" title="Remove inverter" aria-label="Remove inverter ${i + 1}">${RM}</button>` : ''}</div>
<label>Brand<select data-a="b">${brands.map(x => `<option${x == b ? ' selected' : ''}>${x}</option>`).join('')}</select></label>
<label>Model<select data-a="m">${D.map((d, j) => d.brand == b ? `<option value="${j}"${j == s.m ? ' selected' : ''}>${esc(d.model)} (${d.current} A)</option>` : '').join('')}</select></label>
<div class="two"><label>PV modules<input data-a="mods" type="number" min="0" value="${s.mods}"></label><label>Strings<input data-a="cfg" value="${esc(s.cfg)}"></label></div>
<label>DC cable <span class="tag">site-specific</span><input data-a="dc" value="${esc(s.dc)}" placeholder="depends on array-to-inverter distance"></label>
<label>MCCB override (A) — blank = auto<input data-a="ov" value="${esc(s.ov)}"></label><div class="inf"></div></div>`; }).join('');
  }
  function drawBess() {
    $('bessList').innerHTML = BESSU.map((s, i) => `<div class="inv" data-i="${i}"><div class="ih"><b>BESS ${i + 1}</b><button type="button" class="ic" data-a="rm" title="Remove battery" aria-label="Remove BESS ${i + 1}">${RM}</button></div>
<div class="two"><label>Capacity (kWh)<input data-a="kwh" type="number" min="0" value="${s.kwh}"></label><label>PCS rating (kW)<input data-a="kw" type="number" min="0" value="${s.kw}"></label></div>
<label>Model<input data-a="model" value="${esc(s.model)}"></label>
<label>DC cable <span class="tag">site-specific</span><input data-a="dc" value="${esc(s.dc)}"></label>
<label>MCCB override (A) — blank = auto<input data-a="ov" value="${esc(s.ov)}"></label><div class="inf"></div></div>`).join('') || '<p class="hint">No battery added — off-grid or hybrid-only sites can skip this.</p>';
  }
  $('invList').addEventListener('input', e => {
    const a = e.target.dataset.a, i = +e.target.closest('.inv').dataset.i;
    if (a == 'b') { INVS[i].m = firstOf(e.target.value); drawInvs(); } else if (a == 'm') INVS[i].m = +e.target.value; else INVS[i][a] = e.target.value;
    update();
  });
  $('invList').addEventListener('click', e => { const b = e.target.closest('[data-a=rm]'); if (b) { INVS.splice(+b.closest('.inv').dataset.i, 1); drawInvs(); update(); } });
  $('addInv').onclick = () => { INVS.push({ ...INVS[INVS.length - 1] }); drawInvs(); update(); };
  $('bessList').addEventListener('input', e => { const a = e.target.dataset.a, i = +e.target.closest('.inv').dataset.i; BESSU[i][a] = e.target.value; update(); });
  $('bessList').addEventListener('click', e => { const b = e.target.closest('[data-a=rm]'); if (b) { BESSU.splice(+b.closest('.inv').dataset.i, 1); drawBess(); update(); } });
  $('addBess').onclick = () => { BESSU.push(BESSU.length ? { ...BESSU[BESSU.length - 1] } : { kwh: 100, kw: 50, model: 'BESS', ov: '', dc: 'DC cable' }); drawBess(); update(); };
  document.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { MODE = b.dataset.mode; document.querySelectorAll('[data-mode]').forEach(x => x.classList.toggle('on', x == b)); update(); });
  $('rst').onclick = () => { manual.clear(); update(); };
  $('form').addEventListener('input', e => { if (AUTO.has(e.target.id)) manual.add(e.target.id); update(); });
  function update() {
    const wp = +$('modWp').value || 0;
    const invInfos = INVS.map(s => { const e = D[s.m], x = S.info(e), o = parseFloat(s.ov); return { ...x, mods: +s.mods || 0, cfg: s.cfg, dc: s.dc, strs: S.strCount(s.cfg), mccb: o > 0 ? o : x.mccb }; });
    const bessInfos = BESSU.map(s => { const x = S.bessInfo(+s.kw || 0), o = parseFloat(s.ov); return { ...x, kwh: +s.kwh || 0, kw: +s.kw || 0, model: s.model, dc: s.dc, mccb: o > 0 ? o : x.mccb }; });
    const d = S.derive(invInfos.map(i => i.I).concat(bessInfos.map(b => b.I)), MODE);
    d.loadCable = S.cableFor($('loadBrk').value);
    AUTO.forEach(k => { const el = $(k); if (!manual.has(k)) el.value = d[k]; el.classList.toggle('man', manual.has(k)); });
    $('totalKw').value = (invInfos.reduce((a, i) => a + i.mods, 0) * wp / 1000).toFixed(2);
    const V = { mode: MODE }; document.querySelectorAll('#form input[id]').forEach(el => V[el.id] = el.value);
    $('modeHint').textContent = HINT[MODE]; ['loadName', 'loadBrk', 'loadCable'].forEach(k => $(k).parentElement.hidden = MODE == 'np');
    $('out').innerHTML = S.renderBlock(V, invInfos, bessInfos); $('out2').innerHTML = S.renderSLD(V, invInfos, bessInfos);
    document.querySelectorAll('#invList .inf').forEach((el, i) => { const x = invInfos[i]; el.textContent = `${x.kw} kW · ${x.I} A · AC ${x.ac} · MCCB ${x.mccb} A · ${x.earth}${x.derived ? ' (cable derived – not in file)' : ''}`; });
    document.querySelectorAll('#bessList .inf').forEach((el, i) => { const x = bessInfos[i]; el.textContent = `${x.I.toFixed(1)} A · AC ${x.ac} · MCCB ${x.mccb} A · ${x.earth}`; });
  }
  let cur = 'out';
  [['t1', 'out'], ['t2', 'out2'], ['t3', 'out3']].forEach(([b, o]) => $(b).onclick = () => {
    cur = o; $('out').hidden = o != 'out'; $('out2').hidden = o != 'out2'; $('out3').hidden = o != 'out3';
    $('t1').classList.toggle('on', o == 'out'); $('t2').classList.toggle('on', o == 'out2'); $('t3').classList.toggle('on', o == 'out3');
    $('dl').hidden = $('pr').hidden = o == 'out3'; if (o == 'out3') drawHistory();
  });
  $('pr').onclick = () => window.print();
  $('dl').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([$(cur).innerHTML], { type: 'image/svg+xml' })); a.download = ($('dno').value || 'SLD') + (cur == 'out' ? '_block' : '_SLD') + '_' + MODE + '.svg'; a.click(); URL.revokeObjectURL(a.href); };

  // ---- History: saved revisions kept in this browser (localStorage), so a project's past states can be reopened later ----
  const HKEY = 'sld_history_v1', HMAX = 60;
  const hLoad = () => { try { return JSON.parse(localStorage.getItem(HKEY)) || []; } catch (e) { return []; } };
  const hSave = list => { try { localStorage.setItem(HKEY, JSON.stringify(list.slice(0, HMAX))); } catch (e) { } };
  const flash = m => { $('msg').textContent = m; setTimeout(() => { if ($('msg').textContent == m) $('msg').textContent = ''; }, 2500); };
  $('sv').onclick = () => {
    const fields = {}; document.querySelectorAll('#form input[id]').forEach(el => fields[el.id] = el.value);
    const def = (fields.dno || 'Drawing') + ' — ' + (fields.opt || '') + ' (' + MODE + ')';
    const label = prompt('Save this revision as:', def); if (label == null) return;
    const list = hLoad();
    list.unshift({ id: Date.now(), ts: new Date().toISOString(), label: label || def, mode: MODE, fields, manual: [...manual], invs: JSON.parse(JSON.stringify(INVS)), bess: JSON.parse(JSON.stringify(BESSU)) });
    hSave(list); flash('Saved to history.'); if (cur == 'out3') drawHistory();
  };
  function hApply(e) {
    MODE = e.mode; document.querySelectorAll('[data-mode]').forEach(x => x.classList.toggle('on', x.dataset.mode == MODE));
    manual.clear(); (e.manual || []).forEach(k => manual.add(k));
    INVS = JSON.parse(JSON.stringify(e.invs || INVS)); BESSU = JSON.parse(JSON.stringify(e.bess || []));
    drawInvs(); drawBess();
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
  drawInvs(); drawBess(); update();
})();
