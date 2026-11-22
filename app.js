// DYAS Poker — client mobil. Serverul decide totul; aici doar afișăm și trimitem intenții.
import * as more from "/more.js?v=1";
const $app = document.getElementById("app");
const fmt = (n) => Number(n || 0).toLocaleString("ro-RO");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const ROLE = { owner: "Proprietar", admin: "Admin", member: "Membru", superadmin: "Super admin" };
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
/** Sigla jackpotului: trei role cu 7, ca la aparate. */
const JP_LOGO = `<svg class="jp-logo" viewBox="0 0 96 40" aria-hidden="true"><defs><linearGradient id="jpg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff1b8"/><stop offset=".45" stop-color="#f2cd6b"/><stop offset="1" stop-color="#a8741f"/></linearGradient>
  <linearGradient id="jpr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".5" stop-color="#f4f0e4"/><stop offset="1" stop-color="#cfc7b0"/></linearGradient></defs>
  <rect x="1.5" y="1.5" width="93" height="37" rx="9" fill="#2a0a10" stroke="url(#jpg)" stroke-width="3"/>
  ${[0, 1, 2].map((i) => `<rect x="${8 + i * 28}" y="7" width="24" height="26" rx="4" fill="url(#jpr)" stroke="#7a5214"/><text x="${20 + i * 28}" y="28.5" text-anchor="middle" font-family="Georgia,serif" font-weight="900" font-size="22" fill="#d4202a" stroke="#7a0d14" stroke-width=".8">7</text>`).join("")}
</svg>`;
const jackpotHtml = (n, cls = "") => `<div class="jackpot ${cls}" data-testid="jackpot"><i class="bulbs" aria-hidden="true"></i><div class="jp-txt"><span class="jp-t">JACKPOT</span><b class="jp-n" data-jp>${Number(n || 0).toLocaleString("ro-RO")}</b></div></div>`;
const LOGO = `<a class="logo" href="#/" aria-label="DYAS Poker"><img src="/logo.svg" alt=""><span class="wordmark">DYAS <span>POKER</span></span></a>`;
const WA_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.8-1.4.1-.2 0-.3 0-.5l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.7.5-.1 1.5-.6 1.8-1.2.2-.6.2-1.1.1-1.2l-.4-.2Z"/></svg>`;

{ const l = document.createElement("link"); l.rel = "stylesheet"; l.href = "/nav.css?v=8"; document.head.appendChild(l); }
{ const l = document.createElement("link"); l.rel = "stylesheet"; l.href = "/tables.css?v=1"; document.head.appendChild(l); }
/** Masa desenată în straturi (rama, piele, inserție, postav); tema schimbă doar materialele. */
const FELT = `<i class="r1"></i><i class="r2"></i><i class="st"></i><i class="cloth"><b>DYAS POKER</b></i><i class="deco t"></i><i class="deco b"></i>`;

let token = localStorage.getItem("dyas.token");
let me = null;
let emblems = [], avatars = [], reactions = [];
const avatarHtml = (u, cls = "") => `<span class="av ${cls}">${u?.avatar ? esc(u.avatar) : esc(String(u?.username ?? u?.name ?? "?")[0].toUpperCase())}</span>`;
const isMgr = (role) => ["owner", "admin", "superadmin"].includes(role);

// ---------- invitație /j/COD ----------
const inv = location.pathname.match(/^\/j\/([A-Za-z0-9]{6})$/);
if (inv) {
  sessionStorage.setItem("dyas.join", inv[1].toUpperCase());
  history.replaceState(null, "", "/#/join");
}

function toast(msg, ok = false) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className = "on" + (ok ? " ok" : "");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (t.className = ok ? "ok" : ""), 2600);
}

