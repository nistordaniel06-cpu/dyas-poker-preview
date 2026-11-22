// DYAS Poker — chatul: la masă, pentru tot clubul și mesajele private. Mesaje, poze și mesaje vocale. Se încarcă la nevoie (din app.js).
const D = window.DY;
const { esc, toast } = D;

if (!document.querySelector('link[href^="/chat.css"]')) {
  const l = document.createElement("link");
  l.rel = "stylesheet"; l.href = "/chat.css?v=2";
  document.head.appendChild(l);
}

const MAX_VOICE_MS = 60_000;
const S = { room: null, tableId: null, last: 0, del: 0, msgs: [], unread: 0, open: false, loaded: false, busy: null, media: new Map(), rec: null,
  canModerate: false, muted: false, mutedIds: [] };

const authFetch = (path) => fetch(path, { headers: { authorization: "Bearer " + D.token } });
const hhmm = (t) => new Date(t).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });
const secs = (ms) => { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
const setBadge = () => { if (S.room?.kind !== "dm") D.setChatBadge?.(S.unread); };
/** Camera: { kind: "table" | "club" | "dm", id, name? }. tableId păstrează cheia camerei curente. */
const keyOf = (room) => `${room.kind}:${room.id}`;
const base = () => (S.room.kind === "club" ? `/api/clubs/${S.room.id}` : S.room.kind === "dm" ? `/api/dm/${S.room.id}` : `/api/tables/${S.room.id}`);
const TITLE = { club: "💬 Chatul clubului", table: "💬 Chat la masă" };

/** Schimbarea mesei: se golește tot. */
function reset(room) {
  for (const u of S.media.values()) URL.revokeObjectURL(u);
  stopRecording(true);
  Object.assign(S, { room, tableId: keyOf(room), last: 0, del: 0, msgs: [], unread: 0, loaded: false, busy: null, media: new Map(), canModerate: false, muted: false, mutedIds: [] });
  el()?.remove();
  setBadge();
}

/** Apelat la fiecare stare nouă a mesei: dacă au apărut mesaje, le aduce (doar textul și datele, fișierele la cerere). */
export function sync(room, chatLast, chatDel = 0) {
  if (typeof room === "string") room = { kind: "table", id: room };
  if (keyOf(room) !== S.tableId) { reset(room); S.del = chatDel; }
  if (chatDel > S.del) { S.del = chatDel; return reload(); }
  if (chatLast > S.last || !S.loaded) fetchNew();
}

/** Un mesaj a fost șters: aducem din nou lista (mesajele noi nu se numără ca necitite a doua oară). */
async function reload() {
  if (S.busy) await S.busy;
  try {
    const r = await D.api("GET", `${base()}/chat`);
    applyMeta(r);
    const known = S.last;
    S.msgs = r.messages.slice(-120);
    S.last = Math.max(known, 0, ...r.messages.map((m) => m.id));
    for (const m of S.msgs) if (m.deleted) { const u = S.media.get(m.id); if (u) { URL.revokeObjectURL(u); S.media.delete(m.id); } }
    if (S.open) paintList(false);
  } catch { /* data viitoare */ }
}
function applyMeta(r) {
  const was = S.muted;
  S.canModerate = !!r.canModerate; S.muted = !!r.muted; S.mutedIds = r.mutedIds || [];
  if (was !== S.muted) paintMuted();
}

async function fetchNew() {
  if (S.busy) return S.busy;
  const tableId = S.tableId, path = base();
  S.busy = (async () => {
    try {
      const r = await D.api("GET", `${path}/chat?after=${S.last}`);
      if (tableId !== S.tableId) return;
      applyMeta(r);
      const fresh = r.messages.filter((m) => m.id > S.last);
      if (!fresh.length) { S.loaded = true; return; }
      S.msgs.push(...fresh);
      if (S.msgs.length > 120) S.msgs.splice(0, S.msgs.length - 120);
      S.last = Math.max(S.last, ...fresh.map((m) => m.id));
      // istoricul de la intrarea la masă nu se numără ca necitit
      if (S.loaded && !S.open) {
        const mine = D.me?.id;
        S.unread += fresh.filter((m) => m.userId !== mine).length;
        setBadge();
      }
      S.loaded = true;
      if (S.open) paintList(true);
    } catch { /* se reîncearcă la următoarea actualizare a mesei */ } finally { S.busy = null; }
  })();
  return S.busy;
}

const el = () => document.getElementById("chat");

export function open() {
  if (!S.tableId) return;
  S.open = true; S.unread = 0; setBadge();
  let root = el();
  if (!root) {
    root = document.createElement("div");
    root.id = "chat";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-label", S.room.kind === "dm" ? `Mesaje cu ${S.room.name || ""}` : S.room.kind === "club" ? "Chatul clubului" : "Chat la masă");
    root.dataset.kind = S.room.kind;
    root.innerHTML = `<div class="chat-backdrop" data-close></div>
      <section class="chat-panel" data-testid="chat-panel">
        <header class="chat-head"><b>${S.room.kind === "dm" ? `✉️ ${esc(S.room.name || "Mesaj privat")}` : TITLE[S.room.kind]}</b><button type="button" class="chat-x" data-close aria-label="Închide chatul">×</button></header>
        <div class="chat-list" data-testid="chat-list"></div>
        <div class="chat-rec" hidden data-testid="chat-rec"><span class="dot"></span><span class="t">0:00</span><span class="grow">Se înregistrează…</span>
          <button type="button" class="btn sm" data-rec-cancel>Anulează</button><button type="button" class="btn sm green" data-rec-send>Trimite</button></div>
        <div class="chat-muted" hidden data-testid="chat-muted">🔇 Chatul ți-a fost oprit în acest club. Poți citi mesajele, dar nu poți scrie.</div>
        <form class="chat-input" autocomplete="off">
          <button type="button" class="ci-btn" data-photo aria-label="Trimite o poză">📷</button>
          <input type="file" accept="image/*" hidden data-file>
          <input name="t" maxlength="500" placeholder="Scrie un mesaj…" aria-label="Mesaj" enterkeyhint="send">
          <button type="button" class="ci-btn" data-mic aria-label="Înregistrează un mesaj vocal">🎤</button>
          <button class="ci-btn send" data-send aria-label="Trimite" hidden>➤</button>
        </form>
      </section>`;
    document.body.appendChild(root);
    bind(root);
  }
  paintMuted();
  root.hidden = false;
  requestAnimationFrame(() => root.classList.add("on"));
  paintList(true);
  if (!S.loaded) fetchNew();
  // mesajele private nu au o masă care să anunțe mesajele noi: le aducem cât timp e deschisă conversația
  clearInterval(S.poll);
  if (S.room.kind === "dm") S.poll = setInterval(() => { if (!document.hidden) fetchNew(); }, 3000);
}

export function close() {
  S.open = false;
  clearInterval(S.poll);
  if (S.room?.kind === "dm") window.dispatchEvent(new Event("dy:dm-read"));
  stopRecording(true);
  const root = el();
  if (!root) return;
  root.classList.remove("on");
  setTimeout(() => { if (!S.open && el()) el().hidden = true; }, 220);
}

export const isOpen = () => S.open;

function bind(root) {
  root.querySelectorAll("[data-close]").forEach((b) => (b.onclick = close));
  const f = root.querySelector("form"), input = f.t, send = root.querySelector("[data-send]"), mic = root.querySelector("[data-mic]");
  const toggle = () => { const has = !!input.value.trim(); send.hidden = !has; mic.hidden = has; };
  input.oninput = toggle;
  f.onsubmit = async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = ""; toggle();
    await post({ kind: "text", text }, () => { input.value = text; toggle(); });
  };
  const file = root.querySelector("[data-file]");
  root.querySelector("[data-photo]").onclick = () => file.click();
  file.onchange = async () => {
    const fl = file.files[0];
    file.value = "";
    if (!fl) return;
    if (!fl.type.startsWith("image/")) return toast("Alege o poză.");
    try {
      setSending(true);
      const blob = await shrinkImage(fl);
      await post({ kind: "image", mime: "image/jpeg", data: await toBase64(blob) });
    } catch (e) { toast(e.message || "Poza nu a putut fi trimisă."); } finally { setSending(false); }
  };
  mic.onclick = startRecording;
  root.querySelector("[data-rec-cancel]").onclick = () => stopRecording(true);
  root.querySelector("[data-rec-send]").onclick = () => stopRecording(false);
  root.querySelector(".chat-list").onclick = (e) => {
    const mb = e.target.closest("[data-menu]");
    if (mb) return menu(Number(mb.dataset.menu), mb);
    const img = e.target.closest("img[data-media]");
    if (img?.src) viewer(img.src);
  };
}

