process.argv[3] = '99';
const fs = require('fs');
const src = fs.readFileSync(__dirname+'/offline.js','utf8').replace(/const START = 3;[\s\S]*$/, '');
eval(src);
const plans = Object.assign({}, ...fs.readdirSync(__dirname+'/routes').filter(f=>/^plans-.*\.json$/.test(f)).map(f=>JSON.parse(fs.readFileSync(__dirname+'/routes/'+f))));
G.AUTO.maxHitch = 80*G.D2R;
for (const k of Object.keys(plans).sort()){
  const D = plans[k]; G.setLevel(+k); G.setGoal(null);
  const st = G.LEVELS[k].start, a = (st.th + D.a)*G.D2R;
  let s = { x:st.x, y:st.y, th:a, ph:a }, w = 0, prev = 0, ok = true, goal = false, len = 0, gears = 0, maxG = 0;
  for (const v of D.c){
    const dir = Math.sign(v), tw = G.AUTO.wheels[Math.abs(v)-1];
    if (prev && dir !== prev) gears++;
    const r = G.runSegment(s, w, prev, dir, tw, 0, D.slew);
    if (!r){ ok = false; break; }
    for (const p of r.seg.pts) maxG = Math.max(maxG, Math.abs(G.wrap(p.th-p.ph)));
    len += r.seg.pts.length*.1; s = r.s; w = r.w; prev = dir;
    if (r.goal){ goal = true; break; }
  }
  console.log(`L${k} ${G.LEVELS[k].name.padEnd(22)} ${ok&&goal ? 'OK ' : 'BAD'} ${len.toFixed(1)} m, ${gears} gear changes, slew ${D.slew}, max hitch ${(maxG/G.D2R).toFixed(0)}°, ${D.c.length} moves`);
}
