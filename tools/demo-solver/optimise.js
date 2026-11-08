// Careful-driver routes: for each level, find the largest gap the car and caravan can keep from every
// hedge, van and post all the way to the target, then the cleanest route that keeps it.
//   node optimise.js ../../index.html 0,1,2      -> routes/plans-<n>.json with { a, slew, c, gap }
const fs = require('fs');
const dir = __dirname;
const htmlPath = process.argv[2], only = (process.argv[3] || '0,1,2,3,4,5,6,7').split(',').map(Number);
process.argv[3] = '99';   // offline.js's own level loop is cut off below; it only needs to define helpers
let src = fs.readFileSync(dir + '/offline.js', 'utf8').replace(/const START = 3;[\s\S]*$/, '');
eval(src);

const START = 3, STEP = .05;
const length = segs => segs.reduce((a,g) => a + g.pts.length*.1, 0);
const gears = segs => segs.filter((g,k) => k && g.dir !== segs[k-1].dir).length;
const minGap = (segs) => { let m = 1e9; for (const g of segs) for (const p of g.pts) m = Math.min(m, clearance(p, m)); return m; };
const prog = {
  3: s => { const v=G.vanRect(s); return -(v.cx<23 ? v.cx : 23+(34-v.cy)); },
  4: s => { const v=G.vanRect(s); return -(v.cx<24.5 ? v.cx : 24.5+(v.cy-4)); },
  5: s => { const v=G.vanRect(s); return -(v.cx<25.2 ? v.cx : 25.2+(33.2-v.cy)); },
  6: s => { const v=G.vanRect(s); return -(v.cy<10.8 ? v.cx : v.cy<24 ? 40+(v.cy-5) : 80+v.cx); },
};

// replay moves without a goal cut so a two-stage route joins exactly where the game will be
function replay(s0, w0, d0, segs, slew){
  G.setGoal(() => false);
  let s = { ...s0 }, w = w0, d = d0; const out = [];
  for (const g of segs){ const r = G.runSegment(s, w, d, g.dir, g.tw, -1, slew); out.push(r.seg); s = r.s; w = r.w; d = g.dir; }
  G.setGoal(null);
  return { segs:out, end:{ s, w, dir:d } };
}

function solveAt(li, s0, margin){
  G.setLevel(li); G.setGoal(null);
  const tries = [];
  if (li === 7){
    // up the lane, right into the yard, then reverse west into the pitch
    const inYard = s => [...G.corners(G.vanRect(s)), ...G.corners(G.carRect(s))].every(p => p[1] < 15.4);
    G.setGoal(s => inYard(s) && Math.abs(G.wrap(s.th)) < .3 && Math.abs(G.wrap(s.ph)) < .3);
    const p1 = s => { const v = G.vanRect(s); let p = v.cx < 25.2 ? v.cx : 25.2 + (35 - v.cy);
      if (v.cy < 22) p += 6*Math.cos(s.th) + .6*(s.x - 28) + 3*Math.cos(s.ph); return -p; };
    const r1 = beam(s0, 0, 0, p1, { dirs:[1], slew:600, width:400, margin });
    G.setGoal(null);
    if (!r1) return null;
    const j = replay(s0, 0, 0, r1.segs, 600);
    const r2 = beam(j.end.s, j.end.w, j.end.dir, fieldScore(false), { dirs:[-1], slew:600, width:500, margin })
            || beam(j.end.s, j.end.w, j.end.dir, fieldScore(false), { dirs:[1,-1], slew:600, width:500, margin });
    if (!r2) return null;
    tries.push({ segs:[...j.segs, ...r2.segs], slew:600 });
  } else {
    const fwd = !!prog[li];
    const configs = fwd ? [() => beam(s0, 0, 0, prog[li], { dirs:[1], slew:600, width:400, margin }),
                           () => beam(s0, 0, 0, prog[li], { dirs:[1], slew:1500, width:400, margin })]
                        : [() => beam(s0, 0, 0, fieldScore(false), { slew:600, width:400, margin }),
                           () => beam(s0, 0, 0, fieldScore(false), { slew:600, width:800, margin })];
    // with the closeness cost first (keeps routes away from hedges); without it if that finds nothing
    for (const cw of [4, 0]){
      G.AUTO.clearW = cw;
      for (const [k, f] of configs.entries()){ const r = f(); if (r){ tries.push({ segs:r.segs, slew: fwd && k === 1 ? 1500 : 600 }); break; } }
      if (tries.length) break;
    }
    G.AUTO.clearW = 4;
  }
  if (!tries.length) return null;
  const r = tries[0];
  // the route must replay identically in the game (no goal cut except the real one)
  G.setGoal(null);
  return r;
}

// a careful route should still be a sensible manoeuvre: few gear changes, no huge detours
const SENSIBLE = { gears: 3, length: 70 };
const sensible = r => gears(r.segs) <= SENSIBLE.gears && length(r.segs) <= SENSIBLE.length;
for (const li of only){
  G.setLevel(li);
  const st = G.LEVELS[li].start, a = (st.th + START)*G.D2R, s0 = { x:st.x, y:st.y, th:a, ph:a };
  const startGap = clearance(s0);
  let lo = 0, hi = Math.min(1.2, Math.floor(startGap/STEP)*STEP), best = null;
  const t0 = Date.now();
  // check the top first (open levels), then binary search down
  const tryM = m => { const t = Date.now(); let r = solveAt(li, s0, m);
    const note = r && !sensible(r) ? ` but not sensible (${length(r.segs).toFixed(0)} m, ${gears(r.segs)} gear changes)` : '';
    console.error(`  L${li} margin ${m.toFixed(2)}: ${r ? 'ok' : 'no'}${note} ${((Date.now()-t)/1000).toFixed(0)}s`);
    return r && sensible(r) ? r : null; };
  best = tryM(hi);
  if (best) lo = hi;
  else {
    best = tryM(0);
    if (!best){ console.error(`L${li} NO ROUTE`); continue; }
    while (hi - lo > STEP + 1e-9){
      const mid = Math.round((lo + hi)/2/STEP)*STEP;
      if (mid <= lo || mid >= hi) break;
      const r = tryM(mid);
      if (r){ lo = mid; best = r; } else hi = mid;
    }
  }
  const gap = minGap(best.segs);
  const out = { [li]: { a:START, slew:best.slew, c:best.segs.map(g => g.dir*(G.AUTO.wheels.indexOf(g.tw)+1)), gap:+gap.toFixed(2) } };
  fs.writeFileSync(`${dir}/routes/plans-${li}.json`, JSON.stringify(out));
  console.error(`L${li} ${G.LEVELS[li].name}: margin ${lo.toFixed(2)}, closest gap ${gap.toFixed(2)} m, ${length(best.segs).toFixed(1)} m, ${gears(best.segs)} gear changes, ${((Date.now()-t0)/1000).toFixed(0)}s`);
}