async function api(method, path, body) {
  const r = await fetch(path, { method, headers: { "content-type": "application/json", ...(token ? { authorization: "Bearer " + token } : {}) },
    body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && path !== "/api/login") { logout(true); throw new Error(j.message || "Conectează-te din nou."); }
  if (!r.ok) { const e = new Error(j.message || "Eroare"); e.code = j.error; throw e; }
  return j;
}

function logout(silent) {
  if (!silent && token) fetch("/api/logout", { method: "POST", headers: { authorization: "Bearer " + token } }).catch(() => {});
  token = null; me = null;
  localStorage.removeItem("dyas.token");
  unfollow();
  location.hash = "#/";
  render();
}

// ---------- actualizări în timp real ----------
// Serverul anunță pe canale Supabase Realtime că s-a schimbat ceva; clientul cere apoi starea lui (cu propriile cărți).
// Fără Realtime (sau dacă pică), aplicația reîmprospătează periodic.
let live = null; // { kind, id, onBump, channel, poll, timer }
let rtClient = null, rtConfig;
async function realtime() {
  if (rtConfig === undefined) {
    try { rtConfig = (await api("GET", "/api/config")).realtime; } catch { rtConfig = null; }
  }
  if (!rtConfig) return null;
  if (!rtClient) {
    try {
      await new Promise((ok, fail) => { const sc = document.createElement("script"); sc.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/dist/umd/supabase.js"; sc.onload = ok; sc.onerror = fail; document.head.appendChild(sc); });
      rtClient = window.supabase.createClient(rtConfig.url, rtConfig.key, { auth: { persistSession: false, autoRefreshToken: false } });
    } catch { rtConfig = null; return null; }
  }
  return rtClient;
}
let wsUp = true;
async function follow(kind, id, onBump) {
  if (live && live.kind === kind && live.id === id) return;
  unfollow();
  const me = (live = { kind, id, onBump, rt: false });
  const schedule = () => {
    clearTimeout(me.poll);
    if (live !== me) return;
    me.poll = setTimeout(async () => { if (live === me && !document.hidden) await onBump(); schedule(); }, me.rt ? 8000 : kind === "table" ? 1200 : 5000);
  };
  schedule();
  const sb = await realtime();
  if (!sb || live !== me) return;
  me.channel = sb.channel(`${kind}:${id}`).on("broadcast", { event: "bump" }, () => { if (!document.hidden) onBump(); })
    .subscribe((status) => { me.rt = status === "SUBSCRIBED"; schedule(); });
}
function unfollow() {
  if (!live) return;
  clearTimeout(live.poll); clearTimeout(live.timer);
  if (live.channel) rtClient?.removeChannel(live.channel);
  live = null;
}
document.addEventListener("visibilitychange", () => { if (!document.hidden && live) live.onBump(); });
function paintConn() {
  const c = document.querySelector(".conn");
  if (c) c.hidden = wsUp;
}

// ---------- bara de meniu de jos ----------
/** Bara fixă de jos: pe toate ecranele, mai puțin la masă (acolo e nevoie de tot ecranul) și înainte de conectare. */
function renderNav() {
  let nav = document.getElementById("tabbar");
  if (!token || !me || view.name === "table") {
    nav?.remove();
    document.body.classList.remove("has-tabbar", "admin-mode");
    return;
  }
  if (!nav) {
    nav = document.createElement("nav");
    nav.id = "tabbar";
    nav.setAttribute("aria-label", "Meniu");
    document.body.appendChild(nav);
  }
  document.body.classList.add("has-tabbar");
  nav.classList.remove("tuck");
  // modul admin: alte culori și alt meniu, doar cu secțiunile administratorului
  const adminMode = view.name === "admin" || view.name === "adminUser";
  document.body.classList.toggle("admin-mode", adminMode);
  const active = adminMode ? (view.name === "adminUser" ? "users" : view.tab) : { club: "home", adminUser: "admin", tourney: "home" }[view.name] ?? view.name;
  const items = adminMode ? [
    ["play", "#/", "🃏", "Joc", "switch"],
    ["overview", "#/admin/overview", "📊", "Rezumat"],
    ["live", "#/admin/live", "📺", "Live"],
    ["users", "#/admin/users", "👥", "Jucători"],
    ["ledger", "#/admin/ledger", "📒", "Jurnal"],
    ["alerts", "#/admin/alerts", "🚩", "Alerte"],
  ] : [
    ["home", "#/", "🏠", "Acasă"],
    ["tables", "#/tables", "♠️", "Mese"],
    ["play", playHref(), "🃏", "Joacă", "play"],
    ["activity", "#/activity", "📜", "Activitate"],
    ["profile", "#/profile", me.avatar ? esc(me.avatar) : `<i class="ini">${esc(me.username[0].toUpperCase())}</i>`, "Profil"],
  ];
  nav.innerHTML = items.map(([k, href, ic, label, cls = ""]) =>
    `<a href="${href}" class="${k === active ? "on" : ""} ${cls}" ${k === active ? 'aria-current="page"' : ""} data-testid="nav-${k}"><span class="ni">${ic}</span><span>${label}</span></a>`).join("");
  // apăsarea pe tabul curent reîncarcă ecranul (ex. lista de cluburi)
  nav.querySelectorAll("a").forEach((a) => (a.onclick = (e) => { if (a.classList.contains("on")) { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); render(); } }));
}

/** Butonul „Joacă”: înapoi la ultima masă, altfel la ultimul club. */
function playHref() {
  const t = localStorage.getItem("dyas.lastTable"), c = localStorage.getItem("dyas.lastClub");
  return t ? `#/table/${t}` : c ? `#/club/${c}` : "#/join";
}

// bara se ascunde când derulezi în jos și revine când derulezi în sus, ca să nu acopere conținutul
let lastScroll = 0;
window.addEventListener("scroll", () => {
  const nav = document.getElementById("tabbar"), y = window.scrollY;
  if (nav && Math.abs(y - lastScroll) > 8) nav.classList.toggle("tuck", y > lastScroll && y > 80);
  lastScroll = y;
}, { passive: true });

// ---------- router ----------
let view = { name: "home" };
function parse() {
  const p = location.hash.replace(/^#\/?/, "").split("/");
  if (!p[0]) return { name: "home" };
  if (p[0] === "create") return { name: "create" };
  if (p[0] === "tables") return { name: "tables" };
  if (p[0] === "activity") return { name: "activity" };
  if (p[0] === "join") return { name: "join" };
  if (p[0] === "club" && p[1]) return { name: "club", id: p[1], tab: p[2] || "tables" };
  if (p[0] === "table" && p[1]) return { name: "table", id: p[1] };
  if (p[0] === "tourney" && p[1]) return { name: "tourney", id: p[1] };
  if (p[0] === "profile") return { name: "profile" };
  if (p[0] === "admin") return p[1] === "user" && p[2] ? { name: "adminUser", id: p[2] } : { name: "admin", tab: p[1] || "overview" };
  return { name: "home" };
}
window.addEventListener("hashchange", render);
const go = (h) => { if (location.hash === h) render(); else location.hash = h; };

async function render() {
  view = parse();
  if (!token) return renderAuth();
  try {
    if (!me) { const r = await api("GET", "/api/me"); me = r.user; emblems = r.emblems; avatars = r.avatars; reactions = r.reactions; }
  } catch { return renderAuth(); }
  if (view.name !== "table" && view.name !== "club" && view.name !== "tourney") unfollow();
  stopAdmin();
  if (view.name !== "table") document.body.style.overflow = "";
  if (view.name !== "table" && view.name !== "club") closeChat();
  if (sessionStorage.getItem("dyas.join") && view.name !== "join") return go("#/join");
  if ((view.name === "admin" || view.name === "adminUser") && !me.isAdmin) return go("#/");
  renderNav();
  ({ home: renderHome, tables: renderAllTables, activity: renderActivity, create: renderCreate, join: renderJoin, club: renderClub, table: enterTable, profile: renderProfile, tourney: () => loadT().then((m) => m.renderLobby()),
    admin: () => loadAdmin().then((m) => m.renderAdmin()), adminUser: () => loadAdmin().then((m) => m.renderAdminUser()) })[view.name]();
}

// ---------- autentificare ----------
/** Prefixele de țară la contul nou (România prima). */
const COUNTRIES = [["🇷🇴", "40", "România"], ["🇲🇩", "373", "Moldova"], ["🇮🇹", "39", "Italia"], ["🇪🇸", "34", "Spania"], ["🇩🇪", "49", "Germania"], ["🇬🇧", "44", "Marea Britanie"],
  ["🇫🇷", "33", "Franța"], ["🇦🇹", "43", "Austria"], ["🇧🇪", "32", "Belgia"], ["🇳🇱", "31", "Olanda"], ["🇮🇪", "353", "Irlanda"], ["🇵🇹", "351", "Portugalia"],
  ["🇨🇭", "41", "Elveția"], ["🇩🇰", "45", "Danemarca"], ["🇸🇪", "46", "Suedia"], ["🇳🇴", "47", "Norvegia"], ["🇵🇱", "48", "Polonia"], ["🇨🇿", "420", "Cehia"],
  ["🇭🇺", "36", "Ungaria"], ["🇧🇬", "359", "Bulgaria"], ["🇬🇷", "30", "Grecia"], ["🇷🇸", "381", "Serbia"], ["🇺🇦", "380", "Ucraina"], ["🇹🇷", "90", "Turcia"],
  ["🇮🇱", "972", "Israel"], ["🇦🇪", "971", "Emiratele Arabe"], ["🇺🇸", "1", "SUA / Canada"]];
function renderAuth() {
  renderNav();
  let mode = sessionStorage.getItem("dyas.join") ? "register" : "login";
  const fan = ["As", "Kh", "Qd", "Jc", "Ts"].map((c) => cardHtml(c)).join("");
  const draw = () => {
    const inviteCode = sessionStorage.getItem("dyas.join");
    $app.innerHTML = `<div class="landing">
      <img class="hero-logo" src="/logo.svg" alt="">
      <div class="wordmark">DYAS <span>POKER</span></div>
      <p class="tagline">Masa ta. Prietenii tăi. Regulile voastre.</p>
      <div class="fan" aria-hidden="true">${fan}</div>
      ${inviteCode ? `<div class="card invite" style="text-align:left;margin-top:14px">🎟️ Ai fost invitat în clubul cu codul <b>${esc(inviteCode)}</b>. Fă-ți cont sau conectează-te ca să intri.</div>` : ""}
      <form class="card auth" id="f">
        <div class="tabs"><button type="button" data-m="login" class="${mode === "login" ? "on" : ""}">Conectare</button><button type="button" data-m="register" class="${mode === "register" ? "on" : ""}">Cont nou</button></div>
        <label for="u">Nume de jucător</label><input id="u" name="username" autocomplete="username" required minlength="3" maxlength="20" placeholder="ex. Nistor">
        ${mode === "register" ? `<label for="ph">Număr de telefon</label><div class="phone-row"><select name="cc" aria-label="Prefixul țării" data-testid="phone-cc">${COUNTRIES.map(([f, c, n]) => `<option value="${c}" ${c === "40" ? "selected" : ""}>${f} +${c}</option>`).join("")}</select>
          <input id="ph" name="phone" type="tel" inputmode="tel" autocomplete="tel-national" required minlength="6" maxlength="18" placeholder="712 345 678" data-testid="phone"></div>` : ""}
        <label for="p">Parolă</label><input id="p" name="password" type="password" autocomplete="${mode === "login" ? "current-password" : "new-password"}" required minlength="6" placeholder="minim 6 caractere">
        <div class="err" id="e"></div>
        <button class="btn primary block" style="margin-top:8px">${mode === "login" ? "Intră" : "Creează contul"}</button>
      </form>
      <div class="features">
        <div class="feature"><b>🏛️</b>Clubul tău privat</div>
        <div class="feature"><b>♠️</b>Până la 9 la masă</div>
        <div class="feature"><b>💬</b>Invită pe WhatsApp</div>
      </div>
      <p class="legal">Se joacă doar cu jetoane de joc, fără bani reali.</p>
    </div>`;
    $app.querySelectorAll("[data-m]").forEach((b) => (b.onclick = () => { mode = b.dataset.m; draw(); }));
    $app.querySelector("#f").onsubmit = async (e) => {
      e.preventDefault();
      const fd = Object.fromEntries(new FormData(e.target));
      try {
        const r = await api("POST", mode === "login" ? "/api/login" : "/api/register", fd);
        token = r.token; localStorage.setItem("dyas.token", token); me = null;
        render();
      } catch (err) { $app.querySelector("#e").textContent = err.message; }
    };
  };
  draw();
}

// ---------- acasă ----------
const avatarFr = (u, cls = "") => avatarHtml(u, `${cls} ${u?.frame ? "fr-" + u.frame : ""}`);
/** O masă din cluburile mele, cu cine stă la ea. */
function tableCard(t) {
  const names = t.players.slice(0, 3).map((p) => esc(p.name)).join(", ") + (t.players.length > 3 ? "…" : "");
  return `<a class="list-item tcard" href="#/table/${t.id}" data-testid="home-table">
    <div class="table-ic ${t.playing ? "on" : ""}">♠</div>
    <div class="grow"><div class="t">${t.locked ? "🔒 " : ""}${esc(t.name)} <span class="small muted">· ${fmt(t.sb)}/${fmt(t.bb)}</span></div>
      <div class="small muted">${esc(t.club.emblem)} ${esc(t.club.name)} · ${t.players.length}/${t.capacity}${names ? ` · ${names}` : ""}</div></div>
    ${t.playing ? `<span class="badge live">În joc</span>` : t.players.length < t.capacity ? `<span class="badge">Liber</span>` : `<span class="badge full">Plină</span>`}</a>`;
}
async function renderHome() {
  $app.innerHTML = `<div class="screen"><div class="appbar">${LOGO}</div><div class="empty">Se încarcă…</div></div>`;
  const [r, ann, hm] = await Promise.all([api("GET", "/api/me"), api("GET", "/api/announcements").catch(() => ({ items: [] })), api("GET", "/api/home").catch(() => null)]);
  if (view.name !== "home") return;
  const clubs = r.clubs;
  const H = hm || { tables: [], online: [], jackpots: [], week: { hands: 0, wins: 0, net: 0 } };
  const seen = Number(localStorage.getItem("dyas.ann") || 0);
  const news = ann.items.filter((a) => Number(a.id) > seen);
  const active = H.tables.filter((t) => t.players.length > 0).slice(0, 4);
  const jp = H.jackpots[0];
  const w = H.week;
  const sections = clubs.length ? `
    <h2><span class="arena-live-dot" aria-hidden="true"></span> Se joacă acum</h2>
    ${active.length ? active.map(tableCard).join("") : `<div class="card hs-empty">Nicio masă activă acum. <a href="#/tables">Vezi toate mesele →</a></div>`}
    ${jp ? `<a class="jp-link" href="#/club/${jp.id}" data-testid="home-jackpot">${jackpotHtml(jp.jackpot, "strip")}<span class="jp-club">${esc(jp.emblem)} ${esc(jp.name)}</span></a>` : ""}
    ${H.online.length ? `<h2>Prieteni online · ${H.online.length}</h2>
      <div class="friends" data-testid="home-online">${H.online.map((f) => `<button type="button" class="friend" data-fr="${f.userId}">
        <span class="fav">${avatarFr(f)}<i class="on"></i></span><b>${esc(f.username)}</b><small>${f.table ? "la masă" : "Hai la masă"}</small></button>`).join("")}</div>` : ""}
    <div id="htr"></div>
    <h2>Săptămâna ta</h2>
    <div class="stats" data-testid="home-week">
      <div><b class="${w.net >= 0 ? "pos" : "neg"}">${w.net > 0 ? "+" : ""}${fmt(w.net)}</b><small>câștig net</small></div>
      <div><b>${fmt(w.hands)}</b><small>mâini</small></div>
      <div><b>${fmt(w.wins)}</b><small>câștigate</small></div></div>
    <h2>Cluburile mele</h2>
    ${clubs.map((c) => `<a class="list-item" href="#/club/${c.id}">
        <div class="emblem">${esc(c.emblem)}</div>
        <div class="grow"><div class="t">${esc(c.name)}</div>
          <div class="small muted" style="margin-top:3px">${plural(c.members, "membru", "membri")} · ${plural(c.tables, "masă", "mese")}</div></div>
        <div class="chips">${fmt(c.balance)}</div></a>`).join("")}
    <div class="row hs-actions">${me.isAdmin ? `<a class="btn grow" href="#/create"><svg class="arena-control-icon" aria-hidden="true"><use href="/control-icons.svg#crown"></use></svg> Creează un club</a>` : ""}<a class="btn grow" href="#/join"><svg class="arena-control-icon" aria-hidden="true"><use href="/control-icons.svg#key"></use></svg> Intră cu un cod</a></div>`
  : `<div class="actions">
      ${me.isAdmin ? `<a class="tile gold" href="#/create"><span class="ic">👑</span><span><b>Creează un club</b><small>Devii proprietar</small></span></a>` : ""}
      <a class="tile ${me.isAdmin ? "" : "gold"}" href="#/join"><span class="ic">🔑</span><span><b>Intră într-un club</b><small>Cu codul primit</small></span></a>
    </div>
    <div class="empty"><b>🃏</b>Nu ești încă în niciun club.<br>${me.isAdmin ? "Creează unul sau intră cu un cod primit de la un prieten." : "Intră cu codul primit de la un prieten sau de la administrator."}</div>`;
  $app.innerHTML = `<div class="screen">
    <div class="appbar"><div class="grow">${LOGO}</div>${me.isAdmin ? `<a class="btn sm admin-btn" href="#/admin">Admin</a>` : ""}<a class="avatar" href="#/profile" title="Profilul tău" aria-label="Profilul tău">${me.avatar ? esc(me.avatar) : esc(me.username[0].toUpperCase())}</a></div>
    ${news.length ? `<div class="card install" data-testid="announcement"><span class="ic">📣</span><div class="grow"><b>${esc(news[0].title)}</b>
      ${news[0].body ? `<p style="margin:4px 0;white-space:pre-line">${esc(news[0].body)}</p>` : ""}<small>${news[0].club ? `${esc(news[0].club)} · ` : ""}${ago(news[0].created_at)}</small></div>
      <button class="x" data-ann="${news[0].id}" aria-label="Am văzut">×</button></div>` : ""}
    ${installBanner()}
    <h1>Salut, ${esc(me.username)}!</h1>
    <p class="sub">Unde jucăm azi?</p>
    ${sections}
  </div>`;
  bindInstall();
  const htr = $app.querySelector("#htr");
  if (htr) loadT().then((m) => m.homeInto(htr)).catch(() => {});
  $app.querySelector("[data-ann]")?.addEventListener("click", (e) => { localStorage.setItem("dyas.ann", e.currentTarget.dataset.ann); renderHome(); });
  $app.querySelectorAll("[data-fr]").forEach((b) => (b.onclick = async () => {
    const f = H.online.find((x) => x.userId === b.dataset.fr);
    if (f.table) return go(`#/table/${f.table.id}`);
    try {
      const x = await api("POST", `/api/clubs/${f.clubId}/invite`, { userId: f.userId });
      toast(x.sent ? `I-ai trimis lui ${f.username} „Hai la masă”.` : x.reason === "TOO_SOON" ? "L-ai chemat deja, mai așteaptă puțin." : `${f.username} nu are notificările pornite.`, !!x.sent);
    } catch (e) { toast(e.message); }
  }));
}

// ---------- toate mesele din cluburile mele ----------
async function renderAllTables() {
  $app.innerHTML = `<div class="screen"><div class="topbar"><h1 style="margin:0">♠️ Mese</h1></div><div class="empty">Se încarcă…</div></div>`;
  const H = await api("GET", "/api/home").catch((e) => { toast(e.message); return null; });
  if (!H || view.name !== "tables") return;
  $app.innerHTML = `<div class="screen">
    <div class="topbar"><h1 style="margin:0">♠️ Mese</h1></div>
    <p class="sub">Mesele din cluburile tale</p>
    ${H.tables.length ? '<div class="lobby-filter" aria-label="Filtrează mesele"><button type="button" data-filter="all" aria-pressed="true">Toate</button><button type="button" data-filter="available" aria-pressed="false">Cu locuri libere</button><button type="button" data-filter="playing" aria-pressed="false">În joc</button></div><p class="lobby-count" role="status"></p>' : ''}
    ${H.tables.length ? H.tables.map(tableCard).join("") : `<div class="empty"><b>♠</b>Nicio masă încă.<br>Proprietarul clubului poate crea mese din pagina clubului.</div>`}
  </div>`;
  const buttons = [...$app.querySelectorAll('[data-filter]')];
  const cards = [...$app.querySelectorAll('.tcard')];
  const count = $app.querySelector('.lobby-count');
  function filterTables(filter) {
    let visible = 0;
    cards.forEach((card, i) => {
      const table = H.tables[i];
      const show = filter === 'all' || (filter === 'playing' ? table.playing : table.players.length < table.capacity);
      card.hidden = !show;
      if (show) visible++;
    });
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.filter === filter)));
    if (count) count.textContent = visible ? (visible === 1 ? '1 masă' : visible + ' mese') : 'Nicio masă pentru acest filtru.';
  }
  buttons.forEach(button => button.addEventListener('click', () => filterTables(button.dataset.filter)));
  filterTables('all');
}

// ---------- activitate: mâinile mele din toate cluburile și realizările ----------
async function renderActivity() {
  $app.innerHTML = `<div class="screen"><div class="topbar"><h1 style="margin:0">📜 Activitate</h1></div><div class="empty">Se încarcă…</div></div>`;
  const r = await api("GET", "/api/me").catch(() => ({ clubs: [] }));
  const lists = await Promise.all(r.clubs.map((c) => api("GET", `/api/clubs/${c.id}/history`).then((x) => x.hands.map((h) => ({ ...h, club: c.name }))).catch(() => [])));
  if (view.name !== "activity") return;
  const hands = lists.flat().sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 40);
  $app.innerHTML = `<div class="screen">
    <div class="topbar"><h1 style="margin:0">📜 Activitate</h1></div>
    <h2><svg class="arena-control-icon" aria-hidden="true"><use href="/control-icons.svg#trophy"></use></svg> Realizări</h2>
    <div id="ach"><div class="empty">Se încarcă…</div></div>
    <h2>Ultimele mâini</h2>
    <div data-testid="activity-hands">${hands.length ? hands.map(handCard).join("") : `<div class="empty"><b>🃏</b>Încă nu ai jucat nicio mână.</div>`}</div>
  </div>`;
  more.achievementsInto($app.querySelector("#ach"));
}

// ---------- creare club ----------
function renderCreate() {
  if (!me.isAdmin) { toast("Doar administratorii pot crea cluburi."); return go("#/join"); }
  let emblem = emblems[0];
  $app.innerHTML = `<div class="screen">
    <div class="topbar"><a class="back" href="#/">←</a><h1 style="margin:0">Creează un club</h1></div>
    <form class="card" id="f">
      <label for="n">Numele clubului</label><input id="n" name="name" required minlength="2" maxlength="40" placeholder="ex. Clubul lui Nistor">
      <label>Emblema</label><div class="emblems">${emblems.map((e, i) => `<button type="button" data-e="${esc(e)}" class="${i ? "" : "on"}" aria-label="Emblema ${esc(e)}">${esc(e)}</button>`).join("")}</div>
      <label for="d">Descriere <span class="muted">(opțional)</span></label><textarea id="d" name="description" maxlength="280" placeholder="ex. Joi seara, blinduri mici, între prieteni"></textarea>
      <p class="small muted">Devii automat proprietarul clubului. Primești un cod și un link de invitație pe care le poți trimite pe WhatsApp.</p>
      <div class="err" id="e"></div>
      <button class="btn primary block">Creează clubul</button>
    </form></div>`;
  $app.querySelectorAll("[data-e]").forEach((b) => (b.onclick = () => {
    emblem = b.dataset.e; $app.querySelectorAll("[data-e]").forEach((x) => x.classList.toggle("on", x === b));
  }));
  $app.querySelector("#f").onsubmit = async (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target));
    try {
      const r = await api("POST", "/api/clubs", { ...fd, emblem });
      toast("Clubul a fost creat.", true);
      go(`#/club/${r.club.id}`);
    } catch (err) { $app.querySelector("#e").textContent = err.message; }
  };
}

