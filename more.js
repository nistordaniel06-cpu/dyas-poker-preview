// DYAS Poker — reluarea mâinilor, cine e online în club, realizări, mese private.
// Funcțiile folosesc window.DY (din app.js) doar când sunt apelate.
const D = () => window.DY;

if (!document.querySelector('link[href^="/more.css"]')) {
  const l = document.createElement("link");
  l.rel = "stylesheet"; l.href = "/more.css?v=1";
  document.head.appendChild(l);
}

// ---------- reluarea unei mâini, pas cu pas ----------
const STREET = { preflop: "Preflop", flop: "Flop", turn: "Turn", river: "River" };
const VERB = { fold: "fold", check: "check", call: "call", "small blind": "small blind", "big blind": "big blind" };

/** Toate stările mâinii, de la împărțirea cărților până la final. */
function frames(h) {
  const rp = h.replay;
  const seats = rp.seats.map((s) => ({ ...s, stack: s.start, bet: 0, folded: false, last: "" }));
  const by = (seat) => seats.find((s) => s.seat === seat);
  let board = [], street = "preflop", pot = 0;
  const snap = (text, who = null) => ({ text, who, street, board: board.slice(), pot, seats: seats.map((s) => ({ ...s })) });
  const out = [snap("Se împart cărțile.")];
  const { fmt } = D();
  for (const e of rp.log) {
    if (e.street) {
      for (const s of seats) { s.bet = 0; if (!s.folded) s.last = ""; }
      street = e.street; board = e.board.slice();
      out.push(snap(`${STREET[street] || street}: ${board.length} cărți pe masă.`));
      continue;
    }
    const s = by(e.seat);
    if (!s) continue;
    let text = "";
    if (e.action === "fold") { s.folded = true; s.last = "fold"; text = `${s.name} renunță (fold).`; }
    else if (e.action === "check") { s.last = "check"; text = `${s.name}: check.`; }
    else if (e.action === "raise") {
      const add = Math.min(e.to - s.bet, s.stack);
      s.stack -= add; s.bet += add; pot += add;
      s.last = s.stack === 0 ? "all-in" : "raise";
      text = `${s.name}: ${s.stack === 0 ? "all-in" : "raise"} la ${fmt(e.to)}.`;
    } else {
      const a = Number(e.amount || 0);
      s.stack -= a; s.bet += a; pot += a;
      s.last = s.stack === 0 && a > 0 ? "all-in" : VERB[e.action] || e.action;
      text = `${s.name}: ${VERB[e.action] || e.action}${a ? ` ${fmt(a)}` : ""}${s.stack === 0 && a > 0 ? " (all-in)" : ""}.`;
    }
    out.push(snap(text, e.seat));
  }
  // la final: cărțile comune complete și câștigătorii
  board = h.board?.length ? h.board.slice() : board;
  for (const s of seats) { s.stack = s.end; s.bet = 0; }
  const win = h.winners.map((w) => `${w.name} câștigă ${fmt(w.amount)}${w.hand ? ` cu ${w.hand}` : ""}`).join(", ");
  out.push({ ...snap(`🏆 ${win}.`), final: true, winners: new Set(h.winners.map((w) => w.seat)) });
  return out;
}

export function replay(h) {
  const { esc, fmt, cardHtml, toast } = D();
  if (!h?.replay?.log?.length) return toast("Mâna asta nu are pașii salvați (a fost jucată înainte de reluări).");
  const F = frames(h);
  let i = 0, timer = null;
  const el = document.createElement("div");
  el.className = "rp"; el.dataset.testid = "replay";
  el.innerHTML = `<div class="rp-bg" data-x></div><section class="rp-box" role="dialog" aria-label="Reluarea mâinii">
    <header><b>▶ Mâna #${h.handNo}</b><span class="muted small">${esc(h.table)}</span><button type="button" class="rp-x" data-x aria-label="Închide">×</button></header>
    <div class="rp-view"></div>
    <div class="rp-ctl"><button type="button" data-go="first" aria-label="De la început">⏮</button><button type="button" data-go="prev" aria-label="Pasul anterior">◀</button>
      <button type="button" class="play" data-go="play" aria-label="Redă">▶</button><button type="button" data-go="next" aria-label="Pasul următor" data-testid="replay-next">▶▶</button><button type="button" data-go="last" aria-label="La final">⏭</button></div>
  </section>`;
  document.body.appendChild(el);
  const view = el.querySelector(".rp-view");
  const paint = () => {
    const f = F[i];
    view.innerHTML = `<div class="rp-step" data-testid="replay-step">${esc(f.text)}</div>
      <div class="rp-board">${Array.from({ length: 5 }, (_, k) => cardHtml(f.board[k] || undefined, "sm")).join("")}<div class="rp-pot">Pot ${fmt(f.pot)}</div></div>
      <div class="rp-seats">${f.seats.map((s) => `<div class="rp-seat ${s.folded ? "folded" : ""} ${f.who === s.seat ? "act" : ""} ${f.winners?.has(s.seat) ? "win" : ""} ${s.me ? "me" : ""}">
        <div class="rp-cards">${s.cards?.length ? s.cards.map((c) => cardHtml(c, "xs")).join("") : cardHtml(null, "xs") + cardHtml(null, "xs")}</div>
        <div class="grow"><b>${esc(s.name)}</b>${s.seat === h.replay.dealer ? ` <span class="rp-d">D</span>` : ""}<div class="small muted">${fmt(s.stack)}${s.bet ? ` · pariu ${fmt(s.bet)}` : ""}</div></div>
        ${s.last ? `<span class="rp-tag">${esc(s.last)}</span>` : ""}</div>`).join("")}</div>
      <div class="rp-prog"><i style="width:${(i / (F.length - 1)) * 100}%"></i></div><div class="small muted rp-count">Pasul ${i + 1} din ${F.length}</div>`;
    el.querySelector(".play").textContent = timer ? "⏸" : "▶";
  };
  const stop = () => { clearInterval(timer); timer = null; };
  const go = (k) => {
    if (k === "play") { if (timer) stop(); else { if (i >= F.length - 1) i = 0; timer = setInterval(() => { if (i >= F.length - 1) { stop(); paint(); return; } i++; paint(); }, 1100); } }
    else { stop(); i = k === "first" ? 0 : k === "last" ? F.length - 1 : Math.max(0, Math.min(F.length - 1, i + (k === "next" ? 1 : -1))); }
    paint();
  };
  el.querySelectorAll("[data-go]").forEach((b) => (b.onclick = () => go(b.dataset.go)));
  el.querySelectorAll("[data-x]").forEach((b) => (b.onclick = () => { stop(); el.remove(); }));
  paint();
}