function setSending(on) {
  el()?.querySelectorAll(".ci-btn").forEach((b) => (b.disabled = on));
  el()?.querySelector(".chat-panel")?.classList.toggle("sending", on);
}

async function post(body, onFail) {
  try {
    await D.api("POST", `${base()}/chat`, body);
    await fetchNew();
  } catch (e) {
    toast(e.message); onFail?.();
    if (e.code === "MUTED") { S.muted = true; paintMuted(); }
  }
}

function paintMuted() {
  const root = el();
  if (!root) return;
  root.querySelector(".chat-muted").hidden = !S.muted;
  root.querySelector("form").hidden = S.muted || !!S.rec;
  if (S.muted) stopRecording(true);
}

// ---------- moderare: ștergere, raportare, oprirea chatului ----------
function menu(id, anchor) {
  document.querySelector(".cm-menu")?.remove();
  const m = S.msgs.find((x) => x.id === id);
  if (!m || m.deleted) return;
  const mine = m.userId === D.me?.id;
  const items = [];
  if (mine || S.canModerate) items.push(["del", "🗑️ Șterge mesajul"]);
  if (!mine) items.push(["report", "🚩 Raportează"]);
  if (S.canModerate && !mine) items.push(S.mutedIds.includes(m.userId) ? ["unmute", `🔊 Pornește chatul lui ${esc(m.name)}`] : ["mute", `🔇 Oprește chatul lui ${esc(m.name)}`]);
  const box = document.createElement("div");
  box.className = "cm-menu"; box.dataset.testid = "chat-menu";
  box.innerHTML = items.map(([k, t]) => `<button type="button" data-do="${k}">${t}</button>`).join("");
  // poziția: lângă „⋯”, dar mereu întreg pe ecran (mesajele lungi împing „⋯” spre marginea din dreapta sau jos)
  const r = anchor.getBoundingClientRect(), vw = window.innerWidth, vh = window.visualViewport?.height ?? window.innerHeight, pad = 8;
  box.style.visibility = "hidden"; box.style.left = "0px"; box.style.top = "0px";
  document.body.appendChild(box);
  const bw = box.offsetWidth, bh = box.offsetHeight;
  const left = Math.min(Math.max(pad, mine ? r.right - bw : r.left), vw - bw - pad);
  const below = r.bottom + 4, above = r.top - bh - 4;
  const top = below + bh <= vh - pad ? below : above >= pad ? above : Math.max(pad, vh - bh - pad);
  box.style.left = `${Math.round(left)}px`; box.style.top = `${Math.round(top)}px`;
  box.style.visibility = "";
  const off = (e) => { if (!box.contains(e.target)) { box.remove(); document.removeEventListener("pointerdown", off, true); } };
  setTimeout(() => document.addEventListener("pointerdown", off, true));
  box.onclick = async (e) => {
    const k = e.target.closest("[data-do]")?.dataset.do;
    if (!k) return;
    box.remove(); document.removeEventListener("pointerdown", off, true);
    try {
      if (k === "del") {
        if (!confirmSoft("Ștergi mesajul pentru toată lumea?")) return;
        await D.api("DELETE", `/api/chat/${id}`);
        m.deleted = true; m.text = null; paintList(false);
        toast("Mesaj șters.", true);
      } else if (k === "report") {
        await D.api("POST", `/api/chat/${id}/report`);
        toast("Mulțumim! Administratorul va vedea raportarea.", true);
      } else {
        await D.api("POST", `${base()}/chat/mute`, { userId: m.userId, muted: k === "mute" });
        S.mutedIds = k === "mute" ? [...new Set([...S.mutedIds, m.userId])] : S.mutedIds.filter((x) => x !== m.userId);
        toast(k === "mute" ? `${m.name} nu mai poate scrie în chatul clubului.` : `${m.name} poate scrie din nou.`, true);
      }
    } catch (err) { toast(err.message); }
  };
}
const confirmSoft = (q) => { try { return window.confirm(q); } catch { return true; } };