// ---------- intrare în club ----------
function renderJoin() {
  const pre = sessionStorage.getItem("dyas.join") || "";
  $app.innerHTML = `<div class="screen">
    <div class="topbar"><a class="back" href="#/">←</a><h1 style="margin:0">Intră într-un club</h1></div>
    <form class="card" id="f">
      <label for="c">Codul clubului</label>
      <input id="c" name="code" class="code-input" maxlength="6" required autocomplete="off" autocapitalize="characters" value="${esc(pre)}" placeholder="ABC123">
      <p class="small muted">Codul are 6 caractere. Îl primești de la cineva din club, sau deschizi direct linkul de invitație.</p>
      <div class="err" id="e"></div>
      <button class="btn primary block">Intră în club</button>
    </form></div>`;
  const f = $app.querySelector("#f");
  f.onsubmit = async (e) => {
    e.preventDefault();
    try {
      const r = await api("POST", "/api/clubs/join", { code: f.code.value });
      sessionStorage.removeItem("dyas.join");
      toast("Ai intrat în club.", true);
      go(`#/club/${r.clubId}`);
    } catch (err) { $app.querySelector("#e").textContent = err.message; sessionStorage.removeItem("dyas.join"); }
  };
  if (pre) f.requestSubmit();
}

// ---------- club ----------
const C = { data: null, tab: "tables" };
async function renderClub() {
  C.tab = view.tab;
  if (!C.data || C.data.club.id !== view.id) {
    C.data = null;
    $app.innerHTML = `<div class="screen"><div class="empty">Se încarcă…</div></div>`;
  }
  try { C.data = await api("GET", `/api/clubs/${view.id}`); } catch (e) { toast(e.message); return go("#/"); }
  const clubId = view.id;
  try { localStorage.setItem("dyas.lastClub", clubId); } catch {}
  follow("club", clubId, async () => {
    try {
      const d = await api("GET", `/api/clubs/${clubId}`);
      if (view.name === "club" && view.id === clubId && C.data) {
        C.data.tables = d.tables; C.data.online = d.online;
        if (C.tab === "tables" && !document.querySelector("#tab form")) paintTables();
        paintOnline();
        syncClubChat(d, clubId);
        paintJackpot(clubId);
      }
    } catch { /* ignoră */ }
  });
  const d = C.data, mgr = isMgr(d.me.role);
  const link = `${location.origin}/j/${d.club.code}`;
  const wa = `https://wa.me/?text=${encodeURIComponent(`Hai la poker în clubul meu „${d.club.name}” pe DYAS Poker 🃏\nIntră cu linkul: ${link}\nsau cu codul: ${d.club.code}`)}`;
  $app.innerHTML = `<div class="screen">
    <div class="topbar"><a class="back" href="#/" aria-label="Înapoi">←</a><div class="grow">${LOGO}</div></div>
    <div class="club-hero">
      <div class="emblem lg">${esc(d.club.emblem)}</div>
      <div class="grow"><div class="name">${esc(d.club.name)}</div>
        ${d.club.description ? `<div class="desc">${esc(d.club.description)}</div>` : ""}
        <div class="meta">${d.me.member ? `<span class="muted">Soldul tău</span><span class="chips" data-testid="balance">${fmt(d.me.balance)}</span>` : `<span class="muted">Ai acces ca administrator</span>`}</div>
        ${d.me.member && d.me.balance < 1 ? `<div class="small muted" style="margin-top:6px">Jetoanele le primești de la administratorul aplicației.</div>` : ""}</div>
    </div>
    <div class="card invite">
      <div class="lbl">Invită prieteni · codul clubului</div>
      <div class="code" data-testid="club-code">${esc(d.club.code)}</div>
      <div class="btns">
        <a class="btn wa" href="${wa}" target="_blank" rel="noopener">${WA_ICON}Trimite pe WhatsApp</a>
        <button class="btn" id="cp" aria-label="Copiază linkul"><svg class="arena-control-icon" aria-hidden="true"><use href="/control-icons.svg#copy"></use></svg> Copiază</button></div>
    </div>
    <div id="jpc">${jackpotHtml(C.jackpot ?? 0, "big")}</div>
    <button type="button" class="btn block club-chat" id="cchat" data-testid="club-chat-btn"><svg class="arena-control-icon" aria-hidden="true"><use href="/control-icons.svg#chat"></use></svg> Chatul clubului<b class="unread" data-testid="chat-badge" hidden></b></button>
    <div id="onl"></div>
    <div class="tabs">
      ${[["tables", "Mese"], ["tourneys", "🏆 Turnee"], ["top", "Clasament"], ["history", "Istoric"], ...(mgr ? [["members", "Membri"]] : [])]
        .map(([k, n]) => `<button data-tab="${k}" class="${C.tab === k ? "on" : ""}">${n}</button>`).join("")}
    </div>
    <div id="tab"></div></div>`;
  $app.querySelector("#cp").onclick = async () => {
    try { await navigator.clipboard.writeText(link); toast("Link copiat.", true); } catch { prompt("Copiază linkul:", link); }
  };
  $app.querySelectorAll("[data-tab]").forEach((b) => (b.onclick = () => go(`#/club/${d.club.id}/${b.dataset.tab}`)));
  $app.querySelector("#cchat").onclick = () => loadChat().then((m) => { m.sync({ kind: "club", id: clubId }, d.chatLast ?? 0, d.chatDel ?? 0); m.open(); }).catch(() => toast("Chatul nu s-a putut deschide."));
  paintOnline();
  syncClubChat(d, clubId);
  paintJackpot(clubId);
  if (C.tab === "members" && mgr) paintMembers();
  else if (C.tab === "top") paintLeaderboard("week");
  else if (C.tab === "history") paintHistory();
  else if (C.tab === "tourneys") loadT().then((m) => m.clubTab(document.getElementById("tab"), clubId));
  else paintTables();
}

/** Intrarea mesei: o sumă fixă sau un interval (minim–maxim). */
const buyInText = (t) => (t.buyInMin != null && t.buyInMin < t.buyIn ? `${fmt(t.buyInMin)}–${fmt(t.buyIn)}` : fmt(t.buyIn));
function tableLine(t) {
  return `${t.locked ? `<span class="lock" title="Masă privată" data-testid="lock">🔒</span> ` : ""}${esc(t.name)} · ${fmt(t.sb)}/${fmt(t.bb)} · ${t.occupied}/${t.capacity} locuri`;
}
/** Cine e online acum în club (cu „Hai la masă”). */
function paintOnline() {
  const el = document.getElementById("onl");
  if (!el || !C.data) return;
  el.innerHTML = more.onlineHtml(C.data.online, me.id);
  more.bindOnline(el, C.data.club.id, C.data.online, me.id);
}
/** Jackpotul clubului (jumătate din comision), mereu la vedere. */
async function paintJackpot(clubId) {
  try {
    const { jackpot } = await api("GET", `/api/clubs/${clubId}/jackpot`);
    C.jackpot = jackpot;
    const n = document.querySelector("#jpc [data-jp]");
    if (n && view.name === "club" && view.id === clubId) n.textContent = fmt(jackpot);
  } catch { /* ignoră */ }
}
function syncClubChat(d, clubId) {
  if (d.chatLast == null) return;
  loadChat().then((m) => m.sync({ kind: "club", id: clubId }, d.chatLast, d.chatDel || 0)).catch(() => {});
}

function paintTables() {
  const d = C.data, mgr = isMgr(d.me.role);
  const el = document.getElementById("tab");
  if (!el) return;
  el.innerHTML = `${mgr ? `<button class="btn primary block" id="nt" style="margin-bottom:12px"><svg class="arena-control-icon" aria-hidden="true"><use href="/control-icons.svg#plus"></use></svg> Masă nouă</button><div id="ntf"></div>` : ""}
    ${d.tables.length ? d.tables.map((t) => `<div class="list-item" data-t="${t.id}" data-testid="table-row">
        <div class="table-ic">♠</div>
        <div class="grow"><div class="t wrap" data-testid="table-line">${tableLine(t)}</div>
          <div class="seatdots" aria-hidden="true">${Array.from({ length: t.capacity }, (_, i) => `<i class="${i < t.occupied ? "on" : ""}"></i>`).join("")}</div>
          <div class="small muted" style="margin-top:4px">${t.full ? `<span class="badge full">Masă plină</span>` : `<span class="badge">${t.capacity - t.occupied} libere</span>`}
            · intrare ${buyInText(t)}${t.playing ? ` · <span class="badge live">În joc</span>` : ""}</div></div>
        ${mgr ? `<button class="btn sm" data-edit="${t.id}" aria-label="Setări masă">⚙</button>` : ""}
      </div><div data-ef="${t.id}"></div>`).join("")
    : `<div class="empty"><b>♠</b>Nicio masă încă.${mgr ? " Creează prima masă." : " Proprietarul clubului poate crea mese."}</div>`}`;
  el.querySelectorAll("[data-t]").forEach((x) => (x.onclick = (e) => { if (!e.target.closest("[data-edit]")) go(`#/table/${x.dataset.t}`); }));
  if (mgr) {
    el.querySelector("#nt").onclick = () => tableForm(el.querySelector("#ntf"), null);
    el.querySelectorAll("[data-edit]").forEach((b) => (b.onclick = () => {
      const t = d.tables.find((x) => x.id === b.dataset.edit);
      tableForm(el.querySelector(`[data-ef="${t.id}"]`), t);
    }));
  }
}

function tableForm(host, t) {
  if (host.innerHTML) { host.innerHTML = ""; return; }
  let cap = t ? t.capacity : 9;
  const v = t || { name: `Masa lui ${me.username}`, sb: 25, bb: 50, buyInMin: 1000, buyIn: 5000 };
  host.innerHTML = `<form class="card" id="tf">
    <label>Numele mesei</label><input name="name" required minlength="2" maxlength="40" value="${esc(v.name)}">
    ${t ? `<p class="small muted">Capacitate: ${t.capacity} locuri. Blindurile noi se aplică de la mâna următoare.</p>` : `
    <label>Locuri la masă</label>
    <div class="seg" id="cap">${[2, 6, 9].map((n) => `<button type="button" data-c="${n}" class="${n === cap ? "on" : ""}">${n} locuri</button>`).join("")}</div>
    <div class="stepper"><button type="button" data-s="-1" aria-label="Mai puține locuri">−</button><output id="capv" data-testid="capacity">${cap} locuri</output><button type="button" data-s="1" aria-label="Mai multe locuri">+</button></div>`}
    <div class="grid3">
      <div><label>Small blind</label><input name="sb" type="number" inputmode="numeric" min="1" required value="${v.sb}"></div>
      <div><label>Big blind</label><input name="bb" type="number" inputmode="numeric" min="1" required value="${v.bb}"></div>
    </div>
    <label>Intrare la masă <span class="muted">(jucătorul alege suma în interval)</span></label>
    <div class="grid2 buyin-range">
      <div><label class="small muted">Minim</label><input name="buyInMin" type="number" inputmode="numeric" min="100" max="200000" step="1" required value="${v.buyInMin ?? v.buyIn}" data-testid="buyin-min"></div>
      <div><label class="small muted">Maxim</label><input name="buyIn" type="number" inputmode="numeric" min="100" max="200000" step="1" required value="${v.buyIn}" data-testid="buyin-max"></div>
    </div>
    <p class="small muted" style="margin:4px 0 0">Între 100 și 200.000 de jetoane. Pune aceeași sumă la minim și maxim pentru o intrare fixă.</p>
    <label>🔒 Parolă ${t ? (t.locked ? "nouă <span class=\"muted\">(gol = rămâne aceeași)</span>" : "<span class=\"muted\">(opțional: masă privată)</span>") : "<span class=\"muted\">(opțional: masă privată)</span>"}</label>
    <input name="password" type="text" autocomplete="off" maxlength="30" placeholder="fără parolă = masă deschisă tuturor" data-testid="table-pass">
    ${t?.locked ? `<label class="pwrow"><input type="checkbox" name="unlock"> Fă masa publică (fără parolă)</label>` : ""}
    <div class="err" id="te"></div>
    <div class="row" style="margin-top:10px">${t ? `<button type="button" class="btn danger" id="del">Închide masa</button>` : ""}<button class="btn primary grow">${t ? "Salvează" : "Creează masa"}</button></div>
  </form>`;
  const paintCap = () => {
    host.querySelector("#capv").textContent = `${cap} locuri`;
    host.querySelectorAll("[data-c]").forEach((b) => b.classList.toggle("on", Number(b.dataset.c) === cap));
  };
  host.querySelectorAll("[data-c]").forEach((b) => (b.onclick = () => { cap = Number(b.dataset.c); paintCap(); }));
  host.querySelectorAll("[data-s]").forEach((b) => (b.onclick = () => { cap = Math.max(2, Math.min(9, cap + Number(b.dataset.s))); paintCap(); }));
  const f = host.querySelector("#tf");
  f.sb.oninput = () => { f.bb.value = Number(f.sb.value) * 2 || ""; };
  f.onsubmit = async (e) => {
    e.preventDefault();
    const body = { name: f.name.value, sb: Number(f.sb.value), bb: Number(f.bb.value), buyInMin: Number(f.buyInMin.value), buyIn: Number(f.buyIn.value), capacity: cap };
    if (body.buyInMin > body.buyIn) { host.querySelector("#te").textContent = "Intrarea minimă nu poate fi mai mare decât cea maximă."; return; }
    if (f.unlock?.checked) body.password = "";
    else if (f.password.value.trim()) body.password = f.password.value.trim();
    try {
      if (t) { await api("PATCH", `/api/tables/${t.id}`, body); toast("Salvat. Se aplică de la mâna următoare.", true); }
      else { await api("POST", `/api/clubs/${C.data.club.id}/tables`, body); toast("Masa a fost creată.", true); }
      renderClub();
    } catch (err) { host.querySelector("#te").textContent = err.message; }
  };
  host.querySelector("#del")?.addEventListener("click", async () => {
    if (!confirm("Închizi masa? Toți jucătorii trebuie să se fi ridicat.")) return;
    try { await api("DELETE", `/api/tables/${t.id}`); renderClub(); } catch (err) { host.querySelector("#te").textContent = err.message; }
  });
}

