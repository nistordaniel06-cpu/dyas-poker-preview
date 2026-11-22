// Indices correspond to cells in the two illustration sheets. The API stores the original symbols.
const portraits = ['🦊','🦉','🧙','😎','🐻','👑','🐯','🎧','🦅','🥷','🤠','🤖','🐼','🎩','🐺','🦁','🃏','🦈','💀','🐉','🍀','👽','🔥','💎','🎯'];
const names = ['Vulpea','Bufnița','Iluzionista','Jucătorul cu fes','Pisica','Crupiera','Tigrul','Melomanul','Vulturul','Ratonul','Jucătoarea în verde','Robotul','Panda','Jucătoarea cu ochelari','Lupul','Căpitanul','Iepurele magician','Rechinul','Profesorul bursuc','Dragonul','Cameleonul','Flamingoul','Ursul pilot','Jucătoarea punk','Berbecul'];
const selectors = '.av,.avatar,.sav,.avatars button[data-av]';
function dress(node) {
  if (node.querySelector('.arena-face')) return;
  const value = node.dataset.av ?? node.textContent.trim();
  const n = portraits.indexOf(value);
  if (n < 0) return;
  const extra = n >= 16;
  const index = extra ? n - 16 : n;
  const columns = extra ? 3 : 4;
  const face = document.createElement('span');
  face.className = extra ? 'arena-face extra-face' : 'arena-face';
  if (node.hasAttribute('data-av')) node.setAttribute('aria-label', names[n]);
  face.setAttribute('aria-hidden','true');
  face.style.setProperty('--face-x', (index % columns) * 100 / (columns - 1)+'%');
  face.style.setProperty('--face-y', Math.floor(index / columns) * 100 / (columns - 1)+'%');
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
