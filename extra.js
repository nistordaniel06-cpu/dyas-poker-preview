// DYAS Poker — „Azi în club”, ecrane de încărcare frumoase, sunete și vibrații la masă.
// Se agăță de ecranele desenate de app.js (window.DY) fără să le schimbe logica.
const $app = document.getElementById("app");
const DY = () => window.DY;
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const fmt = (n) => Number(n || 0).toLocaleString("ro-RO");
const soundOn = () => localStorage.getItem("dyas.sound") !== "0";
const vibeOn = () => localStorage.getItem("dyas.vibe") !== "0";

// ================= încărcare: schelet animat în loc de „Se încarcă…” =================
const skRow = () => `<div class="sk-row"><i class="sk sk-av"></i><span class="sk-tx"><i class="sk sk-l"></i><i class="sk sk-l short"></i></span><i class="sk sk-pill"></i></div>`;
function skeletons(root) {
  for (const el of root.querySelectorAll(".empty")) {
    if (el.dataset.sk || el.textContent.trim() !== "Se încarcă…") continue;
    el.dataset.sk = "1";
    const full = el.parentElement?.classList.contains("screen") && el.parentElement.children.length <= 2;
    el.innerHTML = `<div class="skel" role="status" aria-label="Se încarcă">${full ? `<i class="sk sk-hero"></i>` : ""}${skRow()}${skRow()}${full ? skRow() + skRow() : ""}</div>`;
  }
}

// ================= sunete și vibrații =================
let ctx = null;
const unlock = () => { try { ctx ||= new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === "suspended") ctx.resume(); } catch { /* fără sunet */ } };
document.addEventListener("pointerdown", unlock, { passive: true });
function tone(f, at, dur, type = "sine", vol = 0.16) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, at);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(vol, at + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(ctx.destination); o.start(at); o.stop(at + dur + 0.02);
}
function flick(at) {
  const n = Math.floor(ctx.sampleRate * 0.05), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  f.type = "bandpass"; f.frequency.value = 2600; f.Q.value = 0.9; g.gain.value = 0.5;
  s.buffer = buf; s.connect(f).connect(g).connect(ctx.destination); s.start(at);
}
export const sfx = {
  deal() { if (!soundOn() || !ctx) return; try { const t = ctx.currentTime; flick(t); flick(t + 0.11); } catch { /* ignoră */ } },
  win() {
    if (soundOn() && ctx) try { const t = ctx.currentTime; [523, 659, 784, 1047].forEach((f, i) => tone(f, t + i * 0.09, 0.32, "triangle", 0.14)); tone(1568, t + 0.38, 0.5, "sine", 0.06); } catch { /* ignoră */ }
    if (vibeOn()) try { navigator.vibrate?.([60, 40, 60, 40, 180]); } catch { /* ignoră */ }
  },
};
const tb = { id: null, cards: "", won: false };
function tableSounds() {
  const v = DY()?.view;
  if (v?.name !== "table") { tb.id = null; return; }
  const cards = [...$app.querySelectorAll(".me [data-card]")].map((c) => c.dataset.card).join(",");
  const won = !!$app.querySelector(".seat.mine.win");
  if (tb.id !== v.id) { Object.assign(tb, { id: v.id, cards, won }); return; } // intrarea la masă nu sună
  if (cards && cards !== tb.cards) sfx.deal();
  if (won && !tb.won) sfx.win();
  tb.cards = cards; tb.won = won;
}
function profileLabels() {
  const set = (id, title, sub) => {
    const span = $app.querySelector(`#${id}`)?.closest(".switch")?.querySelector("span");
    if (span && !span.dataset.x) { span.dataset.x = "1"; span.innerHTML = `${title}<small>${sub}</small>`; }
  };
  set("snd", "🔊 Sunete la masă", "Rândul tău, cărțile împărțite, potul câștigat");
  set("vib", "📳 Vibrații", "Când îți vine rândul și când câștigi un pot");
}