function paintMembers() {
  const d = C.data, owner = d.me.role === "owner" || d.me.role === "superadmin", sa = me.isAdmin;
  const el = document.getElementById("tab");
  el.innerHTML = d.members.map((m) => `<div class="list-item">
      ${avatarHtml(m)}
      <div class="grow"><div class="t">${esc(m.username)}${m.user_id === me.id ? " (tu)" : ""}</div>
        <div class="small"><span class="badge ${m.role}">${ROLE[m.role]}</span>${m.seated ? ` · <span class="badge live">la masă</span>` : ""}</div></div>
      <div class="chips" data-testid="member-balance">${fmt(m.balance)}</div>
      ${m.user_id !== me.id ? `<button type="button" class="btn sm mm-call" data-call="${m.user_id}" data-name="${esc(m.username)}" aria-label="Cheamă-l pe ${esc(m.username)} la masă" title="Hai la masă" data-testid="member-call">🃏</button>` : ""}
      ${sa || (m.role !== "owner" && (owner || m.role === "member")) ? `<button class="btn sm" data-mm="${m.user_id}" aria-label="Opțiuni membru">⋯</button>` : ""}
    </div><div data-mf="${m.user_id}"></div>`).join("");
  el.querySelectorAll("[data-call]").forEach((b) => (b.onclick = async () => {
    b.disabled = true;
    const myTable = d.online?.find((x) => x.userId === me.id)?.table?.id;
    try {
      const r = await api("POST", `/api/clubs/${d.club.id}/invite`, { userId: b.dataset.call, tableId: myTable });
      const n = b.dataset.name;
      toast(r.sent ? `I-ai trimis lui ${n} „Hai la masă”.` : r.reason === "TOO_SOON" ? `L-ai chemat deja pe ${n}. Mai așteaptă puțin.` : `${n} nu are notificările pornite.`, !!r.sent);
      if (r.sent) b.classList.add("sent");
    } catch (e) { toast(e.message); }
    setTimeout(() => (b.disabled = false), 2000);
  }));
  el.querySelectorAll("[data-mm]").forEach((b) => (b.onclick = () => {
    const m = d.members.find((x) => x.user_id === b.dataset.mm);
    const host = el.querySelector(`[data-mf="${m.user_id}"]`);
    if (host.innerHTML) { host.innerHTML = ""; return; }
    host.innerHTML = `<div class="card">
      ${sa ? chipAdjustHtml() : ""}
      ${m.role !== "owner" ? `<div class="row" style="flex-wrap:wrap;margin-top:${sa ? 10 : 0}px">
        ${owner ? `<button class="btn sm" data-role="${m.role === "admin" ? "member" : "admin"}">${m.role === "admin" ? "Fă-l membru" : "Fă-l admin"}</button>` : ""}
        <button class="btn sm danger" data-kick>Scoate din club</button></div>` : ""}</div>`;
    if (sa) bindChipAdjust(host, d.club.id, m.user_id, m.username, () => renderClub());
    host.querySelector("[data-role]")?.addEventListener("click", async (e) => {
      try { await api("PATCH", `/api/clubs/${d.club.id}/members/${m.user_id}`, { role: e.target.dataset.role }); renderClub(); } catch (err) { toast(err.message); }
    });
    host.querySelector("[data-kick]")?.addEventListener("click", async () => {
      if (!confirm(`Scoți pe ${m.username} din club? Soldul lui din acest club se pierde.`)) return;
      try { await api("DELETE", `/api/clubs/${d.club.id}/members/${m.user_id}`); renderClub(); } catch (err) { toast(err.message); }
    });
  }));
}

/** Formular de administrator: dă sau retrage jetoane din soldul unui membru. */
function chipAdjustHtml() {
  return `<form class="chipadj" data-testid="chip-adjust">
    <div class="small muted" style="margin-bottom:6px">Jetoane (doar administratorul)</div>
    <div class="seg">${[1000, 5000, 10000, 50000].map((a) => `<button type="button" data-q="${a}">+${fmt(a)}</button>`).join("")}</div>
    <div class="row" style="margin-top:8px"><input name="amount" type="number" inputmode="numeric" min="1" placeholder="Sumă" class="grow" aria-label="Suma">
      <button type="button" class="btn sm danger" data-take>− Retrage</button><button class="btn sm green" data-give><svg class="arena-control-icon" aria-hidden="true"><use href="/control-icons.svg#plus"></use></svg> Dă</button></div>
    <input name="note" maxlength="140" placeholder="Motiv (opțional)" style="margin-top:8px" aria-label="Motiv"></form>`;
}
function bindChipAdjust(host, clubId, userId, name, done) {
  const f = host.querySelector(".chipadj");
  f.querySelectorAll("[data-q]").forEach((b) => (b.onclick = () => { f.amount.value = b.dataset.q; }));
  const send = async (sign) => {
    const n = Math.floor(Number(f.amount.value));
    if (!n || n < 1) return toast("Scrie suma.");
    if (sign < 0 && !confirm(`Retragi ${fmt(n)} jetoane de la ${name}?`)) return;
    try {
      const r = await api("POST", "/api/admin/chips", { clubId, userId, delta: sign * n, note: f.note.value });
      toast(`${sign > 0 ? "Ai dat" : "Ai retras"} ${fmt(n)} jetoane. Sold nou: ${fmt(r.balance)}.`, true);
      done?.();
    } catch (e) { toast(e.message); }
  };
  f.onsubmit = (e) => { e.preventDefault(); send(1); };
  f.querySelector("[data-take]").onclick = () => send(-1);
}

async function paintLeaderboard(period) {
  const el = document.getElementById("tab");
  const clubId = C.data.club.id;
  el.innerHTML = `<div class="seg" id="per">${[["week", "Săptămâna"], ["month", "Luna"], ["all", "Tot timpul"]].map(([k, n]) => `<button data-p="${k}" class="${k === period ? "on" : ""}">${n}</button>`).join("")}</div><div id="lb" class="empty">Se încarcă…</div>`;
  el.querySelectorAll("[data-p]").forEach((b) => (b.onclick = () => paintLeaderboard(b.dataset.p)));
  let r;
  try { r = await api("GET", `/api/clubs/${clubId}/leaderboard?period=${period}`); } catch (e) { return toast(e.message); }
  const lb = document.getElementById("lb");
  if (!lb) return;
  lb.className = "";
  lb.innerHTML = r.rows.length ? r.rows.map((x, i) => `<div class="list-item lb-row ${x.userId === me.id ? "mine" : ""}" data-testid="lb-row">
      <div class="rank r${i + 1}">${i < 3 ? ["🥇", "🥈", "🥉"][i] : i + 1}</div>${avatarHtml(x)}
      <div class="grow"><div class="t">${esc(x.username)}${x.userId === me.id ? " (tu)" : ""}</div>
        <div class="small muted">${plural(x.hands, "mână", "mâini")} · ${x.wins} câștigate${x.hands ? ` (${Math.round((x.wins / x.hands) * 100)}%)` : ""}</div></div>
      <div class="net ${x.net >= 0 ? "pos" : "neg"}">${x.net > 0 ? "+" : ""}${fmt(x.net)}</div></div>`).join("")
    : `<div class="empty"><b>🏆</b>Nicio mână jucată în această perioadă.</div>`;
}

async function paintHistory() {
  const el = document.getElementById("tab");
  el.innerHTML = `<div class="empty">Se încarcă…</div>`;
  let r;
  try { r = await api("GET", `/api/clubs/${C.data.club.id}/history`); } catch (e) { return toast(e.message); }
  const s = r.stats;
  el.innerHTML = `<div class="stats" data-testid="my-stats">
      <div><b>${fmt(s.hands)}</b><small>mâini</small></div>
      <div><b>${s.hands ? Math.round((s.wins / s.hands) * 100) : 0}%</b><small>câștigate</small></div>
      <div><b class="${s.net >= 0 ? "pos" : "neg"}">${s.net > 0 ? "+" : ""}${fmt(s.net)}</b><small>câștig net</small></div>
      <div><b>${fmt(s.best)}</b><small>cel mai mare pot</small></div></div>
    ${r.hands.length ? r.hands.map((h) => handCard({ ...h, club: null })).join("") : `<div class="empty"><b>🃏</b>Încă nu ai jucat nicio mână în acest club.</div>`}`;
}

const HANDS = new Map();
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-replay]");
  if (b) more.replay(HANDS.get(Number(b.dataset.replay)));
});
function handCard(h) {
  HANDS.set(Number(h.id), h);
  const when = new Date(h.at).toLocaleString("ro-RO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  return `<div class="card hand-card" data-testid="hand-row">
    <div class="row"><div class="grow"><b>${esc(h.table)}</b> <span class="muted small">· mâna #${h.handNo}${h.club ? ` · ${esc(h.club)}` : ""}</span></div><span class="small muted">${when}</span></div>
    <div class="row hc-cards">${h.me ? `<div class="mini">${h.me.cards.map((c) => cardHtml(c, "xs")).join("")}</div>` : ""}
      <div class="mini board-mini">${h.board.map((c) => cardHtml(c, "xs")).join("") || `<span class="small muted">fără flop</span>`}</div>
      ${h.me ? `<div class="net ${h.me.net >= 0 ? "pos" : "neg"}">${h.me.net > 0 ? "+" : ""}${fmt(h.me.net)}</div>` : `<div class="small muted">pot ${fmt(h.pot)}</div>`}</div>
    <div class="small muted">${h.winners.map((w) => `🏆 ${esc(w.name)} +${fmt(w.amount)}${w.hand ? ` · ${esc(w.hand)}` : ""}`).join(" · ")}</div>
    ${h.players && !h.me ? `<div class="small" style="margin-top:6px">${h.players.map((p) => `${esc(p.name)} ${p.cards.length ? `<span class="mini">${p.cards.map((c) => cardHtml(c, "xs")).join("")}</span>` : ""} <span class="${p.net >= 0 ? "pos" : "neg"}">${p.net > 0 ? "+" : ""}${fmt(p.net)}</span>`).join(" · ")}</div>` : ""}
    ${h.replay?.log?.length ? `<button type="button" class="btn sm replay-btn" data-replay="${h.id}" data-testid="replay-btn">▶ Reluare pas cu pas</button>` : ""}
  </div>`;
}

// ---------- turnee (public/tourney.js, încărcat la nevoie) ----------
let tMod = null;
const loadT = () => (tMod ||= import("/tourney.js?v=1"));
const mmss = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
setInterval(() => document.querySelectorAll(".table-screen [data-countdown]").forEach((el) => { el.textContent = mmss(Number(el.dataset.countdown) - (Date.now() - T.skew)); }), 1000);

// ---------- chatul de la masă (public/chat.js, încărcat la intrarea la masă) ----------
let chatMod = null;
const loadChat = () => (chatMod ||= import("/chat.js?v=2"));
const CH = { unread: 0 };
function syncChat(st) {
  if (st?.chatLast == null) return;
  loadChat().then((m) => m.sync({ kind: "table", id: st.table.id }, st.chatLast, st.chatDel || 0)).catch(() => {});
}
function setChatBadge(n) {
  CH.unread = n;
  const b = document.querySelector("[data-testid=chat-badge]");
  if (b) { b.hidden = !n; b.textContent = n > 9 ? "9+" : String(n); }
}
function closeChat() { chatMod?.then((m) => m.close()).catch(() => {}); }

// ---------- masa ----------
const T = { state: null, raiseOpen: false, raiseTo: 0, skew: 0, tray: false, anim: { board: {}, bets: {} } };
window.__dyas = T; // folosit de testele end-to-end

// Pozițiile celorlalți jucători pe conturul mesei, pornind din stânga jos, în sensul acelor de ceasornic.
const LAYOUT = {
  1: [[50, 9]],
  2: [[17, 22], [83, 22]],
  3: [[11, 45], [50, 9], [89, 45]],
  4: [[11, 62], [24, 13], [76, 13], [89, 62]],
  5: [[11, 68], [10, 32], [50, 9], [90, 32], [89, 68]],
  6: [[12, 76], [10, 42], [30, 10], [70, 10], [90, 42], [88, 76]],
  7: [[13, 79], [10, 50], [17, 19], [50, 8], [83, 19], [90, 50], [87, 79]],
  8: [[14, 80], [10, 56], [10, 31], [30, 9], [70, 9], [90, 31], [90, 56], [86, 80]],
};
const CENTER = [50, 47];
const SELF_POS = [50, 90];

async function enterTable() {
  T.state = null; T.raiseOpen = false;
  $app.innerHTML = `<div class="table-screen"><div class="tbar"><a class="back" href="#/">←</a><div class="ti">Se încarcă masa…</div></div></div>`;
  T.anim = { board: {}, bets: {} };
  try { T.state = await api("GET", `/api/tables/${view.id}`); T.skew = Date.now() - T.state.serverTime; }
  catch (e) {
    if (e.code === "LOCKED") { const id = view.id; return more.lockedScreen($app, id, C.data?.tables?.some((t) => t.id === id) ? C.data.club.id : null, () => { if (view.name === "table" && view.id === id) enterTable(); }); }
    if (e.code === "TABLE_NOT_FOUND" || e.code === "NOT_MEMBER") localStorage.removeItem("dyas.lastTable");
    toast(e.message); return go("#/");
  }
  const tableId = view.id;
  try { localStorage.setItem("dyas.lastTable", tableId); localStorage.setItem("dyas.lastClub", T.state.table.clubId); } catch {}
  if (T.state.tourney) loadT().catch(() => {});
  followMove(T.state);
  follow("table", tableId, () => refreshTable(tableId));
  CH.unread = 0;
  renderTable();
  syncChat(T.state);
}

let fetching = null;
async function refreshTable(tableId) {
  if (fetching) return fetching;
  fetching = (async () => {
    try { applyState(await api("GET", `/api/tables/${tableId}`)); wsUp = true; }
    catch (e) {
      wsUp = false; paintConn();
      if (e.code === "TABLE_NOT_FOUND" && T.state?.tourney) { localStorage.removeItem("dyas.lastTable"); toast("Masa s-a închis. Vezi turneul."); return go(`#/tourney/${T.state.tourney.id}`); }
      if (e.code === "TABLE_NOT_FOUND" || e.code === "NOT_MEMBER") { toast(e.message); go("#/"); }
    }
    finally { fetching = null; }
  })();
  return fetching;
}
function applyState(st) {
  if (!st || view.name !== "table" || st.table.id !== view.id) return;
  if (T.state && st.rev < T.state.rev) return; // un răspuns mai vechi
  if (T.state && st.rev === T.state.rev && document.activeElement?.id === "rn") return; // scrii suma: nu te întrerupem
  if (!st.reactions && T.state) st.reactions = T.state.reactions;
  if (st.canSit === undefined && T.state) { st.canSit = T.state.canSit; st.viewerRole = T.state.viewerRole; }
  if (st.chatLast === undefined && T.state) st.chatLast = T.state.chatLast;
  if (st.chatDel === undefined && T.state) st.chatDel = T.state.chatDel;
  if (st.chatLast !== T.state?.chatLast || (st.chatDel ?? 0) !== (T.state?.chatDel ?? 0)) syncChat(st);
  notePause(T.state, st);
  noteAchievements(st);
  trackAnims(T.state, st);
  window.dispatchEvent(new CustomEvent("arena-table-state", {detail:st}));
  T.state = st; T.skew = Date.now() - st.serverTime;
  renderTable();
  autoPre(st);
  followMove(st);
}
/** Turneu: dacă ai fost mutat la altă masă (echilibrare), te ducem acolo. */
async function followMove(st) {
  if (!st.tourney || st.tme?.status !== "playing" || st.mySeat != null || Date.now() - (T.moveAt || 0) < 2500) return;
  T.moveAt = Date.now();
  const l = await api("GET", `/api/tourneys/${st.tourney.id}`).catch(() => null);
  if (l?.me?.tableId && l.me.tableId !== view.id && view.name === "table") { toast("Ai fost mutat la altă masă a turneului.", true); go(`#/table/${l.me.tableId}`); }
}
/** Acțiunea aleasă dinainte se face singură când îți vine rândul (Fold nu aruncă mâna dacă poți da check gratis). */
function autoPre(st) {
  if (!T.pre || !myTurnIn(st) || !st.hand.legal || acting) return;
  const L = st.hand.legal, p = T.pre;
  T.pre = null;
  const action = p === "callany" ? (L.canCheck ? "check" : "call") : L.canCheck ? "check" : "fold";
  setTimeout(() => { if (myTurnIn(T.state)) act({ action }); }, 150);
}
/** Cronometrele (rândul expiră, mâna următoare) le declanșează primul client care întreabă după termen. */
function scheduleWake() {
  if (!live || live.kind !== "table") return;
  clearTimeout(live.timer);
  const s = T.state;
  const at = [s.turnDeadline, s.nextStartAt].filter(Boolean).map((t) => t + T.skew);
  if (!at.length) return;
  const id = s.table.id;
  live.timer = setTimeout(() => refreshTable(id), Math.max(150, Math.min(...at) - Date.now() + 250));
}
/** Dacă serverul te-a trecut pe pauză (n-ai răspuns la timp), îți spunem. */
function notePause(prev, st) {
  if (!prev || st.mySeat == null || prev.mySeat !== st.mySeat) return;
  const a = prev.seats.find((x) => x.seat === st.mySeat), b = st.seats.find((x) => x.seat === st.mySeat);
  if (a?.ready && b && !b.ready && !b.leaving && b.stack > 0 && Date.now() - (T.selfReadyAt || 0) > 3000) {
    toast("N-ai răspuns la timp, așa că te-am trecut pe pauză. Apasă „Sunt gata” când revii.");
    vibe([60, 60, 60]);
  }
}
/** Realizări noi la finalul mâinii: le anunțăm o singură dată. */
function noteAchievements(st) {
  const a = st.lastResult?.achievements;
  if (!a?.length || T.achFor === st.lastResult.handNo) return;
  T.achFor = st.lastResult.handNo;
  const mine = a.filter((x) => x.userId === me?.id);
  if (mine.length) { toast(`🏆 Realizare nouă: ${mine.map((x) => `${x.icon} ${x.title}`).join(", ")}`, true); vibe([80, 40, 80, 40, 160]); }
}
const vibe = (p) => { try { navigator.vibrate?.(p); } catch {} };
/** Când ieși din aplicație cât ești la masă, ceilalți îți dau mai mult timp (și primești notificare). */
document.addEventListener("visibilitychange", () => {
  if (view?.name !== "table" || T.state?.mySeat == null || !token) return;
  fetch(`/api/tables/${T.state.table.id}/presence`, { method: "POST", keepalive: true,
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ away: document.hidden }) }).catch(() => {});
});
async function post(path, body) {
  try { const r = await api("POST", path, body); const st = r.state ?? r; if (st?.table) applyState(st); return r; }
  catch (e) { toast(e.message); refreshTable(view.id); return null; }
}

