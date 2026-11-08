const fs = require('fs'), dir = __dirname, f = process.argv[2];
const plans = Object.assign({}, ...fs.readdirSync(dir+'/routes').filter(n=>/^plans-.*\.json$/.test(n)).map(n=>JSON.parse(fs.readFileSync(dir+'/routes/'+n))));
const body = Object.keys(plans).sort((a,b)=>a-b).map(k => `  ${k}:{a:${plans[k].a},slew:${plans[k].slew},gap:${plans[k].gap ?? 0.5},c:[${plans[k].c.join(',')}]}`).join(',\n');
let s = fs.readFileSync(f,'utf8');
s = s.replace(/const DEMOS = [\s\S]*?; \/\/ @DEMOS/, `const DEMOS = {\n${body}\n}; // @DEMOS`);
fs.writeFileSync(f, s); console.log('levels', Object.keys(plans).join(','));
