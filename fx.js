// Animații la masă: jetoanele pariate zboară spre pot, potul se strânge și pleacă la câștigător,
// mesaj la fiecare mână câștigată, „Ultimii 3” / „Heads-up”, iar la final trofeul câștigătorului mesei.
// Citește stările mesei din răspunsurile API (fără să schimbe app.js) și desenează peste masă, într-un strat separat.
const DY = () => window.DY;
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const fmt = (n) => (DY()?.fmt ? DY().fmt(n) : Number(n).toLocaleString("ro-RO"));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const frames = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
const pick = (a, k) => a[Math.abs(k) % a.length];

const FX = { id: null, st: null, alive: null, busy: Promise.resolve() };

// ---------- stratul de animații ----------
function layer() {
  let el = document.getElementById("fx");
  if (!el) { el = document.createElement("div"); el.id = "fx"; el.setAttribute("aria-hidden", "true"); document.body.appendChild(el); }
  return el;
}
const onTable = () => DY()?.view?.name === "table" && document.querySelector('[data-testid="table"]');
function center(el) { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }
function seatXY(seat, st) {
  const els = document.querySelectorAll(`[data-testid="seat-${seat}"]`);
  const el = [...els].find((e) => e.offsetParent) || els[0];
  if (el) return center(el.querySelector(".box") || el);
  if (st && seat === st.mySeat) { const m = document.querySelector('[data-testid="my-cards"]'); if (m) return center(m); }
  return null;
}
function potXY() { const p = document.querySelector('[data-testid="pot"]'); return p ? center(p) : [innerWidth / 2, innerHeight * 0.42]; }
const lerp = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
function betXY(seat, st) {
  if (st && seat === st.mySeat) { const b = document.querySelector('[data-testid="my-bet"]'); if (b) return center(b); }
  const s = seatXY(seat, st);
  return s ? lerp(s, potXY(), 0.42) : null;
}

// ---------- sunete scurte (respectă butonul de sunet al mesei) ----------
let ac = null;
const soundOn = () => localStorage.getItem("dyas.sound") !== "0";
function audio() { try { ac ||= new (window.AudioContext || window.webkitAudioContext)(); ac.resume?.(); return ac; } catch { return null; } }
document.addEventListener("pointerdown", audio, { once: true });
function clack(n = 2) {
  if (!soundOn() || !ac) return;
  try {
    for (let i = 0; i < n; i++) {
      const t = ac.currentTime + i * 0.055, len = 0.045;
      const buf = ac.createBuffer(1, ac.sampleRate * len, ac.sampleRate), d = buf.getChannelData(0);
      for (let j = 0; j < d.length; j++) d[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / d.length, 3);
      const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
      src.buffer = buf; f.type = "bandpass"; f.frequency.value = 3200 + Math.random() * 1200; f.Q.value = 2.5; g.gain.value = 0.5;
      src.connect(f).connect(g).connect(ac.destination); src.start(t);
    }
  } catch { /* fără sunet */ }
}
function tones(notes, step = 0.12, type = "triangle", vol = 0.18) {
  if (!soundOn() || !ac) return;
  try {
    const t0 = ac.currentTime;
    notes.forEach((f, i) => {
      const o = ac.createOscillator(), g = ac.createGain(), t = t0 + i * step;
      o.type = type; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + step * 2.4);
      o.connect(g).connect(ac.destination); o.start(t); o.stop(t + step * 2.6);
    });
  } catch { /* ignoră */ }
}
const vibe = (p) => { if (localStorage.getItem("dyas.vibe") !== "0") navigator.vibrate?.(p); };

