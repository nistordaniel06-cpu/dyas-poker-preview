// DYAS Poker — panoul administratorului. Se încarcă doar pentru administratori (din app.js).
const D = window.DY;
const { api, esc, fmt, plural, toast, go, avatarHtml, handCard, chipAdjustHtml, bindChipAdjust, ago, ROLE } = D;
const $ = (sel) => D.app.querySelector(sel);
const $$ = (sel) => D.app.querySelectorAll(sel);

if (!document.querySelector('link[href^="/admin.css"]')) {
  const l = document.createElement("link");
  l.rel = "stylesheet"; l.href = "/admin.css?v=5";
  document.head.appendChild(l);
}

let timer = null;
export function stop() { clearInterval(timer); timer = null; }

const REASON = { welcome: "Bun venit", buy_in: "Intrare la masă", cash_out: "Ridicare de la masă", free_chips: "Cerere aprobată",
  admin_grant: "Primite de la admin", admin_take: "Retrase de admin", admin_close: "Masă închisă de admin", bank_payout: "Din casa clubului", jackpot_payout: "Din jackpot",
  admin_wipe: "Jetoane șterse de admin", tourney_fee: "Taxă turneu", tourney_prize: "Premiu turneu", tourney_refund: "Rambursare turneu" };
/** Proprietarul aplicației (are grad peste ceilalți administratori). */
let ME = null;
const meInfo = () => (ME ||= api("GET", "/api/admin/me").catch(() => ({ isOwner: false })));
const signed = (n) => `<span class="${n >= 0 ? "pos" : "neg"}">${n > 0 ? "+" : ""}${fmt(n)}</span>`;
const TABS = [["overview", "Rezumat"], ["live", "Mese live"], ["users", "Jucători"], ["clubs", "Cluburi"], ["news", "Anunțuri"], ["alerts", "Alerte"], ["ledger", "Jurnal jetoane"]];
const adm = () => document.getElementById("adm");
/** Confirmare pentru acțiuni care nu se pot anula: trebuie scris numele. */
const confirmName = (what, name) => {
  const v = prompt(`${what}\n\nAcțiunea nu se poate anula. Scrie „${name}” ca să confirmi:`);
  return v != null && v.trim().toLowerCase() === String(name).trim().toLowerCase();
};

export async function renderAdmin() {
  const v = D.view;
  const tab = TABS.some(([k]) => k === v.tab) ? v.tab : "overview";
  D.app.innerHTML = `<div class="screen admin">
    <div class="topbar"><a class="back" href="#/" aria-label="Înapoi">←</a><h1 style="margin:0">Administrare</h1></div>
    <div class="tabs scroll">${TABS.map(([k, n]) => `<button data-at="${k}" class="${k === tab ? "on" : ""}">${n}<span class="dot" data-dot="${k}" hidden></span></button>`).join("")}</div>
    <div id="adm"><div class="empty">Se încarcă…</div></div></div>`;
  $$("[data-at]").forEach((b) => (b.onclick = () => go(`#/admin/${b.dataset.at}`)));
  const paint = { overview, live, users, clubs, news, alerts, ledger }[tab];
  await paint();
  alertDot();
  if (tab === "overview" || tab === "live") timer = setInterval(() => { if (!document.hidden && adm()) paint(true); }, 5000);
}

async function alertDot() {
  const [r, c] = await Promise.all([api("GET", "/api/admin/alerts").catch(() => null), api("GET", "/api/admin/chat-reports").catch(() => null)]);
  const dot = document.querySelector('[data-dot="alerts"]');
  const n = (r?.items.length || 0) + (c?.items.length || 0);
  if (dot) { dot.hidden = !n; dot.textContent = n; }
}

