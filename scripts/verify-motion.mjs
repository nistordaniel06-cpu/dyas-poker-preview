import assert from 'node:assert/strict';
import {readdirSync,readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {Hand} from './server/engine.js';

for (const dir of ['public','server','api']) {
  for(const f of readdirSync(dir).filter(f=>f.endsWith('.js'))) execFileSync(process.execPath,['--check',dir+'/'+f]);
}
const hand = count => new Hand({players:Array.from({length:count},(_,seat)=>({seat,userId:'qa'+seat,name:'QA'+seat,stack:1000})),dealer:0,sb:10,bb:20,pace:true}).start();
for(const n of [2,9]) {
  const h=hand(n);
  assert.equal(h.pot(),30);
  for(const p of h.view(null).players) assert.deepEqual(p.cards,[null,null]);
  assert.equal(h.view(0).players.find(p=>p.seat===0).cards.filter(Boolean).length,2);
  assert.equal(new Set(h.players.flatMap(p=>p.cards)).size,2*n);
  for(const p of h.players) p.folded=p.seat!==0;
  h.finishUncontested();
  assert.equal(h.result.winners[0].seat,0);
  assert.equal(h.result.winners[0].amount,30);
  assert.deepEqual(h.result.shown,{});
}
const h=hand(3);
for(const [i,p] of h.players.entries()) {p.total=[40,100,100][i];p.stack=1000-p.total;}
assert.deepEqual(h.buildPots().map(p=>p.amount),[120,120]);
h.runout=true;
while(!h.done) h.runoutStep();
assert.equal(h.board.length,5);
assert.equal(h.result.pots.length,2);
assert.equal(h.result.winners.reduce((sum,w)=>sum+w.amount,0),240);
assert(h.result.pots.every(p=>p.winners.length));
const css=readFileSync('public/tour-ui.css','utf8');
const lum=hex=>hex.match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((s,x,i)=>s+x*[.2126,.7152,.0722][i],0);
for(const [fg,bg] of [['fff5e4','23242b'],['d0c8cc','23242b'],['ffffff','c81e39'],['ffe3e8','362731'],['f9e7cd','33252d']]){
 assert(css.includes('#'+bg));
 assert((lum(fg)+.05)/(lum(bg)+.05)>=4.5);
}
console.log('ARENA_CHECKS_OK syntax, contrast, 2/9 seats, blinds, hole privacy, folds, runout, side pots and payouts');
const tied=hand(2);
tied.board=['Ts','Js','Qs','Ks','As'];
tied.players[0].cards=['2h','3h'];
tied.players[1].cards=['4d','5d'];
for(const p of tied.players){p.total=100;p.stack=900;}
tied.showdown();
assert.equal(tied.result.pots.length,1);
assert.deepEqual(tied.result.winners.map(w=>w.amount),[100,100]);
assert.equal(Object.keys(tied.result.shown).length,2);
const iconSheet=readFileSync('public/control-icons.svg','utf8');
for(const file of readdirSync('public').filter(f=>f.endsWith('.js'))){
  const s=readFileSync('public/'+file,'utf8');
  for(const m of s.matchAll(/control-icons\.svg#([a-z]+)/g)) assert(iconSheet.includes('id="'+m[1]+'"'));
}
console.log('ARENA_SPLIT_AND_ICONS_OK');
