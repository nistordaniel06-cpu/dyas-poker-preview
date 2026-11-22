import {readFileSync,writeFileSync} from 'node:fs';

function edit(path, pairs) {
  let source = readFileSync(path,'utf8');
  for (const [before,after] of pairs) {
    if (!source.includes(before)) throw Error('Missing animation or timing template in '+path+' '+before);
    source = source.replaceAll(before,after);
  }
  writeFileSync(path,source);
}

edit('server/api.js', [['startDelay: 1200, nextDelay: 3500','startDelay: 2400, nextDelay: 6500']]);
edit('server/game.js', [['opts.runoutMs ?? 1800','opts.runoutMs ?? 2600'],['now + opts.nextDelay + (h.ranOut','now + opts.nextDelay + (opts.nextDelay > 0 ? Math.max(0, h.result.pots.length - 1) * 900 : 0) + (h.ranOut']]);
edit('public/app.js', [
  ['trackAnims(T.state, st);','trackAnims(T.state, st);\n  window.dispatchEvent(new CustomEvent("arena-table-state", {detail:st}));'],
  ['animAt(T.anim.deal, 420','animAt(T.anim.deal, 480'],
  ['* h.players.length) * 70','* h.players.length) * 95'],
  ['now + (i - from) * 140','now + 220 + (i - from) * 170'],
  ['animAt(T.anim.board[i], 520)','animAt(T.anim.board[i], 560)']
]);
