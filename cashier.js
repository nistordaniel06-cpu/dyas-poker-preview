// Casieria DYAS Coins: butonul „Casierie” de pe Acasă, ecranul membrului (#/casierie) și Admin → Casierie (#/admin/casierie).
// Ecranele se deschid peste pagina aplicației; soldurile vin din aceleași câmpuri pe care le folosesc mesele și turneele.
const DY = () => window.DY;
const $app = document.getElementById("app");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const num = (n) => Number(n || 0).toLocaleString("ro-RO");
const eur = (c) => `${(c / 100).toLocaleString("ro-RO", { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 })} €`;
const eur2 = (c) => `${(c / 100).toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const when = (t) => new Date(t).toLocaleString("ro-RO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const waited = (t) => {
  const m = Math.max(0, Math.round((Date.now() - t) / 60000));
  return m < 60 ? `${m} min` : m < 1440 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${Math.floor(m / 1440)} z ${Math.floor((m % 1440) / 60)} h`;
};
const COIN = `<i class="cx-coin" aria-hidden="true"></i>`;
const WALLET = `<svg class="cx-wallet" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H17a1 1 0 0 1 1 1v1.5h.5A1.5 1.5 0 0 1 20 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-12A2.5 2.5 0 0 1 4 17.5z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M4 7.5A2.5 2.5 0 0 0 6.5 10H20" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="16.5" cy="14.8" r="1.3" fill="currentColor"/></svg>`;
const TONE = { awaiting: "wait", review: "wait", pending: "wait", clarify: "warn", reconcile: "warn", approved: "ok", paid: "ok", payable: "pay", rejected: "bad", cancelled: "bad", refunded: "bad" };
const badge = (r) => `<span class="cx-badge ${TONE[r.status] ?? ""}">${esc(r.statusLabel)}</span>`;
const kindIc = (k) => `<span class="cx-kind ${k}" aria-hidden="true">${k === "buy" ? "↓" : "↑"}</span>`;

async function copy(text, btn, label) {
  try { await navigator.clipboard.writeText(text); }
  catch {
    const t = document.createElement("textarea"); t.value = text; t.style.position = "fixed"; t.style.opacity = "0";
    document.body.appendChild(t); t.select(); try { document.execCommand("copy"); } catch { /* ignoră */ } t.remove();
  }
  if (btn) { const old = btn.innerHTML; btn.innerHTML = "✓ Copiat"; btn.classList.add("done"); setTimeout(() => { btn.innerHTML = old; btn.classList.remove("done"); }, 1600); }
  DY().toast(`${label} copiat${label.endsWith("a") ? "ă" : ""}.`, true);
}
const ask = (q, min = 3) => { const v = prompt(q); if (v == null) return null; if (v.trim().length < min) { DY().toast(`Scrie cel puțin ${min} caractere.`); return null; } return v.trim(); };

// ---------- stratul ecranelor ----------
let layerEl = null;
function layer(cls) {
  if (!layerEl) {
    layerEl = document.createElement("div");
    layerEl.id = "cashier";
    document.body.appendChild(layerEl);
  }
  layerEl.className = `cx ${cls}`;
  document.body.classList.add("cx-open");
  return layerEl;
}
function closeLayer() {
  clearInterval(adminTimer);
  if (!layerEl) return;
  layerEl.remove(); layerEl = null;
  document.body.classList.remove("cx-open");
}

// ================= MEMBRU =================
const M = { data: null, clubId: localStorage.getItem("dyas.cx.club") || null, tab: "buy", pkg: 10, method: "bank", detail: null, filter: "all", editAcc: false };

async function openMember() {
  const L = layer("member");
  if (!L.querySelector(".cx-screen")) L.innerHTML = `<div class="screen cx-screen"><div class="cx-load"><div class="sk-row"></div><div class="sk-row"></div></div></div>`;
  try { M.data = await DY().api("GET", "/api/cashier"); } catch (e) { DY().toast(e.message); return; }
  if (!layerEl) return;
  const clubs = M.data.clubs;
  if (!clubs.some((c) => c.id === M.clubId)) M.clubId = clubs[0]?.id ?? null;
  paintMember();
}
const club = () => M.data.clubs.find((c) => c.id === M.clubId);