// ================= Azi în club (proprietar și admini) =================
function todayButton() {
  const v = DY()?.view;
  if (v?.name !== "club" || $app.querySelector("#today-btn")) return;
  const chat = $app.querySelector("#cchat");
  if (!chat || !$app.querySelector('.tabs [data-tab="members"]')) return; // tabul Membri apare doar la proprietar și admini
  chat.insertAdjacentHTML("afterend", `<button type="button" class="btn block today-btn" id="today-btn" data-testid="today-btn"><span class="ti">📊</span><span class="grow"><b>Azi în club</b><small>Cine a jucat, jackpotul, câștigătorii</small></span><span class="chev">›</span></button>`);
  $app.querySelector("#today-btn").onclick = () => openToday(v.id);
}
const dayName = () => new Date().toLocaleDateString("ro-RO", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Bucharest" });
const hhmm = (d) => new Date(d).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Bucharest" });
const av = (u) => DY()?.avatarHtml ? DY().avatarHtml(u) : `<span class="av">${esc(String(u.username || "?")[0].toUpperCase())}</span>`;
const net = (n) => `<b class="td-net ${n > 0 ? "up" : n < 0 ? "down" : ""}">${n > 0 ? "+" : n < 0 ? "−" : ""}${fmt(Math.abs(n))}</b>`;
const TSTAT = { registering: "Înscrieri deschise", running: "În desfășurare", finished: "Terminat", cancelled: "Anulat" };

function todayHtml(d) {
  const nothing = !d.hands && !d.tourneys.length && !d.newMembers.length && !d.chipsGiven;
  const kpi = [[fmt(d.hands), "mâini jucate"], [fmt(d.players.length), "jucători"], [fmt(d.tables), d.tables === 1 ? "masă activă" : "mese active"], [`+${fmt(d.jackpotAdded)}`, "în jackpot azi"]];
  let h = `<div class="td-kpi">${kpi.map(([b, s]) => `<div><b>${b}</b><small>${s}</small></div>`).join("")}</div>
    <div class="td-jp"><span>🎰 Jackpotul clubului acum</span><b>${fmt(d.jackpot)}</b></div>`;
  if (nothing) return h + `<div class="td-empty"><b>🃏</b>Încă nu s-a jucat azi în club.<br>Rezumatul se completează pe parcursul zilei.</div>`;
  if (d.biggestPot) {
    const b = d.biggestPot;
    h += `<div class="td-sec">Cel mai mare pot</div><div class="td-pot"><div class="amt">${fmt(b.amount)}</div>
      <div class="who"><b>${esc(b.winners)}</b><small>${b.hand ? esc(b.hand) + " · " : ""}${esc(b.table)} · ${hhmm(b.at)}</small></div></div>`;
  }
  if (d.players.length) {
    h += `<div class="td-sec">Jucătorii zilei</div><div class="td-list">${d.players.map((p, i) => `<div class="td-row">
      <span class="pos">${i === 0 && p.net > 0 ? "👑" : i + 1}</span>${av(p)}
      <span class="grow"><b>${esc(p.username)}</b><small>${fmt(p.hands)} ${p.hands === 1 ? "mână" : "mâini"} · ${fmt(p.wins)} ${p.wins === 1 ? "câștigată" : "câștigate"}</small></span>${net(p.net)}</div>`).join("")}</div>`;
  }
  if (d.tourneys.length) {
    h += `<div class="td-sec">Turnee</div><div class="td-list">${d.tourneys.map((t) => `<a class="td-row" href="#/tourney/${t.id}" data-close>
      <span class="ti">🏆</span><span class="grow"><b>${esc(t.name)}</b><small>${t.winner ? `Câștigător: ${esc(t.winner.username)}${t.winner.prize ? ` · ${fmt(t.winner.prize)}` : ""}` : `${TSTAT[t.status] || ""}${t.startsAt && t.status === "registering" ? ` · la ${hhmm(t.startsAt)}` : ""} · ${t.players} înscriși`}</small></span><span class="chev">›</span></a>`).join("")}</div>`;
  }
  if (d.newMembers.length) h += `<div class="td-sec">Membri noi azi</div><div class="td-tags">${d.newMembers.map((n) => `<span>👋 ${esc(n)}</span>`).join("")}</div>`;
  if (d.chipsGiven) h += `<div class="td-note">🎁 Jetoane date azi de administrator: <b>${fmt(d.chipsGiven)}</b></div>`;
  return h;
}
async function openToday(clubId) {
  const el = document.createElement("div");
  el.className = "tsheet td-sheet"; el.dataset.testid = "today-sheet";
  el.innerHTML = `<div class="tsheet-bg" data-close></div><div class="tsheet-box" role="dialog" aria-label="Azi în club">
    <div class="td-head"><div class="grow"><h3>📊 Azi în club</h3><small>${esc(dayName())}</small></div><button type="button" class="td-x" data-close aria-label="Închide">×</button></div>
    <div class="td-body"><div class="skel">${skRow()}${skRow()}${skRow()}</div></div></div>`;
  document.body.appendChild(el);
  const close = () => { el.classList.add("out"); setTimeout(() => el.remove(), 180); window.removeEventListener("hashchange", close); };
  el.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) close(); });
  window.addEventListener("hashchange", close);
  try { el.querySelector(".td-body").innerHTML = todayHtml(await DY().api("GET", `/api/clubs/${clubId}/today`)); }
  catch (e) { el.querySelector(".td-body").innerHTML = `<div class="td-empty">${esc(e.message || "Nu s-a putut încarca.")}</div>`; }
}

