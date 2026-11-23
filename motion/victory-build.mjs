import {readFileSync as read,writeFileSync as write} from 'node:fs';
const get=f=>read(f,'utf8');
function change(s,a,b){if(!s.includes(a))throw Error('Missing template '+a);return s.replace(a,b)}
let engine=get('server/engine.js');
engine='import {describe} from "../settlement.mjs";\n'+engine;
engine=change(engine,'for (const s of winners) {','pot.awards=[];\n      for (const s of winners) {');
engine=change(engine,'won.set(s,','pot.awards.push({seat:s,amount:amt});\n        won.set(s,');
engine=change(engine,'winners: x.winners','awards:x.awards, winners: x.winners');
engine=change(engine,'shown: {}, rake };','shown: {}, rake };\n    this.result.presentation=describe(this);');
engine=change(engine,'      rake,\n    };','      rake,\n    };\n    this.result.presentation=describe(this);');
write('server/engine.js',engine);
await import('./fixtures.mjs');
if(process.argv.includes('--fixtures'))process.exit(0);
let app=get('public/app.js');
app=change(app,'if (h?.done && s.lastResult && winners.size)', 'if (h?.done && s.lastResult && !s.lastResult.presentation && winners.size)');
const extraSeat=app.indexOf('  if (s.mySeat == null) {\n    const occ = s.seats.find((x) => x.seat === anchor);');
if(extraSeat>=0){const next=app.indexOf(' else if (mine && mine.bet',extraSeat);if(next<0)throw Error('Missing seat boundary');app=app.slice(0,extraSeat)+'  '+app.slice(next+6)}
app=change(app,'  bindTable(s, h, mine);','  window.dispatchEvent(new CustomEvent("victory-render",{detail:s}));\n  bindTable(s, h, mine);');
write('public/app.js',app);
let fx=get('public/fx.js');fx=change(fx,'if (!ended) return;', 'if (!ended || st.lastResult?.presentation) return;');write('public/fx.js',fx);
const between=(a,b)=>app.slice(app.indexOf(a),app.indexOf(b,app.indexOf(a)+a.length));
const table=between('function renderTable()','function firstFree(');
const render=table.slice(0,table.indexOf('  window.dispatchEvent(new CustomEvent("victory-render"'))+'\n}';
const helper=between('const LAYOUT =','async function enterTable')+between('function cardHtml','// ---------- anima')+between('const ACTION_LABEL','function renderTable');
const declarations=app.split('\n').filter(l=>/^const (esc|fmt|FELT) =/.test(l)).join('\n');
write('public/victories/table.mjs',declarations+'\n'+helper+'\n'+`const $app=document.getElementById('app'), T={anim:{board:{},bets:{}}},wsUp=true,CH={unread:0};const animAt=()=>null,firstFree=()=>0,renderPanel=()=>'';export {cardHtml};export function display(st){T.state=st;renderTable();}\n`+render);
let html=get('public/index.html');html=change(html,'</head>','<link rel="stylesheet" href="/victories/motion.css"><script type="module" src="/victories/live.mjs"></script></head>');write('public/index.html',html);
const css=[...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/g)].filter(m=>!m[0].includes('https:')).map(m=>m[0].replace(/href="(?!\/)/,'href="/')).join('\n');
write('public/victories/index.html',get('public/victories/template.html').replace('<!--APP_STYLES-->',css));
