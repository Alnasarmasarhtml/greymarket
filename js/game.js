/* ============================================================
   GREYMARKET 墨市 — idle smuggling terminal
   vanilla JS · no build step · localStorage save
   ============================================================ */
(() => {
'use strict';

/* ---------- tiny helpers ---------- */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp  = (a, b, t) => a + (b - a) * t;
const now   = () => Date.now();
const rnd   = (a, b) => a + Math.random() * (b - a);
const SVGNS = 'http://www.w3.org/2000/svg';
const svgEl = (n, attrs = {}) => { const e = document.createElementNS(SVGNS, n); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };

function fmt(n){
  n = Math.floor(n);
  if (n < 1000) return '' + n;
  if (n < 1e6)  return (n/1e3).toFixed(n<1e4?2:1).replace(/\.0+$/,'') + 'K';
  if (n < 1e9)  return (n/1e6).toFixed(2).replace(/\.0+$/,'') + 'M';
  return (n/1e9).toFixed(2) + 'B';
}
const fmt2 = n => n.toFixed(3);

/* ---------- config ---------- */
const CFG = {
  BASE_PRICE: 1.0,
  IMPACT: 1.65,            // price-impact exponent on (1-congestion)
  BATCH_BASE: 12,          // seconds per batch
  BATCH_MIN: 5,
  OWN_IMPACT: 0.55,        // how hard your own sell stains the berth (per cargo unit / pooldepth)
  POOL_DEPTH: 150,
  OFFLINE_CAP_H: 12,
  SAVE_KEY: 'greymarket.save.v1',
};

const PORTS = [
  { key:'KOBE', name:'KOBE',     kanji:'神戸', kana:'コウベ' },
  { key:'SHMZ', name:'SHIMIZU',  kanji:'清水', kana:'シミズ' },
  { key:'YKHM', name:'YOKOHAMA', kanji:'横浜', kana:'ヨコハマ' },
  { key:'NGSK', name:'NAGASAKI', kanji:'長崎', kana:'ナガサキ' },
  { key:'HKT',  name:'HAKATA',   kanji:'博多', kana:'ハカタ' },
  { key:'OTR',  name:'OTARU',    kanji:'小樽', kana:'オタル' },
];

const UPGRADES = [
  { id:'hauler',    k:'輸', name:'HAULER',     desc:'Another truck on the route. More goods, every second.',
    cost:s=>80*Math.pow(1.6, s.haulers-1),            cur:'cash', buy:s=>s.haulers++ },
  { id:'through',   k:'流', name:'THROUGHPUT',  desc:'Heavier loads per hauler. Raises flow across the fleet.',
    cost:s=>120*Math.pow(1.7, s.throughLv-1),          cur:'cash', buy:s=>s.throughLv++ },
  { id:'cargo',     k:'庫', name:'CARGO HOLD',  desc:'Bigger holds. Hoard more goods before a forced sell.',
    cost:s=>90*Math.pow(1.6, s.cargoLv),               cur:'cash', buy:s=>s.cargoLv++ },
  { id:'discretion',k:'隠', name:'DISCRETION',  desc:'Move quiet. Your own sells dent the price less, so you crash your own payout less.',
    cost:s=>150*Math.pow(1.85, s.discLv),              cur:'cash', buy:s=>s.discLv++,  max:6 },
  { id:'batch',     k:'速', name:'FENCE SPEED', desc:'Faster batches. The floor clears more often.',
    cost:s=>240*Math.pow(2.0, s.batchLv),              cur:'cash', buy:s=>s.batchLv++, max:6 },
  { id:'intel',     k:'諜', name:'INTEL NET',   desc:'Reveals the forecast: which empty port is about to flood — and, higher up, how hard. This is the edge.',
    cost:s=>1.0*Math.pow(2.0, s.intelLv),              cur:'grey', buy:s=>s.intelLv++, max:4 },
];

/* ---------- state ---------- */
const DEFAULT = () => ({
  cash:0, grey:0,
  goods:0,
  haulers:1, throughLv:1, cargoLv:0, discLv:0, batchLv:0, intelLv:0,
  ports:null,           // runtime, not persisted directly
  lastSeen:now(),
  standing:false,
  selected:null,
  lifetimeYield:0,
});
let S = DEFAULT();

const flowPerSec = () => S.haulers * S.throughLv * 0.9;
const cargoCap   = () => 80 + S.cargoLv * 60;
const batchPeriod= () => Math.max(CFG.BATCH_MIN, CFG.BATCH_BASE - S.batchLv * 1.2);
const ownImpactK = () => CFG.OWN_IMPACT * Math.pow(0.82, S.discLv);

/* ---------- ports runtime ---------- */
function seedPorts(){
  S.ports = PORTS.map((p,i)=>({
    ...p,
    c: rnd(0.15,0.6),            // congestion 0..1
    target: rnd(0.2,0.6),        // crowd drift target
    next: 0,                     // upcoming congestion delta (the forecast)
    demand: 1.0,                 // hidden rotating demand window
    phase: Math.random()*Math.PI*2,
    speed: rnd(0.05,0.12),
  }));
  planNextBatch();
}
// demand windows oscillate slowly (the deep, discoverable edge)
function demandAt(p, t){ return 1.0 + 0.32*Math.sin(t*p.speed + p.phase); }

// decide the crowd's next move (forecast) for each port
function planNextBatch(){
  const surgeIdx = Math.floor(Math.random()*S.ports.length);
  S.ports.forEach((p,i)=>{
    let delta = rnd(-0.18,0.18);
    if (i === surgeIdx) delta = rnd(0.28,0.46);     // one port floods
    p.next = clamp(p.c + delta, 0.04, 0.98) - p.c;  // store as delta
  });
}

/* price a sell of `amount` goods into port p at congestion c */
function priceSell(p, c, amount){
  const own = ownImpactK() * amount / CFG.POOL_DEPTH;     // your stain
  const cEff = clamp(c + own*0.5, 0, 0.985);              // pay across your own impact
  const unit = CFG.BASE_PRICE * p.demand * Math.pow(1 - cEff, CFG.IMPACT);
  return { revenue: amount * unit * 4.2, unit, own, cEff };
}

/* ============================================================
   MANIFOLD renderer (SVG instrument)
   ============================================================ */
function Manifold(host, opts={}){
  const TPP = 4;                    // ticks per port
  const N = PORTS.length * TPP;
  const svg = svgEl('svg', { viewBox:'0 0 480 120', preserveAspectRatio:'none' });
  const gTicks = svgEl('g'); const curve = svgEl('path', { class:'mf-curve' });
  const gLabels = svgEl('g');
  svg.append(gTicks, curve, gLabels);
  host.innerHTML=''; host.append(svg);
  const ticks=[];
  const W=480,H=120,pad=8;
  for(let i=0;i<N;i++){
    const x = pad + (W-2*pad) * (i/(N-1));
    const t = svgEl('rect',{ class:'mf-tick', x:x.toFixed(1), width:'2', y:H, height:'0' });
    gTicks.append(t); ticks.push(t);
  }
  const labels=[];
  if(opts.labels){
    PORTS.forEach((p,i)=>{
      const x = pad + (W-2*pad) * ((i*TPP + TPP/2 - .5)/(N-1));
      const l = svgEl('text',{ class:'mf-label', x:x.toFixed(1), y:H-4, 'text-anchor':'middle' });
      l.textContent = p.kana.slice(0,3);
      gLabels.append(l); labels.push(l);
    });
  }
  return { draw(){
    const sel = S.selected;
    const pts=[];
    for(let i=0;i<N;i++){
      const pi = Math.floor(i/TPP);
      const p = S.ports[pi];
      const jitter = (Math.sin(i*1.7 + (window.__t||0)*0.6)*0.5+0.5)*0.06;
      const cong = clamp(p.c + jitter - 0.03, 0, 1);
      const h = 6 + cong * (H-26);
      ticks[i].setAttribute('y', (H-h).toFixed(1));
      ticks[i].setAttribute('height', h.toFixed(1));
      const isSel = sel===pi;
      ticks[i].setAttribute('class','mf-tick'+(isSel?' mf-sel':''));
      ticks[i].setAttribute('opacity', isSel?1:(p.c>0.66?0.32:0.7));
      // yield curve point: high yield (1-c) high on screen
      const yld = Math.pow(1-cong, CFG.IMPACT);
      const x = pad + (W-2*pad)*(i/(N-1));
      pts.push([x, 12 + (1-yld)*(H-40)]);
    }
    curve.setAttribute('d', pts.map((p,i)=> (i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' '));
    if(opts.labels) labels.forEach((l,i)=>{
      l.setAttribute('class','mf-label'+(S.ports[i].c<0.4?' hot':''));
    });
  }};
}

/* ============================================================
   PORT GRID renderer
   ============================================================ */
let portEls=[];
function buildGrid(){
  const grid = $('#portGrid'); grid.innerHTML='';
  portEls = S.ports.map((p,i)=>{
    const el=document.createElement('button');
    el.className='port'; el.dataset.i=i;
    el.innerHTML = `
      <div class="port__blot" aria-hidden="true">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none">
          <circle class="port__blob" cx="50" cy="52" r="20" filter="url(#rough)"></circle>
          <circle class="port__ghost" cx="50" cy="52" r="22"></circle>
        </svg>
      </div>
      <span class="signal" aria-hidden="true"></span>
      <div class="port__top">
        <span class="port__name">${p.name}</span>
        <span class="port__kanji" lang="ja">${p.kanji}</span>
      </div>
      <div class="port__bot">
        <span class="port__thru" data-thru>THRU —</span>
        <span class="port__yield" data-yield title="payout strength · ↑ empty &amp; good, ↓ crowded &amp; bad">↑ —</span>
      </div>
      <span class="port__state" data-state lang="ja"></span>`;
    el.addEventListener('click', ()=> selectPort(i));
    el.addEventListener('mouseenter', ()=> cursorHot(true));
    el.addEventListener('mouseleave', ()=> cursorHot(false));
    grid.append(el);
    return {
      el,
      blob: el.querySelector('.port__blob'),
      ghost: el.querySelector('.port__ghost'),
      thru: el.querySelector('[data-thru]'),
      yld: el.querySelector('[data-yield]'),
      state: el.querySelector('[data-state]'),
    };
  });
}

function drawGrid(){
  S.ports.forEach((p,i)=>{
    const e = portEls[i]; if(!e) return;
    const r = 14 + p.c*40;
    e.blob.setAttribute('r', r.toFixed(1));
    e.blob.setAttribute('opacity', (0.5 + p.c*0.5).toFixed(2));
    const yld = Math.pow(1-p.c, CFG.IMPACT);
    e.thru.textContent = `CROWD ${Math.round(p.c*100)}%`;
    const up = yld >= 0.5;
    e.yld.textContent = `${up?'↑':'↓'} ${(yld*100).toFixed(0)}`;
    // state class
    e.el.classList.toggle('soaked', p.c > 0.66);
    e.el.classList.toggle('dry', p.c < 0.34);
    // forecast (intel-gated)
    const showGhost = S.intelLv>0 && p.next > (0.22 - S.intelLv*0.03);
    e.el.classList.toggle('incoming', showGhost);
    e.ghost.setAttribute('r', (r + 8).toFixed(1));
    // state label
    let label = p.c>0.66 ? '密 SOAKED' : p.c<0.34 ? '乾 DRY' : '混 OPEN';
    if(showGhost) label = '兆 INCOMING';
    if(S.intelLv>=3 && p.next>0.1) label += ` +${Math.round(p.next*100)}`;
    e.state.textContent = label;
    e.el.classList.toggle('selected', S.selected===i);
  });
  // J2 — one heartbeat on the single best-paying DRY port: the answer to "where do I click?"
  let best=-1, bi=-1;
  S.ports.forEach((p,i)=>{ const y=Math.pow(1-p.c,CFG.IMPACT); if(p.c<0.34 && y>best){ best=y; bi=i; } });
  portEls.forEach((e,i)=> e.el.classList.toggle('pays-best', i===bi && commitCount<3));
}

/* ============================================================
   SELECT / COMMIT / RESOLVE
   ============================================================ */
let pending=null;       // {portIdx, amount}
let sealing=false;
// FTUE coach + catchy-effect state
let commitCount=0, coachStep=-1, coachAwaitResolve=false, coachCleanup=[];
let _lastFlood=0;

function selectPort(i){
  if(sealing) return;
  S.selected = i;
  drawGrid();
  refreshCommit();
}

function currentAmount(){
  const pct = (+$('#amtRange').value)/100;
  return Math.floor(S.goods * pct);
}

function refreshCommit(){
  const has = S.selected!=null;
  const p = has ? S.ports[S.selected] : null;
  $('#commitBerth').textContent = has ? p.name : '— —';
  $('#commitBtn').disabled = !has || S.goods<1 || sealing;
  const amt = currentAmount();
  $('#amtVal').textContent = fmt(amt);
  if(has){
    const yld = Math.pow(1-p.c, CFG.IMPACT);
    let fc = S.intelLv===0
      ? 'LOCKED'
      : (p.next>0.12 ? 'FLOODING ▲' : p.next<-0.1 ? 'EMPTYING ▼' : 'STEADY ─');
    $('#commitStat').textContent = `CROWD ${Math.round(p.c*100)}% · PAYS ${(yld*100).toFixed(0)} · NEXT ${fc}`;
    const est = priceSell(p, p.c, amt).revenue;
    $('#estYield').textContent = '¥ '+fmt(est);
    $('#commitState').textContent = sealing ? 'SEALED · WAIT' : 'READY · seal it';
  } else {
    $('#commitStat').textContent = 'CROWD — · PAYS — · NEXT —';
    $('#estYield').textContent = '¥ —';
    $('#commitState').textContent = 'PICK A PORT — sell blind, clears next batch';
  }
}

function commitSell(){
  if(S.selected==null || S.goods<1 || sealing) return;
  const amount = currentAmount();
  if(amount<1) return;
  pending = { portIdx:S.selected, amount };
  commitCount++;
  S.goods -= amount;
  sealing = true;
  // STAMP the button
  const btn=$('#commitBtn'); btn.classList.add('stamp'); setTimeout(()=>btn.classList.remove('stamp'),160);
  // SEAL the panel
  const sealed=$('#sealed'); sealed.classList.add('show'); sealed.setAttribute('aria-hidden','false');
  refreshCommit();
  drawHUD();
}

function resolveBatch(){
  // 1) advance the crowd: apply the planned deltas, then re-randomise demand + next
  const t = (now())/1000;
  let floodIdx=-1, floodMax=0;
  S.ports.forEach((p,i)=>{
    if(p.next>floodMax){ floodMax=p.next; floodIdx=i; }
    p.c = clamp(p.c + p.next, 0.03, 0.99);
    p.demand = demandAt(p, t);
  });

  // 2) resolve a pending manual commit OR a standing order
  let result=null;
  if(pending){
    const p = S.ports[pending.portIdx];
    const r = priceSell(p, p.c, pending.amount);
    p.c = clamp(p.c + r.own, 0, 0.99);          // your stain lands
    result = { portIdx:pending.portIdx, revenue:r.revenue, amount:pending.amount, manual:true };
    pending=null;
  } else if(S.standing && S.goods>=1){
    // automation: dumps into the CURRENTLY quietest berth — no foresight
    let qi=0,qc=2; S.ports.forEach((p,i)=>{ if(p.c<qc){qc=p.c;qi=i;} });
    const amount=Math.floor(S.goods*0.85); S.goods-=amount;
    const p=S.ports[qi]; const r=priceSell(p,p.c,amount);
    p.c=clamp(p.c+r.own,0,0.99);
    result={ portIdx:qi, revenue:r.revenue, amount, manual:false };
  }

  // 3) plan the NEXT crowd move (this is what intel previews)
  planNextBatch();

  // 4) bank + reveal
  if(result){
    const grey = Math.max(0.004, result.revenue/3000);
    S.cash += result.revenue; S.grey += grey; S.lifetimeYield += result.revenue;
    doReveal(result);
  } else {
    drawGrid(); refreshCommit();
  }

  // 5) un-seal
  sealing=false;
  const sealed=$('#sealed'); sealed.classList.remove('show'); sealed.setAttribute('aria-hidden','true');
  drawHUD();

  // J3 — one self-erasing "the crowd just flooded X" line (gated + throttled, --wet ink only)
  floodTicker(floodIdx, result);
}

/* the DRY-QUADRANT REVEAL — dries the crowd, fires the inversion flash, blooms the win */
function doReveal(result){
  drawGrid();
  // inversion flash
  const flash=$('#flash');
  flash.classList.remove('fire'); void flash.offsetWidth; flash.classList.add('fire');
  // bloom the resolved port
  const pe = portEls[result.portIdx];
  if(pe){
    pe.el.classList.add('bloom');
    setTimeout(()=>pe.el.classList.remove('bloom'),650);
    pe.blob.setAttribute('filter','url(#wetbloom)');
    try{ $('#wetbloom animate').beginElement(); }catch(e){}
    setTimeout(()=>pe.blob.setAttribute('filter','url(#rough)'),600);
  }
  // floating yield ticket
  floatYield(result);
  refreshCommit();
  if(coachAwaitResolve){ coachAwaitResolve=false; coachResolve(result); }
}

function floatYield(result){
  const pe = portEls[result.portIdx]; if(!pe) return;
  const p = S.ports[result.portIdx];
  const tag=document.createElement('div');
  Object.assign(tag.style,{position:'absolute',zIndex:7,left:'50%',top:'42%',transform:'translate(-50%,-50%)',
    fontFamily:'var(--mono)',fontSize:'15px',color:'var(--paper)',pointerEvents:'none',letterSpacing:'.04em',
    textShadow:'0 0 12px rgba(0,0,0,.9)',textAlign:'center',whiteSpace:'nowrap'});
  const num=document.createElement('div'); num.textContent='+¥ 0';
  // J4 — narrate the lesson, branched on what actually just happened (honest)
  const lessonTxt = p.c<0.34 ? 'empty paid.' : p.c>0.55 ? 'crowded — barely paid.' : '';
  if(lessonTxt){ const l=document.createElement('div'); l.textContent=lessonTxt;
    Object.assign(l.style,{fontSize:'10px',marginTop:'3px',opacity:'.75'}); tag.append(num,l); }
  else tag.append(num);
  pe.el.append(tag);
  // J4 — odometer count-up out of the inversion flash
  const target=result.revenue, t0=performance.now(), dur=520;
  const step=(nw)=>{ const k=Math.min(1,(nw-t0)/dur); num.textContent='+¥ '+fmt(target*k); if(k<1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
  if(window.gsap){ gsap.fromTo(tag,{opacity:0,y:8},{opacity:1,y:-6,duration:.2}); gsap.to(tag,{opacity:0,y:-30,duration:1.2,delay:.7,onComplete:()=>tag.remove()}); }
  else setTimeout(()=>tag.remove(),1700);
}

/* ============================================================
   HUD + animated counters
   ============================================================ */
const disp = { cash:0, grey:0 };
function drawHUD(){
  $('#statGrey').textContent = fmt2(S.grey);
  $('#statGoods').textContent = fmt(S.goods);
  $('#statCargo').textContent = '/ '+fmt(cargoCap());
  $('#statFlow').textContent = flowPerSec().toFixed(1);
}
function tickHUD(){
  disp.cash = lerp(disp.cash, S.cash, 0.18);
  if(Math.abs(disp.cash - S.cash) < 0.5) disp.cash = S.cash;
  $('#statCash').textContent = fmt(disp.cash);
}

/* ============================================================
   UPGRADES
   ============================================================ */
function buildUpgrades(){
  const host=$('#upgrades'); host.innerHTML='';
  UPGRADES.forEach(u=>{
    const b=document.createElement('button'); b.className='up'; b.dataset.id=u.id;
    b.innerHTML=`<span class="up__ic" lang="ja">${u.k}</span>
      <span class="up__b"><span class="up__name">${u.name}<span class="up__lv" data-lv></span></span>
      <span class="up__desc">${u.desc}</span></span>
      <span class="up__cost" data-cost></span>`;
    b.addEventListener('click',()=>buyUpgrade(u));
    b.addEventListener('mouseenter',()=>cursorHot(true));
    b.addEventListener('mouseleave',()=>cursorHot(false));
    host.append(b);
  });
  drawUpgrades();
}
function lvlOf(u){
  return ({hauler:S.haulers,through:S.throughLv,cargo:S.cargoLv+1,discretion:S.discLv,batch:S.batchLv,intel:S.intelLv})[u.id];
}
function drawUpgrades(){
  $$('.up').forEach(b=>{
    const u=UPGRADES.find(x=>x.id===b.dataset.id);
    const cost=u.cost(S);
    const lv=lvlOf(u);
    const maxed = u.max!=null && lv>=u.max;
    const cur=u.cur;
    const afford = !maxed && (cur==='cash'? S.cash>=cost : S.grey>=cost);
    b.querySelector('[data-lv]').textContent = maxed?' · MAX':` · L${lv}`;
    const cEl=b.querySelector('[data-cost]');
    cEl.innerHTML = maxed ? 'MAX' : `${cur==='grey'?'$GREY ':'¥ '}${cur==='grey'?cost.toFixed(2):fmt(cost)}<small>${cur==='grey'?'INTEL':'CASH'}</small>`;
    cEl.classList.toggle('afford', afford);
    b.disabled = !afford;
  });
}
function buyUpgrade(u){
  const cost=u.cost(S); const lv=lvlOf(u);
  if(u.max!=null && lv>=u.max) return;
  if(u.cur==='cash'){ if(S.cash<cost) return; S.cash-=cost; }
  else { if(S.grey<cost) return; S.grey-=cost; }
  u.buy(S);
  drawHUD(); drawUpgrades(); refreshCommit();
  save();
}

/* ============================================================
   PERSISTENCE + OFFLINE
   ============================================================ */
function save(){
  S.lastSeen=now();
  const slim={ cash:S.cash,grey:S.grey,goods:S.goods,haulers:S.haulers,throughLv:S.throughLv,
    cargoLv:S.cargoLv,discLv:S.discLv,batchLv:S.batchLv,intelLv:S.intelLv,lastSeen:S.lastSeen,
    standing:S.standing,lifetimeYield:S.lifetimeYield };
  try{ localStorage.setItem(CFG.SAVE_KEY, JSON.stringify(slim)); }catch(e){}
}
function load(){
  try{
    const raw=localStorage.getItem(CFG.SAVE_KEY);
    if(!raw) return false;
    Object.assign(S, JSON.parse(raw));
    return true;
  }catch(e){ return false; }
}
function offlineEarnings(){
  const dt = clamp((now()-S.lastSeen)/1000, 0, CFG.OFFLINE_CAP_H*3600);
  if(dt < 60) return null;
  const goodsMade = Math.min(cargoCap(), flowPerSec()*dt);
  let cash=0, batches=0;
  if(S.standing){
    batches = Math.floor(dt / batchPeriod());
    // automation sells into ~avg congestion, no foresight → modest
    const perBatch = cargoCap()*0.85 * CFG.BASE_PRICE * 1.0 * Math.pow(1-0.55, CFG.IMPACT) * 4.2;
    cash = perBatch * Math.min(batches, 600) * 0.6;
  }
  S.goods = Math.min(cargoCap(), S.goods + goodsMade);
  S.cash += cash;
  return { dt, goodsMade, cash, batches };
}
function showOffline(o){
  const rows=$('#offlineRows');
  const h=Math.floor(o.dt/3600), m=Math.floor((o.dt%3600)/60);
  rows.innerHTML=`
    <div class="r"><span>TIME AWAY</span><b>${h?h+'h ':''}${m}m</b></div>
    <div class="r"><span>GOODS HAULED</span><b>+${fmt(o.goodsMade)}</b></div>
    ${o.cash>0?`<div class="r"><span>STANDING ORDER · ${o.batches} batches</span><b>+¥ ${fmt(o.cash)}</b></div>`
              :`<div class="r"><span>STANDING ORDER</span><b>OFF — flip it on to sell while away</b></div>`}`;
  const modal=$('#offlineModal'); modal.classList.add('show'); modal.setAttribute('aria-hidden','false');
}

/* ============================================================
   MOTION — Lenis + GSAP, cursor, nav
   ============================================================ */
let lenis=null;
function initMotion(){
  // custom cursor
  const cur=$('#cursor');
  if(matchMedia('(pointer:fine)').matches){
    let cx=innerWidth/2, cy=innerHeight/2, tx=cx, ty=cy;
    addEventListener('mousemove',e=>{tx=e.clientX;ty=e.clientY;});
    const loop=()=>{ cx=lerp(cx,tx,.25); cy=lerp(cy,ty,.25); cur.style.transform=`translate(${cx}px,${cy}px)`; requestAnimationFrame(loop); };
    loop();
    $$('a,button,input,.chip,.port,.up,.node,[data-scroll]').forEach(el=>{
      el.addEventListener('mouseenter',()=>cursorHot(true));
      el.addEventListener('mouseleave',()=>cursorHot(false));
    });
  } else cur.style.display='none';

  // Lenis smooth scroll
  if(window.Lenis){
    lenis=new Lenis({ duration:1.1, smoothWheel:true });
    function raf(t){ lenis.raf(t); requestAnimationFrame(raf); }
    requestAnimationFrame(raf);
    if(window.ScrollTrigger){ lenis.on('scroll', ScrollTrigger.update); }
  }
  // smooth scroll links
  $$('[data-scroll],[data-nav],.nav__mark,.hero__scroll').forEach(el=>{
    const target = el.getAttribute('data-scroll') || el.getAttribute('href');
    if(!target || !target.startsWith('#')) return;
    el.addEventListener('click',e=>{ e.preventDefault(); const node=$(target); if(!node) return;
      if(lenis) lenis.scrollTo(node,{offset:-60}); else node.scrollIntoView({behavior:'smooth'}); });
  });

  // nav stuck + active section
  const nav=$('#nav');
  addEventListener('scroll',()=>{ nav.classList.toggle('is-stuck', scrollY>40); }, {passive:true});
  const navlinks=$$('.nav__links a');
  const io=new IntersectionObserver(es=>{ es.forEach(en=>{ if(en.isIntersecting){
    navlinks.forEach(a=>a.classList.toggle('is-active', a.getAttribute('href')==='#'+en.target.id)); } }); },
    {rootMargin:'-45% 0px -50% 0px'});
  $$('section[id]').forEach(s=>io.observe(s));

  // GSAP reveals
  if(window.gsap && window.ScrollTrigger){
    gsap.registerPlugin(ScrollTrigger);
    // hero load timeline
    gsap.set('.hero__inner > *',{opacity:0,y:24});
    gsap.timeline({defaults:{ease:'power3.out'}})
      .to('.hero__inner > *',{opacity:1,y:0,duration:.9,stagger:.09,delay:.15});
    // J1 — the plain decode line brushes in like an inked margin note (clip only; opacity rides the stagger above)
    gsap.fromTo('.hero__decode',{clipPath:'inset(0 100% 0 0)'},{clipPath:'inset(0 0% 0 0)',duration:.6,delay:1.1,ease:'power2.out'});
    // brush rules draw in
    $$('[data-rule]').forEach(r=>{
      gsap.fromTo(r,{scaleX:0},{scaleX:1,duration:1.0,ease:'power2.out',
        scrollTrigger:{trigger:r,start:'top 88%'}});
    });
    // generic reveals
    $$('.section-head,.panel,.card,.ledger__row,.edge__lede,.edge__steps li,.foot__top').forEach(el=>{
      gsap.fromTo(el,{opacity:0,y:26},{opacity:1,y:0,duration:.8,ease:'power3.out',
        scrollTrigger:{trigger:el,start:'top 90%'}});
    });
    // katakana spine parallax
    gsap.to('.spine--left',{yPercent:-12,ease:'none',scrollTrigger:{trigger:'.hero',start:'top top',end:'bottom top',scrub:true}});
  }
}
function cursorHot(on){ $('#cursor')?.classList.toggle('is-hot', on); }

/* ============================================================
   MAIN LOOP
   ============================================================ */
let batchT=0, last=performance.now(), drawAcc=0;
let heroMani, edgeMani, termMani;
const CLK={};
function frame(t){
  const dt=Math.min(.1,(t-last)/1000); last=t; window.__t=(window.__t||0)+dt;

  // idle production (capped)
  S.goods = Math.min(cargoCap(), S.goods + flowPerSec()*dt);
  // gentle live drift of congestion between batches
  S.ports.forEach(p=>{ p.c = clamp(p.c + Math.sin(window.__t*0.4+p.phase)*0.0006, 0.03,0.99); });

  // batch timer + clocks (cheap, every frame for a smooth countdown)
  batchT += dt;
  const period=batchPeriod();
  const remain=Math.max(0,period-batchT);
  CLK.batch.textContent = `NEXT BATCH ${remain.toFixed(1)}s`;
  CLK.hero.textContent  = `BATCH ${remain.toFixed(1)}s`;
  if(sealing) CLK.sealed.textContent = remain.toFixed(1)+'s';
  if(batchT>=period){ batchT=0; resolveBatch(); }

  tickHUD(); // smooth cash lerp @60fps

  // heavier draws throttled to ~15fps
  drawAcc += dt;
  if(drawAcc >= 1/15){
    drawAcc = 0;
    drawHUD(); drawGrid(); drawUpgrades();
    if(termMani) termMani.draw();
    if(heroMani) heroMani.draw();
    if(edgeMani) edgeMani.draw();
    if(S.selected!=null && !sealing) refreshCommit();
  }
  requestAnimationFrame(frame);
}

/* ============================================================
   INIT
   ============================================================ */
function init(){
  const had=load();
  seedPorts();
  if(!had){ S.cash=0; S.goods=0; }
  buildGrid(); buildUpgrades();
  CLK.batch=$('#batchClock'); CLK.hero=$('#heroClock'); CLK.sealed=$('#sealedClock');
  heroMani=Manifold($('#heroManifold'));
  edgeMani=Manifold($('#edgeManifold'),{labels:true});
  termMani=Manifold($('#termManifold'),{labels:true});
  edgeMani.draw();
  drawHUD(); drawUpgrades(); disp.cash=S.cash;

  // controls
  $('#amtRange').addEventListener('input',()=>refreshCommit());
  $$('.chip').forEach(c=>c.addEventListener('click',()=>{ $('#amtRange').value=(+c.dataset.amt*100); refreshCommit(); }));
  $('#commitBtn').addEventListener('click',commitSell);
  $('#standingToggle').checked=S.standing;
  $('#standingToggle').addEventListener('change',e=>{ S.standing=e.target.checked; save(); });
  $('#offlineClaim').addEventListener('click',()=>{ const m=$('#offlineModal'); m.classList.remove('show'); m.setAttribute('aria-hidden','true'); save(); });
  $('#resetBtn').addEventListener('click',()=>{ if(confirm('Wipe the ledger and start clean?')){ localStorage.removeItem(CFG.SAVE_KEY); location.reload(); } });
  // CA copy
  $('#caNode').addEventListener('click',e=>{ e.preventDefault(); const t=$('#caNode'); navigator.clipboard?.writeText(t.dataset.copy||''); t.classList.add('copied'); setTimeout(()=>t.classList.remove('copied'),1400); });

  // periodic save
  setInterval(save, 5000);
  addEventListener('beforeunload', save);

  initMotion();
  coachInit();

  // offline report
  const o = had ? offlineEarnings() : null;
  if(o) showOffline(o);

  requestAnimationFrame(t=>{ last=t; frame(t); });
}

/* ============================================================
   J3 — flood ticker (one self-erasing --wet line under the grid)
   ============================================================ */
function floodTicker(floodIdx, result){
  if(floodIdx<0) return;
  if(!(result || S.intelLv>0)) return;                 // gate: only when the player is engaged
  const nowT=now(); if(nowT-_lastFlood < 24000) return; _lastFlood=nowT;   // throttle ~24s
  let bi=0, best=-1; S.ports.forEach((p,i)=>{ const y=Math.pow(1-p.c,CFG.IMPACT); if(y>best){best=y;bi=i;} });
  const grid=$('.panel--grid'); if(!grid) return;
  let strip=grid.querySelector('.flood-ticker');
  if(!strip){ strip=document.createElement('div'); strip.className='flood-ticker mono'; grid.appendChild(strip); }
  const fp=S.ports[floodIdx], bp=S.ports[bi];
  strip.innerHTML = `<span lang="ja">群</span> ${fp.kanji} ${fp.name} FLOODED · <span lang="ja">乾</span> ${bp.name} PAID BEST`;
  strip.classList.remove('show'); void strip.offsetWidth; strip.classList.add('show');
  clearTimeout(strip._t); strip._t=setTimeout(()=>strip.classList.remove('show'), 2200);
}

/* ============================================================
   FIRST-RUN COACH — teach the one move by doing the real loop.
   Real DOM targets; gated by localStorage; the genuine seal→flash→
   bloom is the teacher. Honest: Step 3 branches on the real result.
   ============================================================ */
const COACH_KEY='greymarket.coach.v1';
function coachInit(){
  let done=false; try{ done=!!localStorage.getItem(COACH_KEY); }catch(e){}
  if(done) return;
  const term=$('#terminal'); if(!term) return;
  const io=new IntersectionObserver(es=>{
    es.forEach(en=>{ if(en.isIntersecting && coachStep<0){ io.disconnect(); coachStart(); } });
  },{threshold:.4});
  io.observe(term);
}
function coachLayer(){
  let l=$('#coachLayer');
  if(!l){ l=document.createElement('div'); l.id='coachLayer'; l.className='coach__layer';
    l.innerHTML=`<button class="coach__skip" type="button">SKIP <span lang="ja">飛</span></button>`;
    document.body.appendChild(l);
    l.querySelector('.coach__skip').addEventListener('click',()=>coachEnd(true));
  }
  return l;
}
function coachPin(target, k, t, sub){
  const l=coachLayer();
  l.querySelector('.coach__pin')?.remove();
  document.querySelectorAll('.coach-target').forEach(e=>e.classList.remove('coach-target'));
  if(!target) return;
  target.classList.add('coach-target');
  const pin=document.createElement('div'); pin.className='coach__pin';
  pin.innerHTML=`<span class="k" lang="ja">${k}</span><span class="t">${t}</span>${sub?`<span class="sub mono">${sub}</span>`:''}`;
  l.appendChild(pin);
  const place=()=>{ const r=target.getBoundingClientRect();
    pin.style.left=Math.max(96,Math.min(r.left+r.width/2,innerWidth-96))+'px';
    pin.style.top=Math.max(64,r.top-14)+'px';
  };
  place(); addEventListener('scroll',place,{passive:true}); addEventListener('resize',place);
  coachCleanup.push(()=>{ removeEventListener('scroll',place); removeEventListener('resize',place); });
}
function bestDryIdx(){
  let bi=0,best=-1; S.ports.forEach((p,i)=>{ const y=Math.pow(1-p.c,CFG.IMPACT); if(y>best){best=y;bi=i;} });
  return bi;
}
function coachStart(){
  coachStep=0; coachLayer().classList.add('show');
  const waitGoods=()=>{ if(coachStep!==0) return; if(S.goods>=1) coachDry(); else setTimeout(waitGoods,400); };
  waitGoods();
}
function coachDry(){
  coachStep=1;
  coachPin(portEls[bestDryIdx()]?.el,'乾','Sell here.','the dry quadrant — empty, so it pays');
  const grid=$('#portGrid');
  const onPick=()=>{ if(coachStep!==1) return; coachStep=2; setTimeout(coachCommit,260); };
  grid.addEventListener('click',onPick,{once:true});
  coachCleanup.push(()=>grid.removeEventListener('click',onPick));
}
function coachCommit(){
  const btn=$('#commitBtn');
  coachPin(btn,'封印','Seal it.','clears next batch · you can’t watch — that’s the game');
  const onCommit=()=>{ if(coachStep!==2) return; coachAwaitResolve=true; coachPin(btn,'封','Sealed — wait.','the batch is clearing…'); };
  btn.addEventListener('click',onCommit,{once:true});
  coachCleanup.push(()=>btn.removeEventListener('click',onCommit));
}
function coachResolve(result){
  if(coachStep<1) return;
  coachStep=3;
  const el=portEls[result.portIdx]?.el;
  if(S.ports[result.portIdx].c < 0.34) coachPin(el,'空白','The empty page paid.','soaked ports dry to nothing — keep finding the empty one');
  else                                  coachPin(el,'密','Crowded — it barely paid.','next time sell into an empty 乾 DRY port');
  setTimeout(()=>coachEnd(true), 2800);
}
function coachEnd(save){
  coachStep=-1; coachAwaitResolve=false;
  coachCleanup.forEach(fn=>{ try{fn();}catch(e){} }); coachCleanup=[];
  document.querySelectorAll('.coach-target').forEach(e=>e.classList.remove('coach-target'));
  $('#coachLayer')?.remove();
  if(save){ try{ localStorage.setItem(COACH_KEY,'1'); }catch(e){} }
}

if(document.readyState==='loading') addEventListener('DOMContentLoaded',init); else init();
})();
