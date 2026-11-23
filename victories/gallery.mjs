import {delay,cancel,freeze} from './clock.mjs';
import {display} from './table.mjs';
import {clearVictory,present} from './live.mjs';
const $=s=>document.querySelector(s),kind=$('#kind'),mode=$('#mode'),cap=$('#cap'),rate=$('#rate');
['Carte mare','O pereche','Două perechi','Trei de un fel','Chintă','Culoare','Full house','Careu','Chintă de culoare','Chintă regală'].forEach((n,i)=>kind.add(new Option(n,i)));
for(const [v,t] of Object.entries({normal:'Showdown',allin:'All-in',fold:'Toți dau fold',split:'Egalitate în doi',triple:'Egalitate în trei',side:'Principal + lateral',refund:'Pariu neacoperit',wheel:'Chintă A–5'}))mode.add(new Option(t,v));
let seq=0;const cache=new Map();
async function play(){
 const id=++seq;clearVictory();const slow=+rate.value,k=kind.value,m=mode.value,n=cap.value;
 $('#ledger').textContent='';if(!cache.has(n))cache.set(n,fetch('./hands-'+n+'.json').then(r=>{if(!r.ok)throw Error();return r.json()}).catch(e=>{cache.delete(n);throw e}));
 const data=await cache.get(n);if(id!==seq)return;
 const s=structuredClone(data[k+'-'+m]);s.handNo=id;
 const before=structuredClone(s);before.lastResult=null;before.hand.done=false;before.hand.result=null;before.hand.turn=null;before.hand.runout=true;
 if(m!=='fold')before.hand.board.pop();for(const p of before.hand.players){p.stack-=s.lastResult.winners.find(w=>w.seat===p.seat)?.amount||0;if(m!=='allin'&&m!=='side')p.cards=[null,null]}
 display(before);let msg=document.querySelector('#app .msg');if(!msg){msg=document.createElement('div');msg.className='msg';document.querySelector('#app .center').append(msg)}msg.textContent=m==='allin'?'All-in · Se așteaptă riverul':m==='fold'?'Ultimul fold':'Înainte de rezultat';
 await new Promise(r=>delay(r,700*slow));if(id!==seq)return;
 display(s);present(s,{replay:true,slow});
 const ledger=s.lastResult.presentation.map(p=>p.name+' · '+p.awards.map(a=>s.lastResult.names[a.seat]+' +'+a.amount.toLocaleString('ro-RO')).join(' / ')).join(' | ');
 delay(()=>{if(id===seq)$('#ledger').textContent=ledger},matchMedia('(prefers-reduced-motion: reduce)').matches?0:(500+s.lastResult.presentation.length*1900)*slow);
 if(touring && id===seq) advanceJob=delay(()=>advance(1), (2300+s.lastResult.presentation.length*2350)*slow);
}
function start(){play().catch(()=>$('#ledger').textContent='Galeria nu s-a încărcat. Apasă „Repetă mâna”.')}

const tour = Array.from(kind.options, option=>[+option.value,'normal',option.text]);
tour.push([4,'wheel','Chintă mică · A–5'],[4,'allin','All-in câștigat'],[1,'fold','Victorie prin fold'],[9,'split','Pot împărțit în doi'],[4,'triple','Pot împărțit în trei'],[4,'side','Pot principal și lateral'],[7,'refund','Restituirea pariului neacoperit']);
const scenes=$('#scenes'), button=$('#tourPlay');
tour.forEach(([, ,label],i)=>scenes.add(new Option((i+1)+' / '+tour.length+' · '+label,i)));
let cursor=0,touring=false,paused=false,advanceJob;
function clearNext(){if(advanceJob)cancel(advanceJob);advanceJob=null}
function stop(){clearNext();touring=false;paused=false;freeze(false);button.textContent='Pornește turul'}
function scene(i){clearNext();paused=false;freeze(false);cursor=i;scenes.value=i;
 const [k,m]=tour[i];kind.value=k;mode.value=m;button.textContent=touring?'Pauză':'Pornește turul';start()}
function advance(step){if(cursor+step>=tour.length&&touring){stop();button.textContent='Reia turul';return}scene((cursor+step+tour.length)%tour.length)}
button.onclick=()=>{if(!touring){touring=true;scene(cursor===tour.length-1?0:cursor);return}paused=!paused;freeze(paused);button.textContent=paused?'Continuă turul':'Pauză'};
$('#prev').onclick=()=>advance(-1);$('#next').onclick=()=>advance(1);scenes.onchange=()=>scene(+scenes.value);
function manual(){stop();const i=tour.findIndex(([k,m])=>k===+kind.value&&m===mode.value);scenes.selectedIndex=i;if(i>=0)cursor=i;start()}
function preset(k,m){kind.value=k;mode.value=m;manual()}
document.querySelectorAll('[data-p]').forEach(b=>b.onclick=()=>{const p=b.dataset.p;preset(p==='a'?5:4,p==='s'?'side':p==='a'?'normal':'allin')});
kind.onchange=()=>{if(['side','wheel'].includes(mode.value))mode.value='normal';manual()};
mode.onchange=()=>{if(['side','wheel'].includes(mode.value))kind.value=4;manual()};
cap.onchange=rate.onchange=$('#repeat').onclick=()=>touring?scene(cursor):manual();
if(new URLSearchParams(location.search).has('tur')){touring=true;scene(0)}else preset(4,'allin');
