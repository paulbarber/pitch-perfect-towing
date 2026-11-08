// Offline solver: tries several searches per level, keeps the cleanest route, prints compact controls.
const fs = require('fs');
const html = fs.readFileSync(process.argv[2], 'utf8');
const js = html.match(/<script>([\s\S]*)<\/script>/)[1];
const geo = js.slice(js.indexOf('const D2R'), js.indexOf('// ---------- state ----------'));
const planner = fs.readFileSync(__dirname + '/planner.js', 'utf8');
eval(geo + `
var L, obstacles, target;
function setLevel(i){
  L = LEVELS[i];
  obstacles = L.obs.map(o => { const k = KIND[o.k]; return { k:o.k, H:k.H, r:{ cx:o.x, cy:o.y, a:(o.a||0)*D2R, l:o.l||k.l, w:o.w||k.w } }; });
  const W=L.W, H=L.H;
  [[W/2,.5,W,1],[W/2,H-.5,W,1],[.5,H/2,1,H],[W-.5,H/2,1,H]].forEach(b => obstacles.push({ k:'hedge', H:1.8, r:{ cx:b[0], cy:b[1], a:0, l:b[2], w:b[3] } }));
  if (L.finish) { const f = L.finish; target = { cx:f.x, cy:f.y, a:f.a*D2R, l:f.l, w:f.w, rig:true }; }
  else target = { cx:L.pitch[0], cy:L.pitch[1], a:L.pitch[2]*D2R, l:BAY.l, w:BAY.w, rig:false };
}
var goalOverride = null;
function parked(st){
  if (goalOverride) return goalOverride(st);
  const vr = vanRect(st);
  if (target.rig) return [...corners(vr), ...corners(carRect(st))].every(p => inside(p, target)) && Math.abs(wrap(st.ph - target.a)) < 15*D2R && Math.abs(wrap(st.th - target.a)) < 15*D2R;
  return corners(vr).every(p => inside(p, target)) && Math.abs(wrap(st.ph - target.a)) < 10*D2R;
}
` + planner + `
global.G = { LEVELS, setLevel, runSegment, buildField, vanRect, carRect, corners, D2R, wrap, clamp, AUTO, MinHeap, inside,
  setGoal: f => { goalOverride = f; }, get target(){ return target; } };`);

// generic beam over runSegment with a scoring function
function beam(s0, w0, prevDir, score, { width=400, depth=140, dirs=[1,-1], slew=600, margin=0 } = {}){
  const key = n => [Math.round(n.s.x/KX), Math.round(n.s.y/KX), Math.round(n.s.th/(KA*G.D2R)), Math.round(n.s.ph/(KA*G.D2R)), n.dir].join(',');
  let B = [{ s:s0, w:w0, dir:prevDir, g:0, parent:null, seg:null }];
  const kept = new Set();
  for (let d=0; d<depth; d++){
    const N = [];
    for (const n of B) for (const dir of dirs) for (const tw of G.AUTO.wheels){
      if (n.seg && dir === n.dir && Math.abs(tw - n.seg.tw) > MAXDW) continue;
      const r = G.runSegment(n.s, n.w, n.dir, dir, tw, margin, slew); if (!r) continue;
      const c = { s:r.s, w:r.w, dir, g:n.g + r.g, parent:n, seg:r.seg };
      if (r.goal){ const segs=[]; for (let x=c; x.seg; x=x.parent) segs.push(x.seg); return { segs:segs.reverse(), g:c.g, end:c }; }
      c.f = score(c.s) + GW*c.g; N.push(c);
    }
    if (DBG) console.log(d, N.length);
    N.sort((a,b) => a.f-b.f);
    const seen = new Set(); B = [];
    for (const c of N){ const k = key(c); if (seen.has(k) || kept.has(k)) continue; seen.add(k); B.push(c); if (B.length >= width) break; }
    B.forEach(c => kept.add(key(c)));
    if (!B.length) return null;
  }
  return null;
}
function fieldScore(wide){
  const field = G.buildField(wide), T = G.target;
  return s => { const vr = G.vanRect(s); const dv = field(vr.cx, vr.cy);
    let v = T.rig ? Math.max(dv, field(s.x, s.y)) : dv; const near = G.clamp(1 - dv/10, 0, 1);
    v += near*3*Math.abs(G.wrap(s.ph - T.a)); if (T.rig) v += near*2*Math.abs(G.wrap(s.th - T.a)); return v; };
}
var MAXDW = 320, DBG = false, GW = .15, KX = .5, KA = 3, KW = 0;
const quality = r => r.segs.reduce((a,s)=>a+s.pts.length*.1,0) + 8*r.segs.filter((s,k)=>k&&s.dir!==r.segs[k-1].dir).length
  + r.segs.reduce((a,s)=>a+Math.abs(s.tw-s.w0)/540*.4,0);