// ================= masa: proprietarul și adminii clubului scot jucători și închid masa =================
/** Butoanele rotunde adăugate la masă (🛡️, ℹ️) stau în stânga, lângă chat, ca să nu acopere locurile. */
const fabHost = () => {
  const fr = $app.querySelector(".fab-r");
  if (!fr) return null;
  let h = fr.parentElement.querySelector(":scope > .fab-x");
  if (!h) { fr.insertAdjacentHTML("beforebegin", `<div class="fab-x"></div>`); h = fr.parentElement.querySelector(":scope > .fab-x"); }
  return h;
};
const isMgr = (r) => ["owner", "admin", "superadmin"].includes(r);
const tableState = (id) => DY().api("GET", `/api/tables/${id}`);
async function kickPlayer(tableId, p) {
  if (!confirm(`Îl scoți pe ${p.name} de la masă? Dacă e într-o mână, cărțile i se aruncă la rândul lui, iar fisele îi revin în sold.`)) return false;
  try {
    const r = await DY().api("POST", `/api/tables/${tableId}/kick`, { userId: p.userId });
    DY().toast(r.left ? `${p.name} a fost scos de la masă.` : `${p.name} pleacă de la masă la finalul mâinii.`, true);
    return true;
  } catch (e) { DY().toast(e.message); return false; }
}
async function closeTable(tableId, players) {
  const msg = players ? `Închizi masa? Cei ${players} jucători așezați sunt ridicați și primesc fisele înapoi în sold.` : "Închizi masa?";
  if (!confirm(msg)) return false;
  try {
    const r = await DY().api("DELETE", `/api/tables/${tableId}`);
    DY().toast(r.players ? `Masa a fost închisă. ${fmt(r.returned)} jetoane returnate la ${r.players} ${r.players === 1 ? "jucător" : "jucători"}.` : "Masa a fost închisă.", true);
    return true;
  } catch (e) { DY().toast(e.message); return false; }
}
const playerRows = (st) => st.seats.map((p) => `<div class="km-row"><span class="grow"><b>${esc(p.name)}${p.userId === DY().me?.id ? " (tu)" : ""}</b><small>${fmt(p.stack)} fise${p.leaving ? " · pleacă după mână" : ""}</small></span>
  ${p.leaving || p.userId === DY().me?.id ? "" : `<button type="button" class="btn sm danger" data-kick="${p.userId}" data-testid="kick-btn">Scoate</button>`}</div>`).join("");