// ---------- poze: micșorate în telefon înainte de trimitere ----------
function loadImage(file) {
  return new Promise((ok, fail) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); ok(img); };
    img.onerror = () => { URL.revokeObjectURL(url); fail(new Error("Poza nu a putut fi citită.")); };
    img.src = url;
  });
}
async function shrinkImage(file) {
  const img = await loadImage(file);
  const scale = Math.min(1, 1280 / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(img.naturalWidth * scale));
  c.height = Math.max(1, Math.round(img.naturalHeight * scale));
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  for (const q of [0.8, 0.65, 0.5]) {
    const blob = await new Promise((ok) => c.toBlob(ok, "image/jpeg", q));
    if (blob && blob.size <= 1_400_000) return blob;
  }
  throw new Error("Poza e prea mare.");
}
const toBase64 = (blob) => new Promise((ok, fail) => {
  const r = new FileReader();
  r.onload = () => ok(String(r.result).split(",")[1]);
  r.onerror = () => fail(new Error("Fișierul nu a putut fi citit."));
  r.readAsDataURL(blob);
});

// ---------- mesaje vocale ----------
function pickMime() {
  if (typeof MediaRecorder === "undefined") return null;
  return ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus", "audio/aac"].find((m) => MediaRecorder.isTypeSupported?.(m)) ?? "";
}
async function startRecording() {
  if (S.rec) return;
  const mime = pickMime();
  if (mime === null || !navigator.mediaDevices?.getUserMedia) return toast("Telefonul sau browserul nu poate înregistra mesaje vocale aici.");
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
  catch { return toast("Permite accesul la microfon din setările browserului."); }
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : undefined);
  const chunks = [];
  const R = (S.rec = { rec, stream, chunks, start: Date.now(), cancel: false, timer: null });
  rec.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data); };
  rec.onstop = async () => {
    stream.getTracks().forEach((t) => t.stop());
    clearInterval(R.timer);
    paintRec(false);
    if (S.rec === R) S.rec = null;
    if (R.cancel) return;
    const duration = Date.now() - R.start;
    if (duration < 800) return toast("Mesajul vocal e prea scurt.");
    const type = (rec.mimeType || mime || "audio/webm").split(";")[0];
    const blob = new Blob(chunks, { type });
    try { setSending(true); await post({ kind: "voice", mime: type, durationMs: Math.min(duration, MAX_VOICE_MS), data: await toBase64(blob) }); }
    finally { setSending(false); }
  };
  rec.start(250);
  paintRec(true);
  R.timer = setInterval(() => {
    const ms = Date.now() - R.start;
    const t = el()?.querySelector(".chat-rec .t");
    if (t) t.textContent = secs(ms);
    if (ms >= MAX_VOICE_MS) stopRecording(false);
  }, 250);
}
function stopRecording(cancel) {
  const R = S.rec;
  if (!R) return;
  R.cancel = cancel;
  if (R.rec.state !== "inactive") R.rec.stop(); else R.stream.getTracks().forEach((t) => t.stop());
}
function paintRec(on) {
  const root = el();
  if (!root) return;
  root.querySelector(".chat-rec").hidden = !on;
  root.querySelector("form").hidden = on || S.muted;
  if (on) root.querySelector(".chat-rec .t").textContent = "0:00";
}

