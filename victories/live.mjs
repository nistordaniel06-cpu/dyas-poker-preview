const $=s=>document.querySelector(s), fmt=n=>n.toLocaleString('ro-RO');
const seat=n=>$('[data-testid="seat-'+n+'"] .box'), rect=e=>e.getBoundingClientRect();
const point=e=>{const r=rect(e);return [r.left+r.width/2,r.top+r.height/2]};
const element=(tag,cls,parent,text)=>{const e=document.createElement(tag);e.className=cls;if(text!=null)e.textContent=text;parent.append(e);return e};
const symbols={s:'♠',c:'♣',h:'♥',d:'♦'};
let key='',run=0,layer,caption,summary,primary,active=false,latest,timers=[],seen=new Set(),received=new Map();
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
function later(fn,ms){const id=run;timers.push(setTimeout(()=>{if(id===run)fn()},ms))}
export function clearVictory(){++run;timers.forEach(clearTimeout);timers=[];layer?.remove();layer=null;primary=null;received.clear();active=false;document.body.classList.remove('victory-active');document.querySelectorAll('.v-hit').forEach(e=>e.classList.remove('v-hit'))}
function focusCards(){document.querySelectorAll('.v-hit').forEach(e=>e.classList.remove('v-hit'));for(const c of primary?.highlight||primary?.cards||[])document.querySelectorAll('#app .pcard[data-card="'+c+'"]').forEach(el=>el.classList.add('v-hit'))}
function align(){if(!layer)return;const board=$('#app .board');if(!board)return;const r=rect(board);Object.assign(caption.style,{left:(r.left+r.width/2)+'px',top:(r.bottom+4)+'px',width:Math.min(r.width+18,360)+'px'});for(const b of layer.querySelectorAll('.v-amount')){const el=seat(+b.dataset.seat);if(el){const r=rect(el);b.style.left=(r.left+r.width/2)+'px';b.style.top=(r.bottom+2)+'px'}}focusCards()}
function receipt(n,v,totalOnly=false){received.set(n,(received.get(n)||0)+v);let b=layer.querySelector('[data-seat="'+n+'"]');if(!b){b=element('b','v-amount',layer);b.dataset.seat=n}b.textContent='+'+fmt(totalOnly?received.get(n):v);align()}
function svgArt(a,slow){
 const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 100 35');svg.setAttribute('preserveAspectRatio','none');svg.classList.add('v-art');summary.append(svg);
 const draw=(d,delay=0,dur=500)=>{let p=document.createElementNS(ns,'path');p.setAttribute('d',d);p.setAttribute('pathLength','1');svg.append(p);p.animate([{strokeDasharray:'1',strokeDashoffset:1,opacity:.2},{strokeDasharray:'1',strokeDashoffset:0,opacity:1}],{duration:dur*slow,delay:delay*slow,fill:'both'});return p};
 const pulse=(i,delay=0)=>summary.children[i].animate([{outlineColor:'transparent'},{outlineColor:'#fff2ba',boxShadow:'0 0 6px #e1af66'},{outlineColor:'#d7ae71'}],{duration:500*slow,delay:delay*slow,fill:'both'});
 const xs=[10,30,50,70,90], k=a.kicker?a.cards.findIndex(c=>c[0]===a.kicker):0;
 switch(a.kind){
 case 0:{const shine=draw('M'+(xs[k]-8)+' 12 l14 -10',0,420);shine.classList.add('v-glint');pulse(k);break}
 case 1:pulse(0);pulse(1);if(a.kicker&&k>=2)pulse(k,500);break;
 case 2:draw('M3 8 Q20 -5 37 8');draw('M43 8 Q60 -5 77 8',180);break;
 case 3:for(const x of xs.slice(0,3))draw('M'+x+' 26 Q'+x+' 32 30 34');break;
 case 4:xs.forEach((x,i)=>{draw('M'+(x-1)+' 29 a1 1 0 1 0 2 0 a1 1 0 1 0 -2 0',i*100,110);pulse(i,i*100)});break;
 case 5:case 8:{const d=a.kind===5?'M2 26 Q25 11 50 23 T98 14':'M5 29 L95 22';draw(d,0,950);const emblem=document.createElementNS(ns,'text');emblem.textContent=symbols[a.cards[0][1]];svg.append(emblem);const mot=document.createElementNS(ns,'animateMotion');mot.setAttribute('path',d);mot.setAttribute('dur',.95*slow+'s');mot.setAttribute('begin','indefinite');mot.setAttribute('fill','freeze');emblem.append(mot);mot.beginElement();break}
 case 6:{const trio=draw('M1 10 Q1 3 7 3 H53 Q59 3 59 10 M1 25 Q1 32 7 32 H53 Q59 32 59 25');const pair=draw('M61 10 Q61 3 67 3 H93 Q99 3 99 10 M61 25 Q61 32 67 32 H93 Q99 32 99 25',160);for(const [shape,x] of [[trio,-3],[pair,3]])shape.animate([{transform:'translateX('+x+'px)'},{transform:'translateX(0)'}],{duration:650*slow});break}
 case 7:xs.slice(0,4).forEach(x=>draw('M'+x+' 34 v-9',0,400));if(a.kicker)pulse(4,450);break;
 case 9:xs.forEach(x=>draw('M'+x+' 25 Q'+x+' 14 50 7',0,600));draw('M37 2 l6 5 7 -7 7 7 6 -5 -3 9 H40 Z',550,550);draw('M50 10 v20',1100,350);break;
 }
}
function rail(n,slow){const felt=$('#app .felt'),target=seat(n);if(!felt||!target)return;const r=rect(felt),[x,y]=point(target),cx=r.left+r.width/2,cy=r.top+r.height/2,angle=Math.atan2((y-cy)/r.height,(x-cx)/r.width);const dot=element('i','v-orbit',layer);const frames=Array.from({length:49},(_,i)=>{const t=angle+2*Math.PI*(i/48-1);return {left:cx+Math.cos(t)*r.width*.49+'px',top:cy+Math.sin(t)*r.height*.49+'px'}});frames.push({left:x+'px',top:y+'px'});dot.animate(frames,{duration:880*slow}).finished.then(()=>dot.remove(),()=>{})}
function fly(group,slow){const pot=$('#app [data-testid="pot"]');if(!pot)return;
 group.awards.forEach((a,i)=>{const dest=seat(a.seat);if(!dest)return;const [x,y]=point(pot),r=rect(dest);for(let j=0;j<(group.refund?1:3);j++){const chip=element('i','fx-chip '+(group.refund?'k':'r'),layer);const origin=x+(i-(group.awards.length-1)/2)*13+j*2;const dx=r.left+r.width/2+(j-1)*5,dy=r.bottom-2;chip.animate([{transform:'translate('+origin+'px,'+y+'px) scale(.65)'},{transform:'translate('+((origin+dx)/2)+'px,'+((y+dy)/2-12)+'px) scale(.9)'},{transform:'translate('+dx+'px,'+dy+'px) scale(.67)'}],{duration:500*slow,delay:j*45*slow,fill:'both'}).finished.then(()=>chip.remove(),()=>{})}later(()=>receipt(a.seat,a.amount),600*slow)});
}
function show(group,st,motion,slow){
 primary={...group.awards[0],highlight:[...new Set(group.awards.flatMap(a=>a.cards||[]))]};caption.replaceChildren();summary=element('div','v-summary',caption);
 if(primary.cards){for(const c of primary.cards){const e=element('span','v-card',summary,(c[0]==='T'?'10':c[0])+symbols[c[1]]);if('hd'.includes(c[1]))e.classList.add('v-red')}if(motion)svgArt(primary,slow)}
 const title=group.awards.map(a=>(st.lastResult.names[a.seat]||'Jucător')+' '+(group.refund?'primește înapoi':'câștigă')+' '+fmt(a.amount)).join(' · ');
 const heading=element('strong','',caption,title), detail=element('small','',caption,[primary.hand,group.awards.some(a=>a.allIn)?'All-in':'',st.lastResult.presentation.length>1?group.name:''].filter(Boolean).join(' · '));
 if(motion&&primary.cards){heading.style.visibility=detail.style.visibility='hidden';later(()=>heading.style.visibility=detail.style.visibility='visible',Math.min(primary.kind>=8?1050:550,1000)*slow);if(group.awards.some(a=>a.allIn))rail(group.awards.find(a=>a.allIn).seat,slow)}
 align();
}
export function present(st,{slow=1,replay=false}={}){
 const id=st.table.id+'/'+st.handNo,same=id===key;const wasLive=same&&latest&&!latest.hand?.done;
 if(!same||replay){clearVictory();key=id}
 latest=st;if(!st.hand?.done||!st.lastResult?.presentation?.length)return;
 if(active&&!replay){align();return}
 const motion=!reduced()&&(replay||wasLive&&!seen.has(id));seen.add(id);if(seen.size>150)seen.delete(seen.values().next().value);
 active=true;document.body.classList.add('victory-active');layer=element('div','v-layer',document.body);caption=element('div','v-caption',layer);caption.setAttribute('role','status');caption.hidden=true;
 const groups=st.lastResult.presentation;
 if(!motion){caption.hidden=false;show(groups.find(g=>!g.refund)||groups[0],st,false,1);for(const g of groups)for(const a of g.awards)receipt(a.seat,a.amount,true);return}
 let time=st.lastResult.uncontested?60:500;
 for(const g of groups){
  later(()=>{caption.hidden=false;show(g,st,true,slow)},time*slow);
  time+=g.refund||st.lastResult.uncontested?70:g.awards[0].kind>=8?1500:950;
  later(()=>fly(g,slow),time*slow);time+=850;
 }
}
addEventListener('victory-render',e=>present(e.detail));addEventListener('hashchange',()=>{clearVictory();key='';latest=null});addEventListener('resize',align);addEventListener('scroll',align,{passive:true});