// ---------- jetoane ----------
const tone = (amount, bb) => (amount >= bb * 50 ? "k" : amount >= bb * 10 ? "b" : amount >= bb * 3 ? "g" : "r");
function chip(cls) { const c = document.createElement("i"); c.className = `fx-chip ${cls}`; layer().appendChild(c); return c; }
/** Un teanc de jetoane zboară pe un arc de la `a` la `b`. */
function fly(a, b, { n = 3, color = "r", delay = 0, dur = 520, lift = 40, gap = 45, fade = false } = {}) {
  if (!a || !b) return Promise.resolve();
  const jobs = [];
  for (let i = 0; i < n; i++) {
    const c = chip(color);
    const j = (k) => (Math.random() - 0.5) * k;
    const x0 = a[0] + j(10), y0 = a[1] + j(8), x1 = b[0] + j(14), y1 = b[1] + j(10);
    const mx = (x0 + x1) / 2, my = Math.min(y0, y1) - lift;
    const anim = c.animate([
      { transform: `translate(${x0}px, ${y0}px) scale(.55)`, opacity: 0 },
      { transform: `translate(${(x0 + mx) / 2}px, ${(y0 + my) / 2}px) scale(1.08)`, opacity: 1, offset: 0.3 },
      { transform: `translate(${mx}px, ${my}px) scale(1.12)`, opacity: 1, offset: 0.55 },
      { transform: `translate(${x1}px, ${y1}px) scale(1)`, opacity: fade ? 0 : 1 },
    ], { duration: reduce ? 1 : dur, delay: reduce ? 0 : delay + i * gap, easing: "cubic-bezier(.3,.7,.35,1)", fill: "both" });
    jobs.push(anim.finished.catch(() => {}).then(() => { c.animate([{ opacity: fade ? 0 : 1 }, { opacity: 0 }], { duration: 180 }).finished.catch(() => {}).then(() => c.remove()); }));
  }
  return Promise.all(jobs);
}
function floatText(xy, html, cls = "") {
  if (!xy) return;
  const el = document.createElement("div");
  el.className = `fx-float ${cls}`; el.innerHTML = html;
  el.style.left = `${xy[0]}px`; el.style.top = `${xy[1] - 34}px`;
  layer().appendChild(el);
  setTimeout(() => el.remove(), 2200);
}
function burst(xy, n = 14) {
  if (!xy || reduce) return;
  for (let i = 0; i < n; i++) {
    const s = document.createElement("i");
    s.className = "fx-spark";
    const ang = (i / n) * Math.PI * 2 + Math.random() * 0.4, d = 34 + Math.random() * 30;
    s.style.left = `${xy[0]}px`; s.style.top = `${xy[1]}px`;
    layer().appendChild(s);
    s.animate([{ transform: "translate(-50%,-50%) scale(1)", opacity: 1 }, { transform: `translate(calc(-50% + ${Math.cos(ang) * d}px), calc(-50% + ${Math.sin(ang) * d}px)) scale(.2)`, opacity: 0 }],
      { duration: 700 + Math.random() * 300, easing: "cubic-bezier(.2,.8,.3,1)" }).finished.catch(() => {}).then(() => s.remove());
  }
}

// ---------- mesaje ----------
const HAND_TITLES = {
  "Chintă roială": ["Chintă roială!", "Legendar. Asta se vede o dată în viață."],
  "Chintă de culoare": ["Chintă de culoare!", "Rară ca un diamant pe postav."],
  "Careu": ["Careu!", "Patru din patru. Nimic de comentat."],
  "Full": ["Full house!", "Casă plină, pot plin."],
  "Culoare": ["Culoare!", "Cinci cărți, aceeași culoare, zero emoții."],
  "Chintă": ["Chintă!", "Cinci la rând, fix la timp."],
  "Trei de un fel": ["Trei de un fel!", "Tripla care a făcut diferența."],
  "Două perechi": ["Două perechi", "Dublu și sigur."],
  "Pereche": ["Mână câștigată", "O pereche a fost de ajuns."],
  "Carte mare": ["Mână câștigată", "Cu cartea mare, ca la carte."],
};
const FOLD_TITLES = [["Toți au cedat", "Nimeni n-a avut curaj să vadă."], ["Mâna e a lui", "Bluff sau nu? Nu vom ști niciodată."], ["Masa s-a predat", "Un pariu bine pus și gata."], ["Fără showdown", "Presiune maximă, pot câștigat."]];