// ecranul mesei: butonul 🛡️ pentru cei care conduc clubul (verificat o dată pe masă)
const tAdm = new Map();
function tableAdmin() {
  const v = DY()?.view;
  if (v?.name !== "table" || !$app.querySelector(".fab-r") || $app.querySelector("[data-tadm]")) return;
  if (!tAdm.has(v.id)) tAdm.set(v.id, tableState(v.id).then((st) => !st.tourney && isMgr(st.viewerRole)).catch(() => false));
  tAdm.get(v.id).then((ok) => {
    if (!ok || $app.querySelector("[data-tadm]") || DY().view?.id !== v.id) return;
    const host = fabHost();
    if (!host) return;
    host.insertAdjacentHTML("beforeend", `<button class="fab" data-tadm aria-label="Administrează masa" data-testid="table-admin">🛡️</button>`);
    host.querySelector("[data-tadm]").onclick = () => openTableAdmin(v.id);
  });
}
async function openTableAdmin(tableId) {
  const el = document.createElement("div");
  el.className = "tsheet td-sheet km-sheet"; el.dataset.testid = "table-admin-sheet";
  el.innerHTML = `<div class="tsheet-bg" data-close></div><div class="tsheet-box" role="dialog" aria-label="Administrează masa">
    <div class="td-head"><div class="grow"><h3>🛡️ Administrează masa</h3><small>Doar pentru proprietarul și adminii clubului</small></div><button type="button" class="td-x" data-close aria-label="Închide">×</button></div>
    <div class="td-body"><div class="skel">${skRow()}${skRow()}</div></div></div>`;
  document.body.appendChild(el);
  const close = () => { el.classList.add("out"); setTimeout(() => el.remove(), 180); window.removeEventListener("hashchange", close); };
  el.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) close(); });
  window.addEventListener("hashchange", close);
  const paint = async () => {
    let st; try { st = await tableState(tableId); } catch (e) { el.querySelector(".td-body").innerHTML = `<div class="td-empty">${esc(e.message)}</div>`; return; }
    el.querySelector(".td-body").innerHTML = `<div class="td-sec" style="margin-top:0">Jucători la masă · ${st.seats.length}</div>
      ${st.seats.length ? `<div class="td-list">${playerRows(st)}</div>` : `<div class="td-empty">Nu stă nimeni la masă.</div>`}
      <p class="km-note">Cine e scos primește fisele înapoi în sold. Dacă e într-o mână, cărțile i se aruncă la rândul lui și pleacă la finalul mâinii.</p>
      <button type="button" class="btn danger block" data-closetable data-testid="close-table">Închide masa${st.seats.length ? " și ridică pe toți" : ""}</button>`;
    el.querySelectorAll("[data-kick]").forEach((b) => (b.onclick = async () => { b.disabled = true; if (await kickPlayer(tableId, st.seats.find((p) => p.userId === b.dataset.kick))) paint(); else b.disabled = false; }));
    el.querySelector("[data-closetable]").onclick = async () => { if (await closeTable(tableId, st.seats.length)) { close(); DY().go(`#/club/${st.table.clubId}`); } };
  };
  paint();
}

// setările mesei din club (⚙): „Închide masa” merge și cu jucători așezați + lista celor așezați
function tableFormAdmin() {
  const del = $app.querySelector("#tf #del:not([data-x2])");
  if (!del) return;
  const tableId = del.closest("[data-ef]")?.dataset.ef;
  if (!tableId) return;
  const btn = del.cloneNode(true); // înlocuiește vechiul buton (cerea ca masa să fie goală)
  btn.dataset.x2 = "1"; btn.dataset.testid = "close-table";
  del.replaceWith(btn);
  const form = btn.closest("#tf");
  const box = document.createElement("div");
  box.className = "km-box"; box.innerHTML = `<label>Jucători la masă</label><div class="skel">${skRow()}</div>`;
  form.querySelector("#te")?.before(box);
  let st = null;
  const paint = async () => {
    try { st = await tableState(tableId); } catch { box.remove(); return; }
    box.innerHTML = `<label>Jucători la masă</label>${st.seats.length ? `<div class="td-list">${playerRows(st)}</div>` : `<div class="small muted">Nu stă nimeni la masă.</div>`}`;
    box.querySelectorAll("[data-kick]").forEach((b) => (b.onclick = async () => { b.disabled = true; if (await kickPlayer(tableId, st.seats.find((p) => p.userId === b.dataset.kick))) paint(); else b.disabled = false; }));
  };
  paint();
  btn.addEventListener("click", async () => { if (await closeTable(tableId, st?.seats.length || 0)) window.dispatchEvent(new HashChangeEvent("hashchange")); });
}

