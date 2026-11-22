// Mesaje private între jucători: butonul ✉️ (cu bulina mesajelor necitite), lista conversațiilor,
// „Mesaj nou” cu jucătorii din cluburile tale și ✉️ lângă cei online în club. Conversația folosește fereastra chatului (chat.js).
const DY = () => window.DY;
const $app = document.getElementById("app");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const av = (x) => `<span class="av">${x.avatar ? esc(x.avatar) : esc(String(x.name || "?")[0].toUpperCase())}</span>`;
const loadChat = () => import("/chat.js?v=2"); // același modul ca în app.js
const when = (t) => {
  const d = new Date(t), now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });
  const y = new Date(now); y.setDate(now.getDate() - 1);
  return d.toDateString() === y.toDateString() ? "ieri" : d.toLocaleDateString("ro-RO", { day: "numeric", month: "short" });
};

let unread = 0, lastPoll = 0;

// ---------- bulina ----------
async function poll(force) {
  if (!DY()?.token || (!force && Date.now() - lastPoll < 15000)) return;
  lastPoll = Date.now();
  try { unread = (await DY().api("GET", "/api/dm/unread")).unread; } catch { return; }
  paintBadges();
}
function paintBadges() {
  document.querySelectorAll("[data-dm-badge]").forEach((b) => { b.hidden = !unread; b.textContent = unread > 9 ? "9+" : unread; });
}
setInterval(() => { if (!document.hidden) poll(); }, 5000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) poll(true); });
addEventListener("dy:dm-read", () => { poll(true); if (document.querySelector(".dm-sheet")) paintInbox(); });

// ---------- butonul ✉️ din bara de sus (acasă și în club) ----------
function headerButton() {
  const v = DY()?.view?.name;
  if (v !== "home" && v !== "club") return;
  const bar = $app.querySelector(v === "home" ? ".appbar" : ".topbar");
  if (!bar || bar.querySelector("[data-dm-open]")) return;
  const btn = document.createElement("button");
  btn.type = "button"; btn.className = "dm-btn"; btn.dataset.dmOpen = ""; btn.dataset.testid = "dm-btn";
  btn.setAttribute("aria-label", "Mesaje private");
  btn.innerHTML = `<svg class="dm-glyph" aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.5 13.5a3 3 0 0 1-3 3H10L5 20v-3.5a3 3 0 0 1-2-3v-7a3 3 0 0 1 3-3h11.5a3 3 0 0 1 3 3z"/><path d="M7.5 8h8.5M7.5 12h5.5"/></svg><b class="unread" data-dm-badge hidden></b>`;
  btn.onclick = openInbox;
  const before = bar.querySelector(".admin-btn, .avatar");
  if (before) bar.insertBefore(btn, before); else bar.appendChild(btn);
  paintBadges();
  poll();
}
// ✉️ lângă fiecare jucător online din club
function onlineButtons() {
  for (const b of $app.querySelectorAll("[data-invite]")) {
    const row = b.parentElement;
    if (!row || row.querySelector("[data-dm-to]")) continue;
    const x = document.createElement("button");
    x.type = "button"; x.className = "btn sm dm-to"; x.dataset.dmTo = b.dataset.invite; x.dataset.name = b.dataset.name || "";
    x.setAttribute("aria-label", `Mesaj privat către ${b.dataset.name || ""}`); x.dataset.testid = "dm-to";
    x.textContent = "✉️";
    x.onclick = () => openConversation(x.dataset.dmTo, x.dataset.name);
    row.insertBefore(x, b);
  }
}

// ---------- lista conversațiilor ----------
let sheet = null, people = null;
function openInbox() {
  closeSheet(true);
  sheet = document.createElement("div");
  sheet.className = "tsheet td-sheet dm-sheet"; sheet.dataset.testid = "dm-inbox";
  sheet.innerHTML = `<div class="tsheet-bg" data-close></div><div class="tsheet-box" role="dialog" aria-label="Mesaje private">
    <div class="td-head"><div class="grow"><h3><svg class="arena-control-icon" aria-hidden="true"><use href="/control-icons.svg#chat"></use></svg> Mesaje private</h3><small>Doar tu și celălalt jucător vedeți conversația</small></div><button type="button" class="td-x" data-close aria-label="Închide">×</button></div>
    <div class="dm-tabs"><button type="button" class="on" data-tab="inbox">Conversații</button><button type="button" data-tab="new" data-testid="dm-new"><svg class="arena-control-icon" aria-hidden="true"><use href="/control-icons.svg#plus"></use></svg> Mesaj nou</button></div>
    <div class="td-body dm-body"><div class="skel"><div class="sk-row"></div><div class="sk-row"></div></div></div></div>`;
  document.body.appendChild(sheet);
  sheet.addEventListener("click", (e) => {
    if (e.target.closest("[data-close]")) return closeSheet();
    const t = e.target.closest("[data-tab]");
    if (t) { sheet.querySelectorAll("[data-tab]").forEach((b) => b.classList.toggle("on", b === t)); return t.dataset.tab === "new" ? paintPeople() : paintInbox(); }
    const c = e.target.closest("[data-conv]");
    if (c) openConversation(c.dataset.conv, c.dataset.name);
  });
  addEventListener("hashchange", onHash);
  paintInbox();
}
function closeSheet(now) {
  if (!sheet) return;
  const s = sheet; sheet = null;
  removeEventListener("hashchange", onHash);
  if (now) return s.remove();
  s.classList.add("out"); setTimeout(() => s.remove(), 180);
}
const onHash = () => { if (!location.hash.startsWith("#/dm/")) closeSheet(); };
const body = () => sheet?.querySelector(".dm-body");