// ---------- afișare ----------
function msgHtml(m, prev) {
  const mine = m.userId === D.me?.id;
  const grouped = prev && prev.userId === m.userId && m.at - prev.at < 120_000;
  let body = "";
  if (m.deleted) body = `<div class="txt del" data-testid="chat-deleted">🚫 Mesaj șters</div>`;
  else if (m.kind === "text") body = `<div class="txt">${esc(m.text)}</div>`;
  else if (m.kind === "image") body = `<img data-media="${m.id}" alt="Poză de la ${esc(m.name)}" class="loading">`;
  else if (m.kind === "voice") body = `<div class="voice"><span class="mi">🎤</span><audio data-media="${m.id}" controls preload="none"></audio><span class="dur">${secs(m.durationMs || 0)}</span></div>`;
  return `<div class="cm ${mine ? "mine" : ""} ${grouped ? "grouped" : ""}" data-testid="chat-msg" data-kind="${m.kind}">
    ${mine || grouped ? "" : `<span class="av sm">${m.avatar ? esc(m.avatar) : esc(String(m.name || "?")[0].toUpperCase())}</span>`}
    <div class="bubble">${mine || grouped ? "" : `<div class="who">${esc(m.name)}</div>`}${body}<div class="time">${hhmm(m.at)}${m.deleted ? "" : `<button type="button" class="cm-more" data-menu="${m.id}" aria-label="Opțiuni mesaj" data-testid="chat-more">⋯</button>`}</div></div></div>`;
}