function banner({ kicker = "", title, sub = "", cls = "", ms = 2600 }) {
  if (!onTable()) return Promise.resolve();
  const host = document.querySelector("#fw") || document.body;
  const r = host.getBoundingClientRect();
  const el = document.createElement("div");
  el.className = `fx-banner ${cls}`;
  el.style.left = `${r.left + r.width / 2}px`; el.style.top = `${r.top + r.height * 0.42}px`;
  el.innerHTML = `<div class="fx-rib">${kicker ? `<small>${kicker}</small>` : ""}<b>${title}</b>${sub ? `<span>${sub}</span>` : ""}</div>`;
  layer().appendChild(el);
  return wait(reduce ? 1500 : ms).then(() => { el.classList.add("out"); return wait(320); }).then(() => el.remove());
}

function handBanner(st) {
  const r = st.lastResult;
  const ws = r.winners || [];
  const name = (w) => esc(r.names?.[w.seat] ?? st.seats.find((s) => s.seat === w.seat)?.name ?? "?");
  const mine = ws.some((w) => w.seat === st.mySeat);
  const big = ws.reduce((a, w) => a + Number(w.amount), 0) >= st.table.bb * 50;
  if (ws.length > 1 && new Set(ws.map((w) => w.seat)).size > 1) {
    return banner({ kicker: "Pot împărțit", title: ws.map(name).join(" · "), sub: ws[0].hand ? `Egalitate cu ${esc(ws[0].hand)}` : "Fiecare își ia partea", cls: "split" });
  }
  const w = ws[0];
  const [t, s] = w.hand ? HAND_TITLES[w.hand] ?? ["Mână câștigată", ""] : pick(FOLD_TITLES, st.handNo);
  const kicker = mine ? "Ai câștigat!" : big ? "Pot uriaș" : w.hand ? "Showdown" : "Mână câștigată";
  const strong = ["Chintă roială", "Chintă de culoare", "Careu", "Full"].includes(w.hand);
  return banner({
    kicker: big && !mine ? "💰 Pot uriaș" : kicker,
    title: t,
    sub: `<em>${name(w)}</em> ia ${fmt(w.amount)}${s ? ` · ${s}` : ""}`,
    cls: `${mine ? "mine" : ""} ${strong ? "strong" : ""} ${big ? "big" : ""}`,
    ms: strong || big ? 3200 : 2600,
  });
}

function countBanner(n, st) {
  const tour = !!st.tourney;
  if (n === 3) {
    tones([392, 523, 659], 0.14, "sine", 0.12);
    return banner({ kicker: "♠ ♥ ♦", title: "Ultimii 3", sub: tour ? "Podiumul e aproape. Fiecare mână contează." : "Doar unul va ridica trofeul.", cls: "count three", ms: 3000 });
  }
  if (n === 2) {
    tones([330, 440, 660, 880], 0.12, "sawtooth", 0.07); vibe([60, 40, 60]);
    const left = st.seats.filter((s) => s.stack + (s.topup ?? 0) > 0).map((s) => esc(s.name));
    return banner({ kicker: "⚔️ Față în față", title: "Heads-up!", sub: left.length === 2 ? `<em>${left[0]}</em> vs <em>${left[1]}</em> · doar unul rămâne` : "Doar unul rămâne în picioare.", cls: "count two", ms: 3200 });
  }
  return Promise.resolve();
}

