import {readdirSync,readFileSync,writeFileSync} from 'node:fs';
const symbols = {
  key:['🔑','M14 4a5 5 0 1 1-3 9L5 19H2v-3l7-7a5 5 0 0 1 5-5z M16 7h.01'],
  settings:['⚙','M3 6h6m4 0h8M3 12h12m4 0h2M3 18h4m4 0h10 M9 3v6m6 0v6m-8 0v6'],
  chat:['💬 ✉','M4 4h16v12H9l-5 4z M8 8h8m-8 4h5'],
  warn:['⚠','M12 3 2 20h20z M12 9v5m0 3h.01'],
  bell:['🔔','M5 17h14l-2-4V9a5 5 0 0 0-10 0v4z M10 20q2 2 4 0'],
  shield:['🛡','M12 3l8 3v5c0 5-4 8-8 10-4-2-8-5-8-10V6z M8 12l3 3 5-6'],
  copy:['📋 🔗','M8 8h12v13H8z M5 16H3V3h12v2'],
  delete:['🗑 🧹','M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7'],
  flag:['🚩','M5 21V3m0 2c6-5 8 4 15-1v10c-7 5-9-4-15 1'],
  announce:['📣','M4 9h5l11-5v16L9 15H4z M7 15l2 6h3l-2-6'],
  chart:['📊','M3 3v18h18M7 16v-4m5 4V7m5 9V9'],
  edit:['✏','M4 16l12-12 4 4L8 20l-5 1z M13 7l4 4'],
  crown:['👑','M2 7l5 4 5-7 5 7 5-4-3 12H5z'],
  trophy:['🏆','M7 3h10v6c0 4-2 6-5 6s-5-2-5-6z M7 5H3v3q0 4 5 4m9-7h4v3q0 4-5 4m-4 3v5m-4 1h8'],
  clock:['⏱','M12 5a8 8 0 1 0 .1 0z M10 2h4m-2 7v5l3 2'],
  coffee:['☕','M3 7h13v7a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5z M16 8h2a3 3 0 1 1 0 6h-2M2 22h17'],
  reload:['🔁 ↩','M4 10a8 8 0 1 1 0 5M4 4v6h6'],
  plus:['➕ ＋','M12 4v16M4 12h16'],
  phone:['📱','M7 2h10v20H7z M11 18h2'],
  lock:['🔒','M5 10h14v11H5z M8 10V7a4 4 0 0 1 8 0v3'],
  cards:['🃏','M4 5h12v16H4z M9 2l11 1-1 15'],
  mute:['🔇','M3 9h4l5-4v14l-5-4H3z M16 9l6 6m0-6-6 6']
};
const byGlyph = new Map();
let xml = '<svg xmlns="http://www.w3.org/2000/svg">';
for(const [id,[glyphs,d]] of Object.entries(symbols)){
  xml += '<symbol id="'+id+'" viewBox="0 0 24 24"><path d="'+d+'"/></symbol>';
  for(const glyph of glyphs.split(' ')) byGlyph.set(glyph,id);
}
writeFileSync('public/control-icons.svg',xml+'</svg>');
const leading = new RegExp('(<(?:button|a|h[123]|summary)\\b[^<>]{0,400}>)(\\s*)('+[...byGlyph.keys()].join('|')+')(?:️)?\\s+(?=[A-Za-zĂÂÎȘȚăâîșț])','gu');
for(const file of readdirSync('public').filter(f=>f.endsWith('.js'))){
  const path='public/'+file, source=readFileSync(path,'utf8');
  const result=source.replace(leading,(_,tag,space,glyph)=>tag+space+'<svg class="arena-control-icon" aria-hidden="true"><use href="/control-icons.svg#'+byGlyph.get(glyph)+'"></use></svg> ');
  if(source!==result) writeFileSync(path,result);
}