// ---------- rezumat + grafice ----------
async function overview(refresh) {
  const [o, st] = await Promise.all([api("GET", "/api/admin/overview"), refresh ? null : api("GET", "/api/admin/stats")]).catch((e) => { toast(e.message); return []; });
  if (!o || !adm()) return;
  const tiles = [["👥", o.users, o.users === 1 ? "jucător" : "jucători", `${o.online} online acum`], ["🏛️", o.clubs, o.clubs === 1 ? "club" : "cluburi", plural(o.tables, "masă deschisă", "mese deschise")],
    ["🔴", o.playing, o.playing === 1 ? "masă în joc" : "mese în joc", plural(o.seated, "jucător așezat", "jucători așezați")], ["🃏", o.hands_today, o.hands_today === 1 ? "mână azi" : "mâini azi", ""],
    ["💶", fmt(o.in_balances), "jetoane în solduri", ""], ["♠", fmt(o.on_tables), "jetoane pe mese", ""], ["🎁", fmt(o.granted), "jetoane date de tine", "în total"], ["🎰", fmt(o.jackpots), "în jackpoturile cluburilor", "partea lor din comision"], ["🏛️", fmt(o.house), "în casa aplicației", `+${fmt(o.rake_today)} comision azi`],
    ["🏦", fmt(o.bank), "rămase în casele cluburilor", "de dinainte de jackpot"]];
  const group = (title, entries) => '<section class="metric-group"><h2>' + title + '</h2><div class="metric-grid">' +
    entries.map(([, value, label, detail]) => '<div class="kpi"><small>' + label + '</small><b>' + value + '</b>' + (detail ? '<em>' + detail + '</em>' : '') + '</div>').join('') + '</div></section>';
  const kpis = '<div class="kpis" data-testid="admin-kpis">' + group('Activitate la mese', tiles.slice(0,4)) + group('Distribuția jetoanelor', tiles.slice(4)) + '</div>';
  if (refresh && adm().querySelector(".kpis")) { adm().querySelector(".kpis").outerHTML = kpis; return; }
  adm().innerHTML = `${kpis}
    <div class="actions" style="margin-top:14px">
      <a class="tile gold" href="#/admin/users"><span class="ic">🎁</span><span><b>Dă jetoane</b><small>Caută jucătorul</small></span></a>
      <a class="tile" href="#/admin/live"><span class="ic">📺</span><span><b>Mese live</b><small>Privește jocul</small></span></a></div>
    <h2>Ultimele 14 zile</h2>
    <div class="charts" data-testid="charts">
      ${chart("Mâini jucate", st.days, "hands")}
      ${chart("Jucători activi", st.days, "players")}
      ${chart("Jetoane date", st.days, "granted")}
      ${chart("Conturi noi", st.days, "signups")}
    </div>`;
}

function chart(title, days, key) {
  const vals = days.map((d) => d[key]);
  const max = Math.max(1, ...vals), total = vals.reduce((a, b) => a + b, 0);
  return `<div class="chart card"><div class="ch-head"><b>${title}</b><span>${fmt(total)} <small>în total</small></span></div>
    <div class="bars" role="img" aria-label="${title}: ${days.map((d) => `${d.day.slice(8)}: ${d[key]}`).join(", ")}">
      ${days.map((d, i) => `<div class="bar ${i === days.length - 1 ? "today" : ""}" title="${d.day.slice(8, 10)}.${d.day.slice(5, 7)}: ${fmt(d[key])}">
        <i style="height:${d[key] ? Math.max(4, (d[key] / max) * 100) : 0}%"></i></div>`).join("")}
    </div>
    <div class="axis"><span>${days[0].day.slice(8, 10)}.${days[0].day.slice(5, 7)}</span><span>azi</span></div></div>`;
}