// ---------- trofeul câștigătorului mesei ----------
const CUP = `<svg class="fx-cup" viewBox="0 0 160 180" aria-hidden="true">
  <defs>
    <linearGradient id="fxg" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#8a5a12"/><stop offset=".28" stop-color="#ffe9a3"/><stop offset=".5" stop-color="#f2c44f"/><stop offset=".78" stop-color="#fff3c8"/><stop offset="1" stop-color="#9b6514"/></linearGradient>
    <linearGradient id="fxg2" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#ffe7a0"/><stop offset="1" stop-color="#a06a16"/></linearGradient>
  </defs>
  <path d="M38 34 C10 34 8 76 46 88" fill="none" stroke="url(#fxg2)" stroke-width="9" stroke-linecap="round"/>
  <path d="M122 34 C150 34 152 76 114 88" fill="none" stroke="url(#fxg2)" stroke-width="9" stroke-linecap="round"/>
  <path d="M34 22 H126 V48 C126 84 104 106 80 108 C56 106 34 84 34 48 Z" fill="url(#fxg)"/>
  <path d="M34 22 H126 V30 H34 Z" fill="#fff6d6" opacity=".55"/>
  <path d="M52 34 C52 70 62 92 76 100" fill="none" stroke="#fff" stroke-width="4" opacity=".45" stroke-linecap="round"/>
  <text x="80" y="76" text-anchor="middle" font-size="34" fill="#7a4a0c" opacity=".85">♠</text>
  <rect x="72" y="106" width="16" height="22" fill="url(#fxg2)"/>
  <path d="M56 128 H104 L110 144 H50 Z" fill="url(#fxg)"/>
  <rect x="42" y="144" width="76" height="20" rx="4" fill="#3a2410"/>
  <rect x="50" y="149" width="60" height="10" rx="2" fill="url(#fxg)"/>
</svg>`;
function trophy({ name, amount, tourneyName, mine }) {
  document.querySelector(".fx-trophy")?.remove();
  const el = document.createElement("div");
  el.className = "fx-trophy"; el.dataset.testid = "fx-trophy";
  let conf = "";
  if (!reduce) for (let i = 0; i < 46; i++) {
    const c = ["#f2c44f", "#ffe9a3", "#e64a4a", "#3fb37f", "#4d8bf0", "#fff"][i % 6];
    conf += `<i style="left:${Math.random() * 100}%;background:${c};animation-delay:${(Math.random() * 1.6).toFixed(2)}s;animation-duration:${(2.6 + Math.random() * 1.8).toFixed(2)}s;--r:${(Math.random() * 720 - 360) | 0}deg"></i>`;
  }
  const lines = tourneyName
    ? [`Câștigătorul turneului`, `„${esc(tourneyName)}”`]
    : [mine ? "Ai rămas singur la masă cu toate jetoanele." : "Ultimul rămas în picioare. Toate jetoanele sunt ale lui.", amount ? `${fmt(amount)} jetoane` : ""];
  el.innerHTML = `<div class="fx-conf">${conf}</div><div class="fx-tbox" role="dialog" aria-label="Câștigătorul mesei">
    <div class="fx-rays"></div>${CUP}
    <small class="fx-kick">${tourneyName ? "🏆 Campionul turneului" : "🏆 Campionul mesei"}</small>
    <div class="fx-name">${esc(name)}</div>
    <div class="fx-line">${lines[0]}</div>${lines[1] ? `<div class="fx-amt">${lines[1]}</div>` : ""}
    <button type="button" class="fx-ok">${mine ? "Sunt cel mai tare 😎" : "Felicitări! 👏"}</button></div>`;
  document.body.appendChild(el);
  tones([523, 659, 784, 1047, 784, 1047, 1319], 0.13, "triangle", 0.2);
  vibe([80, 60, 80, 60, 200]);
  const close = () => { el.classList.add("out"); setTimeout(() => el.remove(), 400); };
  el.querySelector(".fx-ok").onclick = close;
  setTimeout(close, 10000);
  return wait(600);
}

// ---------- diferențele dintre două stări ----------
const alive = (st) => (st.tourney ? (st.tme?.alive ?? null) : st.seats.filter((s) => s.stack + (s.topup ?? 0) > 0).length);

