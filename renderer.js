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
const CFGN = () => ({ nm: 'Net metering', na: 'Net accounting', np: 'Net plus', og: 'Off-grid' }[V.mode] || 'Net metering'), md = () => V.mode || 'nm';
const dfmt = iso => /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split('-').reverse().join('/') : iso;
const wslash = (s, n) => { const p = String(s).split('/'), out = []; let cur = ''; p.forEach(w => { const cand = cur ? cur + '/' + w : w; if (cur && cand.length > n) { out.push(cur + '/'); cur = w; } else cur = cand; }); if (cur) out.push(cur); return out; }; // wrap a cable spec at '/' boundaries
const BT = (a, I) => S.brkType(a, I); // MCB (32/40/63 A), MCCB (100-1600 A), ACB (2000-4000 A); 'ADJ.' = adjustable trip unit when the load current I is below 20 % of the rating
const ALLI = () => INV.concat(V.loc2on ? INV2 : []), ALLB = () => BESS.concat(V.loc2on ? BESS2 : []); // both locations (title block / totals)
const units = () => INV.map(u => ({ ...u, kind: 'inv' })).concat(BESS.map(u => ({ ...u, kind: 'bess' })));
const A4W = 1587, A4H = 1123; // fixed A4-landscape page (~135 dpi) — the sheet size never changes
const page = inner => `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${A4W}" height="${A4H}" viewBox="0 0 ${A4W} ${A4H}" font-family="Arial, Helvetica, sans-serif"><rect width="${A4W}" height="${A4H}" fill="#fff"/>${inner}</svg>`;
// Drawing window: inner frame whose left/right edges line up with the title block (same margin BM=10, i.e. 6 px from the border line at x=4) and with the same 6 px gap above the title block (two separate windows)
const FRAME=W=>`<g data-layer="FRAME"><rect x="10" y="10" width="${W-20}" height="${A4H-10-105-6-10}" fill="none" stroke="#000" stroke-width="1.5"/></g>`;
// Title block (ISO 7200-style ruled grid): logo | title + (Drawing No | Revision | Date) strip | 2×2 equipment cells (inverters, solar modules, BESS PCS, batteries) | ruled approvals table.
// Drawn in absolute page coordinates (no diagram stretch) and sits the same distance from the left, right and bottom page border (BM).
function TB(s,W,wp,qty,kwp,title){
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
  const two=ls.length>2?[ls[0],clip(ls.slice(1).join(' '),mc)]:ls;two.forEach((q,j)=>T(d1+15,y0+14+j*13,clip(q,mc),11,'start','bold'))}}T(d1+15,y0+45,'SINGLE LINE DIAGRAM',19,'start','bold');
