// DYAS Poker — panoul de administrare, tabul „Cluburi”: editarea clubului, a meselor și a turneelor,
// descrieri, resetarea jackpotului și ștergerea istoricului mâinilor. Încărcat de extra.js doar pentru administratori.
const D = window.DY;
const { api, esc, fmt, toast } = D;
const EMBLEMS = ["♠", "♥", "♦", "♣", "🃏", "👑", "🔥", "💎", "🦁", "🐺", "🦅", "⚡", "🎯", "🍀", "🌙", "⭐"];
const STATUS = { registering: "Înscrieri deschise", running: "În desfășurare", finished: "Terminat", cancelled: "Anulat" };
const confirmWord = (what, word = "STERGE") => {
  const v = prompt(`${what}\n\nAcțiunea nu se poate anula. Scrie „${word}” ca să confirmi:`);
  return v != null && v.trim().toUpperCase() === word;
};
const localInput = (d) => { const x = new Date(d); return new Date(x.getTime() - x.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const busy = async (btn, fn) => { btn.disabled = true; try { await fn(); } finally { btn.disabled = false; } };
const refreshClubs = () => window.dispatchEvent(new HashChangeEvent("hashchange"));

/** Cardul global: șterge istoricul mâinilor din toată aplicația. */
function globalCard(host) {
  if (host.querySelector("[data-mg-global]")) return;
  const anchor = host.querySelector('[data-testid="wipe-all"]');
  if (!anchor) return;
  anchor.insertAdjacentHTML("afterend", `<div class="card wipe-all" data-mg-global><div class="row"><div class="grow"><b>🧾 Șterge istoricul mâinilor din toată aplicația</b>
    <div class="small muted">Șterge mâinile jucate din toate cluburile. Clasamentele, statisticile și „Azi în club” pornesc de la zero. Jetoanele nu se schimbă.</div></div>
    <button type="button" class="btn sm danger" data-testid="hands-delete-all">Șterge istoricul</button></div></div>`);
  host.querySelector('[data-testid="hands-delete-all"]').onclick = (e) => busy(e.currentTarget, async () => {
    if (!confirmWord("Ștergi istoricul mâinilor din TOATE cluburile?")) return toast("Anulat.");
    try { const r = await api("POST", "/api/admin/hands/delete", {}); toast(`Am șters ${fmt(r.deleted)} mâini.`, true); } catch (err) { toast(err.message); }
  });
}

/** Adaugă la cardul unui club secțiunea de administrare. */
async function clubCard(card) {
  const id = card.querySelector("[data-bulk]")?.dataset.bulk;
  if (!id || card.dataset.mg) return;
  card.dataset.mg = "1";
  const name = card.querySelector(".grow > b")?.textContent || "";
  const emblem = card.querySelector(".emblem")?.textContent || "♠";

  // jackpot: resetare
  const jp = card.querySelector('[data-testid="club-jackpot"] .row');
  if (jp) {
    jp.insertAdjacentHTML("afterend", `<button type="button" class="btn sm mg-reset" data-testid="jackpot-reset">↺ Resetează jackpotul la 0</button>`);
    card.querySelector('[data-testid="jackpot-reset"]').onclick = (e) => busy(e.currentTarget, async () => {
      if (!confirm(`Resetezi jackpotul clubului „${name}” la 0? Jetoanele din jackpot dispar (nu ajung la nimeni).`)) return;
      try { const r = await api("POST", `/api/admin/clubs/${id}/jackpot/reset`); toast(`Jackpot resetat (${fmt(r.removed)} jetoane scoase).`, true); refreshClubs(); }
      catch (err) { toast(err.message); }
    });
  }

  // casa clubului: resetare
  const bk = card.querySelector('[data-testid="club-bank"] .row');
  if (bk) {
    bk.insertAdjacentHTML("afterend", `<button type="button" class="btn sm mg-reset" data-testid="bank-reset">↺ Resetează casa clubului la 0</button>`);
    card.querySelector('[data-testid="bank-reset"]').onclick = (e) => busy(e.currentTarget, async () => {
      if (!confirm(`Resetezi casa clubului „${name}” la 0? Jetoanele din casă dispar (nu ajung la nimeni).`)) return;
      try { const r = await api("POST", `/api/admin/clubs/${id}/bank/reset`); toast(`Casa clubului resetată (${fmt(r.removed)} jetoane scoase).`, true); refreshClubs(); }
      catch (err) { toast(err.message); }
    });
  }

  const box = document.createElement("details");
  box.className = "mg";
  box.dataset.testid = "club-manage";
  box.innerHTML = `<summary><svg class="arena-control-icon" aria-hidden="true"><use href="/control-icons.svg#edit"></use></svg> Editează clubul, mesele și turneele</summary><div class="mg-body"><div class="skel"><div class="sk-row"><i class="sk sk-av"></i><span class="sk-tx"><i class="sk sk-l"></i></span></div></div></div>`;
  card.querySelector(".danger-zone")?.before(box);
  let loaded = false;
  box.addEventListener("toggle", () => { if (box.open && !loaded) { loaded = true; paint(); } });

  async function paint() {
    const body = box.querySelector(".mg-body");
    let club, m;
    try { [club, m] = await Promise.all([api("GET", `/api/clubs/${id}`), api("GET", `/api/admin/clubs/${id}/manage`)]); }
    catch (e) { body.innerHTML = `<div class="small muted">${esc(e.message)}</div>`; return; }
    const c = club.club;
    body.innerHTML = `
      <form class="mg-sec" data-f="club">
        <h4>Clubul</h4>
        <div class="mg-row"><div class="grow"><label>Nume</label><input name="name" maxlength="40" value="${esc(c.name)}"></div>
          <div><label>Emblemă</label><select name="emblem">${EMBLEMS.map((e) => `<option ${e === (c.emblem || emblem) ? "selected" : ""}>${e}</option>`).join("")}</select></div></div>
        <label>Descriere <span class="muted">(se vede în club)</span></label>
        <textarea name="description" maxlength="600" rows="4" placeholder="ex.&#10;10.000 fise – 100€&#10;Joi seara de la 20:00">${esc(c.description || "")}</textarea>
        <button class="btn sm green">Salvează clubul</button></form>

      <div class="mg-sec"><h4>Mese · ${m.tables.length}</h4>
        ${m.tables.length ? m.tables.map((t) => `<details class="mg-item" data-testid="manage-table"><summary><b>${esc(t.name)}</b><span class="small muted">${fmt(t.sb)}/${fmt(t.bb)} · intrare ${t.buyInMin < t.buyIn ? `${fmt(t.buyInMin)}–${fmt(t.buyIn)}` : fmt(t.buyIn)} · ${t.seated}/${t.capacity}${t.description ? " · are descriere" : ""}</span></summary>
          <form data-f="table" data-id="${t.id}">
            <label>Nume</label><input name="name" maxlength="40" value="${esc(t.name)}">
            <div class="mg-grid"><div><label>Small blind</label><input name="sb" type="number" inputmode="numeric" min="1" value="${t.sb}"></div>
              <div><label>Big blind</label><input name="bb" type="number" inputmode="numeric" min="1" value="${t.bb}"></div>
              <div><label>Intrare minimă</label><input name="buyInMin" type="number" inputmode="numeric" min="100" max="200000" value="${t.buyInMin ?? t.buyIn}"></div>
              <div><label>Intrare maximă</label><input name="buyIn" type="number" inputmode="numeric" min="100" max="200000" value="${t.buyIn}"></div>
              <div><label>Locuri</label><select name="capacity">${[2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<option ${n === t.capacity ? "selected" : ""}>${n}</option>`).join("")}</select></div></div>
            <label>Descriere <span class="muted">(se vede la masă și în lista de mese)</span></label>
            <textarea name="description" maxlength="300" rows="3" placeholder="ex. Masă de seară · 10.000 fise – 100€">${esc(t.description)}</textarea>
            <div class="mg-btns"><button class="btn sm green">Salvează</button>
              <button type="button" class="btn sm danger" data-close="${t.id}" data-n="${t.seated}">Închide masa${t.seated ? ` (${t.seated} așezați)` : ""}</button></div>
            <small class="muted">Blindurile și intrarea noi se aplică de la mâna următoare.</small></form></details>`).join("") : `<div class="small muted">Nicio masă deschisă.</div>`}</div>

      <div class="mg-sec"><h4>Turnee · ${m.tourneys.length}</h4>
        ${m.tourneys.length ? m.tourneys.map((t) => `<details class="mg-item" data-testid="manage-tourney"><summary><b>🏆 ${esc(t.name)}</b><span class="small muted">${STATUS[t.status]} · ${t.players}/${t.maxPlayers}</span></summary>
          <form data-f="tourney" data-id="${t.id}">
            <label>Nume</label><input name="name" maxlength="50" value="${esc(t.name)}">
            ${t.status === "registering" && t.startMode === "scheduled" ? `<label>Data și ora de start</label><input name="startsAt" type="datetime-local" value="${localInput(t.startsAt)}">` : ""}
            <label>Descriere <span class="muted">(se vede în lobby-ul turneului)</span></label>
            <textarea name="description" maxlength="600" rows="4" placeholder="ex. Premii: locul 1 – 300€, locul 2 – 150€">${esc(t.description)}</textarea>
            <div class="mg-btns"><button class="btn sm green">Salvează</button>
              <a class="btn sm" href="#/tourney/${t.id}">Deschide lobby-ul</a>
              ${t.status === "registering" || t.status === "running" ? `<button type="button" class="btn sm danger" data-tcancel="${t.id}">Anulează turneul</button>` : ""}</div></form></details>`).join("") : `<div class="small muted">Niciun turneu în ultimele 30 de zile.</div>`}</div>

      <div class="mg-sec"><h4>Istoricul mâinilor</h4>
        <div class="row"><div class="grow small muted">${fmt(m.hands)} ${m.hands === 1 ? "mână jucată" : "mâini jucate"} în club. Ștergerea golește istoricul, clasamentul și statisticile clubului; jetoanele rămân.</div>
          <button type="button" class="btn sm danger" data-testid="hands-delete" ${m.hands ? "" : "disabled"}>Șterge istoricul</button></div></div>`;

    const form = (k) => body.querySelectorAll(`form[data-f="${k}"]`);
    form("club").forEach((f) => (f.onsubmit = async (e) => {
      e.preventDefault();
      try { await api("PATCH", `/api/admin/clubs/${id}/info`, { name: f.name.value, emblem: f.emblem.value, description: f.description.value }); toast("Clubul a fost salvat.", true); refreshClubs(); }
      catch (err) { toast(err.message); }
    }));
    form("table").forEach((f) => (f.onsubmit = async (e) => {
      e.preventDefault();
      try {
        await api("PATCH", `/api/admin/tables/${f.dataset.id}`, { name: f.name.value, sb: Number(f.sb.value), bb: Number(f.bb.value), buyInMin: Number(f.buyInMin.value), buyIn: Number(f.buyIn.value), capacity: Number(f.capacity.value), description: f.description.value });
        toast("Masa a fost salvată.", true); paint();
      } catch (err) { toast(err.message); }
    }));
    form("tourney").forEach((f) => (f.onsubmit = async (e) => {
      e.preventDefault();
      const b = { name: f.name.value, description: f.description.value };
      if (f.startsAt) b.startsAt = new Date(f.startsAt.value).toISOString();
      try { await api("PATCH", `/api/admin/tourneys/${f.dataset.id}`, b); toast("Turneul a fost salvat.", true); paint(); } catch (err) { toast(err.message); }
    }));
    body.querySelectorAll("[data-close]").forEach((b) => (b.onclick = () => busy(b, async () => {
      const n = Number(b.dataset.n);
      if (!confirm(n ? `Închizi masa? Cei ${n} jucători așezați sunt ridicați și primesc fisele înapoi în sold.` : "Închizi masa?")) return;
      try { const r = await api("POST", `/api/admin/tables/${b.dataset.close}/close`); toast(r.players ? `Masa a fost închisă. ${fmt(r.returned)} jetoane returnate.` : "Masa a fost închisă.", true); paint(); }
      catch (err) { toast(err.message); }
    })));
    body.querySelectorAll("[data-tcancel]").forEach((b) => (b.onclick = () => busy(b, async () => {
      if (!confirm("Anulezi turneul? Premiul revine în jackpot, iar taxele se dau înapoi jucătorilor.")) return;
      try { await api("POST", `/api/tourneys/${b.dataset.tcancel}/cancel`); toast("Turneul a fost anulat.", true); paint(); } catch (err) { toast(err.message); }
    })));
    const hd = body.querySelector('[data-testid="hands-delete"]');
    hd.onclick = () => busy(hd, async () => {
      if (!confirmWord(`Ștergi istoricul mâinilor clubului „${c.name}”?`)) return toast("Anulat.");
      try { const r = await api("POST", "/api/admin/hands/delete", { clubId: id }); toast(`Am șters ${fmt(r.deleted)} mâini.`, true); paint(); } catch (err) { toast(err.message); }
    });
  }
}

/** Apelat de extra.js la fiecare redesenare a tabului „Cluburi” din panou. */
export function enhance(root) {
  globalCard(root);
  root.querySelectorAll('[data-testid="admin-club"]').forEach(clubCard);
}