// level-specific progress scores (higher progress = lower score)
const prog = {
  5: s => { const v=G.vanRect(s); return -(v.cx<25.8 ? v.cx : 25.8+(33.2-v.cy)); },
  6: s => { const v=G.vanRect(s); return -(v.cy<10.4 ? v.cx : v.cy<24 ? 40+(v.cy-5) : 80+v.cx); },
  3: s => { const v=G.vanRect(s); return -(v.cx<23 ? v.cx : 23+(34-v.cy)); },
  4: s => { const v=G.vanRect(s); return -(v.cx<24.5 ? v.cx : 24.5+(v.cy-4)); },
};
const START = 3; // demo start angle, degrees
const out = {};
const only = process.argv[3] ? process.argv[3].split(',').map(Number) : G.LEVELS.map((_,i)=>i);
for (const i of only){
  G.setLevel(i); G.setGoal(null);
  const st = G.LEVELS[i].start, a = (st.th + START)*G.D2R;
  const s0 = { x:st.x, y:st.y, th:a, ph:a };
  const tries = [];
  const attempt = (label, fn) => { const t0 = Date.now(); const r = fn(); if (r){ r.label = label; r.q = quality(r); tries.push(r); }
    console.error(`  L${i} ${label}: ${r ? 'ok q='+quality(r).toFixed(1) : 'fail'} ${Date.now()-t0}ms`); };
  if (i === 7){
    // forward up the lane into the yard, then plan the reverse into the pitch from there
    for (const slew of [600, 1500, 3000]) attempt('two-stage slew '+slew, () => {
      G.setGoal(s => [...G.corners(G.vanRect(s)), ...G.corners(G.carRect(s))].every(p => p[1] < 15.4));
      const p1 = s => { const v=G.vanRect(s); return -(v.cx<26 ? v.cx : 26+(35-v.cy)); };
      const r1 = beam(s0, 0, 0, p1, { dirs:[1], slew, width:400 }); if (!r1) { G.setGoal(null); return null; }
      // replay stage 1 in full (the last move was cut short at the stage goal) so stage 2 starts where the game will be
      G.setGoal(() => false);
      let st1 = { ...s0 }, w1 = 0, d1 = 0; const segs1 = [];
      for (const g of r1.segs){ const r = G.runSegment(st1, w1, d1, g.dir, g.tw, 0, slew); if (!r) { G.setGoal(null); return null; } segs1.push(r.seg); st1 = r.s; w1 = r.w; d1 = g.dir; }
      G.setGoal(null);
      r1.segs = segs1; r1.end = { s:st1, w:w1, dir:d1 };
      const sc = fieldScore(false); let best = null;
      for (const w of [400]) { const r2 = beam(r1.end.s, r1.end.w, r1.end.dir, sc, { slew:600, width:w }); if (r2 && (!best || quality(r2) < quality(best))) best = r2; }
      if (!best) return null;
      return { segs:[...r1.segs, ...best.segs] };
    });
  } else {
    const scN = fieldScore(false);
    for (const slew of [600, 1500, 3000]) {
      attempt(`fieldN w400 s${slew}`, () => beam(s0, 0, 0, scN, { width:400, slew }));
      if (prog[i]) attempt(`prog w400 s${slew}`, () => beam(s0, 0, 0, prog[i], { width:400, slew, dirs:[1] }));
      if (tries.some(t => t.q < 60)) break;
    }
  }
  if (!tries.length){ console.error(`L${i} NO SOLUTION`); continue; }
  tries.sort((a,b) => a.q - b.q); const r = tries[0];
  // slew used is needed for replay; recover from label
  const slew = +(r.label.match(/(\d+)$/)||[0,600])[1];
  out[i] = { a:START, slew, c: r.segs.map(s => s.dir*(G.AUTO.wheels.indexOf(s.tw) + 1)) };   // dir*(wheel index+1)
  console.error(`L${i} best ${r.label} q=${r.q.toFixed(1)} segs=${r.segs.length}`);
}
fs.writeFileSync(__dirname + '/routes/plans' + (process.argv[3]? '-'+process.argv[3].replace(/,/g,'_') : '') + '.json', JSON.stringify(out));