T(d1+15,y0+67,clip(`Configuration: ${CFGN()}      Location: ${g('loc')}`,92),11,'start');
L(d1,y0+81,d2,y0+81);L(420,y0+81,420,yb);L(660,y0+81,660,yb);
T(d1+15,y0+97,clip('Drawing No: '+g('dno'),34),11,'start');T(435,y0+97,clip('Revision: '+g('rev'),30),11,'start');T(675,y0+97,'Date: '+dfmt(g('date')),11,'start');
// equipment cells — inverters, solar modules, BESS PCS and batteries are listed separately
const grp=(arr,key)=>{const m=new Map();arr.forEach(a=>{const k=key(a);m.set(k,(m.get(k)||0)+1)});return[...m].map(([k,n])=>n+' × '+k)};
const wr=(arr,n)=>{const out=[];let cur='';arr.forEach(e=>{const c=cur?cur+'  +  '+e:e;if(cur&&c.length>n){out.push(cur);cur=e}else cur=c});if(cur)out.push(cur);return out};
const I=ALLI(),B=ALLB(),hy=I.filter(i=>i.hybrid&&+i.battKwh>0);
const kwI=I.reduce((a,i)=>a+i.kw,0),kwB=B.reduce((a,b)=>a+ +b.kw,0),kwhT=B.reduce((a,b)=>a+ +b.kwh,0)+hy.reduce((a,i)=>a+ +i.battKwh,0),f=n=>+(+n).toFixed(1);
const cells=[
 ['Solar modules',[`${wp} W × ${qty} Nos`,`${kwp} kWp DC`]],
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
const wp=+g('modWp')||0,qty=ALLI().reduce((a,i)=>a+i.mods,0),kwp=(qty*wp/1000).toFixed(2),kw=ALLI().reduce((a,i)=>a+i.kw,0);
const strs=ALLI().reduce((a,i)=>a+i.strs,0),title=g('proj').replace(/\{kw\}/gi,kwp);
const W=A4W,GR='#0a7a2f',s=[],MG='#a020a0';
const ipT=k=>g(k)=='IP66'?'IP66 (OUTDOOR)':'IP54 (INDOOR)',efrM=!!g('efrMain'),efrI=!!g('efrIso')&&md()!='og',indM=!!g('indMain'),indI=!!g('indIso'),dcIso=!!g('dcIso'),dcSpd=!!g('dcSpd'),indL=!!g('indL2');
const efrSet=k=>(g(k)||'50N/51N').slice(0,16);
// small block symbols: EFR box (relay) and indicator-lamp box (three signal lamps R-Y-B); 66 x 24
const efrBox=(x,y,set)=>{bx(x,y,66,24);t(x+33,y+10,'EFR',9,'middle','bold');t(x+33,y+20,set,7,'middle')};
const lampBox=(x,y)=>{bx(x,y,66,24);[['R',x+14],['Y',x+33],['B',x+52]].forEach(([c,cx])=>{s.push(`<circle cx="${cx}" cy="${y+9}" r="4.5" fill="none" stroke="#000" stroke-width="1.2"/><line x1="${cx-3.2}" y1="${y+5.8}" x2="${cx+3.2}" y2="${y+12.2}" stroke="#000" stroke-width="1.2"/><line x1="${cx-3.2}" y1="${y+12.2}" x2="${cx+3.2}" y2="${y+5.8}" stroke="#000" stroke-width="1.2"/>`);t(cx,y+21,c,7,'middle','bold')})};
const t=(x,y,str,sz=12,a='middle',w='normal')=>s.push(`<text xml:space="preserve" x="${x}" y="${y}" font-size="${sz}" text-anchor="${a}" font-weight="${w}" fill="#000">${esc(str)}</text>`);
const t2=(x,y,str)=>{const k=str.search(/ [(×]/);(k>0?[str.slice(0,k),str.slice(k+1)]:[str]).forEach((p,n,a)=>t(x,y-(a.length-1-n)*10,p,10))};
const ln=(a,b,c,d,col='#000',w=1.5,da='')=>s.push(`<line x1="${a}" y1="${b}" x2="${c}" y2="${d}" stroke="${col}" stroke-width="${w}"${da?` stroke-dasharray="${da}"`:''}/>`);
const bx=(x,y,w,h,da='',sw=1.5)=>s.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#000" stroke-width="${sw}"${da?` stroke-dasharray="${da}"`:''}/>`);
// --- fixed page geometry: these never move, regardless of how many units there are ---
const top=114,yE=A4H-218,lu2=U2[U2.length-1],rowsBudget=(yE-(L2&&!(lu2&&lu2.kind=='inv'&&lu2.hybrid&&+lu2.battKwh>0)?120:170))-top; // with a second location only Location 2's earth bus bar sits below the rows
// x layout of the switchgear panel (dashed outline PL..PR): row breakers -> busbar -> main breaker, each with a clear gap to the outline and to each other
const PL=600,MB=630,bx0=750,BK=780,PR=870,ISL=1000;
// rows carrying a hybrid inverter's integrated battery are taller (room for a proper battery box); every row below simply moves down
const isHyb=u=>!!u&&u.kind=='inv'&&u.hybrid&&+u.battKwh>0,H0=150,HH=270,hOf=u=>isHyb(u)?HH:H0,cbOf=u=>isHyb(u)?252:135; // row pitch / lowest content of a row (unscaled)
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
const row=(u,i,k,nI,nB,cx,pv)=>{const y0=yy(i,0),yc=yy(i,45),B=u.kind=='bess',Y=(j,n,o)=>sm?y0+(j+1)*90*sv/(n+1)+2.5:yy(i,o);
bx(40,y0,170,90*sv);
if(!B&&sm4)t(125,y0+45*sv+2.2,`PV ARRAY · ${u.mods} × ${wp} Wp · ${(u.mods*wp/1000).toFixed(2)} kWp`,6,'middle','bold');
else if(B&&sm4)t(125,y0+45*sv+2.2,`BATTERY (BESS) · ${u.kwh} kWh`,6,'middle','bold');
else if(!B&&sm3){const kp=(u.mods*wp/1000).toFixed(2)+' kWp';t(125,Y(0,2,24),`PV ARRAY · ${u.mods} × ${wp} Wp`,fz(12),'middle','bold');t(125,Y(1,2,44),`Strings: ${u.cfg} · ${kp}`,fz(10))}
else if(!B){const n=sm2?3:4,kp=(u.mods*wp/1000).toFixed(2)+' kWp';t(125,Y(0,n,24),'PV ARRAY',fz(13),'middle','bold');t(125,Y(1,n,44),`${u.mods} × ${wp} Wp`,fz(12));if(sm2)t(125,Y(2,n,61),`Strings: ${u.cfg} · ${kp}`,fz(10));else{t(125,Y(2,n,61),'Strings: '+u.cfg,fz(10));t(125,Y(3,n,78),kp,fz(11))}}
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
ln(480,yc,MB,yc);{const f=fz(9),w=u.ac.length*0.55*f,al=w>(PL-480-12)?wslash(u.ac,Math.ceil(u.ac.length/2)):[u.ac];al.forEach((x,k)=>t((480+PL)/2,yc-8*sv-(al.length-1-k)*(f+1),x,f))}
{const bh=Math.max(40*sv,11);bx(MB,yc-bh/2,60,bh)}if(sm)t(MB+30,yc+2.5,`${/ADJ/.test(BT(u.mccb,u.I))?'':'4P '}${u.mccb}A ${BT(u.mccb,u.I)}`,fz(9));else{t(MB+30,yc-3*sv,`4P ${u.mccb}A`,fz(11));t(MB+30,yc+12*sv,BT(u.mccb,u.I),fz(9))}
ln(MB+60,yc,bx0,yc)};
const pv1=[],pv2=[],PVX1=24,PVX2=24; // both locations' roof earth collectors share the same x and label style
U1.forEach((u,k)=>row(u,posM[k],k,INV.length,BESS.length,PVX1,pv1));
U2.forEach((u,k)=>row(u,posL[k],k,INV2.length,BESS2.length,PVX2,pv2));
const yc0=yy(posM[0],45),yL=yy(posM[n1-1],45),ym=(yc0+yL)/2;
const pTop=Math.max(yc0-75-(efrM&&indM?14:0),50),pBot=yL+(toMain?95:50),peY=pTop+15,trunkTop=Math.min(yy(posM[0],105),peY);
bx(PL,pTop,PR-PL,pBot-pTop,'8 4');t(PL,pTop-6,`${L2?'LOCATION 1 — ':''}MAIN SWITCHGEAR PANEL ${g('panel')}A`,12,'start','bold');t(PR-8,pBot-8,ipT('ipMain'),10,'end','bold'); // enclosure rating badge: bottom-right inside the panel outline
ln(PL,peY,300,peY,GR,1.5,'5 3');t(450,peY-6,L2?'Location 1 panel earth':'Switchgear panel earth',9,'middle');
ln(bx0,yc0-30,bx0,yL+30+(toMain?45:0),'#000',6);{const lx=bx0-(efrM||indM?16:0);t(lx,yc0-57,'COMMON COUPLING',10);t(lx,yc0-45,`BUSBAR ${g('bus')}A`,10)}
const hl=md()=='nm'||md()=='na',og=md()=='og',ix=1160;
ln(bx0,ym,BK,ym);bx(BK,ym-20,70,40);t(BK+35,ym-3,`4P ${g('panel')}A`,11);t(BK+35,ym+12,(q=>/ADJ/.test(q)?q:'MAIN '+q)(BT(g('panel'),V.panelI)),9);
if(efrM){efrBox(BK+16,ym-48,efrSet('efrMainSet'));ln(BK+49,ym-24,BK+49,ym-20,'#000',1.5,'3 2')} // earth-fault relay trips the main breaker (short dashed link)
if(indM)lampBox(BK+16,ym-(efrM?76:48));
ln(BK+70,ym,1010,ym);t2((PR+ISL+5)/2,ym-27,g('mainCable'));
const TX=1104,ipEx=isIso?-10:0; // TX: where Location 2's feeder taps the isolation panel
const src=og?String(g('ogSrc')||''):'';
const wrap=(str,n)=>{const out=[];let cur='';String(str).split(' ').forEach(w=>{if(cur&&(cur+' '+w).length>n){out.push(cur);cur=w}else cur=cur?cur+' '+w:w});if(cur)out.push(cur);return out};
const dotB=(x,y,r=2.6)=>s.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" stroke="#000" stroke-width="1.2"/>`);
// standard ATS symbol (changeover switch in an enclosure): inputs I / II on the left / right edges, common (load) terminal at the bottom (flip: at the top)
const atsB=(x,y,flip)=>{const cy=flip?y+32:y+12,py=flip?y+10:y+34,c1=x+12,c2=x+48,px=x+30;bx(x,y,60,44);
 ln(x,cy,c1-2.6,cy);ln(x+60,cy,c2+2.6,cy);flip?ln(px,y,px,py-2.6):ln(px,py+2.6,px,y+44);
 ln(px,py,px+(c1-px)*0.82,py+(cy-py)*0.82,'#000',1.8);dotB(c1,cy);dotB(c2,cy);dotB(px,py);
 t(c1,flip?y+22:y+27,'I',8,'middle','bold');t(c2,flip?y+22:y+27,'II',8,'middle','bold');t(x+47,flip?y+13:y+40,'ATS',7,'middle','bold')};
const genB=(x,y,r=18)=>{s.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="#000" stroke-width="1.5"/>`);t(x,y+3,'G',12,'middle','bold');t(x,y+13,'~',9,'middle')};
if(og&&src){ // OFF-GRID with backup source(s): automatic transfer switch(es) built into the isolation panel
 const both=src=='both',A=g('atsA')||g('iso')||g('panel'),efrA=!!g('efrIso'),x2=isIso?1160:1060,x1=x2+(efrA?140:110),BEa=Math.max((both?x1:x2)+80,efrA?x2+130:0),yT=ym-50-(indI?0:0),yB=ym+75,yG=both?ym+42:ym;
 bx(1000,yT,BEa-1000,yB-yT,'8 4');t(1000,yT-6,`ISOLATION PANEL (ATS) — ${ipT('ipIso')}`,10,'start','bold');
 ln(1010,ym,x2,ym);t(x2-5,ym-5,'SOLAR',8,'end','bold');if(indI)lampBox(1012,ym+40);
 atsB(x2,ym-12,false);t(x2+30,ym-18,`${both?'ATS-2':'ATS'}  4P ${A}A`,10,'middle','bold');
 {const lx=x2+30;ln(lx,ym+32,lx,ym+100);s.push(`<polygon points="${lx-12},${ym+100} ${lx+12},${ym+100} ${lx},${ym+124}" fill="#000"/>`);const ls=(q=>q.length>2?[q[0],q.slice(1).join(' ')]:q)(wrap(g('loadName'),18));ls.forEach((q,j)=>t(lx,ym+146+j*14,q,12,'middle','bold'));t2(lx,ym+148+ls.length*14,g('loadCable'))}
 if(efrA){const cx2=x2+30,cy=ym+60,rx=x2+48;s.push(`<circle cx="${cx2}" cy="${cy}" r="7" fill="none" stroke="#000" stroke-width="1.5"/>`);ln(cx2+7,cy,rx,cy,'#000',1);efrBox(rx,cy-12,efrSet('efrIsoSet')); // EFR: CBCT on the ATS output (load side), relay trips the ATS (dashed)
  ln(rx+33,cy-12,rx+33,ym+40,'#000',1.5,'3 2');ln(rx+33,ym+40,x2+50,ym+40,'#000',1.5,'3 2');ln(x2+50,ym+40,x2+50,ym+32,'#000',1.5,'3 2')}
 const lab=(L,R,y,gx,gw,yb,str)=>{const w=str.length*0.56*10;if(R-L-16>=w)t2((L+R)/2,y-8,str);else t2(Math.min(gx+gw/2,1565-w/2),yb+(str.search(/ [(×]/)>0?10:0),str)}; // source cable: above its line if it fits, else under the source symbol
 const grid=(xs,y)=>{const m=Math.max(1344,BEa+54),gx=m+52,gw=Math.min(80,1560-gx);ln(xs,y,m-18,y);s.push(`<circle cx="${m}" cy="${y}" r="18" fill="none" stroke="#000" stroke-width="1.5"/>`);t(m,y+4,'kWh',10);wrap(g('meterLbl')||'',14).forEach((q,j)=>t(m,y+34+j*11,q,9));
   ln(m+18,y,gx,y);bx(gx,y-25,gw,50);t(gx+gw/2,y+5,'GRID',13,'middle','bold');lab(BEa,m-18,y,gx,gw,y+(g('meterLbl')?64:48),g('utilCable'))},
  dg=(xs,y)=>{const m=Math.max(1344,BEa+70);ln(xs,y,m-18,y);genB(m,y);t(m,y+34,'DIESEL GENERATOR',9,'middle','bold');if(g('dgKva'))t(m,y+46,`${g('dgKva')} kVA`,9);lab(BEa,m-18,y,m-40,80,y+62,g('dgCable')||g('utilCable'))};
 if(!both)(src=='grid'?grid:dg)(x2+60,ym);
 else{ln(x2+60,ym,x1+30,ym);ln(x1+30,ym,x1+30,ym+10);atsB(x1,ym+10,true);t(x1+30,ym-6,`ATS-1  4P ${A}A`,10,'middle','bold');
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
bx(1010,ym-20,80,40);t(1050,ym-3,`4P ${g('iso')}A`,11);t(1050,ym+12,'ISOLATOR',9);
if(efrI)efrBox(1016,ym-50,efrSet('efrIsoSet')),ln(1049,ym-26,1049,ym-20,'#000',1.5,'3 2');
if(hl){bx(ISL,ym-66,200,168,'8 4');t(1000,ym-72,`ISOLATION PANEL — ${ipT('ipIso')}`,10,'start','bold');if(indI)lampBox(1016,ym+28);ln(1090,ym,ix,ym);ln(ix,ym-30,ix,ym+70,'#000',6);
t(ix,ym-48,'LOAD BUSBAR',10);t(ix,ym-38,`${g('isoBus')}A`,10);ln(ix,ym+70,ix,ym+130);t(ix+8,ym+119,g('loadCable'),9,'start');bx(ix-50,ym+130,100,34);t(ix,ym+152,g('loadName'),12,'middle','bold');ln(ix,ym,1326,ym);t2(1264,ym-8,g('utilCable'))}
else{const ex=efrI?13:0,ey=indI?20:0;bx(1000,ym-45-ex,isIso?135:100,85+ex+ey,'8 4');t(1000,ym-51-ex,`ISOLATION PANEL — ${ipT('ipIso')}`,10,'start','bold');if(indI)lampBox(1016,ym+28);ln(1090,ym,1326,ym);t2(1215,ym-8,g('utilCable'))}
{const ipx=1050,ipy=hl?ym+102:ym+40+(indI?20:0);ln(ipx,ipy,ipx,ipy+18,GR,1.5,'5 3');
ln(ipx-14,ipy+18,ipx+14,ipy+18,GR,2);ln(ipx-9,ipy+24,ipx+9,ipy+24,GR,2);ln(ipx-4,ipy+30,ipx+4,ipy+30,GR,2);
t(ipx+ipEx,ipy+48,'Isolation panel earth',10,'middle')}
s.push(`<circle cx="1344" cy="${ym}" r="18" fill="none" stroke="#000" stroke-width="1.5"/>`);t(1344,ym+4,'kWh',10);t(1344,ym+34,g('meterLbl'),9);
ln(1362,ym,1414,ym);bx(1414,ym-25,80,50);t(1454,ym+5,'GRID',13,'middle','bold');
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
t(20,32,`${qty} panels (×${wp} Wp) — ${strs} strings${(cf=>cf.length>70?'':' ('+cf+')')(ALLI().map(i=>i.cfg).join(' | '))} — ${kwp} kWp DC / ${+kw.toFixed(1)} kW AC${ALLB().length?' / '+ALLB().reduce((a,b)=>a+ +b.kwh,0)+' kWh BESS':''}`,12,'start');
t(W-20,32,CFGN()+' — '+g('opt'),14,'end','bold');
TB(s,W,wp,qty,kwp,title);
return page(s.join(''))}

function renderSLD(){
const L2=!!V.loc2on,mk=(I,B)=>I.map(u=>({...u,kind:'inv'})).concat(B.map(u=>({...u,kind:'bess'})));
// columns are laid out in ONE row so both locations share exactly the same symbol size: the main columns first (left), then Location 2's (right)
const U1=mk(INV,BESS),U2=L2?mk(INV2,BESS2):[],U=U1.concat(U2),n1=Math.max(1,U1.length),cnt=Math.max(1,U.length+(L2&&!U2.length?1:0)),n2=U2.length; // Location 2's columns sit to the RIGHT of the main ones (a virtual empty column keeps room for its panel if it has no units)
const wp=+g('modWp')||0,qty=INV.concat(L2?INV2:[]).reduce((a,i)=>a+i.mods,0),kwp=(qty*wp/1000).toFixed(2),title=g('proj').replace(/\{kw\}/gi,kwp);
const OR='#d9822b',BL='#1f6fd0',GR='#0a7a2f',MG='#a020a0',s=[],W=A4W;
// panel options (Panels & protection): enclosure IP rating, EFR (CBCT + relay), phase indicator lamps, DC-side isolator / SPD
const ipT=k=>g(k)=='IP66'?'IP66 (OUTDOOR)':'IP54 (INDOOR)',efrM=!!g('efrMain'),efrI=!!g('efrIso')&&md()!='og',indM=!!g('indMain'),indI=!!g('indIso'),indL=!!g('indL2'),dcIso=!!g('dcIso'),dcSpd=!!g('dcSpd');
const DCX=dcSpd?(dcIso?100:55):(dcIso?40:0); // extra vertical room on the PV DC cable for the DC isolator / DC SPD (everything below the inverter moves down by this much)
// --- fixed vertical layout (native design was 910px tall); stretch everything vertically to fill the fixed A4 page height ---
const SH=efrI?18:0; // SH: with an isolation-panel EFR the isolation panel is taller (its busbar, breakers and meter sit SH lower) so the CBCT + relay get room above the busbar
const E1=20,E2=L2?22:0,AR=8; // E1: extra gap between the isolation panel and the main panel (room for the main-cable label + panel title); E2: extra gap above Location 2's panel; AR: load arrow drop
const PD=E1+(efrM?46:0); // PD: with an earth-fault relay the main panel's contents (breaker, busbar, columns) sit PD lower so the CBCT + relay fit INSIDE the panel outline
const yE=(L2?(cnt>9?898:cnt>6?865:850):(cnt>9?735:690))+DCX+(L2?(DCX||efrM?24:12):(cnt>6&&(DCX||efrM)?14:0))+PD+E2,fy=(A4H-146)/(yE+48),DY2=166; // DY2: Location 2's busbar sits at y=466, i.e. its columns hang 166px lower than the main ones
let DY=0; // vertical offset applied by the drawing helpers (0 for the main columns, DY2 while drawing Location 2's)
const t=(x,y,str,sz=11,a='start',w='normal')=>s.push(`<text xml:space="preserve" x="${x}" y="${((y+DY)*fy).toFixed(1)}" font-size="${sz}" text-anchor="${a}" font-weight="${w}" fill="#000">${esc(str)}</text>`);
const ln=(a,b,c,d,col='#000',w=1.5,da='')=>s.push(`<line x1="${a}" y1="${((b+DY)*fy).toFixed(1)}" x2="${c}" y2="${((d+DY)*fy).toFixed(1)}" stroke="${col}" stroke-width="${w}"${da?` stroke-dasharray="${da}"`:''}/>`);
const bx=(x,y,w,h,da='',col='#000',sw=1.5)=>s.push(`<rect x="${x}" y="${((y+DY)*fy).toFixed(1)}" width="${w}" height="${(h*fy).toFixed(1)}" fill="none" stroke="${col}" stroke-width="${sw}"${da?` stroke-dasharray="${da}"`:''}/>`);
// --- column geometry: every column has the same base pitch (230); only a hybrid column (battery drawn to the LEFT of its inverter) gets extra room on its left.
// The symbol scale sh is solved so that margins + all columns + the gap between the locations fill the page width (no wasted space), capped at MAXSH.
const many=cnt>6,SPDX=many?60:0,MAXSH=L2?1.3:1.8,HX=110,BASE=230; // SPDX: with 7+ units the (held-size) text of the last column needs extra room before the SPD
const hyU=u=>!!u&&u.kind=='inv'&&u.hybrid&&+u.battKwh>0,hy0=hyU(U[0]),hy2=hyU(U2[0]),isIso0=L2&&V.loc2to=='iso',two=L2&&U1.length>0;
const hxc=[];U.reduce((a,u,i)=>(hxc[i]=a+((i>0&&!(L2&&i==n1)&&hyU(u))?HX:0)),0);const sumHx=hxc.length?hxc[hxc.length-1]:0,hxAt=i=>hxc.length?hxc[Math.min(i,hxc.length-1)]:0;
const c0=many&&n1>=3?172:196,k0=hy0?208:98; // left margin: main earth line + room for the first column's earth label; k0 = how far left of its inverter the first column reaches (x-95 earth line, x-205 for a hybrid)
const g0=two?(many&&n1>=3?185:215)+SPDX:0,g1=two&&hy2?110:0; // gap between the locations (Location 2's feeder, panel earth line, its first column's earth label)
const R0=L2?30:SPDX+135,R1=L2?166:105; // right margin: with Location 2 only its last column is at the right (the SPD stays after the main columns); otherwise the SPD + busbar end
const solve=spn=>(A4W-c0-g0-R0)/(k0+spn+g1+R1);
const x1Lim=1271; // with Location 2 on the isolation panel its feeder x (cx = x1-98sh-75) must stay left of ~1196 so the extended isolation panel still leaves room for the meter + GRID
const shIso=isIso0?(x1Lim-c0-g0)/(k0+n1*BASE+(hxc.length?hxc[Math.min(n1,hxc.length-1)]:0)+g1-98):1e9;
const sh=Math.min(MAXSH,solve(BASE*(cnt-1)+sumHx),shIso),GAPPX=g0+g1*sh;
const slack0=A4W-(c0+g0+R0+sh*(k0+BASE*(cnt-1)+sumHx+g1+R1)),x1L=c0+k0*sh+sh*(n1*BASE+hxAt(n1))+g0+g1*sh,room1=isIso0?Math.max(0,x1Lim+98*sh-x1L):1e9;
const colStart=c0+k0*sh+Math.min(slack0/2,room1),colPitch=BASE*sh;
// FONT scale is decoupled from the geometry scale (sh): text is held at the size it has with 4 units for anything smaller (1-3 units),
// follows the geometry between 4 and 6 units, and is held at the 6-unit size for anything bigger so it stays readable in print.
const shAt=n=>Math.min(MAXSH,solve((n-1)*(BASE+sumHx/Math.max(1,cnt-1)))),fs0=Math.max(shAt(6),Math.min(shAt(4),sh)),fs=fs0*Math.min(1,sh/0.44)*(L2&&many&&n1>=3?(cnt<=14?1.12:1.06):1); // very dense sheets (12+ columns): text shrinks a little with the geometry instead of overlapping
const XPE=()=>Xc(n1)-(hy2?208:98)*sh-105; // x of Location 2's own panel-earth conductor (left of its first column, clear of that column's earth label)
const Xc=i=>colStart+sh*(i*BASE+hxAt(i))+(L2&&i>=n1?GAPPX:0),tc=(x,y,str,sz,a,w)=>t(x,y,str,sz*fs,a,w),LP=(sz=10)=>Math.max(11,1.17*sz*fs/fy); // LP: line pitch (unscaled) for stacked, wrapped labels: never tighter than the text height, whatever the vertical stretch fy
// 'tight' = text is now larger than the (compressed) geometry, i.e. more than 6 units: wrap long labels so they stay clear of neighbouring columns
const tight=many,cwid=sz=>0.55*sz*fs,maxW=colPitch-147*sh-4,wl=(s,sz)=>tight?wrap(s,Math.max(4,Math.floor(maxW/cwid(sz)))):[s];
const wrap=(str,maxCh)=>{const words=String(str).split(' ').flatMap(w=>w.length>maxCh?(w.match(/[^-]+-?/g)||[w]):[w]);const lines=[];let cur='';
  words.forEach(w=>{const cand=cur?(cur.endsWith('-')?cur+w:cur+' '+w):w;if(!cur||cand.length<=maxCh)cur=cand;else{lines.push(cur);cur=w}});if(cur)lines.push(cur);return lines};
const brk=(x,y,l1,l2,mc)=>{ln(x,y,x,y+16,OR);ln(x,y+34,x,y+52,OR);ln(x,y+34,x+10,y+16);ln(x-4,y+12,x+4,y+20);ln(x-4,y+20,x+4,y+12);if(mc)bx(x+1,y+22,7,7,'','#000',1);tc(x+18,y+22,l1,11);tc(x+18,y+35,l2,9)};
const inv=(x,y)=>{bx(x-45*sh,y,90*sh,70);ln(x-45*sh,y+70,x+45*sh,y,'#000',1);t(x-28*sh,y+22,'~',15,'middle');t(x+28*sh,y+62,'=',15,'middle')};
const txt=(x,lines)=>lines.forEach(([str,sz,w,dy],k)=>tc(x+52*sh,tight?416+k*11:400+dy,str,sz,'start',w));
const es=(x,y,c=GR)=>{ln(x,y,x,y+8,c);ln(x-14,y+8,x+14,y+8,c,2);ln(x-9,y+14,x+9,y+14,c,2);ln(x-4,y+20,x+4,y+20,c,2)};
// --- standard symbols: CBCT (circle on the conductor) + EFR relay box (IEC protection relay) with a dashed trip link; signal lamp (circle with cross); DC isolator (disconnector) ---
const CTR=7,rdim=()=>{const b1=8.1/fy+1.5,b2=b1+10.3/fy;return{b1,b2,h:b2+1.8/fy+1.5}}; // relay box: label baselines / height in unscaled units (fixed 9px + 7px text)
const efrSet=k=>(g(k)||'50N/51N').slice(0,16),efrW=set=>Math.max(56,Math.min(110,set.length*0.55*7+12));
const ctc=(x,y)=>s.push(`<circle cx="${x.toFixed(1)}" cy="${((y+DY)*fy).toFixed(1)}" r="${CTR}" fill="none" stroke="#000" stroke-width="1.5"/>`);
const relay=(x,y,w,set)=>{const d=rdim();bx(x,y,w,d.h);t(x+w/2,y+d.b1,'EFR',9,'middle','bold');t(x+w/2,y+d.b2,set,7,'middle');return d};
const lamp=(x,y)=>{const cy=(y+DY)*fy,r=5.5,q=r*0.7;s.push(`<circle cx="${x.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r}" fill="none" stroke="#000" stroke-width="1.2"/><line x1="${(x-q).toFixed(1)}" y1="${(cy-q).toFixed(1)}" x2="${(x+q).toFixed(1)}" y2="${(cy+q).toFixed(1)}" stroke="#000" stroke-width="1.2"/><line x1="${(x-q).toFixed(1)}" y1="${(cy+q).toFixed(1)}" x2="${(x+q).toFixed(1)}" y2="${(cy-q).toFixed(1)}" stroke="#000" stroke-width="1.2"/>`)};
const lamps=(x0,yb)=>{['R','Y','B'].forEach((c,j)=>{const x=x0+j*16,r=5.5/fy;ln(x,yb,x,yb+21-r,OR);t(x+3,yb+10,c,7,'start','bold');lamp(x,yb+21);ln(x,yb+21+r,x,yb+31,OR)});ln(x0,yb+31,x0+32,yb+31,OR);t(x0-5,yb+34,'N',7,'end','bold')}; // phase indicator lamps R-Y-B: tapped off the busbar, common neutral return
const dcIsoSym=(x,y)=>{ln(x-5,y+14,x+5,y+14,'#000',1.5);ln(x,y+34,x+11,y+17,'#000',1.5)}; // disconnector: fixed-contact bar + open blade (the DC cable is cut around it by the caller)
// one column = breaker, inverter / BESS PCS, DC wiring, PV array or battery, earths. Used for BOTH locations (dy = vertical offset, i = global column, k = index inside its location)
const PVC=632+DCX,PVLS=dy=>`${dy>=DY2?(V.loc2pvearth||'4mm² Cu'):(g('pvEarth')||'4mm² Cu')} (PV array main earth, from roof)`; // PVC: y of the roof (module-side) earth collector, just below the PV array text
const isHy=u=>!!u&&u.kind=='inv'&&u.hybrid&&+u.battKwh>0;
// ph: previous column (same location) is a hybrid with a battery -> its battery earth line sits inside this column's left label area
const drawCol=(u,i,x,dy,k,nI,nB,pvx,ph,lb)=>{DY=dy;const hb=isHy(u),xe=x-(hb?205:95)*sh,xl=xe-3*sh; // xe: this column's equipment-earth line (further left for a hybrid, whose battery sits between it and the inverter)
const ye=yE-dy,B=u.kind=='bess',off=0; // stagger the bottom earth labels only when columns are very tight
ln(x,300,x,320,OR);brk(x,320,`4P ${u.mccb}A`,BT(u.mccb,u.I),1);ln(x,372,x,400,OR);
if(tight){const al=wslash(u.ac,Math.max(8,Math.floor((colPitch-10*sh)/cwid(9))));al.forEach((s,j)=>tc(x+8*sh,392-(al.length-1-j)*10,s,9))}else tc(x+8*sh,392,u.ac,9);
if(!B){inv(x,400);
const ttl=nI>1?'INVERTER '+(k+1):'INVERTER';
if(tight){let L=[...wl(ttl,12.5).map(s=>[s,11,'bold']),...wl(u.name,10).slice(0,3).map(s=>[s,10,'normal']),[u.kw+' kW',10,'normal']];
 const ex=wl('Integrated DC/AC SPD',9).map(s=>[s,9,'normal']);if(L.length+ex.length<=7&&!(u.hybrid&&+u.battKwh>0))L=L.concat(ex);
 L.forEach(([s,z,w],j)=>tc(x+52*sh,416+j*11,s,z,'start',w))}
else txt(x,[[ttl,11,'bold',16],[u.name,10,'normal',31],[u.kw+' kW',10,'normal',45],['Integrated DC/AC',9,'normal',59],['SPD',9,'normal',71]]);
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
tc(x,py(0),'PV ARRAY',11,'middle','bold');tc(x,py(1),`${u.mods} × ${wp} Wp`,10,'middle');
if(sw){tc(x,py(2),'Strings:',9,'middle');tc(x,py(3),u.cfg,9,'middle');tc(x,py(4),(u.mods*wp/1000).toFixed(2)+' kWp',10,'middle')}
else{tc(x,py(2),st,9,'middle');tc(x,py(3),(u.mods*wp/1000).toFixed(2)+' kWp',10,'middle')}
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
{const by=(dcIso||dcSpd)?557:529;tc(x-99*sh,by,'Battery',9,'end');tc(x-99*sh,by+11,'earth →',9,'end')}}
DY=0};
const pvA=[],pvB=[];
U1.forEach((u,k)=>drawCol(u,k,Xc(k),PD,k,INV.length,BESS.length,pvB,false));
U2.forEach((u,k)=>drawCol(u,n1+k,Xc(n1+k),DY2+PD+E2,k,INV2.length,BESS2.length,pvA,false,k==0?XPE()+10:0));
// roof earth: the arrays' earths join into ONE collector per location (solid, dots = joints, no dot where it merely crosses an equipment earth); one conductor then runs to the earth bus bar
const pvCollector=(xs,dy)=>{if(!xs.length)return;DY=dy;const ye=yE-dy;if(xs.length>1)ln(xs[0],PVC,xs[xs.length-1],PVC,GR,1.5);ln(xs[0],PVC,xs[0],ye,GR,1.5);
 const pl=wrap(PVLS(dy),Math.max(8,Math.floor(Math.min(colPitch-36*sh-6,150*sh)/cwid(9))));pl.forEach((q,j)=>tc(xs[0]+6*sh,ye-15-(pl.length-1-j)*LP(9),q,9,'start'));DY=0};
pvCollector(pvA,DY2+PD+E2);pvCollector(pvB,PD);
const lastU=U[(L2?n1:cnt)-1]||U[0],acW=Math.min(String(lastU.ac).length*cwid(9),colPitch-10*sh),spdX=Xc(L2?n1-1:cnt-1)+Math.max(105*sh+SPDX,8*sh+acW+16), // clear of the last column's (wide) AC-cable label
 // with Location 2 on the isolation panel the main panel is shortened (right to left) so that feeder can come straight down
busEnd=L2&&!isIso0?Math.max(spdX+95,XPE()+30+90):spdX+95; // Location 2 on the main panel: the busbar also reaches its tap breaker

DY=PD;ln(spdX,300,spdX,335,MG);bx(spdX-9,335,18,34,'',MG);ln(spdX-4,343,spdX+4,352,MG);ln(spdX+4,352,spdX-4,361,MG);ln(spdX,369,spdX,382,MG);es(spdX,382,MG);t(spdX+16,356,'SPD Type 1+2',10);
ln(90,300,busEnd,300,OR,5);(L2?(q=>{const mxw=busEnd-10-250,ls=q.length*0.55*10>mxw?[`0.4kV AC COMMON COUPLING BUSBAR ${g('bus')}A`,'3P+N+PE 400/230V 50Hz']:[q];ls.forEach((z,j)=>t(250,289-(ls.length-1-j)*11,z,10,'start'))})(`0.4kV AC COMMON COUPLING BUSBAR ${g('bus')}A  3P+N+PE 400/230V 50Hz`):t((300+busEnd)/2,289,`0.4kV AC COMMON COUPLING BUSBAR ${g('bus')}A  3P+N+PE 400/230V 50Hz`,10,'middle'));
DY=0;bx(80,250+E1,busEnd-70,128+PD-E1,'8 4');t(L2?170:busEnd,245+E1,`${L2?'LOCATION 1 — ':''}MAIN SWITCHGEAR PANEL ${g('panel')}A`,11,L2?'start':'end','bold');t(busEnd-8,266+E1,ipT('ipMain'),10,'end','bold');DY=PD; // enclosure rating badge, top-right inside the panel outline
if(indM)lamps(100,300);
ln(85,364,155,364,GR,3);t(98,350,'PANEL EARTH BUS',9,'start','bold');
ln(120,364,120,yE-PD,GR,1.5,'5 3');
(L2?['Location 1','panel earth']:['Switchgear','panel earth']).forEach((q,j)=>t(114,(L2?yE-PD-170:534)+j*11,q,10,'end'));DY=0; // two lines so it stays inside the drawing windowDY=0; // left of the earth line, clear of the first column's own earth runs
const hl=md()=='nm'||md()=='na',og=md()=='og',isIso=L2&&V.loc2to=='iso',cx=L2?XPE()+30:0; // cx = x of Location 2's feeder (right of the main columns)
const src=og?String(g('ogSrc')||''):'';let topR=0; // off-grid backup source(s): '' none | dg | grid | both
const dotS=(x,y,r=2.4)=>s.push(`<circle cx="${x}" cy="${((y+DY)*fy).toFixed(1)}" r="${r}" fill="#fff" stroke="#000" stroke-width="1.2"/>`);
// standard ATS symbol (changeover switch in an enclosure): inputs I / II on the left / right edges, common (load) terminal at the bottom (flip: at the top)
const atsSym=(x,y,flip)=>{const cy=flip?y+32:y+12,py=flip?y+10:y+34,c1=x+12,c2=x+48,px=x+30;bx(x,y,60,44);
 ln(x,cy,c1-2.4,cy);ln(x+60,cy,c2+2.4,cy);flip?ln(px,y,px,py-2.4):ln(px,py+2.4,px,y+44);
 ln(px,py,px+(c1-px)*0.82,py+(cy-py)*0.82,'#000',1.8);dotS(c1,cy);dotS(c2,cy);dotS(px,py);
 t(c1,flip?y+22:y+26,'I',7,'middle','bold');t(c2,flip?y+22:y+26,'II',7,'middle','bold');t(x+47,flip?y+12:y+40,'ATS',7,'middle','bold')};
const gen=(x,y,r)=>{s.push(`<circle cx="${x}" cy="${((y+DY)*fy).toFixed(1)}" r="${r}" fill="none" stroke="#000" stroke-width="1.5"/>`);t(x,y+3/fy,'G',11,'middle','bold');t(x,y+11/fy,'~',8,'middle')};
const cabLab=(L,R,y,str)=>{const gp=R-L-28,x=(L+R)/2,w=(q,z)=>q.length*0.56*z;let sz=9,ls=[str];if(w(str,9)>gp){sz=8;if(w(str,8)>gp){const q=str.split(' × ');ls=wslash(q[0],Math.max(8,Math.floor(gp/(0.56*8)))).concat(q[1]?['× '+q[1]]:[])}}
 ls.forEach((q,j)=>t(x,y-(ls.length-1-j)*10,q,sz,'middle'))};
const BE=isIso?Math.max(660,cx+70):660,mx=isIso?Math.min(BE+150,1405):810; // BE: right edge of the isolation panel (extended left→right to Location 2's feeder); mx: x of the energy meter (GRID follows)
const ulab=(L,str)=>{const gp=mx-14-L-14,x=(L+mx-14)/2,w=(q,z)=>q.length*0.56*z; // utility cable label, centred in the gap between the panel outline (L) and the meter: shrinks, then wraps (at '/' and before '× n'), never touching either
 let sz=10,ls=[str];if(w(str,10)>gp){sz=9;if(w(str,9)>gp){const q=str.split(' × ');ls=wslash(q[0],Math.max(8,Math.floor(gp/(0.56*9)))).concat(q[1]?['× '+q[1]]:[])}}
 ls.forEach((q,j)=>t(x,117-(ls.length-1-j)*11,q,sz,'middle'))};
if(og&&src){ // OFF-GRID with backup source(s): automatic transfer switch(es) built into the isolation panel
 const both=src=='both',A=g('atsA')||g('iso')||g('panel'),efrA=!!g('efrIso'),eset=efrSet('efrIsoSet').slice(0,isIso?8:10),ew=isIso?44:50,x2=isIso?cx+(efrA?70:80):370,x1=x2+(efrA?ew+92:100),BEa=Math.max((both?x1:x2)+(efrA?66:75),efrA?x2+64+ew+12:0),tight=isIso&&efrA,yG=both?167:125;
 bx(80,92,BEa-80,98,'8 4');t(85,86,`ISOLATION PANEL (ATS) — ${ipT('ipIso')}`,9,'start','bold');
 ln(100,125,x2-24,125,OR,4);t(175,115,`SOLAR BUS ${g('isoBus')||A}A`,9,'middle');ln(x2-24,125,x2,125,OR);if(!isIso)t(x2-5,120,'SOLAR',7,'end','bold');ln(150,125,150,177,OR);
 if(indI)lamps(225,125);
 atsSym(x2,113,false);t(x2+30,107,`${both?'ATS-2':'ATS'}  4P ${A}A`,9,'middle','bold');
 // load: ATS output straight down, out of the panel
 ln(x2+30,157,x2+30,205+AR,OR);s.push(`<polygon points="${x2+16},${((205+AR)*fy).toFixed(1)} ${x2+44},${((205+AR)*fy).toFixed(1)} ${x2+30},${((233+AR)*fy).toFixed(1)}" fill="#000"/>`);
 {const cap=both&&!isIso?2:3,ls=(q=>q.length>cap?q.slice(0,cap-1).concat([q.slice(cap-1).join(' ')]):q)(wrap(g('loadName'),both?13:18)),sz=ls.length>1?10:11;ls.forEach((q,j)=>both?t(x2+14,224+AR+j*12,q,sz,'end','bold'):t(x2+46,224+AR+j*12,q,sz,'start','bold'))}t(x2+24,203,g('loadCable'),8,'end');
 if(efrA){const yc=172,ry=161,rx=x2+64;ctc(x2+30,yc);ln(x2+30+CTR,yc,rx,yc,'#000',1);const d=relay(rx,ry,ew,eset); // EFR: CBCT on the ATS output (load side), relay trips the ATS (dashed)
  ln(rx+ew/2,ry,rx+ew/2,147,'#000',1,'4 3');ln(rx+ew/2,147,x2+60,147,'#000',1,'4 3')}
 const srcLab=(L,R,y,str,xr)=>{if(str.length*0.56*9<=R-L-28)return cabLab(L,R,y-8,str); // fits between the panel and the source: above its line
   const xm=(L+xr)/2,hw=Math.min((xr-L-8)/2,1568-xm),n=Math.max(8,Math.floor(2*hw/4.48)),q=str.split(' × '),ls=wslash(q[0],n).concat(q[1]?['× '+q[1]]:[]),xc=Math.min(xm,1568-Math.max(...ls.map(z=>z.length))*2.24);ls.forEach((q,j)=>t(xc,y-30-(ls.length-1-j)*10,q,8,'middle'))}, // else above the source symbols
  grid=(xs,y)=>{const m=Math.max(BEa+(tight?36:48),isIso?Math.min(BEa+150,1405):BEa+150),cmp=m+170>1565,cmp2=cmp&&m+86>1565,gx=cmp2?m+24:cmp?m+30:m+90,gw=cmp2?44:cmp?56:80; // utility supply: meter then GRID
   ln(xs,y,m-14,y,OR);s.push(`<circle cx="${m}" cy="${((y+DY)*fy).toFixed(1)}" r="${(14*fy).toFixed(1)}" fill="none" stroke="#000" stroke-width="1.5"/>`);t(m,y+4,'kWh',9,'middle');
   if(g('meterLbl'))(cmp?wrap(g('meterLbl'),13):[g('meterLbl')]).forEach((q,j)=>t(m,y+(cmp?36:25)+j*10,q,8,'middle'));
   ln(m+14,y,gx,y,OR);bx(gx,y-25,gw,50);t(gx+gw/2,y+5,'GRID',cmp2?10:cmp?11:13,'middle','bold');srcLab(BEa,m-14,y,g('utilCable'),gx+gw);return gx+gw},
  dg=(xs,y)=>{const gx=Math.max(BEa+70,Math.min(BEa+170,1522));ln(xs,y,gx-16,y,OR);gen(gx,y,16);t(gx,y+34,'DIESEL GENERATOR',8,'middle','bold');if(g('dgKva'))t(gx,y+44,`${g('dgKva')} kVA`,8,'middle');srcLab(BEa,gx-16,y,g('dgCable')||g('utilCable'),gx+40);return gx+50};
 if(!both)topR=src=='grid'?grid(x2+60,125):dg(x2+60,125);
 else{ // ATS-1 selects DG / grid, its output feeds ATS-2's second input
  ln(x2+60,125,x1+30,125,OR);ln(x1+30,125,x1+30,135,OR);atsSym(x1,135,true);t(x1+30,118,`ATS-1  4P ${A}A`,9,'middle','bold');
  ln(x1,167,x1-20,167,OR);ln(x1-20,167,x1-20,205,OR);gen(x1-20,221,16);t(x1+2,218,'DG',9,'start','bold');if(g('dgKva'))t(x1+2,229,`${g('dgKva')} kVA`,8,'start');t(x1+2,240,g('dgCable')||g('utilCable'),8,'start');
  topR=grid(x1+60,yG)}
 ln(85,170,120,170,GR,3);t(85,163,'EARTH BUS',7,'start','bold');
 ln(100,170,100,196,GR,1.5,'5 3');es(100,196);t(100,230,'Isolation panel',8,'middle');t(100,239,'earth',8,'middle');
}else if(og){
bx(80,92,isIso?BE-80:220,98,'8 4');t(85,86,`LOAD DISTRIBUTION BOARD (LOAD DB) — ${ipT('ipIso')}`,9,'start','bold');if(indI)lamps(225,115);
ln(100,115,isIso?BE-20:295,115,OR,4);t(175,105,`LOAD DB BUS ${g('loadBrk')||g('panel')}A`,9,'middle');t(200,165,'No utility connection',8,'middle');
ln(150,115,150,177,OR);
ln(85,170,120,170,GR,3);t(85,163,'EARTH BUS',7,'start','bold');
ln(100,170,100,196,GR,1.5,'5 3');es(100,196);t(100,230,'DB earth',8,'middle'); // grounding point sits OUTSIDE (below) the panel enclosure
}else{
DY=SH;
if(hl){ln(90,125,BE-20,125,OR,5);t(365,113,`ISOLATION PANEL BUSBAR ${g('isoBus')}A`,10,'middle');brk(400,125,`4P ${g('loadBrk')}A`,BT(g('loadBrk')),1);ln(400,177,400,205+AR-SH,OR);t(408,178,g('loadCable'),8);
s.push(`<polygon points="386,${((205+AR)*fy).toFixed(1)} 414,${((205+AR)*fy).toFixed(1)} 400,${((233+AR)*fy).toFixed(1)}" fill="#000"/>`);t(422,224+AR-SH,g('loadName'),11,'start','bold');
ln(BE-20,125,mx-14,125,OR);bx(80,92-SH,BE-80,98+SH,'8 4');ulab(BE,g('utilCable'))}
else{ln(150,125,mx-14,125,OR);bx(80,92-SH,isIso?BE-80:indI?240:170,98+SH,'8 4');ulab(isIso?BE:indI?320:250,g('utilCable'))}
t(85,86-SH,`ISOLATION PANEL — ${ipT('ipIso')}`,10,'start','bold');brk(150,125,`4P ${g('iso')}A`,'ISOLATOR',0);
if(indI)lamps(250,125);
ln(85,170,120,170,GR,3);t(85,163,'EARTH BUS',7,'start','bold');
ln(100,170,100,196,GR,1.5,'5 3');es(100,196);if(SH){t(82,224-SH,'Isolation panel',8,'end');t(82,233-SH,'earth',8,'end')}else{t(100,230,'Isolation panel',8,'middle');t(100,239,'earth',8,'middle')} // grounding point sits OUTSIDE (below) the panel enclosure
DY=0}
ln(150,177+SH,150,248+PD,OR);
const mo=0;
if(isIso){const mc=g('mainCable'),k=mc.indexOf(' (');(k>0?[mc.slice(0,k),mc.slice(k+1)]:[mc]).forEach((p,j,a)=>t(158,216+SH+mo-(a.length-1-j)*11,p,9))}else t(158,216+SH+mo,g('mainCable'),9);
brk(150,248+PD,`4P ${g('panel')}A`,(q=>/ADJ/.test(q)?q:'MAIN '+q)(BT(g('panel'),V.panelI)),1);
if(efrM){const set=efrSet('efrMainSet'),w=efrW(set),y0=256+E1,yc=268+E1;ctc(150,yc);ln(150+CTR,yc,178,yc,'#000',1);const d=relay(178,y0,w,set),yt=y0+d.h-4,yb=248+PD+16; // earth-fault relay INSIDE the main panel outline: CBCT around the incomer, relay trips the main breaker (dashed)
 ln(178,yt,162,yt,'#000',1,'4 3');ln(162,yt,162,yb,'#000',1,'4 3');ln(162,yb,155,yb,'#000',1,'4 3')}
if(efrI){const set=efrSet('efrIsoSet'),w=efrW(set),cxe=Math.max(190,95+w+22),y0=104,yb=125+SH;ctc(cxe,yb);ln(cxe,yb-CTR/fy,cxe,y0+11,'#000',1);ln(cxe,y0+11,95+w,y0+11,'#000',1);const d=relay(95,y0,w,set); // isolation-panel EFR: CBCT on the incoming busbar conductor, relay (with clear space below the panel top) trips the isolator (dashed)
 ln(140,y0+d.h,140,yb+16,'#000',1,'4 3');ln(140,yb+16,146,yb+16,'#000',1,'4 3')}
if(!og){DY=SH;
s.push(`<circle cx="${mx}" cy="${((125+DY)*fy).toFixed(1)}" r="${(14*fy).toFixed(1)}" fill="none" stroke="#000" stroke-width="1.5"/>`);t(mx,129,'kWh',9,'middle');t(mx,150,g('meterLbl'),9,'middle');
ln(mx+14,125,mx+90,125,OR);bx(mx+90,100,80,50);t(mx+130,130,'GRID',13,'middle','bold');DY=0;
}
if(L2){
// ---- Location 2 switchgear panel: sits below the main panel, RIGHT of the main inverters. Its incomer breaker is sized from Location 2's OWN current (loc2panel) and appears at both ends of the interconnecting cable ----
const l2A=g('loc2panel'),l2T=BT(l2A,V.loc2panelI),busY2=300+DY2+PD+E2,arr=busY2-52,srcY=isIso?(og&&!src?115:125+SH):300+PD;
if(isIso){ // straight down from the (extended) isolation panel — nothing to cross
 ln(cx,srcY,cx,srcY+10,OR,2);brk(cx,srcY+10,`4P ${l2A}A`,l2T,1);ln(cx,srcY+62,cx,arr,OR,2)}
else{ln(cx,300+PD,cx,320+PD,OR,2);brk(cx,320+PD,`4P ${l2A}A`,l2T,1);ln(cx,372+PD,cx,arr,OR,2)}
t(cx+8,408+PD,g('loc2cable'),9,'start');
const lastX=n2?Xc(n1+n2-1):cx+60,bL=XPE()-40,bR=n2?lastX+24+50*fs:lastX+18+0.6*11*fs*8;
brk(cx,arr,`4P ${l2A}A`,l2T,1);
// dashed outline only around the busbar and ALL its breakers (incomer + one per unit), exactly like the main panel
bx(bL,arr+2,bR-bL,128,'8 4');{const nm=(V.loc2name||'LOCATION 2').toUpperCase(),full=`${nm} SWITCHGEAR PANEL ${l2A}A`,room=A4W-28-(cx+10); // near the right page edge: two lines (name / panel rating), stacked upwards
 (full.length*0.62*10<=room?[full]:[nm,`SWITCHGEAR PANEL ${l2A}A`]).forEach((q,j,a)=>t(cx+10,arr-4-(a.length-1-j)*12,q,10,'start','bold'))}t(bR-8,arr+16,ipT('ipL2'),10,'end','bold');if(indL)lamps(cx+30,busY2);
ln(cx,busY2,bR-8,busY2,OR,5);
// panel earth: bus bar inside the box with its OWN earth conductor down to Location 2's own earth bus bar (the bar at the bottom, right)
ln(XPE()-35,busY2+64,XPE()+35,busY2+64,GR,3);t(XPE()-32,busY2+50,'PANEL EARTH BUS',9,'start','bold');ln(XPE(),busY2+64,XPE(),yE,GR,1.5,'5 3'); // same geometry as the main panel's earth bus; the earth drop starts at the middle of the bar
wrap(`${V.loc2name||'Location 2'} panel earth`,Math.max(8,Math.floor((3*sh+90)/cwid(10)))).forEach((q,j)=>tc(XPE()+6,busY2+104+j*LP(10),q,10,'start'));
}
if(!L2){ln(120,yE,busEnd,yE,GR,4);t(busEnd,yE-8,'EARTH BUS BAR',11,'end');ln(120,yE,120,yE+28,GR);es(120,yE+28);t(142,yE+40,`${g('earthMain')} — Earth pit  r ≤ ${g('earthR')}Ω`,11)}
else{ // two SEPARATE earth bus bars, each with its own earth pit, tied together by an equipotential bond
const xb1=Xc(n1-1)+12,xp=XPE(),xe2=n2?Xc(cnt-1)+20:xp+90;
const peS=(m=>m?+m[1]:0)(String(g('loc2cable')).match(/(\d+(?:\.\d+)?)\s*mm/)),peN=peS<=16?peS:peS<=35?16:peS/2,pe=peS?[1.5,2.5,4,6,10,16,25,35,50,70,95,120,150,185,240,300].find(v=>v>=peN)||peN:0; // IEC 60364-5-54 Table 54.2: PE = phase size (<=16), 16 (<=35), half (>35) — taken from the interconnecting AC cable
ln(120,yE,xb1,yE,GR,4);xb1-150<132?t(132,yE+16,'LOCATION 1 EARTH BUS BAR',10,'start','bold'):t(xb1,yE+16,'LOCATION 1 EARTH BUS BAR',10,'end','bold');
ln(120,yE,120,yE+28,GR); // (short bar, 1 main unit: the label above is kept clear of this earth-pit riser at x=120)
es(120,yE+28);t(142,yE+40,`${g('earthMain')} — Earth pit  r ≤ ${g('earthR')}Ω`,11);
ln(xb1,yE,xp,yE,GR,2.5);if(xp-xb1>=110){t((xb1+xp)/2,yE-14,pe?`${pe}mm² Cu`:'Earth interconnection',9,'middle');t((xb1+xp)/2,yE-4,pe?'earth interconnection':'',9,'middle')}
ln(xp,yE,xe2,yE,GR,4);t(xp,yE+16,'LOCATION 2 EARTH BUS BAR',10,'start','bold');ln(xe2,yE,xe2,yE+28,GR);es(xe2,yE+28);t(xe2-22,yE+40,`${g('loc2earth')?g('loc2earth')+' — ':''}Earth pit  r ≤ ${g('earthR')}Ω`,11,'end')}
const LY=og&&src?(isIso||topR>1270?262:48):isIso&&mx+170>1270?215:48; // legend drops below the isolation panel when it has been extended far to the right
[[OR,'AC power',''],[BL,'DC power (PV / battery)',''],[GR,'Equipment earthing','5 3'],[GR,'PV array (roof) earthing',''],[MG,'Surge protection','']].concat(efrM||efrI||(og&&src&&!!g('efrIso'))?[['#000','EFR trip signal','4 3']]:[]).forEach(([c,l,d],i)=>{ln(W-300,LY+i*16,W-260,LY+i*16,c,2,d);t(W-250,LY+4+i*16,l,10)});
s.push(`<rect x="4" y="4" width="${W-8}" height="${A4H-8}" fill="none" stroke="#000" stroke-width="2"/>`);
// drawing window: an inner frame around the diagram area, separate from the title block (which sits below it, inside the sheet border)
s.push(FRAME(W));
s.push(`<text xml:space="preserve" x="28" y="42" font-size="15" text-anchor="start" font-weight="bold" fill="#000">${esc('SINGLE LINE DIAGRAM — '+CFGN().toUpperCase()+' — '+g('opt'))}</text>`);
TB(s,W,wp,qty,kwp,title);
return page(s.join(''))}

S.renderBlock = (v, inv, bess, inv2, bess2) => { V = v; INV = inv; BESS = bess || []; INV2 = inv2 || []; BESS2 = bess2 || []; return renderBlock(); };
S.renderSLD = (v, inv, bess, inv2, bess2) => { V = v; INV = inv; BESS = bess || []; INV2 = inv2 || []; BESS2 = bess2 || []; return renderSLD(); };
})(typeof window !== 'undefined' ? window : globalThis);
