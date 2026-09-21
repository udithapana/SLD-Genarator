/* Auto-selection rules: inverter current -> cables, MCCB, isolator, busbar, earth.
   Edit the tables below to match company standards. */
(function (G) {
  const S = G.SLD = G.SLD || {};
  const STD = [16,20,25,32,40,50,63,80,100,125,160,200,250,315,400,500,630,800,1000,1250,1600,2000,2500]; // MCCB / isolator ratings (A)
  const BUS = [63,100,125,160,200,250,400,630,800,1000,1250,1600,2000,2500,3200];                       // busbar ratings (A)
  const CAB = [[28.4,6,'Cu/PVC/PVC'],[33.3,10,'Cu/PVC/PVC'],[58,16,'Cu/PVC/PVC'],[63.8,25,'Al/PVC/PVC'],[83.6,35,'Al/XLPE/PVC'],
               [95.7,50,'Al/XLPE/PVC'],[127,70,'Al/XLPE/PVC'],[166.7,95,'Al/XLPE/PVC'],[206.1,120,'Al/XLPE/PVC'],[250,150,'Al/XLPE/PVC']]; // [max A, mm2, type] (from Supporting_file.xlsx)
  const EAR = [[33.3,6],[63.8,10],[127,16],[183.3,25],[206.1,35],[1e9,50]];                              // [max A, Cu earth mm2]
  const MARGIN = 1.25;                                                                                    // breaker = next standard size >= 1.25 x current
  const up = (v, l) => l.find(x => x >= v) || l[l.length - 1];
  const cabFor = I => CAB.find(c => I <= c[0]) || CAB[CAB.length - 1];
  const earFor = I => EAR.find(c => I <= c[0])[1];
  const fmt = s => s.replace(/mm2/g, 'mm²').replace(/\/ ?PVc/i, '/PVC').replace(' Earth Cable', ' Earth');
  const kwOf = (m, I) => { const r = m.match(/(\d+(?:\.\d+)?)\s*K/) || m.match(/(?:SG|HPS-|planet\s)(\d+(?:\.\d+)?)/i); return r ? +r[1] : +(I * 0.6928).toFixed(1); };
  S.strCount = cfg => String(cfg).split('+').reduce((a, p) => { const m = p.match(/(\d+)\s*[x×*]\s*(\d+)/); return a + (m ? +m[2] : (p.trim() ? 1 : 0)); }, 0);
  S.info = e => {
    const I = e.current, c = cabFor(I), b = e.brand.split(' ')[0];
    return { name: e.model.startsWith(b) ? e.model : b + ' ' + e.model, kw: kwOf(e.model, I), I,
             ac: e.ac ? fmt(e.ac) : `${c[1]}mm²/4C/${c[2]}`, earth: fmt(e.earth || `${earFor(I)}mm2 Cu/ PVc Earth Cable`),
             mccb: up(MARGIN * I, STD), derived: !e.ac };
  };
  S.derive = (invs, bessKw, mode) => {
    const bI = bessKw > 0 ? bessKw * 1.443 : 0, T = invs.reduce((a, i) => a + i.I, 0) + bI;
    const iso = up(MARGIN * T, STD), sets = Math.ceil(T / 250) || 1, c = cabFor(T / sets), cb = cabFor(bI);
    return { iso, panel: iso, bus: up(iso, BUS), isoBus: up(iso, BUS), meterLbl: { nm: 'BI-DIRECTIONAL METER', na: 'IMPORT / EXPORT METER', np: 'GENERATION METER' }[mode] || '',
      mainCable: `${c[1]}mm² 1C/Cu/XLPE/PVC (4 Runs${sets > 1 ? ' × ' + sets + ' sets' : ''})`,
      utilCable: `${c[1]}mm² 4C/Cu/XLPE/PVC${sets > 1 ? ' × ' + sets : ''}`, earthMain: `${earFor(T)}mm² Cu`,
      bessMccb: bI ? up(MARGIN * bI, STD) : '', bessAc: bI ? `${cb[1]}mm²/4C/${cb[2]}` : '', earthSmall: bI ? `${earFor(bI)}mm² Cu` : '' };
  };
})(typeof window !== 'undefined' ? window : globalThis);
