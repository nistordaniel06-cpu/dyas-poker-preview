const fmt = (n) => Number(n || 0).toLocaleString("ro-RO");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const FELT = `<i class="r1"></i><i class="r2"></i><i class="st"></i><i class="cloth"><b>DYAS POKER</b></i><i class="deco t"></i><i class="deco b"></i>`;
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

function cardHtml(c, extra = "", style = "") {
  const st = style ? ` style="${style}"` : "";
  if (c === null) return `<div class="pcard back ${extra}"${st}></div>`;
  if (!c) return `<div class="pcard slot ${extra}"></div>`;
  const r = c[0] === "T" ? "10" : c[0];
  const s = { s: "♠", h: "♥", d: "♦", c: "♣" }[c[1]];
  const cls = { s: "sp", h: "h", d: "d", c: "c" }[c[1]];
  return `<div class="pcard ${cls} ${extra}" data-card="${c}" data-suit="${s}"${st}><span class="r">${r}</span><span class="s">${s}</span></div>`;
}

const ACTION_LABEL = { fold: "Fold", check: "Check", call: "Call", raise: "Raise", bet: "Bet", "all-in": "All-in", "small blind": "SB", "big blind": "BB" };


const $app=document.getElementById('app'), T={anim:{board:{},bets:{}}},wsUp=true,CH={unread:0};const animAt=()=>null,firstFree=()=>0,renderPanel=()=>'';export {cardHtml};export function display(st){T.state=st;renderTable();}
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
  if (mine && mine.bet > 0 && live) {
    const a = animAt(T.anim.bets[s.mySeat], 380);
    seatsHtml += `<div class="betchip ${a ? "pop" : ""}" style="left:50%;top:79%;${a ?? ""}" data-testid="my-bet">${fmt(mine.bet)}</div>`;
  }

  const board = h ? h.board : [];
  const boardHtml = Array.from({ length: 5 }, (_, i) => { const a = board[i] ? animAt(T.anim.board[i], 560) : null; return cardHtml(board[i] || undefined, a ? "flip" : "", a ?? ""); }).join("");
  // jetoanele potului zboară spre câștigători
  if (h?.done && s.lastResult && !s.lastResult.presentation && winners.size) {
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

}