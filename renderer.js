/* Draws both diagrams as SVG strings, laid out directly on one fixed A4-landscape sheet.
   The outer border/title block/earth section always sit at the same page position; only the
   repeating inverter/BESS symbols compress (many units) or centre (few units) to fill the space.
   Pure functions: renderBlock(values, inverters, bessUnits) / renderSLD(values, inverters, bessUnits). */
(function (G) {
const S = G.SLD = G.SLD || {};
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let V = {}, INV = [], BESS = [];
const LOGO = G.SLD_LOGO || '';
const g = id => String(V[id] == null ? '' : V[id]).trim();
const CFGN = () => ({ nm: 'Net metering', na: 'Net accounting', np: 'Net plus' }[V.mode] || 'Net metering'), md = () => V.mode || 'nm';
const dfmt = iso => /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split('-').reverse().join('/') : iso;
const units = () => INV.map(u => ({ ...u, kind: 'inv' })).concat(BESS.map(u => ({ ...u, kind: 'bess' })));
const A4W = 1587, A4H = 1123; // fixed A4-landscape page (~135 dpi) — the sheet size never changes
const page = inner => `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${A4W}" height="${A4H}" viewBox="0 0 ${A4W} ${A4H}" font-family="Arial, Helvetica, sans-serif"><rect width="${A4W}" height="${A4H}" fill="#fff"/>${inner}</svg>`;
function TB(t,ln,bx,s,W,yT,wp,qty,kwp,title,fy=1){
const d1=790,d2=W-330,names=INV.map(i=>i.name).concat(BESS.map(b=>'BESS '+b.kwh+' kWh'));
const L=[];let c='';names.forEach(n=>{const x=c?c+' + '+n:n;if(c&&x.length>46){L.push(c+' +');c=n}else c=x});if(c)L.push(c);
bx(10,yT,W-20,105);ln(150,yT,150,yT+105);ln(d1,yT,d1,yT+105);ln(d2,yT,d2,yT+105);
if(LOGO)s.push(`<image href="${LOGO}" xlink:href="${LOGO}" x="18" y="${((yT+6)*fy).toFixed(1)}" width="124" height="${(93*fy).toFixed(1)}" preserveAspectRatio="xMidYMid meet"/>`);
t(165,yT+26,title,14,'start','bold');t(165,yT+52,'SINGLE LINE DIAGRAM',19,'start','bold');t(165,yT+69,'Configuration: '+CFGN(),11,'start','bold');
t(165,yT+84,'Location: '+g('loc'),11,'start');t(165,yT+99,`Drawing No: ${g('dno')}     Revision: ${g('rev')}     Date: ${dfmt(g('date'))}`,11,'start');
t(d1+15,yT+20,'Solar modules:',11,'start','bold');t(d1+15,yT+35,`${wp}W × ${qty} Nos  (${kwp} kWp)`,11,'start');
t(d1+15,yT+53,'Inverters:',11,'start','bold');L.slice(0,4).forEach((l,i)=>t(d1+15,yT+66+i*10.5,l,10,'start'));
[['Designed by',g('designed')],['Drawn by',g('drawn')],['Checked by',g('checked')],['Director / CTO',g('director')],['Project executive',g('exec')]].forEach(([a,b],i)=>t(d2+15,yT+22+i*19,`${a}: ${b}`,11,'start'))}

function renderBlock(){
const U=units(),R=Math.max(1,U.length);
const wp=+g('modWp')||0,qty=INV.reduce((a,i)=>a+i.mods,0),kwp=(qty*wp/1000).toFixed(2),kw=INV.reduce((a,i)=>a+i.kw,0);
const strs=INV.reduce((a,i)=>a+i.strs,0),title=g('proj').replace(/\{kw\}/gi,kwp);
const W=A4W,GR='#0a7a2f',s=[];
const t=(x,y,str,sz=12,a='middle',w='normal')=>s.push(`<text xml:space="preserve" x="${x}" y="${y}" font-size="${sz}" text-anchor="${a}" font-weight="${w}" fill="#000">${esc(str)}</text>`);
const t2=(x,y,str)=>{const k=str.search(/ [(×]/);(k>0?[str.slice(0,k),str.slice(k+1)]:[str]).forEach((p,n,a)=>t(x,y-(a.length-1-n)*10,p,9))};
const ln=(a,b,c,d,col='#000',w=1.5,da='')=>s.push(`<line x1="${a}" y1="${b}" x2="${c}" y2="${d}" stroke="${col}" stroke-width="${w}"${da?` stroke-dasharray="${da}"`:''}/>`);
const bx=(x,y,w,h,da='',sw=1.5)=>s.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#000" stroke-width="${sw}"${da?` stroke-dasharray="${da}"`:''}/>`);
// --- fixed page geometry: these never move, regardless of how many units there are ---
const top=90,TBh=120,yT=A4H-8-TBh,yE=yT-90,rowsBudget=(yE-170)-top;
// rows carrying a hybrid inverter's integrated battery need extra height for the battery sub-box below the inverter
const RH=U.some(u=>u.kind=='inv'&&u.hybrid&&+u.battKwh>0)?225:150;
// --- repeating-row geometry: compress (sv<1) once natural spacing would overflow the budget, else centre ---
const lastNat=(R-1)*RH+45,sv=lastNat<=rowsBudget?1:rowsBudget/lastNat,rowTop=lastNat<=rowsBudget?top+(rowsBudget-lastNat)/2:top,rhUsed=RH*sv;
const yy=(i,v)=>rowTop+i*rhUsed+v*sv,fz=v=>Math.max(6,+(v*sv).toFixed(2));
U.forEach((u,i)=>{const y0=yy(i,0),yc=yy(i,45),B=u.kind=='bess';
bx(40,y0,170,90*sv);
if(!B){t(125,yy(i,24),'PV ARRAY',fz(13),'middle','bold');t(125,yy(i,44),`${u.mods} × ${wp} Wp`,fz(12));t(125,yy(i,61),'Strings: '+u.cfg,fz(10));t(125,yy(i,78),(u.mods*wp/1000).toFixed(2)+' kWp',fz(11))}
else{t(125,yy(i,30),'BATTERY (BESS)',fz(13),'middle','bold');t(125,yy(i,52),u.kwh+' kWh',fz(12));t(125,yy(i,70),u.model,fz(11))}
ln(210,yc,340,yc,B?'#b35a00':'#c00',2);t(275,yc-8*sv,u.dc||'DC cable',fz(9));
bx(340,y0,140,90*sv);
if(!B){t(410,yy(i,22),(INV.length>1?'INVERTER '+(i+1):'INVERTER'),fz(12),'middle','bold');t(410,yy(i,42),u.name,fz(u.name.length>18?9:11));t(410,yy(i,58),u.kw+' kW',fz(11));t(410,yy(i,76),'Integrated DC/AC SPD',fz(9))}
else{t(410,yy(i,24),'BESS PCS'+(BESS.length>1?' '+(i-INV.length+1):''),fz(12),'middle','bold');t(410,yy(i,45),u.kw+' kW',fz(11));t(410,yy(i,62),'Bi-directional',fz(10))}
ln(380,yy(i,90),380,yy(i,105),GR,1.5,'5 3');ln(380,yy(i,105),300,yy(i,105),GR,1.5,'5 3');t(306,yy(i,117),u.earth+(B?' (PCS earth)':''),fz(9),'start');
if(!B){ln(125,yy(i,90),125,yy(i,105)+14,GR,1.5,'5 3');ln(125,yy(i,105)+14,300,yy(i,105)+14,GR,1.5,'5 3');t(190,yy(i,105)+26,'4mm² Cu (PV array earth)',fz(8),'start')}
if(!B&&u.hybrid&&+u.battKwh>0){bx(365,yy(i,130),90,55*sv);ln(410,yy(i,90),410,yy(i,130),'#1f6fd0',2);
t(410,yy(i,145),'BATTERY',fz(9),'middle','bold');t(410,yy(i,159),u.battKwh+' kWh',fz(9),'middle');t(410,yy(i,172),u.battDc||'DC cable',fz(7),'middle');
ln(410,yy(i,185),410,yy(i,197),GR,1.5,'5 3');ln(410,yy(i,197),300,yy(i,197),GR,1.5,'5 3');t(320,yy(i,197)+11,'4mm² Cu (battery earth)',fz(7),'start')}
ln(480,yc,580,yc);t(530,yc-8*sv,u.ac,fz(8));
bx(580,yc-20*sv,60,40*sv);t(610,yc-3*sv,`4P ${u.mccb}A`,fz(11));t(610,yc+12*sv,'MCCB',fz(9));
ln(640,yc,820,yc)});
const bx0=820,yc0=yy(0,45),yL=yy(R-1,45),ym=(yc0+yL)/2;
const pTop=yc0-75,pBot=yL+50,peY=pTop+15,trunkTop=Math.min(yy(0,105),peY);
bx(565,pTop,395,pBot-pTop,'8 4');t(565,pTop-6,`MAIN SWITCHGEAR PANEL ${g('panel')}A`,11,'start','bold');
ln(565,peY,300,peY,GR,1.5,'5 3');t(430,peY-6,'Switchgear panel earth',8,'middle');
ln(bx0,yc0-30,bx0,yL+30,'#000',6);t(bx0,yc0-57,'COMMON COUPLING',10);t(bx0,yc0-45,`BUSBAR ${g('bus')}A`,10);
const hl=md()!='np',ix=1160;
ln(bx0,ym,890,ym);bx(890,ym-20,70,40);t(925,ym-3,`4P ${g('panel')}A`,11);t(925,ym+12,'MAIN MCCB',9);
ln(960,ym,1010,ym);t2(985,ym-27,g('mainCable'));
bx(1010,ym-20,80,40);t(1050,ym-3,`4P ${g('iso')}A`,11);t(1050,ym+12,'ISOLATOR',9);
if(hl){bx(1000,ym-58,200,150,'8 4');t(1000,ym-64,'ISOLATION PANEL',10,'start','bold');ln(1090,ym,ix,ym);ln(ix,ym-30,ix,ym+70,'#000',6);
t(ix,ym-48,'LOAD BUSBAR',9);t(ix,ym-38,`${g('isoBus')}A`,9);ln(ix,ym+70,ix,ym+112);t(ix+8,ym+95,g('loadCable'),8,'start');bx(ix-50,ym+112,100,34);t(ix,ym+134,g('loadName'),12,'middle','bold');ln(ix,ym,1312,ym);t2(1256,ym-8,g('utilCable'))}
else{bx(1000,ym-45,100,85,'8 4');t(1050,ym-51,'ISOLATION PANEL',10,'middle','bold');ln(1090,ym,1312,ym);t2(1200,ym-8,g('utilCable'))}
s.push(`<circle cx="1330" cy="${ym}" r="18" fill="none" stroke="#000" stroke-width="1.5"/>`);t(1330,ym+4,'kWh',10);t(1330,ym+34,g('meterLbl'),9);
ln(1348,ym,1400,ym);bx(1400,ym-25,80,50);t(1440,ym+5,'GRID',13,'middle','bold');
ln(300,trunkTop,300,yE,GR,1.5,'5 3');t(294,yE-40,g('earthMain'),9,'end');
ln(240,yE,600,yE,GR,5);t(420,yE-10,'EARTH BUS BAR',10);
ln(420,yE,420,yE+30,GR,1.5);ln(400,yE+30,440,yE+30,GR,2);ln(407,yE+36,433,yE+36,GR,2);ln(414,yE+42,426,yE+42,GR,2);
t(455,yE+40,`Earth pit   r ≤ ${g('earthR')}Ω`,11,'start');
s.push(`<rect x="4" y="4" width="${W-8}" height="${A4H-8}" fill="none" stroke="#000" stroke-width="2"/>`);
t(20,32,`${qty} panels (×${wp} Wp) — ${strs} strings (${INV.map(i=>i.cfg).join(' | ')}) — ${kwp} kWp DC / ${+kw.toFixed(1)} kW AC${BESS.length?' / '+BESS.reduce((a,b)=>a+ +b.kwh,0)+' kWh BESS':''}`,12,'start');
t(W-20,32,CFGN()+' — '+g('opt'),14,'end','bold');
TB(t,ln,bx,s,W,yT,wp,qty,kwp,title);
return page(s.join(''))}

function renderSLD(){
const U=units(),cnt=Math.max(1,U.length);
const wp=+g('modWp')||0,qty=INV.reduce((a,i)=>a+i.mods,0),kwp=(qty*wp/1000).toFixed(2),title=g('proj').replace(/\{kw\}/gi,kwp);
const OR='#d9822b',BL='#1f6fd0',GR='#0a7a2f',MG='#a020a0',s=[],W=A4W;
// --- fixed vertical layout (native design was 910px tall); stretch everything vertically to fill the fixed A4 page height ---
const fy=A4H/910;
const t=(x,y,str,sz=11,a='start',w='normal')=>s.push(`<text xml:space="preserve" x="${x}" y="${(y*fy).toFixed(1)}" font-size="${sz}" text-anchor="${a}" font-weight="${w}" fill="#000">${esc(str)}</text>`);
const ln=(a,b,c,d,col='#000',w=1.5,da='')=>s.push(`<line x1="${a}" y1="${(b*fy).toFixed(1)}" x2="${c}" y2="${(d*fy).toFixed(1)}" stroke="${col}" stroke-width="${w}"${da?` stroke-dasharray="${da}"`:''}/>`);
const bx=(x,y,w,h,da='',col='#000',sw=1.5)=>s.push(`<rect x="${x}" y="${(y*fy).toFixed(1)}" width="${w}" height="${(h*fy).toFixed(1)}" fill="none" stroke="${col}" stroke-width="${sw}"${da?` stroke-dasharray="${da}"`:''}/>`);
// --- column geometry: compress (sh<1) once natural pitch would overflow the fixed width budget, else centre ---
const PITCH=U.some(u=>u.kind=='inv'&&u.hybrid&&+u.battKwh>0)?290:230; // hybrid units with a battery need extra column width for the battery sub-box
const LEFT0=400,BUDGET=A4W-500,natSpan=(cnt-1)*PITCH,sh=natSpan<=BUDGET-LEFT0?1:(BUDGET-LEFT0)/natSpan,
  colStart=natSpan<=BUDGET-LEFT0?LEFT0+(BUDGET-LEFT0-natSpan)/2:LEFT0,colPitch=PITCH*sh;
const Xc=i=>colStart+i*colPitch,tc=(x,y,str,sz,a,w)=>t(x,y,str,sz*sh,a,w);
const brk=(x,y,l1,l2,mc)=>{ln(x,y,x,y+16,OR);ln(x,y+34,x,y+52,OR);ln(x,y+34,x+10,y+16);ln(x-4,y+12,x+4,y+20);ln(x-4,y+20,x+4,y+12);if(mc)bx(x+1,y+22,7,7,'','#000',1);tc(x+18,y+22,l1,11);tc(x+18,y+35,l2,9)};
const inv=(x,y,l1,l2,l3)=>{bx(x-45*sh,y,90*sh,70);ln(x-45*sh,y+70,x+45*sh,y,'#000',1);t(x-28*sh,y+22,'~',15,'middle');t(x+28*sh,y+62,'=',15,'middle');tc(x+52*sh,y+16,l1,11,'start','bold');tc(x+52*sh,y+31,l2,10);tc(x+52*sh,y+45,l3,10)};
const es=(x,y,c=GR)=>{ln(x,y,x,y+8,c);ln(x-14,y+8,x+14,y+8,c,2);ln(x-9,y+14,x+9,y+14,c,2);ln(x-4,y+20,x+4,y+20,c,2)};
const yE=690;
U.forEach((u,i)=>{const x=Xc(i),B=u.kind=='bess';
ln(x,300,x,320,OR);brk(x,320,`4P ${u.mccb}A`,'MCCB',1);ln(x,372,x,400,OR);tc(x+8*sh,392,u.ac,9);
if(!B){inv(x,400,(INV.length>1?'INVERTER '+(i+1):'INVERTER'),u.name,u.kw+' kW');tc(x+52*sh,459,'Integrated DC/AC SPD',9);
ln(x,470,x,505,BL,2);tc(x-8*sh,492,u.dc||'DC cable',9,'end');
for(let r=0;r<2;r++)for(let c=0;c<3;c++)bx(x-36*sh+c*24*sh,505+r*20,24*sh,20);
tc(x,568,'PV ARRAY',11,'middle','bold');tc(x,581,`${u.mods} × ${wp} Wp`,10,'middle');tc(x,594,'Strings: '+u.cfg,9,'middle');tc(x,607,(u.mods*wp/1000).toFixed(2)+' kWp',10,'middle');
ln(x-36*sh,545,x-65*sh,545,GR,1.5,'5 3');ln(x-65*sh,545,x-65*sh,yE,GR,1.5,'5 3');tc(x-59*sh,675,'4mm² Cu (PV array earth)',7,'start');
if(u.hybrid&&+u.battKwh>0){const bl=x+75*sh;ln(x+40*sh,470,x+40*sh,478,BL,2);ln(x+40*sh,478,bl,478,BL,2);ln(bl,478,bl,505,BL,2);
tc(bl+6*sh,470,u.battDc||'Battery DC cable',6,'start');
bx(bl-25*sh,505,50*sh,45);
[[516,10],[521,5],[526,10],[531,5]].forEach(([by,bw],k)=>ln(bl-bw*sh,by,bl+bw*sh,by,'#000',k%2?4:1.5));
tc(bl,545,u.battKwh+' kWh',7,'middle');tc(bl,565,'BATTERY',8,'middle','bold');
ln(bl+25*sh,505,bl+25*sh,yE,GR,1.5,'5 3');tc(bl+31*sh,620,'4mm² Cu (battery earth)',7,'start')}}
else{inv(x,400,'BESS PCS'+(BESS.length>1?' '+(i-INV.length+1):''),u.kw+' kW','Bi-directional','');
ln(x,470,x,505,BL,2);tc(x+8*sh,492,u.dc||'DC cable',9);bx(x-45*sh,505,90*sh,70);
[[522,18],[530,9],[538,18],[546,9]].forEach(([y,w],k)=>ln(x-w*sh,y,x+w*sh,y,'#000',k%2?4:1.5));
tc(x,566,u.kwh+' kWh',10,'middle');tc(x,592,u.model,11,'middle','bold')}
ln(x-45*sh,435,x-95*sh,435,GR,1.5,'5 3');ln(x-95*sh,435,x-95*sh,yE,GR,1.5,'5 3');tc(x-98*sh,yE-30,u.earth+(B?' (PCS earth)':''),9,'end')});
const spdX=Xc(cnt-1)+150,busEnd=Math.max(spdX+60,A4W-500);
ln(spdX,300,spdX,335,MG);bx(spdX-9,335,18,34,'',MG);ln(spdX-4,343,spdX+4,352,MG);ln(spdX+4,352,spdX-4,361,MG);ln(spdX,369,spdX,395,MG);es(spdX,395,MG);t(spdX+16,356,'SPD Type 1+2',9);
ln(90,300,busEnd,300,OR,5);t((300+busEnd)/2,289,`0.4kV AC COMMON COUPLING BUSBAR ${g('bus')}A  3P+N+PE 400/230V 50Hz`,10,'middle');
bx(80,250,busEnd-70,128,'8 4');t(busEnd,245,`MAIN SWITCHGEAR PANEL ${g('panel')}A`,10,'end','bold');
ln(200,364,320,364,GR,3);t(260,350,'PANEL EARTH BUS',7,'middle','bold');
ln(260,364,260,yE,GR,1.5,'5 3');t(268,534,'Switchgear panel earth',9);
const hl=md()!='np';
if(hl){ln(90,125,640,125,OR,5);t(365,113,`ISOLATION PANEL BUSBAR ${g('isoBus')}A`,10,'middle');brk(400,125,`4P ${g('loadBrk')}A`,'MCCB',1);ln(400,177,400,205,OR);t(408,184,g('loadCable'),8);
s.push(`<polygon points="386,${(205*fy).toFixed(1)} 414,${(205*fy).toFixed(1)} 400,${(233*fy).toFixed(1)}" fill="#000"/>`);t(422,224,g('loadName'),11,'start','bold');
ln(640,125,796,125,OR);bx(80,92,580,98,'8 4');t(725,117,g('utilCable'),9,'middle')}
else{ln(150,125,796,125,OR);bx(80,92,170,98,'8 4');t(473,117,g('utilCable'),9,'middle')}
t(85,86,'ISOLATION PANEL',10,'start','bold');brk(150,125,`4P ${g('iso')}A`,'ISOLATOR',0);ln(150,177,150,248,OR);t(158,208,g('mainCable'),8);
brk(150,248,`4P ${g('panel')}A`,'MAIN MCCB',1);
s.push(`<circle cx="810" cy="${(125*fy).toFixed(1)}" r="${(14*fy).toFixed(1)}" fill="none" stroke="#000" stroke-width="1.5"/>`);t(810,129,'kWh',9,'middle');t(810,150,g('meterLbl'),9,'middle');
ln(824,125,900,125,OR);bx(900,100,80,50);t(940,130,'GRID',13,'middle','bold');
ln(120,yE,busEnd,yE,GR,4);t(busEnd,yE-8,'EARTH BUS BAR',10,'end');ln(200,yE,200,yE+28,GR);es(200,yE+28);t(222,yE+40,`${g('earthMain')} — Earth pit  r ≤ ${g('earthR')}Ω`,10);
[[OR,'AC power'],[BL,'DC power (PV / battery)'],[GR,'Earthing'],[MG,'Surge protection']].forEach(([c,l],i)=>{ln(W-300,48+i*16,W-260,48+i*16,c,2);t(W-250,52+i*16,l,10)});
t(20,30,'SINGLE LINE DIAGRAM — '+CFGN().toUpperCase()+' — '+g('opt'),15,'start','bold');
const yT=yE+100;
s.push(`<rect x="4" y="4" width="${W-8}" height="${A4H-8}" fill="none" stroke="#000" stroke-width="2"/>`);
TB(t,ln,bx,s,W,yT,wp,qty,kwp,title,fy);
return page(s.join(''))}

S.renderBlock = (v, inv, bess) => { V = v; INV = inv; BESS = bess || []; return renderBlock(); };
S.renderSLD = (v, inv, bess) => { V = v; INV = inv; BESS = bess || []; return renderSLD(); };
})(typeof window !== 'undefined' ? window : globalThis);