async function play(prev, st) {
  await frames();
  if (!onTable()) return;
  const h = st.hand, ph = prev.hand;
  const same = ph && h && prev.handNo === st.handNo;
  const bb = st.table.bb || 1;

  // mână nouă: blindurile se pun pe masă
  if (h && !h.done && !same) {
    for (const p of h.players) if (p.bet > 0) fly(seatXY(p.seat, st), betXY(p.seat, st), { n: 2, color: tone(p.bet, bb), dur: 420, lift: 20 });
    clack(2);
  }
  // pariuri noi: jetoanele pleacă din fața jucătorului spre locul pariului
  if (same && h && !h.done) {
    let any = false;
    for (const p of h.players) {
      const old = ph.players.find((x) => x.seat === p.seat);
      const add = p.bet - (old?.bet ?? 0);
      if (add > 0) {
        any = true;
        const n = p.allIn ? 6 : add >= bb * 8 ? 4 : add >= bb * 3 ? 3 : 2;
        fly(seatXY(p.seat, st), betXY(p.seat, st), { n, color: tone(add, bb), dur: 460, lift: 26 });
        if (p.allIn && !old?.allIn) { floatText(seatXY(p.seat, st), "ALL-IN", "allin"); tones([220, 330, 494], 0.09, "square", 0.06); }
      }
    }
    if (any) clack(3);
  }

  // stradă nouă (sau finalul mâinii): pariurile se strâng în pot
  const runoutStart = same && h.runout && !ph.runout;
  const streetEnd = same && (h.board.length > ph.board.length || (h.done && !ph.done) || runoutStart);
  if (streetEnd) {
    const pot = potXY();
    let k = 0;
    for (const p of ph.players) if (p.bet > 0) fly(betXY(p.seat, st), pot, { n: 3, color: tone(p.bet, bb), dur: 420, delay: k++ * 60, lift: 10, fade: true });
    if (k) { clack(4); await wait(reduce ? 0 : 460); }
  }
  // toți sunt all-in: cărțile se întorc, iar ale mesei vin pe rând
  if (runoutStart) { floatText(potXY(), "⚡ ALL-IN · cărțile pe față", "allin"); tones([262, 330, 392, 523], 0.1, "triangle", 0.12); vibe([40, 30, 40]); }

  // mâna s-a terminat: potul zboară la câștigător, apoi mesajul
  const ended = h?.done && st.lastResult && !(same && ph.done);
  if (!ended) return;
  const r = st.lastResult, pot = potXY();
  const flights = [];
  for (const w of r.winners || []) {
    const to = seatXY(w.seat, st);
    const n = Math.min(14, 5 + Math.round(Math.log2(1 + Number(w.amount) / bb)));
    flights.push(fly(pot, to, { n, color: tone(Number(w.amount), bb), dur: 640, gap: 55, lift: 60 }).then(() => {
      burst(to); floatText(to, `+${fmt(w.amount)}`, w.seat === st.mySeat ? "plus mine" : "plus");
    }));
  }
  setTimeout(() => clack(6), reduce ? 0 : 250);
  await Promise.all(flights);

  // câștigătorul mesei: un singur jucător mai are jetoane (la turneu: turneul s-a terminat)
  const n = alive(st), before = FX.alive;
  const champSeat = st.seats.filter((s) => s.stack + (s.topup ?? 0) > 0);
  const tourDone = st.tourney && (st.tourney.status === "finished" || st.tme?.alive === 1);
  const cashDone = !st.tourney && h.players.length >= 2 && champSeat.length === 1 && h.players.some((p) => p.stack <= 0);
  FX.alive = n;
  if (tourDone || cashDone) {
    const w = champSeat[0] ?? st.seats.find((s) => s.seat === r.winners?.[0]?.seat);
    if (w) { await wait(reduce ? 400 : 2200); return trophy({ name: w.name, amount: w.stack + (w.topup ?? 0), tourneyName: st.tourney ? st.tourney.name : null, mine: w.userId === DY()?.me?.id }); }
  }
  await handBanner(st);
  if (before != null && n != null && n < before && (n === 3 || n === 2)) await countBanner(n, st);
}