// ================= descrieri (club, mese, turnee) și panoul de administrare =================
const descCache = new Map(); // url → { at, p }
const cached = (url) => {
  const c = descCache.get(url);
  if (c && Date.now() - c.at < 20000) return c.p;
  const p = DY().api("GET", url).catch(() => null);
  descCache.set(url, { at: Date.now(), p });
  return p;
};
const descHtml = (t, cls = "xdesc") => `<div class="${cls}">${esc(t)}</div>`;
function descriptions() {
  const v = DY()?.view;
  if (v?.name === "club") {
    if (!$app.querySelector('[data-testid="table-row"]:not([data-xd]), a.tcard2:not([data-xd])')) return;
    cached(`/api/clubs/${v.id}/descriptions`).then((d) => {
      if (!d || DY().view?.id !== v.id) return;
      $app.querySelectorAll('[data-testid="table-row"]:not([data-xd])').forEach((row) => {
        row.dataset.xd = "1";
        const t = d.tables[row.dataset.t];
        if (t) row.querySelector(".grow")?.insertAdjacentHTML("beforeend", descHtml(t));
      });
      $app.querySelectorAll("a.tcard2:not([data-xd])").forEach((a) => {
        a.dataset.xd = "1";
        const t = d.tourneys[(a.getAttribute("href") || "").split("/").pop()];
        if (t) a.insertAdjacentHTML("beforeend", descHtml(t));
      });
    });
  } else if (v?.name === "table") {
    if (!$app.querySelector(".fab-r") || $app.querySelector("[data-tinfo]")) return;
    cached(`/api/tables/${v.id}/description`).then((d) => {
      if (!d?.description || $app.querySelector("[data-tinfo]") || DY().view?.id !== v.id) return;
      const host = fabHost();
      if (!host) return;
      host.insertAdjacentHTML("afterbegin", `<button class="fab" data-tinfo aria-label="Despre masă" data-testid="table-info">ℹ️</button>`);
      host.querySelector("[data-tinfo]").onclick = () => sheet("ℹ️ Despre masă", descHtml(d.description, "xdesc big"));
    });
  } else if (v?.name === "tourney") {
    const scr = $app.querySelector(".screen.tlobby");
    if (!scr || scr.querySelector("[data-tdesc]")) return;
    cached(`/api/tourneys/${v.id}/description`).then((d) => {
      const s = $app.querySelector(".screen.tlobby");
      if (!d?.description || !s || s.querySelector("[data-tdesc]") || DY().view?.id !== v.id) return;
      const after = s.querySelector(".tlevel, .tstart") || s.querySelector(".topbar");
      after.insertAdjacentHTML("afterend", `<div class="card tdesc" data-tdesc data-testid="tourney-desc">${descHtml(d.description, "xdesc big")}</div>`);
    });
  } else if (v?.name === "admin" && v.tab === "clubs" && $app.querySelector('[data-testid="admin-club"]:not([data-mg]), [data-testid="wipe-all"]')) {
    import("/manage.js?v=1").then((m) => m.enhance($app)).catch(() => {});
  }
}
function sheet(title, html) {
  const el = document.createElement("div");
  el.className = "tsheet td-sheet";
  el.innerHTML = `<div class="tsheet-bg" data-close></div><div class="tsheet-box" role="dialog" aria-label="${esc(title)}">
    <div class="td-head"><div class="grow"><h3>${esc(title)}</h3></div><button type="button" class="td-x" data-close aria-label="Închide">×</button></div>
    <div class="td-body">${html}</div></div>`;
  document.body.appendChild(el);
  const close = () => { el.classList.add("out"); setTimeout(() => el.remove(), 180); window.removeEventListener("hashchange", close); };
  el.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) close(); });
  window.addEventListener("hashchange", close);
}

// ================= panou admin: contul proprietarului îl poate modifica doar el =================
function founderLock() {
  const v = DY()?.view;
  if (v?.name !== "adminUser" || v.id === DY().me?.id) return;
  const acct = $app.querySelector(".card.acct:not([data-fl])");
  if (!acct) return;
  cached(`/api/admin/users/${v.id}`).then((r) => {
    if (!r?.user?.is_founder || DY().view?.id !== v.id) return;
    const a = $app.querySelector(".card.acct:not([data-fl])");
    if (!a) return;
    a.dataset.fl = "1";
    a.innerHTML = `<span class="small muted">👑 Contul proprietarului aplicației. Doar el îl poate modifica.</span>`;
    $app.querySelectorAll(".uclub [data-adj]").forEach((x) => x.remove());
  });
}

// ================= legătura cu ecranele =================
let queued = false;
function tick() {
  queued = false;
  if (!DY()) return;
  skeletons($app);
  todayButton();
  tableSounds();
  tableAdmin();
  tableFormAdmin();
  descriptions();
  founderLock();
  if (DY().view?.name === "profile") profileLabels();
}
new MutationObserver(() => { if (!queued) { queued = true; requestAnimationFrame(tick); } }).observe($app, { childList: true, subtree: true });
tick();