function cardHtml(c, extra = "", style = "") {
  const st = style ? ` style="${style}"` : "";
  if (c === null) return `<div class="pcard back ${extra}"${st}></div>`;
  if (!c) return `<div class="pcard slot ${extra}"></div>`;
  const r = c[0] === "T" ? "10" : c[0];
  const s = { s: "♠", h: "♥", d: "♦", c: "♣" }[c[1]];
  const cls = { s: "sp", h: "h", d: "d", c: "c" }[c[1]];
  return `<div class="pcard ${cls} ${extra}" data-card="${c}" data-suit="${s}"${st}><span class="r">${r}</span><span class="s">${s}</span></div>`;
}

// ---------- animații, sunet, vibrație ----------
/** Animațiile pornesc la un moment ținut minte; la fiecare redesenare continuă de unde au rămas (întârziere negativă). */
function animAt(start, dur, delay = 0) {
  if (!start) return null;
  const age = Date.now() - start - delay;
  if (age > dur) return null;
  return `animation-delay:${-Math.max(age, -delay - 1000) | 0}ms`;
}
const myTurnIn = (st) => !!(st?.hand && !st.hand.done && st.mySeat != null && st.hand.turn === st.mySeat);
function trackAnims(prev, st) {
  const now = Date.now(), A = T.anim, h = st.hand, ph = prev?.hand;
  const same = prev && prev.handNo === st.handNo;
  if (h && !h.done && !same) { A.deal = now; A.board = {}; A.bets = {}; A.win = null; T.pre = null; }
  if (h) {
    const from = same && ph ? ph.board.length : h.done ? h.board.length : 0;
    for (let i = from; i < h.board.length; i++) A.board[i] = now + 220 + (i - from) * 170;
    for (const p of h.players) {
      const old = same && ph ? ph.players.find((x) => x.seat === p.seat)?.bet ?? 0 : 0;
      if (p.bet > 0 && p.bet !== old) A.bets[p.seat] = now;
    }
  }
  if (h?.done && st.lastResult && !(same && ph?.done)) A.win = now;
  if (myTurnIn(st) && !(same && myTurnIn(prev))) alertTurn();
}
let actx = null;
const unlockAudio = () => { try { actx ||= new (window.AudioContext || window.webkitAudioContext)(); actx.resume?.(); } catch { /* fără sunet */ } };
document.addEventListener("pointerdown", unlockAudio, { once: true });
function beep(notes = [660, 990]) {
  if (localStorage.getItem("dyas.sound") === "0" || !actx) return;
  try {
    const t = actx.currentTime;
    notes.forEach((f, i) => {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = "sine"; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t + i * 0.13);
      g.gain.exponentialRampToValueAtTime(0.22, t + i * 0.13 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.13 + 0.2);
      o.connect(g).connect(actx.destination); o.start(t + i * 0.13); o.stop(t + i * 0.13 + 0.22);
    });
  } catch { /* ignoră */ }
}
function alertTurn() {
  beep();
  if (localStorage.getItem("dyas.vibe") !== "0") navigator.vibrate?.([120, 70, 120]);
}

const ACTION_LABEL = { fold: "Fold", check: "Check", call: "Call", raise: "Raise", bet: "Bet", "all-in": "All-in", "small blind": "SB", "big blind": "BB" };

