// ---------- auto-driver: hybrid A* search over the game's own physics ----------
// Each move is ~1 m of travel in D or R with the wheel heading for one of 7 positions.
// The wheel can only turn at a realistic rate while moving; when stopped (start or gear change)
// it may be turned on the spot. A distance map from the target, flowing round hedges, guides the search.
const AUTO = { sub:.1, steps:10, slew:3000, wheels:[-540,-397,-238,-111,0,111,238,397,540], margin:0, budget:70000, maxHitch:75*D2R,
  clearSoft:1.2, clearW:4 };   // routes pay a growing cost for coming within clearSoft metres of anything

// shortest gap (m) between the car or caravan footprint and any obstacle; stops looking beyond cap
function ptSeg(p, a, b){ const dx = b[0]-a[0], dy = b[1]-a[1];
  const t = clamp(((p[0]-a[0])*dx + (p[1]-a[1])*dy)/((dx*dx + dy*dy) || 1), 0, 1);
  return Math.hypot(p[0]-a[0]-t*dx, p[1]-a[1]-t*dy); }
function rectGap(A, B){
  if (overlap(A, B)) return 0;
  const ca = corners(A), cb = corners(B); let m = 1e9;
  for (let i=0;i<4;i++){ const j = (i+1)%4;
    for (const p of ca) m = Math.min(m, ptSeg(p, cb[i], cb[j]));
    for (const p of cb) m = Math.min(m, ptSeg(p, ca[i], ca[j])); }
  return m;
}
function clearance(s, cap = 1e9){
  let m = cap;
  for (const body of [carRect(s), vanRect(s)]){
    const bb = rectAABB(body);
    for (const o of obstacles){
      const ob = o.bb || (o.bb = rectAABB(o.r));
      const gx = Math.max(ob[0]-bb[2], bb[0]-ob[2], 0), gy = Math.max(ob[1]-bb[3], bb[1]-ob[3], 0);
      if (Math.hypot(gx, gy) >= m) continue;
      m = Math.min(m, rectGap(body, o.r));
    }
  }
  return m;
}

function rectAABB(r){ const c=Math.abs(Math.cos(r.a)), s=Math.abs(Math.sin(r.a)); const hx=(r.l*c+r.w*s)/2, hy=(r.l*s+r.w*c)/2; return [r.cx-hx,r.cy-hy,r.cx+hx,r.cy+hy]; }
function planStep(s, dir, w, ds){
  const delta = w/WHEELMAX*MAXSTEER, v = dir*ds;
  const thd = v/CAR.L*Math.tan(delta);
  const phd = (v*Math.sin(s.th-s.ph) - CAR.hitch*thd*Math.cos(s.th-s.ph))/VAN.D;
  s.x += v*Math.cos(s.th); s.y += v*Math.sin(s.th); s.th += thd; s.ph += phd;
}
function planHits(s, m){
  const cr = carRect(s), vr = vanRect(s);
  cr.l += 2*m; cr.w += 2*m; vr.l += 2*m; vr.w += 2*m;
  const ca = rectAABB(cr), va = rectAABB(vr);
  for (const o of obstacles){
    const b = o.bb || (o.bb = rectAABB(o.r));
    if (!(ca[2]<b[0]||ca[0]>b[2]||ca[3]<b[1]||ca[1]>b[3]) && overlap(cr,o.r)) return true;
    if (!(va[2]<b[0]||va[0]>b[2]||va[3]<b[1]||va[1]>b[3]) && overlap(vr,o.r)) return true;
  }
  return false;
}