function feed(tableId, st) {
  if (!st || st.t !== "table" || st.table?.id !== tableId) return;
  const prev = FX.st;
  if (FX.id !== tableId || !prev) { FX.id = tableId; FX.st = st; FX.alive = alive(st); return; } // intrarea la masă: fără animații
  if (st.rev < prev.rev || (st.rev === prev.rev && st.handNo === prev.handNo)) return;
  FX.st = st;
  FX.busy = FX.busy.then(() => play(prev, st)).catch((e) => console.warn("fx", e));
}

// răspunsurile API ale mesei trec pe aici înainte să ajungă la aplicație
const nativeFetch = window.fetch.bind(window);
window.fetch = async (...args) => {
  const res = await nativeFetch(...args);
  try {
    const url = String(args[0]?.url ?? args[0]);
    const m = url.match(/\/api\/tables\/([0-9a-f-]{36})(?:\/(act|ready|sit|leave|kick|extend|topup))?(?:\?|$)/i);
    if (m && res.ok) res.clone().json().then((j) => feed(m[1], j?.t === "table" ? j : j?.state)).catch(() => {});
  } catch { /* nu blochează aplicația */ }
  return res;
};
addEventListener("hashchange", () => { if (!location.hash.startsWith("#/table/")) { FX.id = null; FX.st = null; } });

// pentru previzualizări: window.dyFx.demo("bet" | "win" | "three" | "two" | "trophy")
window.dyFx = {
  async demo(kind) {
    const st = FX.st; if (!st) return;
    const seats = st.seats.map((s) => s.seat), bb = st.table.bb;
    const other = seats.find((s) => s !== st.mySeat) ?? seats[0];
    if (kind === "bet") for (const [i, s] of seats.entries()) fly(seatXY(s, st), betXY(s, st), { n: 2 + i, color: ["r", "g", "b", "k"][i % 4], delay: i * 120 });
    if (kind === "collect") for (const s of seats) fly(betXY(s, st), potXY(), { n: 3, color: "g", fade: true });
    if (kind === "win") { const to = seatXY(other, st); await fly(potXY(), to, { n: 10, color: "b", dur: 640, gap: 55, lift: 60 }); burst(to); floatText(to, `+${fmt(bb * 64)}`, "plus"); }
    if (kind === "banner") { const name = st.seats.find((s) => s.seat === other)?.name; banner({ kicker: "Showdown", title: "Full house!", sub: `<em>${esc(name)}</em> ia ${fmt(bb * 64)} · Casă plină, pot plin.`, cls: "strong", ms: 60000 }); }
    if (kind === "fold") { const name = st.seats.find((s) => s.seat === other)?.name; banner({ kicker: "Mână câștigată", title: "Toți au cedat", sub: `<em>${esc(name)}</em> ia ${fmt(bb * 6)} · Nimeni n-a avut curaj să vadă.`, ms: 60000 }); }
    if (kind === "three") banner({ kicker: "♠ ♥ ♦", title: "Ultimii 3", sub: "Doar unul va ridica trofeul.", cls: "count three", ms: 60000 });
    if (kind === "two") { const [a, b] = st.seats.map((s) => esc(s.name)); banner({ kicker: "⚔️ Față în față", title: "Heads-up!", sub: `<em>${a}</em> vs <em>${b}</em> · doar unul rămâne`, cls: "count two", ms: 60000 }); }
    if (kind === "trophy") { const w = st.seats[0]; trophy({ name: w.name, amount: st.seats.reduce((a, s) => a + s.stack, 0), mine: false }); }
  },
};
