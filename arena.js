// Existing avatar values are also the profile API's identifiers. Only their artwork changes.
const symbols = ['🦊','🦉','🧙','😎','🐱','👑','🐯','🎧','🦅','🥷','🤠','🤖','🐼','🎩','🐺','🦁'];
const extra = new Map([['🐻',4],['🦈',11],['🐉',8]]);
function faceNumber(value) {
  const id = symbols.indexOf(value);
  if (id >= 0) return id;
  if (extra.has(value)) return extra.get(value);
  return [...value].reduce((n,c) => (n*31+c.codePointAt(0)) >>> 0, 7) % 16;
}
const selectors = '.av,.avatar,.sav,.avatars button[data-av],#tabbar a[href="#/profile"] .ni';
function dress(node) {
  if (node.querySelector('.arena-face')) return;
  const value = node.dataset.av || node.textContent.trim() || '♠';
  const n = faceNumber(value);
  const face = document.createElement('span');
  face.className='arena-face';
  face.setAttribute('aria-hidden','true');
  face.style.setProperty('--face-x', (n%4)*100/3+'%');
  face.style.setProperty('--face-y', Math.floor(n/4)*100/3+'%');
  node.replaceChildren(face);
}
function apply(root) {
  if (root.matches(selectors)) dress(root);
  root.querySelectorAll(selectors).forEach(dress);
}
new MutationObserver(records => {
  for (const record of records) for (const node of record.addedNodes)
    if (node.nodeType === 1 && !node.classList.contains('arena-face')) apply(node);
}).observe(document.body,{childList:true,subtree:true});
apply(document.body);