function paintList(scroll) {
  const list = el()?.querySelector(".chat-list");
  if (!list) return;
  const nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
  list.innerHTML = S.msgs.length ? S.msgs.map((m, i) => msgHtml(m, S.msgs[i - 1])).join("")
    : `<div class="chat-empty">${S.loaded ? `${S.room.kind === "dm" ? `Niciun mesaj încă. Scrie-i lui ${esc(S.room.name || "")}, trimite o poză sau un mesaj vocal. Doar voi doi vedeți conversația.` : `Niciun mesaj încă${S.room.kind === "club" ? " în chatul clubului" : ""}. Scrie primul, trimite o poză sau un mesaj vocal.`}` : "Se încarcă…"}</div>`;
  list.querySelectorAll("[data-media]").forEach(loadMedia);
  if (scroll || nearBottom) list.scrollTop = list.scrollHeight;
}

async function loadMedia(node) {
  const id = Number(node.dataset.media);
  let url = S.media.get(id);
  if (!url) {
    try {
      const r = await authFetch(`/api/chat/media/${id}`);
      if (!r.ok) throw new Error();
      url = URL.createObjectURL(await r.blob());
      S.media.set(id, url);
    } catch { node.classList.add("failed"); return; }
  }
  node.src = url;
  node.classList.remove("loading");
  if (node.tagName === "IMG") node.onload = () => { const list = el()?.querySelector(".chat-list"); if (list && list.scrollHeight - list.scrollTop - list.clientHeight < 400) list.scrollTop = list.scrollHeight; };
}

function viewer(src) {
  const v = document.createElement("div");
  v.className = "chat-viewer";
  v.innerHTML = `<img src="${src}" alt=""><button type="button" aria-label="Închide">×</button>`;
  v.onclick = () => v.remove();
  document.body.appendChild(v);
}