function paintMember() {
  const d = M.data, L = layerEl;
  if (!L) return;
  const top = (title, back = "#/") => `<div class="topbar cx-top"><a class="back" href="${back}" aria-label="Înapoi">←</a><h1>${title}</h1></div>`;
  if (!d.clubs.length) {
    L.innerHTML = `<div class="screen cx-screen">${top("Casierie")}
      <div class="cx-empty"><b>♠</b><h3>Ai nevoie de un club</h3>
      <p>Monedele DYAS aparțin mereu unui club: le cumperi într-un club și le folosești la mesele și turneele lui. Intră într-un club cu codul primit de la prieteni sau de la administrator.</p>
      <a class="btn primary" href="#/join"><svg class="arena-control-icon" aria-hidden="true"><use href="/control-icons.svg#key"></use></svg> Intră într-un club</a></div></div>`;
    return;
  }
  if (M.detail) return paintMemberDetail();
  const c = club();
  const clubPick = d.clubs.length > 1
    ? `<label class="cx-club"><span class="cx-emb">${esc(c.emblem)}</span><select data-club aria-label="Clubul">${d.clubs.map((x) => `<option value="${x.id}" ${x.id === c.id ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select><span class="chev">⌄</span></label>`
    : `<div class="cx-club one"><span class="cx-emb">${esc(c.emblem)}</span><b>${esc(c.name)}</b></div>`;
  L.innerHTML = `<div class="screen cx-screen" data-testid="cashier">
    ${top("Casierie")}
    ${clubPick}
    <div class="cx-bal" data-testid="cx-balance">
      <div><small>Sold disponibil</small><b data-testid="cx-available">${num(c.balance)} ${COIN}</b><em>${eur2(Math.round((c.balance * 100) / d.rate))}</em></div>
      <div class="sep"></div>
      <div><small>🔒 Rezervat</small><b data-testid="cx-reserved">${num(c.reserved)} ${COIN}</b><em>${eur2(Math.round((c.reserved * 100) / d.rate))}</em></div>
    </div>
    <div class="cx-seg" role="tablist">${[["buy", "Cumpără coins"], ["withdraw", "Retrage"], ["mine", "Cererile mele"]].map(([k, n]) => `<button type="button" role="tab" data-tab="${k}" class="${M.tab === k ? "on" : ""}">${n}</button>`).join("")}</div>
    <div class="cx-body">${{ buy: buyHtml, withdraw: withdrawHtml, mine: mineHtml }[M.tab]()}</div>
  </div>`;
  bindMember();
}

function buyHtml() {
  const d = M.data;
  if (d.mode !== "live" || !d.pay) return `<div class="cx-empty sm"><b>💶</b><h3>Casieria nu este deschisă încă</h3>
    <p>Administratorul aplicației nu a completat încă datele contului în care se plătește.${DY().me?.isAdmin ? "" : " Revino puțin mai târziu."}</p>
    ${DY().me?.isAdmin ? `<a class="btn primary" href="#/admin/casierie"><svg class="arena-control-icon" aria-hidden="true"><use href="/control-icons.svg#settings"></use></svg> Completează datele de plată</a>` : ""}</div>`;
  if (!d.pay.link) M.method = "bank";
  const p = d.packages.find((x) => x.eur === M.pkg) ?? d.packages[Math.min(1, d.packages.length - 1)];
  return `<h3 class="cx-h">Alege pachetul</h3>
    <div class="cx-pkgs">${d.packages.map((x) => `<button type="button" class="cx-pkg ${x.eur === p.eur ? "on" : ""}" data-pkg="${x.eur}" data-testid="cx-pkg">${COIN}<span><b>${x.eur} €</b><small>${num(x.coins)} coins</small></span></button>`).join("")}</div>
    <h3 class="cx-h">Cum plătești?</h3>
    <div class="cx-methods ${d.pay.link ? "" : "one"}">
      ${d.pay.link ? `<button type="button" class="cx-method ${M.method === "link" ? "on" : ""}" data-method="link"><b class="cx-mi">↗</b><span><b>Plătește prin link</b><small>${esc(d.pay.linkLabel)}</small></span></button>` : ""}
      <button type="button" class="cx-method ${M.method === "bank" ? "on" : ""}" data-method="bank"><b class="cx-mi">🏛️</b><span><b>Transfer bancar</b><small>IBAN + referință</small></span></button>
    </div>
    <div class="cx-sum"><span>Club</span><b>${esc(club().name)}</b><span>Primești</span><b>${num(p.coins)} coins</b><span>Plătești</span><b>${eur2(p.eur * 100)}</b></div>
    <button type="button" class="btn primary cx-go" data-buy data-testid="cx-buy">Cumpără ${num(p.coins)} coins (${p.eur} €)</button>
    <p class="cx-fine">Monedele intră în sold după ce administratorul confirmă încasarea. Cursul: 1 € = ${d.rate} coins, fără comision.</p>`;
}

function accountHtml() {
  const a = M.data.payout;
  if (a && !M.editAcc) return `<div class="cx-card cx-acc" data-testid="cx-account"><div class="row"><span class="grow"><small>Contul tău pentru retrageri</small><b>${esc(a.payee)}</b><b class="mono">${esc(a.iban)}</b></span>
    <button type="button" class="btn sm" data-acc-edit data-testid="cx-acc-edit">Schimbă</button></div></div>`;
  return `<form class="cx-card cx-form" data-accform autocomplete="off" data-testid="cx-accform"><h3 class="cx-h">${a ? "Schimbă contul pentru retrageri" : "Contul tău pentru retrageri"}</h3>
    <label>Titularul contului<input name="payee" value="${esc(a?.payee ?? "")}" placeholder="Nume și prenume, ca în bancă" autocomplete="name" data-testid="cx-payee"></label>
    <label>IBAN<input name="iban" value="${esc(a?.iban ?? "")}" placeholder="RO.. .... .... .... .... ...." autocapitalize="characters" spellcheck="false" data-testid="cx-iban"></label>
    <div class="row"><button class="btn primary grow" data-testid="cx-acc-save">Salvează contul</button>${a ? `<button type="button" class="btn" data-acc-cancel>Renunță</button>` : ""}</div>
    <p class="cx-fine">Banii din retrageri ajung în acest cont. Îl poți schimba oricând.</p></form>`;
}
function withdrawHtml() {
  const d = M.data, c = club();
  const acc = accountHtml();
  if (!c.eligible) return `${acc}<div class="cx-empty sm"><b>↑</b><h3>Nimic de retras în ${esc(c.name)}</h3>
    <p>Poți retrage doar monedele cumpărate prin casierie, cât timp sunt încă în soldul tău. Jetoanele primite de la administrator, câștigurile de la mese și jackpotul nu se pot retrage.</p></div>`;
  if (!d.payout || M.editAcc) return `${acc}<div class="cx-note">ℹ️ <span>Salvează mai întâi contul în care vrei să primești banii.</span></div>`;
  return `<div class="cx-note">ℹ️ <span>Poți retrage până la <b>${num(c.eligible)} coins</b> (${eur2(Math.round((c.eligible * 100) / d.rate))}) — monedele cumpărate prin casierie care sunt încă în sold.</span></div>
    ${acc}
    <form class="cx-form" data-wform autocomplete="off">
      <label>Monede de retras<div class="cx-in">${COIN}<input name="coins" inputmode="numeric" placeholder="ex. 1500" data-testid="cx-wcoins"><button type="button" class="btn sm" data-max>Max</button></div></label>
      <div class="cx-sum" data-wsum></div>
      <button class="btn primary cx-go" data-testid="cx-withdraw">Solicită retragerea</button>
    </form>`;
}
function wSummary(form) {
  const d = M.data, c = club();
  const coins = Math.floor(Number(String(form.coins.value).replace(/\D/g, "")) || 0);
  const net = Math.round((coins * 100) / d.rate), fee = Math.floor((net * d.feeBp) / 10000);
  const bad = coins > c.eligible ? "Mai mult decât poți retrage." : coins && coins < d.minWithdraw ? `Minimum ${d.minWithdraw} coins.` : "";
  form.querySelector("[data-wsum]").innerHTML = `<span>Club</span><b>${esc(c.name)}</b><span>Monede solicitate</span><b>${num(coins)} coins</b>
    ${d.feeBp ? `<span>Comision (${(d.feeBp / 100).toLocaleString("ro-RO")}%)</span><b>− ${eur2(fee)}</b>` : `<span>Comision</span><b class="pos">${eur2(0)}</b>`}<span>Primești</span><b class="big" data-testid="cx-net">${eur2(net - fee)}</b>
    <span>Îți rămân disponibile</span><b>${num(Math.max(0, c.balance - coins))} coins</b>${bad ? `<em class="neg">${bad}</em>` : ""}`;
  return { coins, net: net - fee, ok: coins >= d.minWithdraw && coins <= c.eligible };
}

function mineHtml() {
  const list = M.data.requests.filter((r) => M.filter === "all" || r.kind === M.filter);
  return `<div class="cx-seg sm">${[["all", "Toate"], ["buy", "Cumpărări"], ["withdraw", "Retrageri"]].map(([k, n]) => `<button type="button" data-filter="${k}" class="${M.filter === k ? "on" : ""}">${n}</button>`).join("")}</div>
    ${list.length ? `<div class="cx-list">${list.map((r) => `<button type="button" class="cx-row" data-open="${r.id}" data-testid="cx-req">${kindIc(r.kind)}
      <span class="grow"><b>${r.kind === "buy" ? "Cumpărare" : "Retragere"}</b><small>${eur2(r.kind === "buy" ? r.amountCents : r.amountCents - r.feeCents)} / ${num(r.coins)} coins · ${esc(r.club)}</small><small>${when(r.createdAt)} · ${esc(r.ref)}</small></span>
      ${badge(r)}<span class="chev">›</span></button>`).join("")}</div>` : `<div class="cx-empty sm"><p>Nicio cerere încă.</p></div>`}`;
}

function bindMember() {
  const L = layerEl;
  L.querySelector("[data-club]")?.addEventListener("change", (e) => { M.clubId = e.target.value; localStorage.setItem("dyas.cx.club", M.clubId); paintMember(); });
  L.querySelectorAll("[data-tab]").forEach((b) => (b.onclick = () => { M.tab = b.dataset.tab; paintMember(); }));
  L.querySelectorAll("[data-pkg]").forEach((b) => (b.onclick = () => { M.pkg = Number(b.dataset.pkg); paintMember(); }));
  L.querySelectorAll("[data-method]").forEach((b) => (b.onclick = () => { M.method = b.dataset.method; paintMember(); }));
  L.querySelectorAll("[data-filter]").forEach((b) => (b.onclick = () => { M.filter = b.dataset.filter; paintMember(); }));
  L.querySelectorAll("[data-open]").forEach((b) => (b.onclick = () => openDetail(Number(b.dataset.open))));
  const buyBtn = L.querySelector("[data-buy]");
  if (buyBtn) buyBtn.onclick = async () => {
    buyBtn.disabled = true;
    try {
      const r = await DY().api("POST", "/api/cashier/buy", { clubId: M.clubId, eur: M.pkg, method: M.method });
      M.data = await DY().api("GET", "/api/cashier");
      openDetail(r.id);
    } catch (e) { DY().toast(e.message); buyBtn.disabled = false; }
  };
  L.querySelector("[data-acc-edit]")?.addEventListener("click", () => { M.editAcc = true; paintMember(); });
  L.querySelector("[data-acc-cancel]")?.addEventListener("click", () => { M.editAcc = false; paintMember(); });
  const af = L.querySelector("[data-accform]");
  if (af) {
    af.iban.oninput = () => { const p = af.iban.selectionStart === af.iban.value.length; af.iban.value = af.iban.value.toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/(.{4})/g, "$1 ").trim(); if (p) af.iban.selectionStart = af.iban.value.length; };
    af.onsubmit = async (e) => {
      e.preventDefault();
      const btn = af.querySelector("button.primary"); btn.disabled = true;
      try { M.data.payout = (await DY().api("PUT", "/api/cashier/payout", { payee: af.payee.value, iban: af.iban.value })).payout; M.editAcc = false; DY().toast("Contul a fost salvat.", true); paintMember(); }
      catch (err) { DY().toast(err.message); btn.disabled = false; }
    };
  }
  const f = L.querySelector("[data-wform]");
  if (f) {
    const upd = () => wSummary(f);
    f.coins.oninput = () => { const v = f.coins.value.replace(/\D/g, ""); f.coins.value = v ? Number(v).toLocaleString("ro-RO") : ""; upd(); };
    f.querySelector("[data-max]").onclick = () => { f.coins.value = num(club().eligible); upd(); };
    upd();
    f.onsubmit = async (e) => {
      e.preventDefault();
      const s = upd();
      if (!s.ok) return DY().toast(s.coins ? "Verifică numărul de monede." : "Scrie câte monede retragi.");
      const acc = M.data.payout;
      if (!confirm(`Retragi ${num(s.coins)} coins din ${club().name}.\nPrimești ${eur2(s.net)} în contul ${acc.payee}, ${acc.iban}.\n\nMonedele se rezervă până la aprobare. Continui?`)) return;
      const btn = f.querySelector("button.cx-go"); btn.disabled = true;
      try {
        const r = await DY().api("POST", "/api/cashier/withdraw", { clubId: M.clubId, coins: s.coins, payee: acc.payee, iban: acc.iban });
        M.data = await DY().api("GET", "/api/cashier");
        DY().toast(`Cerere trimisă. ${num(s.coins)} coins sunt rezervate.`, true);
        openDetail(r.id);
      } catch (err) { DY().toast(err.message); btn.disabled = false; }
    };
  }
}

async function openDetail(id) {
  M.detail = { id, data: null };
  try { M.detail.data = await DY().api("GET", `/api/cashier/requests/${id}`); } catch (e) { M.detail = null; DY().toast(e.message); return paintMember(); }
  paintMemberDetail();
}
function steps(r, ev) {
  const at = (a) => ev.find((e) => e.action === a);
  const s = r.kind === "buy"
    ? [["Cerere creată", at("created")], ["Transfer declarat", at("sent")], [r.status === "rejected" ? "Respinsă" : r.status === "cancelled" ? "Anulată" : r.status === "clarify" ? "Necesită clarificare" : "Încasare verificată", at("approved") || at("rejected") || at("cancelled") || at("clarify"), "În curs de verificare"],
      [`${num(r.creditedCoins ?? r.coins)} coins alocate`, at("approved")]]
    : [["Cerere trimisă · monede rezervate", at("created")], [r.status === "rejected" ? "Respinsă · rezervă eliberată" : "Aprobare", at("payable") || at("rejected"), "În curs de verificare"],
      [r.status === "refunded" ? "Monede restituite" : r.status === "reconcile" ? "Necesită reconciliere" : "Plată", at("paid") || at("refunded") || at("reconcile"), "Transfer către contul tău"]];
  return `<ol class="cx-steps">${s.map(([t, e, wait]) => `<li class="${e ? "done" : ""}"><i></i><span><b>${t}</b><small>${e ? `${when(e.at)}${e.note ? ` · ${esc(e.note)}` : ""}` : wait ?? ""}</small></span></li>`).join("")}</ol>`;
}
function paintMemberDetail() {
  const { request: r, events: ev, pay } = M.detail.data, d = M.data, L = layerEl;
  const open = r.kind === "buy" && ["awaiting", "review", "clarify"].includes(r.status);
  const instr = open && pay ? (r.method === "link"
    ? `<div class="cx-card"><h3 class="cx-h">Plătește prin link</h3>
       <p class="cx-fine">Plătește exact <b>${eur2(r.amountCents)}</b> și scrie referința <b>${esc(r.ref)}</b> la mesaj.</p>
       <button type="button" class="btn cx-paylink" data-paylink>${esc(pay.linkLabel)} ↗</button>
       <div class="cx-kv"><span>Referință plată</span><b class="gold" data-testid="cx-ref">${esc(r.ref)}</b><button type="button" class="cx-copy" data-copy="ref">Copiază referința</button></div></div>`
    : `<div class="cx-card"><h3 class="cx-h">Transfer bancar</h3>
       <div class="cx-kv"><span>Beneficiar</span><b>${esc(pay.beneficiary)}</b></div>
       <div class="cx-kv"><span>IBAN</span><b class="mono" data-testid="cx-pay-iban">${esc(pay.iban)}</b><button type="button" class="cx-copy" data-copy="iban">Copiază IBAN</button></div>
       ${pay.bank ? `<div class="cx-kv"><span>Banca</span><b>${esc(pay.bank)}</b></div>` : ""}
       <div class="cx-kv"><span>Suma</span><b>${eur2(r.amountCents)}</b></div>
       <div class="cx-kv"><span>Referință plată</span><b class="gold" data-testid="cx-ref">${esc(r.ref)}</b><button type="button" class="cx-copy" data-copy="ref">Copiază referința</button></div>
       <p class="cx-fine">Scrie referința exact așa la detaliile plății, ca să găsim transferul.</p></div>`) : "";
  L.innerHTML = `<div class="screen cx-screen" data-testid="cx-detail">
    <div class="topbar cx-top"><button type="button" class="back" data-back aria-label="Înapoi">←</button><h1>${r.kind === "buy" ? "Cumpărare" : "Retragere"}</h1></div>
    <div class="cx-hero">${kindIc(r.kind)}<span class="grow"><small>${esc(r.club)} · ${esc(r.ref)}</small><b>${r.kind === "buy" ? eur2(r.amountCents) : `${num(r.coins)} coins`}</b>
      <em>${r.kind === "buy" ? `${num(r.coins)} coins` : `= ${eur2(r.amountCents - r.feeCents)}`}</em></span>${badge(r)}</div>
    ${r.kind === "withdraw" && r.status === "pending" ? (() => { const c = d.clubs.find((x) => x.id === r.clubId); return c ? `<div class="cx-bal"><div><small>Disponibile</small><b>${num(c.balance)} ${COIN}</b></div><div class="sep"></div><div><small>🔒 Rezervate</small><b>${num(c.reserved)} ${COIN}</b></div></div>` : ""; })() : ""}
    ${r.status === "clarify" ? `<div class="cx-note warn">⚠️ <span><b>Administratorul cere o clarificare:</b> ${esc(r.note ?? "")}</span></div>` : ""}
    ${r.status === "rejected" && r.note ? `<div class="cx-note bad">✕ <span><b>Motiv:</b> ${esc(r.note)}</span></div>` : ""}
    ${r.kind === "buy" && r.status === "approved" && r.receivedCents !== r.amountCents ? `<div class="cx-note warn">ℹ️ <span>Am primit ${eur2(r.receivedCents)}, așa că ai primit ${num(r.creditedCoins)} coins. ${esc(r.note ?? "")}</span></div>` : ""}
    ${r.status === "review" ? `<div class="cx-note">⏳ <span>Verificăm încasarea. Monedele apar în sold după confirmarea administratorului.</span></div>` : ""}
    ${instr}
    ${r.kind === "withdraw" ? `<div class="cx-card"><div class="cx-kv"><span>Beneficiar</span><b>${esc(r.payee)}</b></div><div class="cx-kv"><span>IBAN</span><b class="mono">${esc(r.iban)}</b></div>${r.payoutRef ? `<div class="cx-kv"><span>Referința plății</span><b>${esc(r.payoutRef)}</b></div>` : ""}</div>` : ""}
    ${r.status === "awaiting" ? `<button type="button" class="btn primary cx-go" data-sent data-testid="cx-sent">Am făcut transferul</button><button type="button" class="btn ghost cx-go" data-cancel>Anulează cererea</button>` : ""}
    <h3 class="cx-h">Stadiul cererii</h3>${steps(r, ev)}
  </div>`;
  L.querySelector("[data-back]").onclick = () => { M.detail = null; M.tab = "mine"; openMember(); };
  L.querySelectorAll("[data-copy]").forEach((b) => (b.onclick = () => (b.dataset.copy === "iban" ? copy(pay.iban.replace(/\s/g, ""), b, "IBAN") : copy(r.ref, b, "Referința"))));
  const pl = L.querySelector("[data-paylink]");
  if (pl) pl.onclick = () => { copy(r.ref, null, "Referința"); window.open(pay.link, "_blank", "noopener"); };
  const sent = L.querySelector("[data-sent]");
  if (sent) sent.onclick = async () => {
    sent.disabled = true;
    try { await DY().api("POST", `/api/cashier/requests/${r.id}/sent`); DY().toast("Mulțumim! Verificăm încasarea.", true); await refreshDetail(); }
    catch (e) { DY().toast(e.message); sent.disabled = false; }
  };
  const cancel = L.querySelector("[data-cancel]");
  if (cancel) cancel.onclick = async () => {
    if (!confirm("Anulezi cererea? Nu trimite bani pentru o cerere anulată.")) return;
    try { await DY().api("POST", `/api/cashier/requests/${r.id}/cancel`); await refreshDetail(); } catch (e) { DY().toast(e.message); }
  };
}
async function refreshDetail() { M.data = await DY().api("GET", "/api/cashier"); await openDetail(M.detail.id); }
// ================= ADMIN =================
const A = { view: "verify", q: "", club: "", status: "", days: "", data: null, detail: null };
let adminTimer = null;
const VIEWS = [["verify", "Încasări de verificat", "↓"], ["approve", "Retrageri de aprobat", "↑"], ["pay", "Aprobate de plătit", "€"], ["history", "Istoric", "🕘"]];

async function openAdmin() {
  layer("admin");
  if (!layerEl.querySelector(".cx-screen")) layerEl.innerHTML = `<div class="screen cx-screen"><div class="cx-load"><div class="sk-row"></div><div class="sk-row"></div></div></div>`;
  // panoul de dedesubt nu mai trebuie să se reîmprospăteze
  setTimeout(() => import("/admin.js?v=6").then((m) => m.stop()).catch(() => {}), 1500);
  await loadAdmin();
  clearInterval(adminTimer);
  adminTimer = setInterval(() => { if (!document.hidden && !A.detail && layerEl?.classList.contains("admin")) loadAdmin(true); }, 20000);
}
async function loadAdmin(quiet) {
  const p = new URLSearchParams({ view: A.view });
  for (const k of ["q", "club", "status", "days"]) if (A[k]) p.set(k, A[k]);
  try { A.data = await DY().api("GET", `/api/admin/cashier?${p}`); }
  catch (e) { if (!quiet) DY().toast(e.message); if (e.status === 403 && layerEl) layerEl.innerHTML = `<div class="screen cx-screen"><div class="topbar cx-top"><a class="back" href="#/admin">←</a><h1>Casierie</h1></div><div class="cx-empty"><p>${esc(e.message)}</p></div></div>`; return; }
  if (!layerEl || A.detail) return;
  if (quiet && document.activeElement?.closest?.(".cx-filters")) return; // nu întrerupe căutarea
  paintAdmin();
}
function paintAdmin() {
  const d = A.data, L = layerEl;
  const n = { verify: d.counts.verify, approve: d.counts.approve, pay: d.counts.pay, history: d.counts.history };
  const work = A.view !== "history";
  L.innerHTML = `<div class="screen cx-screen wide" data-testid="admin-cashier">
    <div class="topbar cx-top"><a class="back" href="#/admin" aria-label="Înapoi la Admin">←</a><h1>Admin · Casierie</h1><button type="button" class="btn sm cx-set" data-settings data-testid="cx-settings"><svg class="arena-control-icon" aria-hidden="true"><use href="/control-icons.svg#settings"></use></svg> Setări</button></div>
    <p class="sub cx-sub">Încasări și retrageri cu verificare manuală</p>
    ${d.mode !== "live" ? `<div class="cx-note warn">⚠️ <span><b>Casieria e închisă.</b> Membrii nu pot cumpăra până nu completezi titularul contului și IBAN-ul.</span><button type="button" class="btn sm" data-settings>Completează</button></div>` : ""}
    <div class="cx-tiles">${VIEWS.map(([k, t, ic]) => `<button type="button" class="cx-tile ${A.view === k ? "on" : ""}" data-view="${k}" data-testid="cx-view-${k}"><span class="ic">${ic}</span><span class="t">${t}</span>${k !== "history" ? `<b class="${n[k] ? "" : "zero"}">${n[k]}</b>` : `<b class="zero">${n.history}</b>`}</button>`).join("")}</div>
    ${d.counts.attention ? `<div class="cx-note warn">⚠️ <span><b>${d.counts.attention}</b> ${d.counts.attention === 1 ? "cerere necesită" : "cereri necesită"} clarificare sau reconciliere.</span><button type="button" class="btn sm" data-attn>Vezi</button></div>` : ""}
    <div class="cx-filters">
      <input type="search" data-q placeholder="Caută membru sau referință…" value="${esc(A.q)}" aria-label="Caută" data-testid="cx-search">
      <select data-f="club" aria-label="Club"><option value="">Toate cluburile</option>${d.clubs.map((c) => `<option value="${c.id}" ${A.club === c.id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select>
      <select data-f="status" aria-label="Stare"><option value="">Orice stare</option><option value="attention" ${A.status === "attention" ? "selected" : ""}>⚠️ Necesită atenție</option>${Object.entries(d.labels).map(([k, v]) => `<option value="${k}" ${A.status === k ? "selected" : ""}>${esc(v)}</option>`).join("")}</select>
      <select data-f="days" aria-label="Perioadă"><option value="">Oricând</option>${[[1, "Azi"], [7, "Ultimele 7 zile"], [30, "Ultimele 30 de zile"]].map(([v, t]) => `<option value="${v}" ${String(A.days) === String(v) ? "selected" : ""}>${t}</option>`).join("")}</select>
    </div>
    <div class="cx-listhead"><b>${VIEWS.find(([k]) => k === A.view)[1]} (${d.items.length})</b><small>${work ? "cele mai vechi primele" : "cele mai noi primele"}</small></div>
    ${d.items.length ? `<div class="cx-table" role="table">
      <div class="cx-tr head" role="row"><span>Membru</span><span>Club</span><span>Tip</span><span>Sumă</span><span>Coins</span><span>Stare</span><span>Așteaptă</span></div>
      ${d.items.map((r) => `<button type="button" class="cx-tr ${["clarify", "reconcile"].includes(r.status) ? "attn" : ""}" role="row" data-open="${r.id}" data-testid="cx-arow">
        <span class="who">${kindIc(r.kind)}<span><b>${esc(r.user)}</b><small>${esc(r.ref)}</small></span></span>
        <span class="club">♠ ${esc(r.club)}</span><span class="kind">${r.kind === "buy" ? "Cumpărare" : "Retragere"}</span>
        <span class="amt"><b>${eur2(r.kind === "buy" ? r.amountCents : r.amountCents - r.feeCents)}</b></span><span class="coins">${COIN} ${num(r.coins)}</span>
        <span class="st">${badge(r)}</span><span class="age">${["approved", "paid", "rejected", "cancelled", "refunded"].includes(r.status) ? when(r.updatedAt) : `de ${waited(r.createdAt)}`}</span></button>`).join("")}
    </div>` : `<div class="cx-empty sm"><p>${work ? "Nimic de rezolvat aici. 🎉" : "Nicio cerere."}</p></div>`}
  </div>`;
  L.querySelectorAll("[data-view]").forEach((b) => (b.onclick = () => { A.view = b.dataset.view; A.status = ""; loadAdmin(); }));
  L.querySelectorAll("[data-settings]").forEach((b) => (b.onclick = openSettings));
  L.querySelector("[data-attn]")?.addEventListener("click", () => { A.view = "history"; A.status = "attention"; A.q = ""; loadAdmin(); });
  let t;
  L.querySelector("[data-q]").oninput = (e) => { clearTimeout(t); t = setTimeout(() => { A.q = e.target.value.trim(); if (A.q && A.view !== "history") A.view = "history"; loadAdmin().then(() => { const i = layerEl?.querySelector("[data-q]"); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }); }, 350); };
  L.querySelectorAll("[data-f]").forEach((s) => (s.onchange = () => { A[s.dataset.f] = s.value; if (s.value && s.dataset.f === "status") A.view = "history"; loadAdmin(); }));
  L.querySelectorAll("[data-open]").forEach((b) => (b.onclick = () => openAdminDetail(Number(b.dataset.open))));
}

// ---------- setările casieriei: contul în care se plătește și regulile ----------
async function openSettings() {
  let st;
  try { st = await DY().api("GET", "/api/admin/cashier/settings"); } catch (e) { return DY().toast(e.message); }
  A.detail = { settings: true };
  const L = layerEl;
  L.innerHTML = `<div class="screen cx-screen" data-testid="cx-settings-screen">
    <div class="topbar cx-top"><button type="button" class="back" data-back aria-label="Înapoi">←</button><h1>Setări casierie</h1></div>
    <form class="cx-form" data-sform autocomplete="off">
      <div class="cx-card"><h3 class="cx-h">Contul în care plătesc membrii</h3>
        <label>Titularul contului<input name="beneficiary" value="${esc(st.beneficiary)}" placeholder="ex. Nume Prenume sau Firma SRL" data-testid="cx-s-benef"></label>
        <label>IBAN<input name="iban" value="${esc(st.iban)}" placeholder="RO.. .... .... .... .... ...." autocapitalize="characters" spellcheck="false" data-testid="cx-s-iban"></label>
        <label>Banca <span class="muted">(opțional)</span><input name="bank" value="${esc(st.bank)}" placeholder="ex. Banca Transilvania" data-testid="cx-s-bank"></label></div>
      <div class="cx-card"><h3 class="cx-h">Plata prin link <span class="muted">(opțional)</span></h3>
        <label>Linkul de plată<input name="payLink" value="${esc(st.payLink)}" inputmode="url" placeholder="https://revolut.me/..." data-testid="cx-s-link"></label>
        <label>Numele afișat<input name="linkLabel" value="${esc(st.linkLabel)}" placeholder="ex. Link Revolut"></label>
        <p class="cx-fine">Fără link, membrii văd doar transferul bancar.</p></div>
      <div class="cx-card"><h3 class="cx-h">Reguli</h3>
        <label>Coins pentru 1 €<input name="rate" type="number" inputmode="numeric" min="1" value="${st.rate}" data-testid="cx-s-rate"></label>
        <label>Pachete (€, separate prin virgulă)<input name="packages" value="${esc(st.packages.join(", "))}" placeholder="5, 10, 20, 50, 100" data-testid="cx-s-pkgs"></label>
        <label>Retragere minimă (coins)<input name="minWithdraw" type="number" inputmode="numeric" min="1" value="${st.minWithdraw}"></label>
        <label>Comision la retragere (%)<input name="feePct" type="number" inputmode="decimal" min="0" max="20" step="0.1" value="${st.feePct}"></label></div>
      <button class="btn primary cx-go" data-testid="cx-s-save">Salvează setările</button>
    </form></div>`;
  L.querySelector("[data-back]").onclick = () => { A.detail = null; loadAdmin(); };
  const f = L.querySelector("[data-sform]");
  f.iban.oninput = () => { const p = f.iban.selectionStart === f.iban.value.length; f.iban.value = f.iban.value.toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/(.{4})/g, "$1 ").trim(); if (p) f.iban.selectionStart = f.iban.value.length; };
  f.onsubmit = async (e) => {
    e.preventDefault();
    const btn = f.querySelector("button.cx-go"); btn.disabled = true;
    const v = (k) => f[k].value.trim();
    try {
      await DY().api("PUT", "/api/admin/cashier/settings", { beneficiary: v("beneficiary"), iban: v("iban"), bank: v("bank"), payLink: v("payLink"), linkLabel: v("linkLabel") || "Link de plată",
        rate: Number(v("rate")), packages: v("packages"), minWithdraw: Number(v("minWithdraw")), feePct: Number(v("feePct") || 0) });
      DY().toast("Setările casieriei au fost salvate.", true);
      A.detail = null; loadAdmin();
    } catch (err) { DY().toast(err.message); btn.disabled = false; }
  };
}

async function openAdminDetail(id) {
  try { A.detail = await DY().api("GET", `/api/admin/cashier/${id}`); } catch (e) { return DY().toast(e.message); }
  paintAdminDetail();
}
const parseEur = (v) => { const s = String(v).replace(/\s|€/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."); const n = Math.round(Number(s) * 100); return Number.isFinite(n) && n > 0 ? n : 0; };

function paintAdminDetail() {
  const { request: r, events: ev, member } = A.detail, L = layerEl;
  const buyOpen = r.kind === "buy" && ["awaiting", "review", "clarify"].includes(r.status);
  let act = "";
  if (buyOpen) act = `<div class="cx-card act"><h3 class="cx-h">Verifică încasarea</h3>
    <label>Suma încasată efectiv (€)<input data-recv inputmode="decimal" value="${(r.amountCents / 100).toLocaleString("ro-RO")}" data-testid="cx-recv"></label>
    <label>Referința bancară a încasării<input data-bref placeholder="ex. ID tranzacție din extras" data-testid="cx-bref"></label>
    <label data-reason-wrap hidden>Motivul diferenței (apare în istoric)<input data-reason placeholder="ex. A virat 10 € în loc de 20 €" data-testid="cx-reason"></label>
    <div class="cx-cmp"><div><small>Suma așteptată</small><b>${eur2(r.amountCents)}</b></div><div><small>Suma încasată</small><b data-recv-show>${eur2(r.amountCents)}</b></div><div class="gold"><small>Coins de alocat</small><b data-coins-show>${num(r.coins)}</b></div></div>
    <button type="button" class="btn primary cx-go" data-approve data-testid="cx-approve">Confirmă ${eur(r.amountCents)} și alocă ${num(r.coins)} coins</button>
    ${r.status !== "clarify" ? `<button type="button" class="btn ghost cx-go" data-clarify><svg class="arena-control-icon" aria-hidden="true"><use href="/control-icons.svg#chat"></use></svg> Necesită clarificare</button>` : ""}
    <button type="button" class="btn ghost cx-go danger" data-reject>✕ Respinge</button></div>`;
  else if (r.kind === "withdraw" && r.status === "pending") act = `<div class="cx-card act"><h3 class="cx-h">Aprobă retragerea</h3>
    <div class="cx-note">ℹ️ <span>Prin aprobare se consumă rezerva: <b>${num(r.coins)} coins</b> ies definitiv din contul membrului. Apoi faci transferul de <b>${eur2(r.amountCents - r.feeCents)}</b>.</span></div>
    <button type="button" class="btn primary cx-go" data-wapprove data-testid="cx-wapprove">✓ Aprobă și debitează ${num(r.coins)} coins</button>
    <button type="button" class="btn ghost cx-go danger" data-reject>✕ Respinge și eliberează rezerva</button></div>`;
  else if (r.kind === "withdraw" && ["payable", "reconcile"].includes(r.status)) act = `<div class="cx-card act"><h3 class="cx-h">${r.status === "reconcile" ? "Reconciliere" : "Confirmă plata"}</h3>
    ${r.status === "reconcile" ? `<div class="cx-note warn">⚠️ <span>${esc(r.note ?? "Rezultat incert al transferului.")}</span></div>` : ""}
    <div class="cx-kv"><span>Sumă de plătit</span><b>${eur2(r.amountCents - r.feeCents)}</b></div><div class="cx-kv"><span>Beneficiar</span><b>${esc(r.payee)}</b></div>
    <div class="cx-kv"><span>IBAN</span><b class="mono">${esc(r.iban.replace(/(.{4})/g, "$1 ").trim())}</b><button type="button" class="cx-copy" data-copy-iban>Copiază</button></div>
    <label>Referința plății făcute<input data-pref placeholder="ex. DYAS-PLATA-105" data-testid="cx-pref"></label>
    <button type="button" class="btn primary cx-go" data-paid data-testid="cx-paid">➤ Confirmă plata de ${eur(r.amountCents - r.feeCents)}</button>
    ${r.status === "payable" ? `<button type="button" class="btn ghost cx-go" data-reconcile><svg class="arena-control-icon" aria-hidden="true"><use href="/control-icons.svg#warn"></use></svg> Necesită reconciliere</button>`
      : `<button type="button" class="btn ghost cx-go" data-retry>↻ Reia plata</button><button type="button" class="btn ghost cx-go danger" data-refund><svg class="arena-control-icon" aria-hidden="true"><use href="/control-icons.svg#reload"></use></svg> Restituie ${num(r.coins)} coins (plata a eșuat)</button>`}</div>`;
  L.innerHTML = `<div class="screen cx-screen" data-testid="cx-adetail">
    <div class="topbar cx-top"><button type="button" class="back" data-back aria-label="Înapoi">←</button><h1>${buyOpen ? "Verifică încasarea" : r.kind === "buy" ? "Cumpărare" : r.status === "pending" ? "Aprobă retragerea" : r.status === "payable" ? "Confirmă plata" : "Retragere"}</h1></div>
    <div class="cx-hero">${kindIc(r.kind)}<span class="grow"><small>${esc(r.ref)} · ♠ ${esc(r.club)}</small><b>${esc(r.user)}</b><em>${r.kind === "buy" ? "Cumpărare" : "Retragere"} · ${eur2(r.amountCents)} · ${num(r.coins)} coins</em></span>${badge(r)}</div>
    <div class="cx-card">
      <div class="cx-kv"><span>Suma cerută</span><b>${eur2(r.amountCents)}</b></div>
      ${r.kind === "buy" ? `<div class="cx-kv"><span>Suma confirmată</span><b>${r.receivedCents != null ? eur2(r.receivedCents) : "—"}</b></div><div class="cx-kv"><span>Coins alocate</span><b>${r.creditedCoins != null ? num(r.creditedCoins) : "—"}</b></div>
        <div class="cx-kv"><span>Metodă</span><b>${r.method === "bank" ? "Transfer bancar" : "Link de plată"}</b></div><div class="cx-kv"><span>Referința bancară</span><b>${esc(r.bankRef ?? "—")}</b></div>`
        : `<div class="cx-kv"><span>Comision</span><b>${eur2(r.feeCents)}</b></div><div class="cx-kv"><span>Beneficiar</span><b>${esc(r.payee)}</b></div><div class="cx-kv"><span>IBAN</span><b class="mono">${esc(r.iban.replace(/(.{4})/g, "$1 ").trim())}</b></div><div class="cx-kv"><span>Referința plății</span><b>${esc(r.payoutRef ?? "—")}</b></div>`}
      <div class="cx-kv"><span>Curs</span><b>1 € = ${r.rate} coins</b></div>
      <div class="cx-kv"><span>Administrator</span><b>${esc(r.admin ?? "—")}</b></div>
      ${member ? `<div class="cx-kv"><span>Soldul membrului în club</span><b>${num(member.balance)} · 🔒 ${num(member.reserved)}</b></div>` : ""}
    </div>
    ${act}
    <h3 class="cx-h">Cronologie</h3>
    <ol class="cx-steps">${ev.map((e) => `<li class="done"><i></i><span><b>${esc(e.label)}</b><small>${when(e.at)}${e.by ? ` · ${esc(e.by)}` : ""}${e.note ? `<br>${esc(e.note)}` : ""}</small></span></li>`).join("")}</ol>
  </div>`;
  L.querySelector("[data-back]").onclick = () => { A.detail = null; loadAdmin(); };
  const run = async (btn, action, body, ok) => {
    btn.disabled = true;
    try { await DY().api("POST", `/api/admin/cashier/${r.id}/${action}`, body); DY().toast(ok, true); A.detail = null; await loadAdmin(); }
    catch (e) { DY().toast(e.message); btn.disabled = false; if (e.status === 409) openAdminDetail(r.id); }
  };
  const recv = L.querySelector("[data-recv]");
  if (recv) {
    const upd = () => {
      const c = parseEur(recv.value), coins = Math.floor((c * r.rate) / 100), diff = c !== r.amountCents;
      L.querySelector("[data-recv-show]").textContent = c ? eur2(c) : "—";
      L.querySelector("[data-coins-show]").textContent = num(coins);
      L.querySelector("[data-reason-wrap]").hidden = !diff;
      L.querySelector(".cx-cmp").classList.toggle("diff", diff);
      L.querySelector("[data-approve]").textContent = c ? `Confirmă ${eur(c)} și alocă ${num(coins)} coins` : "Scrie suma încasată";
      return { c, coins, diff };
    };
    recv.oninput = upd; upd();
    L.querySelector("[data-approve]").onclick = (e) => {
      const { c, coins, diff } = upd();
      const bankRef = L.querySelector("[data-bref]").value.trim(), reason = L.querySelector("[data-reason]").value.trim();
      if (!c) return DY().toast("Scrie suma încasată.");
      if (bankRef.length < 3) return DY().toast("Scrie referința bancară a încasării.");
      if (diff && reason.length < 5) return DY().toast("Scrie motivul diferenței.");
      if (!confirm(`Confirmi încasarea de ${eur2(c)} de la ${r.user} și aloci ${num(coins)} coins în ${r.club}?`)) return;
      run(e.currentTarget, "approve-buy", { receivedCents: c, bankRef, reason: diff ? reason : undefined }, `${num(coins)} coins alocate lui ${r.user}.`);
    };
  }
  L.querySelector("[data-clarify]")?.addEventListener("click", (e) => { const note = ask("Ce trebuie clarificat? (ex. plată neidentificată, sumă din afara pachetelor)"); if (note) run(e.currentTarget, "clarify", { note }, "Marcată: necesită clarificare."); });
  L.querySelector("[data-reject]")?.addEventListener("click", (e) => { const reason = ask(r.kind === "withdraw" ? "Motivul respingerii? Rezerva se eliberează integral." : "Motivul respingerii?"); if (reason) run(e.currentTarget, "reject", { reason }, r.kind === "withdraw" ? `Respinsă · ${num(r.coins)} coins eliberate.` : "Cerere respinsă."); });
  L.querySelector("[data-wapprove]")?.addEventListener("click", (e) => { if (confirm(`Aprobi și debitezi ${num(r.coins)} coins din contul lui ${r.user}?`)) run(e.currentTarget, "approve-withdraw", {}, "Aprobată · acum fă transferul."); });
  L.querySelector("[data-copy-iban]")?.addEventListener("click", (e) => copy(r.iban, e.currentTarget, "IBAN"));
  L.querySelector("[data-paid]")?.addEventListener("click", (e) => {
    const payoutRef = L.querySelector("[data-pref]").value.trim();
    if (payoutRef.length < 3) return DY().toast("Scrie referința plății făcute.");
    if (confirm(`Confirmi că ai plătit ${eur2(r.amountCents - r.feeCents)} către ${r.payee}?`)) run(e.currentTarget, "paid", { payoutRef }, "Plată confirmată.");
  });
  L.querySelector("[data-reconcile]")?.addEventListener("click", (e) => { const note = ask("Ce s-a întâmplat cu transferul?"); if (note) run(e.currentTarget, "reconcile", { note }, "Marcată pentru reconciliere."); });
  L.querySelector("[data-retry]")?.addEventListener("click", (e) => run(e.currentTarget, "retry", {}, "Plata se reia."));
  L.querySelector("[data-refund]")?.addEventListener("click", (e) => {
    const reason = ask(`Banca a confirmat eșecul? Descrie dovada. ${num(r.coins)} coins se întorc în soldul lui ${r.user}.`, 5);
    if (reason) run(e.currentTarget, "refund", { reason }, `${num(r.coins)} coins restituite.`);
  });
}

// ================= Acasă și Admin: punctele de intrare =================
function homeButton() {
  if (DY()?.view?.name !== "home") return;
  const h1 = [...$app.querySelectorAll(".screen > h1")].find((h) => h.textContent.startsWith("Salut"));
  if (!h1 || h1.parentElement.classList.contains("cx-hello")) return;
  const sub = h1.nextElementSibling?.classList.contains("sub") ? h1.nextElementSibling : null;
  const wrap = document.createElement("div");
  wrap.className = "cx-hello";
  h1.replaceWith(wrap);
  const a = document.createElement("a");
  a.href = "#/casierie"; a.className = "cx-btn"; a.dataset.testid = "cashier-btn";
  a.innerHTML = `${WALLET}<span>Casierie</span>`;
  wrap.append(h1, a);
  if (sub) wrap.append(sub);
}
let adminCounts = null, countsAt = 0;
async function adminTab() {
  if (DY()?.view?.name !== "admin") return;
  const tabs = $app.querySelector(".screen.admin .tabs");
  if (!tabs || tabs.querySelector("[data-cx-tab]")) return;
  const b = document.createElement("button");
  b.type = "button"; b.dataset.cxTab = ""; b.dataset.testid = "cx-admin-tab"; b.hidden = true;
  b.innerHTML = `💶 Casierie<span class="dot" data-cx-dot hidden></span>`;
  b.onclick = () => DY().go("#/admin/casierie");
  tabs.prepend(b);
  if (!adminCounts || Date.now() - countsAt > 30000) {
    try { adminCounts = (await DY().api("GET", "/api/admin/cashier?view=verify")).counts; countsAt = Date.now(); } catch { adminCounts = null; return; }
  }
  b.hidden = false;
  const n = adminCounts.verify + adminCounts.approve + adminCounts.pay;
  const dot = b.querySelector("[data-cx-dot]");
  dot.hidden = !n; dot.textContent = n;
}

function route() {
  const h = location.hash;
  if (!DY()?.token) return closeLayer();
  if (h === "#/casierie") { M.detail = null; return openMember(); }
  if (h === "#/admin/casierie") { A.detail = null; return openAdmin(); }
  closeLayer();
}
addEventListener("hashchange", route);
setTimeout(route, 300);

let queued = false;
new MutationObserver(() => {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => { queued = false; if (!DY()) return; homeButton(); adminTab(); });
}).observe($app, { childList: true, subtree: true });

window.dyCashier = { openMember, openAdmin };
