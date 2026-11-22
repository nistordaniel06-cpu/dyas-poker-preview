// DYAS Poker — turnee: lista din club, lobby-ul turneului, formularul administratorului.
const D = window.DY;
const { api, esc, fmt, plural, toast, go, avatarHtml } = D;
if (!document.querySelector('link[href^="/tourney.css"]')) {
  const l = document.createElement("link");
  l.rel = "stylesheet"; l.href = "/tourney.css?v=1"; document.head.appendChild(l);
}

const STATUS = { registering: ["Înscrieri deschise", "open"], running: ["În desfășurare", "live"], finished: ["Terminat", "done"], cancelled: ["Anulat", "done"] };
const badge = (t) => `<span class="tbadge ${STATUS[t.status][1]}">${STATUS[t.status][0]}</span>`;
const when = (d) => new Date(d).toLocaleString("ro-RO", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
export const mmss = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
const fee = (n) => (n > 0 ? `${fmt(n)} jetoane` : "gratuit");
function format(t) {
  const f = [];
  if (t.rebuy) f.push("Rebuy"); if (t.reentry) f.push("Re-entry"); if (t.addon) f.push("Add-on");
  return f.length ? f.join(" · ") : "Freezeout";
}
function startLine(t) {
  if (t.status === "running") return `Nivel ${t.level.n} · ${fmt(t.level.sb)}/${fmt(t.level.bb)}`;
  if (t.status !== "registering") return t.endedAt ? when(t.endedAt) : "";
  return t.startMode === "scheduled" ? `Pornește ${when(t.startsAt)}` : t.startMode === "sng" ? `Pornește când se înscriu ${t.maxPlayers}` : "Pornește la semnalul adminului";
}
const prizeLine = (t) => (t.prizePool > 0 ? `🏆 ${fmt(t.prizePool)} din jackpot` : "fără premiu");

/** Cardul unui turneu (în club și pe Acasă). */
export function cardHtml(t, showClub = false) {
  const mine = t.mine === "registered" ? `<span class="tbadge mine">✓ Înscris</span>` : t.mine === "playing" ? `<span class="tbadge mine">♠ Joci</span>` : "";
  return `<a class="card tcard2" href="#/tourney/${t.id}" data-testid="tourney-card">
    <div class="row"><div class="grow"><b>🏆 ${esc(t.name)}</b>${showClub ? ` <span class="small muted">· ${esc(t.club.emblem)} ${esc(t.club.name)}</span>` : ""}</div>${badge(t)}</div>
    <div class="small muted">${esc(startLine(t))} · ${esc(format(t))}</div>
    <div class="row tmeta"><span>👥 ${t.status === "running" ? `${t.alive}/${t.players}` : `${t.players}/${t.maxPlayers}`}</span><span>🎟️ ${fee(t.buyIn)}</span><span>${prizeLine(t)}</span>${mine}</div></a>`;
}

// ---------- tabul „Turnee” din club ----------
export async function clubTab(el, clubId) {
  el.innerHTML = `<div class="empty">Se încarcă…</div>`;
  let r, jp = 0;
  try { r = await api("GET", `/api/clubs/${clubId}/tourneys`); } catch (e) { el.innerHTML = ""; return toast(e.message); }
  if (r.canCreate) jp = (await api("GET", `/api/clubs/${clubId}/jackpot`).catch(() => ({ jackpot: 0 }))).jackpot;
  el.innerHTML = `${r.canCreate ? `<button class="btn primary block" id="ntr" data-testid="new-tourney" style="margin-bottom:12px">🏆 Turneu nou</button><div id="ntrf"></div>` : ""}
    ${r.tourneys.length ? r.tourneys.map((t) => cardHtml(t)).join("") : `<div class="empty"><b>🏆</b>Niciun turneu încă.${r.canCreate ? "" : " Administratorul anunță turneele aici."}</div>`}`;
  el.querySelector("#ntr")?.addEventListener("click", () => {
    const h = el.querySelector("#ntrf");
    if (h.innerHTML) { h.innerHTML = ""; return; }
    createForm(h, clubId, jp);
  });
}

/** Pe ecranul Acasă: turneele deschise sau în desfășurare. */
export async function homeInto(el) {
  const r = await api("GET", "/api/tourneys").catch(() => null);
  if (!r || !el.isConnected) return;
  el.innerHTML = r.tourneys.length ? `<h2>🏆 Turnee</h2>${r.tourneys.slice(0, 3).map((t) => cardHtml(t, true)).join("")}` : "";
}

// ---------- formularul administratorului ----------
function autoLevels(bb) {
  const mult = [1, 1.5, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 80, 100, 120];
  const round = (x) => { const p = 10 ** Math.max(0, Math.floor(Math.log10(x)) - 1); return Math.max(1, Math.round(x / p) * p); };
  return mult.map((m) => { const b = round(bb * m); return `${Math.max(1, Math.floor(b / 2))}/${b}`; }).join(", ");
}
const PAY = [["100", "Câștigătorul ia tot"], ["60,40", "60 / 40"], ["50,30,20", "50 / 30 / 20"], ["40,25,15,12,8", "Top 5"]];

export function createForm(host, clubId, jackpot) {
  const soon = new Date(Date.now() + 3600e3); soon.setMinutes(0, 0, 0);
  const local = new Date(soon.getTime() - soon.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  host.innerHTML = `<form class="card tform" data-testid="tourney-form">
    <label>Numele turneului</label><input name="name" required minlength="2" maxlength="50" value="Turneul de vineri">
    <h3>Format</h3>
    <div class="checks">
      <label><input type="checkbox" name="rebuy"> Rebuy</label><label><input type="checkbox" name="reentry"> Re-entry</label><label><input type="checkbox" name="addon"> Add-on</label>
    </div>
    <p class="small muted" data-fmt>Freezeout: un singur buy-in; când rămâi fără fise, ești eliminat.</p>
    <div class="grid2">
      <div><label>Intrare (din sold)</label><input name="buyIn" type="number" inputmode="numeric" min="0" value="0"><small>0 = gratuit</small></div>
      <div><label>Fise de start</label><input name="startStack" type="number" inputmode="numeric" min="1" value="5000"></div>
    </div>
    <div class="sub" data-sub="rebuy" hidden><h4>Rebuy</h4><div class="grid2">
      <div><label>Taxă rebuy</label><input name="rbFee" type="number" inputmode="numeric" min="0" value="0"></div>
      <div><label>Fise primite</label><input name="rbChips" type="number" inputmode="numeric" min="1" value="5000"></div>
      <div><label>De câte ori / jucător</label><input name="rbMax" type="number" inputmode="numeric" min="1" max="50" value="2"></div>
      <div><label>Până la nivelul</label><input name="rbLevels" type="number" inputmode="numeric" min="1" max="60" value="4"></div></div>
      <small class="muted">Se poate cumpăra când rămâi fără fise sau ai cel mult fisele de start.</small></div>
    <div class="sub" data-sub="reentry" hidden><h4>Re-entry</h4><div class="grid2">
      <div><label>De câte ori / jucător</label><input name="reMax" type="number" inputmode="numeric" min="1" max="50" value="1"></div></div>
      <small class="muted">După eliminare, plătești din nou intrarea și primești fisele de start, cât timp e deschisă înscrierea târzie.</small></div>
    <div class="sub" data-sub="addon" hidden><h4>Add-on</h4><div class="grid2">
      <div><label>Taxă add-on</label><input name="adFee" type="number" inputmode="numeric" min="0" value="0"></div>
      <div><label>Fise primite</label><input name="adChips" type="number" inputmode="numeric" min="1" value="5000"></div>
      <div><label>La nivelul</label><input name="adLevel" type="number" inputmode="numeric" min="1" max="60" value="4"></div></div>
      <small class="muted">O singură dată pe jucător, doar în timpul nivelului ales.</small></div>
    <h3>Blinduri</h3>
    <div class="grid2">
      <div><label>Big blind la început</label><input name="bb" type="number" inputmode="numeric" min="2" value="50"></div>
      <div><label>Minute pe nivel</label><input name="levelMinutes" type="number" inputmode="numeric" min="1" max="120" value="10"></div>
    </div>
    <label>Nivelele (small/big, în ordine)</label><textarea name="levels" rows="3" data-testid="levels">${autoLevels(50)}</textarea>
    <button type="button" class="linkbtn" data-regen>↻ Refă structura din big blindul de început</button>
    <div class="grid2">
      <div><label>Timp de gândire (sec)</label><input name="turnSeconds" type="number" inputmode="numeric" min="10" max="120" value="30"></div>
      <div><label>Înscriere târzie (nivele)</label><input name="lateLevels" type="number" inputmode="numeric" min="0" max="60" value="0"><small>0 = fără</small></div>
    </div>
    <h3>Jucători și mese</h3>
    <label>Câți jucători pot intra în turneu</label>
    <div class="seg sizes">${[9, 18, 27, 50, 100, 200].map((n) => `<button type="button" data-mx="${n}" class="${n === 9 ? "on" : ""}">${n}</button>`).join("")}</div>
    <div class="grid2">
      <div><label>Maxim jucători</label><input name="maxPlayers" type="number" inputmode="numeric" min="2" max="200" value="9"><small>până la 200</small></div>
      <div><label>Minim la start</label><input name="minPlayers" type="number" inputmode="numeric" min="2" max="200" value="2"></div>
    </div>
    <label>Locuri la o masă</label>
    <div class="seg seats">${[2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button type="button" data-sp="${n}" class="${n === 9 ? "on" : ""}"><b>${n}</b><small>${{ 2: "heads-up", 6: "6-max", 9: "full ring" }[n] || "locuri"}</small></button>`).join("")}</div>
    <input type="hidden" name="seatsPerTable" value="9">
    <div class="tplan" data-tables></div>
    <h3>Pornire</h3>
    <div class="seg starts">
      <button type="button" data-sm="manual" class="on">Manual</button><button type="button" data-sm="scheduled">La oră</button><button type="button" data-sm="sng">Când e plin</button>
    </div>
    <div data-when hidden><label>Data și ora</label><input name="startsAt" type="datetime-local" value="${local}"></div>
    <p class="small muted" data-smnote>Pornești tu turneul din lobby, cu butonul „Pornește acum”.</p>
    <h3>Premii din jackpot</h3>
    <p class="small muted">Jackpotul clubului are acum <b>${fmt(jackpot)}</b> jetoane. Suma aleasă se rezervă acum și se împarte la final.</p>
    <div class="grid2"><div><label>Premiu total</label><input name="prizePool" type="number" inputmode="numeric" min="0" max="${jackpot}" value="${jackpot}"></div>
      <div><label>Împărțire (%)</label><input name="payouts" value="50,30,20"></div></div>
    <div class="seg pays">${PAY.map(([v, n]) => `<button type="button" data-pay="${v}">${n}</button>`).join("")}</div>
    <div class="err" id="tfe"></div>
    <button class="btn primary block" style="margin-top:12px" data-testid="create-tourney">🏆 Creează turneul</button>
  </form>`;
  const f = host.querySelector("form");
  let startMode = "manual";
  const sync = () => {
    for (const k of ["rebuy", "reentry", "addon"]) host.querySelector(`[data-sub=${k}]`).hidden = !f[k].checked;
    const fm = [f.rebuy.checked && "Rebuy", f.reentry.checked && "Re-entry", f.addon.checked && "Add-on"].filter(Boolean);
    host.querySelector("[data-fmt]").textContent = fm.length ? `Format: ${fm.join(" + ")}.` : "Freezeout: un singur buy-in; când rămâi fără fise, ești eliminat.";
    if (f.reentry.checked && Number(f.lateLevels.value) < 1) f.lateLevels.value = 4;
    const mx = Math.min(200, Number(f.maxPlayers.value) || 0), sp = Number(f.seatsPerTable.value) || 9, nt = Math.ceil(mx / sp);
    host.querySelectorAll("[data-mx]").forEach((b) => b.classList.toggle("on", Number(b.dataset.mx) === mx));
    host.querySelectorAll("[data-sp]").forEach((b) => b.classList.toggle("on", Number(b.dataset.sp) === sp));
    host.querySelectorAll("[data-pay]").forEach((b) => b.classList.toggle("on", b.dataset.pay === f.payouts.value.replace(/\s/g, "")));
    host.querySelector("[data-tables]").innerHTML = mx < 2 ? "" : nt <= 1
      ? `<div class="tp-steps"><span><b>1</b> masă</span></div><p>Toți joacă la aceeași masă, care e direct masa finală.</p>`
      : `<div class="tp-steps"><span><b>${nt}</b> mese la start</span><i>→</i><span>se unesc</span><i>→</i><span class="fin"><b>1</b> masă finală</span></div>
         <p>Cu ${mx} jucători și ${sp} locuri la masă, turneul pornește pe ${nt} mese. Când jucătorii ies, mesele se echilibrează și se unesc automat, până rămân ultimii ${sp} la masa finală.</p>`;
  };
  f.querySelectorAll("input").forEach((i) => i.addEventListener("input", sync));
  f.querySelectorAll("input[type=checkbox]").forEach((i) => i.addEventListener("change", sync));
  host.querySelector("[data-regen]").onclick = () => { f.levels.value = autoLevels(Math.max(2, Number(f.bb.value) || 50)); };
  f.bb.addEventListener("change", () => { f.levels.value = autoLevels(Math.max(2, Number(f.bb.value) || 50)); });
  host.querySelectorAll("[data-sm]").forEach((b) => (b.onclick = () => {
    startMode = b.dataset.sm;
    host.querySelectorAll("[data-sm]").forEach((x) => x.classList.toggle("on", x === b));
    host.querySelector("[data-when]").hidden = startMode !== "scheduled";
    host.querySelector("[data-smnote]").textContent = { manual: "Pornești tu turneul din lobby, cu butonul „Pornește acum”.",
      scheduled: "Pornește singur la ora aleasă (dacă sunt destui jucători; altfel se anulează și se dau banii înapoi).",
      sng: "Sit & Go: pornește singur când se înscrie numărul maxim de jucători." }[startMode];
  }));
  host.querySelectorAll("[data-pay]").forEach((b) => (b.onclick = () => { f.payouts.value = b.dataset.pay; sync(); }));
  host.querySelectorAll("[data-mx]").forEach((b) => (b.onclick = () => { f.maxPlayers.value = b.dataset.mx; sync(); }));
  host.querySelectorAll("[data-sp]").forEach((b) => (b.onclick = () => { f.seatsPerTable.value = b.dataset.sp; sync(); }));
  sync();
  f.onsubmit = async (e) => {
    e.preventDefault();
    const n = (k) => Number(f[k].value);
    const body = {
      name: f.name.value, startMode, startsAt: startMode === "scheduled" ? new Date(f.startsAt.value).toISOString() : null,
      buyIn: n("buyIn"), startStack: n("startStack"), bb: n("bb"), levelMinutes: n("levelMinutes"), levels: f.levels.value, turnSeconds: n("turnSeconds"),
      lateLevels: n("lateLevels"), minPlayers: n("minPlayers"), maxPlayers: n("maxPlayers"), seatsPerTable: n("seatsPerTable"),
      prizePool: n("prizePool"), payouts: f.payouts.value,
      rebuy: f.rebuy.checked ? { fee: n("rbFee"), chips: n("rbChips"), max: n("rbMax"), levels: n("rbLevels") } : null,
      reentry: f.reentry.checked ? { max: n("reMax") } : null,
      addon: f.addon.checked ? { fee: n("adFee"), chips: n("adChips"), level: n("adLevel") } : null,
    };
    try {
      const r = await api("POST", `/api/clubs/${clubId}/tourneys`, body);
      toast("Turneul a fost creat.", true);
      go(`#/tourney/${r.id}`);
    } catch (err) { host.querySelector("#tfe").textContent = err.message; }
  };
}