function renderTable() {
  const s = T.state;
  if (!s) return;
  document.body.style.overflow = "hidden";
  const cap = s.table.capacity;
  const h = s.hand && (!s.hand.done || s.lastResult) ? s.hand : null;
  const hp = (seat) => h?.players.find((p) => p.seat === seat && p.userId === s.seats.find((x) => x.seat === seat)?.userId);
  const occupied = s.seats.length;
  const roomy = occupied <= 3 && cap <= 9;
  const anchor = s.mySeat ?? firstFree(s) ?? 0;
  const slots = LAYOUT[cap - 1];
  const posOf = (seat) => {
    const k = (seat - anchor + cap) % cap;
    return k === 0 ? SELF_POS : slots[k - 1];
  };
  // locurile de pe margini rămân întregi pe ecran, oricât de îngust e telefonul
  const lx = (x, half = "var(--sw) / 2") => `left:clamp(calc(${half} + 4px), ${x}%, calc(100% - ${half} - 4px))`;
  const toward = (p, f) => [p[0] + (CENTER[0] - p[0]) * f, p[1] + (CENTER[1] - p[1]) * f];
  const live = h && !h.done;
  const winners = new Set((s.lastResult && h?.done ? s.lastResult.winners : []).map((w) => w.seat));
  const deadline = s.turnDeadline ? s.turnDeadline + T.skew : null;

  let seatsHtml = "";
  for (let seat = 0; seat < cap; seat++) {
    const occ = s.seats.find((x) => x.seat === seat);
    const isMe = seat === s.mySeat;
    const [x, y] = posOf(seat);
    if (!occ) {
      const canSit = s.mySeat == null && s.canSit !== false;
      seatsHtml += `<div class="seat free" style="${lx(x, "27px")};top:${y}%" data-testid="seat-${seat}" ${canSit ? `data-sit="${seat}"` : ""}><div class="box">${canSit ? "Așază-te" : "Liber"}</div></div>`;
      continue;
    }
    const p = hp(seat);
    const turn = live && h.turn === seat;
    const tag = p?.lastAction && (live || p.lastAction === "fold") ? p.lastAction : !occ.ready && (!live || !p) ? (s.handNo ? "pauză" : "nu e gata") : occ.waiting ? "următoarea" : "";
    const up = !isMe && p && p.cards[0];
    const order = h ? h.players.findIndex((q) => q.seat === seat) : 0;
    seatsHtml += `<div class="seat ${occ.frame ? "fr-" + occ.frame : ""} ${isMe ? "mine" : ""} ${turn ? "turn" : ""} ${p?.folded ? "folded" : ""} ${winners.has(seat) ? "win" : ""}" style="${lx(x)};top:${y}%" data-testid="seat-${seat}">
      <div class="hole ${up ? "up" : ""}" style="${up ? "--oc:" + (roomy ? 34 : 26) + "px" : ""}">${!isMe && p && p.cards.length && !p.folded ? p.cards.map((c, ci) => { const a = animAt(T.anim.deal, 480, (order + ci * h.players.length) * 95); return cardHtml(c, a ? "deal" : "", a ?? ""); }).join("") : ""}</div>
      <div class="box">${tag ? `<span class="tag ${tag}">${esc(ACTION_LABEL[tag] || tag)}</span>` : ""}${h && h.dealer === seat ? `<span class="dbtn in ${x <= 50 ? "r" : "l"}" data-testid="dealer-btn" data-seat="${seat}">D</span>` : ""}
        ${occ.avatar ? `<span class="sav">${esc(occ.avatar)}</span>` : ""}<div class="nm">${esc(occ.name)}</div><div class="st">${fmt(p ? p.stack : occ.stack)}</div>
        ${turn && deadline ? `<div class="tbar2"><i data-deadline="${deadline}"></i></div>` : ""}</div></div>`;
    if (p && p.bet > 0 && live && !isMe) { const [bx, by] = toward([x, y], 0.42); const a = animAt(T.anim.bets[seat], 380); seatsHtml += `<div class="betchip ${a ? "pop" : ""}" style="left:${bx}%;top:${by}%;${a ?? ""}">${fmt(p.bet)}</div>`; }
  }
  // jucătorul local sau locul de jos pentru spectatori
  const mine = s.mySeat != null ? hp(s.mySeat) : null;
  if (s.mySeat == null) {
    const occ = s.seats.find((x) => x.seat === anchor);
    if (occ) {
      const p = hp(anchor);
      seatsHtml += `<div class="seat" style="${lx(SELF_POS[0])};top:${SELF_POS[1]}%" data-testid="seat-${anchor}"><div class="box"><div class="nm">${esc(occ.name)}</div><div class="st">${fmt(p ? p.stack : occ.stack)}</div></div></div>`;
    }
  } else if (mine && mine.bet > 0 && live) {
    const a = animAt(T.anim.bets[s.mySeat], 380);
    seatsHtml += `<div class="betchip ${a ? "pop" : ""}" style="left:50%;top:79%;${a ?? ""}" data-testid="my-bet">${fmt(mine.bet)}</div>`;
  }

  const board = h ? h.board : [];
  const boardHtml = Array.from({ length: 5 }, (_, i) => { const a = board[i] ? animAt(T.anim.board[i], 560) : null; return cardHtml(board[i] || undefined, a ? "flip" : "", a ?? ""); }).join("");
  // jetoanele potului zboară spre câștigători
  if (h?.done && s.lastResult && winners.size) {
    for (const w of winners) {
      const a = animAt(T.anim.win, 1000, 250);
      if (!a) continue;
      const [x1, y1] = w === s.mySeat ? [50, 96] : posOf(w);
      seatsHtml += `<div class="flychip" style="--x0:${CENTER[0]}%;--y0:${CENTER[1] - 6}%;--x1:${x1}%;--y1:${y1}%;${a}"></div>`;
    }
  }
  // reacțiile apar deasupra locului jucătorului
  const nowS = Date.now() - T.skew;
  for (const r of s.reactions || []) {
    const age = nowS - r.at;
    if (age > 3000 || age < -500) continue;
    const [x, y] = posOf(r.seat);
    const self = r.seat === s.mySeat;
    seatsHtml += `<div class="rx ${self ? "self" : ""}" style="${lx(x, "20px")};top:calc(${y}% - ${self ? 36 : 50}px);animation-delay:${-Math.max(0, age) | 0}ms" data-testid="reaction">${esc(r.emoji)}</div>`;
  }
  let msg = "";
  if (h?.done && s.lastResult) {
    const r = s.lastResult;
    msg = r.winners.map((w) => `<b>${esc(r.names[w.seat])}</b> câștigă ${fmt(w.amount)}${w.hand ? ` · ${esc(w.hand)}` : ""}`).join("<br>");
  } else if (!live) {
    const ready = s.seats.filter((x) => x.ready && x.stack > 0).length;
    msg = occupied < 2 ? "Așteptăm cel puțin doi jucători." : ready < 2 ? `Jocul începe când doi jucători sunt gata (${ready}/2).` : "Mâna începe imediat…";
  } else if (h.turn != null) {
    const tn = s.seats.find((x) => x.seat === h.turn);
    msg = h.turn === s.mySeat ? "<b>Rândul tău</b>" : `Așteaptă: ${esc(tn?.name)}`;
  }

  const panel = renderPanel(s, h, mine, deadline);
  $app.innerHTML = `<div class="table-screen ${roomy ? "roomy" : ""}" data-theme="${esc(localStorage.getItem("dyas.theme") || "green")}" data-testid="table" data-cap="${cap}" data-hand="${s.handNo}">
    <div class="tbar"><a class="back" href="${s.tourney ? `#/tourney/${s.tourney.id}` : `#/club/${s.table.clubId}`}" aria-label="Înapoi">←</a><img src="/logo.svg" alt="">
      <div class="ti">${esc(s.table.name)} <small>· ${fmt(s.table.sb)}/${fmt(s.table.bb)} · ${occupied}/${cap}${s.handNo ? ` · mâna #${s.handNo}` : ""}</small></div>
</div>
    ${s.tourney ? `<a class="tinfo" href="#/tourney/${s.tourney.id}" data-testid="tourney-strip"><svg class="arena-control-icon" aria-hidden="true"><use href="/control-icons.svg#trophy"></use></svg> Nivel ${s.tourney.level} · ${fmt(s.table.sb)}/${fmt(s.table.bb)}${s.tourney.nextAt ? ` <span>· următorul în <b data-countdown="${s.tourney.nextAt}">${mmss(s.tourney.nextAt - (Date.now() - T.skew))}</b></span>` : ""}${s.tme ? ` <span>· ${s.tme.alive} rămași</span>` : ""}</a>` : ""}
    <div class="felt-wrap" id="fw">
      ${s.tourney ? "" : `<span class="tjp" data-testid="table-jackpot" title="Jackpotul clubului"><b>${fmt(s.table.jackpot)}</b></span>`}
      ${T.tray && s.mySeat != null ? `<div class="tray" data-testid="react-tray">${reactions.map((e) => `<button data-rx="${esc(e)}">${esc(e)}</button>`).join("")}</div>` : ""}
      <div class="fab-r">${s.mySeat != null ? `<button class="fab ${T.tray ? "on" : ""}" data-act="tray" aria-label="Reacții" data-testid="react-btn">😊</button>` : ""}<button class="fab" data-act="sound" aria-label="Sunet">${localStorage.getItem("dyas.sound") === "0" ? "🔇" : "🔊"}</button></div>
      <div class="conn" ${wsUp ? "hidden" : ""}>Reconectare…</div>
      <button class="fab-chat" data-act="chat" aria-label="Chat la masă" data-testid="chat-btn">💬<b class="unread" data-testid="chat-badge" ${CH.unread ? "" : "hidden"}>${CH.unread > 9 ? "9+" : CH.unread}</b></button>
      <div class="felt">${FELT}</div>
      <div class="center">
        <div class="pot" data-testid="pot">Pot: ${fmt(h ? h.pot : 0)}</div>
        <div class="board" data-testid="board">${boardHtml}</div>
        ${msg ? `<div class="msg" data-testid="msg">${msg}</div>` : ""}
      </div>
      ${seatsHtml}
    </div>
    ${panel}
  </div>`;
  bindTable(s, h, mine);
  animateTimers();
  scheduleWake();
}

function firstFree(s) {
  for (let i = 0; i < s.table.capacity; i++) if (!s.seats.some((x) => x.seat === i)) return i;
  return null;
}

function renderPanel(s, h, mine, deadline) {
  const seat = s.seats.find((x) => x.seat === s.mySeat);
  if (!seat && s.tourney) {
    const st = s.tme?.status;
    return `<div class="me" data-testid="panel"><div class="info"><div class="who"><div class="nm">${st === "out" ? (s.tme.place ? `Ai terminat pe locul ${s.tme.place}` : "Ai ieșit din turneu") : st === "playing" ? "Te mutăm la masa ta…" : "Privești turneul"}</div>
      <div class="small muted">${esc(s.tourney.name)}</div></div></div>${tourneyActs(s)}</div>`;
  }
  if (!seat) {
    const full = s.seats.length >= s.table.capacity;
    return `<div class="me" data-testid="panel"><div class="info"><div class="who"><div class="nm">Privești masa</div>
      <div class="small muted">Intrare ${buyInText(s.table)} jetoane din soldul clubului</div></div></div>
      <div class="status">${s.canSit === false ? `<button class="btn block" disabled><svg class="arena-control-icon" aria-hidden="true"><use href="/control-icons.svg#shield"></use></svg> Privești ca administrator</button>` : full ? `<button class="btn block" disabled>Masă plină</button>` : `<button class="btn primary block" data-act="sit">Așază-te · ${buyInText(s.table)}</button>`}</div></div>`;
  }
  const live = h && !h.done;
  const myTurn = live && mine && h.turn === s.mySeat && h.legal;
  if (!myTurn) T.raiseOpen = false;
  const L = myTurn ? h.legal : null;
  const cards = mine && mine.cards.length ? mine.cards : [];
  const toCall = live && mine ? Math.min(h.currentBet - mine.bet, mine.stack) : 0;
  const info = `<div class="info">
    <div class="mycards" data-testid="my-cards">${cards.length ? cards.map((c, i) => { const a = animAt(T.anim.deal, 480, (h.players.findIndex((q) => q.seat === s.mySeat) + i * h.players.length) * 95); return cardHtml(c, (mine.folded ? "dim " : "") + (a ? "deal" : ""), a ?? ""); }).join("") : cardHtml(undefined) + cardHtml(undefined)}</div>
    <div class="who"><div class="nm">${esc(seat.name)}${h && h.dealer === s.mySeat ? " · D" : ""}</div><div class="st">${fmt(mine ? mine.stack : seat.stack)}${seat.topup ? ` <small class="tp" data-testid="topup-pending">+${fmt(seat.topup)}</small>` : ""}${s.tourney || seat.leaving || seat.stack + (seat.topup || 0) >= s.table.buyIn ? "" : ` <button class="addchips" data-act="topup" aria-label="Completează jetoanele" data-testid="topup-btn">＋</button>`}</div></div>
    <div class="tocall" data-testid="to-call"><small>${live && mine && !mine.folded ? "De plătit" : "Pot"}</small><b>${live && mine && !mine.folded ? fmt(toCall) : fmt(h ? h.pot : 0)}</b></div></div>`;
  let body = "";
  if (myTurn) {
    if (T.raiseOpen && L.canRaise) {
      const to = clampRaise(T.raiseTo || L.minTo, L);
      T.raiseTo = to;
      const pot = h.pot;
      const presets = [["Min", L.minTo], ["½ pot", h.currentBet + Math.floor((pot + toCall) / 2)], ["Pot", h.currentBet + pot + toCall], ["All-in", L.maxTo]];
      body = `<div class="raisebox" data-testid="raise-box">
        <div class="presets">${presets.map(([n, v]) => `<button type="button" data-pre="${clampRaise(v, L)}" class="${clampRaise(v, L) === to ? "on" : ""}">${n}</button>`).join("")}</div>
        <label class="rin"><span>Suma</span><input type="number" id="rn" inputmode="numeric" min="${L.minTo}" max="${L.maxTo}" step="1" value="${to}" aria-label="Scrie suma" data-testid="raise-input"><small>${fmt(L.minTo)} – ${fmt(L.maxTo)}</small></label>
        <div class="sl"><button type="button" data-step="-1" aria-label="Mai puțin">−</button>
          <input type="range" id="rr" min="${L.minTo}" max="${L.maxTo}" step="${s.table.bb >= 1 ? Math.max(1, Math.min(s.table.sb, L.maxTo - L.minTo || 1)) : 1}" value="${to}" aria-label="Suma raise">
          <button type="button" data-step="1" aria-label="Mai mult">+</button></div>
        <div class="confirm"><button class="btn" data-act="raise-cancel">Anulează</button>
          <button class="btn raise" data-act="raise-confirm" data-testid="confirm-raise">${to >= L.maxTo ? "All-in" : h.currentBet === 0 ? "Bet" : "Raise la"} <span id="rv">${fmt(to)}</span></button></div></div>`;
    } else {
      body = `<div class="acts">
        <button class="btn fold" data-act="fold">Fold</button>
        <button class="btn call" data-act="${L.canCheck ? "check" : "call"}" data-testid="call-btn">${L.canCheck ? "Check" : `Call ${fmt(L.toCall)}`}</button>
        <button class="btn raise" data-act="raise-open" data-testid="raise-btn" ${L.canRaise ? "" : "disabled"}>${h.currentBet === 0 ? "Bet" : "Raise"}</button></div>`;
    }
    if (deadline) body += `<div class="turnbar"><i data-deadline="${deadline}"></i></div>`;
    if (seat.timeBank > 0 && !T.raiseOpen) body += `<div class="xtra"><button type="button" class="linkbtn" data-act="extend" data-testid="extend-btn"><svg class="arena-control-icon" aria-hidden="true"><use href="/control-icons.svg#clock"></use></svg> Încă 30 s · ${seat.timeBank} ${seat.timeBank === 1 ? "rămasă" : "rămase"}</button></div>`;
  } else if (s.tourney) {
    body = live && mine && !mine.folded && !mine.allIn ? preActs() : `<div class="note">${live ? (mine?.allIn ? "Ești all-in." : "Aștepți mâna următoare.") : "Mâna următoare pornește automat."}</div>`;
    body += tourneyActs(s);
  } else if (live && mine && !mine.folded && !mine.allIn) {
    // acțiuni alese dinainte: se fac singure când îți vine rândul
    body = `<div class="pre" data-testid="pre-actions">${[["checkfold", "Check / Fold"], ["callany", "Call orice"], ["fold", "Fold"]]
      .map(([k, n]) => `<button type="button" class="${T.pre === k ? "on" : ""}" data-pre-act="${k}" data-testid="pre-${k}">${T.pre === k ? "✓ " : ""}${n}</button>`).join("")}</div>${sitOutToggle(seat)}`;
  } else if (live && mine && !mine.folded) {
    body = `<div class="note">Ești all-in.</div>${sitOutToggle(seat)}`;
  } else if (live && !seat.leaving && !seat.waiting && seat.ready) {
    body = `<div class="note">Aștepți mâna următoare.</div>${sitOutToggle(seat)}`;
  } else {
    const waitingNote = seat.waiting ? "Intri în joc de la mâna următoare." : live ? "Aștepți mâna următoare." : "";
    body = `<div class="status">
      ${seat.leaving ? `<button class="btn block" disabled>Te ridici după mâna asta</button>` :
        `<button class="btn" data-act="leave">Ridică-te</button>
         ${seat.ready ? `<button class="btn" data-act="unready" data-testid="sitout-btn"><svg class="arena-control-icon" aria-hidden="true"><use href="/control-icons.svg#coffee"></use></svg> Lipsesc</button>` : `<button class="btn green" data-act="ready" ${seat.stack + (seat.topup || 0) > 0 ? "" : "disabled"}>Sunt gata</button>`}`}</div>
      ${waitingNote || seat.ready || s.handNo ? `<div class="note">${waitingNote || (seat.ready ? "Ești gata. Jocul pornește automat." : "☕ Ești pe pauză: rămâi la masă, dar nu primești cărți.")}</div>` : ""}`;
  }
  return `<div class="me" data-testid="panel">${info}${body}</div>`;
}

function preActs() {
  return `<div class="pre" data-testid="pre-actions">${[["checkfold", "Check / Fold"], ["callany", "Call orice"], ["fold", "Fold"]]
    .map(([k, n]) => `<button type="button" class="${T.pre === k ? "on" : ""}" data-pre-act="${k}" data-testid="pre-${k}">${T.pre === k ? "✓ " : ""}${n}</button>`).join("")}</div>`;
}
/** Rebuy / add-on / re-entry direct de la masă, plus drumul spre lobby. */
function tourneyActs(s) {
  const a = s.tme?.actions || {};
  const b = [
    a.rebuy != null ? `<button class="btn" data-act="t-rebuy" data-testid="t-rebuy"><svg class="arena-control-icon" aria-hidden="true"><use href="/control-icons.svg#reload"></use></svg> Rebuy${a.rebuy ? ` · ${fmt(a.rebuy)}` : ""}</button>` : "",
    a.addon != null ? `<button class="btn" data-act="t-addon" data-testid="t-addon"><svg class="arena-control-icon" aria-hidden="true"><use href="/control-icons.svg#plus"></use></svg> Add-on${a.addon ? ` · ${fmt(a.addon)}` : ""}</button>` : "",
    a.reentry != null ? `<button class="btn" data-act="t-reentry" data-testid="t-reentry"><svg class="arena-control-icon" aria-hidden="true"><use href="/control-icons.svg#reload"></use></svg> Re-entry${a.reentry ? ` · ${fmt(a.reentry)}` : ""}</button>` : "",
    `<a class="btn" href="#/tourney/${s.tourney.id}"><svg class="arena-control-icon" aria-hidden="true"><use href="/control-icons.svg#trophy"></use></svg> Lobby</a>`,
  ].join("");
  return `<div class="tacts">${b}</div>`;
}
function sitOutToggle(seat) {
  return seat.ready
    ? `<button class="linkbtn" data-act="unready" data-testid="sitout-btn"><svg class="arena-control-icon" aria-hidden="true"><use href="/control-icons.svg#coffee"></use></svg> Lipsesc de la mâna următoare</button>`
    : `<div class="note small">☕ Stai pe pauză de la mâna următoare. <button class="linkbtn" data-act="ready">Revin</button></div>`;
}
function clampRaise(v, L) { return Math.max(L.minTo, Math.min(L.maxTo, Math.round(v))); }

function bindTable(s, h, mine) {
  const root = $app.querySelector(".table-screen");
  root.querySelectorAll("[data-sit]").forEach((b) => (b.onclick = () => sit(Number(b.dataset.sit))));
  root.querySelectorAll("[data-act]").forEach((b) => (b.onclick = () => {
    const a = b.dataset.act;
    if (a === "sit") return sit(null);
    if (a === "tray") { T.tray = !T.tray; return renderTable(); }
    if (a === "chat") return loadChat().then((m) => m.open()).catch(() => toast("Chatul nu s-a putut deschide."));
    if (a === "sound") { const off = localStorage.getItem("dyas.sound") !== "0"; localStorage.setItem("dyas.sound", off ? "0" : "1"); unlockAudio(); if (!off) beep([880]); return renderTable(); }
    if (a === "ready" || a === "unready") { T.selfReadyAt = Date.now(); return post(`/api/tables/${s.table.id}/ready`, { ready: a === "ready" }); }
    if (a === "topup") return openTopup(s);
    if (a === "extend") return post(`/api/tables/${s.table.id}/extend`).then((r) => { if (r) toast("Ai încă 30 de secunde.", true); });
    if (a === "leave") return post(`/api/tables/${s.table.id}/leave`).then((r) => { if (!r) return; if (r.left) go(`#/club/${s.table.clubId}`); else toast("Te ridici la finalul mâinii.", true); });
    if (a.startsWith("t-")) {
      const kind = a.slice(2);
      if (!confirm({ rebuy: "Faci rebuy?", addon: "Iei add-on?", reentry: "Intri din nou în turneu?" }[kind])) return;
      return api("POST", `/api/tourneys/${s.tourney.id}/${kind}`).then((r) => {
        toast({ rebuy: "Rebuy făcut.", addon: "Add-on făcut.", reentry: "Ai intrat din nou." }[kind], true);
        if (r.tables?.[0] && r.tables[0] !== view.id && kind !== "addon") go(`#/table/${r.tables[0]}`); else refreshTable(view.id);
      }).catch((e) => toast(e.message));
    }
    if (a === "raise-open") { T.raiseOpen = true; T.raiseTo = h.legal.minTo; return renderTable(); }
    if (a === "raise-cancel") { T.raiseOpen = false; return renderTable(); }
    if (a === "raise-confirm") { T.raiseOpen = false; return act({ action: "raise", to: clampRaise(T.raiseTo, h.legal) }); }
    T.raiseOpen = false;
    act({ action: a });
  }));
  root.querySelectorAll("[data-pre-act]").forEach((b) => (b.onclick = () => { T.pre = T.pre === b.dataset.preAct ? null : b.dataset.preAct; renderTable(); }));
  root.querySelectorAll("[data-rx]").forEach((b) => (b.onclick = async () => {
    T.tray = false;
    const r = await api("POST", `/api/tables/${s.table.id}/react`, { emoji: b.dataset.rx }).catch((e) => { toast(e.message); return null; });
    if (r?.ok) refreshTable(s.table.id); else renderTable();
  }));
  const rr = root.querySelector("#rr");
  if (rr) {
    const L = h.legal;
    const upd = (v) => {
      T.raiseTo = clampRaise(v, L);
      rr.value = T.raiseTo;
      const rn = root.querySelector("#rn");
      if (rn && document.activeElement !== rn) rn.value = T.raiseTo;
      root.querySelector("#rv").textContent = fmt(T.raiseTo);
      root.querySelector("[data-act=raise-confirm]").firstChild.textContent = T.raiseTo >= L.maxTo ? "All-in " : h.currentBet === 0 ? "Bet " : "Raise la ";
      root.querySelectorAll("[data-pre]").forEach((x) => x.classList.toggle("on", Number(x.dataset.pre) === T.raiseTo));
    };
    rr.oninput = () => upd(Number(rr.value));
    // suma scrisă de mână: se acceptă orice între minim și all-in; la confirmare se aduce în limite
    const rn = root.querySelector("#rn");
    rn.oninput = () => {
      const v = Math.floor(Number(rn.value));
      if (!v) return;
      T.raiseTo = v;
      const c = clampRaise(v, L);
      rr.value = c;
      root.querySelector("#rv").textContent = fmt(c);
      root.querySelector("[data-act=raise-confirm]").firstChild.textContent = c >= L.maxTo ? "All-in " : h.currentBet === 0 ? "Bet " : "Raise la ";
      root.querySelectorAll("[data-pre]").forEach((x) => x.classList.toggle("on", Number(x.dataset.pre) === c));
    };
    rn.onchange = () => upd(Number(rn.value) || L.minTo);
    rn.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); upd(Number(rn.value) || L.minTo); root.querySelector("[data-act=raise-confirm]").click(); } };
    root.querySelectorAll("[data-pre]").forEach((b) => (b.onclick = () => upd(Number(b.dataset.pre))));
    root.querySelectorAll("[data-step]").forEach((b) => (b.onclick = () => upd(T.raiseTo + Number(b.dataset.step) * s.table.bb)));
  }
}

