import assert from 'node:assert/strict';
import {Hand} from './server/engine.js';
import {newDeck,bestHand,categoryOf} from './server/cards.js';
import {writeFileSync} from 'node:fs';
const examples=[
 ['As 9d 7c 4h 2s','Qd Jc','Jh Tc'],
 ['Ks 8d 5c 2h 3s','Kh Qc','Kd Jc'],
 ['Ks Qd 7c 3h 2s','Kh Qc','Kd Jc'],
 ['Js 8d 5c 2h 3s','Jh Jc','Kd Qc'],
 ['5c 6d 7s Kh 9c','8h Ad','Ks Qd'],
 ['7h 2c Th Jh 4s','Ah Kh','Kd Qc'],
 ['9s 9d Kc 4h 2s','9h Ks','Kh Qc'],
 ['Qs Qd Qc 4h 2s','Qh As','Kh Kc'],
 ['5d 6d 7d Kh 9d','8d Ac','Ks Qc'],
 ['Td Jd Qd Kh 2s','Kd Ad','Ks Qc'],
];
const names=['Nistor','Ambra','Orion','Alexandru-Mihail','Luna','Daria','Vlad','Mira','Sebastian'];
function make(kind,mode,cap){
 let [board,first,second]=examples[kind].map(s=>s.split(' '));
 let pockets=[first,second],contrib=[625,625];
 if(mode==='split'||mode==='triple'){
   board=['9s','Kc','7d','5h','2c'];if(kind===0)board=['As','Kc','9d','7h','2c'];
   // All players play the selected five board cards, with verified neutral hole cards.
   board=bestHand([...examples[kind][0].split(' '),...first]).cards;
   const score=bestHand(board).score,avail=newDeck().filter(c=>!board.includes(c));pockets=[];
   while(pockets.length<(mode==='triple'?3:2)){let pair;
    for(let i=0;i<avail.length&&!pair;i++)for(let j=i+1;j<avail.length;j++)if(bestHand([...board,avail[i],avail[j]]).score===score){pair=[avail[i],avail[j]];break}
    assert(pair);pockets.push(pair);pair.forEach(c=>avail.splice(avail.indexOf(c),1));
   }
   contrib=pockets.map(()=>250);
 }
 if(mode==='side'){board=['5c','6d','7s','Kh','9c'];pockets=[['8h','Ad'],['8s','Qd'],['Ks','Qc']];contrib=[251,500,500]}
 if(mode==='refund')contrib=[900,625];
 if(mode==='wheel'){board=['2c','3d','4s','Kh','5c'];pockets=[['Ah','Qd'],['Ks','Qc']]}
 if(mode==='fold'){board=board.slice(0,3);contrib=[700,300]}
 const publicNames=names.slice();if(kind===5)[publicNames[0],publicNames[1]]=[publicNames[1],publicNames[0]];
 const h=new Hand({players:publicNames.slice(0,cap).map((name,seat)=>({seat,userId:'demo-'+seat,name,stack:2000})),dealer:cap-1,sb:25,bb:50}).start();
 const used=[...board,...pockets.flat()];assert.equal(new Set(used).size,used.length);
 const deck=newDeck().filter(c=>!used.includes(c));h.board=board;h.street=board.length===5?'river':'flop';
 for(const [i,p] of h.players.entries()){p.cards=pockets[i]||deck.splice(0,2);p.folded=i>=pockets.length||(mode==='fold'&&i>0);p.total=contrib[i]||((mode==='split'||mode==='triple')&&i===pockets.length?25:0);p.bet=0;p.allIn=mode==='allin'&&i===0||mode==='side'&&i<2;p.startStack=p.allIn?p.total:2000;p.stack=p.startStack-p.total;p.lastAction=p.folded?'fold':p.allIn?'all-in':'call'}
 const dealt=[...board,...h.players.flatMap(p=>p.cards)];assert.equal(dealt.length,new Set(dealt).size);
 if(mode==='fold')h.finishUncontested();else h.showdown();
 const r=h.result,pots=r.presentation;
 assert.equal(pots.flatMap(p=>p.awards).reduce((s,a)=>s+a.amount,0),h.pot()-r.rake);
 for(const w of r.winners)assert.equal(pots.flatMap(p=>p.awards).filter(a=>a.seat===w.seat).reduce((s,a)=>s+a.amount,0),w.amount);
 if(mode==='side')assert.deepEqual(pots.map(p=>p.awards.map(a=>a.amount)),[[377,376],[498]]);
 if(mode==='refund')assert.equal(pots.at(-1).awards[0].amount,275);
 if(mode==='fold')assert.deepEqual(r.shown,{});
 else {assert.equal(pots[0].awards[0].kind,mode==='side'||mode==='wheel'?4:kind);if(mode==='split'||mode==='triple')assert.equal(pots[0].awards.length,pockets.length)}
 const hand=h.view(null);return {hand,table:{id:'victory-lab',capacity:cap,name:'Galerie de victorii',sb:25,bb:50,jackpot:0},seats:hand.players.map(p=>({...p,ready:true})),lastResult:{...r,names:publicNames},mySeat:null,reactions:[],canSit:false};
}
let count=0;
for(const cap of [6,9]){const samples={};for(let k=0;k<10;k++)for(const mode of ['normal','allin','fold','split','triple','refund']){samples[k+'-'+mode]=make(k,mode,cap);count++}for(const mode of ['side','wheel']){samples['4-'+mode]=make(4,mode,cap);count++}writeFileSync('public/victories/hands-'+cap+'.json',JSON.stringify(samples))}
console.log('VERIFIED',count,'fixtures with Hand, bestHand, unique cards and per-seat chip reconciliation');
