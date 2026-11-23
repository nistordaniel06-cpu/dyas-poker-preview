// Add display metadata after the engine has settled the hand.
import {bestHand,categoryOf,RANKS} from './server/cards.js';
export function describe(hand){
 const r=hand.result, bySeat=Object.fromEntries(hand.players.map(p=>[p.seat,p]));
 const sorted=hand.players.slice().sort((a,b)=>b.total-a.total);
 const excess=Math.max(0,sorted[0].total-sorted[1].total);
 const pots=r.pots.map((p,i)=>({name:i?'Pot lateral '+i:'Pot principal',awards:(p.awards||r.winners).map(({seat,amount})=>({seat,amount})),eligible:p.seats}));
 const last=pots.at(-1);
 if(excess&&last.awards.some(w=>w.seat===sorted[0].seat&&w.amount>=excess)){
   const award=last.awards.find(w=>w.seat===sorted[0].seat);award.amount-=excess;
   last.awards=last.awards.filter(w=>w.amount);if(!last.awards.length)pots.pop();
   pots.push({name:'Pariu neacoperit',refund:true,awards:[{seat:sorted[0].seat,amount:excess}]});
 }
 const evaluations=Object.fromEntries(Object.entries(r.shown).map(([seat,pocket])=>[seat,bestHand([...hand.board,...pocket])]));
 for(const p of pots)for(const a of p.awards){
  if(r.uncontested||p.refund)continue;
  const best=evaluations[a.seat], cat=categoryOf(best.score);
  const rank=c=>RANKS.indexOf(c[0]),counts=c=>best.cards.filter(x=>x[0]===c[0]).length;
  const straight=cat===4||cat===8,wheel=straight&&best.cards.some(c=>c[0]==='A')&&best.cards.some(c=>c[0]==='5');
  a.cards=best.cards.slice().sort((x,y)=>straight?((wheel&&x[0]==='A'?-1:rank(x))-(wheel&&y[0]==='A'?-1:rank(y))):counts(y)-counts(x)||rank(y)-rank(x));
  a.kind=cat===8&&a.cards.at(-1)[0]==='A'?9:cat;
  a.hand=['Carte mare','O pereche','Două perechi','Trei de un fel','Chintă până la '+a.cards[4][0],'Culoare','Full house','Careu','Chintă de culoare','Chintă regală'][a.kind];
  if(cat===6&&a.cards[0][0]==='9'&&a.cards[3][0]==='K')a.hand='Full de nouari cu popi';
  a.allIn=bySeat[a.seat].allIn;
  const rival=p.eligible.filter(n=>n!==a.seat).map(n=>evaluations[n]).sort((x,y)=>y.score-x.score)[0];
  if(rival&&categoryOf(rival.score)===cat&&best.score>rival.score&&[0,1,2,3,7].includes(cat)){
   for(let k=0;k<5;k++){const place=15**(4-k),v=Math.floor(best.score/place)%15;if(v!==Math.floor(rival.score/place)%15){if(k>=(cat===0?0:cat===2?2:1))a.kicker=RANKS[v-2];break}}
  }
 }
 return pots;
}
