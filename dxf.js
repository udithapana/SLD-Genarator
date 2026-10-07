/* CAD export: converts the rendered drawing (block diagram or SLD, an <svg> element) into an AutoCAD DXF (R12 / AC1009 ASCII — opens in every
   AutoCAD version, BricsCAD, DraftSight, LibreCAD, QCAD, ...). Everything is generated in the browser; nothing is uploaded.
   - Units: millimetres, drawing placed on a real A4 landscape sheet (297 x 210), origin at the lower-left corner, Y up, so it plots 1:1.
   - Layers: SLD-AC, SLD-DC, SLD-EARTH, SLD-SPD, SLD-SYMBOLS, TEXT, TITLEBLOCK, TITLEBLOCK-TEXT, FRAME (SLD drawing window) (colours match the on-screen drawing).
   - Entities: LINE, POLYLINE (rectangles / heavy lines carry a width), CIRCLE, TEXT (Arial), SOLID (arrow heads / filled dots).
   - The raster company logo cannot be carried in an R12 DXF, so the logo cell holds the text "REGEN" instead. */
(function (G) {
  const S = G.SLD = G.SLD || {};
  const ACI = { '#000': 7, '#000000': 7, '#d9822b': 30, '#1f6fd0': 5, '#0a7a2f': 3, '#a020a0': 6 };
  const LNAME = { '#d9822b': 'SLD-AC', '#1f6fd0': 'SLD-DC', '#0a7a2f': 'SLD-EARTH', '#a020a0': 'SLD-SPD' };
  const CAP = 0.716;                       // Arial cap-height / font-size (CAD text height = cap height)
  const W1252 = { 0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02C6: 0x88, 0x2030: 0x89,
    0x0160: 0x8A, 0x2039: 0x8B, 0x0152: 0x8C, 0x017D: 0x8E, 0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96,
    0x2014: 0x97, 0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B, 0x0153: 0x9C, 0x017E: 0x9E, 0x0178: 0x9F };
  const n4 = v => (Math.round(v * 10000) / 10000).toString();
  const norm = c => { c = (c || '').trim().toLowerCase(); if (/^#[0-9a-f]{3}$/.test(c)) c = '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3]; return c; };
  const col = c => { c = norm(c); return c == '#000000' ? '#000' : c; };
  // text -> DXF string: characters in Windows-1252 are kept (file is declared ANSI_1252), everything else becomes \U+XXXX
  const txt = str => {
    let o = '';
    for (const ch of String(str).replace(/%%/g, '%%%')) {
      const c = ch.codePointAt(0);
      if (c < 32) continue;
      if (c < 128 || (c >= 0xA0 && c <= 0xFF) || W1252[c]) o += ch;
      else o += '\\U+' + (c > 0xFFFF ? c.toString(16) : ('0000' + c.toString(16)).slice(-4)).toUpperCase();
    }
    return o;
  };
  const bytes = str => {
    const u = new Uint8Array(str.length); let k = 0;
    for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); u[k++] = c < 256 ? c : (W1252[c] || 63); }
    return u.subarray(0, k);
  };

  S.toDXF = function (svg, opt) {
    opt = opt || {};
    const vb = (svg.getAttribute('viewBox') || '0 0 1587 1123').split(/[\s,]+/).map(Number), VW = vb[2], VH = vb[3];
    const SC = 297 / VW, SH = VH * SC;                                // px -> mm, sheet height
    const X = x => x * SC, Y = y => (VH - y) * SC;
    const layers = new Map([['0', 7]]), ltypes = new Map(), ent = [];
    let styleUsed = { SLD: 1, SLDB: 0 };
    const useLayer = (n, c) => { if (!layers.has(n)) layers.set(n, c); return n; };
    const ltOf = da => {                                                // dash array (px) -> linetype name
      if (!da || da == 'none') return null;
      let a = da.split(/[\s,]+/).map(Number).filter(v => v >= 0); if (!a.length || a.every(v => !v)) return null;
      if (a.length % 2) a = a.concat(a);
      const nm = 'DASH_' + a.map(v => String(v).replace('.', 'p')).join('_');
      if (!ltypes.has(nm)) ltypes.set(nm, a.map(v => v * SC));
      return nm;
    };
    const g = (code, v) => { ent.push(String(code), String(v)); };
    const head = (type, layer, lt, colr) => { g(0, type); g(8, layer); if (lt) g(6, lt); if (colr != null) g(62, colr); };
    const layerFor = (c, ctx) => ctx.layer ? useLayer(ctx.layer, 7) : useLayer(LNAME[c] || 'SLD-SYMBOLS', ACI[c] || 7);
    const WIDE = 1.6;                                                    // stroke widths above this (px) become widened polylines
    const pline = (pts, closed, wmm, layer, lt) => {
      head('POLYLINE', layer, lt); g(66, 1); g(10, 0); g(20, 0); g(30, 0); g(70, closed ? 1 : 0);
      if (wmm > 0) { g(40, n4(wmm)); g(41, n4(wmm)); }
      pts.forEach(p => { g(0, 'VERTEX'); g(8, layer); g(10, n4(p[0])); g(20, n4(p[1])); g(30, 0); if (p[2]) g(42, p[2]); });
      g(0, 'SEQEND'); g(8, layer);
    };
    const solid = (pts, layer) => {                                     // filled triangle / quad (SOLID vertex order 1,2,4,3)
      const p = pts.length == 3 ? [pts[0], pts[1], pts[2], pts[2]] : pts;
      head('SOLID', layer);
      [[p[0], 10], [p[1], 11], [p[3], 12], [p[2], 13]].forEach(([q, c]) => { g(c, n4(q[0])); g(c + 10, n4(q[1])); g(c + 20, 0); });
    };
    const attrN = (el, a, d) => { const v = parseFloat(el.getAttribute(a)); return isFinite(v) ? v : (d || 0); };
    const walk = (el, ctx) => {
      for (const e of el.children) {
        const tag = e.tagName.toLowerCase();
        if (tag == 'g') { walk(e, e.getAttribute('data-layer') ? { layer: e.getAttribute('data-layer') } : ctx); continue; }
        const stroke = col(e.getAttribute('stroke')), fill = col(e.getAttribute('fill')), hasS = stroke && stroke != 'none', hasF = fill && fill != 'none' && fill != '#ffffff';
        const sw = attrN(e, 'stroke-width', 1), lt = ltOf(e.getAttribute('stroke-dasharray')), wmm = sw > WIDE ? sw * SC : 0;
        if (tag == 'line' && hasS) {
          const x1 = X(attrN(e, 'x1')), y1 = Y(attrN(e, 'y1')), x2 = X(attrN(e, 'x2')), y2 = Y(attrN(e, 'y2')), L = layerFor(stroke, ctx);
          if (wmm) pline([[x1, y1], [x2, y2]], false, wmm, L, lt);
          else { head('LINE', L, lt); g(10, n4(x1)); g(20, n4(y1)); g(30, 0); g(11, n4(x2)); g(21, n4(y2)); g(31, 0); }
        } else if (tag == 'rect') {
          const x = attrN(e, 'x'), y = attrN(e, 'y'), w = attrN(e, 'width'), h = attrN(e, 'height');
          if (!hasS && !hasF) continue;                                  // page background
          const P = [[X(x), Y(y + h)], [X(x + w), Y(y + h)], [X(x + w), Y(y)], [X(x), Y(y)]];
          if (hasF && !hasS) solid([P[0], P[1], P[2], P[3]], layerFor(fill, ctx));
          else pline(P, true, wmm, layerFor(stroke, ctx), lt);
        } else if (tag == 'circle') {
          const cx = X(attrN(e, 'cx')), cy = Y(attrN(e, 'cy')), r = attrN(e, 'r') * SC;
          if (hasF && !hasS) {                                           // filled dot: two-bulge polyline whose width equals its radius
            pline([[cx - r / 2, cy, 1], [cx + r / 2, cy, 1]], true, r, layerFor(fill, ctx));
          } else if (hasS) { head('CIRCLE', layerFor(stroke, ctx), lt); g(10, n4(cx)); g(20, n4(cy)); g(30, 0); g(40, n4(r)); }
        } else if (tag == 'polygon') {
          const pts = (e.getAttribute('points') || '').trim().split(/\s+/).map(p => p.split(',').map(Number)).filter(p => p.length == 2 && isFinite(p[0] + p[1])).map(p => [X(p[0]), Y(p[1])]);
          if (pts.length < 3) continue;
          if (hasF && pts.length <= 4) solid(pts, layerFor(fill, ctx)); else pline(pts, true, wmm, layerFor(hasS ? stroke : fill, ctx), lt);
        } else if (tag == 'text') {
          const s = e.textContent; if (!s || !s.trim()) continue;
          const sz = attrN(e, 'font-size', 12), a = e.getAttribute('text-anchor') || 'start', bold = /bold|[6-9]00/.test(e.getAttribute('font-weight') || '');
          const x = n4(X(attrN(e, 'x'))), y = n4(Y(attrN(e, 'y'))), c = col(e.getAttribute('fill')), L = ctx.layer ? ctx.layer + '-TEXT' : useLayer('TEXT', 7);
          if (ctx.layer) useLayer(L, 7);
          head('TEXT', L, null, c && c != '#000' && ACI[c] ? ACI[c] : null);
          g(10, x); g(20, y); g(30, 0); g(40, n4(sz * CAP * SC)); g(1, txt(s)); g(7, bold ? 'SLDB' : 'SLD'); if (bold) styleUsed.SLDB = 1;
          if (a != 'start') { g(72, a == 'middle' ? 1 : 2); g(11, x); g(21, y); g(31, 0); g(73, 0); }
        } else if (tag == 'image' && ctx.layer) {                        // company logo (raster) -> text placeholder in its cell
          const x = attrN(e, 'x'), y = attrN(e, 'y'), w = attrN(e, 'width'), h = attrN(e, 'height');
          const L = useLayer(ctx.layer + '-TEXT', 7), px = X(x + w / 2), py = Y(y + h / 2);
          head('TEXT', L); g(10, n4(px)); g(20, n4(py - 3)); g(30, 0); g(40, n4(7)); g(1, 'REGEN'); g(7, 'SLDB'); styleUsed.SLDB = 1;
          g(72, 1); g(11, n4(px)); g(21, n4(py - 3)); g(31, 0); g(73, 0);
        }
      }
    };
    walk(svg, {});
    if (!layers.has('TITLEBLOCK')) { /* no title block present */ }
    // -------- assemble file --------
    const o = [];
    const P = (c, v) => o.push(String(c), String(v));
    P(0, 'SECTION'); P(2, 'HEADER');
    P(9, '$ACADVER'); P(1, 'AC1009');
    P(9, '$DWGCODEPAGE'); P(3, 'ANSI_1252');
    P(9, '$INSBASE'); P(10, 0); P(20, 0); P(30, 0);
    P(9, '$EXTMIN'); P(10, 0); P(20, 0); P(30, 0);
    P(9, '$EXTMAX'); P(10, n4(297)); P(20, n4(SH)); P(30, 0);
    P(9, '$LIMMIN'); P(10, 0); P(20, 0);
    P(9, '$LIMMAX'); P(10, n4(297)); P(20, n4(SH));
    P(9, '$LTSCALE'); P(40, 1);
    P(9, '$LUNITS'); P(70, 2); P(9, '$LUPREC'); P(70, 2);
    P(0, 'ENDSEC');
    P(0, 'SECTION'); P(2, 'TABLES');
    P(0, 'TABLE'); P(2, 'LTYPE'); P(70, ltypes.size + 1);
    P(0, 'LTYPE'); P(2, 'CONTINUOUS'); P(70, 0); P(3, 'Solid line'); P(72, 65); P(73, 0); P(40, 0);
    ltypes.forEach((a, nm) => { P(0, 'LTYPE'); P(2, nm); P(70, 0); P(3, 'Dashed'); P(72, 65); P(73, a.length); P(40, n4(a.reduce((x, y) => x + y, 0)));
      a.forEach((v, i) => P(49, n4(i % 2 ? -v : v))); });
    P(0, 'ENDTAB');
    P(0, 'TABLE'); P(2, 'LAYER'); P(70, layers.size);
    layers.forEach((c, nm) => { P(0, 'LAYER'); P(2, nm); P(70, 0); P(62, c); P(6, 'CONTINUOUS'); });
    P(0, 'ENDTAB');
    P(0, 'TABLE'); P(2, 'STYLE'); P(70, 2);
    [['SLD', 'arial.ttf'], ['SLDB', 'arialbd.ttf']].forEach(([nm, f]) => { P(0, 'STYLE'); P(2, nm); P(70, 0); P(40, 0); P(41, 1); P(50, 0); P(71, 0); P(42, 2.5); P(3, f); P(4, ''); });
    P(0, 'ENDTAB');
    P(0, 'ENDSEC');
    P(0, 'SECTION'); P(2, 'BLOCKS'); P(0, 'ENDSEC');
    P(0, 'SECTION'); P(2, 'ENTITIES');
    const body = o.join('\r\n') + '\r\n' + ent.join('\r\n') + '\r\n' + ['0', 'ENDSEC', '0', 'EOF'].join('\r\n') + '\r\n';
    return bytes(body);
  };
})(typeof window !== 'undefined' ? window : globalThis);