// ---------- mese live + închidere forțată ----------
async function live() {
  const r = await api("GET", "/api/admin/live").catch((e) => toast(e.message));
  if (!r || !adm()) return;
  const STREET = { preflop: "Preflop", flop: "Flop", turn: "Turn", river: "River" };
  adm().innerHTML = r.tables.length ? r.tables.map((t) => `<div class="list-item live-row" data-testid="live-table">
      <div class="table-ic ${t.playing ? "on" : ""}">♠</div>
      <div class="grow"><div class="t">${esc(t.name)} <span class="small muted">· ${esc(t.club.emblem)} ${esc(t.club.name)}</span></div>
        <div class="small muted">${fmt(t.sb)}/${fmt(t.bb)} · ${t.players.length}/${t.capacity} locuri${t.playing ? ` · <span class="badge live">${STREET[t.street] || "În joc"} · mâna #${t.handNo}</span> · pot ${fmt(t.pot)}` : ""}</div>
        ${t.players.length ? `<div class="plist">${t.players.map((p) => `<span>${p.avatar ? esc(p.avatar) : "•"} ${esc(p.name)} <b>${fmt(p.stack)}</b></span>`).join("")}</div>` : ""}
        <div class="row live-btns"><a class="btn sm" href="#/table/${t.id}">Privește</a><button class="btn sm danger" data-close="${t.id}" data-name="${esc(t.name)}">Închide masa</button></div></div></div>`).join("")
    : `<div class="empty"><b>📺</b>Nicio masă deschisă.</div>`;
  $$("[data-close]").forEach((b) => (b.onclick = async () => {
    if (!confirm(`Închizi masa „${b.dataset.name}”?\n\nToți jucătorii sunt ridicați. Fiecare primește înapoi în sold jetoanele de la începutul mâinii curente.`)) return;
    try { const x = await api("POST", `/api/admin/tables/${b.dataset.close}/close`); toast(`Masa a fost închisă. ${fmt(x.returned)} jetoane returnate la ${plural(x.players, "jucător", "jucători")}.`, true); live(); }
    catch (e) { toast(e.message); }
  }));
}

// ---------- jucători ----------
let q = "";
async function users(refresh) {
  if (!adm()) return;
  if (!refresh || !adm().querySelector("#uq")) {
    adm().innerHTML = `<input id="uq" placeholder="Caută jucător după nume…" value="${esc(q)}" autocomplete="off" aria-label="Caută jucător"><div id="ul"></div>`;
    let t;
    adm().querySelector("#uq").oninput = (e) => { q = e.target.value; clearTimeout(t); t = setTimeout(() => users(true), 250); };
  }
  const r = await api("GET", `/api/admin/users?q=${encodeURIComponent(q)}`).catch((e) => toast(e.message));
  const ul = document.getElementById("ul");
  if (!r || !ul) return;
  ul.innerHTML = r.users.length ? r.users.map((u) => `<a class="list-item" href="#/admin/user/${u.id}" data-testid="admin-user">${avatarHtml(u)}
      <div class="grow"><div class="t">${esc(u.username)} ${u.is_owner ? `<span class="badge superadmin">👑 Proprietar</span>` : u.is_admin ? `<span class="badge superadmin">Admin</span>` : ""}${u.blocked ? `<span class="badge full">Blocat</span>` : ""}${u.seated ? `<span class="badge live">la masă</span>` : ""}</div>
        <div class="small muted">${plural(u.clubs, "club", "cluburi")} · văzut ${ago(u.last_seen)}</div></div>
      <div class="chips">${fmt(u.balance)}</div></a>`).join("") : `<div class="empty">Niciun jucător găsit.</div>`;
}

export async function renderAdminUser() {
  const me = D.me;
  D.app.innerHTML = `<div class="screen admin"><div class="topbar"><a class="back" href="#/admin/users" aria-label="Înapoi">←</a><h1 style="margin:0">Jucător</h1></div><div class="empty">Se încarcă…</div></div>`;
  let r;
  try { r = await api("GET", `/api/admin/users/${D.view.id}`); } catch (e) { toast(e.message); return go("#/admin/users"); }
  const u = r.user, s = r.stats, self = u.id === me.id;
  const boss = (await meInfo()).isOwner, locked = u.is_owner && !boss;
  D.app.innerHTML = `<div class="screen admin">
    <div class="topbar"><a class="back" href="#/admin/users" aria-label="Înapoi">←</a><h1 style="margin:0">Jucător</h1></div>
    <div class="card profile-head">${avatarHtml(u, "xl")}<div class="grow"><div class="name">${esc(u.username)}</div>
      <div class="small muted">Cont din ${new Date(u.created_at).toLocaleDateString("ro-RO")} · văzut ${ago(u.last_seen)}</div>
      ${u.blocked ? `<span class="badge full">Cont blocat</span>` : ""}${u.is_owner ? `<span class="badge superadmin">👑 Proprietarul aplicației</span>` : u.is_admin ? `<span class="badge superadmin">Administrator</span>` : ""}</div></div>
    <div class="stats"><div><b>${fmt(s.hands)}</b><small>mâini</small></div><div><b>${s.hands ? Math.round((s.wins / s.hands) * 100) : 0}%</b><small>câștigate</small></div>
      <div><b>${signed(s.net)}</b><small>câștig net</small></div><div><b>${fmt(s.best)}</b><small>cel mai mare pot</small></div></div>
    <h2>Jetoane pe cluburi</h2>
    ${r.clubs.length ? r.clubs.map((c) => `<div class="card uclub" data-club="${c.id}">
        <div class="row"><div class="emblem">${esc(c.emblem)}</div><div class="grow"><b>${esc(c.name)}</b><div class="small"><span class="badge ${c.role}">${ROLE[c.role]}</span>${c.on_table ? ` · ${fmt(c.on_table)} pe masă` : ""}</div></div>
          <div class="chips" data-testid="club-balance">${fmt(c.balance)}</div></div>
        <div data-adj></div></div>`).join("")
      : `<div class="empty">Nu e în niciun club. Jetoanele se dau într-un club, după ce jucătorul intră cu codul.</div>`}
    <h2>Cont</h2>
    <div class="card acct">
      ${self ? `<span class="small muted">Acesta e contul tău.</span>` : locked ? `<span class="small muted">👑 Contul proprietarului aplicației. Doar el îl poate modifica.</span>` : `
      ${boss ? `<button class="btn sm" id="adm-role">${u.is_admin ? "🛡️ Scoate din administratori" : "🛡️ Fă-l administrator"}</button>` : ""}
      <button class="btn sm ${u.blocked ? "green" : "danger"}" id="blk">${u.blocked ? "Deblochează contul" : "Blochează contul"}</button>`}
      ${locked ? "" : `<button class="btn sm" id="pwd">Resetează parola</button>`}
      ${self || locked ? "" : `<button class="btn sm danger" id="del">🗑️ Șterge contul</button>`}</div>
    <h2>Ultimele mișcări de jetoane</h2>
    ${r.ledger.length ? `<div class="card ledger">${r.ledger.map(ledgerRow).join("")}</div>` : `<div class="empty">Nicio mișcare.</div>`}
    <h2>Ultimele mâini</h2>
    ${r.hands.length ? r.hands.map(handCard).join("") : `<div class="empty">Nicio mână jucată.</div>`}
  </div>`;
  $$(".uclub").forEach((el) => {
    const host = el.querySelector("[data-adj]");
    host.innerHTML = chipAdjustHtml();
    bindChipAdjust(host, el.dataset.club, u.id, u.username, () => renderAdminUser());
  });
  $("#adm-role")?.addEventListener("click", async () => {
    const make = !u.is_admin;
    if (!confirm(make ? `Faci pe ${u.username} administrator?\n\nVa putea da și retrage jetoane, bloca conturi și vedea toată aplicația.` : `Îi iei lui ${u.username} drepturile de administrator?`)) return;
    try { await api("POST", `/api/admin/users/${u.id}/admin`, { isAdmin: make }); toast(make ? "Acum e administrator." : "Nu mai e administrator.", true); renderAdminUser(); } catch (e) { toast(e.message); }
  });
  $("#blk")?.addEventListener("click", async () => {
    if (!confirm(u.blocked ? `Deblochezi contul lui ${u.username}?` : `Blochezi contul lui ${u.username}? Va fi deconectat imediat.`)) return;
    try { await api("POST", `/api/admin/users/${u.id}/block`, { blocked: !u.blocked }); renderAdminUser(); } catch (e) { toast(e.message); }
  });
  if ($("#pwd")) $("#pwd").onclick = async () => {
    const p = prompt(`Parola nouă pentru ${u.username} (minim 6 caractere):`);
    if (!p) return;
    try { await api("POST", `/api/admin/users/${u.id}/password`, { password: p }); toast("Parola a fost schimbată. Trimite-i-o jucătorului.", true); } catch (e) { toast(e.message); }
  };
  $("#del")?.addEventListener("click", async () => {
    if (!confirmName(`Ștergi contul lui ${u.username}? Se pierd soldurile și istoricul lui de jetoane.`, u.username)) return toast("Ștergere anulată.");
    try { await api("DELETE", `/api/admin/users/${u.id}`); toast("Contul a fost șters.", true); go("#/admin/users"); } catch (e) { toast(e.message); }
  });
}

function ledgerRow(l) {
  return `<div class="lrow"><div class="grow">${l.username ? `<b>${esc(l.username)}</b> · ` : ""}${REASON[l.reason] || esc(l.reason)}${l.note ? ` <span class="muted">„${esc(l.note)}”</span>` : ""}
    <div class="small muted">${esc(l.club)}${l.by_name ? ` · de ${esc(l.by_name)}` : ""} · ${ago(l.created_at)}</div></div>${signed(l.delta)}</div>`;
}

// ---------- cluburi: jetoane pentru toți, bun venit, ștergere ----------
async function clubs() {
  const r = await api("GET", "/api/admin/clubs").catch((e) => toast(e.message));
  if (!r || !adm()) return;
  const wipeAll = `<div class="card wipe-all" data-testid="wipe-all"><div class="row"><div class="grow"><b>🧹 Șterge jetoanele din toate cluburile</b>
      <div class="small muted">Golește soldurile tuturor membrilor din toate cluburile. Jetoanele de pe mese și jackpoturile rămân.</div></div>
      <button type="button" class="btn sm danger" data-wipe="" data-name="toate cluburile">Șterge tot</button></div></div>`;
  adm().innerHTML = wipeAll + (r.clubs.length ? r.clubs.map((c) => `<div class="card" data-testid="admin-club">
      <a class="row" href="#/club/${c.id}" style="color:inherit;text-decoration:none"><div class="emblem">${esc(c.emblem)}</div>
        <div class="grow"><b>${esc(c.name)}</b><div class="small muted">Proprietar: ${esc(c.owner)} · cod ${esc(c.code)}</div>
        <div class="small muted">${plural(c.members, "membru", "membri")} · ${plural(c.tables, "masă", "mese")} · ${fmt(c.chips)} jetoane în solduri</div></div><span class="btn sm">Deschide</span></a>
      <form class="bulk" data-bulk="${c.id}" data-n="${c.members}">
        <div class="small muted">🎁 Dă jetoane tuturor celor ${c.members} membri</div>
        <div class="row"><input name="v" type="number" inputmode="numeric" min="1" placeholder="Sumă de fiecare" aria-label="Sumă de fiecare">
          <button class="btn sm green">Dă tuturor</button></div></form>
      <div class="bank jp-box" data-testid="club-jackpot">
        <div class="row"><div class="grow"><div class="small muted">🎰 Jackpotul clubului (${c.jackpotPct ?? 50}% din comision)</div><b class="chips">${fmt(c.jackpot)}</b>
          <div class="small muted">Îl folosești pentru premiile turneelor</div></div>
          <button type="button" class="btn sm" data-pay="${c.id}" data-kind="jackpot" ${c.jackpot > 0 ? "" : "disabled"}>Plătește din jackpot</button></div>
        <div data-payf="${c.id}-jackpot"></div>
        <form data-jpct="${c.id}" style="margin-top:10px"><div class="small muted">Cât din comision intră în jackpot (restul merge în casa aplicației)</div>
          <div class="row" style="margin-top:6px"><input name="v" type="number" inputmode="decimal" min="0" max="100" step="1" value="${c.jackpotPct ?? 50}" class="grow" aria-label="Procent jackpot" data-testid="jackpot-pct"><b>%</b><button class="btn sm">Salvează</button></div></form></div>
      <div class="bank" data-testid="club-bank">
        <div class="row"><div class="grow"><div class="small muted">🏦 Casa clubului (de dinainte de jackpot)</div><b class="chips" data-testid="bank">${fmt(c.bank)}</b>
          <div class="small muted">Comision la mesele clubului în ultimele 7 zile: ${fmt(c.rake_week)}</div></div>
          <button type="button" class="btn sm" data-pay="${c.id}" data-kind="bank" ${c.bank > 0 ? "" : "disabled"}>Plătește din casă</button></div>
        <div data-payf="${c.id}-bank"></div>
        <form data-rake="${c.id}" style="margin-top:10px"><div class="small muted">Comision din fiecare pot (doar după flop)</div>
          <div class="row" style="margin-top:6px"><input name="v" type="number" inputmode="decimal" min="0" max="10" step="0.5" value="${c.rakePct}" class="grow" aria-label="Comision procent"><b>%</b><button class="btn sm">Salvează</button></div></form>
      </div>
      <form class="row welcome" data-wc="${c.id}"><label class="small muted grow" style="margin:0">Jetoane de bun venit la intrarea în club</label>
        <input name="v" type="number" inputmode="numeric" min="0" value="${c.starting_chips}" style="width:110px" aria-label="Jetoane de bun venit"><button class="btn sm">Salvează</button></form>
      <div class="danger-zone"><button class="btn sm danger" data-wipe="${c.id}" data-name="${esc(c.name)}" data-testid="wipe-club">🧹 Șterge jetoanele clubului</button>
        <button class="btn sm danger" data-delclub="${c.id}" data-name="${esc(c.name)}">🗑️ Șterge clubul</button></div></div>`).join("")
    : `<div class="empty">Niciun club.</div>`);
  $$("[data-wipe]").forEach((b) => (b.onclick = async () => {
    const all = !b.dataset.wipe;
    if (!confirmName(all ? "Ștergi jetoanele din soldurile tuturor membrilor, din TOATE cluburile?" : `Ștergi jetoanele din soldurile tuturor membrilor clubului „${b.dataset.name}”?`, "STERGE")) return toast("Anulat.");
    const jp = confirm(all ? "Golești și jackpoturile tuturor cluburilor?\n\nOK = da, Cancel = jackpoturile rămân" : "Golești și jackpotul clubului?\n\nOK = da, Cancel = jackpotul rămâne");
    try {
      const x = await api("POST", "/api/admin/chips/wipe", { clubId: b.dataset.wipe || null, jackpot: jp });
      toast(`Am șters ${fmt(x.total)} jetoane de la ${plural(x.members, "membru", "membri")}.`, true); clubs();
    } catch (e) { toast(e.message); }
  }));
  $$("[data-bulk]").forEach((f) => (f.onsubmit = async (e) => {
    e.preventDefault();
    const n = Math.floor(Number(f.v.value));
    if (!n || n < 1) return toast("Scrie suma.");
    if (!confirm(`Dai câte ${fmt(n)} jetoane fiecăruia dintre cei ${f.dataset.n} membri (${fmt(n * Number(f.dataset.n))} în total)?`)) return;
    try { const x = await api("POST", "/api/admin/chips/bulk", { clubId: f.dataset.bulk, delta: n, note: "Pentru tot clubul" }); toast(`Ai dat câte ${fmt(x.each)} jetoane la ${plural(x.members, "membru", "membri")}.`, true); clubs(); }
    catch (err) { toast(err.message); }
  }));
  $$("[data-rake]").forEach((f) => (f.onsubmit = async (e) => {
    e.preventDefault();
    try { await api("PATCH", `/api/admin/clubs/${f.dataset.rake}`, { rakePct: Number(f.v.value) }); toast(`Comision salvat: ${Number(f.v.value)}%. Se aplică de la mâna următoare.`, true); } catch (err) { toast(err.message); }
  }));
  $$("[data-jpct]").forEach((f) => (f.onsubmit = async (e) => {
    e.preventDefault();
    try { await api("PATCH", `/api/admin/clubs/${f.dataset.jpct}`, { jackpotPct: Number(f.v.value) }); toast(`Salvat: ${Number(f.v.value)}% din comision intră în jackpot, de la mâna următoare.`, true); clubs(); } catch (err) { toast(err.message); }
  }));
  $$("[data-pay]").forEach((b) => (b.onclick = async () => {
    const kind = b.dataset.kind, host = $(`[data-payf="${b.dataset.pay}-${kind}"]`);
    if (host.innerHTML) { host.innerHTML = ""; return; }
    let d;
    try { d = await api("GET", `/api/clubs/${b.dataset.pay}`); } catch (e) { return toast(e.message); }
    host.innerHTML = `<form class="payf" style="margin-top:8px">
      <select name="u" aria-label="Membru">${d.members.map((m) => `<option value="${m.user_id}">${esc(m.username)} · sold ${fmt(m.balance)}</option>`).join("")}</select>
      <div class="row" style="margin-top:8px"><input name="a" type="number" inputmode="numeric" min="1" placeholder="Sumă" class="grow" aria-label="Sumă">
        <button class="btn sm green">Plătește</button></div>
      <input name="n" maxlength="140" placeholder="Motiv (ex. premiu turneu)" style="margin-top:8px" aria-label="Motiv"></form>`;
    host.querySelector("form").onsubmit = async (e) => {
      e.preventDefault();
      const f = e.target, n = Math.floor(Number(f.a.value));
      if (!n || n < 1) return toast("Scrie suma.");
      const name = f.u.selectedOptions[0].textContent.split(" · ")[0];
      if (!confirm(`Plătești ${fmt(n)} jetoane din ${kind === "jackpot" ? "jackpotul" : "casa"} clubului lui ${name}?`)) return;
      try {
        const x = await api("POST", `/api/admin/clubs/${b.dataset.pay}/${kind}/pay`, { userId: f.u.value, amount: n, note: f.n.value });
        toast(kind === "jackpot" ? `Plătit. În jackpot au rămas ${fmt(x.jackpot)}.` : `Plătit. În casă au rămas ${fmt(x.bank)}.`, true); clubs();
      }
      catch (err) { toast(err.message); }
    };
  }));
  $$("[data-wc]").forEach((f) => (f.onsubmit = async (e) => {
    e.preventDefault();
    try { await api("PATCH", `/api/admin/clubs/${f.dataset.wc}`, { startingChips: Number(f.v.value) }); toast("Salvat.", true); } catch (err) { toast(err.message); }
  }));
  $$("[data-delclub]").forEach((b) => (b.onclick = async () => {
    if (!confirmName(`Ștergi clubul „${b.dataset.name}”? Se șterg mesele, membrii, soldurile și istoricul clubului.`, b.dataset.name)) return toast("Ștergere anulată.");
    try { await api("DELETE", `/api/admin/clubs/${b.dataset.delclub}`); toast("Clubul a fost șters.", true); clubs(); } catch (e) { toast(e.message); }
  }));
}

// ---------- anunțuri ----------
async function news() {
  const [r, cl] = await Promise.all([api("GET", "/api/admin/announcements"), api("GET", "/api/admin/clubs")]).catch((e) => { toast(e.message); return []; });
  if (!r || !adm()) return;
  adm().innerHTML = `<form class="card" id="nf">
      <label for="nt" style="margin-top:0">Titlu</label><input id="nt" name="title" required minlength="2" maxlength="80" placeholder="ex. Turneu vineri la 20:00">
      <label for="nb">Mesaj <span class="muted">(opțional)</span></label><textarea id="nb" name="body" maxlength="400" placeholder="ex. Intrare 2.000, masa de 9. Vă aștept!"></textarea>
      <label for="nc">Pentru</label><select id="nc" name="club"><option value="">Toți jucătorii</option>${cl.clubs.map((c) => `<option value="${c.id}">${esc(c.emblem)} ${esc(c.name)}</option>`).join("")}</select>
      <label class="switch" style="padding-bottom:0"><span>🔔 Trimite și ca notificare pe telefon<small>Ajunge la cei care au pornit notificările</small></span><input type="checkbox" name="push" checked></label>
      <p class="small muted" style="margin:8px 0 0">Anunțul apare și pe ecranul principal al aplicației, timp de 7 zile.</p>
      <button class="btn primary block" style="margin-top:12px">📣 Trimite anunțul</button></form>
    <h2>Trimise</h2>
    ${r.items.length ? r.items.map((a) => `<div class="card news-item" data-testid="news-item"><div class="row"><div class="grow"><b>${esc(a.title)}</b>
        <div class="small muted">${a.club ? esc(a.club) : "Toți jucătorii"} · ${ago(a.created_at)} · ${a.pushed ? `${plural(a.pushed, "notificare trimisă", "notificări trimise")}` : "fără notificare"}</div></div>
        <button class="btn sm danger" data-delnews="${a.id}" aria-label="Șterge anunțul">🗑️</button></div>${a.body ? `<p>${esc(a.body)}</p>` : ""}</div>`).join("")
      : `<div class="empty"><b>📣</b>Niciun anunț trimis.</div>`}`;
  $("#nf").onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target;
    try {
      const x = await api("POST", "/api/admin/announcements", { title: f.title.value, body: f.body.value, clubId: f.club.value || null, push: f.push.checked });
      toast(f.push.checked ? `Anunț trimis. Notificări: ${x.pushed} din ${x.subscribers} abonați.` : "Anunț publicat.", true);
      news();
    } catch (err) { toast(err.message); }
  };
  $$("[data-delnews]").forEach((b) => (b.onclick = async () => {
    if (!confirm("Ștergi anunțul? Dispare și de pe ecranul jucătorilor.")) return;
    try { await api("DELETE", `/api/admin/announcements/${b.dataset.delnews}`); news(); } catch (e) { toast(e.message); }
  }));
}

// ---------- alerte ----------
async function alerts() {
  const [r, cr] = await Promise.all([api("GET", "/api/admin/alerts").catch((e) => toast(e.message)), api("GET", "/api/admin/chat-reports").catch(() => ({ items: [] }))]);
  if (!r || !adm()) return;
  adm().innerHTML = `${reportsHtml(cr.items)}<div class="card">
      <div class="small muted">Îți arăt jucătorii care au câștigat sau pierdut cel puțin pragul de mai jos într-un club, în ultimele 24 de ore.
        Merită verificat mai ales când câștigă mult un cont nou sau când aceleași jucători își pasează jetoane.</div>
      <form class="row" id="thf" style="margin-top:10px"><label class="grow small muted" style="margin:0">Prag (jetoane)</label>
        <input name="v" type="number" inputmode="numeric" min="100" value="${r.threshold}" style="width:120px" aria-label="Prag"><button class="btn sm">Salvează</button></form></div>
    ${r.items.length ? r.items.map((a) => `<a class="list-item" href="#/admin/user/${a.uid}" data-testid="alert-row">${avatarHtml(a)}
        <div class="grow"><div class="t">${esc(a.username)} ${a.newAccount ? `<span class="badge full">cont nou</span>` : ""}</div>
          <div class="small muted">${esc(a.club)} · ${plural(a.hands, "mână", "mâini")} în 24 h</div></div>
        <div class="net">${signed(a.net)}</div></a>`).join("")
      : `<div class="empty"><b>✅</b>Nimic neobișnuit în ultimele 24 de ore.</div>`}`;
  $("#thf").onsubmit = async (e) => {
    e.preventDefault();
    try { await api("PATCH", "/api/admin/settings", { alertThreshold: Number(e.target.v.value) }); toast("Prag salvat.", true); alerts(); } catch (err) { toast(err.message); }
  };
  bindReports();
}

// ---------- raportări din chat ----------
function reportsHtml(items) {
  if (!items.length) return `<h2 class="sec">🚩 Raportări din chat</h2><div class="empty small" data-testid="reports-empty">Nicio raportare de rezolvat.</div>`;
  return `<h2 class="sec">🚩 Raportări din chat <span class="badge full">${items.length}</span></h2>${items.map((m) => `<div class="card rep" data-testid="report-row" data-id="${m.id}">
    <div class="row">${avatarHtml(m)}<div class="grow"><div class="t"><a href="#/admin/user/${m.userId}">${esc(m.username)}</a>${m.muted ? ` <span class="badge">chat oprit</span>` : ""}</div>
      <div class="small muted">${esc(m.club)} · ${esc(m.table)} · ${ago(m.at)} · ${plural(m.reports, "raportare", "raportări")}</div></div></div>
    <div class="rep-body">${m.kind === "text" ? `<div class="rep-txt">${esc(m.text)}</div>`
      : m.kind === "image" ? `<img data-rmedia="${m.id}" alt="Poză raportată">` : `<audio data-rmedia="${m.id}" controls preload="none"></audio>`}</div>
    <div class="row wrap"><button class="btn sm danger" data-rep="delete">🗑️ Șterge</button>
      ${m.muted ? "" : `<button class="btn sm" data-rep="mute">🔇 Șterge și oprește chatul</button>`}
      <button class="btn sm" data-rep="dismiss">Ignoră</button></div></div>`).join("")}`;
}
function bindReports() {
  $$("[data-rmedia]").forEach(async (n) => {
    try {
      const r = await fetch(`/api/chat/media/${n.dataset.rmedia}`, { headers: { authorization: "Bearer " + D.token } });
      if (r.ok) n.src = URL.createObjectURL(await r.blob());
    } catch {}
  });
  $$("[data-rep]").forEach((b) => (b.onclick = async () => {
    const id = b.closest("[data-id]").dataset.id, action = b.dataset.rep;
    try {
      await api("POST", `/api/admin/chat-reports/${id}`, { action });
      toast(action === "dismiss" ? "Raportarea a fost ignorată." : action === "mute" ? "Mesaj șters, chatul jucătorului e oprit în club." : "Mesaj șters.", true);
      alerts(); alertDot();
    } catch (e) { toast(e.message); }
  }));
}

// ---------- jurnal + export ----------
let ledgerKind = "given";
async function ledger() {
  const r = await api("GET", `/api/admin/ledger${ledgerKind === "given" ? "?kind=given&limit=300" : ""}`).catch((e) => toast(e.message));
  if (!r || !adm()) return;
  const t = r.totals;
  adm().innerHTML = `<div class="seg" style="margin-bottom:12px">${[["given", "🎁 Jetoane date"], ["all", "Toate mișcările"]].map(([k, n]) => `<button data-lk="${k}" class="${k === ledgerKind ? "on" : ""}">${n}</button>`).join("")}</div>
    ${t ? `<div class="kpis" data-testid="given-totals">
      <div class="kpi"><span>📅</span><b>${fmt(t.today)}</b><small>date azi</small></div>
      <div class="kpi"><span>🗓️</span><b>${fmt(t.week)}</b><small>date în 7 zile</small></div>
      <div class="kpi"><span>🎁</span><b>${fmt(t.total)}</b><small>date în total</small></div>
      <div class="kpi"><span>↩️</span><b>${fmt(t.taken)}</b><small>retrase în total</small></div></div>
      <p class="small muted" style="margin:10px 2px">Fiecare rând: cui, câte jetoane, în ce club, cine le-a dat și când.</p>` : ""}
    ${r.rows.length ? `<div class="card ledger" data-testid="ledger-rows">${r.rows.map(ledgerRow).join("")}</div>` : `<div class="empty">Nicio mișcare.</div>`}
    <button class="btn block" id="csv" data-testid="export-csv" style="margin-top:12px">📊 Descarcă tot jurnalul (Excel)</button>
    <p class="small muted" style="margin:6px 2px 12px">Fișier CSV cu toate mișcările de jetoane. Se deschide direct în Excel sau Google Sheets.</p>`;
  $$("[data-lk]").forEach((b) => (b.onclick = () => { ledgerKind = b.dataset.lk; ledger(); }));
  $("#csv").onclick = exportCsv;
}

async function exportCsv() {
  try {
    const r = await api("GET", "/api/admin/ledger?limit=20000");
    const cell = (v) => { const s = String(v ?? ""); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const head = ["Data", "Ora", "Jucător", "Club", "Tip", "Jetoane", "Motiv", "De către"];
    const lines = r.rows.map((l) => {
      const d = new Date(l.created_at);
      return [d.toLocaleDateString("ro-RO"), d.toLocaleTimeString("ro-RO"), l.username, l.club, REASON[l.reason] || l.reason, l.delta, l.note, l.by_name].map(cell).join(";");
    });
    // „sep=;” și BOM: Excel în română deschide corect coloanele și diacriticele
    const blob = new Blob(["﻿sep=;\n" + [head.join(";"), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `dyas-poker-jurnal-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast(`Am descărcat ${plural(r.rows.length, "mișcare", "mișcări")}.`, true);
  } catch (e) { toast(e.message); }
}