// ---------- cine e online în club + „Hai la masă” ----------
export function onlineHtml(list, meId) {
  const { esc, avatarHtml } = D();
  if (!list?.length) return "";
  const others = list.filter((x) => x.userId !== meId);
  // cei de la mese și ceilalți: primii 3 la vedere, restul la „Arată toți”
  const sorted = [...others, ...list.filter((x) => x.userId === meId)];
  const open = onlineOpen || sorted.length <= 4;
  const shown = open ? sorted : sorted.slice(0, 3);
  return `<div class="online" data-testid="online">
    <div class="online-h"><span class="dot"></span> Online acum · ${list.length}</div>
    <div class="online-list">${shown.map((x) => `<div class="on-p ${x.userId === meId ? "me" : ""}">${avatarHtml(x)}<div class="grow"><b>${esc(x.username)}${x.userId === meId ? " (tu)" : ""}</b>
      <small>${x.table ? `la ${esc(x.table.name)}` : "în aplicație"}</small></div>
      ${x.userId === meId ? "" : `<button type="button" class="btn sm" data-invite="${x.userId}" data-name="${esc(x.username)}" data-testid="invite-btn">Hai la masă</button>`}</div>`).join("")}</div>
    ${open ? "" : `<button type="button" class="linkbtn" data-more-online>Arată toți (${sorted.length})</button>`}
    ${others.length ? "" : `<div class="small muted">Doar tu ești online acum.</div>`}</div>`;
}
let onlineOpen = false;
export function bindOnline(root, clubId, list, meId) {
  const { api, toast } = D();
  const mine = list?.find((x) => x.userId === meId);
  root.querySelector("[data-more-online]")?.addEventListener("click", () => { onlineOpen = true; root.innerHTML = onlineHtml(list, meId); bindOnline(root, clubId, list, meId); });
  root.querySelectorAll("[data-invite]").forEach((b) => (b.onclick = async () => {
    b.disabled = true;
    try {
      const r = await api("POST", `/api/clubs/${clubId}/invite`, { userId: b.dataset.invite, tableId: mine?.table?.id });
      const n = b.dataset.name;
      toast(r.sent ? `Notificare trimisă lui ${n}.` : r.reason === "TOO_SOON" ? `L-ai chemat deja pe ${n}. Mai așteaptă puțin.` : `${n} nu are notificările pornite.`, !!r.sent);
    } catch (e) { toast(e.message); }
    setTimeout(() => (b.disabled = false), 2000);
  }));
}

// ---------- realizări ----------
export async function achievementsInto(el) {
  const { api, esc, fmt } = D();
  let r;
  try { r = await api("GET", "/api/achievements"); } catch { el.innerHTML = ""; return; }
  const got = new Map(r.mine.map((a) => [a.code, a]));
  el.innerHTML = `<div class="stats ach-stats"><div><b>${fmt(r.stats.handsPlayed)}</b><small>mâini jucate</small></div><div><b>${fmt(r.stats.handsWon)}</b><small>câștigate</small></div>
      <div><b>${fmt(r.stats.bestPot)}</b><small>cel mai mare pot</small></div><div><b>${got.size}/${r.catalog.length}</b><small>realizări</small></div></div>
    <div class="ach" data-testid="achievements">${r.catalog.map((a) => { const g = got.get(a.code); return `<div class="ach-i ${g ? "on" : ""}" title="${esc(a.desc)}">
      <span class="ic">${g ? a.icon : "🔒"}</span><b>${esc(a.title)}</b><small>${g ? new Date(g.at).toLocaleDateString("ro-RO") : esc(a.desc)}</small></div>`; }).join("")}</div>`;
}

// ---------- masă privată: parola ----------
export function lockedScreen(app, tableId, clubId, onOk) {
  const { api } = D();
  app.innerHTML = `<div class="screen"><div class="topbar"><a class="back" href="${clubId ? `#/club/${clubId}` : "#/"}" aria-label="Înapoi">←</a><h1 style="margin:0"><svg class="arena-control-icon" aria-hidden="true"><use href="/control-icons.svg#lock"></use></svg> Masă privată</h1></div>
    <form class="card" id="lk"><p class="small muted" style="margin-top:0">Masa are parolă. Cere-o de la cine a creat-o.</p>
      <label for="lkp">Parola mesei</label><input id="lkp" name="p" type="password" autocomplete="off" required data-testid="table-password">
      <div class="err" id="lke"></div><button class="btn primary block" style="margin-top:10px">Intră la masă</button></form></div>`;
  const f = app.querySelector("#lk");
  f.p.focus();
  f.onsubmit = async (e) => {
    e.preventDefault();
    try { await api("POST", `/api/tables/${tableId}/unlock`, { password: f.p.value }); onOk(); }
    catch (err) { app.querySelector("#lke").textContent = err.message; }
  };
}
