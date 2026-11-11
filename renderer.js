/* Draws both diagrams as SVG strings, laid out directly on one fixed A4-landscape sheet.
   The outer border/title block/earth section always sit at the same page position; only the
   repeating inverter/BESS symbols compress (many units) or centre (few units) to fill the space.
   Pure functions: renderBlock(values, inverters, bessUnits) / renderSLD(values, inverters, bessUnits). */
(function (G) {
const S = G.SLD = G.SLD || {};
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let V = {}, INV = [], BESS = [], INV2 = [], BESS2 = [];
const LOGO = G.SLD_LOGO || '';
const g = id => String(V[id] == null ? '' : V[id]).trim();
// Net zero / Net plus one are drawn like Hybrid (net metering / net accounting + ATS, hybrid inverters + batteries); Net plus enterprise like Net plus (hybrid inverters + batteries, night export)
const BASEM = { nz: 'hy', n1: 'hy', ne: 'np' };
const CFGN = () => ({ nm: 'Net metering', na: 'Net accounting', np: 'Net plus', og: 'Off-grid', hy: 'Hybrid', nz: 'Net zero', n1: 'Net plus one', ne: 'Net plus enterprise' }[V.mode] || 'Net metering'), md = () => BASEM[V.mode] || V.mode || 'nm';
// MV project (MV scope on) in a grid-tie configuration: the site load is fed from the utility's MV gantry (not from the LV isolation panel), the LV side feeds the step-up transformer;
// the isolation panel is optional and a protection relay (NVD / 27 / 59 / 81) sits in the isolation panel (when included) or else in the main switchgear panel
const MVG = () => !!(V.mv && V.mv.on) && md() != 'og' && md() != 'hy', MVISO = () => !MVG() || !!V.mv.iso, MVRF = () => V.mv && V.mv.nvdOn === false ? '27/59/81' : 'NVD/27/59/81';
const UW = u => +u.wp || +g('modWp') || 0; // panel Wp of one inverter (per-inverter module override, else the global panel)
const KWP = () => ALLI().reduce((a, i) => a + i.mods * UW(i), 0) / 1000; // total DC kWp (handles mixed modules)
const MODS = () => { const m = new Map(); ALLI().forEach(i => m.set(UW(i), (m.get(UW(i)) || 0) + i.mods)); return [...m].filter(([, n]) => n > 0).map(([w, n]) => `${w} W × ${n} Nos`); };
const HS = () => g('strHide') == '1'; // hide module string details (modules per string, string count) on every drawing
const CFGD = () => CFGN() + ({ nz: ' (export prohibited)', n1: ' (TOU)', ne: ' (TOU, night export)' }[V.mode] || ''); // title-block wording
const dfmt = iso => /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split('-').reverse().join('/') : iso;
const wslash = (s, n) => { const p = String(s).split('/'), out = []; let cur = ''; p.forEach(w => { const cand = cur ? cur + '/' + w : w; if (cur && cand.length > n) { out.push(cur + '/'); cur = w; } else cur = cand; }); if (cur) out.push(cur); return out; }; // wrap a cable spec at '/' boundaries
const BT = (a, I) => S.brkType(a, I); // MCB (32/40/63 A), MCCB (100-1600 A), ACB (2000-4000 A); 'ADJ.' = adjustable trip unit when the load current I is below 20 % of the rating
const ALLI = () => INV.concat(V.loc2on ? INV2 : []), ALLB = () => BESS.concat(V.loc2on ? BESS2 : []); // both locations (title block / totals)
const units = () => INV.map(u => ({ ...u, kind: 'inv' })).concat(BESS.map(u => ({ ...u, kind: 'bess' })));
const A4W = 1587, A4H = 1123; // fixed A4-landscape page (~135 dpi) — the sheet size never changes
const page = inner => `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${A4W}" height="${A4H}" viewBox="0 0 ${A4W} ${A4H}" font-family="Arial, Helvetica, sans-serif"><rect width="${A4W}" height="${A4H}" fill="#fff"/>${inner}</svg>`;
// Drawing window: inner frame whose left/right edges line up with the title block (same margin BM=10, i.e. 6 px from the border line at x=4) and with the same 6 px gap above the title block (two separate windows)
// Company notice (management requirement on all Regen drawings): two lines at the bottom INSIDE the main drawing window; the diagram itself stops at FB, above them
const NB=24,FB=A4H-10-105-6-NB-6; // FB: lowest y the diagram may use (the window's bottom edge is 30 px lower, holding the notice)
const NOTICE1=()=>`© ${new Date().getFullYear()} Regen Renewables (Pvt) Ltd. All rights reserved. This document is confidential and is the property of Regen Renewables (Pvt) Ltd. It must not be copied, reproduced or disclosed to any third party without written consent.`,
 NOTICE2='Not for construction or implementation without written approval from Regen Renewables (Pvt) Ltd.';
const FRAME=W=>`<g data-layer="FRAME"><rect x="10" y="10" width="${W-20}" height="${A4H-10-105-6-10}" fill="none" stroke="#000" stroke-width="1.5"/></g><g data-layer="NOTICE"><text x="20" y="${FB+11}" font-size="8.5" text-anchor="start" fill="#000">${esc(NOTICE1())}</text>${g('ncNote')=='asbuilt'?'':`<text x="20" y="${FB+22}" font-size="8.5" text-anchor="start" font-weight="bold" fill="#000">${esc(NOTICE2)}</text>`}</g>`;
// Project title: "PROPOSED <kWp> kW SOLAR POWER SYSTEM FOR <SITE NAME>" — only the site name is typed; drawings saved earlier with a full title template keep it
const TITLE=kwp=>g('site')?`PROPOSED ${kwp} kW SOLAR POWER SYSTEM FOR ${String(g('site')).trim().toUpperCase()}`:String(g('proj')||'').replace(/\{kw\}/gi,kwp);
// Title block (ISO 7200-style ruled grid): logo | title + (Drawing No | Revision | Date) strip | 2×2 equipment cells (inverters, solar modules, BESS PCS, batteries) | ruled approvals table.
// Drawn in absolute page coordinates (no diagram stretch) and sits the same distance from the left, right and bottom page border (BM).
function TB(s,W,wp,qty,kwp,title,dtitle,cfgTxt){
const H=105,BM=10,y0=A4H-BM-H,yb=y0+H,x0=BM,x1=W-BM,d1=150,d2=790,d3=W-330,ed=(d2+d3)/2,eh=H/2;
const T=(x,y,str,sz,a='start',w='normal')=>s.push(`<text xml:space="preserve" x="${x}" y="${y.toFixed(1)}" font-size="${sz}" text-anchor="${a}" font-weight="${w}" fill="#000">${esc(str)}</text>`);
const L=(a,b,c,d,sw=1)=>s.push(`<line x1="${a}" y1="${b.toFixed(1)}" x2="${c}" y2="${d.toFixed(1)}" stroke="#000" stroke-width="${sw}"/>`);
const clip=(str,n)=>str.length>n?str.slice(0,n-1)+'…':str;
s.push('<g data-layer="TITLEBLOCK">');
s.push(`<rect x="${x0}" y="${y0}" width="${x1-x0}" height="${H}" fill="none" stroke="#000" stroke-width="1.5"/>`);
[d1,d2,d3].forEach(x=>L(x,y0,x,yb,1.5));
if(LOGO)s.push(`<image href="${LOGO}" xlink:href="${LOGO}" x="${x0+8}" y="${y0+6}" width="${d1-x0-16}" height="${H-12}" preserveAspectRatio="xMidYMid meet"/>`);
// title cell
{const av=d2-d1-25,wd=(q,z)=>q.length*0.6*z; // project title: shrink, then wrap onto two lines, so it never runs into the equipment cells
 if(wd(title,14)<=av)T(d1+15,y0+21,title,14,'start','bold');else if(wd(title,12)<=av)T(d1+15,y0+21,title,12,'start','bold');
 else{const mc=Math.floor(av/(0.6*11)),ws=title.split(' '),ls=[''];ws.forEach(w=>{const c=ls[ls.length-1]?ls[ls.length-1]+' '+w:w;if(c.length>mc&&ls[ls.length-1])ls.push(w);else ls[ls.length-1]=c});
  const two=ls.length>2?[ls[0],clip(ls.slice(1).join(' '),mc)]:ls;two.forEach((q,j)=>T(d1+15,y0+14+j*13,clip(q,mc),11,'start','bold'))}}T(d1+15,y0+45,dtitle||'SINGLE LINE DIAGRAM',19,'start','bold');
T(d1+15,y0+67,clip(`${cfgTxt||'Configuration: '+CFGD()}      Location: ${g('loc')}`,92),11,'start');
L(d1,y0+81,d2,y0+81);L(420,y0+81,420,yb);L(660,y0+81,660,yb);
T(d1+15,y0+97,clip('Drawing No: '+g('dno'),34),11,'start');T(435,y0+97,clip('Revision: '+g('rev'),30),11,'start');T(675,y0+97,'Date: '+dfmt(g('date')),11,'start');
// equipment cells — inverters, solar modules, BESS PCS and batteries are listed separately
const grp=(arr,key)=>{const m=new Map();arr.forEach(a=>{const k=key(a);m.set(k,(m.get(k)||0)+1)});return[...m].map(([k,n])=>n+' × '+k)};
const wr=(arr,n)=>{const out=[];let cur='';arr.forEach(e=>{const c=cur?cur+'  +  '+e:e;if(cur&&c.length>n){out.push(cur);cur=e}else cur=c});if(cur)out.push(cur);return out};
const I=ALLI(),B=ALLB(),hy=I.filter(i=>i.hybrid&&+i.battKwh>0);
const kwI=I.reduce((a,i)=>a+i.kw,0),kwB=B.reduce((a,b)=>a+ +b.kw,0),kwhT=B.reduce((a,b)=>a+ +b.kwh,0)+hy.reduce((a,i)=>a+ +i.battKwh,0),f=n=>+(+n).toFixed(1);
const cells=[
 ['Solar modules',(m=>m.length>2?wr(m,34):m.length?m:[`${wp} W × ${qty} Nos`])(MODS()).concat([`${kwp} kWp DC`])],
 [`Inverters (${I.length} Nos · ${f(kwI)} kW AC)`,I.length?wr(grp(I,i=>`${i.name} ${f(i.kw)} kW`),42):['—']],
 [`BESS PCS (${B.length} Nos${B.length?` · ${f(kwB)} kW`:''})`,B.length?wr(grp(B,b=>`${f(b.kw)} kW bi-directional`),42):['None']],
 [`Batteries (${f(kwhT)} kWh)`,kwhT?wr(grp(B,b=>`${f(b.kwh)} kWh BESS`).concat(grp(hy,i=>`${f(i.battKwh)} kWh (hybrid)`)),42):['None']]];
cells.forEach(([h,ls],k)=>{const cx=d2+(k%2)*(ed-d2)+8,cy=y0+Math.floor(k/2)*eh;T(cx,cy+12,h,10,'start','bold');
 const sh=ls.length>3?[...ls.slice(0,2),clip(ls[2],38)+' …']:ls;sh.forEach((q,j)=>T(cx,cy+25+j*11,q,10,'start'))});
L(ed,y0,ed,yb);L(d2,y0+eh,d3,y0+eh);
// ruled approvals table
const ap=[['Designed by','designed'],['Drawn by','drawn'],['Checked by','checked'],['Director / CTO','director'],['Project executive','exec']],rh=H/5,dv=d3+105;
ap.forEach(([a,k],i)=>{if(i)L(d3,y0+i*rh,x1,y0+i*rh);T(d3+8,y0+i*rh+14,a,10,'start','bold');T(dv+8,y0+i*rh+14,clip(g(k),24),11,'start')});L(dv,y0,dv,yb);s.push('</g>')}

function renderBlock(){
const L2=!!V.loc2on,isIso=L2&&V.loc2to=='iso',toMain=L2&&!isIso;
const U1=units(),U2=L2?INV2.map(u=>({...u,kind:'inv'})).concat(BESS2.map(u=>({...u,kind:'bess'}))):[],U=U1.concat(U2),n1=Math.max(1,U1.length),n2=U2.length,R=n1;
const wp=+g('modWp')||0,qty=ALLI().reduce((a,i)=>a+i.mods,0),kwp=KWP().toFixed(2),kw=ALLI().reduce((a,i)=>a+i.kw,0);
const strs=ALLI().reduce((a,i)=>a+i.strs,0),title=TITLE(kwp);
const W=A4W,GR='#0a7a2f',s=[],MG='#a020a0';
const mvg=MVG(),mvIso=MVISO(),mvRI=mvg&&mvIso,mvRM=mvg&&!mvIso; // MV project (see MVG)
const ipT=k=>g(k)=='IP66'?'IP66 (OUTDOOR)':'IP54 (INDOOR)',efrM=!!g('efrMain'),efrI=!!g('efrIso')&&md()!='og'&&md()!='hy'&&mvIso,indM=!!g('indMain'),indI=!!g('indIso')&&mvIso,dcIso=!!g('dcIso'),dcSpd=!!g('dcSpd'),indL=!!g('indL2');
const efrSet=k=>(g(k)||'50N/51N').slice(0,16);
// small block symbols: EFR box (relay) and indicator-lamp box (three signal lamps R-Y-B); 66 x 24
const efrBox=(x,y,set,ttl='EFR')=>{bx(x,y,66,24);t(x+33,y+10,ttl,ttl=='EFR'?9:7.5,'middle','bold');t(x+33,y+20,set,7,'middle')};
const lampBox=(x,y)=>{bx(x,y,66,24);[['R',x+14],['Y',x+33],['B',x+52]].forEach(([c,cx])=>{s.push(`<circle cx="${cx}" cy="${y+9}" r="4.5" fill="none" stroke="#000" stroke-width="1.2"/><line x1="${cx-3.2}" y1="${y+5.8}" x2="${cx+3.2}" y2="${y+12.2}" stroke="#000" stroke-width="1.2"/><line x1="${cx-3.2}" y1="${y+12.2}" x2="${cx+3.2}" y2="${y+5.8}" stroke="#000" stroke-width="1.2"/>`);t(cx,y+21,c,7,'middle','bold')})};
const t=(x,y,str,sz=12,a='middle',w='normal')=>s.push(`<text xml:space="preserve" x="${x}" y="${y}" font-size="${sz}" text-anchor="${a}" font-weight="${w}" fill="#000">${esc(str)}</text>`);
const t2=(x,y,str)=>{const k=str.search(/ [(×]/);(k>0?[str.slice(0,k),str.slice(k+1)]:[str]).forEach((p,n,a)=>t(x,y-(a.length-1-n)*10,p,10))};
const ln=(a,b,c,d,col='#000',w=1.5,da='')=>s.push(`<line x1="${a}" y1="${b}" x2="${c}" y2="${d}" stroke="${col}" stroke-width="${w}"${da?` stroke-dasharray="${da}"`:''}/>`);
const bx=(x,y,w,h,da='',sw=1.5)=>s.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#000" stroke-width="${sw}"${da?` stroke-dasharray="${da}"`:''}/>`);
// --- fixed page geometry: these never move, regardless of how many units there are ---
const top=114,yE=FB-97,lu2=U2[U2.length-1],rowsBudget=(yE-(L2&&!(lu2&&lu2.kind=='inv'&&lu2.hybrid&&+lu2.battKwh>0)?120:170))-top; // with a second location only Location 2's earth bus bar sits below the rows
// x layout of the switchgear panel (dashed outline PL..PR): row breakers -> busbar -> main breaker, each with a clear gap to the outline and to each other
const HYB=md()=='hy',GPR=HYB?U1.map((u,i)=>u.kind=='inv'&&u.hybrid&&u.gp?i:-1).filter(i=>i>=0):[],GPB=GPR.length>0,
 EFTB=!efrM&&!mvRM?'':GPB?(GPR.length>1?'feeder':'gp'):U1.length==1&&!toMain?'unit':'main'; // EFR trips: hybrid -> backup (grid-side) breaker; one unit -> its own breaker; else the main breaker
 // hybrid mode: rows whose inverter also has a GRID-port cable (Location 1)
const PL=GPB?570:600,MB=GPB?600:630,bx0=750,BK=780,PR=870,ISL=1000,XGV=690; // XGV: the grid-supply vertical / busbar, between the row breakers and the common busbar
// rows carrying a hybrid inverter's integrated battery are taller (room for a proper battery box); every row below simply moves down
const isHyb=u=>!!u&&u.kind=='inv'&&u.hybrid&&+u.battKwh>0,H0=150,HH=270,hOf=u=>isHyb(u)?HH:H0,cbOf=u=>isHyb(u)?252:(GPB&&u&&u.gp&&u.hybrid?150:135); // row pitch / lowest content of a row (unscaled)
const rowsM=[];for(let k=0;k<n1;k++)rowsM.push(U1[k]);const rowsL=L2?(U2.length?U2:[undefined]):[];
// --- repeating-row geometry: compress (sv<1) once natural spacing would overflow the budget, else centre.
// With a second location its rows follow the main rows (same box sizes) after a gap that holds the main panel's tap breaker, the title of Location 2's panel and the Location 1 earth bus bar ---
let sv=1,posM=[],posL=[],lastNat=0;
const layout=()=>{let p=0;posM=[];rowsM.forEach(u=>{posM.push(p);p+=hOf(u)});posL=[];
 if(L2){const lm=rowsM[n1-1],need=Math.max(225,cbOf(lm)*sv+95),dist=Math.max(hOf(lm),need/sv);p=posM[n1-1]+dist;rowsL.forEach(u=>{posL.push(p);p+=hOf(u)})}
 const lu=L2?rowsL[rowsL.length-1]:rowsM[n1-1],lp=L2?posL[posL.length-1]:posM[n1-1];lastNat=lp+Math.max(45,cbOf(lu)-125)};
for(let k=0;k<6;k++){layout();sv=lastNat<=rowsBudget?1:rowsBudget/lastNat}
layout();
const rowTop=lastNat<=rowsBudget?top+(rowsBudget-lastNat)/2:top;
const yy=(p,v)=>rowTop+(p+v)*sv,fz=v=>Math.max(6,+(v*sv).toFixed(2));
// one row = PV array / battery -> inverter / PCS -> AC cable -> breaker; used for BOTH locations (i = row position, k = index inside its location)
const sm=sv<0.65,sm2=sv<0.45,sm3=sv<0.34,sm4=sv<0.25; // sm4: extremely dense (≈18+ rows): one line per box // many rows: spread each box's lines evenly (the 6px minimum font would otherwise overlap)
const dot=(x,y)=>s.push(`<circle cx="${x}" cy="${y}" r="2.6" fill="${GR}"/>`);
const dhUp=v=>(v<0.25?10:Math.max(14,24*v))/2+4;
let fH=fz(9),GPC=false;if(GPB){const gmin=Math.min(1e9,...posM.slice(0,n1).map((p,k)=>k+1<n1?(posM[k+1]-p-77)*sv:1e9));fH=Math.min(fH,(gmin-19*sv-6)/3);if(fH<7&&GPR.every(k=>U1[k].gp.ac==U1[GPR[0]].gp.ac)){GPC=true;fH=Math.min(fz(9),(gmin-6)/2.3)}fH=Math.max(6,fH)} // GPC: grid-port cables all the same and rows tight -> one shared label (above the first row) instead of one per row // hybrid rows: label size so two-line cable labels (inverter AC above its line, grid-port below) never meet
const GYs=GPR.map(k=>yy(posM[k],122)),Yg=GPB?Math.max(yy(posM[0],45)-75-(efrM&&indM?14:0)-(efrM&&GPR.length>1?34:0),50)+6:0,GBot=GPB?Math.max(...GYs):0;
const mainLn=yc=>{if(GPB&&yc>Yg&&yc<GBot){ln(MB+60,yc,XGV-6,yc);s.push(`<path d="M ${XGV-6} ${yc} A 6 6 0 0 1 ${XGV+6} ${yc}" fill="none" stroke="#000" stroke-width="1.5"/>`);ln(XGV+6,yc,bx0,yc)}else ln(MB+60,yc,bx0,yc)}; // hop over the grid vertical: crossing, NOT connected
const row=(u,i,k,nI,nB,cx,pv)=>{const y0=yy(i,0),yc=yy(i,45),B=u.kind=='bess',Y=(j,n,o)=>sm?y0+(j+1)*90*sv/(n+1)+2.5:yy(i,o);
bx(40,y0,170,90*sv);
if(!B&&sm4)t(125,y0+45*sv+2.2,`PV ARRAY · ${u.mods} × ${UW(u)} Wp · ${(u.mods*UW(u)/1000).toFixed(2)} kWp`,6,'middle','bold');
else if(B&&sm4)t(125,y0+45*sv+2.2,`BATTERY (BESS) · ${u.kwh} kWh`,6,'middle','bold');
else if(!B&&sm3){const kp=(u.mods*UW(u)/1000).toFixed(2)+' kWp';t(125,Y(0,2,24),`PV ARRAY · ${u.mods} × ${UW(u)} Wp`,fz(12),'middle','bold');t(125,Y(1,2,44),HS()?kp:`Strings: ${u.cfg} · ${kp}`,fz(10))}
else if(!B){const n=sm2?3:4,kp=(u.mods*UW(u)/1000).toFixed(2)+' kWp';t(125,Y(0,n,24),'PV ARRAY',fz(13),'middle','bold');t(125,Y(1,n,44),`${u.mods} × ${UW(u)} Wp`,fz(12));if(HS())t(125,Y(2,n,61),kp,fz(11));else if(sm2)t(125,Y(2,n,61),`Strings: ${u.cfg} · ${kp}`,fz(10));else{t(125,Y(2,n,61),'Strings: '+u.cfg,fz(10));t(125,Y(3,n,78),kp,fz(11))}}
else if(sm3){t(125,Y(0,2,30),`BATTERY (BESS) · ${u.kwh} kWh`,fz(12),'middle','bold');t(125,Y(1,2,52),u.model,fz(11))}
else{t(125,Y(0,3,30),'BATTERY (BESS)',fz(13),'middle','bold');t(125,Y(1,3,52),u.kwh+' kWh',fz(12));t(125,Y(2,3,70),u.model,fz(11))}
{const dcc=B?'#b35a00':'#c00',it=B?[]:[dcIso?['DC','ISOLATOR','#000']:null,dcSpd?['DC','SPD',MG]:null].filter(Boolean),n=it.length,w=38,gp=4,x0=210+(90-(n*w+(n-1)*gp))/2,dh=sm4?10:Math.max(14,24*sv),one=sv<0.65;
if(!n)ln(210,yc,340,yc,dcc,2);else{ln(210,yc,x0,yc,dcc,2);it.forEach(([a,b,c],j)=>{const x=x0+j*(w+gp);s.push(`<rect x="${x}" y="${(yc-dh/2).toFixed(1)}" width="${w}" height="${dh.toFixed(1)}" fill="none" stroke="${c}" stroke-width="1.5"/>`);
 if(one)t(x+w/2,yc+2.2,a+' '+(b=='ISOLATOR'?'ISO':b),6,'middle','bold');else{t(x+w/2,yc-1,a,7,'middle','bold');t(x+w/2,yc+8,b,7,'middle','bold')}
 ln(x+w,yc,j<n-1?x+w+gp:340,yc,dcc,2)})}}
{const d=String(u.dc||'DC cable'),f=fz(9),k=d.length*0.55*f>80?d.lastIndexOf(' ',Math.ceil(d.length/2)+3):-1,up=(!B&&(dcIso||dcSpd))?Math.max(dhUp(sv),8*sv):8*sv;(k>0?[d.slice(0,k),d.slice(k+1)]:[d]).forEach((x,j,a)=>t(294,yc-up-(a.length-1-j)*(f+1),x,f,'end'))} // right-aligned against the earth trunk (x=300) so it never crosses it
bx(340,y0,140,90*sv);
if(sm4)t(410,y0+45*sv+2.2,B?`BESS PCS${nB>1?' '+(k-nI+1):''} · ${u.kw} kW`:`${nI>1?'INV '+(k+1)+' · ':''}${u.name} · ${u.kw} kW`,6,'middle','bold');
else if(!B&&sm3){t(410,Y(0,2,22),(nI>1?'INVERTER '+(k+1)+' · ':'INVERTER · ')+u.name,fz(10),'middle','bold');t(410,Y(1,2,42),u.kw+' kW · Integrated DC/AC + SPD',fz(9))}
else if(!B){const n=sm2?3:sm?4:5;t(410,Y(0,n,22),(nI>1?'INVERTER '+(k+1):'INVERTER'),fz(12),'middle','bold');t(410,Y(1,n,42),u.name,fz(u.name.length>18?9:11));if(sm2)t(410,Y(2,n,58),u.kw+' kW · Integrated DC/AC + SPD',fz(9));else{t(410,Y(2,n,58),u.kw+' kW',fz(11));if(sm)t(410,Y(3,n,70),'Integrated DC/AC + SPD',fz(9));else{t(410,yy(i,70),'Integrated DC/AC',fz(9));t(410,yy(i,82),'SPD',fz(9))}}}
else if(sm3){t(410,Y(0,2,24),'BESS PCS'+(nB>1?' '+(k-nI+1):'')+' · '+u.kw+' kW',fz(10),'middle','bold');t(410,Y(1,2,45),'Bi-directional',fz(9))}
else{t(410,Y(0,3,24),'BESS PCS'+(nB>1?' '+(k-nI+1):''),fz(12),'middle','bold');t(410,Y(1,3,45),u.kw+' kW',fz(11));t(410,Y(2,3,62),'Bi-directional',fz(10))}
{const ye=yy(i,B?110:105); // BESS: ONE common earth conductor — the battery and the PCS both drop onto it, it runs to the earth trunk (x=300); lowered a little so it keeps clear of both boxes
ln(380,yy(i,90),380,ye,GR,1.5,'5 3');ln(380,ye,300,ye,GR,1.5,'5 3');t(306,ye+Math.max(12*sv,fz(10)*0.85+1),u.earth+(B?' (PCS + battery earth)':''),fz(10),'start');
if(B){ln(125,yy(i,90),125,ye,GR,1.5,'5 3');ln(125,ye,300,ye,GR,1.5,'5 3');dot(300,ye)}}
if(!B){const ys=yy(i,45);ln(40,ys,cx,ys,GR,1.5);dot(cx,ys);pv.push(ys)} // module-side earth: ONE roof earth line per location, separate from the equipment earth trunk
if(isHyb(u)){ln(410,yy(i,90),410,yy(i,150),'#1f6fd0',2);t(418,yy(i,124),u.battDc||'DC cable',fz(9),'start');
bx(350,yy(i,150),120,80*sv);if(sm4)t(410,yy(i,190)+2.2,`BATTERY · ${u.battKwh} kWh`,6,'middle','bold');else{t(410,sm?yy(i,178):yy(i,177),'BATTERY',fz(12),'middle','bold');t(410,sm?yy(i,204):yy(i,203),u.battKwh+' kWh',fz(12),'middle')}
ln(410,yy(i,230),410,yy(i,244),GR,1.5,'5 3');ln(410,yy(i,244),300,yy(i,244),GR,1.5,'5 3');if(!sm2)t(318,yy(i,244)+11*sv,'4mm² Cu (battery earth)',fz(9),'start')}
ln(480,yc,MB,yc);{const av=PL-480-12;let f=GPB?fH:fz(9);const al=u.ac.length*0.55*f>av?wslash(u.ac,Math.ceil(u.ac.length/2)):[u.ac];f=Math.min(f,av/(Math.max(...al.map(q=>q.length))*0.55));al.forEach((x,k)=>t((480+PL)/2,yc-8*sv-(al.length-1-k)*(f+1),x,f))} // hybrid: size fH keeps it clear of the grid-port label of the row above
{const bh=Math.max(40*sv,11);bx(MB,yc-bh/2,60,bh)}if(sm)t(MB+30,yc+2.5,`${/ADJ/.test(BT(u.mccb,u.I))?'':(u.poles||'4P')+' '}${u.mccb}A ${BT(u.mccb,u.I)}`,fz(9));else{t(MB+30,yc-3*sv,`${u.poles||'4P'} ${u.mccb}A`,fz(11));t(MB+30,yc+12*sv,BT(u.mccb,u.I),fz(9))}
if(GPB&&k<n1&&u.gp&&u.hybrid&&!B&&U1[k]===u){const ye1=yy(i,75),yg=yy(i,122),p=u.gp,bh=Math.max(40*sv,11); // GRID-port cable: inverter -> its own breaker (not on the common busbar) -> grid-supply vertical
 ln(480,ye1,540,ye1);ln(540,ye1,540,yg);ln(540,yg,MB,yg);bx(MB,yg-bh/2,60,bh);if(EFTB=='gp'){efrBox(MB-3,yg+bh/2+6,efrSet('efrMainSet'));ln(MB+30,yg+bh/2,MB+30,yg+bh/2+6,'#000',1.5,'3 2')} // single grid port: EFR on that (backup-side) breaker

 if(sm)t(MB+30,yg+2.5,`${p.mccb}A GRID`,fz(9));else{t(MB+30,yg-3*sv,`${u.poles||'4P'} ${p.mccb}A`,fz(11));t(MB+30,yg+12*sv,'GRID PORT',fz(8))}
 if(!GPC){const av=PL-486-6;let f=fH;const al=p.ac.length*0.55*f>av?wslash(p.ac,Math.ceil(p.ac.length/2)):[p.ac];f=Math.min(f,av/(Math.max(...al.map(q=>q.length))*0.55));al.forEach((q,j)=>t(486,yg+Math.max(11*sv,f)+j*(f+1),q,f,'start'))}
 ln(MB+60,yg,XGV,yg)}
mainLn(yc)};
const pv1=[],pv2=[],PVX1=24,PVX2=24; // both locations' roof earth collectors share the same x and label style
U1.forEach((u,k)=>row(u,posM[k],k,INV.length,BESS.length,PVX1,pv1));
if(GPC){const av=PL-486-6,sp=U1[GPR[0]].gp.ac,f=Math.min(9,Math.max(fH,7)),ls=['Grid-port cable (each):'].concat(sp.length*0.55*f>av?wslash(sp,Math.max(8,Math.floor(av/(0.55*f)))):[sp]),u0=U1[GPR[0]],a0=u0.ac.length*0.55*fH>PL-480-12?2:1,yb=yy(posM[0],45)-8*sv-a0*(fH+1)-8;ls.forEach((q,j)=>t(486,yb-(ls.length-1-j)*(f+1),q,j?f:f-0.5,'start',j?'normal':'bold'))}
U2.forEach((u,k)=>row(u,posL[k],k,INV2.length,BESS2.length,PVX2,pv2));
let GFC='';const yc0=yy(posM[0],45),yL=yy(posM[n1-1],45),ym=(yc0+yL)/2;
const pTop=Math.max(yc0-75-(efrM&&indM?14:0)-(efrM&&GPB&&GPR.length>1?34:0),50),pBot=Math.max(yL+(toMain?95:50),GPB?GBot+40:0,g('paMain')?ym+80:0),peY=pTop+15,trunkTop=Math.min(yy(posM[0],105),peY);
bx(PL,pTop,PR-PL,pBot-pTop,'8 4');t(PL,pTop-6,`${L2?'LOCATION 1 — ':''}MAIN SWITCHGEAR PANEL ${g('panel')}A`,12,'start','bold');t(PR-8,pBot-8,ipT('ipMain'),10,'end','bold'); // enclosure rating badge: bottom-right inside the panel outline
ln(PL,peY,300,peY,GR,1.5,'5 3');t(450,peY-6,L2?'Location 1 panel earth':'Switchgear panel earth',9,'middle');
ln(bx0,yc0-30,bx0,yL+30+(toMain?45:0),'#000',6);{const lx=GPB?bx0:bx0-(efrM||indM?16:0),fz0=GPB?9:10;t(lx,yc0-57,'COMMON COUPLING',fz0);t(lx,yc0-45,`BUSBAR ${g('bus')}A`,fz0)}
if(GPB){const top=Math.min(...GYs); // grid-supply side (hybrid): 2+ units -> busbar + feeder breaker; 1 unit -> the cable simply continues
 if(GPR.length>1){const F=GF(GPR.reduce((a,k)=>a+U1[k].gp.I,0));ln(XGV,top,XGV,GBot,'#000',5);t(XGV+5,top+8,'GRID BUS',7,'start','bold');t(XGV+5,top+16,`${F.bus}A`,7,'start','bold');
  const bb=yc0-60;ln(XGV,Yg,XGV,bb);bx(XGV-13,bb,26,36);ln(XGV-7,bb+28,XGV+5,bb+10,'#000',1.2);ln(XGV,bb+36,XGV,top);t(XGV-18,bb+14,`4P ${F.mccb}A`,9,'end');t(XGV-18,bb+26,BT(F.mccb,F.I),8,'end');GFC=F.ac;
  if(EFTB=='feeder'){const ey=Math.max(bb-32,pTop+6);if(ey+24<=bb-2){efrBox(XGV-18-66,ey,efrSet('efrMainSet'));ln(XGV-18,ey+12,XGV-6,ey+12,'#000',1.5,'3 2');ln(XGV-6,ey+12,XGV-6,bb,'#000',1.5,'3 2')}else{const st=efrSet('efrMainSet');bx(PL+5,bb+8,48,24);t(PL+29,bb+18,'EFR',8,'middle','bold');t(PL+29,bb+28,st,6,'middle');ln(PL+53,bb+31,XGV-13,bb+31,'#000',1.5,'3 2')}} /* no room above (rows start high): compact relay box left of the breaker labels, link under them */ /* relay box inside the panel, under its title */} // EFR on the BACKUP main breaker (grid supply feeder)
 else{ln(XGV,Yg,XGV,top);GFC=U1[GPR[0]].gp.ac}}
const hl=(md()=='nm'||md()=='na')&&!mvg,og=md()=='og'||md()=='hy',ix=1160;
// only ONE unit in the main switchgear panel (and no Location 2 tap / main-panel EFR): its own breaker already protects the outgoing cable, so no main breaker — the busbar connects straight to the cable
const SGL=U1.length==1&&!toMain;
ln(bx0,ym,BK,ym);if(SGL)ln(BK,ym,BK+70,ym);else{bx(BK,ym-20,70,40);t(BK+35,ym-3,`4P ${g('panel')}A`,11);t(BK+35,ym+12,(q=>/ADJ/.test(q)?q:'MAIN '+q)(BT(g('panel'),V.panelI)),9)}
const bset=k=>mvRM?(efrM?'50N/51N+':'')+MVRF():efrSet(k),bttl=mvRM?'PROT. RELAY':'EFR';
if(EFTB=='main'){efrBox(BK+16,ym-48,bset('efrMainSet'),bttl);ln(BK+49,ym-24,BK+49,ym-20,'#000',1.5,'3 2')} // earth-fault relay trips the main breaker (short dashed link)
if(EFTB=='unit'){const bh=Math.max(40*sv,11),yt=yc0-bh/2;efrBox(MB-3,yt-30,bset('efrMainSet'),bttl);ln(MB+30,yt-6,MB+30,yt,'#000',1.5,'3 2')} // one unit: trips its own breaker
if(indM)lampBox(BK+16,ym-(EFTB=='main'?76:48));
if(g('paMain')){bx(BK+2,ym+30,66,24);t(BK+35,ym+40,'POWER',7.5,'middle','bold');t(BK+35,ym+50,'ANALYSER',7.5,'middle','bold');ln(BK+35,ym+20,BK+35,ym+30,'#000',1.2,'3 2')} // power analyser (CTs on the main incomer)
ln(BK+70,ym,mvRM?1326:1010,ym);t2((PR+ISL+5)/2,ym-27,g('mainCable'));
const TX=1104,ipEx=isIso?-10:0; // TX: where Location 2's feeder taps the isolation panel
const src=HYB?(g('hySrc')=='both'?'both':'grid'):og?String(g('ogSrc')||''):'';
const wrap=(str,n)=>{const out=[];let cur='';String(str).split(' ').forEach(w=>{if(cur&&(cur+' '+w).length>n){out.push(cur);cur=w}else cur=cur?cur+' '+w:w});if(cur)out.push(cur);return out};
const dotB=(x,y,r=2.6)=>s.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" stroke="#000" stroke-width="1.2"/>`);
// standard ATS symbol (changeover switch in an enclosure): inputs I / II on the left / right edges, common (load) terminal at the bottom (flip: at the top)
const atsB=(x,y,flip)=>{const cy=flip?y+32:y+12,py=flip?y+10:y+34,c1=x+12,c2=x+48,px=x+30;bx(x,y,60,44);
 ln(x,cy,c1-2.6,cy);ln(x+60,cy,c2+2.6,cy);flip?ln(px,y,px,py-2.6):ln(px,py+2.6,px,y+44);
 ln(px,py,px+(c1-px)*0.82,py+(cy-py)*0.82,'#000',1.8);dotB(c1,cy);dotB(c2,cy);dotB(px,py);
 t(c1,flip?y+22:y+27,'I',8,'middle','bold');t(c2,flip?y+22:y+27,'II',8,'middle','bold');t(x+47,flip?y+13:y+40,'ATS',7,'middle','bold')};
const genB=(x,y,r=18)=>{s.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="#000" stroke-width="1.5"/>`);t(x,y+3,'G',12,'middle','bold');t(x,y+13,'~',9,'middle')};
if(og&&src){ // OFF-GRID with backup source(s): automatic transfer switch(es) built into the isolation panel
 const both=src=='both',A=g('atsA')||g('iso')||g('panel'),efrA=!!g('efrIso'),x2=isIso?1160:1060,xb0=x2+66,xgB=HYB?Math.max(xb0+20,1240):0,xb1=xgB+26,x1=HYB?xb1+62:x2+(efrA?140:110),BEa=HYB?(both?x1+66:xb1+74):Math.max((both?x1:x2)+80,efrA?x2+130:0),yT=ym-50-(indI?0:0),yB=ym+75,yG=both?ym+42:ym;
 bx(1000,yT,BEa-1000,yB-yT,'8 4');t(1000,yT-6,`ISOLATION PANEL (ATS) — ${ipT('ipIso')}`,10,'start','bold');
 ln(1010,ym,x2,ym);t(x2-5,ym-5,'SOLAR',8,'end','bold');if(indI)lampBox(1012,ym+40);
 atsB(x2,ym-12,false);t(x2+30,ym-18,`${both?'ATS-2':'ATS'}  4P ${A}A`,10,'middle','bold');
 {const lx=x2+30;ln(lx,ym+32,lx,ym+100);s.push(`<polygon points="${lx-12},${ym+100} ${lx+12},${ym+100} ${lx},${ym+124}" fill="#000"/>`);const ls=(q=>q.length>2?[q[0],q.slice(1).join(' ')]:q)(wrap(g('loadName'),18));ls.forEach((q,j)=>t(lx,ym+146+j*14,q,12,'middle','bold'));t2(lx,ym+150+ls.length*14+(String(g('loadCable')).search(/ [(×]/)>0?10:0),g('loadCable'))}
 if(efrA){const cx2=x2+30,cy=ym+60,rx=x2+48;s.push(`<circle cx="${cx2}" cy="${cy}" r="7" fill="none" stroke="#000" stroke-width="1.5"/>`);ln(cx2+7,cy,rx,cy,'#000',1);efrBox(rx,cy-12,efrSet('efrIsoSet')); // EFR: CBCT on the ATS output (load side), relay trips the ATS (dashed)
  ln(rx+33,cy-12,rx+33,ym+40,'#000',1.5,'3 2');ln(rx+33,ym+40,x2+50,ym+40,'#000',1.5,'3 2');ln(x2+50,ym+40,x2+50,ym+32,'#000',1.5,'3 2')}
 const lab=(L,R,y,gx,gw,yb,str)=>{const w=str.length*0.56*10;if(R-L-16>=w)t2((L+R)/2,y-8,str);else t2(Math.min(gx+gw/2,1565-w/2),yb+(str.search(/ [(×]/)>0?10:0),str)}; // source cable: above its line if it fits, else under the source symbol
 const grid=(xs,y)=>{const m=Math.max(1344,BEa+54),gx=m+52,gw=Math.min(80,1560-gx);ln(xs,y,m-18,y);s.push(`<circle cx="${m}" cy="${y}" r="18" fill="none" stroke="#000" stroke-width="1.5"/>`);t(m,y+4,'kWh',10);wrap(g('meterLbl')||'',14).forEach((q,j)=>t(m,y+34+j*11,q,9));
   ln(m+18,y,gx,y);bx(gx,y-25,gw,50);t(gx+gw/2,y+5,'GRID',13,'middle','bold');lab(BEa,m-18,y,gx,gw,y+(g('meterLbl')?64:48),SUPC())},
  dg=(xs,y)=>{const m=Math.max(1344,BEa+70);ln(xs,y,m-18,y);genB(m,y);t(m,y+34,'DIESEL GENERATOR',9,'middle','bold');if(g('dgKva'))t(m,y+46,`${g('dgKva')} kVA`,9);lab(BEa,m-18,y,m-40,80,y+62,g('dgCable')||g('utilCable'))};
 const brkG=HYB&&+g('supBrk')?+g('supBrk'):HYB?Math.max(+A||0,GPB?S.gridFeeder(GPR.reduce((a,k)=>a+U1[k].gp.I,0)).mccb:0):0;
 if(HYB){ln(x2+60,ym,xb0,ym);ln(xb0,ym,xb1,ym,'#000',5);(xb1-xb0>80?[['GRID-SIDE BUSBAR',ym+14]]:[['GRID-SIDE',ym+13],['BUSBAR',ym+21]]).forEach(([q,y])=>t(xb0+2,y,q,6.5,'start','bold')); // ATS grid-side busbar (horizontal): feeds ATS input II and the hybrid inverters' grid ports (cable from above)
  if(GPB){ln(XGV,Yg,xgB,Yg);ln(xgB,Yg,xgB,ym);s.push(`<circle cx="${xgB}" cy="${ym}" r="3.5" fill="#000"/>`);t(PR+8,Yg-5,GFC+' — to hybrid inverter grid port'+(GPR.length>1?'s':''),9,'start')}
  ln(xb1,ym,xb1+2,ym);bx(xb1+2,ym-18,54,36);t(xb1+29,ym-3,`4P ${brkG}A`,10);t(xb1+29,ym+11,BT(brkG),8)} // incoming breaker in front of the grid-side busbar
 if(!both){if(HYB){grid(xb1+56,ym)}else(src=='grid'?grid:dg)(x2+60,ym)}
 else{ln(HYB?xb1+56:x2+60,ym,x1+30,ym);ln(x1+30,ym,x1+30,ym+10);atsB(x1,ym+10,true);t(x1+30,ym-18,'ATS-1',10,'middle','bold');t(x1+30,ym-6,`4P ${A}A`,9,'middle','bold');
  const dx=x1-12;ln(x1,ym+42,dx,ym+42);ln(dx,ym+42,dx,ym+104);genB(dx,ym+122);t(dx+24,ym+118,'DG',10,'start','bold');if(g('dgKva'))t(dx+24,ym+131,`${g('dgKva')} kVA`,9,'start');t(dx+24,ym+144,g('dgCable')||g('utilCable'),9,'start');
  grid(x1+60,yG)}
 {const ipx=1020,ipy=yB;ln(ipx,ipy,ipx,ipy+18,GR,1.5,'5 3');ln(ipx-14,ipy+18,ipx+14,ipy+18,GR,2);ln(ipx-9,ipy+24,ipx+9,ipy+24,GR,2);ln(ipx-4,ipy+30,ipx+4,ipy+30,GR,2);t(ipx,ipy+46,'Isolation',10,'middle');t(ipx,ipy+58,'panel earth',10,'middle')}
}else if(og){
const ey2=indI?14:0;bx(1010,ym-50,230,100+ey2,'8 4');t(1010,ym-56,`LOAD DISTRIBUTION BOARD (LOAD DB) — ${ipT('ipIso')}`,10,'start','bold');if(indI)lampBox(1092,ym+29);
ln(1010,ym,1240,ym,'#000',4);t(1125,ym-18,`LOAD DB BUS ${g('loadBrk')||g('panel')}A`,10,'middle');if(isIso)t(1112,ym+22,'No utility connection',10,'start');else t(1125,ym+22,'No utility connection',10,'middle');
{const ipx=1050,ipy=ym+50+ey2;ln(ipx,ipy,ipx,ipy+18,GR,1.5,'5 3');
ln(ipx-14,ipy+18,ipx+14,ipy+18,GR,2);ln(ipx-9,ipy+24,ipx+9,ipy+24,GR,2);ln(ipx-4,ipy+30,ipx+4,ipy+30,GR,2);
t(ipx,ipy+48,'DB earth',10,'middle')}
}else{
if(mvIso){bx(1010,ym-20,80,40);t(1050,ym-3,`4P ${g('iso')}A`,11);t(1050,ym+12,'ISOLATOR',9);
if(efrI||mvRI)efrBox(1016,ym-50,mvRI?(efrI?'50N/51N+':'')+MVRF():efrSet('efrIsoSet'),mvRI?'PROT. RELAY':'EFR'),ln(1049,ym-26,1049,ym-20,'#000',1.5,'3 2');
if(hl){bx(ISL,ym-66,200,168,'8 4');t(1000,ym-72,`ISOLATION PANEL — ${ipT('ipIso')}`,10,'start','bold');if(indI)lampBox(1016,ym+28);ln(1090,ym,ix,ym);ln(ix,ym-30,ix,ym+70,'#000',6);
t(ix,ym-48,'LOAD BUSBAR',10);t(ix,ym-38,`${g('isoBus')}A`,10);ln(ix,ym+70,ix,ym+130);t(ix+8,ym+119,g('loadCable'),9,'start');bx(ix-50,ym+130,100,34);t(ix,ym+152,g('loadName'),12,'middle','bold');ln(ix,ym,1326,ym);t2(1264,ym-8,g('utilCable'))}
else{const ex=efrI||mvRI?13:0,ey=indI?20:0;bx(1000,ym-45-ex,isIso?135:100,85+ex+ey,'8 4');t(1000,ym-51-ex,`ISOLATION PANEL — ${ipT('ipIso')}`,10,'start','bold');if(indI)lampBox(1016,ym+28);ln(1090,ym,1326,ym);t2(1215,ym-8,g('utilCable'))}
{const ipx=1050,ipy=hl?ym+102:ym+40+(indI?20:0);ln(ipx,ipy,ipx,ipy+18,GR,1.5,'5 3');
ln(ipx-14,ipy+18,ipx+14,ipy+18,GR,2);ln(ipx-9,ipy+24,ipx+9,ipy+24,GR,2);ln(ipx-4,ipy+30,ipx+4,ipy+30,GR,2);
t(ipx+ipEx,ipy+48,'Isolation panel earth',10,'middle')}}
if(mvg){bx(1326,ym-25,190,50);t(1421,ym-3,'STEP-UP TRANSFORMER',12,'middle','bold');t(1421,ym+14,'(see the MV scope SLD)',9,'middle')} // MV project: utility metering on the MV side
else{s.push(`<circle cx="1344" cy="${ym}" r="18" fill="none" stroke="#000" stroke-width="1.5"/>`);t(1344,ym+4,'kWh',10);t(1344,ym+34,g('meterLbl'),9);
ln(1362,ym,1414,ym);bx(1414,ym-25,80,50);t(1454,ym+5,'GRID',13,'middle','bold')}
}
if(L2){
// ---- Location 2: its own switchgear panel below the main one (same row/box sizes). Its incomer breaker is sized from Location 2's own current and appears at BOTH ends of the interconnecting cable ----
const l2A=g('loc2panel'),l2T=BT(l2A,V.loc2panelI),yc02=yy(posL[0],45),yL2=yy(posL[posL.length-1],45),ym2=(yc02+yL2)/2,pTop2=Math.max(yc02-75,50),pBot2=yL2+50,peY2=pTop2+15,xf=toMain?910:TX;
const cab=g('loc2cable'),brkBox=(cx,cy)=>{bx(cx-35,cy-20,70,40);t(cx,cy-3,`4P ${l2A}A`,11);t(cx,cy+12,l2T,9)};
bx(PL,pTop2,PR-PL,pBot2-pTop2,'8 4');{const nm=(V.loc2name||'LOCATION 2').toUpperCase(),full=`${nm} SWITCHGEAR PANEL ${l2A}A`,room=(toMain?905:PR+120)-PL,w=z=>full.length*0.62*z; // long location names: smaller, then two lines, so the title never reaches the feeder (x=910)
 if(w(12)<=room)t(PL,pTop2-6,full,12,'start','bold');else if(w(10)<=room)t(PL,pTop2-6,full,10,'start','bold');else{t(PL,pTop2-19,nm,11,'start','bold');t(PL,pTop2-6,`SWITCHGEAR PANEL ${l2A}A`,11,'start','bold')}}t(PR-8,pBot2-8,ipT('ipL2'),10,'end','bold');
ln(PL,peY2,300,peY2,GR,1.5,'5 3');t(450,peY2-6,`${V.loc2name||'Location 2'} panel earth`,9,'middle');
ln(bx0,yc02-30,bx0,yL2+30,'#000',6);{const lx=bx0-(indL?16:0);t(lx,yc02-57,'COMMON COUPLING',10);t(lx,yc02-45,`BUSBAR ${g('loc2bus')||l2A}A`,10)}
ln(bx0,ym2,BK,ym2);brkBox(BK+35,ym2);if(indL)lampBox(BK+16,ym2-48);
if(toMain){const yt=yL+55; // tap breaker on the main busbar, then the interconnecting cable down to Location 2
 ln(bx0,yt,BK,yt);brkBox(BK+35,yt);ln(BK+70,yt,xf,yt);ln(BK+70,ym2,xf,ym2);ln(xf,yt,xf,ym2);t(xf-6,pBot+13,cab,9,'end')}
else{const bY=ym+204; // tap on the isolation panel, breaker at that end, cable down and across to Location 2's incomer breaker
 s.push(`<circle cx="${xf}" cy="${ym}" r="3.5" fill="#000"/>`);ln(xf,ym,xf,bY-20);brkBox(xf,bY);ln(xf,bY+20,xf,ym2);ln(BK+70,ym2,xf,ym2);t((BK+70+xf)/2,ym2-6,cab,9)}
}
ln(300,trunkTop,300,yE,GR,1.5,'5 3');t(294,yE-40,g('earthMain'),10,'end');
const two=L2&&n2>0;let eb=0;
if(two){ // Location 1's own earth bus bar sits between the two inverter sets (the main switchgear panel is in Location 1); Location 2's bar is the one at the bottom
 const lastBot=yy(posM[n1-1],cbOf(rowsM[n1-1])),firstL=yy(posL[0],0);eb=lastBot+30;
 ln(pv1.length?PVX1:230,eb,370,eb,GR,5);t(376,eb+3,'LOCATION 1 EARTH BUS BAR',10,'start','bold')}
// roof (module-side) earth: one conductor per location from all its arrays, kept apart from the equipment earth trunk, landing on that location's earth bus bar
const PVL=z=>`${z} — PV array main earth (from roof)`;
if(pv1.length){ln(PVX1,Math.min(...pv1),PVX1,two?eb:yE,GR,2);t(PVX1+6,(two?eb:yE)-6,PVL(g('pvEarth')||'4mm² Cu'),9,'start')}
if(pv2.length){ln(PVX2,Math.min(...pv2),PVX2,yE,GR,2);t(PVX2+6,yE-6,PVL(g('loc2pvearth')||'4mm² Cu'),9,'start')}
ln(two?(pv2.length?PVX2:240):(pv1.length?PVX1:240),yE,600,yE,GR,5);t(420,yE-10,two?'LOCATION 2 EARTH BUS BAR':'EARTH BUS BAR',10);
ln(420,yE,420,yE+30,GR,1.5);ln(400,yE+30,440,yE+30,GR,2);ln(407,yE+36,433,yE+36,GR,2);ln(414,yE+42,426,yE+42,GR,2);
t(455,yE+40,`Earth pit   r ≤ ${g('earthR')}Ω`,11,'start');
s.push(`<rect x="4" y="4" width="${W-8}" height="${A4H-8}" fill="none" stroke="#000" stroke-width="2"/>`);s.push(FRAME(W));
t(20,32,`${qty} panels (${MODS().length>1?MODS().join(' + '):'×'+wp+' Wp'}) ${HS()?'':` — ${strs} strings${(cf=>cf.length>70?'':' ('+cf+')')(ALLI().map(i=>i.cfg).join(' | '))}`} — ${kwp} kWp DC / ${+kw.toFixed(1)} kW AC${ALLB().length?' / '+ALLB().reduce((a,b)=>a+ +b.kwh,0)+' kWh BESS':''}`,12,'start');
t(W-20,32,CFGN()+' — '+g('opt'),14,'end','bold');
TB(s,W,wp,qty,kwp,title);
return page(s.join(''))}

function renderSLD(){
const L2=!!V.loc2on,mk=(I,B)=>I.map(u=>({...u,kind:'inv'})).concat(B.map(u=>({...u,kind:'bess'})));
// columns are laid out in ONE row so both locations share exactly the same symbol size: the main columns first (left), then Location 2's (right)
const U1=mk(INV,BESS),U2=L2?mk(INV2,BESS2):[],U=U1.concat(U2),n1=Math.max(1,U1.length),cnt=Math.max(1,U.length+(L2&&!U2.length?1:0)),n2=U2.length; // Location 2's columns sit to the RIGHT of the main ones (a virtual empty column keeps room for its panel if it has no units)
const wp=+g('modWp')||0,qty=INV.concat(L2?INV2:[]).reduce((a,i)=>a+i.mods,0),kwp=KWP().toFixed(2),title=TITLE(kwp);
const OR='#d9822b',BL='#1f6fd0',GR='#0a7a2f',MG='#a020a0',s=[],W=A4W;
// panel options (Panels & protection): enclosure IP rating, EFR (CBCT + relay), phase indicator lamps, DC-side isolator / SPD
const mvg=MVG(),mvIso=MVISO(),mvRI=mvg&&mvIso,mvRM=mvg&&!mvIso; // MV project: protection relay in the isolation panel (mvRI) or, without one, in the main switchgear panel (mvRM)
const ipT=k=>g(k)=='IP66'?'IP66 (OUTDOOR)':'IP54 (INDOOR)',efrM=!!g('efrMain'),efrI=!!g('efrIso')&&md()!='og'&&md()!='hy'&&mvIso,indM=!!g('indMain'),indI=!!g('indIso')&&mvIso,indL=!!g('indL2'),dcIso=!!g('dcIso'),dcSpd=!!g('dcSpd');
const DCX=dcSpd?(dcIso?100:55):(dcIso?40:0); // extra vertical room on the PV DC cable for the DC isolator / DC SPD (everything below the inverter moves down by this much)
// --- fixed vertical layout (native design was 910px tall); stretch everything vertically to fill the fixed A4 page height ---
const SH=(efrI||mvRI)?18:0; // SH: with an isolation-panel EFR the isolation panel is taller (its busbar, breakers and meter sit SH lower) so the CBCT + relay get room above the busbar
const E1=L2&&V.loc2to=='iso'?36:20,E2=L2?22:0,AR=8; // E1: extra gap between the isolation panel and the main panel (room for the main-cable label + panel title); E2: extra gap above Location 2's panel; AR: load arrow drop
// HYBRID mode: every hybrid inverter at Location 1 has a second AC cable (its GRID port) with its own breaker in the main switchgear panel, kept OFF the common busbar.
// One unit: breaker -> cable straight to the ATS grid-side busbar. Two or more: breakers on a separate GRID SUPPLY BUSBAR + one feeder breaker + one feeder cable to the ATS grid-side busbar.
// That grid section sits inside the main panel ABOVE the common coupling busbar, so the panel contents move down (PD).
const HY=md()=='hy',GPI=HY?U1.map((u,i)=>u.kind=='inv'&&u.hybrid&&u.gp?i:-1).filter(i=>i>=0):[],nGP=GPI.length,
EFT=!efrM&&!mvRM?'':nGP>1?'feeder':nGP==1?'gp':U1.length==1&&!(L2&&V.loc2to!='iso')?'unit':'main', // EFR trips: hybrid -> the BACKUP (grid-side) breaker (grid supply feeder / the single grid-port breaker); one unit -> its own breaker; else the main breaker
EO=(L2&&V.loc2to=='iso'?36:20)-20,GB=(EFT=='feeder'?380:340)+EO,GB1=288+EO; // EO: the main panel sits lower when Location 2 hangs off the isolation panel
let T1=null;const PD=Math.max(E1+(EFT=='main'||EFT=='unit'?46:0)+(g('paMain')?40:0),(nGP>1?(EFT?146:106):nGP==1?(EFT?88:54):0)+EO); // PD: with an earth-fault relay the main panel's contents (breaker, busbar, columns) sit PD lower so the CBCT + relay fit INSIDE the panel outline
const yE=(L2?(cnt>9?898:cnt>6?865:850):(cnt>9?735:690))+DCX+(L2?(DCX||efrM?24:12):(cnt>6&&(DCX||efrM)?14:0))+PD+E2,fy=(FB-28)/(yE+48),DY2=166; // DY2: Location 2's busbar sits at y=466, i.e. its columns hang 166px lower than the main ones
let DY=0; // vertical offset applied by the drawing helpers (0 for the main columns, DY2 while drawing Location 2's)
const t=(x,y,str,sz=11,a='start',w='normal')=>s.push(`<text xml:space="preserve" x="${x}" y="${((y+DY)*fy).toFixed(1)}" font-size="${sz}" text-anchor="${a}" font-weight="${w}" fill="#000">${esc(str)}</text>`);
const ln=(a,b,c,d,col='#000',w=1.5,da='')=>s.push(`<line x1="${a}" y1="${((b+DY)*fy).toFixed(1)}" x2="${c}" y2="${((d+DY)*fy).toFixed(1)}" stroke="${col}" stroke-width="${w}"${da?` stroke-dasharray="${da}"`:''}/>`);
const bx=(x,y,w,h,da='',col='#000',sw=1.5)=>s.push(`<rect x="${x}" y="${((y+DY)*fy).toFixed(1)}" width="${w}" height="${(h*fy).toFixed(1)}" fill="none" stroke="${col}" stroke-width="${sw}"${da?` stroke-dasharray="${da}"`:''}/>`);
// --- column geometry: every column has the same base pitch (230); only a hybrid column (battery drawn to the LEFT of its inverter) gets extra room on its left.
// The symbol scale sh is solved so that margins + all columns + the gap between the locations fill the page width (no wasted space), capped at MAXSH.
const many=cnt>6,SPDX=many?60:0,PAW=0,MAXSH=L2?1.3:1.8,HX=110,BASE=230; // SPDX: with 7+ units the (held-size) text of the last column needs extra room before the SPD
const hyU=u=>!!u&&u.kind=='inv'&&u.hybrid&&+u.battKwh>0,hy0=hyU(U[0]),hy2=hyU(U2[0]),isIso0=L2&&V.loc2to=='iso',two=L2&&U1.length>0;
const hxc=[];U.reduce((a,u,i)=>(hxc[i]=a+((i>0&&!(L2&&i==n1)&&hyU(u))?HX:0)),0);const sumHx=hxc.length?hxc[hxc.length-1]:0,hxAt=i=>hxc.length?hxc[Math.min(i,hxc.length-1)]:0;
const c0=many&&n1>=3?172:196,k0=hy0?208:98; // left margin: main earth line + room for the first column's earth label; k0 = how far left of its inverter the first column reaches (x-95 earth line, x-205 for a hybrid)
const acX1=(u=>u?Math.max(0,String(u.ac||'').length*0.55*9+24-105):0)(U1[U1.length-1]),g1=two&&hy2?110:0;let g0=two?(many&&n1>=3?185:215)+SPDX+acX1+PAW:0; // gap between the locations (Location 2's feeder, panel earth line, its first column's earth label)
const acEst=(u=>u?String(u.ac||'').length*0.55*9:0)(U[(L2?n1:cnt)-1]),R0=L2?30:SPDX+135+PAW+Math.max(0,acEst+24-105),R1=L2?166:105; // right margin: with Location 2 only its last column is at the right (the SPD stays after the main columns); otherwise the SPD + busbar end
const solve=spn=>(A4W-c0-g0-R0)/(k0+spn+g1+R1);
if(isIso0&&two)for(let it=0;it<5;it++){ // Location 2 on the isolation panel: gap sized so the main panel ends GAPF left of Location 2's feeder (same as the feeder-to-panel gap above it)
 const s1=Math.min(MAXSH,solve(BASE*(cnt-1)+sumHx)),shA=n=>Math.min(MAXSH,solve((n-1)*(BASE+sumHx/Math.max(1,cnt-1)))),f=Math.max(shA(6),Math.min(shA(4),s1))*Math.min(1,s1/0.44)*(many&&n1>=3?(cnt<=14?1.12:1.06):1),
  aw=Math.min(String(U1[n1-1].ac||'').length*0.55*9*f,BASE*s1-10*s1),D=Math.max(105*s1+SPDX,8*s1+aw+16);g0=Math.max(60,20+10+95+D+PAW+75+(hy2?208:98)*s1-BASE*s1-g1*s1)}
const x1Lim=1271; // with Location 2 on the isolation panel its feeder x (cx = x1-98sh-75) must stay left of ~1196 so the extended isolation panel still leaves room for the meter + GRID
const shIso=1e9; // (no cap any more: the feeder is routed over the main panel when the isolation panel can't reach it)
const sh=Math.min(MAXSH,solve(BASE*(cnt-1)+sumHx),shIso),GAPPX=g0+g1*sh;
const slack0=A4W-(c0+g0+R0+sh*(k0+BASE*(cnt-1)+sumHx+g1+R1)),x1L=c0+k0*sh+sh*(n1*BASE+hxAt(n1))+g0+g1*sh,room1=1e9;
const colStart=c0+k0*sh+Math.min(slack0/2,room1),colPitch=BASE*sh;
// FONT scale is decoupled from the geometry scale (sh): text is held at the size it has with 4 units for anything smaller (1-3 units),
// follows the geometry between 4 and 6 units, and is held at the 6-unit size for anything bigger so it stays readable in print.
const shAt=n=>Math.min(MAXSH,solve((n-1)*(BASE+sumHx/Math.max(1,cnt-1)))),fs0=Math.max(shAt(6),Math.min(shAt(4),sh)),fs=fs0*Math.min(1,sh/0.44)*(L2&&many&&n1>=3?(cnt<=14?1.12:1.06):1); // very dense sheets (12+ columns): text shrinks a little with the geometry instead of overlapping
const XPE=()=>Xc(n1)-(hy2?208:98)*sh-105; // x of Location 2's own panel-earth conductor (left of its first column, clear of that column's earth label)
const Xc=i=>colStart+sh*(i*BASE+hxAt(i))+(L2&&i>=n1?GAPPX:0),tc=(x,y,str,sz,a,w)=>t(x,y,str,sz*fs,a,w),LP=(sz=10)=>Math.max(11,1.17*sz*fs/fy); // LP: line pitch (unscaled) for stacked, wrapped labels: never tighter than the text height, whatever the vertical stretch fy
// 'tight' = text is now larger than the (compressed) geometry, i.e. more than 6 units: wrap long labels so they stay clear of neighbouring columns
const tight=many,cwid=sz=>0.55*sz*fs,acL=u=>tight?wslash(u.ac,Math.max(8,Math.floor((colPitch-10*sh)/cwid(9)))):[u.ac],AW=U.some(u=>acL(u).length>1)?8:0,maxW=colPitch-147*sh-4,wl=(s,sz)=>tight?wrap(s,Math.max(4,Math.floor(maxW/cwid(sz)))):[s];
const wrap=(str,maxCh)=>{const words=String(str).split(' ').flatMap(w=>w.length>maxCh?(w.match(/[^-]+-?/g)||[w]):[w]);const lines=[];let cur='';
  words.forEach(w=>{const cand=cur?(cur.endsWith('-')?cur+w:cur+' '+w):w;if(!cur||cand.length<=maxCh)cur=cand;else{lines.push(cur);cur=w}});if(cur)lines.push(cur);return lines};
const brk=(x,y,l1,l2,mc,left)=>{ln(x,y,x,y+16,OR);ln(x,y+34,x,y+52,OR);ln(x,y+34,x+10,y+16);ln(x-4,y+12,x+4,y+20);ln(x-4,y+20,x+4,y+12);if(mc)bx(x+1,y+22,7,7,'','#000',1);left?(tc(x-9,y+22,l1,11,'end'),tc(x-9,y+35,l2,9,'end')):(tc(x+18,y+22,l1,11),tc(x+18,y+35,l2,9))};
const inv=(x,y)=>{bx(x-45*sh,y,90*sh,70);ln(x-45*sh,y+70,x+45*sh,y,'#000',1);t(x-28*sh,y+22,'~',15,'middle');t(x+28*sh,y+62,'=',15,'middle')};
const txt=(x,lines)=>{let y=0;lines.forEach(([str,sz,w,dy],k)=>{y=tight?416+k*11:k?y+Math.max(dy-lines[k-1][3],LP(sz)):400+dy;tc(x+52*sh,y,str,sz,'start',w)})}; // line pitch never tighter than the text height, however much the sheet is squeezed vertically
const es=(x,y,c=GR)=>{ln(x,y,x,y+8,c);ln(x-14,y+8,x+14,y+8,c,2);ln(x-9,y+14,x+9,y+14,c,2);ln(x-4,y+20,x+4,y+20,c,2)};
// --- standard symbols: CBCT (circle on the conductor) + EFR relay box (IEC protection relay) with a dashed trip link; signal lamp (circle with cross); DC isolator (disconnector) ---
const CTR=7,rdim=()=>{const b1=8.1/fy+1.5,b2=b1+10.3/fy;return{b1,b2,h:b2+1.8/fy+1.5}}; // relay box: label baselines / height in unscaled units (fixed 9px + 7px text)
const efrSet=k=>(g(k)||'50N/51N').slice(0,16),efrW=set=>Math.max(56,Math.min(110,set.length*0.55*7+12));
const ctc=(x,y)=>s.push(`<circle cx="${x.toFixed(1)}" cy="${((y+DY)*fy).toFixed(1)}" r="${CTR}" fill="none" stroke="#000" stroke-width="1.5"/>`);
const relay=(x,y,w,set,ttl='EFR')=>{const d=rdim();bx(x,y,w,d.h);t(x+w/2,y+d.b1,ttl,9,'middle','bold');t(x+w/2,y+d.b2,set,7,'middle');return d};
const lamp=(x,y)=>{const cy=(y+DY)*fy,r=5.5,q=r*0.7;s.push(`<circle cx="${x.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r}" fill="none" stroke="#000" stroke-width="1.2"/><line x1="${(x-q).toFixed(1)}" y1="${(cy-q).toFixed(1)}" x2="${(x+q).toFixed(1)}" y2="${(cy+q).toFixed(1)}" stroke="#000" stroke-width="1.2"/><line x1="${(x-q).toFixed(1)}" y1="${(cy+q).toFixed(1)}" x2="${(x+q).toFixed(1)}" y2="${(cy-q).toFixed(1)}" stroke="#000" stroke-width="1.2"/>`)};
const lamps=(x0,yb)=>{['R','Y','B'].forEach((c,j)=>{const x=x0+j*16,r=5.5/fy;ln(x,yb,x,yb+21-r,OR);t(x+3,yb+10,c,7,'start','bold');lamp(x,yb+21);ln(x,yb+21+r,x,yb+31,OR)});ln(x0,yb+31,x0+32,yb+31,OR);t(x0-5,yb+34,'N',7,'end','bold')}; // phase indicator lamps R-Y-B: tapped off the busbar, common neutral return
const dcIsoSym=(x,y)=>{ln(x-5,y+14,x+5,y+14,'#000',1.5);ln(x,y+34,x+11,y+17,'#000',1.5)}; // disconnector: fixed-contact bar + open blade (the DC cable is cut around it by the caller)
// one column = breaker, inverter / BESS PCS, DC wiring, PV array or battery, earths. Used for BOTH locations (dy = vertical offset, i = global column, k = index inside its location)
const PVC=632+DCX+(HY?Math.max(0,568+4*Math.max(13,12.5/fy)+10-632):0),PVLS=dy=>`${dy>=DY2?(V.loc2pvearth||'4mm² Cu'):(g('pvEarth')||'4mm² Cu')} (PV array main earth, from roof)`; // PVC: y of the roof (module-side) earth collector, just below the PV array text
const isHy=u=>!!u&&u.kind=='inv'&&u.hybrid&&+u.battKwh>0;
// ph: previous column (same location) is a hybrid with a battery -> its battery earth line sits inside this column's left label area
const drawCol=(u,i,x,dy,k,nI,nB,pvx,ph,lb)=>{DY=dy;const hb=isHy(u),xe=x-(hb?205:95)*sh,xl=xe-3*sh; // xe: this column's equipment-earth line (further left for a hybrid, whose battery sits between it and the inverter)
const ye=yE-dy,B=u.kind=='bess',off=0; // stagger the bottom earth labels only when columns are very tight
ln(x,300,x,320-AW,OR);brk(x,320-AW,`${u.poles||'4P'} ${u.mccb}A`,BT(u.mccb,u.I),1);ln(x,372-AW,x,400,OR);
{const al=acL(u);al.length>1?al.forEach((s,j)=>tc(x+8*sh,397-(al.length-1-j)*9.5,s,8.5)):tc(x+8*sh,392,u.ac,9)}
if(!B){inv(x,400);
const ttl=nI>1?'INVERTER '+(k+1):'INVERTER';
if(tight){let L=[...wl(ttl,12.5).map(s=>[s,11,'bold']),...wl(u.name,10).slice(0,3).map(s=>[s,10,'normal']),[u.kw+' kW',10,'normal']];
 const ex=wl('Integrated DC/AC SPD',9).map(s=>[s,9,'normal']);if(L.length+ex.length<=7&&!(u.hybrid&&+u.battKwh>0))L=L.concat(ex);
 L.forEach(([s,z,w],j)=>tc(x+52*sh,416+j*11,s,z,'start',w))}
else{const rm=i==U.length-1?A4W-18-(x+52*sh):maxW,nm=u.name.length*cwid(10)>rm?wrap(u.name,Math.max(8,Math.floor(rm/cwid(10)))).slice(0,2):[u.name],ex=(nm.length-1)*12;txt(x,[[ttl,11,'bold',16],...nm.map((q,j)=>[q,10,'normal',31+j*12]),[u.kw+' kW',10,'normal',45+ex],['Integrated DC/AC',9,'normal',59+ex],['SPD',9,'normal',71+ex]])}
{const yi=dcSpd?554:490,top=505+DCX; // DC isolator (disconnector) cuts the DC cable; DC SPD taps off it to the right, to earth
if(dcIso){ln(x,470,x,yi+14,BL,2);dcIsoSym(x,yi);ln(x,yi+34,x,top,BL,2)}else ln(x,470,x,top,BL,2);
const avl=(x0)=>x+126*sh-x0-2, lab=(x0,y0,arr)=>{const mc=Math.floor(avl(x0)/(0.55*9*fs));if(mc<4)return;if(avl(x0)<8*0.7*9*fs)arr=arr.map(q=>q.replace('ISOLATOR','ISOL.'));let ls=arr.flatMap(q=>wrap(q,mc));if(ls.length>3)ls=wrap(arr[0],mc).slice(0,3);let yy=y0;ls.forEach(z=>{tc(x0,yy,z,9,'start');yy+=LP(9)})}; // at most 3 lines (the rating text is dropped when the column is too narrow)
if(dcSpd){const xs=x+Math.max(26*sh,26),y=486;ln(x,y,xs,y,MG);s.push(`<circle cx="${x.toFixed(1)}" cy="${((y+DY)*fy).toFixed(1)}" r="2.6" fill="${BL}"/>`);ln(xs,y,xs,y+8,MG);bx(xs-7,y+8,14,26,'',MG,1.5);ln(xs-3,y+15,xs+3,y+21,MG);ln(xs+3,y+21,xs-3,y+27,MG);ln(xs,y+34,xs,y+42,MG);es(xs,y+42,MG);lab(xs+12,y+22,['DC SPD',g('dcSpdTxt')].filter(Boolean))}
if(dcIso)lab(x+16,yi+22,['DC ISOLATOR',g('dcIsoTxt')].filter(Boolean))}
const dl=tight?wrap(u.dc||'DC cable',Math.max(6,Math.floor((87*sh-4)/cwid(9)))):[u.dc||'DC cable'];
dl.forEach((s,j)=>tc(x-8*sh,492-(dl.length-1-j)*11,s,9,'end'));
for(let r=0;r<2;r++)for(let c=0;c<3;c++)bx(x-36*sh+c*24*sh,505+DCX+r*20,24*sh,20);
const st='Strings: '+u.cfg,sw=tight&&st.length*cwid(9)>2*(65*sh-4);
const pp=Math.max(13,12.5/fy),py=k=>568+DCX+k*pp; // line pitch of the PV array text: never tighter than the text height, however far the sheet is vertically compressed
tc(x,py(0),'PV ARRAY',11,'middle','bold');tc(x,py(1),`${u.mods} × ${UW(u)} Wp`,10,'middle');
if(HS())tc(x,py(2),(u.mods*UW(u)/1000).toFixed(2)+' kWp',10,'middle');else if(sw){tc(x,py(2),'Strings:',9,'middle');tc(x,py(3),u.cfg,9,'middle');tc(x,py(4),(u.mods*UW(u)/1000).toFixed(2)+' kWp',10,'middle')}
else{tc(x,py(2),st,9,'middle');tc(x,py(3),(u.mods*UW(u)/1000).toFixed(2)+' kWp',10,'middle')}
ln(x-36*sh,545+DCX,x-65*sh,545+DCX,GR,1.5);ln(x-65*sh,545+DCX,x-65*sh,PVC,GR,1.5);s.push(`<circle cx="${(x-65*sh).toFixed(1)}" cy="${((PVC+DY)*fy).toFixed(1)}" r="2.8" fill="${GR}"/>`);pvx.push(x-65*sh); // module-side earth: solid line to this location's roof earth collector (not to the equipment earth)
if(hb){const bl=x-125*sh; // battery on the LEFT of the inverter, between the inverter and its earth line: the DC cable never reaches (so never crosses) the earth line; the battery earth joins that line = one common earth to the bus bar
ln(x-45*sh,458,bl,458,BL,2);ln(bl,458,bl,505,BL,2); // leaves the inverter's left side (below its earth connection), clear of the PV DC-cable label
wrap(u.battDc||'Battery DC cable',Math.max(6,Math.floor((66*sh)/cwid(7)))).slice(0,2).forEach((q,j)=>tc(bl-4*sh,474+j*9,q,7,'end'));
bx(bl-25*sh,505,50*sh,45);
[[516,10],[521,5],[526,10],[531,5]].forEach(([by,bw],j)=>ln(bl-bw*sh,by,bl+bw*sh,by,'#000',j%2?4:1.5));
tc(bl,545,u.battKwh+' kWh',8,'middle');tc(bl,565,'BATTERY',9,'middle','bold');
ln(bl-25*sh,538,xe,538,GR,1.5,'5 3');s.push(`<circle cx="${xe.toFixed(1)}" cy="${((538+DY)*fy).toFixed(1)}" r="2.6" fill="${GR}"/>`);
if(7*0.62*9*fs+6<bl-25*sh-xe)tc((bl-25*sh+xe)/2,534,'4mm² Cu',9,'middle')}}
else{inv(x,400);
const bt=['BESS PCS'+(nB>1?' '+(k-nI+1):'')];
if(tight){[...wl(bt[0],12.5).map(s=>[s,11,'bold']),[u.kw+' kW',10,'normal'],...wl('Bi-directional',10).map(s=>[s,10,'normal'])].forEach(([s,z,w],j)=>tc(x+52*sh,416+j*11,s,z,'start',w))}
else txt(x,[[bt[0],11,'bold',16],[u.kw+' kW',10,'normal',31],['Bi-directional',10,'normal',45]]);
ln(x,470,x,505,BL,2);tc(x+8*sh,492,u.dc||'DC cable',9);bx(x-45*sh,505,90*sh,70);
[[522,18],[530,9],[538,18],[546,9]].forEach(([y,w],j)=>ln(x-w*sh,y,x+w*sh,y,'#000',j%2?4:1.5));
tc(x,566,u.kwh+' kWh',10,'middle');tc(x,592,u.model,11,'middle','bold')}
const lbE=lb||((i>0&&!(L2&&i==n1))?Xc(i-1)-(U[i-1].kind=='bess'?95:65)*sh+6:126); // label must not run left across the previous column's right-most vertical (its PV-earth / earth line)
ln(x-45*sh,435,xe,435,GR,1.5,'5 3');ln(xe,435,xe,ye,GR,1.5,'5 3');
const el=u.earth+(B?' (PCS + battery earth)':(u.hybrid&&+u.battKwh>0)?' (inverter + battery earth)':''),room=Math.min(xl-lbE,ph?colPitch-198*sh:1e9),ea=tight?wrap(el,Math.max(8,Math.floor(Math.min(colPitch-30*sh-8,ph?colPitch-198*sh:1e9,xl-lbE)/cwid(10)))):(el.length*cwid(10)>room?wrap(el,Math.max(6,Math.floor(room/cwid(10)))):[el]); // never run left across the main earth line (x=120)
const plN=wrap(PVLS(dy),Math.max(8,Math.floor(Math.min(colPitch-36*sh-6,150*sh)/cwid(9)))).length,eb=(tight||plN>1)?ye-15-(plN-1)*LP(9)-Math.max(12,LP(10))-4-off:ye-15-Math.max(15,LP(10))-off; // keep clear of the (wrapped) PV roof-earth label
const eb2=Math.max(eb,PVC+15+(ea.length-1)*LP(10)); // never let a wrapped label climb into this location's roof-earth collector line (Location 2 columns have less height)
if(hb){const eh=wrap(el,Math.max(6,Math.floor(126*sh/cwid(10))));eh.forEach((q,j)=>tc(xe+4*sh,Math.max(eb,PVC+15+(eh.length-1)*LP(10))-(eh.length-1-j)*LP(10),q,10,'start'))} // hybrid: the label sits to the RIGHT of its earth line (between it and the PV earth), where there is room
else ea.forEach((s,j)=>tc(xl,eb2-(ea.length-1-j)*LP(10),s,10,'end')); // tight: sit above the (wrapped) PV-earth label of the neighbouring column
if(B){ln(x-45*sh,540,x-95*sh,540,GR,1.5,'5 3');
{const by=(dcIso||dcSpd)?557:529;tc(x-99*sh,by+11-LP(9),'Battery',9,'end');tc(x-99*sh,by+11,'earth →',9,'end')}}
DY=0};
const pvA=[],pvB=[];
U1.forEach((u,k)=>drawCol(u,k,Xc(k),PD,k,INV.length,BESS.length,pvB,false));
U2.forEach((u,k)=>drawCol(u,n1+k,Xc(n1+k),DY2+PD+E2,k,INV2.length,BESS2.length,pvA,false,k==0?XPE()+10:0));
// roof earth: the arrays' earths join into ONE collector per location (solid, dots = joints, no dot where it merely crosses an equipment earth); one conductor then runs to the earth bus bar
const pvCollector=(xs,dy)=>{if(!xs.length)return;DY=dy;const ye=yE-dy;if(xs.length>1)ln(xs[0],PVC,xs[xs.length-1],PVC,GR,1.5);ln(xs[0],PVC,xs[0],ye,GR,1.5);
 const pl=wrap(PVLS(dy),Math.max(8,Math.floor(Math.min(colPitch-36*sh-6,150*sh)/cwid(9))));pl.forEach((q,j)=>tc(xs[0]+6*sh,ye-15-(pl.length-1-j)*LP(9),q,9,'start'));DY=0};
pvCollector(pvA,DY2+PD+E2);pvCollector(pvB,PD);
const XGB=370+(g('efrIso')?126:92),GPX=GPI.map(i=>Xc(i)-28*sh),XGM=nGP?(c=>[c,c+90,c-90,c+170,c+250,c+330].find(x=>x>=330&&GPX.every(d=>Math.abs(d-x)>=40))||c)(isIso0?480:XGB):0; // hybrid: XGB = x of the ATS grid-side busbar (layout without Location 2 on the isolation panel); XGM = where the grid feeder enters the main panel
const lastU=U[(L2?n1:cnt)-1]||U[0],acW=Math.min(String(lastU.ac).length*cwid(9),colPitch-10*sh),spdX=Xc(L2?n1-1:cnt-1)+Math.max(105*sh+SPDX,8*sh+acW+16), // clear of the last column's (wide) AC-cable label
 // with Location 2 on the isolation panel the main panel is shortened (right to left) so that feeder can come straight down
busEnd=Math.max(L2&&!isIso0?Math.max(spdX+95,XPE()+30+90):spdX+95,nGP?XGM+130:0); // Location 2 on the main panel: the busbar also reaches its tap breaker; hybrid: room for the grid feeder

DY=PD;ln(spdX,300,spdX,335,MG);bx(spdX-9,335,18,34,'',MG);ln(spdX-4,343,spdX+4,352,MG);ln(spdX+4,352,spdX-4,361,MG);ln(spdX,369,spdX,382,MG);es(spdX,382,MG);t(spdX+16,356,'SPD Type 1+2',10);
ln(90,300,busEnd,300,OR,5);nGP?(()=>{const xs=GPI.map(i=>Xc(i)-28*sh).sort((a,b)=>a-b),q=`0.4kV AC COMMON COUPLING BUSBAR ${g('bus')}A  3P+N+PE 400/230V 50Hz`,lw=k=>{const p=U1[GPI[k]].gp;return Math.max(`4P ${p.mccb}A`.length*cwid(11),(BT(p.mccb,p.I)+' · GRID').length*cwid(9),...wslash(p.ac,Math.max(8,Math.floor((colPitch-40*sh)/cwid(9)))).map(q=>q.length*cwid(9)))},xk=GPI.map((i,k)=>[Xc(i)-28*sh,lw(k)]).sort((a,b)=>a[0]-b[0]),cuts=[250].concat(xk.flatMap(([x,w])=>[x-8,x+22+w])).concat([busEnd-10]);let best=[250,busEnd-10],bw=-1;for(let k=0;k<cuts.length;k+=2){const w=cuts[k+1]-cuts[k];if(w>bw){bw=w;best=[cuts[k],cuts[k+1]]}}const w=z=>z.length*0.6*10;let ls=w(q)<=bw?[q]:[`0.4kV AC COMMON COUPLING BUSBAR ${g('bus')}A`,'3P+N+PE 400/230V 50Hz'],sz=10;if(Math.max(...ls.map(w))>bw){sz=8;ls=wrap(ls.join(' '),Math.max(10,Math.floor(bw/(0.6*8))))}ls.forEach((z,j)=>t(best[0]+2,289-(ls.length-1-j)*(sz+1),z,sz,'start'))})():(L2?(q=>{const mxw=busEnd-10-250,ls=q.length*0.55*10>mxw?[`0.4kV AC COMMON COUPLING BUSBAR ${g('bus')}A`,'3P+N+PE 400/230V 50Hz']:[q];ls.forEach((z,j)=>t(250,289-(ls.length-1-j)*11,z,10,'start'))})(`0.4kV AC COMMON COUPLING BUSBAR ${g('bus')}A  3P+N+PE 400/230V 50Hz`):t((300+busEnd)/2,289,`0.4kV AC COMMON COUPLING BUSBAR ${g('bus')}A  3P+N+PE 400/230V 50Hz`,10,'middle'));
DY=0;bx(80,250+E1,busEnd-70,128+PD-E1-AW,'8 4');T1=()=>{const DY0=DY;DY=0;const ttl=`${L2?'LOCATION 1 — ':''}MAIN SWITCHGEAR PANEL ${g('panel')}A`,W=(q,z)=>q.length*0.62*z;let x0=L2?170:busEnd-W(ttl,11);const ob=nGP&&GSX?[Math.min(GSX,XGM)-8,Math.max(GSX,XGM)+8]:null; // the hybrid grid feeder (ATS grid-side busbar -> main panel) runs just above the panel: keep the title clear of it
if(!ob||x0+W(ttl,11)<ob[0]||x0>ob[1]){t(L2?170:busEnd,245+E1,ttl,11,L2?'start':'end','bold')}else{const rg=[[160,ob[0]],[ob[1],busEnd-6]].map(([a,b])=>[a,b,b-a]).sort((p,q)=>q[2]-p[2])[0],one=W(ttl,11)<=rg[2];const ls=one?[ttl]:(L2?['LOCATION 1 —',`MAIN SWITCHGEAR PANEL ${g('panel')}A`]:['MAIN SWITCHGEAR',`PANEL ${g('panel')}A`]),sz=Math.min(11,rg[2]/Math.max(...ls.map(q=>q.length*0.62)));ls.forEach((q,j)=>t(rg[0]+4,245+E1-(ls.length-1-j)*12,q,sz,'start','bold'))}DY=DY0};t(busEnd-8,266+E1,ipT('ipMain'),10,'end','bold');DY=PD; // enclosure rating badge, top-right inside the panel outline
if(indM)lamps(100,300);
ln(85,364,155,364,GR,3);t(98,350,'PANEL EARTH BUS',9,'start','bold');
ln(120,364,120,yE-PD,GR,1.5,'5 3');
(L2?['Location 1','panel earth']:['Switchgear','panel earth']).forEach((q,j)=>t(114,(L2?yE-PD-170:534)+j*11,q,10,'end'));DY=0; // two lines so it stays inside the drawing windowDY=0; // left of the earth line, clear of the first column's own earth runs
const srcG=()=>md()=='hy'?(g('hySrc')=='both'?'both':'grid'):md()=='og'?String(g('ogSrc')||''):'';
const hl=(md()=='nm'||md()=='na')&&!mvg,og=md()=='og'||md()=='hy',isIso=L2&&V.loc2to=='iso',cxF=L2?XPE()+30:0,cx=isIso?Math.min(cxF,(()=>{ // cx = Location 2 tap on the isolation panel; cxF = feeder down to Location 2's panel. The tap stays far enough left that the isolation panel + meter + GRID fit
  if(!(og&&srcG()))return md()=='og'?1450:1185;const ef=!!g('efrIso'),HYq=md()=='hy',bo=srcG()=='both',ew=44,x2=ef?70:80,xgB=HYq?x2+150+(ef?20:0):0,xb1=HYq?Math.max(xgB+10,x2+162):0,x1=HYq?xb1+60:x2+(ef?ew+92:100),
  K=HYq?(bo?x1+66:xb1+64):Math.max((bo?x1:x2)+(ef?66:75),ef?x2+64+ew+12:0);return 1290-K})()):cxF,RT=isIso&&cx<cxF-1; // RT: feeder routed over the main panel // cx = x of Location 2's feeder (right of the main columns)
const HYS=md()=='hy';let GSX=0;const src=HYS?(g('hySrc')=='both'?'both':'grid'):og?String(g('ogSrc')||''):'';let topR=0; // off-grid backup source(s): '' none | dg | grid | both
const dotS=(x,y,r=2.4)=>s.push(`<circle cx="${x}" cy="${((y+DY)*fy).toFixed(1)}" r="${r}" fill="#fff" stroke="#000" stroke-width="1.2"/>`);
// standard ATS symbol (changeover switch in an enclosure): inputs I / II on the left / right edges, common (load) terminal at the bottom (flip: at the top)
const tI=(x,y,str,sz=11,a,w)=>t(x,y,str,sz<10?sz+1.5:sz,a,w); // isolation panel / grid side: small labels one and a half steps larger for print
const atsSym=(x,y,flip)=>{const cy=flip?y+32:y+12,py=flip?y+10:y+34,c1=x+12,c2=x+48,px=x+30;bx(x,y,60,44);
 ln(x,cy,c1-2.4,cy);ln(x+60,cy,c2+2.4,cy);flip?ln(px,y,px,py-2.4):ln(px,py+2.4,px,y+44);
 ln(px,py,px+(c1-px)*0.82,py+(cy-py)*0.82,'#000',1.8);dotS(c1,cy);dotS(c2,cy);dotS(px,py);
 tI(c1,flip?y+22:y+26,'I',7,'middle','bold');tI(c2,flip?y+22:y+26,'II',7,'middle','bold');tI(x+47,flip?y+12:y+40,'ATS',7,'middle','bold')};
const gen=(x,y,r)=>{s.push(`<circle cx="${x}" cy="${((y+DY)*fy).toFixed(1)}" r="${r}" fill="none" stroke="#000" stroke-width="1.5"/>`);tI(x,y+3/fy,'G',11,'middle','bold');tI(x,y+11/fy,'~',8,'middle')};
const cabLab=(L,R,y,str)=>{const gp=R-L-28,x=(L+R)/2,w=(q,z)=>q.length*0.56*z;let sz=9,ls=[str];if(w(str,9)>gp){sz=8;if(w(str,8)>gp){const q=str.split(' × ');ls=wslash(q[0],Math.max(8,Math.floor(gp/(0.56*8)))).concat(q[1]?['× '+q[1]]:[])}}
 ls.forEach((q,j)=>tI(x,y-(ls.length-1-j)*10,q,sz,'middle'))};
const BE=isIso?Math.max(660,cx+70):660,mx=isIso?Math.min(BE+150,1405):810; // BE: right edge of the isolation panel (extended left→right to Location 2's feeder); mx: x of the energy meter (GRID follows)
const ulab=(L,str)=>{const gp=mx-14-L-14,x=(L+mx-14)/2,w=(q,z)=>q.length*0.56*z; // utility cable label, centred in the gap between the panel outline (L) and the meter: shrinks, then wraps (at '/' and before '× n'), never touching either
 let sz=10,ls=[str];if(w(str,10)>gp){sz=9;if(w(str,9)>gp){const q=str.split(' × ');ls=wslash(q[0],Math.max(8,Math.floor(gp/(0.56*9)))).concat(q[1]?['× '+q[1]]:[])}}
 ls.forEach((q,j)=>tI(x,117-(ls.length-1-j)*11,q,sz,'middle'))};
if(og&&src){ // OFF-GRID with backup source(s): automatic transfer switch(es) built into the isolation panel
 const both=src=='both',A=g('atsA')||g('iso')||g('panel'),efrA=!!g('efrIso'),eset=efrSet('efrIsoSet').slice(0,isIso?8:10),ew=isIso?44:50,x2=isIso?cx+(efrA?70:80):370,xb0=x2+72,xgB=HY?x2+150+(efrA?20:0):0,xb1=HY?Math.max(xgB+10,xb0+90):0,x1=HY?xb1+60:x2+(efrA?ew+92:100),BEa=HY?(both?x1+(isIso?66:70):xb1+64):Math.max((both?x1:x2)+(efrA?66:75),efrA?x2+64+ew+12:0),tight=isIso&&efrA,yG=both?167:125;GSX=xgB;
 bx(80,92,BEa-80,98,'8 4');tI(85,86,`ISOLATION PANEL (ATS) — ${ipT('ipIso')}`,9,'start','bold');
 ln(100,125,x2-24,125,OR,4);tI(175,115,`SOLAR BUS ${g('isoBus')||A}A`,9,'middle');ln(x2-24,125,x2,125,OR);if(!isIso)tI(x2-5,120,'SOLAR',7,'end','bold');ln(150,125,150,177,OR);
 if(indI)lamps(225,125);
 atsSym(x2,113,false);tI(x2+30,107,`${both?'ATS-2':'ATS'}  4P ${A}A`,9,'middle','bold');
 // load: ATS output straight down, out of the panel
 ln(x2+30,157,x2+30,205+AR,OR);s.push(`<polygon points="${x2+16},${((205+AR)*fy).toFixed(1)} ${x2+44},${((205+AR)*fy).toFixed(1)} ${x2+30},${((233+AR)*fy).toFixed(1)}" fill="#000"/>`);
 {const LB=both||HY,cap=LB&&!isIso?2:3,ls=(q=>q.length>cap?q.slice(0,cap-1).concat([q.slice(cap-1).join(' ')]):q)(wrap(g('loadName'),HY&&isIso?9:LB?13:18)),sz=ls.length>1?10:11;ls.forEach((q,j)=>LB?tI(x2+14,224+AR+j*12,q,sz,'end','bold'):tI(x2+46,224+AR+j*12,q,sz,'start','bold'))}{const lc=String(g('loadCable')),z=9.5,RS=HY||(isIso&&!both),av=RS?(HY?xgB-8:BEa+200)-(x2+38):isIso?x2+24-cx-10:1e9;let ls=[lc];if(lc.length*0.56*z>av){const q=lc.split(' × ');ls=wslash(q[0],Math.max(6,Math.floor(av/(0.56*z)))).concat(q[1]?['× '+q[1]]:[])}ls.forEach((q,j)=>RS?t(x2+38,207+j*10.5,q,z,'start'):t(x2+24,(ls.length>1?200:203)+j*10.5,q,z,'end'))} // never across Location 2's feeder; wrapped lines go DOWN (clear of the panel outline above);
 if(efrA){const yc=172,ry=161,rx=x2+64;ctc(x2+30,yc);ln(x2+30+CTR,yc,rx,yc,'#000',1);const d=relay(rx,ry,ew,eset); // EFR: CBCT on the ATS output (load side), relay trips the ATS (dashed)
  ln(rx+ew/2,ry,rx+ew/2,147,'#000',1,'4 3');ln(rx+ew/2,147,x2+60,147,'#000',1,'4 3')}
 const srcLab=(L,R,y,str,xr)=>{if(str.length*0.56*9<=R-L-28)return cabLab(L,R,y-8,str); // fits between the panel and the source: above its line
   const xm=(L+xr)/2,hw=Math.min((xr-L-8)/2,1568-xm),n=Math.max(8,Math.floor(2*hw/4.48)),q=str.split(' × '),ls=wslash(q[0],n).concat(q[1]?['× '+q[1]]:[]),xc=Math.min(xm,1568-Math.max(...ls.map(z=>z.length))*2.24);ls.forEach((q,j)=>tI(xc,y-30-(ls.length-1-j)*10,q,8,'middle'))}, // else above the source symbols
  grid=(xs,y)=>{const m=Math.max(BEa+(tight?36:48),isIso?Math.min(BEa+150,1405):BEa+150),cmp=m+170>1565,cmp2=cmp&&m+86>1565,gx=cmp2?m+24:cmp?m+30:m+90,gw=cmp2?44:cmp?56:80; // utility supply: meter then GRID
   if(HY&&m+68>1565){const xv=xs+10,ym2=50,gL=xv-96; // no room on the right: run up out of the panel; meter, then GRID (left of the meter for two ATS)
    ln(xs,y,xv,y,OR);ln(xv,y,xv,ym2+14,OR);s.push(`<circle cx="${xv}" cy="${((ym2+DY)*fy).toFixed(1)}" r="${(14*fy).toFixed(1)}" fill="none" stroke="#000" stroke-width="1.5"/>`);tI(xv,ym2+4,'kWh',9,'middle');
    ln(xv-14,ym2,gL+70,ym2,OR);bx(gL,ym2-20,70,40);tI(gL+35,ym2+5,'GRID',12,'middle','bold');
    if(g('meterLbl'))wrap(g('meterLbl'),14).forEach((q,j,a)=>tI(gL-6,ym2-2+j*9,q,8,'end'));
    wslash(SUPC(),24).forEach((q,j)=>tI(gL+35,ym2+29+j*9,q,8,'middle'));return Math.max(xv+14,gL+70)}
   ln(xs,y,m-14,y,OR);s.push(`<circle cx="${m}" cy="${((y+DY)*fy).toFixed(1)}" r="${(14*fy).toFixed(1)}" fill="none" stroke="#000" stroke-width="1.5"/>`);tI(m,y+4,'kWh',9,'middle');
   if(g('meterLbl'))(cmp?wrap(g('meterLbl'),13):[g('meterLbl')]).forEach((q,j)=>tI(m,y+(cmp?36:25)+j*10,q,8,'middle'));
   ln(m+14,y,gx,y,OR);bx(gx,y-25,gw,50);tI(gx+gw/2,y+5,'GRID',cmp2?10:cmp?11:13,'middle','bold');srcLab(BEa,m-14,y,SUPC(),gx+gw);return gx+gw},
  dg=(xs,y)=>{const gx=Math.max(BEa+70,Math.min(BEa+170,1522));ln(xs,y,gx-16,y,OR);gen(gx,y,16);tI(gx,y+34,'DIESEL GENERATOR',8,'middle','bold');if(g('dgKva'))tI(gx,y+44,`${g('dgKva')} kVA`,8,'middle');srcLab(BEa,gx-16,y,g('dgCable')||g('utilCable'),gx+40);return gx+50};
 const brkG=HY&&+g('supBrk')?+g('supBrk'):HY?Math.max(+A||0,nGP?S.gridFeeder(GPI.reduce((a,i)=>a+U1[i].gp.I,0)).mccb:0):0;
 if(HY){ln(x2+60,125,xb0,125,OR);ln(xb0,125,xb1,125,OR,5);tI(xb0+2,117,'GRID-SIDE BUSBAR',6.5,'start','bold');/*label ends before the backup breaker*/ // ATS grid-side busbar (horizontal): feeds ATS input II and, through the cable dropping from it, the hybrid inverters' grid ports
  if(nGP){s.push(`<circle cx="${xgB}" cy="${(125*fy).toFixed(1)}" r="2.6" fill="${OR}"/>`);ln(xgB,125,xgB,182,OR)}
  ln(xb1,125,xb1+16,125,OR);ln(xb1+36,125,xb1+52,125,OR);ln(xb1+36,125,xb1+18,115);ln(xb1+12,121,xb1+20,129);ln(xb1+12,129,xb1+20,121); // incoming breaker in front of the grid-side busbar (horizontal MCCB symbol)
  tI(xb1+26,142,`4P ${brkG}A`,9,'middle','bold');tI(xb1+26,152,BT(brkG),8,'middle')}
 if(!both){if(HY){topR=grid(xb1+52,125)}else topR=src=='grid'?grid(x2+60,125):dg(x2+60,125)}
 else{ // ATS-1 selects DG / grid, its output feeds ATS-2's second input
  ln(HY?xb1+52:x2+60,125,x1+30,125,OR);ln(x1+30,125,x1+30,135,OR);atsSym(x1,135,true);tI(x1+30,107,'ATS-1',9,'middle','bold');tI(x1+30,119,`4P ${A}A`,8.5,'middle','bold');
  ln(x1,167,x1-20,167,OR);ln(x1-20,167,x1-20,205,OR);gen(x1-20,221,16);tI(x1+2,218,'DG',9,'start','bold');if(g('dgKva'))tI(x1+2,229,`${g('dgKva')} kVA`,8,'start');{const q=String(g('dgCable')||g('utilCable')).split(' × '),n=Math.max(8,Math.floor((1568-x1-2)/4.6)),ls=(q.join(' × ').length<=n?[q.join(' × ')]:wslash(q[0],n).concat(q[1]?['× '+q[1]]:[]));ls.forEach((z,j)=>tI(x1+2,240+j*9,z,8,'start'))}
  topR=grid(x1+60,yG)}
 ln(85,170,120,170,GR,3);tI(85,163,'EARTH BUS',7,'start','bold');
 ln(100,170,100,196,GR,1.5,'5 3');es(100,196);tI(100,230,'Isolation panel',8,'middle');tI(100,239,'earth',8,'middle');
}else if(og){
bx(80,92,isIso?BE-80:220,98,'8 4');tI(85,86,`LOAD DISTRIBUTION BOARD (LOAD DB) — ${ipT('ipIso')}`,9,'start','bold');if(indI)lamps(225,115);
ln(100,115,isIso?BE-20:295,115,OR,4);tI(175,105,`LOAD DB BUS ${g('loadBrk')||g('panel')}A`,9,'middle');tI(200,165,'No utility connection',8,'middle');
ln(150,115,150,177,OR);
ln(85,170,120,170,GR,3);tI(85,163,'EARTH BUS',7,'start','bold');
ln(100,170,100,196,GR,1.5,'5 3');es(100,196);tI(100,230,'DB earth',8,'middle'); // grounding point sits OUTSIDE (below) the panel enclosure
}else if(!mvIso){ // MV project without an isolation panel: the main switchgear panel feeds the step-up transformer directly
ln(150,125,150,177,OR);ln(150,125,mx-14,125,OR);
}else{
DY=SH;
if(hl){ln(90,125,BE-20,125,OR,5);tI(365,113,`ISOLATION PANEL BUSBAR ${g('isoBus')}A`,10,'middle');brk(400,125,`4P ${g('loadBrk')}A`,BT(g('loadBrk')),1);ln(400,177,400,205+AR-SH,OR);tI(408,178,g('loadCable'),8);
s.push(`<polygon points="386,${((205+AR)*fy).toFixed(1)} 414,${((205+AR)*fy).toFixed(1)} 400,${((233+AR)*fy).toFixed(1)}" fill="#000"/>`);tI(422,224+AR-SH,g('loadName'),11,'start','bold');
ln(BE-20,125,mx-14,125,OR);bx(80,92-SH,BE-80,98+SH,'8 4');ulab(BE,g('utilCable'))}
else{ln(150,125,mx-14,125,OR);bx(80,92-SH,isIso?BE-80:indI?240:170,98+SH,'8 4');ulab(isIso?BE:indI?320:250,g('utilCable'))}
tI(85,86-SH,`ISOLATION PANEL — ${ipT('ipIso')}`,10,'start','bold');brk(150,125,`4P ${g('iso')}A`,'ISOLATOR',0);
if(indI)lamps(250,125);
ln(85,170,120,170,GR,3);tI(85,163,'EARTH BUS',7,'start','bold');
ln(100,170,100,196,GR,1.5,'5 3');es(100,196);if(SH){tI(82,224-SH,'Isolation panel',8,'end');tI(82,233-SH,'earth',8,'end')}else{tI(100,230,'Isolation panel',8,'middle');tI(100,239,'earth',8,'middle')} // grounding point sits OUTSIDE (below) the panel enclosure
DY=0}
ln(150,177+SH,150,248+PD,OR);
const mo=0;
if(isIso){const mc=g('mainCable'),k=mc.indexOf(' (');(k>0?[mc.slice(0,k),mc.slice(k+1)]:[mc]).forEach((p,j,a)=>tI(158,216+SH+mo-(a.length-1-j)*11,p,9))}else tI(158,216+SH+mo,g('mainCable'),9);
const paBox=lf=>{if(!g('paMain'))return;const k=DY;DY=0;
 if(!nGP){const yp=EFT=='main'||EFT=='unit'?268+E1:248+PD-17; // CT on the main incomer, solid link to the analyser box at its right (relay CT / box, when fitted, sit just below)
  ctc(150,yp);ln(150+CTR,yp,178,yp,'#000',1);bx(178,yp-12,150,24);t(253,yp-2,'POWER ANALYZER',8.5,'middle','bold');t(253,yp+9,`CT ${g('panel')}/5 A × 3`,7.5,'middle');DY=k;return}const yc=lf&&PD-E1>=80?248+PD-62:248+PD-17,bx0=90; // lf: main breaker labels on the left -> analyser higher up, clear of them // power analyser (as on the MV scope SLD): CT on the main incomer just above the main breaker, dashed CT -> analyser box at its left
 ctc(150,yc);bx(bx0,yc-10,30,20);t(bx0+15,yc+4,'PA',9,'middle','bold');ln(bx0+30,yc,150-CTR,yc,'#000',1,'3 2');t(132,yc-4,'CT',8,'middle');
 t(86,yc+21,'POWER',7,'start','bold');t(86,yc+30,'ANALYZER',7,'start','bold');t(86,yc+39,`CT ${g('panel')}/5A ×3`,6.5,'start');DY=k};
if(U1.length==1&&!(L2&&!isIso)){ln(150,248+PD,150,300+PD,OR);paBox(0)}else{const l1=`4P ${g('panel')}A`,l2=(q=>/ADJ/.test(q)?q:'MAIN '+q)(BT(g('panel'),V.panelI)),gx=GPI.length?Math.min(...GPI.map(i=>Xc(i)-28*sh)):1e9;const lf=gx<150+18+Math.max(l1.length*cwid(11),l2.length*cwid(9))+10;brk(150,248+PD,l1,l2,1,lf);paBox(lf)} // a grid-port drop close to the main breaker: its labels go to the left // one unit only: no main breaker (its own breaker protects the cable), the busbar connects straight to the cable
if(EFT=='main'||EFT=='unit'){const set=efrM&&mvRM?'50N/51N + '+MVRF():mvRM?MVRF():efrSet('efrMainSet'),w=mvRM?Math.max(96,efrW(set)):efrW(set),PAO=g('paMain')&&!nGP?40:0,y0=256+E1+PAO,yc=268+E1+PAO;if(efrM||mvRM){ctc(150,yc);ln(150+CTR,yc,178,yc,'#000',1)} /* power analyser present: its CT sits above (further from the breaker), the relay CT below it */const d=relay(178,y0,PAO?Math.max(150,w):w,set,mvRM?'PROTECTION RELAY':'EFR'),yt=y0+d.h-4,yb=248+PD+16; // earth-fault relay INSIDE the main panel outline: CBCT around the outgoing conductor
 if(EFT=='main'){ln(178,yt,162,yt,'#000',1,'4 3');ln(162,yt,162,yb,'#000',1,'4 3');ln(162,yb,155,yb,'#000',1,'4 3')} // trips the main breaker
 else{const xu=Xc(0),ym=y0+d.h/2,yu=320+PD-AW+25;ln(178+w,ym,xu-12,ym,'#000',1,'4 3');ln(xu-12,ym,xu-12,yu,'#000',1,'4 3');ln(xu-12,yu,xu-5,yu,'#000',1,'4 3')}} // one unit, no main breaker: trips the unit's own breaker
if(efrI||mvRI){const set=efrI&&mvRI?'50N/51N + '+MVRF():mvRI?MVRF():efrSet('efrIsoSet'),w=mvRI?Math.max(96,efrW(set)):efrW(set),cxe=Math.max(190,95+w+22),y0=104,yb=125+SH;if(efrI){ctc(cxe,yb);ln(cxe,yb-CTR/fy,cxe,y0+11,'#000',1);ln(cxe,y0+11,95+w,y0+11,'#000',1)}const d=relay(95,y0,w,set,mvRI?'PROTECTION RELAY':'EFR'); // isolation-panel EFR: CBCT on the incoming busbar conductor, relay (with clear space below the panel top) trips the isolator (dashed)
 ln(140,y0+d.h,140,yb+16,'#000',1,'4 3');ln(140,yb+16,146,yb+16,'#000',1,'4 3')}
if(!og&&mvg){DY=mvIso?SH:0; // MV project: the LV side ends at the step-up transformer (utility metering is on the MV side, see the MV scope SLD)
bx(mx-14,97,190,56);tI(mx+81,120,'TO STEP-UP TRANSFORMER',11,'middle','bold');tI(mx+81,138,'(see the MV scope SLD)',9,'middle');DY=0;
}else if(!og){DY=SH;
s.push(`<circle cx="${mx}" cy="${((125+DY)*fy).toFixed(1)}" r="${(14*fy).toFixed(1)}" fill="none" stroke="#000" stroke-width="1.5"/>`);tI(mx,129,'kWh',9,'middle');tI(mx,150,g('meterLbl'),9,'middle');
ln(mx+14,125,mx+90,125,OR);bx(mx+90,100,80,50);tI(mx+130,130,'GRID',13,'middle','bold');DY=0;
}
if(nGP){DY=0; // ---- HYBRID: grid-port supply (absolute coordinates; the common busbar is at 300+PD) ----
 const busY=300+PD,ft=270,xs=GPI.map(i=>Xc(i)-28*sh),hop=(x,y)=>{const r=6;ln(x,y-r-2,x,y-r,OR);s.push(`<path d="M ${x.toFixed(1)} ${((y-r)*fy).toFixed(1)} A ${r} ${r} 0 0 0 ${x.toFixed(1)} ${((y+r)*fy).toFixed(1)}" fill="none" stroke="${OR}" stroke-width="1.5"/>`)}; // hop over the common busbar: crossing, NOT connected
 // feeder from the ATS grid-side busbar down into the main panel (straight down, or round Location 2's feeder when that sits on the isolation panel)
 if(GSX){if(Math.abs(GSX-XGM)>1){const RY=RT?250:250+E1-20;ln(GSX,182,GSX,RY,OR);ln(GSX,RY,XGM,RY,OR);ln(XGM,RY,XGM,ft,OR)} /* RY: well clear above the main panel outline (y 270), below the load arrow tip */else ln(GSX,182,GSX,ft,OR)}
 const d0h=rdim().h,drop=(k,x,y,lt)=>{const u=U1[GPI[k]],p=u.gp;brk(x,y,`${u.poles||'4P'} ${p.mccb}A`,BT(p.mccb,p.I)+' · GRID',1,lt);const al=wslash(p.ac,Math.max(8,Math.floor((colPitch-40*sh)/cwid(9))));al.forEach((q,j)=>tc(x+18,y+48+j*LP(9),q,9,'start'));
   ln(x,y+52,x,busY-8,OR);hop(x,busY);ln(x,busY+6,x,400+PD,OR)}; // down past the common busbar (hop) to the inverter's grid-port terminal
 if(nGP==1){const xg=xs[0],DB=EFT=='gp'?34:0;ln(XGM,ft,XGM,GB1,OR);ln(XGM,GB1,xg,GB1,OR);if(DB)ln(xg,GB1,xg,GB1+DB,OR);drop(0,xg,GB1+DB,EFT=='gp'&&XGM<=xg); // relay on the right -> breaker labels go left
  if(EFT=='gp'){const set=efrSet('efrMainSet'),w=efrW(set),yc=GB1+17,Lf=XGM>xg,rx=Lf?xg-16-w:xg+16,yb=GB1+DB+25,xv=Lf?rx+w-6:rx+6;ctc(xg,yc);ln(Lf?xg-CTR:xg+CTR,yc,Lf?rx+w:rx,yc,'#000',1);const d=relay(rx,yc-d0h/2,w,set);
   ln(xv,yc-d0h/2+d.h,xv,yb,'#000',1,'4 3');ln(xv,yb,Lf?xg-5:xg+5,yb,'#000',1,'4 3')}} // EFR on the BACKUP side: the single grid-port breaker (CBCT on its drop, relay on the side away from the supply)
 else{const F=GF(GPI.reduce((a,i)=>a+U1[i].gp.I,0)),x0=Math.min(...xs,XGM)-6,x9=Math.max(...xs,XGM)+6;
  ln(XGM,ft,XGM,276+EO,OR);brk(XGM,276+EO,`4P ${F.mccb}A`,BT(F.mccb,F.I),1);tc(XGM+18,324+EO,F.ac,9,'start');ln(XGM,328+EO,XGM,GB,OR);
  if(EFT=='feeder'){const set=efrSet('efrMainSet'),w=efrW(set),yc=352+EO,rx=XGM-18-w;ctc(XGM,yc);ln(XGM-CTR,yc,rx+w,yc,'#000',1);const d=relay(rx,yc-13,w,set);ln(rx+w/2,yc-13,rx+w/2,302+EO,'#000',1,'4 3');ln(rx+w/2,302+EO,XGM-5,302+EO,'#000',1,'4 3')} // EFR on the BACKUP main breaker (grid supply from the ATS grid-side busbar)
  ln(x0,GB,x9,GB,OR,4);t(XGM+8,GB-5,`GRID SUPPLY BUSBAR ${F.bus}A — from ATS grid side`,8,'start','bold');
  xs.forEach((x,k)=>drop(k,x,GB))}
}
if(L2){
// ---- Location 2 switchgear panel: sits below the main panel, RIGHT of the main inverters. Its incomer breaker is sized from Location 2's OWN current (loc2panel) and appears at both ends of the interconnecting cable ----
const l2A=g('loc2panel'),l2T=BT(l2A,V.loc2panelI),busY2=300+DY2+PD+E2,arr=busY2-52,srcY=isIso?(og&&!src?115:125+SH):300+PD;
const cxT=cx;{const cx=cxF;
if(isIso){ // from the isolation panel: straight down, or (tap further left) down, across ABOVE the main panel, then down to Location 2
 ln(cxT,srcY,cxT,srcY+10,OR,2);brk(cxT,srcY+10,`4P ${l2A}A`,l2T,1);
 if(RT){const RY2=250+E1-18,ry=250,hop=nGP&&GSX&&cxT>Math.min(GSX,XGM)&&cxT<Math.max(GSX,XGM); // RY2: 16 above the main panel; the hybrid grid feeder (y=250) is hopped
  if(hop){ln(cxT,srcY+62,cxT,ry-6,OR,2);s.push(`<path d="M ${cxT} ${((ry-6)*fy).toFixed(1)} A 6 ${(6*fy).toFixed(1)} 0 0 1 ${cxT} ${((ry+6)*fy).toFixed(1)}" fill="none" stroke="${OR}" stroke-width="2"/>`);ln(cxT,ry+6,cxT,RY2,OR,2)}else ln(cxT,srcY+62,cxT,RY2,OR,2);
  ln(cxT,RY2,cx,RY2,OR,2);ln(cx,RY2,cx,arr,OR,2)}
 else ln(cxT,srcY+62,cxT,arr,OR,2)}
else{ln(cx,300+PD,cx,320+PD,OR,2);brk(cx,320+PD,`4P ${l2A}A`,l2T,1);ln(cx,372+PD,cx,arr,OR,2)}
t(cx+8,408+PD,g('loc2cable'),9,'start');
const lastX=n2?Xc(n1+n2-1):cx+60,bL=XPE()-40,bR=n2?lastX+24+50*fs:lastX+18+0.6*11*fs*8;
brk(cx,arr,`4P ${l2A}A`,l2T,1);
// dashed outline only around the busbar and ALL its breakers (incomer + one per unit), exactly like the main panel
bx(bL,arr+2,bR-bL,128-AW,'8 4');{const nm=(V.loc2name||'LOCATION 2').toUpperCase(),full=`${nm} SWITCHGEAR PANEL ${l2A}A`,room=A4W-28-(cx+10); // near the right page edge: two lines (name / panel rating), stacked upwards
 (full.length*0.62*10<=room?[full]:[nm,`SWITCHGEAR PANEL ${l2A}A`]).forEach((q,j,a)=>t(cx+10,arr-4-(a.length-1-j)*12,q,10,'start','bold'))}t(bR-8,arr+16,ipT('ipL2'),10,'end','bold');if(indL)lamps(cx+30,busY2);
ln(cx,busY2,bR-8,busY2,OR,5);
// panel earth: bus bar inside the box with its OWN earth conductor down to Location 2's own earth bus bar (the bar at the bottom, right)
ln(XPE()-35,busY2+64,XPE()+35,busY2+64,GR,3);t(XPE()-32,busY2+50,'PANEL EARTH BUS',9,'start','bold');ln(XPE(),busY2+64,XPE(),yE,GR,1.5,'5 3'); // same geometry as the main panel's earth bus; the earth drop starts at the middle of the bar
wrap(`${V.loc2name||'Location 2'} panel earth`,Math.max(8,Math.floor((3*sh+90)/cwid(10)))).forEach((q,j)=>tc(XPE()+6,busY2+104+j*LP(10),q,10,'start'));
}}
T1&&T1();if(!L2){ln(120,yE,busEnd,yE,GR,4);t(busEnd,yE-8,'EARTH BUS BAR',11,'end');ln(120,yE,120,yE+28,GR);es(120,yE+28);t(142,yE+40,`${g('earthMain')} — Earth pit  r ≤ ${g('earthR')}Ω`,11)}
else{ // two SEPARATE earth bus bars, each with its own earth pit, tied together by an equipotential bond
const xb1=Xc(n1-1)+12,xp=XPE(),xe2=n2?Xc(cnt-1)+20:xp+90;
const peS=(m=>m?+m[1]:0)(String(g('loc2cable')).match(/(\d+(?:\.\d+)?)\s*mm/)),peN=peS<=16?peS:peS<=35?16:peS/2,pe=peS?[1.5,2.5,4,6,10,16,25,35,50,70,95,120,150,185,240,300].find(v=>v>=peN)||peN:0; // IEC 60364-5-54 Table 54.2: PE = phase size (<=16), 16 (<=35), half (>35) — taken from the interconnecting AC cable
ln(120,yE,xb1,yE,GR,4);xb1-150<132?t(132,yE+16,'LOCATION 1 EARTH BUS BAR',10,'start','bold'):t(xb1,yE+16,'LOCATION 1 EARTH BUS BAR',10,'end','bold');
ln(120,yE,120,yE+28,GR); // (short bar, 1 main unit: the label above is kept clear of this earth-pit riser at x=120)
es(120,yE+28);t(142,yE+40,`${g('earthMain')} — Earth pit  r ≤ ${g('earthR')}Ω`,11);
ln(xb1,yE,xp,yE,GR,2.5);if(xp-xb1>=110){t((xb1+xp)/2,yE-14,pe?`${pe}mm² Cu`:'Earth interconnection',9,'middle');t((xb1+xp)/2,yE-4,pe?'earth interconnection':'',9,'middle')}
ln(xp,yE,xe2,yE,GR,4);t(xp,yE+16,'LOCATION 2 EARTH BUS BAR',10,'start','bold');ln(xe2,yE,xe2,yE+28,GR);es(xe2,yE+28);t(xe2-22,yE+40,`${g('loc2earth')?g('loc2earth')+' — ':''}Earth pit  r ≤ ${g('earthR')}Ω`,11,'end')}
const LEG=[[OR,'AC power',''],[BL,'DC power (PV / battery)',''],[GR,'Equipment earthing','5 3'],[GR,'PV array (roof) earthing',''],[MG,'Surge protection','']].concat(efrM||efrI||(og&&src&&!!g('efrIso'))?[['#000','EFR trip signal','4 3']]:[]);
// legend: first spot (top-right first, then lower / further left) where it touches nothing already drawn
const {LX,LY}=(()=>{const DY0=DY;DY=0;const ob=[],num=(q,k)=>{const m=q.match(new RegExp(' '+k+'="([-\\d.]+)"'));return m?+m[1]:null};
 s.forEach(q=>{if(q.startsWith('<line')){const x1=num(q,'x1'),y1=num(q,'y1'),x2=num(q,'x2'),y2=num(q,'y2');ob.push([Math.min(x1,x2)-3,Math.min(y1,y2)-3,Math.max(x1,x2)+3,Math.max(y1,y2)+3])}
  else if(q.startsWith('<rect')){const x=num(q,'x'),y=num(q,'y'),w=num(q,'width'),h=num(q,'height');if(w!=null&&w<W-40){ob.push([x-3,y-3,x+3,y+h+3]);ob.push([x+w-3,y-3,x+w+3,y+h+3]);ob.push([x-3,y-3,x+w+3,y+3]);ob.push([x-3,y+h-3,x+w+3,y+h+3]);if(!/dasharray/.test(q)&&w<120&&h<120)ob.push([x,y,x+w,y+h])}}
  else if(q.startsWith('<text')){const x=num(q,'x'),y=num(q,'y'),z=num(q,'font-size')||10,str=q.replace(/<[^>]*>/g,''),w=str.length*0.6*z,an=(q.match(/text-anchor="(\w+)"/)||[])[1];const x0=an=='end'?x-w:an=='middle'?x-w/2:x;ob.push([x0-3,y-z-2,x0+w+3,y+4])}
  else if(q.startsWith('<circle')){const x=num(q,'cx'),y=num(q,'cy'),r=num(q,'r')||0;ob.push([x-r-3,y-r-3,x+r+3,y+r+3])}
  else if(q.startsWith('<path')){const n=(q.match(/d="([^"]*)"/)||[,''])[1].match(/-?[\d.]+/g)||[];for(let k=0;k+1<n.length;k+=2){const x=+n[k],y=+n[k+1];if(x>20&&y>20)ob.push([x-8,y-8,x+8,y+8])}}});
 const lw=Math.max(...LEG.map(([,l])=>l.length))*0.6*10+56,lh=(LEG.length-1)*16+16,free=(X,Y)=>{const r=[X-6,(Y-12)*fy,X+lw,(Y+lh)*fy];return!ob.some(o=>o[0]<r[2]&&o[2]>r[0]&&o[1]<r[3]&&o[3]>r[1])};
 const lim=(FB-30)/fy-lh;const XR=W-16-lw;for(const X of [XR,XR-40,XR-80,XR-120,XR-160,XR-200])for(let Y=48;Y<=lim;Y+=6)if(free(X,Y)){DY=DY0;return{LX:X,LY:Y}}
 DY=DY0;return{LX:W-300,LY:og&&src?(isIso||topR>1270?(HY&&isIso?292:262):48):isIso&&mx+170>1270?215:48}})();
LEG.forEach(([c,l,d],i)=>{ln(LX,LY+i*16,LX+40,LY+i*16,c,2,d);t(LX+50,LY+4+i*16,l,10)});
s.push(`<rect x="4" y="4" width="${W-8}" height="${A4H-8}" fill="none" stroke="#000" stroke-width="2"/>`);
// drawing window: an inner frame around the diagram area, separate from the title block (which sits below it, inside the sheet border)
s.push(FRAME(W));
s.push(`<text xml:space="preserve" x="28" y="42" font-size="15" text-anchor="start" font-weight="bold" fill="#000">${esc('SINGLE LINE DIAGRAM — '+CFGN().toUpperCase()+' — '+g('opt'))}</text>`);
TB(s,W,wp,qty,kwp,title);
return page(s.join(''))}

// ===== Panel drawing for supplier quotations: ONLY the main switchgear panel + isolation panel, every cable in/out numbered, with an
// equipment schedule and a cable schedule. No site name / location / sign-off names (it is sent outside the company). =====
function renderPanels(){
const W=A4W,s=[],OR='#d9822b',GR='#0a7a2f',MG='#a020a0';
const T=(x,y,str,sz=10,a='start',w='normal',rot=0)=>s.push(`<text xml:space="preserve" x="${(+x).toFixed(1)}" y="${(+y).toFixed(1)}" font-size="${(+sz).toFixed(2)}" text-anchor="${a}" font-weight="${w}" fill="#000"${rot?` transform="rotate(${rot} ${(+x).toFixed(1)} ${(+y).toFixed(1)})"`:''}>${esc(str)}</text>`);
const L=(a,b,c,d,col='#000',w=1.5,da='')=>s.push(`<line x1="${(+a).toFixed(1)}" y1="${(+b).toFixed(1)}" x2="${(+c).toFixed(1)}" y2="${(+d).toFixed(1)}" stroke="${col}" stroke-width="${w}"${da?` stroke-dasharray="${da}"`:''}/>`);
const R=(x,y,w,h,da='',col='#000',sw=1.5,fill='none')=>s.push(`<rect x="${(+x).toFixed(1)}" y="${(+y).toFixed(1)}" width="${(+w).toFixed(1)}" height="${(+h).toFixed(1)}" fill="${fill}" stroke="${col}" stroke-width="${sw}"${da?` stroke-dasharray="${da}"`:''}/>`);
const C=(x,y,r,fill='none',col='#000',sw=1.5)=>s.push(`<circle cx="${(+x).toFixed(1)}" cy="${(+y).toFixed(1)}" r="${r}" fill="${fill}" stroke="${col}" stroke-width="${sw}"/>`);
const mvg=MVG(),mvIso=MVISO(),mvRI=mvg&&mvIso,mvRM=mvg&&!mvIso; // MV project: no site load here (fed from the utility gantry), isolation panel optional, protection relay NVD/27/59/81
const HY=md()=='hy',og=md()=='og'||HY,hl=(md()=='nm'||md()=='na')&&!mvg,L2=!!V.loc2on,l2iso=L2&&V.loc2to=='iso',l2main=L2&&!l2iso;
const src=HY?(g('hySrc')=='both'?'both':'grid'):og?String(g('ogSrc')||''):'',both=src=='both',ats=og&&!!src;
const ipT=k=>g(k)=='IP66'?'IP66 (outdoor)':'IP54 (indoor)',efrM=!!g('efrMain'),efrI=!!g('efrIso')&&(!og||ats)&&mvIso,indM=!!g('indMain'),indI=!!g('indIso')&&mvIso;
const U1=INV.map((u,i)=>({...u,kind:'inv',n:i+1})).concat(BESS.map((u,i)=>({...u,kind:'bess',n:i+1})));
const GP=HY?U1.filter(u=>u.kind=='inv'&&u.hybrid&&u.gp):[],nGP=GP.length,F=nGP>1?GF(GP.reduce((a,u)=>a+u.gp.I,0)):null;
const A=g('atsA')||g('iso')||g('panel'),brkG=HY&&+g('supBrk')?+g('supBrk'):HY?Math.max(+A||0,F?F.mccb:0):0,l2A=g('loc2panel');
const mainBrk=!(U1.length==1&&!l2main); // same rule as the SLD: one unit only -> no main breaker (also with EFR)
const EFTP=!efrM&&!mvRM?'':nGP>1?'feeder':nGP==1?'gp':!mainBrk?'unit':'main';
const nm=u=>u.kind=='inv'?`INV-${u.n}`:`BESS-${u.n}`,uname=u=>u.kind=='inv'?`Inverter ${u.n} — ${u.name} ${+(+u.kw).toFixed(1)} kW`:`BESS PCS ${u.n} — ${+(+u.kw).toFixed(1)} kW / ${u.kwh} kWh`;
// ---------- cable list (numbered in drawing order) ----------
const CAB=[],cab=(from,to,spec,earth='')=>{CAB.push({n:CAB.length+1,from,to,spec:String(spec||'—'),earth});return CAB.length};
const MP='Main switchgear panel',IP=ats?'Isolation panel (ATS)':og?'Load DB':'Isolation panel';
// ---------- vertical levels ----------
const YA=66,YB=92,BT0=120,BY=both?265:230,BB=BY+115,YTAG=548,EQ=[];
// ---------- symbols ----------
const brk=(x,y,l1,l2,left,k0)=>{const fz=k0||fzD;L(x,y,x,y+16,OR);L(x,y+34,x,y+52,OR);L(x,y+34,x+10,y+16);L(x-4,y+12,x+4,y+20);L(x-4,y+20,x+4,y+12);R(x+1,y+22,7,7,'','#000',1);
 left?(T(x-8,y+22,l1,10*fz,'end','bold'),T(x-8,y+34,l2,8.5*fz,'end')):(T(x+14,y+22,l1,10*fz,'start','bold'),T(x+14,y+34,l2,8.5*fz,'start'))};
const bubble=(x,y,n)=>{const w=n>9?24:18;R(x-w/2,y-7,w,14,'','#000',1,'#fff');T(x,y+3.5,'C'+n,8,'middle','bold')};
const spec=(x,y0,y1,str)=>{const room=y0-y1,sz=8.5*fz,ls=(str.length*0.55*sz<=room)?[str]:(q=>wslash(q[0],Math.max(8,Math.floor(room/(0.55*sz)))).concat(q[1]?['× '+q[1]]:[]))(str.split(' × '));ls.slice(0,3).forEach((q,j)=>T(x+5+sz+j*(sz+2),y0,q,sz,'start','normal',-90))};
const tag=(x,y,str)=>{if(P>=62){const w=Math.max(44,str.length*5.6+10);R(x-w/2,y,w,18,'','#000',1.2);T(x,y+12.5,str,9,'middle','bold')}else T(x+3,y+32,str,8.5,'start','bold',-90)};
const arrowD=(x,y)=>s.push(`<polygon points="${x-5},${y} ${x+5},${y} ${x},${y+8}" fill="#000"/>`);
const es=(x,y)=>{L(x,y,x,y+8,GR);L(x-12,y+8,x+12,y+8,GR,2);L(x-8,y+13,x+8,y+13,GR,2);L(x-4,y+18,x+4,y+18,GR,2)};
const pa=(x)=>{L(x,BY,x,BY+22,OR,1.2);R(x-14,BY+22,28,24);T(x,BY+38,'PA',9,'middle','bold');T(x-14,BY+60,'POWER ANALYSER',7.5*fz,'start','bold');T(x-14,BY+71,`CT ${g('panel')}/5 A × 3`,7.5*fz,'start')}; // power analyser tapped off the busbar
const spd=(x)=>{L(x,BY,x,BY+22,MG);R(x-8,BY+22,16,30,'',MG);L(x-3,BY+30,x+3,BY+37,MG);L(x+3,BY+37,x-3,BY+44,MG);L(x,BY+52,x,BY+66,MG);es(x,BY+66);T(x+13,BY+40,'SPD',9*fz,'start','bold');T(x+13,BY+51,'T1+2',8*fz,'start')};
const lamps=x=>{['R','Y','B'].forEach((c,j)=>{const xx=x+j*14;L(xx,BY,xx,BY+24,OR,1.2);C(xx,BY+30,5.5,'none','#000',1.2);L(xx-3.9,BY+26.1,xx+3.9,BY+33.9,'#000',1.2);L(xx-3.9,BY+33.9,xx+3.9,BY+26.1,'#000',1.2);L(xx,BY+35.5,xx,BY+44,'#000',1.2);T(xx,BY+56,c,7.5,'middle','bold')});L(x,BY+44,x+28,BY+44,'#000',1.2)};
const ttl=(x,ls)=>ls.forEach((q,j)=>T(x,BT0+16+j*14,q,j?9:11,'start',j?'normal':'bold'));
const ctr=(x,y)=>C(x,y,7,'none'),relay=(x,y,set,ttl='EFR')=>{const w=Math.max(ttl=='EFR'?54:96,set.length*4.2+12);R(x,y,w,26);T(x+w/2,y+11,ttl,9,'middle','bold');T(x+w/2,y+21,set,7,'middle');return w};
const efr=(x,setK,mvR,ct=true)=>{const set=mvR?(ct?'50N/51N + ':'')+MVRF():(g(setK)||'50N/51N').slice(0,16),yc=BY-22,rx=x+46,ry=BY-60;if(ct){ctr(x,yc);L(x+7,yc,rx+20,yc,'#000',1);L(rx+20,yc,rx+20,ry+26,'#000',1)}relay(rx,ry,set,mvR?'PROTECTION RELAY':'EFR');L(rx,ry+13,x+9,ry+13,'#000',1,'4 3');return set};
const atsS=(x,y,lbl)=>{R(x-36,y,72,46);const t1=[x-20,y+12],t2=[x+20,y+12],c0=[x,y+34];C(t1[0],t1[1],2.4,'#fff','#000',1.2);C(t2[0],t2[1],2.4,'#fff','#000',1.2);C(c0[0],c0[1],2.4,'#fff','#000',1.2);
 L(x,y+46,x,y+36.4);L(x-20,y,x-20,y+9.6);L(x+20,y,x+20,y+9.6);L(c0[0],c0[1],x-16.5,y+15.5,'#000',1.8);T(x-27,y+9,'I',7,'middle','bold');T(x+28,y+9,'II',7,'middle','bold');T(x+40,y+28,lbl,9.5,'start','bold');T(x+40,y+40,`4P ${A}A`,8.5,'start')};
const earthBar=(x)=>{L(x,BB-16,x+48,BB-16,GR,3);T(x,BB-22,'PANEL EARTH BAR',7,'start','bold');L(x+24,BB-16,x+24,BB+22,GR,1.5,'5 3');es(x+24,BB+22)};
// ---------- items ----------
// down feeders: {kind:'brk'|'spd'|'lamps'|'plain', l1,l2, cable#, tag}
const mainDown=U1.map(u=>({kind:'brk',l1:`${u.poles||'4P'} ${u.mccb}A`,l2:BT(u.mccb,u.I),tag:nm(u),u}));
mainDown.push({kind:'spd'});if(indM)mainDown.push({kind:'lamps',w:0.6});if(g('paMain'))mainDown.push({kind:'pa'});
if(l2main)mainDown.push({kind:'brk',l1:`4P ${l2A}A`,l2:BT(l2A,V.loc2panelI),tag:'LOC-2',l2tap:1});
const gpDown=GP.map(u=>({kind:'brk',l1:`${u.poles||'4P'} ${u.gp.mccb}A`,l2:BT(u.gp.mccb,u.gp.I),tag:'GP-'+u.n,u,gp:1}));
const isoDown=[];
if(!ats){if(og){}else{if(hl)isoDown.push({kind:'brk',l1:`4P ${g('loadBrk')}A`,l2:BT(g('loadBrk')),tag:'LOAD',load:1})}}
if(l2iso&&!ats)isoDown.push({kind:'brk',l1:`4P ${l2A}A`,l2:BT(l2A,V.loc2panelI),tag:'LOC-2',l2tap:1});
if(indI&&!ats)isoDown.push({kind:'lamps',w:0.6});
// ---------- widths: one common feeder pitch P for both panels ----------
const wOf=d=>d.kind=='pa'?0.9:d.kind=='lamps'?0.6:d.kind=='spd'?(indM?1.1:0.7):1; // SPD followed by lamps: room for its label
const wPx=(d,P)=>Math.max(wOf(d)*P,d.kind=='pa'?84:d.kind=='lamps'&&g('paMain')?46:0); // fixed minimum widths so the lamps / power analyser never squeeze together
const sumM=mainDown.reduce((a,d)=>a+wOf(d),0),sumI=isoDown.reduce((a,d)=>a+wOf(d),0);let GAP=70;
const mainW=P=>{let x=(EFTP=='unit'?150:80)+mainDown.reduce((a,d)=>a+wPx(d,P),0); /* one unit with EFR: the feeders start right of the relay (xIn+60) */if(nGP)x+=0.4*P+(nGP>1?0.6*P:0)+nGP*P;return Math.max(x-0.35*P+70,efrM||mvRM?330:250)};
const isoW=P=>{if(!mvIso)return 0;if(ats){const xa=(l2iso?212:110)+100;return Math.max(HY?(both?xa+300:xa+320):both?xa+270:xa+170,300)}
 const xx=(efrI||mvRI?240:150)+sumI*P;return Math.max(og?xx+40:Math.max(xx+30,efrI||mvRI?300:220)+70,og?260:250)};
if(!mvIso)GAP=0;let P=165;while(P>34&&24+mainW(P)+GAP+isoW(P)>W-24)P-=1;if(24+mainW(P)+GAP+isoW(P)>W-24){GAP=44;while(P>26&&24+mainW(P)+GAP+isoW(P)>W-24)P-=1} // very full: closer panels, tighter feeders
function np(){return md()=='np'}
const fzD=Math.max(0.72,Math.min(1.15,P/88)),fz=fzD;
// ---------- MAIN SWITCHGEAR PANEL ----------
const mL=24,xIn=mL+90; // incomer / outgoing to the isolation panel (top-left)
let x=EFTP=='unit'?xIn+60:mL+80,xs=[];mainDown.forEach(d=>{const w=wPx(d,P);xs.push(x+(d.kind=='lamps'?-P*0.15:0));x+=w});
const comEnd=x-P*0.35+20;let gx0=0,gx1=0,gxs=[],xF=0;
if(nGP){x+=P*0.4;gx0=x;if(nGP>1){xF=x+P*0.15;x+=P*0.6}gpDown.forEach(()=>{gxs.push(x);x+=P});gx1=x-P*0.35+20}
const mR=Math.max(x-P*0.35+70,mL+(efrM||mvRM?330:250));
R(mL,BT0,mR-mL,BB-BT0,'8 4');ttl(xIn+14,['MAIN SWITCHGEAR PANEL'+(mainBrk?' '+g('panel')+'A':''),ipT('ipMain').toUpperCase()+(mainBrk?'':' · no main breaker (single unit)')]);
L(mL+30,BY,comEnd,BY,OR,5);T(mL+30+(efrM?0:0),BY+(mainDown.length?-8:-8),'',1);
{const lbl=`COMMON COUPLING BUSBAR ${g('bus')}A · 3P+N+PE 400/230V 50Hz`,lx0=EFTP=='unit'?xs[0]+6:xIn+12,room=comEnd-(lx0+2),sz=Math.min(9,room/(lbl.length*0.58));T(lx0,BY-6,sz>=6.5?lbl:`BUSBAR ${g('bus')}A`,Math.max(6.5,sz),'start','bold')}
// incomer (main breaker) -> up -> route A to the isolation panel
L(xIn,BY,xIn,BY-28,OR);if(mainBrk){brk(xIn,BY-80,`4P ${g('panel')}A`,(q=>/ADJ/.test(q)?q:'MAIN '+q)(BT(g('panel'),V.panelI)),1,1);L(xIn,BY-80,xIn,YA,OR)}else L(xIn,BY-28,xIn,YA,OR);
const cMain=cab(MP+(mainBrk?' — main breaker':' — busbar'),!mvIso?'Step-up transformer (LV side)':IP+(ats?' — solar bus':og?' — Load DB bus':' — isolator'),g('mainCable'));
if(EFTP=='main')efr(xIn,'efrMainSet',mvRM,efrM);
if(EFTP=='unit'){const set=mvRM?(efrM?'50N/51N + ':'')+MVRF():(g('efrMainSet')||'50N/51N').slice(0,16),yc=BY-22,rx=xIn+46,ry=BY-60,xu=xs[0];if(efrM){ctr(xIn,yc);L(xIn+7,yc,rx+20,yc,'#000',1);L(rx+20,yc,rx+20,ry+26,'#000',1)}relay(rx,ry,set,mvRM?'PROTECTION RELAY':'EFR');L(rx,ry+13,xu-10,ry+13,'#000',1,'4 3');L(xu-10,ry+13,xu-10,BY+46,'#000',1,'4 3');L(xu-10,BY+46,xu-4,BY+46,'#000',1,'4 3')} // one unit: trips its own breaker
// unit feeders
const down=(d,xx,nCab)=>{if(d.kind=='spd')return spd(xx);if(d.kind=='lamps')return lamps(xx);if(d.kind=='pa')return pa(xx);
 L(xx,BY,xx,BY+20,OR);brk(xx,BY+20,d.l1,d.l2);L(xx,BY+72,xx,YTAG-8,OR);arrowD(xx,YTAG-8);bubble(xx,BB+18,nCab);spec(xx,YTAG-14,BB+30,CAB[nCab-1].spec);tag(xx,YTAG,d.tag)};
mainDown.forEach((d,k)=>{let n=0;if(d.u)n=cab(uname(d.u),MP+` — ${d.l1} ${d.l2}`,d.u.ac,d.u.earth);if(d.l2tap)n=cab(MP+` — ${d.l1} tap`,`${V.loc2name||'Location 2'} switchgear panel`,V.loc2cable);down(d,xs[k],n)});
earthBar(mL+10);
// hybrid grid-port section (kept OFF the common busbar)
let gpEntry=0,cGPin=0;
if(nGP==1){const d=gpDown[0],xx=gxs[0];gpEntry=xx;L(xx,YB,xx,BY+20,OR);brk(xx,BY+20,d.l1,d.l2);
 if(EFTP=='gp'){const set=(g('efrMainSet')||'50N/51N').slice(0,16),yc=BY-22,w=Math.max(54,set.length*4.2+12),rx=xx-40-w,ry=BY-60;ctr(xx,yc);L(xx-7,yc,rx+w-20,yc,'#000',1);L(rx+w-20,yc,rx+w-20,ry+26,'#000',1);relay(rx,ry,set);L(rx+w,ry+13,xx-12,ry+13,'#000',1,'4 3');L(xx-12,ry+13,xx-12,BY+46,'#000',1,'4 3');L(xx-12,BY+46,xx-5,BY+46,'#000',1,'4 3')} /* single grid port: EFR on that (backup-side) breaker */L(xx,BY+72,xx,YTAG-8,OR);arrowD(xx,YTAG-8);
 cGPin=cab(IP+' — ATS grid-side busbar',MP+` — grid-port breaker ${d.l1}`,d.u.gp.ac);const n=cab(MP+` — grid-port breaker ${d.l1}`,uname(d.u)+' (grid port)',d.u.gp.ac);
 bubble(xx,BB+18,n);spec(xx,YTAG-14,BB+30,d.u.gp.ac);tag(xx,YTAG,d.tag);T(xx+8,BT0+16,'GRID PORT',8,'start','bold')}
else if(nGP>1){L(gx0,BY,gx1,BY,OR,4);T(xF+8,BY-6,`GRID SUPPLY BUSBAR ${F.bus}A`,Math.max(6.5,Math.min(9,(gx1-xF-8)/(22*0.58))),'start','bold');gpEntry=xF;
 L(xF,BY,xF,BY-28,OR);brk(xF,BY-80,`4P ${F.mccb}A`,BT(F.mccb,F.I),1,1);L(xF,BY-80,xF,YB,OR);if(EFTP=='feeder')efr(xF,'efrMainSet'); // EFR on the BACKUP main breaker
 cGPin=cab(IP+' — ATS grid-side busbar',MP+` — grid supply feeder ${F.mccb}A`,F.ac);
 gpDown.forEach((d,k)=>{const n=cab(MP+` — grid-port breaker ${d.l1}`,uname(d.u)+' (grid port)',d.u.gp.ac);down(d,gxs[k],n)});
}
// ---------- ISOLATION PANEL / LOAD DB ----------
const iL=mR+GAP;let iR=mR,xSol,xGO=0;
if(!mvIso){}else if(!ats){
 xSol=iL+90;let xx=iL+(efrI?240:150);const ixs=isoDown.map(d=>{const r=xx+(d.kind=='lamps'?-P*0.15:0);xx+=wOf(d)*P;return r});
 const xGrid=og?0:Math.max(xx+30,iL+(efrI?300:220));iR=Math.max(og?xx+40:xGrid+70,iL+(og?260:250));
 R(iL,BT0,iR-iL,BB-BT0,'8 4');ttl(xSol+14,[og?'LOAD DB':'ISOLATION PANEL',ipT('ipIso').toUpperCase()]);
 if(np()){L(xSol,BY,xGrid,BY,OR,1.5)}else{L(iL+30,BY,(og?iR-30:xGrid+20),BY,OR,5);T(xSol+12,BY-6,og?`LOAD DB BUS ${g('loadBrk')||g('panel')}A`:`ISOLATION BUSBAR ${g('isoBus')}A`,9,'start','bold')}
 L(xSol,YA,xSol,og?BY:BY-80,OR);if(!og){brk(xSol,BY-80,`4P ${g('iso')}A`,'ISOLATOR',1,1);L(xSol,BY-28,xSol,BY,OR)}
 if(efrI||mvRI)efr(xSol,'efrIsoSet',mvRI,efrI);
 if(!og){L(xGrid,BY,xGrid,46,OR);const n=cab(IP+' — busbar',mvg?'Step-up transformer (LV side)':`Energy meter → GRID (utility)`,g('utilCable'));bubble(xGrid,96,n);const gl=mvg?'TO STEP-UP TRANSFORMER':'TO ENERGY METER / GRID',gw=mvg?150:124;R(xGrid-gw/2,22,gw,22,'','#000',1.2);T(xGrid,37,gl,8.5,'middle','bold');
  const st=g('utilCable');xGrid+16+st.length*4.6<W-24?T(xGrid+16,BT0-30,st,8,'start'):T(xGrid-16,BT0-30,st,8,'end')}
 isoDown.forEach((d,k)=>{let n=0;if(d.load)n=cab(IP+` — load breaker ${d.l1}`,g('loadName')||'Load',g('loadCable'));if(d.l2tap)n=cab(IP+` — ${d.l1} tap`,`${V.loc2name||'Location 2'} switchgear panel`,V.loc2cable);down(d,ixs[k],n)});
 if(og)T(iL+30,BB-30,'Outgoing load circuits as per site load schedule',8,'start');
}else{
 // ATS arrangement: every source enters from the top, the load leaves at the bottom
 const xL2=iL+92;xSol=iL+(l2iso?212:110);const xa=xSol+100,xII=xa+20,yA2=BY+28;
 let xb1=0,xIn2=0,x1=0;
 if(HY){xGO=xa+90;xb1=xa+(both?190:200);xIn2=xb1-30}
 if(both)x1=HY?xIn2:xa+150;
 iR=Math.max(HY?xb1+(both?110:120):both?x1+120:xII+150,iL+300);
 R(iL,BT0,iR-iL,BB-BT0,'8 4');ttl(xSol+14,['ISOLATION','PANEL (ATS)',ipT('ipIso').toUpperCase()]);
 // solar incomer -> solar bus -> ATS-2 input I
 L(xSol,YA,xSol,BY,OR);L(iL+30,BY,xa-20,BY,OR,5);T(xSol+5,BY-6,`SOLAR BUS ${g('isoBus')||A}A`,Math.min(8,(xa-20-xSol-8)/(String(`SOLAR BUS ${g('isoBus')||A}A`).length*0.58)),'start','bold');L(xa-20,BY,xa-20,yA2,OR);
 atsS(xa,yA2,both?'ATS-2':'ATS');
 // load out
 L(xa,yA2+46,xa,YTAG-8,OR);arrowD(xa,YTAG-8);{const n=cab(IP+' — ATS output (load)',g('loadName')||'Load',g('loadCable'));bubble(xa,BB+18,n);spec(xa,YTAG-14,BB+30,g('loadCable'));tag(xa,YTAG,'LOAD')}
 if(efrI){const set=(g('efrIsoSet')||'50N/51N').slice(0,16),yc=yA2+60;ctr(xa,yc);L(xa-7,yc,xa-40,yc,'#000',1);const w=relay(xa-40-58,yc-13,set);L(xa-40-58+w/2,yc-13,xa-40-58+w/2,yA2+23,'#000',1,'4 3');L(xa-40-58+w/2,yA2+23,xa-36,yA2+23,'#000',1,'4 3')}
 if(l2iso){L(xL2,BY,xL2,BY+20,OR);const d={kind:'brk',l1:`4P ${l2A}A`,l2:BT(l2A,V.loc2panelI),tag:'LOC-2'};const n=cab(IP+` — solar bus ${d.l1} tap`,`${V.loc2name||'Location 2'} switchgear panel`,V.loc2cable);down(d,xL2,n)}
 const srcTop=(xx,label,cb,from)=>{L(xx,46,xx,BT0,OR);const w=Math.max(70,label.length*5.4+12);R(xx-w/2,22,w,22,'','#000',1.2);T(xx,37,label,8.5,'middle','bold');const n=cab(from,IP,cb);bubble(xx,98,n);return n};
 const gridLbl='FROM GRID (via energy meter)',dgLbl=`FROM DG${g('dgKva')?' '+g('dgKva')+' kVA':''}`;
 if(HY){ // grid-side busbar: feeds ATS input II and the hybrid inverters' grid ports
  L(xII,BY,xb1+20,BY,OR,5);T(xII+6,BY+14,'GRID-SIDE BUSBAR',8,'start','bold');L(xII,BY,xII,yA2,OR);
  L(xIn2,BY,xIn2,BY-28,OR);brk(xIn2,BY-80,`4P ${brkG}A`,BT(brkG),0,1);
  if(!both){L(xIn2,BY-80,xIn2,46,OR);const w=170;R(xIn2-w/2,22,w,22,'','#000',1.2);T(xIn2,37,gridLbl,8.5,'middle','bold');const n=cab('Energy meter (utility GRID)',IP+` — incoming ${brkG}A`,SUPC());bubble(xIn2,98,n)}
  else{const ya=BT0+8;L(xIn2,BY-80,xIn2,ya+46,OR);atsS(xIn2,ya,'ATS-1');T(xIn2+40,ya+52,'(grid / DG)',8,'start');
   [[xIn2-20,'DG',g('dgCable')||g('utilCable'),dgLbl],[xIn2+20,'GRID',SUPC(),'FROM GRID / METER']].forEach(([xx,k,cb,lb],j)=>{const xt=xx+(j?58:0);L(xx,ya,xx,ya-12,OR);L(xx,ya-12,xt,ya-12,OR);L(xt,ya-12,xt,46,OR);
    const w=Math.max(66,lb.length*5.2+12);R(xt-w/2,22,w,22,'','#000',1.2);T(xt,37,lb,8,'middle','bold');const n=cab(k=='DG'?'Diesel generator':'Energy meter (utility GRID)',IP+' — ATS-1 input '+(j?'II':'I'),cb);bubble(xt,104,n)})}
  if(nGP){L(xGO,BY,xGO,YB,OR);T(xGO+6,BY-30,'TO MAIN PANEL',7.5,'start','bold');T(xGO+6,BY-21,'GRID PORT(S)',7.5,'start','bold')}
 }else if(!both){const k=src=='grid';L(xII,yA2,xII,46,OR);const lb=k?gridLbl:dgLbl,w=Math.max(80,lb.length*5.4+12);R(xII-w/2+30,22,w,22,'','#000',1.2);T(xII+30,37,lb,8.5,'middle','bold');L(xII,46,xII,44,OR);
  const n=cab(k?'Energy meter (utility GRID)':'Diesel generator',IP+' — ATS input II',k?SUPC():(g('dgCable')||g('utilCable')));bubble(xII,98,n)}
 else{const ya=BT0+8;atsS(x1,ya,'ATS-1');L(x1,ya+46,x1,BY,OR);L(x1,BY,xII,BY,OR);L(xII,BY,xII,yA2,OR);T(x1+40,ya+52,'(grid / DG)',8,'start');
  [[x1-20,'DG',g('dgCable')||g('utilCable'),dgLbl],[x1+20,'GRID',SUPC(),'FROM GRID / METER']].forEach(([xx,k,cb,lb],j)=>{const xt=xx+(j?58:0);L(xx,ya,xx,ya-12,OR);L(xx,ya-12,xt,ya-12,OR);L(xt,ya-12,xt,46,OR);
   const w=Math.max(66,lb.length*5.2+12);R(xt-w/2,22,w,22,'','#000',1.2);T(xt,37,lb,8,'middle','bold');const n=cab(k=='DG'?'Diesel generator':'Energy meter (utility GRID)',IP+' — ATS-1 input '+(j?'II':'I'),cb);bubble(xt,104,n)})}
 L(iL+12,BB-16,iL+60,BB-16,GR,3);
}
if(mvIso)earthBar(iL+10);
// ---------- interconnecting cables between the two panels ----------
if(!mvIso){L(xIn,YA,xIn,46,OR);R(xIn-40,22,150,22,'','#000',1.2);T(xIn+35,37,'TO STEP-UP TRANSFORMER',8.5,'middle','bold');bubble(xIn,94,cMain);T(xIn+16,98,g('mainCable'),8.5,'start')} // MV project, no isolation panel: the main breaker feeds the step-up transformer
else{L(xIn,YA,xSol,YA,OR);bubble((xIn+xSol)/2,YA,cMain);T((xIn+xSol)/2+16,YA-5,g('mainCable'),8.5,'start')}
if(nGP&&HY&&ats){const hx=xSol>gpEntry&&xSol<xGO?xSol:0;if(hx){L(gpEntry,YB,hx-6,YB,OR);s.push(`<path d="M ${hx-6} ${YB} A 6 6 0 0 1 ${hx+6} ${YB}" fill="none" stroke="${OR}" stroke-width="1.5"/>`);L(hx+6,YB,xGO,YB,OR)}else L(gpEntry,YB,xGO,YB,OR); /* crosses the solar incomer: hop (not connected) */bubble((gpEntry+Math.min(xGO,mR))/2,YB,cGPin);T((gpEntry+Math.min(xGO,mR))/2+16,YB-5,nGP>1?F.ac:GP[0].gp.ac,8.5,'start');
}
// ---------- equipment schedule ----------
const grp=(arr)=>{const m=new Map();arr.forEach(([a,b])=>{const k=a+'|'+b;m.set(k,(m.get(k)||0)+1)});return[...m].map(([k,n])=>{const[a,b]=k.split('|');return[a,b,n]})};
const eqM=[['Enclosure — main switchgear panel',ipT('ipMain')+', with gland plate',1],['Busbar — common coupling',`${g('bus')}A, 3P+N+PE, 400/230V 50Hz`,1]];
if(mainBrk)eqM.push([`Main breaker (outgoing to ${mvIso?'isolation panel':'step-up transformer'})`,`4P ${g('panel')}A ${BT(g('panel'),V.panelI)}`,1]);
grp(U1.map(u=>[u.kind=='inv'?'Inverter incoming breaker':'BESS PCS breaker',`${u.poles||'4P'} ${u.mccb}A ${BT(u.mccb,u.I)}`])).forEach(r=>eqM.push(r));
if(nGP>1){eqM.push(['Busbar — grid supply (hybrid)',`${F.bus}A, 3P+N+PE`,1]);eqM.push(['Grid supply feeder breaker',`4P ${F.mccb}A ${BT(F.mccb,F.I)}`,1])}
grp(GP.map(u=>['Hybrid grid-port breaker',`${u.poles||'4P'} ${u.gp.mccb}A ${BT(u.gp.mccb,u.gp.I)}`])).forEach(r=>eqM.push(r));
if(l2main)eqM.push([`Outgoing breaker to ${V.loc2name||'Location 2'} panel`,`4P ${l2A}A ${BT(l2A,V.loc2panelI)}`,1]);
eqM.push(['AC surge protection device','SPD Type 1+2, 3P+N',1]);
if(mvRM)eqM.push([`Protection relay ${MVRF()}${efrM?' + EFR 50N/51N, CBCT':''} (trips ${mainBrk?'main breaker':'inverter breaker'})`,`Numerical relay${V.mv.nvdOn===false?'':', NVD signal from the MV VT'}`,1]);
else if(efrM)eqM.push([`Earth fault relay + CBCT (trips ${({main:'main breaker',unit:'inverter breaker',feeder:'backup main breaker',gp:'grid-port breaker'})[EFTP]})`,`Setting ${g('efrMainSet')||'50N/51N'}`,1]);
if(indM)eqM.push(['Phase indicator lamps','R-Y-B',1]);
if(g('paMain'))eqM.push(['Power analyser (multifunction meter)',`With CT ${g('panel')}/5 A × 3 on the main incomer`,1]);
eqM.push(['Panel earth bar','Cu',1]);
const eqI=[[`Enclosure — ${og&&!ats?'Load DB':'isolation panel'}`,ipT('ipIso')+', with gland plate',1]];
if(!ats){if(og)eqI.push(['Busbar — Load DB',`${g('loadBrk')||g('panel')}A, 3P+N+PE`,1]);else{if(!np())eqI.push(['Busbar — isolation panel',`${g('isoBus')}A, 3P+N+PE, 400/230V 50Hz`,1]);eqI.push(['Isolator (incoming from main panel)',`4P ${g('iso')}A`,1]);if(hl)eqI.push(['Load feeder breaker',`4P ${g('loadBrk')}A ${BT(g('loadBrk'))}`,1])}}
else{eqI.push(['Busbar — solar bus',`${g('isoBus')||A}A, 3P+N+PE`,1]);eqI.push([both?'ATS-2 (solar / backup → load)':'ATS (solar / backup → load)',`4P ${A}A, automatic transfer switch`,1]);if(both)eqI.push(['ATS-1 (grid / DG)',`4P ${A}A, automatic transfer switch`,1]);
 if(HY){eqI.push(['Busbar — ATS grid-side',`${Math.max(+A||0,brkG)}A, 3P+N+PE`,1]);eqI.push(['Incoming breaker (grid-side busbar)',`4P ${brkG}A ${BT(brkG)}`,1])}}
if(l2iso)eqI.push([`Outgoing breaker to ${V.loc2name||'Location 2'} panel`,`4P ${l2A}A ${BT(l2A,V.loc2panelI)}`,1]);
if(mvRI)eqI.push([`Protection relay ${MVRF()}${efrI?' + EFR 50N/51N, CBCT':''} (trips isolator)`,`Numerical relay${V.mv.nvdOn===false?'':', NVD signal from the MV VT'}`,1]);
else if(efrI)eqI.push([`Earth fault relay + CBCT (trips ${ats?'the ATS':'the isolator'})`,`Setting ${g('efrIsoSet')||'50N/51N'}`,1]);
if(indI)eqI.push(['Phase indicator lamps','R-Y-B',1]);
eqI.push(['Panel earth bar','Cu',1]);
// ---------- tables ----------
const TY=602,TB=FB-6,TX0=24,TW0=620,TX1=TX0+TW0+20,TW1=W-24-TX1;
const table=(x0,y0,w,cols,head,rows,title)=>{const n=rows.length+1,rh=Math.min(15,(TB-y0-18)/n),fsz=Math.min(9,rh*0.68);
 T(x0,y0-6,title,11,'start','bold');R(x0,y0,w,rh*n);let cx=x0;cols.forEach((cw,j)=>{if(j){let ys=y0;[...rows,{sec:1}].forEach((r,i)=>{const yy=y0+rh*(i+1);if(r.sec){if(yy>ys)L(cx,ys,cx,yy,'#000',0.8);ys=yy+rh}})}T(cx+4,y0+rh*0.7,head[j],fsz,'start','bold');cx+=cw*w});
 L(x0,y0+rh,x0+w,y0+rh,'#000',1.2);rows.forEach((r,i)=>{const yy=y0+rh*(i+1);if(i)L(x0,yy,x0+w,yy,'#000',r.sec?1:0.4);let cx=x0;
  if(r.sec){s.push(`<rect x="${x0}" y="${yy.toFixed(1)}" width="${w}" height="${rh.toFixed(1)}" fill="#eee" stroke="none"/>`);T(x0+4,yy+rh*0.7,r.sec,fsz,'start','bold');return}
  r.forEach((c,j)=>{const cw=cols[j]*w,mc=Math.floor((cw-8)/(0.55*fsz)),q=String(c);T(cx+4,yy+rh*0.7,q.length>mc?q.slice(0,mc-1)+'…':q,fsz,'start',j==0&&r.b?'bold':'normal');cx+=cw})})};
table(TX0,TY,TW0,[0.06,0.5,0.36,0.08],['#','Item','Rating / specification','Qty'],[{sec:'MAIN SWITCHGEAR PANEL'},...eqM.map((r,i)=>[i+1,r[0],r[1],r[2]])].concat(mvIso?[{sec:(ats?'ISOLATION PANEL (ATS)':og?'LOAD DISTRIBUTION BOARD':'ISOLATION PANEL')},...eqI.map((r,i)=>[i+1,r[0],r[1],r[2]])]:[]),'EQUIPMENT SCHEDULE (per panel)');
table(TX1,TY,TW1,[0.05,0.31,0.31,0.33],['No','From','To','Cable (earth / PE)'],CAB.map(c=>[`C${c.n}`,c.from,c.to,c.spec+(c.earth?` + ${c.earth}`:'')]),'CABLE SCHEDULE (all panel incoming / outgoing cables)');
// ---------- sheet ----------
s.unshift(`<g data-layer="DIAGRAM">`);s.push('</g>');
const out=[];out.push(`<rect x="4" y="4" width="${W-8}" height="${A4H-8}" fill="none" stroke="#000" stroke-width="2"/>`);out.push(FRAME(W));
{const H=105,BM=10,y0=A4H-BM-H,x0=BM,x1=W-BM,d1=150,d2=860,d3=W-360,q=[];const Tt=(x,y,str,sz,a='start',w='normal')=>q.push(`<text x="${x}" y="${y}" font-size="${sz}" text-anchor="${a}" font-weight="${w}" fill="#000">${esc(str)}</text>`);
 q.push('<g data-layer="TITLEBLOCK">');q.push(`<rect x="${x0}" y="${y0}" width="${x1-x0}" height="${H}" fill="none" stroke="#000" stroke-width="1.5"/>`);[d1,d2,d3].forEach(x=>q.push(`<line x1="${x}" y1="${y0}" x2="${x}" y2="${y0+H}" stroke="#000" stroke-width="1.5"/>`));
 if(LOGO)q.push(`<image href="${LOGO}" xlink:href="${LOGO}" x="${x0+8}" y="${y0+6}" width="${d1-x0-16}" height="${H-12}" preserveAspectRatio="xMidYMid meet"/>`);
 Tt(d1+15,y0+30,'SWITCHGEAR PANELS — FOR QUOTATION',19,'start','bold');Tt(d1+15,y0+54,(MVISO()?'Main switchgear panel & isolation panel':'Main switchgear panel')+': schematic, equipment schedule and cable schedule',11);
 Tt(d1+15,y0+76,`System configuration: ${CFGD()}${HY&&V.mode=='hy'?' (hybrid)':''}`,11);Tt(d1+15,y0+96,`Reference: ${g('dno')||'—'}`,11);Tt(d1+330,y0+96,`Date: ${dfmt(g('date'))}`,11);
 ['Supplier to quote per the schedules above, stating:','• make / model and breaking capacity (kA) of each device','• enclosure size / material and busbar size','• glands / terminations to suit each cable (C1, C2 …)','• delivery period'].forEach((t,j)=>Tt(d2+12,y0+18+j*15.5,t,j?9.5:10,'start',j?'normal':'bold'));
 Tt(d3+12,y0+22,'Contact',10,'start','bold');Tt(d3+12,y0+40,'Regen Renewables (Pvt) Ltd.',10);Tt(d3+12,y0+56,'31/10 Castle Street, Colombo 8, Sri Lanka',9.5);Tt(d3+12,y0+72,'www.regen.lk',9.5);
 q.push('</g>');out.push(q.join(''))}
return page(out.join('')+s.join(''));
}
// Backup (grid-side) supply cable: from the supply-connection table / user edit, else the auto utility cable
const SUPC=()=>g('supCable')||g('utilCable');
// Hybrid backup main breaker (main panel grid-supply feeder, fed from the ATS grid-side busbar) + its cable: auto from the grid-port currents, or the user's edit
const GF=sum=>{const F=S.gridFeeder(sum),b=+g('bkBrk'),c=g('bkCable');if(b>0){F.mccb=b;F.bus=b}if(c)F.ac=c;return F};
// Single-phase supply: every breaker becomes 2-pole and busbars single phase (text labels only - layout unchanged)
const PH1=svg=>!V.sp?svg:svg.replace(/>([^<]+)</g,(m,q)=>'>'+q.replace(/\b4P\b/g,'2P').replace(/3P\+N\+PE,? 400\/230V/g,'1P+N+PE 230V').replace(/3P\+N\+PE/g,'1P+N+PE').replace(/SPD Type 1\+2, 3P\+N/g,'SPD Type 1+2, 1P+N').replace(/\b3P\+N\b/g,'1P+N')+'<');

// ===== MV scope SLD (systems of 1000 kVA and above): LV panel feeder -> step-up transformer -> NVD VT + surge arrester -> MV cable -> DDLO -> MV gantry busbar -> DDLO -> utility DDLO -> CEB MV network.
// Symbols per IEC 60617: circuit breaker, current transformer, two-winding transformer (star-earthed LV / delta HV), voltage transformer, surge arrester, cable sealing ends, drop-out fuse (DDLO), busbar, earth. =====
const wrw=(q,n)=>{const o=[];let c='';String(q).split(' ').forEach(w=>{if(c&&(c+' '+w).length>n){o.push(c);c=w}else c=c?c+' '+w:w});if(c)o.push(c);return o}; // word wrap (MV scope boxes)
function renderMV(){
const W=A4W,s=[],M=V.mv||{list:[]},kv=M.kv||'33',OR='#d9822b',MV='#b0282e',GR='#0a7a2f',BK='#000',n=Math.max(1,M.list.length);
const T=(x,y,str,sz=10,a='start',w='normal',fill='#000')=>s.push(`<text xml:space="preserve" x="${(+x).toFixed(1)}" y="${(+y).toFixed(1)}" font-size="${(sz<12?sz*1.2:sz).toFixed(1)}" text-anchor="${a}" font-weight="${w}" fill="${fill}">${esc(str)}</text>`); // small labels 20 % larger for print
const L=(a,b,c,d,col=BK,w=1.5,da='')=>s.push(`<line x1="${(+a).toFixed(1)}" y1="${(+b).toFixed(1)}" x2="${(+c).toFixed(1)}" y2="${(+d).toFixed(1)}" stroke="${col}" stroke-width="${w}"${da?` stroke-dasharray="${da}"`:''}/>`);
const R=(x,y,w,h,col=BK,sw=1.3,da='',fill='none')=>s.push(`<rect x="${(+x).toFixed(1)}" y="${(+y).toFixed(1)}" width="${(+w).toFixed(1)}" height="${(+h).toFixed(1)}" fill="${fill}" stroke="${col}" stroke-width="${sw}"${da?` stroke-dasharray="${da}"`:''}/>`);
const C=(x,y,r,col=BK,sw=1.5,fill='none')=>s.push(`<circle cx="${(+x).toFixed(1)}" cy="${(+y).toFixed(1)}" r="${r}" fill="${fill}" stroke="${col}" stroke-width="${sw}"/>`);
const PG=(pts,col=BK,fill='none',sw=1.3)=>s.push(`<polygon points="${pts.map(p=>p.map(v=>(+v).toFixed(1)).join(',')).join(' ')}" fill="${fill}" stroke="${col}" stroke-width="${sw}"/>`);
const earth=(x,y,col=GR)=>{L(x,y,x,y+8,col);L(x-10,y+8,x+10,y+8,col,2);L(x-6.5,y+12,x+6.5,y+12,col,2);L(x-3,y+16,x+3,y+16,col,2)};
const wr=(q,n)=>{const p=String(q).split(' × '),ls=wslash(p[0],n);return p[1]?ls.concat(['× '+p[1]]):ls};
// ---- symbols ----
const cbH=(x,y,col)=>{ // circuit breaker, horizontal: fixed contact with x, moving blade
 L(x-24,y,x-8,y,col);L(x+8,y,x+24,y,col);L(x-8,y,x+8,y-11,BK,1.6);L(x+5,y-3,x+11,y+3,BK,1.3);L(x+5,y+3,x+11,y-3,BK,1.3)};
const ct=(x,y,col)=>{C(x,y,7,BK,1.3);L(x-7,y,x+7,y,col)};
const tx=(x,y,col1,col2)=>{ // two-winding transformer: LV circle (star, neutral earthed) + HV circle (delta)
 C(x-14,y,18,BK,1.6);C(x+14,y,18,BK,1.6);
 const sx=x-20,sy=y;L(sx,sy,sx,sy-7,BK,1.1);L(sx,sy,sx-6,sy+4,BK,1.1);L(sx,sy,sx+6,sy+4,BK,1.1); // star
 PG([[x+20,y-7],[x+14,y+5],[x+26,y+5]],BK,'none',1.1); // delta
 L(x-14,y+18,x-14,y+30,GR,1.3);earth(x-14,y+30)};
const vt=(x,y)=>{C(x,y,8,BK,1.4);C(x,y-12,8,BK,1.4)}; // voltage transformer (NVD)
const sa=(x,y)=>{R(x-6,y,12,24,BK,1.4);L(x,y+3,x,y+19,BK,1.2);PG([[x-3,y+15],[x+3,y+15],[x,y+21]],BK,BK,1)}; // surge arrester
const se=(x,y,dir)=>PG([[x,y],[x+dir*10,y-6],[x+dir*10,y+6]],MV,MV,1); // cable sealing end
const ddlo=(x,y,col)=>{ // drop-out fuse (expulsion fuse cut-out): hinge, fuse tube on a tilted blade, upper contact
 L(x-30,y,x-14,y,col);C(x-14,y,2.2,BK,1.2,'#fff');const a=-28*Math.PI/180,ux=Math.cos(a),uy=Math.sin(a),L0=30,hx=x-14,hy=y;
 const p=(t,o)=>[hx+ux*t-uy*o,hy+uy*t+ux*o];L(hx,hy,...p(L0,0),BK,1.5);PG([p(8,-4),p(22,-4),p(22,4),p(8,4)],BK,'#fff',1.3);L(...p(10,0),...p(20,0),BK,1);
 L(x+14,y,x+30,y,col);L(x+14,y,x+14,y-7,BK,1.4)};
const swH=(x,y,col,lbs)=>{ // gantry switch: ABS = disconnector (blade + bar at the fixed contact); LBS = switch-disconnector (+ load-break circle)
 L(x-24,y,x-12,y,col);C(x-12,y,2.2,BK,1.2,'#fff');L(x-12,y,x+12,y-13,BK,1.6);L(x+14,y-7,x+14,y+7,BK,1.6);if(lbs){C(x+18,y,3.2,BK,1.2,'#fff');L(x+21.2,y,x+24,y,col)}else L(x+14,y,x+24,y,col)};
const arH=(x,y,col)=>{L(x-30,y,x-18,y,col);R(x-18,y-18,36,36,BK,1.5);L(x-10,y+10,x+10,y-10,BK,1.6);C(x-10,y+10,2,BK,1.1,'#fff');L(x+18,y,x+30,y,col)}; // auto recloser: breaker in a box
const ctpt=(x,y,col)=>{L(x-24,y,x+24,y,col);C(x-7,y,7,BK,1.4,'#fff');C(x+7,y,7,BK,1.4,'#fff');L(x-14,y,x+14,y,col)}; // metering CT / PT
// ---- geometry ----
const yTop=78,yBot=FB-8,list=M.list.length?M.list:[{src:'LV panel',kva:'1000',brk:'',lvc:'',mvc:'',len:'',ddlo:'DDLO '+kv+' kV'}];
const AV=yBot-yTop-60,P=Math.min(250,AV/n),k=Math.min(1,P/215),off=(AV-P*n)/2,rowY=i=>yTop+50+off+P*(i+0.5); // rows centred in the window
const X={bus:56,cb:120,ct:196,lvOut:350,tx:540,node:604,c0:646,c1:800,dd:850,gx0:892,gb:924,sw:990,od:1062,gx1:1104,ar:1184,ld:1204,eb:1250,cp:1294,cd:1378,ceb:1432},XM=468,UT=M.util||'EDL',nvdOn=M.nvdOn!==false;
// scope boxes
const y0=Math.max(yTop+6,rowY(0)-P/2-30),y1=Math.min(yBot,rowY(n-1)+P/2+20); // scope boxes wrap the rows
const G=26;R(X.gx0,y0+G,X.gx1-X.gx0,y1-y0-2*G,GR,1.4,'6 4');T(X.gx0+8,y0+G+16,(M.gantry||'Medium voltage gantry').toUpperCase(),10,'start','bold');
R(XM,y0,X.gx1+G-XM,y1-y0,MV,1.8,'10 5');T(XM+10,y0+16,'REGEN MV SCOPE',13,'start','bold',MV);
T(30,y0+16,'REGEN LV SCOPE (see the LV SLD)',11,'start','bold');T(X.gx1+G+14,y0+16,UT.toUpperCase()+' SCOPE',11,'start','bold');
// gantry busbar
const yA=rowY(0),yB=rowY(n-1),yO=(yA+yB)/2;L(X.gb,Math.min(yA,yO)-22*k-14,X.gb,Math.max(yB,yO)+22*k+14,MV,5);T(X.gb+8,Math.min(yA,yO)-22*k-18,`${kv} kV BUSBAR`,9,'start','bold');
list.forEach((r,i)=>{const y=rowY(i),hv=k;
 // LV panel feeder box
 R(26,y-80*hv-6,X.lvOut-26,150*hv+14,BK,1.1,'6 4');T(34,y-80*hv+8,(r.src||'LV panel').toUpperCase(),9,'start','bold');
 L(X.bus,y-32*hv,X.bus,y+32*hv,OR,5);T(X.bus-4,y+32*hv+13,'LV BUSBAR',7.5,'start','bold');
 L(X.bus,y,X.cb-24,y,OR);cbH(X.cb,y,OR);const bt=r.brk?`4P ${r.brk}A ${BT(+r.brk,r.lvI)}`:'LV breaker';T(X.cb,y+17,bt,8.5,'middle','bold');
 L(X.cb+24,y,X.ct-7,y,OR);ct(X.ct,y,OR);L(X.ct+7,y,X.lvOut,y,OR);T(X.ct,y+19,'CT',8,'middle');
 // power analyzer + protection relay (top of the LV box)
 const ry=y-62*hv,pa=[X.ct-46,ry],pr=[X.ct+20,ry];R(pa[0],pa[1],60,24);T(pa[0]+30,pa[1]+10,'POWER',7.5,'middle','bold');T(pa[0]+30,pa[1]+19,'ANALYZER',7.5,'middle','bold');
 R(pr[0],pr[1],96,24);T(pr[0]+48,pr[1]+10,'PROTECTION RELAY',7.5,'middle','bold');T(pr[0]+48,pr[1]+19,'('+MVRF().replace(/\//g,' / ')+')',6.5,'middle');
 L(X.ct,y-7,X.ct,ry+24,BK,1,'3 2');L(pa[0]+30,ry+24,pa[0]+30,ry+30,BK,1,'3 2');L(pa[0]+30,ry+30,X.ct,ry+30,BK,1,'3 2'); // CT secondary to the analyzer
 L(pr[0]+10,ry+24,pr[0]+10,ry+34,BK,1,'4 3');L(pr[0]+10,ry+34,X.cb+6,ry+34,BK,1,'4 3');L(X.cb+6,ry+34,X.cb+6,y-6,BK,1,'4 3'); // trip -> LV breaker
 // LV cable to the transformer
 const lv=wr(r.lvc||'LV cable',Math.floor((XM-X.lvOut-12)/(0.56*8)));lv.forEach((q,j)=>T((X.lvOut+XM)/2,y-8-(lv.length-1-j)*10,q,8,'middle')); /* between the LV box and the MV-scope border */L(X.lvOut,y,X.tx-32,y,OR);
 // step-up transformer
 tx(X.tx,y);L(X.tx+32,y,X.node,y,MV);[`STEP-UP TRANSFORMER`,`${r.kva} kVA · 0.4/${kv} kV`,M.vg||'Dyn11'].forEach((q,j)=>T(X.tx,y-58*hv+j*11,q,j?8.5:8.5,'middle',j?'normal':'bold'));
 // NVD VT (up) + surge arrester (down) at the transformer HV terminal
 if(nvdOn){L(X.node,y,X.node,y-26*hv,MV);vt(X.node,y-26*hv-8);T(X.node+14,y-26*hv-14,'NVD TRANSFORMER (VT)',7.5,'start','bold');T(X.node+14,y-26*hv-4,M.nvd||kv+'/0.11 kV',7.5,'start');
 const sig=y-106*hv; /* NVD signal well above the LV panel outline (box top at y-86) */L(X.node,y-26*hv-28,X.node,sig,BK,1,'4 3');L(X.node,sig,pr[0]+70,sig,BK,1,'4 3');L(pr[0]+70,sig,pr[0]+70,ry,BK,1,'4 3')} // VT -> protection relay
 L(X.node,y,X.node,y+14*hv,MV);sa(X.node,y+14*hv);L(X.node,y+14*hv+24,X.node,y+14*hv+30,GR,1.3);earth(X.node,y+14*hv+30);T(X.node+12,y+14*hv+16,(M.sa||kv+' kV surge arrester').toUpperCase(),7.5,'start','bold');
 // MV cable with sealing ends
 L(X.node,y,X.c0,y,MV);se(X.c0,y,1);L(X.c0+10,y,X.c1-10,y,MV,2.2);se(X.c1,y,-1);L(X.c1,y,X.dd-30,y,MV);
 const mc=wr(r.mvc||'MV cable',34);['MV CABLE'].concat(mc).forEach((q,j,a)=>T((X.c0+X.c1)/2,y-9-(a.length-1-j)*10,q,8,'middle',j?'normal':'bold'));T((X.c0+X.c1)/2,y+15,'L = '+(r.len?r.len+' m':'— m'),8,'middle');
 // feeder DDLO -> gantry busbar
 ddlo(X.dd,y,MV);T(X.dd,y+16,r.ddlo||('DDLO '+kv+' kV'),8,'middle','bold');L(X.dd+30,y,X.gb,y,MV);C(X.gb,y,2.6,MV,1,MV);
 T(X.c1-4,y+28,`MV ${(+r.hvI||0).toFixed(1)} A`,7.5,'end');T(X.lvOut-6,y+28,`LV ${(+r.lvI||0).toFixed(0)} A`,7.5,'end');
});
// outgoing (gantry): busbar -> LBS / ABS -> DDLO | utility scope: auto recloser -> utility busbar (site load via DDLO) -> CT / PT metering -> DDLO -> utility network
L(X.gb,yO,X.sw-24,yO,MV);C(X.gb,yO,2.6,MV,1,MV);if(M.sw=='none')L(X.sw-24,yO,X.sw+24,yO,MV);else{swH(X.sw,yO,MV,M.sw!='abs');T(X.sw,yO+16,M.swL||((M.sw=='abs'?'ABS ':'LBS ')+kv+' kV'),8,'middle','bold')}
L(X.sw+24,yO,X.od-30,yO,MV);ddlo(X.od,yO,MV);T(X.od,yO+16,'DDLO '+kv+' kV',8,'middle','bold');L(X.od+30,yO,X.ar-30,yO,MV);
arH(X.ar,yO,MV);T(X.ar,yO+30,'AUTO',8,'middle','bold');T(X.ar,yO+40,'RECLOSER',8,'middle','bold');L(X.ar+30,yO,X.eb,yO,MV);
const ebT=M.load?yO-56:yO-34;L(X.eb,ebT,X.eb,yO+34,MV,5);C(X.eb,yO,2.6,MV,1,MV);T(X.eb-20,ebT-8,UT.toUpperCase()+' '+kv+' kV BUSBAR',8,'start','bold');
if(M.load){const yL=yO-46;L(X.eb,yL,X.ld+30,yL,MV);C(X.eb,yL,2.6,MV,1,MV);ddlo(X.ld,yL,MV);T(X.ld,yL+16,M.loadDdlo||('DDLO '+kv+' kV'),8,'middle','bold');L(X.ld-30,yL,X.ld-42,yL,MV);
 PG([[X.ld-56,yL],[X.ld-42,yL-7],[X.ld-42,yL+7]],BK,BK,1);T(X.ld-49,yL-12,String(M.load).toUpperCase(),8.5,'middle','bold')} // site load, fed from the utility gantry
L(X.eb,yO,X.cp-24,yO,MV);ctpt(X.cp,yO,MV);T(X.cp,yO+20,'CT / PT',8,'middle','bold');T(X.cp,yO+31,'('+UT.toUpperCase()+' METERING)',7.5,'middle');L(X.cp+24,yO,X.cd-30,yO,MV);
ddlo(X.cd,yO,MV);T(X.cd,yO+16,M.cebDdlo||('DDLO '+kv+' kV ('+UT+')'),8,'middle','bold');L(X.cd+30,yO,X.ceb,yO,MV);
R(X.ceb,yO-26,128,52,BK,1.6);const cw=wrw(M.ceb||(UT+' '+kv+' kV network'),12);cw.forEach((q,j)=>T(X.ceb+64,yO-(cw.length-1)*6+4+j*12,q.toUpperCase(),10,'middle','bold'));
// legend + transformer schedule (right side)
const LG=[[OR,'LV AC (0.4 kV)',''],[MV,`MV AC (${kv} kV)`,''],[BK,'Protection / signal','4 3'],[GR,'Earthing','']];
const lx=1376,ly=96;LG.forEach(([c,l,d],j)=>{L(lx,ly+j*16,lx+40,ly+j*16,c,2,d);T(lx+50,ly+4+j*16,l,10)});
const tx0=1236,ty0=Math.max(yO+60,ly+90),cols=[26,150,50,50,52],hd=['No','LV source','kVA','LV A','MV A'],rh=15;
T(tx0,ty0-6,'TRANSFORMER SCHEDULE',10,'start','bold');R(tx0,ty0,cols.reduce((a,b)=>a+b,0),rh*(list.length+1),BK,1);
let cx=tx0;cols.forEach((w,j)=>{if(j)L(cx,ty0,cx,ty0+rh*(list.length+1),BK,0.8);T(cx+4,ty0+11,hd[j],8,'start','bold');cx+=w});L(tx0,ty0+rh,tx0+cols.reduce((a,b)=>a+b,0),ty0+rh,BK,1);
list.forEach((r,i)=>{let cx=tx0;const yy=ty0+rh*(i+2)-4,src=String(r.src||'');[String(i+1),src.length>26?src.slice(0,25)+'…':src,r.kva,(+r.lvI||0).toFixed(0),(+r.hvI||0).toFixed(1)].forEach((q,j)=>{T(cx+4,yy,q,8);cx+=cols[j]});if(i)L(tx0,ty0+rh*(i+1),tx0+cols.reduce((a,b)=>a+b,0),ty0+rh*(i+1),BK,0.4)});
const rf=wr(M.relayF||'',60);T(tx0,ty0+rh*(list.length+1)+18,'Protection relay functions:',8.5,'start','bold');rf.forEach((q,j)=>T(tx0,ty0+rh*(list.length+1)+30+j*11,q,8.5));
// sheet
s.unshift('<g data-layer="DIAGRAM">');s.push('</g>');
s.push(`<rect x="4" y="4" width="${W-8}" height="${A4H-8}" fill="none" stroke="#000" stroke-width="2"/>`);s.push(FRAME(W));
s.push(`<text xml:space="preserve" x="28" y="42" font-size="15" text-anchor="start" font-weight="bold" fill="#000">${esc('SINGLE LINE DIAGRAM — MV SCOPE — '+g('opt'))}</text>`);
const wp=+g('modWp')||0,qty=INV.concat(V.loc2on?INV2:[]).reduce((a,i)=>a+i.mods,0),kwp=KWP().toFixed(2),kva=list.reduce((a,r)=>a+(+r.kva||0),0);
TB(s,W,wp,qty,kwp,TITLE(kwp),'SINGLE LINE DIAGRAM — MV SCOPE',`MV connection: ${kv} kV, ${list.length} × step-up transformer (${kva} kVA)`);
return page(s.join(''))}

// ===== MV scope, vertical layout (bottom -> up, like the standard LV SLD): LV panels at the bottom, step-up transformers above them,
// the MV gantry busbar across the top, then the utility DDLO and the CEB network. Same IEC 60617 symbols as the horizontal layout. =====
function renderMVv(){
const W=A4W,s=[],M=V.mv||{list:[]},kv=M.kv||'33',OR='#d9822b',MV='#b0282e',GR='#0a7a2f',BK='#000';
const list=M.list.length?M.list:[{src:'LV panel',kva:'1000',brk:'',lvc:'',mvc:'',len:'',ddlo:'DDLO '+kv+' kV',lvI:0,hvI:0}],n=list.length;
const T=(x,y,str,sz=10,a='start',w='normal',fill='#000')=>s.push(`<text xml:space="preserve" x="${(+x).toFixed(1)}" y="${(+y).toFixed(1)}" font-size="${(sz<12?sz*1.2:sz).toFixed(1)}" text-anchor="${a}" font-weight="${w}" fill="${fill}">${esc(str)}</text>`);
const L=(a,b,c,d,col=BK,w=1.5,da='')=>s.push(`<line x1="${(+a).toFixed(1)}" y1="${(+b).toFixed(1)}" x2="${(+c).toFixed(1)}" y2="${(+d).toFixed(1)}" stroke="${col}" stroke-width="${w}"${da?` stroke-dasharray="${da}"`:''}/>`);
const R=(x,y,w,h,col=BK,sw=1.3,da='',fill='none')=>s.push(`<rect x="${(+x).toFixed(1)}" y="${(+y).toFixed(1)}" width="${(+w).toFixed(1)}" height="${(+h).toFixed(1)}" fill="${fill}" stroke="${col}" stroke-width="${sw}"${da?` stroke-dasharray="${da}"`:''}/>`);
const C=(x,y,r,col=BK,sw=1.5,fill='none')=>s.push(`<circle cx="${(+x).toFixed(1)}" cy="${(+y).toFixed(1)}" r="${r}" fill="${fill}" stroke="${col}" stroke-width="${sw}"/>`);
const PG=(pts,col=BK,fill='none',sw=1.3)=>s.push(`<polygon points="${pts.map(p=>p.map(v=>(+v).toFixed(1)).join(',')).join(' ')}" fill="${fill}" stroke="${col}" stroke-width="${sw}"/>`);
const earth=(x,y,col=GR)=>{L(x,y,x,y+8,col);L(x-10,y+8,x+10,y+8,col,2);L(x-6.5,y+12,x+6.5,y+12,col,2);L(x-3,y+16,x+3,y+16,col,2)};
const wr=(q,m)=>{const p=String(q).split(' × '),ls=wslash(p[0],m);return p[1]?ls.concat(['× '+p[1]]):ls};
// ---- vertical symbols (power flows upwards) ----
const cbV=(x,y,col)=>{L(x,y+52,x,y+36,col);L(x,y+16,x,y,col);L(x,y+36,x+11,y+19,BK,1.6);L(x-3,y+13,x+3,y+19,BK,1.3);L(x-3,y+19,x+3,y+13,BK,1.3)}; // breaker: bottom contact .. top (x)
const ctV=(x,y,col)=>{C(x,y,7,BK,1.3);L(x,y-7,x,y+7,col)};
const txV=(x,y)=>{C(x,y-14,18,BK,1.6);C(x,y+14,18,BK,1.6);PG([[x,y-21],[x-6,y-9],[x+6,y-9]],BK,'none',1.1); // HV delta (top)
 const sy=y+20;L(x,sy,x,sy-7,BK,1.1);L(x,sy,x-6,sy+4,BK,1.1);L(x,sy,x+6,sy+4,BK,1.1); // LV star (bottom)
 L(x-18,y+14,x-34,y+14,GR,1.3);L(x-34,y+14,x-34,y+26,GR,1.3);earth(x-34,y+26)}; // LV neutral earthed
const vtH=(x,y)=>{C(x,y,8,BK,1.4);C(x+12,y,8,BK,1.4)};
const saV=(x,y)=>{R(x-6,y,12,24,BK,1.4);L(x,y+3,x,y+19,BK,1.2);PG([[x-3,y+15],[x+3,y+15],[x,y+21]],BK,BK,1)};
const seV=(x,y,dir)=>PG([[x,y],[x-6,y+dir*10],[x+6,y+dir*10]],MV,MV,1); // sealing end, tip at the cable end
const ddloV=(x,y,col)=>{L(x,y+30,x,y+14,col);C(x,y+14,2.2,BK,1.2,'#fff');const a=-(90-28)*Math.PI/180,ux=Math.cos(a),uy=Math.sin(a),p=(t,o)=>[x+ux*t-uy*o,y+14+uy*t+ux*o];
 L(x,y+14,...p(30,0),BK,1.5);PG([p(8,-4),p(22,-4),p(22,4),p(8,4)],BK,'#fff',1.3);L(...p(10,0),...p(20,0),BK,1);L(x,y-14,x,y-30,col);L(x,y-14,x-7,y-14,BK,1.4)};
// gantry outgoing (horizontal) + utility side (vertical spine at the right)
const ddloH=(x,y,col)=>{L(x-30,y,x-14,y,col);C(x-14,y,2.2,BK,1.2,'#fff');const a=-28*Math.PI/180,ux=Math.cos(a),uy=Math.sin(a),p=(t,o)=>[x-14+ux*t-uy*o,y+uy*t+ux*o];
 L(x-14,y,...p(30,0),BK,1.5);PG([p(8,-4),p(22,-4),p(22,4),p(8,4)],BK,'#fff',1.3);L(...p(10,0),...p(20,0),BK,1);L(x+14,y,x+30,y,col);L(x+14,y,x+14,y-7,BK,1.4)};
const swH=(x,y,col,lbs)=>{L(x-24,y,x-12,y,col);C(x-12,y,2.2,BK,1.2,'#fff');L(x-12,y,x+12,y-13,BK,1.6);L(x+14,y-7,x+14,y+7,BK,1.6);if(lbs){C(x+18,y,3.2,BK,1.2,'#fff');L(x+21.2,y,x+24,y,col)}else L(x+14,y,x+24,y,col)}; // ABS: disconnector; LBS: + load-break circle
const arV=(x,y,col)=>{L(x,y+30,x,y+18,col);R(x-18,y-18,36,36,BK,1.5);L(x-10,y+10,x+10,y-10,BK,1.6);C(x-10,y+10,2,BK,1.1,'#fff');L(x,y-18,x,y-30,col)}; // auto recloser
const ctptV=(x,y,col)=>{L(x,y-24,x,y+24,col);C(x,y-7,7,BK,1.4,'#fff');C(x,y+7,7,BK,1.4,'#fff');L(x,y-14,x,y+14,col)}; // metering CT / PT
// ---- geometry ----
const UT=M.util||'EDL',nvdOn=M.nvdOn!==false,xE=W-40-190,RL=xE-50; // xE: utility spine; the Regen columns + gantry stay left of RL
const colW=n==1?420:Math.min(300,(RL-262)/(n-0.65)),cwd=Math.max(colW*n,colW*(n-0.65)+222),x0=40+(RL-40-cwd)/2,cx=i=>x0+colW*(i+0.35); // column = power line; labels to its right
const Y={ceb:40,cd:124,cp:184,eb:222,ld:176,ar:262,gTop:254,gb:300,gBot:330,fd:356,c1:404,c0:500,node:540,tx:596,lvc0:640,lvTop:700,ct:742,cb:768,bus:842,lvBot:874};
const bL=cx(0)-30,bR=cx(n-1)+30,xsw=bR+60,xod=bR+140,gR=xod+44,mR=Math.max(x0+colW*n-4,gR+14);
// scope boxes
R(x0+4,Y.gTop-26,mR-x0-4,Y.lvTop-Y.gTop+12,MV,1.8,'10 5');T(mR-10,Y.gTop-10,'REGEN MV SCOPE',13,'end','bold',MV);
R(x0+30,Y.gTop,gR-x0-30,Y.gBot-Y.gTop,GR,1.4,'6 4');T(x0+38,Y.gTop+16,(M.gantry||'Medium voltage gantry').toUpperCase(),10,'start','bold');
T(x0+4,Y.lvBot+20,'REGEN LV SCOPE (see the LV SLD)',11,'start','bold');T(mR+14,Y.gb+30,UT.toUpperCase()+' SCOPE',11,'start','bold');
// gantry busbar -> LBS / ABS -> DDLO -> utility: auto recloser -> utility busbar (site load via DDLO) -> CT / PT metering -> DDLO -> network
L(bL,Y.gb,bR,Y.gb,MV,5);T(bL,Y.gb-9,`${kv} kV BUSBAR`,9,'start','bold');
L(bR,Y.gb,xsw-24,Y.gb,MV);if(M.sw=='none')L(xsw-24,Y.gb,xsw+24,Y.gb,MV);else{swH(xsw,Y.gb,MV,M.sw!='abs');T(xsw,Y.gb+16,M.swL||((M.sw=='abs'?'ABS ':'LBS ')+kv+' kV'),8,'middle','bold')}
L(xsw+24,Y.gb,xod-30,Y.gb,MV);ddloH(xod,Y.gb,MV);T(xod,Y.gb+16,'DDLO '+kv+' kV',8,'middle','bold');L(xod+30,Y.gb,xE,Y.gb,MV);
L(xE,Y.gb,xE,Y.ar+30,MV);arV(xE,Y.ar,MV);T(xE+26,Y.ar+2,'AUTO',8,'start','bold');T(xE+26,Y.ar+13,'RECLOSER',8,'start','bold');L(xE,Y.ar-30,xE,Y.eb,MV);
L(xE-30,Y.eb,xE+110,Y.eb,MV,5);T(xE+8,Y.eb+17,UT.toUpperCase()+' '+kv+' kV BUSBAR',8,'start','bold');
if(M.load){const xl=xE+90;L(xl,Y.eb,xl,Y.ld+30,MV);C(xl,Y.eb,2.6,MV,1,MV);ddloV(xl,Y.ld,MV);T(xl+14,Y.ld+4,M.loadDdlo||('DDLO '+kv+' kV'),8,'start','bold');L(xl,Y.ld-30,xl,Y.ld-42,MV);
 PG([[xl,Y.ld-58],[xl-7,Y.ld-42],[xl+7,Y.ld-42]],BK,BK,1);T(xl+12,Y.ld-46,String(M.load).toUpperCase(),8.5,'start','bold')} // site load, fed from the utility gantry
L(xE,Y.eb,xE,Y.cp+24,MV);ctptV(xE,Y.cp,MV);T(xE-16,Y.cp-2,'CT / PT',8,'end','bold');T(xE-16,Y.cp+9,'('+UT.toUpperCase()+' METERING)',7.5,'end');L(xE,Y.cp-24,xE,Y.cd+30,MV);
ddloV(xE,Y.cd,MV);T(xE-14,Y.cd+4,M.cebDdlo||('DDLO '+kv+' kV ('+UT+')'),8,'end','bold');L(xE,Y.cd-30,xE,Y.ceb+48,MV);
R(xE-70,Y.ceb,140,48,BK,1.6);const cw=wrw(M.ceb||(UT+' '+kv+' kV network'),14);cw.forEach((q,j)=>T(xE,Y.ceb+24-(cw.length-1)*6+4+j*12,q.toUpperCase(),10,'middle','bold'));
list.forEach((r,i)=>{const x=cx(i),xt=x+16;
 // feeder DDLO + MV cable (sealing ends) from the transformer up to the gantry busbar
 L(x,Y.gb,x,Y.fd-30,MV);C(x,Y.gb,2.6,MV,1,MV);ddloV(x,Y.fd,MV);T(xt,Y.fd+4,r.ddlo||('DDLO '+kv+' kV'),8,'start','bold');
 L(x,Y.fd+30,x,Y.c1,MV);seV(x,Y.c1,1);L(x,Y.c1+10,x,Y.c0-10,MV,2.2);seV(x,Y.c0,-1);L(x,Y.c0,x,Y.tx-32,MV);
 const mc=['MV CABLE'].concat(wr(r.mvc||'MV cable',Math.floor((colW-40)/(0.56*9.6))),['L = '+(r.len?r.len+' m':'— m'),`MV ${(+r.hvI||0).toFixed(1)} A`]);mc.forEach((q,j)=>T(xt,Y.c1+20+j*12,q,8,'start',j?'normal':'bold'));
 // NVD VT (right) and surge arrester (left) at the transformer HV terminal
 if(nvdOn){L(x,Y.node,x+20,Y.node,MV);vtH(x+28,Y.node);T(x+50,Y.node-4,'NVD TRANSFORMER (VT)',7.5,'start','bold');T(x+50,Y.node+8,M.nvd||kv+'/0.11 kV',7.5,'start')}
 L(x,Y.node,x-24,Y.node,MV);L(x-24,Y.node,x-24,Y.node+4,MV);saV(x-24,Y.node+4);L(x-24,Y.node+28,x-24,Y.node+32,GR,1.3);earth(x-24,Y.node+32);
 T(x-36,Y.node-6,'SA',8,'end','bold');
 // step-up transformer
 const sgx=x+colW*0.65-14,tl=[`STEP-UP TRANSFORMER`,`${r.kva} kVA · 0.4/${kv} kV`,M.vg||'Dyn11'],tw=q=>q.length*0.64*10.2; // narrow columns: four short lines, clear of the VT signal line (sgx)
 txV(x,Y.tx);(Math.max(...tl.map(tw))+x+26>sgx-6?['STEP-UP','TRANSFORMER',`${r.kva} kVA`,`0.4/${kv} kV · ${M.vg||'Dyn11'}`]:tl).forEach((q,j,a)=>T(x+26,Y.tx-8-(a.length>3?6:0)+j*12,q,8.5,'start',j<a.length-2&&(a.length>3||!j)?'bold':'normal'));
 // LV cable from the LV panel up to the transformer
 L(x,Y.tx+32,x,Y.lvTop,OR);const lv=wr(r.lvc||'LV cable',Math.floor(Math.min(colW-40,(nvdOn?sgx-6:1e9)-x-16)/(0.56*9.6)));lv.concat([`LV ${(+r.lvI||0).toFixed(0)} A`]).forEach((q,j)=>T(xt,Y.lvc0+4+j*12,q,8,'start'));
 // LV panel: busbar -> breaker -> CT -> out (up); power analyzer + protection relay to the right
 R(x-84,Y.lvTop,colW-10,Y.lvBot-Y.lvTop,BK,1.1,'6 4');const st=String(r.src||'LV panel').toUpperCase();T(x-78,Y.lvBot-8,st.length>34?st.slice(0,33)+'…':st,8.5,'start','bold');
 L(x-44,Y.bus,x+44,Y.bus,OR,5);T(x+50,Y.bus+4,'LV BUSBAR',7.5,'start','bold');L(x,Y.bus,x,Y.cb+52,OR);cbV(x,Y.cb,OR);L(x,Y.cb,x,Y.ct+7,OR);ctV(x,Y.ct,OR);L(x,Y.ct-7,x,Y.lvTop,OR);
 T(x-10,Y.cb+30,r.brk?`4P ${r.brk}A`:'LV breaker',8.5,'end','bold');if(r.brk)T(x-10,Y.cb+42,BT(+r.brk,r.lvI),7.5,'end');T(x-12,Y.ct+4,'CT',8,'end');
 const bx=x+40,pa=[bx,Y.ct-12],pr=[bx,Y.ct+22];R(pa[0],pa[1],96,22);T(pa[0]+48,pa[1]+15,'POWER ANALYZER',7,'middle','bold');R(pr[0],pr[1],96,30);T(pr[0]+48,pr[1]+12,'PROTECTION RELAY',7,'middle','bold');T(pr[0]+48,pr[1]+24,'('+MVRF().replace(/\//g,' / ')+')',6,'middle');
 L(x+7,Y.ct,bx,Y.ct,BK,1,'3 2');L(pr[0],pr[1]+22,x+12,pr[1]+22,BK,1,'4 3');L(x+12,pr[1]+22,x+12,Y.cb+24,BK,1,'4 3');L(x+12,Y.cb+24,x+6,Y.cb+24,BK,1,'4 3'); // CT -> analyzer, relay trip -> breaker
 const sg=x+colW*0.65-14; /* VT signal runs at the right of the column, clear of the transformer / cable labels */if(nvdOn){L(pr[0]+96,pr[1]+8,sg,pr[1]+8,BK,1,'4 3');L(sg,pr[1]+8,sg,Y.node+16,BK,1,'4 3');L(sg,Y.node+16,x+40,Y.node+16,BK,1,'4 3');L(x+40,Y.node+16,x+40,Y.node+8,BK,1,'4 3')} // VT -> relay
});
// legend + transformer schedule (top corners)
const LG=[[OR,'LV AC (0.4 kV)',''],[MV,`MV AC (${kv} kV)`,''],[BK,'Protection / signal','4 3'],[GR,'Earthing','']];
const lx=W-200,ly=Y.lvBot-50;LG.forEach(([c,l,d],j)=>{L(lx,ly+j*16,lx+40,ly+j*16,c,2,d);T(lx+50,ly+4+j*16,l,10)});
const tx0=24,ty0=70,cols=[26,150,50,50,52],tw=cols.reduce((a,b)=>a+b,0),rh=14,nr=Math.min(list.length,6);
T(tx0+4,ty0-6+14,'',1);T(tx0,ty0+8,'TRANSFORMER SCHEDULE',10,'start','bold');const tt=ty0+14;R(tx0,tt,tw,rh*(nr+1),BK,1);
let c0=tx0;['No','LV source','kVA','LV A','MV A'].forEach((h,j)=>{if(j)L(c0,tt,c0,tt+rh*(nr+1),BK,0.8);T(c0+4,tt+10.5,h,7.5,'start','bold');c0+=cols[j]});L(tx0,tt+rh,tx0+tw,tt+rh,BK,1);
list.slice(0,nr).forEach((r,i)=>{let cx2=tx0;const yy=tt+rh*(i+2)-3.5,src=String(r.src||'');[String(i+1),src.length>24?src.slice(0,23)+'…':src,r.kva,(+r.lvI||0).toFixed(0),(+r.hvI||0).toFixed(1)].forEach((q,j)=>{T(cx2+4,yy,q,7.5);cx2+=cols[j]});if(i)L(tx0,tt+rh*(i+1),tx0+tw,tt+rh*(i+1),BK,0.4)});
const rf=wr(M.relayF||'',52);T(tx0+tw+16,tt+10,'Protection relay functions:',8,'start','bold');rf.forEach((q,j)=>T(tx0+tw+16,tt+22+j*11,q,8));
// sheet
s.unshift('<g data-layer="DIAGRAM">');s.push('</g>');
s.push(`<rect x="4" y="4" width="${W-8}" height="${A4H-8}" fill="none" stroke="#000" stroke-width="2"/>`);s.push(FRAME(W));
s.push(`<text xml:space="preserve" x="28" y="42" font-size="15" text-anchor="start" font-weight="bold" fill="#000">${esc('SINGLE LINE DIAGRAM — MV SCOPE — '+g('opt'))}</text>`);
const wp=+g('modWp')||0,qty=INV.concat(V.loc2on?INV2:[]).reduce((a,i)=>a+i.mods,0),kwp=KWP().toFixed(2),kva=list.reduce((a,r)=>a+(+r.kva||0),0);
TB(s,W,wp,qty,kwp,TITLE(kwp),'SINGLE LINE DIAGRAM — MV SCOPE',`MV connection: ${kv} kV, ${list.length} × step-up transformer (${kva} kVA)`);
return page(s.join(''))}
// ===== Inverter detail SLD (one inverter / BESS PCS per sheet): PV strings grouped per MPPT (each '+' group of the Strings field = one MPPT,
// e.g. 18x2 = two strings of 18 modules), DC cables, external DC isolators / DC SPDs (Protection tab), the inverter's built-in DC switch,
// DC SPD, MPPT trackers, DC link, DC/AC bridge and AC SPD, integrated battery (hybrid), AC cable, its breaker in the switchgear panel and the earthing. =====
function renderInv(sel){
const W=A4W,s=[],OR='#d9822b',BL='#1f6fd0',GR='#0a7a2f',MG='#a020a0',BK='#000';
const T=(x,y,str,sz=10,a='start',w='normal',fill='#000')=>s.push(`<text xml:space="preserve" x="${(+x).toFixed(1)}" y="${(+y).toFixed(1)}" font-size="${(+sz).toFixed(2)}" text-anchor="${a}" font-weight="${w}" fill="${fill}">${esc(str)}</text>`);
const L=(a,b,c,d,col=BK,w=1.5,da='')=>s.push(`<line x1="${(+a).toFixed(1)}" y1="${(+b).toFixed(1)}" x2="${(+c).toFixed(1)}" y2="${(+d).toFixed(1)}" stroke="${col}" stroke-width="${w}"${da?` stroke-dasharray="${da}"`:''}/>`);
const R=(x,y,w,h,col=BK,sw=1.3,da='',fill='none')=>s.push(`<rect x="${(+x).toFixed(1)}" y="${(+y).toFixed(1)}" width="${(+w).toFixed(1)}" height="${(+h).toFixed(1)}" fill="${fill}" stroke="${col}" stroke-width="${sw}"${da?` stroke-dasharray="${da}"`:''}/>`);
const C=(x,y,r,col=BK,sw=1.3,fill='none')=>s.push(`<circle cx="${(+x).toFixed(1)}" cy="${(+y).toFixed(1)}" r="${r}" fill="${fill}" stroke="${col}" stroke-width="${sw}"/>`);
const dot=(x,y,col)=>C(x,y,2.4,col,1,col);
const es=(x,y,col=GR,k=1)=>{L(x,y,x,y+6*k,col);L(x-8*k,y+6*k,x+8*k,y+6*k,col,1.8);L(x-5*k,y+9.5*k,x+5*k,y+9.5*k,col,1.8);L(x-2*k,y+13*k,x+2*k,y+13*k,col,1.8)};
const wrw=(q,n)=>{const o=[];let c='';String(q).split(' ').forEach(w=>{if(c&&(c+' '+w).length>n){o.push(c);c=w}else c=c?c+' '+w:w});if(c)o.push(c);return o};
// ---- which unit ----
const L2=!!V.loc2on,all=[];
INV.forEach((u,i)=>all.push({u:{...u,kind:'inv'},loc:1,no:i+1}));BESS.forEach((u,i)=>all.push({u:{...u,kind:'bess'},loc:1,no:i+1}));
if(L2){INV2.forEach((u,i)=>all.push({u:{...u,kind:'inv'},loc:2,no:i+1}));BESS2.forEach((u,i)=>all.push({u:{...u,kind:'bess'},loc:2,no:i+1}))}
const it=all[Math.max(0,Math.min(all.length-1,+sel||0))];if(!it)return page('');
const u=it.u,B=u.kind=='bess',wp=UW(u),locN=it.loc==2?(V.loc2name||'Location 2'):'',
 utag=(B?'BESS PCS ':'INVERTER ')+it.no+(L2?` (${it.loc==2?locN:'Location 1'})`:''),
 pnl=it.loc==2?`${String(locN).toUpperCase()} SWITCHGEAR PANEL ${V.loc2panel||''}A`:`${L2?'LOCATION 1 — ':''}MAIN SWITCHGEAR PANEL ${g('panel')}A`,bus=it.loc==2?V.loc2bus:g('bus');
const dcIso=!!g('dcIso'),dcSpd=!!g('dcSpd'),hasBat=!B&&u.hybrid&&+u.battKwh>0,gp=!B&&md()=='hy'&&it.loc==1&&u.hybrid&&u.gp;
// ---- MPPTs / strings ----
let grp=B?[]:String(u.cfg||'').split('+').map(q=>q.trim()).filter(Boolean).map(q=>{const m=q.match(/^(\d+)\s*[x×*]\s*(\d+)$/);return m?{n:+m[1],k:+m[2]}:{n:parseInt(q)||0,k:1}}).filter(q=>q.n>0&&q.k>0);
if(!B&&!grp.length&&+u.mods>0)grp=[{n:+u.mods,k:1}];
const hideS=HS();if(hideS)grp=grp.map(q=>({n:q.n*q.k,k:1})); // string details hidden: one PV array per MPPT, no per-string module counts
const rows=[];grp.forEach((q,mi)=>{for(let j=0;j<q.k;j++)rows.push({mi,j,n:q.n})});
const m=grp.length,S=rows.length,yA=150,yB=hasBat?730:850,un=Math.max(1,S+(m-1)*0.6),p=Math.min(64,(yB-yA)/un),fs=Math.min(1.25,p/34);
const y0=(yA+yB)/2-p*un/2+p/2;rows.forEach((r,k)=>r.y=y0+(k+r.mi*0.6)*p);
const ym=grp.map((q,mi)=>{const rr=rows.filter(r=>r.mi==mi);return (rr[0].y+rr[rr.length-1].y)/2});
const yc=S?(ym[0]+ym[m-1])/2:(yA+yB)/2;
// ---- x positions ----
const XE=40,XM=62,XD=250,XI=420,XS=540,XSE=585,X1=720,JX=742,XW=776,XP=814,XT=842,XL=914,XB=935,XA=1028,X2=1060,PX1=1200,PX2=1560,XC=1290,XBB=1420;
const gpY=yc+56,pTop=yc-84,pBot=yc+(gp?132:96),yE=pBot-16;
const top=S?Math.min(rows[0].y-50,yc-90):yc-90,bot=Math.max(S?rows[S-1].y+30:0,yc+80,yE+22);
// ---- header ----
s.push(`<text xml:space="preserve" x="28" y="42" font-size="15" text-anchor="start" font-weight="bold" fill="#000">${esc('SINGLE LINE DIAGRAM — '+utag+' DETAIL — '+g('opt'))}</text>`);
const LG=[[BL,'DC (PV / battery)',''],[OR,'AC (0.4 kV)',''],[MG,'Surge protection (SPD)',''],[GR,'Earthing','']];LG.forEach(([c,l,d],j)=>{L(1390,34+j*15,1428,34+j*15,c,2,d);T(1436,38+j*15,l,9.5)});
if(S){T(XM,yA-44,'PV STRINGS',11,'start','bold');T(XM,yA-30,`${u.mods} × ${wp} Wp · ${(u.mods*wp/1000).toFixed(2)} kWp`,9.5);T(XM,yA-18,hideS?`${m} MPPT${m>1?'s':''}`:`${S} string${S>1?'s':''} on ${m} MPPT${m>1?'s':''}`,9.5);
 T(XD,yA-44,hideS?'DC CABLE':'DC CABLE (each string)',11,'start','bold');wrw(u.dc||'DC cable',24).forEach((q,j)=>T(XD,yA-30+j*12,q,9.5));
 if(dcIso){T(XI,yA-44,'DC ISOLATOR',11,'middle','bold');T(XI,yA-30,g('dcIsoTxt')||'',9.5,'middle')}
 if(dcSpd){T(XS+8,yA-44,'DC SPD',11,'middle','bold');T(XS+8,yA-30,g('dcSpdTxt')||'',9.5,'middle')}}
// ---- PV strings ----
const mod=(x,y,h)=>{R(x,y-h/2,26,h,BK,1.1,'','#fff');L(x+8.7,y-h/2,x+8.7,y+h/2,BK,0.6);L(x+17.3,y-h/2,x+17.3,y+h/2,BK,0.6);L(x,y,x+26,y,BK,0.6)};
const isoH=(x,y)=>{L(x-14,y,x-10,y,BL,1.5);C(x-10,y,2,BK,1.1,'#fff');L(x-10,y,x+10,y-10*Math.min(1,fs+0.1),BK,1.5);L(x+12,y-5,x+12,y+5,BK,1.5);L(x+12,y,x+14,y,BL,1.5)}; // disconnector (blade + bar)
const spdD=(x,y,h,col=MG)=>{dot(x,y,BL);L(x,y,x,y+3,col,1.2);R(x-5,y+3,10,h,col,1.2);L(x-2.5,y+3+h*0.3,x+2.5,y+3+h*0.5,col,1);L(x+2.5,y+3+h*0.5,x-2.5,y+3+h*0.7,col,1)};
if(S){const mh=Math.min(22,p*0.5);
 rows.forEach((r,k)=>{const y=r.y;mod(XM,y,mh);L(XM+26,y,XM+32,y,BL,1.2);mod(XM+32,y,mh);T(XM+64+8,y+3,'…',10,'middle','bold');mod(XM+80,y,mh);L(XM+58,y,XM+62,y,BL,1.2);L(XM+76,y,XM+80,y,BL,1.2);
  T(XM,y-mh/2-4,hideS?`PV ARRAY ${r.mi+1}`:`S${r.mi+1}.${r.j+1}`,9*Math.max(0.85,fs),'start','bold');T(XM+(hideS?62:30)*Math.max(1,fs),y-mh/2-4,hideS?`${(r.n*wp/1000).toFixed(2)} kWp`:`${r.n} × ${wp} Wp · ${(r.n*wp/1000).toFixed(2)} kWp`,8.5*Math.max(0.85,fs),'start');
  L(XE,y+mh/2-3,XM,y+mh/2-3,GR,1,'4 2'); // module frame earth
  const xs=XM+106;if(dcIso){L(xs,y,XI-14,y,BL);isoH(XI,y);L(XI+14,y,X1,y,BL)}else L(xs,y,X1,y,BL);
  if(dcSpd){const h=Math.max(7,Math.min(14,p-17));spdD(XS,y,h);L(XS,y+3+h,XS,y+5+h,MG,1.2);L(XS,y+5+h,XSE,y+5+h,GR,1)}});
 const yl=rows[S-1].y;L(XE,rows[0].y-6,XE,yl+40,GR,1.5);es(XE,yl+40);T(XE+14,yl+48,`PV array frame earth — ${g('pvEarth')||'4mm² Cu'}`,8.5);
 if(dcSpd){L(XSE,rows[0].y+8,XSE,yl+40,GR,1.5);es(XSE,yl+40);T(XSE+14,yl+48,'DC SPD earth',8.5)}}
// ---- inverter / PCS enclosure ----
R(X1,top,X2-X1,bot-top,BK,1.6);T(X1,top-8,`${utag} — ${B?(u.model||'BESS PCS'):u.name}`,11,'start','bold');T(X2,top-8,`${u.kw} kW · ${(+u.I).toFixed(1)} A AC`,10,'end','bold');
const bridge=(x,y)=>{R(x,y-25,60,50,BK,1.4,'','#fff');L(x,y+25,x+60,y-25,BK,1);T(x+15,y-6,'=',13,'middle');T(x+45,y+19,'~',13,'middle')};
if(S){T(XW,top+15,'DC SWITCH',8.5,'middle','bold');T(XP,top+28,'DC SPD',8.5,'middle','bold');T(XT+25,top+15,'MPPT',8.5,'middle','bold');T(XL,top+28,'DC LINK',8.5,'middle','bold');wrw('Built-in (inverter data sheet): DC switch, DC SPD Type II, AC SPD Type II',hasBat?38:90).forEach((q,j)=>T(X1,bot+16+j*11,q,8.5));
 grp.forEach((q,mi)=>{const rr=rows.filter(r=>r.mi==mi),y=ym[mi];rr.forEach(r=>L(X1,r.y,JX,r.y,BL));if(rr.length>1){L(JX,rr[0].y,JX,rr[rr.length-1].y,BL);dot(JX,y,BL)}
  L(JX,y,XW-14,y,BL);isoH(XW,y);L(XW+14,y,XT,y,BL);const gap=mi<m-1?ym[mi+1]-y:bot-y,h=Math.max(6,Math.min(10,gap-24));if(gap>18){spdD(XP,y,h);if(gap>=h+20)es(XP,y+3+h,GR,0.75)}
  const bh=Math.min(26,p*0.6);R(XT,y-bh/2,50,bh,BK,1.2,'','#fff');T(XT+25,y+3.5,'MPPT '+(mi+1),8*Math.max(0.85,Math.min(1.15,fs)),'middle','bold');L(XT+50,y,XL,y,BL);if(m>1)dot(XL,y,BL)});
 L(XL,Math.min(ym[0],yc),XL,hasBat?bot:Math.max(ym[m-1],yc),BL,2.4)}
else if(B){ // standalone BESS: battery -> DC cable -> PCS
 const bx=300;R(bx,yc-35,110,70);[[-14,26],[-7,13],[0,26],[7,13]].forEach(([d,w],j)=>L(bx+55-w,yc+d,bx+55+w,yc+d,BK,j%2?4:1.5));T(bx+55,yc+52,`BATTERY ${u.kwh||''} kWh`,9,'middle','bold');
 L(bx+110,yc,XL,yc,BL,2);T((bx+110+X1)/2,yc-8,u.dc||'DC cable',9,'middle');T(X1+10,top+14,'Bi-directional PCS',8,'start','bold')}
bridge(XB,yc);L(XL,yc,XB,yc,BL,2);T(XB+30,yc-31,'DC / AC',8.5,'middle','bold');L(XB+60,yc,X2,yc,OR,2);
dot(XA,yc,OR);L(XA,yc,XA,yc+4,MG,1.2);R(XA-5,yc+4,10,13,MG,1.2);es(XA,yc+17,GR,0.75);T(XA,yc-8,'AC SPD',8.5,'middle','bold');
if(hasBat){const by=bot+52;T(XL+8,bot+36,u.battDc||'Battery DC cable',8.5);L(XL,bot,XL,by,BL,2);R(XL-50,by,100,56);[[12,26],[19,13],[26,26],[33,13]].forEach(([d,w],j)=>L(XL-w,by+d,XL+w,by+d,BK,j%2?4:1.5));
 T(XL,by+49,`${u.battKwh} kWh`,8.5,'middle');T(XL+58,by+30,'INTEGRATED BATTERY',9,'start','bold');T(XL+58,by+42,'(battery DC port)',8,'start');L(XL-50,by+46,XL-74,by+46,GR,1,'4 2');es(XL-74,by+46,GR,0.8)}
if(gp){L(XB+48,yc+25,XB+48,gpY,OR);L(XB+48,gpY,X2,gpY,OR);T(X2-6,gpY-6,'GRID PORT',7.5,'end','bold')}
// ---- AC cable + switchgear panel ----
const acl=wslash(u.ac,24);acl.forEach((q,j)=>T((X2+PX1)/2,yc-8-(acl.length-1-j)*11,q,9,'middle'));T((X2+PX1)/2,yc+15,`I = ${(+u.I).toFixed(1)} A`,8.5,'middle');L(X2,yc,XC-24,yc,OR,2);
R(PX1,pTop,PX2-PX1,pBot-pTop,BK,1.3,'8 4');T(PX1,pTop-8,pnl,11,'start','bold');T(PX2-8,pTop+16,g(it.loc==2?'ipL2':'ipMain')=='IP66'?'IP66 (OUTDOOR)':'IP54 (INDOOR)',8.5,'end','bold');
const cbH=(x,y)=>{L(x-24,y,x-8,y,OR,2);L(x+8,y,x+24,y,OR,2);L(x-8,y,x+8,y-11,BK,1.6);L(x+5,y-3,x+11,y+3,BK,1.3);L(x+5,y+3,x+11,y-3,BK,1.3)};
cbH(XC,yc);T(XC,yc+18,`${u.poles||'4P'} ${u.mccb}A`,10,'middle','bold');T(XC,yc+30,BT(u.mccb,u.I),8.5,'middle');L(XC+24,yc,XBB,yc,OR,2);dot(XBB,yc,OR);
L(XBB,pTop+22,XBB,gp?yc+34:pBot-34,OR,6);T(XBB+10,pTop+34,'COMMON COUPLING',8.5,'start','bold');T(XBB+10,pTop+45,`BUSBAR ${bus}A`,8.5,'start','bold');T(XBB+10,yc+22,'to the other feeders',8,'start');T(XBB+10,yc+32,'(see the main SLD)',8,'start');
if(gp){L(X2,gpY,XC-24,gpY,OR,2);cbH(XC,gpY);T(XC,gpY+18,`${u.poles||'4P'} ${u.gp.mccb}A`,10,'middle','bold');T(XC,gpY+30,BT(u.gp.mccb,u.gp.I)+' · GRID PORT',8.5,'middle');L(XC+24,gpY,PX2-14,gpY,OR,2);
 s.push(`<polygon points="${PX2-14},${gpY-5} ${PX2-14},${gpY+5} ${PX2-4},${gpY}" fill="#000"/>`);T(PX2-18,gpY-6,'from grid supply (ATS)',8,'end');const gl=wslash(u.gp.ac,24);gl.forEach((q,j)=>T((X2+PX1)/2,gpY-6-(gl.length-1-j)*11,q,8.5,'middle'))}
// earthing: inverter PE -> panel earth bar -> earth pit
L(X2,yE,PX1+60,yE,GR,1.5,'5 3');T((X2+PX1)/2,yE-5,u.earth||'Earth cable',8.5,'middle');L(PX1+16,yE,PX1+84,yE,GR,3);T(PX1+16,yE-6,'PANEL EARTH BAR',7.5,'start','bold');L(PX1+50,yE,PX1+50,pBot+14,GR,1.5);es(PX1+50,pBot+14);
// ---- MPPT schedule ----
if(S&&!hideS){const tx=PX1,tw=PX2-PX1,ty=pBot+62,cols=[0.18,0.17,0.25,0.2,0.2],hd=['MPPT','Strings','Modules / string','Modules','kWp'],rh=Math.max(11,Math.min(15,(FB-60-ty)/(m+2)));
 T(tx,ty-7,'MPPT / STRING SCHEDULE',10,'start','bold');R(tx,ty,tw,rh*(m+2),BK,1);let cx=tx;cols.forEach((c,j)=>{if(j)L(cx,ty,cx,ty+rh*(m+2),BK,0.7);T(cx+4,ty+rh*0.72,hd[j],8,'start','bold');cx+=c*tw});L(tx,ty+rh,tx+tw,ty+rh,BK,1);
 grp.concat([{tot:1}]).forEach((q,i)=>{const yy=ty+rh*(i+1);if(i)L(tx,yy,tx+tw,yy,BK,q.tot?1:0.4);let c2=tx;const v=q.tot?['Total',String(S),'—',String(u.mods),(u.mods*wp/1000).toFixed(2)]:[String(i+1),String(q.k),String(q.n),String(q.n*q.k),(q.n*q.k*wp/1000).toFixed(2)];
  v.forEach((z,j)=>{T(c2+4,yy+rh*0.72,z,8,'start',q.tot?'bold':'normal');c2+=cols[j]*tw})});
 const sum=grp.reduce((a,q)=>a+q.n*q.k,0);if(sum!=+u.mods)T(tx,ty+rh*(m+2)+14,`Note: the strings add up to ${sum} modules, the inverter card says ${u.mods}.`,8.5,'start','bold')}
// ---- sheet ----
s.unshift('<g data-layer="DIAGRAM">');s.push('</g>');
s.push(`<rect x="4" y="4" width="${W-8}" height="${A4H-8}" fill="none" stroke="#000" stroke-width="2"/>`);s.push(FRAME(W));
const qty=ALLI().reduce((a,i)=>a+i.mods,0),kwp=KWP().toFixed(2);
TB(s,W,wp,qty,kwp,TITLE(kwp),'SINGLE LINE DIAGRAM — '+utag+' DETAIL',B?`${u.kw} kW PCS · ${u.kwh} kWh`:`${u.name} · ${u.kw} kW · ${hideS?'':S+' strings / '}${m} MPPT${m>1?'s':''}`);
return page(s.join(''))}
// ===== Inverter detail SLD — bottom -> up layout (same direction as the main SLD): PV strings at the bottom, DC cables / external DC isolators /
// DC SPDs above them, the inverter (built-in DC switch, DC SPD, MPPTs, DC link, DC/AC, AC SPD) in the middle, its AC cable up to the breaker in the switchgear panel at the top. =====
function renderInvV(sel){
const W=A4W,s=[],OR='#d9822b',BL='#1f6fd0',GR='#0a7a2f',MG='#a020a0',BK='#000';
const T=(x,y,str,sz=10,a='start',w='normal',fill='#000')=>s.push(`<text xml:space="preserve" x="${(+x).toFixed(1)}" y="${(+y).toFixed(1)}" font-size="${(+sz).toFixed(2)}" text-anchor="${a}" font-weight="${w}" fill="${fill}">${esc(str)}</text>`);
const L=(a,b,c,d,col=BK,w=1.5,da='')=>s.push(`<line x1="${(+a).toFixed(1)}" y1="${(+b).toFixed(1)}" x2="${(+c).toFixed(1)}" y2="${(+d).toFixed(1)}" stroke="${col}" stroke-width="${w}"${da?` stroke-dasharray="${da}"`:''}/>`);
const R=(x,y,w,h,col=BK,sw=1.3,da='',fill='none')=>s.push(`<rect x="${(+x).toFixed(1)}" y="${(+y).toFixed(1)}" width="${(+w).toFixed(1)}" height="${(+h).toFixed(1)}" fill="${fill}" stroke="${col}" stroke-width="${sw}"${da?` stroke-dasharray="${da}"`:''}/>`);
const C=(x,y,r,col=BK,sw=1.3,fill='none')=>s.push(`<circle cx="${(+x).toFixed(1)}" cy="${(+y).toFixed(1)}" r="${r}" fill="${fill}" stroke="${col}" stroke-width="${sw}"/>`);
const dot=(x,y,col)=>C(x,y,2.4,col,1,col);
const es=(x,y,col=GR,k=1)=>{L(x,y,x,y+6*k,col);L(x-8*k,y+6*k,x+8*k,y+6*k,col,1.8);L(x-5*k,y+9.5*k,x+5*k,y+9.5*k,col,1.8);L(x-2*k,y+13*k,x+2*k,y+13*k,col,1.8)};
const wrw=(q,n)=>{const o=[];let c='';String(q).split(' ').forEach(w=>{if(c&&(c+' '+w).length>n){o.push(c);c=w}else c=c?c+' '+w:w});if(c)o.push(c);return o};
const L2=!!V.loc2on,all=[];
INV.forEach((u,i)=>all.push({u:{...u,kind:'inv'},loc:1,no:i+1}));BESS.forEach((u,i)=>all.push({u:{...u,kind:'bess'},loc:1,no:i+1}));
if(L2){INV2.forEach((u,i)=>all.push({u:{...u,kind:'inv'},loc:2,no:i+1}));BESS2.forEach((u,i)=>all.push({u:{...u,kind:'bess'},loc:2,no:i+1}))}
const it=all[Math.max(0,Math.min(all.length-1,+sel||0))];if(!it)return page('');
const u=it.u,B=u.kind=='bess',wp=UW(u),locN=it.loc==2?(V.loc2name||'Location 2'):'',
 utag=(B?'BESS PCS ':'INVERTER ')+it.no+(L2?` (${it.loc==2?locN:'Location 1'})`:''),
 pnl=it.loc==2?`${String(locN).toUpperCase()} SWITCHGEAR PANEL ${V.loc2panel||''}A`:`${L2?'LOCATION 1 — ':''}MAIN SWITCHGEAR PANEL ${g('panel')}A`,bus=it.loc==2?V.loc2bus:g('bus');
const dcIso=!!g('dcIso'),dcSpd=!!g('dcSpd'),hasBat=!B&&u.hybrid&&+u.battKwh>0,gp=!B&&md()=='hy'&&it.loc==1&&u.hybrid&&u.gp;
let grp=B?[]:String(u.cfg||'').split('+').map(q=>q.trim()).filter(Boolean).map(q=>{const m=q.match(/^(\d+)\s*[x×*]\s*(\d+)$/);return m?{n:+m[1],k:+m[2]}:{n:parseInt(q)||0,k:1}}).filter(q=>q.n>0&&q.k>0);
if(!B&&!grp.length&&+u.mods>0)grp=[{n:+u.mods,k:1}];
const hideS=HS();if(hideS)grp=grp.map(q=>({n:q.n*q.k,k:1})); // string details hidden: one PV array per MPPT, no per-string module counts
const cols=[];grp.forEach((q,mi)=>{for(let j=0;j<q.k;j++)cols.push({mi,j,n:q.n})});
const m=grp.length,S=cols.length,xA=200,xB=1150,un=Math.max(1,S+(m-1)*0.6),q=Math.min(110,(xB-xA)/un),fs=Math.min(1.15,q/60);
const x0=(xA+xB)/2-q*un/2+q/2;cols.forEach((c,k)=>c.x=x0+(k+c.mi*0.6)*q);
const xm=grp.map((g0,mi)=>{const cc=cols.filter(c=>c.mi==mi);return (cc[0].x+cc[cc.length-1].x)/2});
const xc=S?(xm[0]+xm[m-1])/2:(xA+xB)/2;
// levels (y), from the top of the sheet down
const Y={pTop:62,bus:100,cb:128,pBot:228,top:290,acspd:310,br:372,link:420,mp:456,ispd:490,sw:530,join:568,bot:584,spd:620,spe:650,iso:704,dcl:760,mod:790,lab:886,ebus:912};
const bL=Math.min(S?cols[0].x-40:xc-250,xc-250),bR=Math.max(S?cols[S-1].x+40:xc+250,xc+250,S?Math.max(xm[m-1],xc)+66:0); // room for the 'DC LINK' label inside the enclosure
s.push(`<text xml:space="preserve" x="28" y="42" font-size="15" text-anchor="start" font-weight="bold" fill="#000">${esc('SINGLE LINE DIAGRAM — '+utag+' DETAIL — '+g('opt'))}</text>`);
const LG=[[BL,'DC (PV / battery)',''],[OR,'AC (0.4 kV)',''],[MG,'Surge protection (SPD)',''],[GR,'Earthing','']];LG.forEach(([c,l,d],j)=>{L(1390,34+j*15,1428,34+j*15,c,2,d);T(1436,38+j*15,l,9.5)});
const LV=(y,a,b)=>{T(28,y,a,10,'start','bold');if(b)wrw(b,22).forEach((z,j)=>T(28,y+12+j*11,z,8.5))};
if(S){LV(Y.mod+14,hideS?'PV ARRAYS':'PV STRINGS',`${u.mods} × ${wp} Wp · ${(u.mods*wp/1000).toFixed(2)} kWp, ${hideS?'':S+' string'+(S>1?'s':'')+' / '}${m} MPPT${m>1?'s':''}`);LV(Y.dcl-4,'DC CABLE',(u.dc||'DC cable')+(hideS?'':' (each string)'));
 if(dcIso)LV(Y.iso,'DC ISOLATOR',g('dcIsoTxt'));if(dcSpd)LV(Y.spd,'DC SPD',g('dcSpdTxt'));
 LV(Y.sw+4,'DC SWITCH','built-in');LV(Y.ispd+4,'DC SPD','built-in, Type II');LV(Y.mp+4,'MPPT','');LV(Y.link+4,'DC LINK','')}
LV(Y.br+4,'DC / AC','');
wrw('Built-in DC switch, DC SPD and AC SPD as per the inverter data sheet.',24).forEach((z,j)=>T(28,Y.top+8+j*11,z,8.5));
// ---- PV strings (columns, power flows up) ----
const mw=Math.min(26,q*0.5),mh=20;
const modV=(x,y)=>{R(x-mw/2,y,mw,mh,BK,1.1,'','#fff');L(x-mw/2,y+mh/2,x+mw/2,y+mh/2,BK,0.6);L(x,y,x,y+mh,BK,0.6)};
const isoV=(x,y)=>{L(x,y+24,x,y+12,BL,1.5);C(x,y+12,2,BK,1.1,'#fff');L(x,y+12,x+10,y-10,BK,1.5);L(x-6,y-12,x+6,y-12,BK,1.5);L(x,y-12,x,y-24,BL,1.5)}; // disconnector: hinge below, bar at the upper fixed contact
const spdR=(x,y,col=MG)=>{dot(x,y,BL);L(x,y,x+8,y,col,1.2);R(x+8,y-7,9,14,col,1.2);L(x+10,y-3,x+15,y,col,1);L(x+15,y,x+10,y+3,col,1)};
if(S){cols.forEach(c=>{const x=c.x,yb=Y.mod+3*mh+22;
  modV(x,Y.mod);L(x,Y.mod+mh,x,Y.mod+mh+4,BL,1.2);modV(x,Y.mod+mh+4);T(x+0.5,Y.mod+2*mh+17,'⋮',11,'middle','bold');modV(x,Y.mod+2*mh+22);
  const l1=hideS?`PV ${c.mi+1}`:`S${c.mi+1}.${c.j+1}`,l2=hideS?`${(c.n*wp/1000).toFixed(1)} kWp`:`${c.n} mod.`,z1=9*Math.max(0.85,Math.min(1,fs)),z2=8.5*Math.max(0.85,Math.min(1,fs));
  T(x,Y.lab,l1,z1,'middle','bold');T(x,Y.lab+11,l2,z2,'middle');const xt=x-Math.max(mw/2+5,Math.max(l1.length*0.62*z1,l2.length*0.58*z2)/2+5); // earth drop clear of the string labels
  L(x-mw/2,yb-4,xt,yb-4,GR,1,'3 2');L(xt,yb-4,xt,Y.ebus,GR,1,'3 2'); // module frame earth -> frame-earth bus (below)
  if(dcIso){L(x,Y.mod,x,Y.iso+24,BL);isoV(x,Y.iso);L(x,Y.iso-24,x,Y.bot,BL)}else L(x,Y.mod,x,Y.bot,BL);
  if(dcSpd){spdR(x,Y.spd);L(x+12.5,Y.spd+7,x+12.5,Y.spe,GR,1)}});
 const e0=cols[0].x-mw/2-5-24,e1=cols[S-1].x-mw/2-5;L(e0-22,Y.ebus,Math.max(e1,e0)+0.01,Y.ebus,GR,1.4);es(e0-22,Y.ebus);
 T(e0-30,Y.ebus+8,'PV frame earth',8,'end');T(e0-30,Y.ebus+18,g('pvEarth')||'4mm² Cu',8,'end');
 if(dcSpd){const b=cols[S-1].x+12.5,xa=cols[0].x-30;L(xa,Y.spe,b,Y.spe,GR,1.4);L(xa,Y.spe,xa,Y.spe+6,GR,1.4);es(xa,Y.spe+6,GR,0.8);T(xa-12,Y.spe+14,'DC SPD earth',8,'end')}}
// ---- inverter / PCS enclosure ----
R(bL,Y.top,bR-bL,Y.bot-Y.top,BK,1.6);T(hasBat?bL+72:bL+8,Y.top+16,utag,10.5,'start','bold');T(hasBat?bL+72:bL+8,Y.top+29,B?(u.model||'BESS PCS'):u.name,9.5,'start');T(bR-8,Y.top+16,`${u.kw} kW · ${(+u.I).toFixed(1)} A AC`,10,'end','bold');
const bridge=(x,y)=>{R(x-30,y-22,60,44,BK,1.4,'','#fff');L(x-30,y+22,x+30,y-22,BK,1);T(x-16,y+18,'=',13,'middle');T(x+16,y-4,'~',13,'middle')}; // DC (bottom-left) -> AC (top-right)
const swV=isoV;
if(S){grp.forEach((g0,mi)=>{const cc=cols.filter(c=>c.mi==mi),x=xm[mi];cc.forEach(c=>L(c.x,Y.bot,c.x,Y.join,BL));if(cc.length>1){L(cc[0].x,Y.join,cc[cc.length-1].x,Y.join,BL);dot(x,Y.join,BL)}
  L(x,Y.join,x,Y.sw+24,BL);swV(x,Y.sw);L(x,Y.sw-24,x,Y.mp+11,BL);const gap=mi<m-1?xm[mi+1]-x:bR-x;if(gap>26){spdR(x,Y.ispd);es(x+12.5,Y.ispd+7,GR,0.7)}
  const bw=Math.max(30,Math.min(56,(m>1?Math.min(...xm.slice(1).map((v,i)=>v-xm[i])):99)-10));R(x-bw/2,Y.mp-11,bw,22,BK,1.2,'','#fff');T(x,Y.mp+3.5,(bw<44?'M':'MPPT ')+(mi+1),8*Math.max(0.85,Math.min(1.1,fs)),'middle','bold');L(x,Y.mp-11,x,Y.link,BL);if(m>1)dot(x,Y.link,BL)});
 L(Math.min(xm[0],xc,hasBat?bL+60:1e9),Y.link,Math.max(xm[m-1],xc),Y.link,BL,2.4);T(Math.max(xm[m-1],xc)+8,Y.link-6,'DC LINK',8,'start','bold')}
else if(B){const bx=xc-200;R(bx-55,Y.iso-40,110,70);[[14,26],[21,13],[28,26],[35,13]].forEach(([d,w],j)=>L(bx-w,Y.iso-40+d,bx+w,Y.iso-40+d,BK,j%2?4:1.5));T(bx+64,Y.iso-10,`BATTERY ${u.kwh||''} kWh`,9,'start','bold');
 L(bx,Y.iso-40,bx,Y.link,BL,2);T(bx+8,Y.spd,u.dc||'DC cable',9,'start');L(bx,Y.link,xc,Y.link,BL,2);T(bL+8,Y.top+42,'Bi-directional PCS',9,'start','bold')}
L(xc,Y.link,xc,Y.br+22,BL,2);bridge(xc,Y.br);L(xc,Y.br-22,xc,Y.top,OR,2);
dot(xc,Y.acspd,OR);L(xc,Y.acspd,xc+8,Y.acspd,MG,1.2);R(xc+8,Y.acspd-7,9,14,MG,1.2);es(xc+12.5,Y.acspd+7,GR,0.7);gp?T(xc-8,Y.acspd+4,'AC SPD (built-in)',8,'end','bold'):T(xc+24,Y.acspd+4,'AC SPD (built-in)',8,'start','bold');
if(hasBat){const bx=bL+60,by=Y.pBot+4;L(bx,Y.link,bx,by+48,BL,2);R(bx-50,by,100,48);[[10,26],[17,13],[24,26],[31,13]].forEach(([d,w],j)=>L(bx-w,by+d,bx+w,by+d,BK,j%2?4:1.5));T(bx,by+44,`${u.battKwh} kWh`,8,'middle');
 T(bx-56,by+14,'INTEGRATED BATTERY',9,'end','bold');T(bx-56,by+26,`${u.battKwh} kWh`,8.5,'end');T(bx-56,by+38,u.battDc||'Battery DC cable',8.5,'end')}
// ---- AC cable up to the switchgear panel ----
const pL=Math.min(xc-70,1180-380),pR=pL+380,xg=xc+150;
const acl=wslash(u.ac,24),ax=gp?xc-10:xc+10,aa=gp?'end':'start';acl.forEach((z,j)=>T(ax,Y.pBot+18+j*11,z,9,aa));T(ax,Y.pBot+18+acl.length*11,`I = ${(+u.I).toFixed(1)} A`,8.5,aa);
R(pL,Y.pTop,pR-pL,Y.pBot-Y.pTop,BK,1.3,'8 4');{const pt=gp?wrw(pnl,18):[pnl];pt.forEach((z,j)=>T(pR-8,Y.pBot-8-(pt.length-1-j)*12,z,10.5,'end','bold'))}T(pR-8,Y.pTop+15,g(it.loc==2?'ipL2':'ipMain')=='IP66'?'IP66 (OUTDOOR)':'IP54 (INDOOR)',8.5,'end','bold');
const cbV=(x,y)=>{L(x,y,x,y+16,OR,2);L(x,y+34,x,y+52,OR,2);L(x,y+34,x+10,y+16,BK,1.6);L(x-4,y+12,x+4,y+20,BK,1.3);L(x-4,y+20,x+4,y+12,BK,1.3)};
L(xc,Y.top,xc,Y.cb+52,OR,2);cbV(xc,Y.cb);T(xc+16,Y.cb+24,`${u.poles||'4P'} ${u.mccb}A`,10,'start','bold');T(xc+16,Y.cb+36,BT(u.mccb,u.I),8.5,'start');L(xc,Y.cb,xc,Y.bus,OR,2);dot(xc,Y.bus,OR);
L(xc-40,Y.bus,gp?xg-40:pR-20,Y.bus,OR,6);T(xc+8,Y.bus-8,`${gp?'':'COMMON '}COUPLING BUSBAR ${bus}A`,8.5,'start','bold');gp?T(xc+8,Y.bus+16,'to the other feeders',8,'start'):T(pR-20,Y.bus+16,'to the other feeders (see the main SLD)',8,'end');
if(gp){const yr=Y.pBot+40;L(xc+30,Y.br,xc+60,Y.br,OR);L(xc+60,Y.br,xc+60,yr,OR);L(xc+60,yr,xg,yr,OR);L(xg,yr,xg,Y.cb+52,OR);cbV(xg,Y.cb);T(xg+16,Y.cb+24,`${u.poles||'4P'} ${u.gp.mccb}A`,10,'start','bold');T(xg+16,Y.cb+36,BT(u.gp.mccb,u.gp.I)+' · GRID PORT',8.5,'start');
 L(xg,Y.cb,xg,Y.pTop+24,OR,2);s.push(`<polygon points="${xg-5},${Y.pTop+24} ${xg+5},${Y.pTop+24} ${xg},${Y.pTop+14}" fill="#000"/>`);T(xg+10,Y.pTop+30,'to / from grid supply (ATS)',8,'start');
 const gl=wslash(u.gp.ac,22);gl.forEach((z,j)=>T(xc+68,yr+16+j*11,z,8.5,'start'));T(xc+68,Y.br-6,'GRID PORT',7.5,'start','bold')}
// earthing: inverter PE (dashed, up) -> panel earth bar -> earth pit
const xe=pL-22,ye=Y.pBot-18;L(xe,Y.top,xe,ye,GR,1.5,'5 3');L(xe,ye,pL+10,ye,GR,1.5);L(pL+10,ye,pL+52,ye,GR,3);T(pL+10,ye-6,'EARTH BAR',7.5,'start','bold');L(xe,ye,xe-30,ye,GR,1.5);es(xe-30,ye);
{const el=wrw(u.earth||'Earth cable',18);el.forEach((z,j)=>T(xe-6,ye-28-(el.length-1-j)*11,z,8.5,'end'))}
// ---- MPPT schedule (right) ----
if(S&&!hideS){const tx=1200,tw=360,ty=400,cw=[0.18,0.17,0.25,0.2,0.2],hd=['MPPT','Strings','Modules / string','Modules','kWp'],rh=Math.max(11,Math.min(16,(FB-30-ty)/(m+2)));
 T(tx,ty-7,'MPPT / STRING SCHEDULE',10,'start','bold');R(tx,ty,tw,rh*(m+2),BK,1);let cx=tx;cw.forEach((c,j)=>{if(j)L(cx,ty,cx,ty+rh*(m+2),BK,0.7);T(cx+4,ty+rh*0.72,hd[j],8,'start','bold');cx+=c*tw});L(tx,ty+rh,tx+tw,ty+rh,BK,1);
 grp.concat([{tot:1}]).forEach((g0,i)=>{const yy=ty+rh*(i+1);if(i)L(tx,yy,tx+tw,yy,BK,g0.tot?1:0.4);let c2=tx;const v=g0.tot?['Total',String(S),'—',String(u.mods),(u.mods*wp/1000).toFixed(2)]:[String(i+1),String(g0.k),String(g0.n),String(g0.n*g0.k),(g0.n*g0.k*wp/1000).toFixed(2)];
  v.forEach((z,j)=>{T(c2+4,yy+rh*0.72,z,8,'start',g0.tot?'bold':'normal');c2+=cw[j]*tw})});
 const sum=grp.reduce((a,g0)=>a+g0.n*g0.k,0);if(sum!=+u.mods)T(tx,ty+rh*(m+2)+14,`Note: the strings add up to ${sum} modules, the inverter card says ${u.mods}.`,8.5,'start','bold')}
s.unshift('<g data-layer="DIAGRAM">');s.push('</g>');
s.push(`<rect x="4" y="4" width="${W-8}" height="${A4H-8}" fill="none" stroke="#000" stroke-width="2"/>`);s.push(FRAME(W));
const qty=ALLI().reduce((a,i)=>a+i.mods,0),kwp=KWP().toFixed(2);
TB(s,W,wp,qty,kwp,TITLE(kwp),'SINGLE LINE DIAGRAM — '+utag+' DETAIL',B?`${u.kw} kW PCS · ${u.kwh} kWh`:`${u.name} · ${u.kw} kW · ${hideS?'':S+' strings / '}${m} MPPT${m>1?'s':''}`);
return page(s.join(''))}
// list of units for the inverter-detail picker
S.invUnits = (v, inv, bess, inv2, bess2) => { const o = [], L2 = !!v.loc2on, t = L2 ? (k => k == 2 ? ' · ' + (v.loc2name || 'Location 2') : ' · Location 1') : () => '';
  (inv || []).forEach((u, i) => o.push(`Inverter ${i + 1} — ${u.name}${t(1)}`)); (bess || []).forEach((u, i) => o.push(`BESS PCS ${i + 1} — ${u.kw} kW${t(1)}`));
  if (L2) { (inv2 || []).forEach((u, i) => o.push(`Inverter ${i + 1} — ${u.name}${t(2)}`)); (bess2 || []).forEach((u, i) => o.push(`BESS PCS ${i + 1} — ${u.kw} kW${t(2)}`)); } return o; };
S.renderInv = (v, inv, bess, inv2, bess2, sel, lay) => { V = v; INV = inv || []; BESS = bess || []; INV2 = inv2 || []; BESS2 = bess2 || []; return PH1(lay == 'v' ? renderInvV(sel) : renderInv(sel)); };
S.renderMV = (v, inv, bess, inv2, bess2) => { V = v; INV = inv || []; BESS = bess || []; INV2 = inv2 || []; BESS2 = bess2 || []; return (v.mv && v.mv.lay == 'v') ? renderMVv() : renderMV(); };
S.renderPanels = (v, inv, bess, inv2, bess2) => { V = v; INV = inv; BESS = bess || []; INV2 = inv2 || []; BESS2 = bess2 || []; return PH1(renderPanels()); };
S.renderBlock = (v, inv, bess, inv2, bess2) => { V = v; INV = inv; BESS = bess || []; INV2 = inv2 || []; BESS2 = bess2 || []; return PH1(renderBlock()); };
S.renderSLD = (v, inv, bess, inv2, bess2) => { V = v; INV = inv; BESS = bess || []; INV2 = inv2 || []; BESS2 = bess2 || []; return PH1(renderSLD()); };
})(typeof window !== 'undefined' ? window : globalThis);