async function paintInbox() {
  const el = body(); if (!el) return;
  let items;
  try { items = (await DY().api("GET", "/api/dm")).items; } catch { el.innerHTML = `<div class="small muted">Nu s-au putut încărca mesajele.</div>`; return; }
  if (!body() || sheet.querySelector('[data-tab="new"].on')) return;
  el.innerHTML = items.length ? `<div class="dm-list">${items.map((x) => `<button type="button" class="dm-row ${x.unread ? "new" : ""}" data-conv="${x.userId}" data-name="${esc(x.name)}" data-testid="dm-conv">
      ${av(x)}<span class="grow"><b>${esc(x.name)}</b><small>${x.mine ? "Tu: " : ""}${esc(x.preview ?? "")}</small></span>
      <span class="dm-meta"><small>${when(x.at)}</small>${x.unread ? `<b class="unread">${x.unread > 9 ? "9+" : x.unread}</b>` : ""}</span></button>`).join("")}</div>`
    : `<div class="dm-empty">Nicio conversație încă.<br><button type="button" class="btn primary" data-tab="new"><svg class="arena-control-icon" aria-hidden="true"><use href="/control-icons.svg#plus"></use></svg> Scrie cuiva</button></div>`;
}
async function paintPeople() {
  const el = body(); if (!el) return;
  try { people ||= (await DY().api("GET", "/api/dm/people")).people; } catch { el.innerHTML = `<div class="small muted">Nu s-a putut încărca lista.</div>`; return; }
  el.innerHTML = `<input class="dm-search" type="search" placeholder="Caută un jucător…" aria-label="Caută un jucător" data-testid="dm-search">
    <div class="dm-list" data-people></div>`;
  const list = el.querySelector("[data-people]"), q = el.querySelector("input");
  const draw = () => {
    const k = q.value.trim().toLowerCase();
    const f = people.filter((p) => !k || p.name.toLowerCase().includes(k));
    list.innerHTML = f.length ? f.map((p) => `<button type="button" class="dm-row" data-conv="${p.userId}" data-name="${esc(p.name)}" data-testid="dm-person">${av(p)}<span class="grow"><b>${esc(p.name)}</b></span><span class="chev">›</span></button>`).join("")
      : `<div class="small muted">${people.length ? "Niciun jucător cu numele ăsta." : "Încă nu ești într-un club cu alți jucători."}</div>`;
  };
  q.oninput = draw; draw();
}

// ---------- conversația ----------
async function openConversation(uid, name) {
  try {
    const m = await loadChat();
    if (!name) name = people?.find((p) => p.userId === uid)?.name;
    if (!name) { try { name = (await DY().api("GET", `/api/dm/${uid}/chat`)).peer?.name; } catch (e) { return DY().toast(e.message); } }
    m.sync({ kind: "dm", id: uid, name: name || "" }, 0, 0);
    m.open();
  } catch { DY().toast("Conversația nu s-a putut deschide."); }
}

// notificare apăsată: #/dm/<id> deschide direct conversația
function fromHash() {
  const m = location.hash.match(/^#\/dm\/([0-9a-f-]{36})$/i);
  if (!m || !DY()?.token) return;
  history.replaceState(null, "", "#/");
  openConversation(m[1]);
}
addEventListener("hashchange", fromHash);
setTimeout(fromHash, 600);

let queued = false;
new MutationObserver(() => {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => { queued = false; if (!DY()) return; headerButton(); if (DY().view?.name === "club") onlineButtons(); });
}).observe($app, { childList: true, subtree: true });

window.dyDm = { openInbox, openConversation };