// one ~1 m move: wheel heads for tw (turning on the spot first if stopped), car travels in dir
function runSegment(s0, w0, prevDir, dir, tw, margin, slew){
  const stopped = prevDir === 0 || dir !== prevDir;
  let w = w0, g = 0;
  const seg = { dir, tw, w0, turnOnSpot:false, pts:[] };
  if (stopped){ if (prevDir !== 0) g += 6; if (tw !== w){ g += Math.abs(tw-w)/540*.6; w = tw; seg.turnOnSpot = true; } }
  const s = { ...s0 };
  for (let i=0;i<AUTO.steps;i++){
    const nw = clamp(tw, w - slew*AUTO.sub, w + slew*AUTO.sub); g += Math.abs(nw-w)*.0004; w = nw;
    planStep(s, dir, w, AUTO.sub);
    const gam = wrap(s.th - s.ph);
    if (margin >= 0 && (Math.abs(gam) > AUTO.maxHitch || planHits(s, margin))) return null;
    g += AUTO.sub * (dir < 0 ? 1.35 : 1) * (1 + .6*(gam/AUTO.maxHitch)**2);
    if (i % 5 === 4 && AUTO.clearW){ const cl = clearance(s, AUTO.clearSoft); if (cl < AUTO.clearSoft) g += .5*AUTO.clearW*(1 - cl/AUTO.clearSoft)**2; }
    seg.pts.push({ x:s.x, y:s.y, th:s.th, ph:s.ph, w });
    if (parked(s)) return { s, w, g, seg, goal:true };
  }
  return { s, w, g, seg, goal:false };
}
// distance (metres of travel) from every point of the site to the target, routed round obstacles
function buildField(wideMode){
  const cs = .5, nx = Math.ceil(L.W/cs), ny = Math.ceil(L.H/cs), N = nx*ny;
  const cost = new Float32Array(N), dist = new Float32Array(N).fill(1e9);
  const grow = (r,m) => ({ cx:r.cx, cy:r.cy, a:r.a, l:r.l+2*m, w:r.w+2*m });
  const hard = obstacles.map(o => grow(o.r,.25)), soft = obstacles.map(o => grow(o.r, wideMode ? 1.1 : 1.0)), wide = wideMode ? obstacles.map(o => grow(o.r,1.7)) : [];
  for (let j=0;j<ny;j++) for (let i=0;i<nx;i++){
    const p = [(i+.5)*cs,(j+.5)*cs]; let c = 1;
    if (hard.some(r => inside(p,r))) c = 0; else if (soft.some(r => inside(p,r))) c = wideMode ? 8 : 4; else if (wide.some(r => inside(p,r))) c = 3;
    cost[j*nx+i] = c;
  }
  const heap = new MinHeap((a,b) => a[0]-b[0]);
  const goalR = { ...target, l:Math.max(.5,target.l-1), w:Math.max(.5,target.w-1) };
  for (let j=0;j<ny;j++) for (let i=0;i<nx;i++){
    const k = j*nx+i; if (!cost[k]) continue;
    if (inside([(i+.5)*cs,(j+.5)*cs], goalR)) { dist[k] = 0; heap.push([0,k]); }
  }
  const nb = [[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,1.414],[1,-1,1.414],[-1,1,1.414],[-1,-1,1.414]];
  while (heap.size){
    const [d,k] = heap.pop(); if (d > dist[k]) continue;
    const i = k % nx, j = (k/nx)|0;
    for (const [di,dj,m] of nb){
      const a = i+di, b = j+dj; if (a<0||b<0||a>=nx||b>=ny) continue;
      const q = b*nx+a; if (!cost[q]) continue;
      const nd = d + m*cs*Math.max(cost[k],cost[q]);
      if (nd < dist[q]) { dist[q] = nd; heap.push([nd,q]); }
    }
  }
  // fill obstacle cells from their nearest open neighbour so the field has no holes
  for (let pass=0; pass<6; pass++) for (let k=0;k<N;k++) if (dist[k] >= 1e9){
    const i = k % nx, j = (k/nx)|0; let best = 1e9;
    for (const [di,dj,m] of nb){ const a=i+di, b=j+dj; if (a<0||b<0||a>=nx||b>=ny) continue; best = Math.min(best, dist[b*nx+a] + m*cs*6); }
    if (best < 1e9) dist[k] = best;
  }
  return (x,y) => { const i = clamp((x/cs)|0,0,nx-1), j = clamp((y/cs)|0,0,ny-1); const d = dist[j*nx+i]; return d < 1e9 ? d : 200; };
}
class MinHeap {
  constructor(cmp){ this.a = []; this.cmp = cmp; }
  get size(){ return this.a.length; }
  push(x){ const a = this.a; a.push(x); let i = a.length-1;
    while (i > 0){ const p = (i-1)>>1; if (this.cmp(a[i],a[p]) >= 0) break; [a[i],a[p]] = [a[p],a[i]]; i = p; } }
  pop(){ const a = this.a, top = a[0], last = a.pop();
    if (a.length){ a[0] = last; let i = 0;
      for(;;){ const l = 2*i+1, r = l+1; let m = i;
        if (l < a.length && this.cmp(a[l],a[m]) < 0) m = l;
        if (r < a.length && this.cmp(a[r],a[m]) < 0) m = r;
        if (m === i) break; [a[i],a[m]] = [a[m],a[i]]; i = m; } }
    return top; }
}
// generator: yields progress, returns the path (array of samples) or null
function* planRoute(start, startWheel){
  const field = buildField();
  const s0 = { x:start.x, y:start.y, th:start.th, ph:start.ph };
  const margin = planHits(s0, AUTO.margin) ? 0 : AUTO.margin;
  const h = s => {
    const vr = vanRect(s); const dv = field(vr.cx, vr.cy);
    let v = dv;
    if (target.rig) v = Math.max(dv, field(s.x, s.y));
    const near = clamp(1 - dv/10, 0, 1);
    v += near * 3 * Math.abs(wrap(s.ph - target.a));
    if (target.rig) v += near * 2 * Math.abs(wrap(s.th - target.a));
    return v;
  };
  const key = (s,w,dir) => {
    const x = Math.round(s.x/.4), y = Math.round(s.y/.4);
    const t = Math.round(wrap(s.th)/(6*D2R)) + 31, g = Math.round(wrap(s.th-s.ph)/(6*D2R)) + 15;
    return ((((x*256 + y)*64 + t)*32 + g)*8 + Math.round(w/180) + 3)*3 + dir + 1;
  };
  const open = new MinHeap((a,b) => a.f - b.f), seen = new Map();
  open.push({ s:s0, w:startWheel, dir:0, g:0, f:h(s0), parent:null, seg:null });
  let exp = 0;
  while (open.size){
    const n = open.pop();
    if (++exp > AUTO.budget) return null;
    if (exp % 250 === 0) yield exp;
    for (const dir of [1,-1]) for (const tw of AUTO.wheels){
      const stopped = n.dir === 0 || dir !== n.dir;
      let w = n.w, g = n.g;
      const seg = { dir, w0:n.w, turnOnSpot:false, pts:[] };
      if (stopped){
        if (n.dir !== 0) g += 6;                       // a gear change costs a stop
        if (tw !== w){ g += Math.abs(tw-w)/540*.6; w = tw; seg.turnOnSpot = true; }
      }
      const s = { ...n.s }; let ok = true, goal = false;
      for (let i=0;i<AUTO.steps;i++){
        const nw = clamp(tw, w - AUTO.slew*AUTO.sub, w + AUTO.slew*AUTO.sub);
        g += Math.abs(nw - w)*.0004; w = nw;
        planStep(s, dir, w, AUTO.sub);
        const gam = wrap(s.th - s.ph);
        if (Math.abs(gam) > AUTO.maxHitch || planHits(s, margin)) { ok = false; break; }
        g += AUTO.sub * (dir < 0 ? 1.35 : 1) * (1 + .6*(gam/AUTO.maxHitch)**2);
        seg.pts.push({ x:s.x, y:s.y, th:s.th, ph:s.ph, w });
        if (parked(s)) { goal = true; break; }
      }
      if (!ok) continue;
      const child = { s, w, dir, g, parent:n, seg };
      if (goal) {
        const segs = []; for (let c = child; c.seg; c = c.parent) segs.push(c.seg);
        return segs.reverse();
      }
      const k = key(s, w, dir), prev = seen.get(k);
      if (prev !== undefined && prev <= g) continue;
      seen.set(k, g);
      child.f = g + 2.2*h(s);
      open.push(child);
    }
  }
  return null;
}
// beam search: keeps the most promising few hundred positions at each step. Fast for long forward routes.
function* planBeam(start, startWheel, width, depth, dirs = [1,-1], hOverride){
  const field = buildField();
  const s0 = { x:start.x, y:start.y, th:start.th, ph:start.ph };
  const h = s => {
    const vr = vanRect(s); const dv = field(vr.cx, vr.cy);
    let v = target.rig ? Math.max(dv, field(s.x, s.y)) : dv;
    const near = clamp(1 - dv/10, 0, 1);
    v += near * 3 * Math.abs(wrap(s.ph - target.a));
    if (target.rig) v += near * 2 * Math.abs(wrap(s.th - target.a));
    return hOverride ? hOverride(s) : v;
  };
  const key = (s,w,dir) => {
    const x = Math.round(s.x/.3), y = Math.round(s.y/.3);
    const t = Math.round(wrap(s.th)/(4*D2R)) + 46, g = Math.round(wrap(s.th-s.ph)/(4*D2R)) + 22;
    return ((((x*256 + y)*96 + t)*48 + g)*8 + Math.round(w/180) + 3)*3 + dir + 1;
  };
  let beam = [{ s:s0, w:startWheel, dir:0, g:0, parent:null, seg:null }];
  const seenG = new Map();
  for (let d=0; d<depth; d++){
    const next = [];
    for (const n of beam) for (const dir of dirs) for (const tw of AUTO.wheels){
      const stopped = n.dir === 0 || dir !== n.dir;
      let w = n.w, g = n.g;
      const seg = { dir, w0:n.w, turnOnSpot:false, pts:[] };
      if (stopped){ if (n.dir !== 0) g += 6; if (tw !== w){ g += Math.abs(tw-w)/540*.6; w = tw; seg.turnOnSpot = true; } }
      const s = { ...n.s }; let ok = true, goal = false;
      for (let i=0;i<AUTO.steps;i++){
        const nw = clamp(tw, w - AUTO.slew*AUTO.sub, w + AUTO.slew*AUTO.sub); g += Math.abs(nw-w)*.0004; w = nw;
        planStep(s, dir, w, AUTO.sub);
        const gam = wrap(s.th - s.ph);
        if (Math.abs(gam) > AUTO.maxHitch || planHits(s, 0)) { ok = false; break; }
        g += AUTO.sub * (dir < 0 ? 1.35 : 1) * (1 + .6*(gam/AUTO.maxHitch)**2);
        seg.pts.push({ x:s.x, y:s.y, th:s.th, ph:s.ph, w });
        if (parked(s)) { goal = true; break; }
      }
      if (!ok) continue;
      const child = { s, w, dir, g, parent:n, seg };
      if (goal){ const segs = []; for (let c = child; c.seg; c = c.parent) segs.push(c.seg); return segs.reverse(); }
      const k = key(s,w,dir), pg = seenG.get(k);
      if (pg !== undefined && pg <= g) continue;
      seenG.set(k, g);
      child.f = h(s) + .15*g;
      next.push(child);
    }
    if (!next.length) return null;
    next.sort((a,b) => a.f - b.f);
    beam = next.slice(0, width);
    yield d;
  }
  return null;
}