// ---------- lobby-ul turneului ----------
let L = null;
export async function renderLobby() {
  const id = D.view.id;
  if (!L || L.tourney.id !== id) D.app.innerHTML = `<div class="screen"><div class="empty">Se încarcă…</div></div>`;
  try { L = await api("GET", `/api/tourneys/${id}`); } catch (e) { toast(e.message); return go("#/"); }
  if (D.view.name !== "tourney" || D.view.id !== id) return;
  D.follow("tourney", id, async () => {
    try { const x = await api("GET", `/api/tourneys/${id}`); if (D.view.name === "tourney" && D.view.id === id) { L = x; paint(); } } catch { /* ignoră */ }
  });
  paint();
}

function paint() {
  const t = L.tourney, me = L.me, a = L.actions;
  const pct = t.payouts, sum = pct.reduce((x, y) => x + y, 0) || 1;
  const head = t.status === "running"
    ? `<div class="tlevel" data-testid="tourney-level"><div><small>Nivel</small><b>${t.level.n}</b></div><div><small>Blinduri</small><b>${fmt(t.level.sb)}/${fmt(t.level.bb)}</b></div>
        <div><small>${t.level.next ? `Urmează ${fmt(t.level.next[0])}/${fmt(t.level.next[1])}` : "Ultimul nivel"}</small><b ${t.level.nextAt ? `data-countdown="${t.level.nextAt}"` : ""}>${t.level.nextAt ? mmss(t.level.nextAt - Date.now()) : "—"}</b></div></div>`
    : t.status === "registering" ? `<div class="tstart">${esc(startLine(t))}${t.startMode === "scheduled" ? `<br><small>mai sunt <b data-countdown="${new Date(t.startsAt).getTime()}">${mmss(new Date(t.startsAt).getTime() - Date.now())}</b></small>` : ""}</div>` : "";
  const alive = L.entries.filter((e) => e.status === "playing");
  const avg = alive.length ? Math.round(alive.reduce((x, e) => x + (e.stack || 0), 0) / alive.length) : 0;
  const myBtns = [
    a.register != null ? `<button class="btn primary block" data-ta="register" data-testid="t-register">Înscrie-te · ${fee(a.register)}</button>` : "",
    me?.tableId && me.status === "playing" ? `<a class="btn green block" href="#/table/${me.tableId}" data-testid="t-mytable">♠ Mergi la masa ta</a>` : "",
    a.rebuy != null ? `<button class="btn block" data-ta="rebuy" data-testid="t-rebuy">🔁 Rebuy · +${fmt(t.rebuy.chips)} fise · ${fee(a.rebuy)}</button>` : "",
    a.reentry != null ? `<button class="btn block" data-ta="reentry" data-testid="t-reentry">↩️ Re-entry · ${fmt(t.startStack)} fise · ${fee(a.reentry)}</button>` : "",
    a.addon != null ? `<button class="btn block" data-ta="addon" data-testid="t-addon">➕ Add-on · +${fmt(t.addon.chips)} fise · ${fee(a.addon)}</button>` : "",
    a.unregister ? `<button class="btn block" data-ta="unregister">Retrage-te${t.buyIn ? " (primești taxa înapoi)" : ""}</button>` : "",
  ].join("");
  const mine = me ? (me.status === "registered" ? "✓ Ești înscris." : me.status === "playing" ? `♠ Joci · ${fmt(me.stack ?? 0)} fise` : me.place ? `Ai terminat pe locul ${me.place}${me.prize ? ` · premiu ${fmt(me.prize)}` : ""}.` : "Ai fost eliminat.") : "";
  const admin = L.isAdmin && (t.status === "registering" || t.status === "running") ? `<div class="card tadmin"><div class="small muted">🛡️ Administrator</div><div class="row" style="margin-top:8px">
      ${t.status === "registering" ? `<button class="btn green grow" data-ta="start" data-testid="t-start">▶ Pornește acum</button>` : ""}
      <button class="btn danger grow" data-ta="cancel" data-testid="t-cancel">Anulează turneul</button></div></div>` : "";
  const rules = [
    ["Format", format(t)], ["Intrare", fee(t.buyIn)], ["Fise de start", fmt(t.startStack)],
    t.rebuy && ["Rebuy", `${fee(t.rebuy.fee)} → +${fmt(t.rebuy.chips)} fise · de ${plural(t.rebuy.max, "dată", "ori")} · până la nivelul ${t.rebuy.levels}`],
    t.reentry && ["Re-entry", `de ${plural(t.reentry.max, "dată", "ori")} · cât e deschisă înscrierea`],
    t.addon && ["Add-on", `${fee(t.addon.fee)} → +${fmt(t.addon.chips)} fise · la nivelul ${t.addon.level}`],
    ["Înscriere târzie", t.lateLevels ? `până la nivelul ${t.lateLevels}` : "nu"],
    ["Nivele", `${t.levelMinutes} min fiecare`], ["Timp de gândire", `${t.turnSeconds} s`],
    ["Jucători", `${t.minPlayers}–${t.maxPlayers} · ${t.seatsPerTable} la masă${t.maxPlayers > t.seatsPerTable ? " · mai multe mese" : ""}`],
  ].filter(Boolean);
  const res = t.results;
  D.app.innerHTML = `<div class="screen tlobby">
    <div class="topbar"><a class="back" href="#/club/${t.clubId}/tourneys" aria-label="Înapoi">←</a><h1 style="margin:0" class="grow">🏆 ${esc(t.name)}</h1>${badge(t)}</div>
    ${head}
    <div class="stats tstats"><div><b>${t.status === "running" ? `${alive.length}/${L.entries.length}` : `${L.entries.length}/${t.maxPlayers}`}</b><small>jucători</small></div>
      <div><b>${fmt(t.prizePool)}</b><small>premii din jackpot</small></div>
      <div><b>${t.status === "running" ? fmt(avg) : fmt(t.startStack)}</b><small>${t.status === "running" ? "stack mediu" : "fise de start"}</small></div></div>
    ${mine ? `<div class="card tme" data-testid="t-me">${esc(mine)}</div>` : ""}
    ${myBtns ? `<div class="tbtns">${myBtns}</div>` : ""}
    ${res ? `<h2>🏆 Clasament final</h2><div class="podium" data-testid="t-results">${res.slice(0, 10).map((r) => `<div class="list-item"><div class="rank r${r.place}">${r.place <= 3 ? ["🥇", "🥈", "🥉"][r.place - 1] : r.place}</div>
      <div class="grow"><b>${esc(r.username)}</b></div>${r.prize ? `<div class="chips">${fmt(r.prize)}</div>` : ""}</div>`).join("")}</div>` : ""}
    ${!res && t.prizePool ? `<h2>Premii</h2><div class="card pays">${pct.map((p, i) => `<div class="row"><span class="grow">Locul ${i + 1}</span><b>${fmt(Math.floor((t.prizePool * p) / sum))}</b><small class="muted">&nbsp;${Math.round((p / sum) * 100)}%</small></div>`).join("")}</div>` : ""}
    ${admin}
    ${L.tables.length ? `<h2>Mese</h2>${L.tables.map((x) => `<a class="list-item" href="#/table/${x.id}"><div class="table-ic on">♠</div><div class="grow"><b>${esc(x.name)}</b><div class="small muted">${plural(x.players, "jucător", "jucători")}</div></div><span class="btn sm">Privește</span></a>`).join("")}` : ""}
    <h2>Jucători</h2>
    <div data-testid="t-entries">${L.entries.length ? L.entries.map((e, i) => `<div class="list-item ${e.status === "out" ? "out" : ""}">
      ${avatarHtml(e, e.frame ? "fr-" + e.frame : "")}<div class="grow"><b>${esc(e.username)}</b>${e.userId === D.me.id ? " (tu)" : ""}
        <div class="small muted">${e.status === "playing" ? "în joc" : e.status === "registered" ? "înscris" : e.place ? `locul ${e.place}` : "eliminat"}${e.rebuys ? ` · ${plural(e.rebuys, "rebuy", "rebuy-uri")}` : ""}${e.entries > 1 ? ` · ${e.entries} intrări` : ""}${e.addon ? " · add-on" : ""}</div></div>
      ${e.status === "playing" && e.stack != null ? `<div class="chips">${fmt(e.stack)}</div>` : e.prize ? `<div class="chips">${fmt(e.prize)}</div>` : ""}</div>`).join("") : `<div class="empty small">Nimeni înscris încă.</div>`}</div>
    <h2>Reguli</h2>
    <div class="card trules">${rules.map(([k, v]) => `<div class="row"><span class="muted grow">${k}</span><b>${esc(v)}</b></div>`).join("")}</div>
    <details class="card tlevels"><summary>Structura blindurilor (${t.levels.length} nivele)</summary>
      ${t.levels.map(([sb, bb], i) => `<div class="row ${t.level && t.level.n === i + 1 ? "cur" : ""}"><span class="muted">Nivel ${i + 1}</span><span class="grow"></span><b>${fmt(sb)}/${fmt(bb)}</b></div>`).join("")}</details>
  </div>`;
  D.app.querySelectorAll("[data-ta]").forEach((b) => (b.onclick = () => action(b.dataset.ta, b)));
}

