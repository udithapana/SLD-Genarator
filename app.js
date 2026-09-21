(function () {
  const D = window.SLD_INVERTERS, S = window.SLD, $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const AUTO = new Set(), manual = new Set(), brands = [...new Set(D.map(d => d.brand))];
  const firstOf = b => D.findIndex(d => d.brand == b);
  let MODE = 'nm';
  const HINT = { nm: 'Solar feeds the site load; surplus is exported. Load sits on the isolation-panel busbar.', na: 'Same connection as net metering; only the metering / billing arrangement differs (edit the meter label if needed).', np: 'All solar generation is exported to the grid. No site load is connected.' };
  let INVS = [{ m: Math.max(0, D.findIndex(d => d.model == 'STT-45KTL')), mods: 84, cfg: '18x2+15x2+9+9', ov: '' }];
  // [group, [[id, label, default, auto?]]]
  const SPEC = [
    ['Drawing', [['proj', 'Project title', 'PROPOSED 52.08 kW SOLAR POWER SYSTEM FOR RODESHA ENTERPRISES MORATUWA'], ['loc', 'Location', '25 Lunawa Station Rd, Moratuwa'], ['dno', 'Drawing no', 'RR_2026_118'], ['rev', 'Revision', 'Preliminary'], ['date', 'Date', '21/09/2026'], ['opt', 'Option label', 'Option 1']]],
    ['INV'],
    ['Solar & DC', [['modWp', 'Panel Wp', '620'], ['dcCable', 'DC cable', '4mm² DC Cable']]],
    ['Battery (BESS)', [['bessKwh', 'BESS capacity kWh (0 = none)', '0'], ['bessKw', 'BESS PCS kW', '50'], ['bessModel', 'BESS model', 'BESS'], ['bessMccb', 'BESS MCCB (A)', '', 1], ['bessAc', 'BESS AC cable', '', 1], ['earthSmall', 'BESS PCS earth', '', 1]]],
    ['Cables & switchgear', [['mainCable', 'Main cable to isolator', '', 1], ['utilCable', 'Utility cable', '', 1], ['earthMain', 'Earth bus feeder', '', 1], ['panel', 'Main switchgear panel (A)', '', 1], ['bus', 'Common coupling busbar (A)', '', 1], ['iso', 'Isolator (A)', '', 1], ['isoBus', 'Isolation panel busbar (A)', '', 1], ['meterLbl', 'Meter label', '', 1], ['earthR', 'Earth resistance (Ω max)', '10'], ['loadName', 'Load / DB name', 'LOAD'], ['loadBrk', 'Load feeder MCCB (A)', '100']]],
    ['Sign-off', [['designed', 'Designed by', 'K.U.S.Panagoda'], ['drawn', 'Drawn by', 'K.U.S.Panagoda'], ['checked', 'Checked by', 'Kavish / Uditha'], ['director', 'Director / CTO', 'Champika Periyapperuma'], ['exec', 'Project executive', 'Kavish Weerasinghe']]]];
  const fld = ([k, l, v, a]) => { if (a) AUTO.add(k); return `<label>${l}${a ? ' <span class="tag">auto</span>' : ''}<input id="${k}" value="${esc(v)}"></label>`; };
  $('form').innerHTML = '<fieldset><legend>System configuration</legend><div class="seg">' + [['nm', 'Net metering'], ['na', 'Net accounting'], ['np', 'Net plus']].map(([k, l]) => `<button type="button" class="alt${k == MODE ? ' on' : ''}" data-mode="${k}">${l}</button>`).join('') + '</div><div class="hint" id="modeHint"></div></fieldset>' + SPEC.map(([g, fs]) => g == 'INV'
    ? '<fieldset><legend>Inverters</legend><div id="invList"></div><button type="button" class="alt" id="addInv"><svg width="12" height="12" viewBox="0 0 14 14"><path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg> Add inverter</button></fieldset>'
    : `<fieldset><legend>${g}</legend>` + fs.map(fld).join('') + (g == 'Cables & switchgear' ? '<button type="button" class="alt" id="rst">↺ Reset all to auto</button>' : '') + '</fieldset>').join('');
  const RM = '<svg width="12" height="12" viewBox="0 0 14 14"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  function drawInvs() {
    $('invList').innerHTML = INVS.map((s, i) => { const b = D[s.m].brand; return `<div class="inv" data-i="${i}"><div class="ih"><b>Inverter ${i + 1}</b>${i ? `<button type="button" class="ic" data-a="rm" title="Remove inverter" aria-label="Remove inverter ${i + 1}">${RM}</button>` : ''}</div>
<label>Brand<select data-a="b">${brands.map(x => `<option${x == b ? ' selected' : ''}>${x}</option>`).join('')}</select></label>
<label>Model<select data-a="m">${D.map((d, j) => d.brand == b ? `<option value="${j}"${j == s.m ? ' selected' : ''}>${esc(d.model)} (${d.current} A)</option>` : '').join('')}</select></label>
<div class="two"><label>PV modules<input data-a="mods" type="number" min="0" value="${s.mods}"></label><label>Strings<input data-a="cfg" value="${esc(s.cfg)}"></label></div>
<label>MCCB override (A) — blank = auto<input data-a="ov" value="${esc(s.ov)}"></label><div class="inf"></div></div>`; }).join('');
  }
  $('invList').addEventListener('input', e => {
    const a = e.target.dataset.a, i = +e.target.closest('.inv').dataset.i;
    if (a == 'b') { INVS[i].m = firstOf(e.target.value); drawInvs(); } else if (a == 'm') INVS[i].m = +e.target.value; else INVS[i][a] = e.target.value;
  });
  $('invList').addEventListener('click', e => { const b = e.target.closest('[data-a=rm]'); if (b) { INVS.splice(+b.closest('.inv').dataset.i, 1); drawInvs(); update(); } });
  $('addInv').onclick = () => { INVS.push({ ...INVS[INVS.length - 1] }); drawInvs(); update(); };
  document.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { MODE = b.dataset.mode; document.querySelectorAll('[data-mode]').forEach(x => x.classList.toggle('on', x == b)); update(); });
  $('rst').onclick = () => { manual.clear(); update(); };
  $('form').addEventListener('input', e => { if (AUTO.has(e.target.id)) manual.add(e.target.id); update(); });
  function update() {
    const infos = INVS.map(s => { const e = D[s.m], x = S.info(e), o = parseFloat(s.ov); return { ...x, brand: e.brand, type: e.type, mods: +s.mods || 0, cfg: s.cfg, strs: S.strCount(s.cfg), mccb: o > 0 ? o : x.mccb }; });
    const bk = parseFloat($('bessKwh').value) > 0 ? +$('bessKw').value || 0 : 0, d = S.derive(infos, bk, MODE);
    AUTO.forEach(k => { const el = $(k); if (!manual.has(k)) el.value = d[k]; el.classList.toggle('man', manual.has(k)); });
    const V = { mode: MODE }; document.querySelectorAll('#form input[id]').forEach(el => V[el.id] = el.value);
    $('modeHint').textContent = HINT[MODE]; ['loadName', 'loadBrk'].forEach(k => $(k).parentElement.hidden = MODE == 'np');
    $('out').innerHTML = S.renderBlock(V, infos); $('out2').innerHTML = S.renderSLD(V, infos);
    document.querySelectorAll('.inv .inf').forEach((el, i) => { const x = infos[i]; el.textContent = `${x.kw} kW · ${x.I} A · AC ${x.ac} · MCCB ${x.mccb} A · ${x.earth}${x.derived ? ' (cable derived – not in file)' : ''}`; });
  }
  let cur = 'out';
  [['t1', 'out'], ['t2', 'out2']].forEach(([b, o]) => $(b).onclick = () => { cur = o; $('out').hidden = o != 'out'; $('out2').hidden = o != 'out2'; $('t1').classList.toggle('on', o == 'out'); $('t2').classList.toggle('on', o == 'out2'); });
  $('pr').onclick = () => window.print();
  $('dl').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([$(cur).innerHTML], { type: 'image/svg+xml' })); a.download = ($('dno').value || 'SLD') + (cur == 'out' ? '_block' : '_SLD') + '_' + MODE + '.svg'; a.click(); URL.revokeObjectURL(a.href); };
  drawInvs(); update();
})();