let acting = false;
async function act(body) {
  if (acting) return;
  acting = true;
  root().querySelectorAll(".me .btn").forEach((b) => (b.disabled = true));
  try { await post(`/api/tables/${view.id}/act`, body); } finally { acting = false; }
}
const root = () => document.querySelector(".table-screen") || document;

/** Completezi jetoanele din soldul clubului fără să te ridici (până la intrarea mesei). */
async function openTopup(s) {
  const seat = s.seats.find((x) => x.seat === s.mySeat);
  if (!seat) return;
  const room = s.table.buyIn - seat.stack - (seat.topup || 0);
  if (room <= 0) return toast(`Ai deja ${fmt(s.table.buyIn)} la masă.`);
  let bal = null;
  try { bal = (await api("GET", `/api/clubs/${s.table.clubId}`)).me?.balance ?? null; } catch {}
  const inHand = s.hand && !s.hand.done && s.hand.players.some((p) => p.seat === s.mySeat);
  const max = bal == null ? room : Math.min(room, bal);
  const el = document.createElement("div");
  el.className = "tsheet"; el.dataset.testid = "topup-sheet";
  el.innerHTML = `<div class="tsheet-bg" data-x></div><form class="tsheet-box">
    <h3>Completează jetoanele</h3>
    <p class="small muted">Ai ${fmt(seat.stack)}${seat.topup ? ` (+${fmt(seat.topup)} în așteptare)` : ""} la masă. Poți avea cel mult ${fmt(s.table.buyIn)}.${bal != null ? ` Sold în club: <b>${fmt(bal)}</b>.` : ""}</p>
    ${max > 0 ? `<button class="btn primary block" type="button" data-full>Completează la ${fmt(seat.stack + (seat.topup || 0) + max)} (+${fmt(max)})</button>
    <div class="row"><input type="number" inputmode="numeric" min="1" max="${max}" placeholder="Altă sumă" data-amt><button class="btn" type="submit">Adaugă</button></div>` : `<p>Nu ai jetoane în soldul clubului.</p>`}
    ${inHand ? `<p class="small muted">Ești într-o mână: jetoanele intră la mâna următoare.</p>` : ""}
    <button class="btn block" type="button" data-x>Închide</button></form>`;
  document.body.appendChild(el);
  const close = () => el.remove();
  el.querySelectorAll("[data-x]").forEach((b) => (b.onclick = close));
  const send = async (amount) => {
    if (!amount || amount < 1) return toast("Scrie suma.");
    close();
    const r = await post(`/api/tables/${s.table.id}/topup`, { amount });
    if (r) toast(r.now ? `Ai adăugat ${fmt(r.amount)} jetoane.` : `${fmt(r.amount)} jetoane intră la mâna următoare.`, true);
  };
  el.querySelector("[data-full]")?.addEventListener("click", () => send(max));
  el.querySelector("form").onsubmit = (e) => { e.preventDefault(); send(Math.floor(Number(el.querySelector("[data-amt]").value))); };
}

async function sit(seat) {
  const t = T.state?.table;
  const ranged = t && t.buyInMin != null && t.buyInMin < t.buyIn;
  const go = async (amount) => {
    const body = seat == null ? {} : { seat };
    if (amount != null) body.amount = amount;
    const r = await post(`/api/tables/${view.id}/sit`, body);
    if (r) toast(r.nextHand ? "Te-ai așezat. Intri de la mâna următoare." : "Te-ai așezat. Apasă „Sunt gata”.", true);
  };
  if (!ranged) return go(null);
  let bal = null;
  try { bal = (await api("GET", `/api/clubs/${t.clubId}`)).me?.balance ?? null; } catch {}
  const top = bal == null ? t.buyIn : Math.min(t.buyIn, bal);
  if (bal != null && bal < t.buyInMin) return toast(`Ai nevoie de cel puțin ${fmt(t.buyInMin)} jetoane. Sold în club: ${fmt(bal)}.`);
  const step = t.buyIn - t.buyInMin >= 10000 ? 100 : t.buyIn - t.buyInMin >= 1000 ? 10 : 1;
  const start = Math.min(top, Math.max(t.buyInMin, Math.round(((t.buyInMin + t.buyIn) / 2) / step) * step));
  const el = document.createElement("div");
  el.className = "tsheet"; el.dataset.testid = "buyin-sheet";
  el.innerHTML = `<div class="tsheet-bg" data-x></div><form class="tsheet-box buyin-sheet">
    <h3>Cu cât intri la masă?</h3>
    <p class="small muted">Intrare între <b>${fmt(t.buyInMin)}</b> și <b>${fmt(t.buyIn)}</b> jetoane.${bal != null ? ` Sold în club: <b>${fmt(bal)}</b>.` : ""}</p>
    <output class="bi-val" data-v>${fmt(start)}</output>
    <input type="range" min="${t.buyInMin}" max="${top}" step="${step}" value="${start}" data-r aria-label="Suma de intrare">
    <div class="row bi-quick"><button type="button" class="btn sm" data-q="${t.buyInMin}">Minim</button><button type="button" class="btn sm" data-q="${Math.round((t.buyInMin + top) / 2)}">Jumătate</button><button type="button" class="btn sm" data-q="${top}">${top === t.buyIn ? "Maxim" : "Tot soldul"}</button></div>
    <div class="row"><input type="number" inputmode="numeric" min="${t.buyInMin}" max="${top}" value="${start}" data-n aria-label="Altă sumă" data-testid="buyin-amount"></div>
    <button class="btn primary block" type="submit" data-testid="buyin-go">Așază-te cu <span data-b>${fmt(start)}</span></button>
    <button class="btn block" type="button" data-x>Renunță</button></form>`;
  document.body.appendChild(el);
  const r = el.querySelector("[data-r]"), n = el.querySelector("[data-n]");
  const set = (v, from) => {
    const x = Math.floor(Number(v) || 0);
    if (from !== "r") r.value = x;
    if (from !== "n") n.value = x;
    el.querySelector("[data-v]").textContent = fmt(x); el.querySelector("[data-b]").textContent = fmt(x);
  };
  r.oninput = () => set(r.value, "r");
  n.oninput = () => set(n.value, "n");
  el.querySelectorAll("[data-q]").forEach((b) => (b.onclick = () => set(b.dataset.q)));
  el.querySelectorAll("[data-x]").forEach((b) => (b.onclick = () => el.remove()));
  el.querySelector("form").onsubmit = (e) => {
    e.preventDefault();
    const x = Math.floor(Number(n.value));
    if (!(x >= t.buyInMin && x <= top)) return toast(`Alege o sumă între ${fmt(t.buyInMin)} și ${fmt(top)}.`);
    el.remove(); go(x);
  };
}

function animateTimers() {
  const total = T.state?.turnMs || 30000;
  document.querySelectorAll("[data-deadline]").forEach((el) => {
    const rem = Math.max(0, Number(el.dataset.deadline) - Date.now());
    el.style.transition = "none";
    el.style.width = `${Math.min(100, (rem / Math.max(total, rem)) * 100)}%`;
    requestAnimationFrame(() => requestAnimationFrame(() => { el.style.transition = `width ${rem}ms linear`; el.style.width = "0%"; }));
  });
}