async function action(kind, b) {
  const t = L.tourney;
  const ask = { register: L.actions.register ? `Plătești ${fmt(L.actions.register)} jetoane din sold ca să intri?` : null, rebuy: L.actions.rebuy ? `Rebuy: plătești ${fmt(L.actions.rebuy)} jetoane?` : null,
    reentry: L.actions.reentry ? `Re-entry: plătești ${fmt(L.actions.reentry)} jetoane?` : null, addon: L.actions.addon ? `Add-on: plătești ${fmt(L.actions.addon)} jetoane?` : null,
    unregister: "Te retragi din turneu?", cancel: "Anulezi turneul? Premiul revine în jackpot, iar taxele se dau înapoi jucătorilor.", start: `Pornești turneul acum cu ${plural(L.entries.length, "jucător", "jucători")}?` }[kind];
  if (ask && !confirm(ask)) return;
  b.disabled = true;
  try {
    const r = await api("POST", `/api/tourneys/${t.id}/${kind}`);
    toast({ register: "Te-ai înscris.", unregister: "Te-ai retras.", rebuy: "Rebuy făcut.", reentry: "Ai intrat din nou.", addon: "Add-on făcut.", start: "Turneul a pornit!", cancel: "Turneul a fost anulat." }[kind], true);
    if (r.tables?.length && ["rebuy", "reentry"].includes(kind) || (kind === "register" && t.status === "running" && r.tables?.length)) return go(`#/table/${r.tables[0]}`);
    renderLobby();
  } catch (e) { toast(e.message); b.disabled = false; }
}

// numărătoarea inversă (nivelul următor, pornirea)
setInterval(() => document.querySelectorAll("[data-countdown]").forEach((el) => { el.textContent = mmss(Number(el.dataset.countdown) - Date.now()); }), 1000);
