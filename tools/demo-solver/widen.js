// Find the narrowest lane width at which a careful route can keep a guaranteed gap from the hedges.
//   node widen.js ../../index.html <level 5|6|7> <gap> <w1,w2,...>
const fs = require('fs');
const dir = __dirname;
const li = +process.argv[3], gap = +process.argv[4], widths = process.argv[5].split(',').map(Number);
process.argv[3] = '99';
eval(fs.readFileSync(dir + '/offline.js', 'utf8').replace(/const START = 3;[\s\S]*$/, ''));
G.AUTO.clearW = 0;
const wall = (x0,y0,x1,y1) => ({ k:'hedge', x:(x0+x1)/2, y:(y0+y1)/2, a:0, l:x1-x0, w:y1-y0 });

// level layouts as a function of lane width w (outer hedges stay put; inner hedges move)
const build = {
  5: w => ({ tarmac:[[1,33.2-w,30,w],[31-w,1,w,32.2]], finish:{x:31-w/2,y:8,a:-90,l:13,w},
    obs:[wall(1,33.2,32.2,34.4), wall(31,1,32.2,34.4), wall(1,33.2-w-1.2,31-w,33.2-w), wall(31-w-1.2,1,31-w,33.2-w)],
    start:{x:12,y:33.2-w/2,th:0} }),
  6: w => ({ H: Math.max(32, Math.ceil(24+w+2.6)), tarmac:[[1,5,23+w,w],[24,5,w,19+w],[24,24,26,w]], finish:{x:42.25,y:24+w/2,a:0,l:13.5,w},
    obs:[wall(1,3.8,24+w+1.2,5), wall(24+w,3.8,24+w+1.2,24), wall(24+w,22.8,50,24),
         wall(1,5+w,24,5+w+1.2), wall(22.8,5+w,24,24+w+1.2), wall(22.8,24+w,50,24+w+1.2)],
    start:{x:13,y:5+w/2,th:0} }),
  7: w => ({ tarmac:[[1,35-w,30,w],[31-w,16,w,19],[8,2,35,14]],
    obs:[wall(1,35,32.2,36.2), wall(1,35-w-1.2,31-w,35-w), wall(31-w-1.2,16,31-w,35-w), wall(31,16,32.2,36.2),
         wall(6.8,16,31-w-1.2,17.2), wall(32.2,16,43,17.2), wall(6.8,1,8,17.2),
         ...G.LEVELS[7].obs.filter(o => o.k === 'van')],
    start:{x:12,y:35-w/2,th:0} }),
};
const prog = {
  5: w => s => { const v=G.vanRect(s), x0 = 31-w; return -(v.cx<x0 ? v.cx : x0+(33.2-v.cy)); },
  6: w => s => { const v=G.vanRect(s); return -(v.cy<5+w ? v.cx : v.cy<24 ? 40+(v.cy-5) : 80+v.cx); },
  7: w => s => { const v=G.vanRect(s), x0 = 31-w; return -(v.cx<x0 ? v.cx : x0+(35-v.cy)); },
};
const base = JSON.parse(JSON.stringify(G.LEVELS[li]));
for (const w of widths){
  Object.assign(G.LEVELS[li], base, build[li](w));
  G.setLevel(li);
  if (li === 7) G.setGoal(s => [...G.corners(G.vanRect(s)), ...G.corners(G.carRect(s))].every(p => p[1] < 15.4)); else G.setGoal(null);
  const st = G.LEVELS[li].start, a = (st.th + 3)*G.D2R, s0 = { x:st.x, y:st.y, th:a, ph:a };
  let ok = false;
  for (const slew of [600, 1500]) for (const width of [400, 1000]) {
    if (ok) break;
    const t = Date.now(), r = beam(s0, 0, 0, prog[li](w), { dirs:[1], slew, width, margin:gap });
    console.log(`L${li} lane ${w} m, gap ${gap}: slew ${slew} width ${width} -> ${r ? 'OK' : 'no'} ${((Date.now()-t)/1000).toFixed(0)}s`);
    if (r) ok = true;
  }
  if (ok) { console.log(`L${li} ANSWER lane ${w}`); break; }
}