// ---------- profil ----------
async function renderProfile() {
  const [pushState, ph] = await Promise.all([pushStatus(), api("GET", "/api/me/phone").catch(() => ({ phone: null }))]);
  const phoneForm = (cc = "40") => `<form class="phone-f" id="phf"><div class="phone-row"><select name="cc" aria-label="Prefixul țării">${COUNTRIES.map(([f, c]) => `<option value="${c}" ${c === cc ? "selected" : ""}>${f} +${c}</option>`).join("")}</select>
      <input name="phone" type="tel" inputmode="tel" autocomplete="tel-national" required minlength="6" maxlength="18" placeholder="712 345 678" data-testid="profile-phone-input"></div>
      <button class="btn primary block" style="margin-top:10px" data-testid="profile-phone-save">Salvează numărul</button></form>`;
  $app.innerHTML = `<div class="screen">
    <div class="topbar"><a class="back" href="#/" aria-label="Înapoi">←</a><h1 style="margin:0">Profilul tău</h1></div>
    <div class="card profile-head">${avatarHtml(me, "xl")}<div><div class="name">${esc(me.username)}</div>${me.isAdmin ? `<span class="badge superadmin">Administrator</span>` : ""}</div></div>
    <h2><svg class="arena-control-icon" aria-hidden="true"><use href="/control-icons.svg#phone"></use></svg> Număr de telefon</h2>
    <div class="card phone-card" id="phc" data-testid="profile-phone">${ph.phone
      ? `<div class="row"><div class="grow"><b class="ph-num">${esc(ph.phone)}</b><div class="small muted">Numărul nu apare public în club.</div></div><button type="button" class="btn sm" id="phe">Schimbă</button></div>`
      : `<div class="small muted" style="margin-bottom:10px">Nu ai trecut încă numărul. Adaugă-l ca să te putem anunța când se joacă. Numărul nu apare public în club.</div>${phoneForm()}`}</div>
    <h2>Avatar</h2>
    <div class="emblems avatars" data-testid="avatars">${["", ...avatars].map((a) => `<button type="button" data-av="${esc(a)}" class="${(me.avatar || "") === a ? "on" : ""}" aria-label="${a ? "Avatar " + esc(a) : "Inițiala numelui"}">${a ? esc(a) : esc(me.username[0].toUpperCase())}</button>`).join("")}</div>
    <h2>🖼️ Rama avatarului</h2>
    <p class="small muted" style="margin:-4px 2px 8px">Se deblochează cu realizări și o văd toți la masă.</p>
    <div class="frames" id="frames" data-testid="frames"></div>
    <h2>🎨 Tema mesei</h2>
    <div class="themes" data-testid="themes">${[["green", "Verde"], ["blue", "Albastru"], ["red", "Burgundy"]].map(([k, n]) => `<button type="button" data-theme-pick="${k}" class="th-${k} ${(localStorage.getItem("dyas.theme") || "green") === k ? "on" : ""}" aria-pressed="${(localStorage.getItem("dyas.theme") || "green") === k}"><span class="tmini" data-theme="${k}" aria-hidden="true"><span class="felt">${FELT}</span></span>${n}</button>`).join("")}</div>
    <h2><svg class="arena-control-icon" aria-hidden="true"><use href="/control-icons.svg#trophy"></use></svg> Realizări</h2>
    <div id="ach"><div class="empty">Se încarcă…</div></div>
    <h2>Setări</h2>
    <div class="card settings">
      <label class="switch"><span>🔊 Sunet când îți vine rândul</span><input type="checkbox" id="snd" ${localStorage.getItem("dyas.sound") === "0" ? "" : "checked"}></label>
      <label class="switch"><span>📳 Vibrație când îți vine rândul</span><input type="checkbox" id="vib" ${localStorage.getItem("dyas.vibe") === "0" ? "" : "checked"}></label>
      <label class="switch"><span>🔔 Notificări când prietenii se așază la masă<small>${pushState.hint}</small></span><input type="checkbox" id="psh" ${pushState.on ? "checked" : ""} ${pushState.available ? "" : "disabled"}></label>
    </div>
    <h2>Cont</h2>
    <div class="card menu" data-testid="account-menu">
      <button type="button" class="menu-row" id="pw-open" aria-expanded="false"><span class="mi">🔒</span><span class="grow">Schimbă parola</span><span class="chev">›</span></button>
      <div id="pwf"></div>
      <button type="button" class="menu-row" id="lo"><span class="mi">🚪</span><span class="grow">Ieși din cont</span><span class="chev">›</span></button>
      <button type="button" class="menu-row danger" id="loall"><span class="mi">📵</span><span class="grow">Ieși de pe toate dispozitivele<small>Dacă ți-ai pierdut telefonul sau ai intrat de pe alt dispozitiv</small></span></button>
    </div>
    ${installBanner(true)}
  </div>`;
  $app.querySelectorAll("[data-av]").forEach((b) => (b.onclick = async () => {
    try { const r = await api("POST", "/api/profile", { avatar: b.dataset.av }); me = r.user; renderProfile(); renderNav(); toast("Avatar salvat.", true); } catch (e) { toast(e.message); }
  }));
  const bindPhone = () => {
    const f = $app.querySelector("#phf");
    if (!f) return;
    f.onsubmit = async (e) => {
      e.preventDefault();
      try { await api("POST", "/api/me/phone", { cc: f.cc.value, phone: f.phone.value }); toast("Numărul a fost salvat.", true); renderProfile(); } catch (err) { toast(err.message); }
    };
  };
  bindPhone();
  $app.querySelector("#phe")?.addEventListener("click", () => {
    const cur = ph.phone || "";
    const cc = COUNTRIES.map(([, c]) => c).sort((a, b) => b.length - a.length).find((c) => cur.startsWith("+" + c)) || "40";
    $app.querySelector("#phc").innerHTML = phoneForm(cc);
    $app.querySelector("#phc input[name=phone]").value = cur.slice(cc.length + 1);
    bindPhone();
  });
  $app.querySelector("#snd").onchange = (e) => { localStorage.setItem("dyas.sound", e.target.checked ? "1" : "0"); unlockAudio(); if (e.target.checked) beep(); };
  $app.querySelector("#vib").onchange = (e) => { localStorage.setItem("dyas.vibe", e.target.checked ? "1" : "0"); if (e.target.checked) navigator.vibrate?.(150); };
  $app.querySelector("#psh").onchange = async (e) => {
    e.target.disabled = true;
    try { if (e.target.checked) await enablePush(); else await disablePush(); toast(e.target.checked ? "Notificări pornite." : "Notificări oprite.", true); }
    catch (err) { e.target.checked = !e.target.checked; toast(err.message); }
    renderProfile();
  };
  $app.querySelector("#lo").onclick = () => { if (confirm("Ieși din cont?")) logout(); };
  $app.querySelector("#loall").onclick = async () => {
    if (!confirm("Ieși din cont pe toate dispozitivele, inclusiv pe acesta?")) return;
    try { await api("POST", "/api/logout-all"); } catch { /* oricum ieșim */ }
    logout(true);
    toast("Ai ieșit de pe toate dispozitivele.", true);
  };
  $app.querySelector("#pw-open").onclick = (e) => passwordForm(e.currentTarget);
  more.achievementsInto($app.querySelector("#ach"));
  $app.querySelectorAll("[data-theme-pick]").forEach((b) => (b.onclick = () => {
    localStorage.setItem("dyas.theme", b.dataset.themePick);
    $app.querySelectorAll("[data-theme-pick]").forEach((x) => { x.classList.toggle("on", x === b); x.setAttribute("aria-pressed", String(x === b)); });
    toast("Tema mesei a fost salvată.", true);
  }));
  paintFrames();
  bindInstall();
}
async function paintFrames() {
  const el = $app.querySelector("#frames");
  if (!el) return;
  let f;
  try { f = await api("GET", "/api/frames"); } catch { el.innerHTML = ""; return; }
  const opts = [{ code: "", title: "Fără ramă", unlocked: true }, ...f.frames];
  el.innerHTML = opts.map((o) => `<button type="button" class="frame ${f.current === o.code ? "on" : ""}" data-frame="${o.code}" ${o.unlocked ? "" : "disabled"} data-testid="frame-${o.code || "none"}">
    ${avatarHtml(me, o.code ? "fr-" + o.code : "")}<b>${esc(o.title)}</b><small>${o.unlocked ? (f.current === o.code ? "Folosită" : "Disponibilă") : "🔒 " + esc(o.need)}</small></button>`).join("");
  el.querySelectorAll("[data-frame]:not([disabled])").forEach((b) => (b.onclick = async () => {
    try { await api("POST", "/api/frames", { frame: b.dataset.frame }); toast("Rama a fost salvată.", true); paintFrames(); } catch (e) { toast(e.message); }
  }));
}

function passwordForm(btn) {
  const host = $app.querySelector("#pwf");
  if (host.innerHTML) { host.innerHTML = ""; btn.setAttribute("aria-expanded", "false"); return; }
  btn.setAttribute("aria-expanded", "true");
  host.innerHTML = `<form class="pwform" data-testid="password-form">
    <input type="text" name="username" value="${esc(me.username)}" autocomplete="username" hidden>
    <label for="pw0">Parola actuală</label><input id="pw0" name="current" type="password" autocomplete="current-password" required>
    <label for="pw1">Parola nouă</label><input id="pw1" name="password" type="password" autocomplete="new-password" minlength="6" required placeholder="minim 6 caractere">
    <label for="pw2">Repetă parola nouă</label><input id="pw2" name="confirm" type="password" autocomplete="new-password" minlength="6" required>
    <label class="showpw"><input type="checkbox"> Arată parolele</label>
    <div class="err" id="pwe"></div>
    <button class="btn primary block">Salvează parola nouă</button></form>`;
  const f = host.querySelector("form");
  f.querySelector(".showpw input").onchange = (e) => f.querySelectorAll("input[name]:not([name=username])").forEach((i) => (i.type = e.target.checked ? "text" : "password"));
  f.current.focus();
  f.onsubmit = async (e) => {
    e.preventDefault();
    const err = host.querySelector("#pwe");
    if (f.password.value !== f.confirm.value) { err.textContent = "Parolele noi nu coincid."; return; }
    try {
      const r = await api("POST", "/api/password", { current: f.current.value, password: f.password.value });
      host.innerHTML = ""; btn.setAttribute("aria-expanded", "false");
      toast(r.otherSessions ? `Parola a fost schimbată. Am deconectat ${plural(r.otherSessions, "alt dispozitiv", "alte dispozitive")}.` : "Parola a fost schimbată.", true);
    } catch (ex) { err.textContent = ex.message; }
  };
}

// ---------- aplicație instalabilă (PWA) și notificări ----------
let installEvt = null;
const standalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEvt = e; if (view.name === "home" || view.name === "profile") render(); });
window.addEventListener("appinstalled", () => { installEvt = null; toast("Aplicația a fost instalată.", true); });
if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});

function installBanner(always = false) {
  if (standalone()) return always ? `<p class="small muted" style="margin-top:14px">✅ Folosești aplicația instalată.</p>` : "";
  if (!always && localStorage.getItem("dyas.noinstall") === "1") return "";
  if (installEvt) return `<div class="card install"><span class="ic">📲</span><div class="grow"><b>Instalează DYAS Poker</b><small>Iconiță pe ecran, deschidere pe tot ecranul</small></div><button class="btn primary sm" data-install>Instalează</button>${always ? "" : `<button class="x" data-noinst aria-label="Ascunde">×</button>`}</div>`;
  if (isIOS()) return `<div class="card install"><span class="ic">📲</span><div class="grow"><b>Pune DYAS Poker pe ecran</b><small>În Safari apasă <b>Partajează</b> ⬆️, apoi <b>Adaugă pe ecranul principal</b>.</small></div>${always ? "" : `<button class="x" data-noinst aria-label="Ascunde">×</button>`}</div>`;
  return always ? `<p class="small muted" style="margin-top:14px">📲 Din meniul browserului alege „Instalează aplicația” sau „Adaugă pe ecranul principal”.</p>` : "";
}
function bindInstall() {
  $app.querySelector("[data-install]")?.addEventListener("click", async () => { if (!installEvt) return; installEvt.prompt(); await installEvt.userChoice.catch(() => {}); installEvt = null; render(); });
  $app.querySelector("[data-noinst]")?.addEventListener("click", () => { localStorage.setItem("dyas.noinstall", "1"); render(); });
}

const b64 = (s) => { const p = "=".repeat((4 - (s.length % 4)) % 4); const r = atob((s + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(r, (c) => c.charCodeAt(0)); };
async function pushStatus() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return { available: false, on: false, hint: isIOS() && !standalone() ? "Pe iPhone merg după ce instalezi aplicația pe ecran." : "Browserul nu suportă notificări." };
  }
  if (rtConfig === undefined) await realtime();
  const cfg = await api("GET", "/api/config").catch(() => ({}));
  if (!cfg.vapidPublic) return { available: false, on: false, hint: "Indisponibile momentan." };
  if (Notification.permission === "denied") return { available: false, on: false, hint: "Le-ai blocat din setările browserului." };
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  return { available: true, on: !!sub && Notification.permission === "granted", hint: "Primești un mesaj chiar dacă aplicația e închisă.", key: cfg.vapidPublic };
}
async function enablePush() {
  const st = await pushStatus();
  if (!st.available) throw new Error(st.hint);
  if ((await Notification.requestPermission()) !== "granted") throw new Error("Nu ai permis notificările.");
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(st.key) }));
  await api("POST", "/api/push/subscribe", { subscription: sub.toJSON() });
}
async function disablePush() {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) { await api("POST", "/api/push/unsubscribe", { endpoint: sub.endpoint }).catch(() => {}); await sub.unsubscribe(); }
}

// ---------- panoul administratorului (public/admin.js, încărcat doar pentru administratori) ----------
let adminMod = null;
async function loadAdmin() {
  adminMod ||= import("/admin.js?v=6");
  return adminMod;
}
function stopAdmin() { adminMod?.then((m) => m.stop()).catch(() => {}); }
const ago = (t) => {
  if (!t) return "niciodată";
  const m = Math.round((Date.now() - new Date(t).getTime()) / 60000);
  return m < 2 ? "acum" : m < 60 ? `acum ${m} min` : m < 1440 ? `acum ${Math.round(m / 60)} h` : new Date(t).toLocaleDateString("ro-RO");
};
window.DY = { api, esc, fmt, plural, toast, go, avatarHtml, cardHtml, handCard, chipAdjustHtml, bindChipAdjust, ago, ROLE, setChatBadge, follow, jackpotHtml,
  get me() { return me; }, get view() { return view; }, get app() { return $app; }, get token() { return token; } };

render();
