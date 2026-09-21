/* Draws both diagrams as SVG strings. Pure functions: renderBlock(values, inverters) / renderSLD(values, inverters). */
(function (G) {
const S = G.SLD = G.SLD || {};
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let V = {}, INV = [];
const LOGO = G.SLD_LOGO || '';
const g = id => String(V[id] == null ? '' : V[id]).trim();
const CFGN=()=>({nm:'Net metering',na:'Net accounting',np:'Net plus'}[V.mode]||'Net metering'),md=()=>V.mode||'nm';
function TB(t,ln,bx,s,W,yT,wp,qty,kwp,bess){
const d1=790,d2=W-330,names=INV.map(i=>i.name);if(bess)names.push('BESS '+g('bessKwh')+' kWh');
const L=[];let c='';names.forEach(n=>{const x=c?c+' + '+n:n;if(c&&x.length>46){L.push(c+' +');c=n}else c=x});if(c)L.push(c);
bx(10,yT,W-20,105);ln(150,yT,150,yT+105);ln(d1,yT,d1,yT+105);ln(d2,yT,d2,yT+105);
if(LOGO)s.push(`<image href="${LOGO}" xlink:href="${LOGO}" x="18" y="${yT+6}" width="124" height="93" preserveAspectRatio="xMidYMid meet"/>`);
t(165,yT+26,g('proj'),14,'start','bold');t(165,yT+52,'SINGLE LINE DIAGRAM',19,'start','bold');t(165,yT+69,'Configuration: '+CFGN(),11,'start','bold');
t(165,yT+84,'Location: '+g('loc'),11,'start');t(165,yT+99,`Drawing No: ${g('dno')}     Revision: ${g('rev')}     Date: ${g('date')}`,11,'start');
t(d1+15,yT+20,'Solar modules:',11,'start','bold');t(d1+15,yT+35,`${wp}W × ${qty} Nos  (${kwp} kWp)`,11,'start');
t(d1+15,yT+53,'Inverters:',11,'start','bold');L.slice(0,4).forEach((l,i)=>t(d1+15,yT+66+i*10.5,l,10,'start'));
[['Designed by',g('designed')],['Drawn by',g('drawn')],['Checked by',g('checked')],['Director / CTO',g('director')],['Project executive',g('exec')]].forEach(([a,b],i)=>t(d2+15,yT+22+i*19,`${a}: ${b}`,11,'start'))}
function renderBlock(){
const n=INV.length,bess=parseFloat(g('bessKwh'))>0,R=n+(bess?1:0);
const wp=+g('modWp')||0,qty=INV.reduce((a,i)=>a+i.mods,0),kwp=(qty*wp/1000).toFixed(2),kw=INV.reduce((a,i)=>a+i.kw,0);
const strs=INV.reduce((a,i)=>a+i.strs,0);
const W=1500,top=90,rh=150,bx0=820,GR='#0a7a2f',s=[];
const t=(x,y,str,sz=12,a='middle',w='normal')=>s.push(`<text xml:space="preserve" x="${x}" y="${y}" font-size="${sz}" text-anchor="${a}" font-weight="${w}" fill="#000">${esc(str)}</text>`);
const t2=(x,y,str)=>{const k=str.search(/ [(×]/);(k>0?[str.slice(0,k),str.slice(k+1)]:[str]).forEach((p,n,a)=>t(x,y-(a.length-1-n)*10,p,9))};
const ln=(a,b,c,d,col='#000',w=1.5,da='')=>s.push(`<line x1="${a}" y1="${b}" x2="${c}" y2="${d}" stroke="${col}" stroke-width="${w}"${da?` stroke-dasharray="${da}"`:''}/>`);
const bx=(x,y,w,h,da='',sw=1.5)=>s.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#000" stroke-width="${sw}"${da?` stroke-dasharray="${da}"`:''}/>`);
const yc0=top+45,yL=top+(R-1)*rh+45,ym=(yc0+yL)/2;
for(let i=0;i<R;i++){const y=top+i*rh,yc=y+45,B=bess&&i==n,I=INV[i]||{};
bx(40,y,170,90);
if(!B){t(125,y+24,'PV ARRAY',13,'middle','bold');t(125,y+44,`${I.mods} × ${wp} Wp`);t(125,y+61,'Strings: '+I.cfg,10);t(125,y+78,(I.mods*wp/1000).toFixed(2)+' kWp',11)}
else{t(125,y+30,'BATTERY (BESS)',13,'middle','bold');t(125,y+52,g('bessKwh')+' kWh');t(125,y+70,g('bessModel'),11)}
ln(210,yc,340,yc,B?'#b35a00':'#c00',2);t(275,yc-8,B?'DC cable':g('dcCable'),9);
bx(340,y,140,90);
if(!B){t(410,y+22,'INVERTER '+(n>1?i+1:''),12,'middle','bold');t(410,y+42,I.name,I.name.length>18?9:11);t(410,y+58,I.kw+' kW',11);t(410,y+76,'Integrated DC/AC SPD',9)}
else{t(410,y+24,'BESS PCS',12,'middle','bold');t(410,y+45,g('bessKw')+' kW',11);t(410,y+62,'Bi-directional',10)}
ln(380,y+90,380,y+105,GR,1.5,'5 3');ln(380,y+105,300,y+105,GR,1.5,'5 3');t(306,y+117,(B?g('earthSmall'):I.earth),9,'start');
ln(480,yc,580,yc);t(530,yc-8,(B?g('bessAc'):I.ac),8);
bx(580,yc-20,60,40);t(610,yc-3,`4P ${B?g('bessMccb'):I.mccb}A`,11);t(610,yc+12,'MCCB',9);
ln(640,yc,bx0,yc)}
bx(565,top-30,305,yL-top+80,'8 4');t(565,top-36,`MAIN SWITCHGEAR PANEL ${g('panel')}A`,11,'start','bold');
ln(bx0,yc0-30,bx0,yL+30,'#000',6);t(bx0,top-12,'COMMON COUPLING',10);t(bx0,top,`BUSBAR ${g('bus')}A`,10);
const hl=md()!='np',ix=1160;
ln(bx0,ym,1010,ym);t2(940,ym-8,g('mainCable'));
bx(1010,ym-20,80,40);t(1050,ym-3,`4P ${g('iso')}A`,11);t(1050,ym+12,'ISOLATOR',9);
if(hl){bx(1000,ym-58,200,150,'8 4');t(1000,ym-64,'ISOLATION PANEL',10,'start','bold');ln(1090,ym,ix,ym);ln(ix,ym-30,ix,ym+70,'#000',6);
t(ix,ym-48,'LOAD BUSBAR',9);t(ix,ym-38,`${g('isoBus')}A`,9);ln(ix,ym+70,ix,ym+112);bx(ix-50,ym+112,100,34);t(ix,ym+134,g('loadName'),12,'middle','bold');ln(ix,ym,1312,ym);t2(1256,ym-8,g('utilCable'))}
else{bx(1000,ym-45,100,85,'8 4');t(1050,ym-51,'ISOLATION PANEL',10,'middle','bold');ln(1090,ym,1312,ym);t2(1200,ym-8,g('utilCable'))}
s.push(`<circle cx="1330" cy="${ym}" r="18" fill="none" stroke="#000" stroke-width="1.5"/>`);t(1330,ym+4,'kWh',10);t(1330,ym+34,g('meterLbl'),9);
ln(1348,ym,1400,ym);bx(1400,ym-25,80,50);t(1440,ym+5,'GRID',13,'middle','bold');
const yE=yL+170;
ln(300,top+105,300,yE,GR,1.5,'5 3');t(294,yE-40,g('earthMain'),9,'end');
ln(240,yE,600,yE,GR,5);t(420,yE-10,'EARTH BUS BAR',10);
ln(420,yE,420,yE+30,GR,1.5);ln(400,yE+30,440,yE+30,GR,2);ln(407,yE+36,433,yE+36,GR,2);ln(414,yE+42,426,yE+42,GR,2);
t(455,yE+40,`Earth pit   r ≤ ${g('earthR')}Ω`,11,'start');
const yT=yE+90,H=yT+120;
s.push(`<rect x="4" y="4" width="${W-8}" height="${H-8}" fill="none" stroke="#000" stroke-width="2"/>`);
t(20,32,`${qty} panels (×${wp} Wp) — ${strs} strings (${INV.map(i=>i.cfg).join(' | ')}) — ${kwp} kWp DC / ${+kw.toFixed(1)} kW AC${bess?' / '+g('bessKwh')+' kWh BESS':''}`,12,'start');
t(W-20,32,CFGN()+' — '+g('opt'),14,'end','bold');
TB(t,ln,bx,s,W,yT,wp,qty,kwp,bess);
return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${W} ${H}" font-family="Arial, Helvetica, sans-serif"><rect width="${W}" height="${H}" fill="#fff"/>${s.join('')}</svg>`}

function renderSLD(){
const n=INV.length,bess=parseFloat(g('bessKwh'))>0;
const wp=+g('modWp')||0,qty=INV.reduce((a,i)=>a+i.mods,0),kwp=(qty*wp/1000).toFixed(2),kw=INV.reduce((a,i)=>a+i.kw,0);
const OR='#d9822b',BL='#1f6fd0',GR='#0a7a2f',MG='#a020a0',s=[];
const t=(x,y,str,sz=11,a='start',w='normal')=>s.push(`<text xml:space="preserve" x="${x}" y="${y}" font-size="${sz}" text-anchor="${a}" font-weight="${w}" fill="#000">${esc(str)}</text>`);
const ln=(a,b,c,d,col='#000',w=1.5,da='')=>s.push(`<line x1="${a}" y1="${b}" x2="${c}" y2="${d}" stroke="${col}" stroke-width="${w}"${da?` stroke-dasharray="${da}"`:''}/>`);
const bx=(x,y,w,h,da='',col='#000',sw=1.5)=>s.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${col}" stroke-width="${sw}"${da?` stroke-dasharray="${da}"`:''}/>`);
const brk=(x,y,l1,l2,mc)=>{ln(x,y,x,y+16,OR);ln(x,y+34,x,y+52,OR);ln(x,y+34,x+10,y+16);ln(x-4,y+12,x+4,y+20);ln(x-4,y+20,x+4,y+12);if(mc)bx(x+1,y+22,7,7,'','#000',1);t(x+18,y+22,l1,11);t(x+18,y+35,l2,9)};
const inv=(x,y,l1,l2,l3)=>{bx(x-45,y,90,70);ln(x-45,y+70,x+45,y,'#000',1);t(x-28,y+22,'~',15,'middle');t(x+28,y+62,'=',15,'middle');t(x+52,y+16,l1,11,'start','bold');t(x+52,y+31,l2,10);t(x+52,y+45,l3,10)};
const es=(x,y,c=GR)=>{ln(x,y,x,y+8,c);ln(x-14,y+8,x+14,y+8,c,2);ln(x-9,y+14,x+9,y+14,c,2);ln(x-4,y+20,x+4,y+20,c,2)};
const yE=690,cols=n+(bess?1:0),spdX=400+cols*230-80,busEnd=Math.max(spdX+60,980),W=Math.max(1400,busEnd+120);
for(let i=0;i<cols;i++){const x=400+i*230,B=bess&&i==n,I=INV[i]||{};
ln(x,300,x,320,OR);brk(x,320,`4P ${B?g('bessMccb'):I.mccb}A`,'MCCB',1);ln(x,372,x,400,OR);t(x+8,392,(B?g('bessAc'):I.ac),9);
if(!B){inv(x,400,'INVERTER '+(n>1?i+1:''),I.name,I.kw+' kW');t(x+52,459,'Integrated DC/AC SPD',9);
ln(x,470,x,505,BL,2);t(x+8,492,g('dcCable'),9);
for(let r=0;r<2;r++)for(let c=0;c<3;c++)bx(x-36+c*24,505+r*20,24,20);
t(x,568,'PV ARRAY',11,'middle','bold');t(x,581,`${I.mods} × ${wp} Wp`,10,'middle');t(x,594,'Strings: '+I.cfg,9,'middle');t(x,607,(I.mods*wp/1000).toFixed(2)+' kWp',10,'middle')}
else{inv(x,400,'BESS PCS',g('bessKw')+' kW','Bi-directional','');
ln(x,470,x,505,BL,2);t(x+8,492,'DC cable',9);bx(x-45,505,90,70);
[[522,18],[530,9],[538,18],[546,9]].forEach(([y,w],k)=>ln(x-w,y,x+w,y,'#000',k%2?4:1.5));
t(x,566,g('bessKwh')+' kWh',10,'middle');t(x,592,g('bessModel'),11,'middle','bold')}
ln(x-45,435,x-65,435,GR,1.5,'5 3');ln(x-65,435,x-65,yE,GR,1.5,'5 3');t(x-68,yE-30,(B?g('earthSmall'):I.earth),9,'end')}
ln(spdX,300,spdX,335,MG);bx(spdX-9,335,18,34,'',MG);ln(spdX-4,343,spdX+4,352,MG);ln(spdX+4,352,spdX-4,361,MG);ln(spdX,369,spdX,395,MG);es(spdX,395,MG);t(spdX+16,356,'SPD Type 1+2',9);
ln(90,300,busEnd,300,OR,5);t((300+busEnd)/2,289,`0.4kV AC COMMON COUPLING BUSBAR ${g('bus')}A  3P+N+PE 400/230V 50Hz`,10,'middle');
bx(80,250,busEnd-70,128,'8 4');t(busEnd,245,`MAIN SWITCHGEAR PANEL ${g('panel')}A`,10,'end','bold');
const hl=md()!='np';
if(hl){ln(90,125,640,125,OR,5);t(365,113,`ISOLATION PANEL BUSBAR ${g('isoBus')}A`,10,'middle');brk(400,125,`4P ${g('loadBrk')}A`,'MCCB',1);ln(400,177,400,205,OR);
s.push(`<polygon points="386,205 414,205 400,233" fill="#000"/>`);t(422,224,g('loadName'),11,'start','bold');
ln(640,125,796,125,OR);bx(80,92,580,98,'8 4');t(725,117,g('utilCable'),9,'middle')}
else{ln(150,125,796,125,OR);bx(80,92,170,98,'8 4');t(473,117,g('utilCable'),9,'middle')}
t(85,86,'ISOLATION PANEL',10,'start','bold');brk(150,125,`4P ${g('iso')}A`,'ISOLATOR',0);ln(150,177,150,300,OR);t(158,232,g('mainCable'),9);
s.push(`<circle cx="810" cy="125" r="14" fill="none" stroke="#000" stroke-width="1.5"/>`);t(810,129,'kWh',9,'middle');t(810,150,g('meterLbl'),9,'middle');
ln(824,125,900,125,OR);bx(900,100,80,50);t(940,130,'GRID',13,'middle','bold');
ln(120,yE,busEnd,yE,GR,4);t(busEnd,yE-8,'EARTH BUS BAR',10,'end');ln(200,yE,200,yE+28,GR);es(200,yE+28);t(222,yE+40,`${g('earthMain')} — Earth pit  r ≤ ${g('earthR')}Ω`,10);
[[OR,'AC power'],[BL,'DC power (PV / battery)'],[GR,'Earthing'],[MG,'Surge protection']].forEach(([c,l],i)=>{ln(W-300,48+i*16,W-260,48+i*16,c,2);t(W-250,52+i*16,l,10)});
t(20,30,'SINGLE LINE DIAGRAM — '+CFGN().toUpperCase()+' — '+g('opt'),15,'start','bold');
const yT=yE+100,H=yT+120;
s.push(`<rect x="4" y="4" width="${W-8}" height="${H-8}" fill="none" stroke="#000" stroke-width="2"/>`);
TB(t,ln,bx,s,W,yT,wp,qty,kwp,bess);
return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${W} ${H}" font-family="Arial, Helvetica, sans-serif"><rect width="${W}" height="${H}" fill="#fff"/>${s.join('')}</svg>`}

S.renderBlock = (v, i) => { V = v; INV = i; return renderBlock(); };
S.renderSLD = (v, i) => { V = v; INV = i; return renderSLD(); };
})(typeof window !== 'undefined' ? window : globalThis);
