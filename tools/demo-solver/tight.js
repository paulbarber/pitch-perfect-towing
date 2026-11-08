// Feasibility probe for tight levels: which guaranteed gaps can a route keep?
//   node tight.js ../../index.html <level> 0.4,0.3,0.2,0.1
const fs = require('fs');
const dir = __dirname;
const li = +process.argv[3], margins = (process.argv[4] || '0.4,0.3,0.25,0.2,0.15,0.1').split(',').map(Number);
process.argv[3] = '99';
eval(fs.readFileSync(dir + '/offline.js', 'utf8').replace(/const START = 3;[\s\S]*$/, ''));
G.AUTO.clearW = 0;            // pure feasibility: no closeness cost while probing
const prog = {
  3: s => { const v=G.vanRect(s); return -(v.cx<23 ? v.cx : 23+(34-v.cy)); },
  4: s => { const v=G.vanRect(s); return -(v.cx<24.5 ? v.cx : 24.5+(v.cy-4)); },
  5: s => { const v=G.vanRect(s); return -(v.cx<25.2 ? v.cx : 25.2+(33.2-v.cy)); },
  6: s => { const v=G.vanRect(s); return -(v.cy<10.8 ? v.cx : v.cy<24 ? 40+(v.cy-5) : 80+v.cx); },
  7: s => { const v=G.vanRect(s); return -(v.cx<25.2 ? v.cx : 25.2+(35-v.cy)); },
};
G.setLevel(li);
const st = G.LEVELS[li].start, a = (st.th + 3)*G.D2R, s0 = { x:st.x, y:st.y, th:a, ph:a };
if (li === 7) G.setGoal(s => [...G.corners(G.vanRect(s)), ...G.corners(G.carRect(s))].every(p => p[1] < 15.4));
for (const m of margins){
  let ok = null;
  for (const slew of [600, 1500, 3000]) for (const width of [400, 1000]) for (const md of [320, 600]) {
    if (ok) break;
    MAXDW = md;
    const t = Date.now(), r = beam(s0, 0, 0, prog[li], { dirs:[1], slew, width, margin:m });
    console.log(`L${li} margin ${m}: slew ${slew} width ${width} jump ${md} -> ${r ? 'OK' : 'no'} ${((Date.now()-t)/1000).toFixed(0)}s`);
    if (r) ok = r;
  }
  if (!ok) console.log(`L${li} margin ${m}: NOT FOUND`);
}
