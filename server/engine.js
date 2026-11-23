import {describe} from "../settlement.mjs";
// Motorul unei mâini de No-Limit Texas Hold'em. Fără I/O: serverul îl apelează și salvează rezultatul.
import { newDeck, shuffle, bestHand } from "./cards.js";

export const STREETS = ["preflop", "flop", "turn", "river"];

/**
 * Ordinea locurilor e crescătoare după numărul locului, în sensul acelor de ceasornic.
 * Returnează dealerul pentru mâna următoare: primul loc eligibil după dealerul anterior.
 */
export function nextDealer(eligibleSeats, prevDealer) {
  const s = [...eligibleSeats].sort((a, b) => a - b);
  if (!s.length) return null;
  if (prevDealer == null) return s[0];
  return s.find((x) => x > prevDealer) ?? s[0];
}

/** Pozițiile pentru o listă de locuri și un dealer (heads-up: dealerul pune small blind). */
export function positions(seats, dealer) {
  const s = [...seats].sort((a, b) => a - b);
  const di = s.indexOf(dealer);
  if (di < 0) throw new Error("dealer not seated");
  const at = (k) => s[(di + k) % s.length];
  if (s.length === 2) return { dealer, sb: at(0), bb: at(1) };
  return { dealer, sb: at(1), bb: at(2) };
}

export class Hand {
  /**
   * @param {object} o
   * @param {{seat:number,userId:string,name?:string,stack:number}[]} o.players
   * @param {number} o.dealer   locul dealerului
   * @param {number} o.sb
   * @param {number} o.bb
   * @param {string[]} [o.deck] pachet fix (pentru teste)
   * @param {number} [o.rakeBp] comisionul casei în puncte de bază (200 = 2%); se ia doar dacă s-a ajuns la flop
   * @param {boolean} [o.pace] all-in fără alte pariuri posibile: cărțile mesei se întorc pe rând (runoutStep), nu toate deodată
   */
  constructor({ players, dealer, sb, bb, deck, rakeBp = 0, pace = false }) {
    this.pace = pace;
    if (players.length < 2) throw new Error("need 2 players");
    this.sbAmt = sb;
    this.bbAmt = bb;
    this.rakeBp = rakeBp;
    this.rake = 0;
    this.deck = deck ? deck.slice() : shuffle(newDeck());
    this.players = players
      .map((p) => ({ seat: p.seat, userId: p.userId, name: p.name ?? "", stack: p.stack, startStack: p.stack,
        bet: 0, total: 0, folded: false, allIn: false, acted: false, seen: -1, cards: [], lastAction: null }))
      .sort((a, b) => a.seat - b.seat);
    const pos = positions(this.players.map((p) => p.seat), dealer);
    this.dealer = pos.dealer;
    this.sbSeat = pos.sb;
    this.bbSeat = pos.bb;
    this.board = [];
    this.street = "preflop";
    this.done = false;
    this.result = null;
    this.log = [];
    this.fullRaises = 0;
    this.currentBet = 0;
    this.minRaise = bb;
    this.turn = null;
    this.actionSeq = 0;
  }

  p(seat) { return this.players.find((x) => x.seat === seat); }
  idx(seat) { return this.players.findIndex((x) => x.seat === seat); }
  draw() { return this.deck.shift(); }

  start() {
    // două cărți fiecăruia, începând cu cel din stânga dealerului
    const di = this.idx(this.dealer);
    for (let r = 0; r < 2; r++)
      for (let k = 1; k <= this.players.length; k++) this.players[(di + k) % this.players.length].cards.push(this.draw());
    this.post(this.p(this.sbSeat), this.sbAmt, "small blind");
    this.post(this.p(this.bbSeat), this.bbAmt, "big blind");
    this.currentBet = this.bbAmt;
    this.minRaise = this.bbAmt;
    // primul la acțiune: heads-up dealerul (SB), altfel cel de după BB
    const first = this.players.length === 2 ? this.sbSeat : this.nextFrom(this.bbSeat, (p) => this.canAct(p));
    this.turn = first ?? null;
    this.afterAction(true);
    return this;
  }

  post(p, amt, label) {
    const a = Math.min(amt, p.stack);
    p.stack -= a; p.bet += a; p.total += a;
    if (p.stack === 0) p.allIn = true;
    p.lastAction = label;
    this.log.push({ seat: p.seat, action: label, amount: a });
  }

  canAct(p) { return !p.folded && !p.allIn; }
  live() { return this.players.filter((p) => !p.folded); }

  /** Primul loc după `seat` (exclusiv) care îndeplinește condiția. */
  nextFrom(seat, pred) {
    const n = this.players.length;
    const i0 = this.idx(seat);
    for (let k = 1; k <= n; k++) {
      const p = this.players[(i0 + k) % n];
      if (pred(p)) return p.seat;
    }
    return null;
  }

  pot() { return this.players.reduce((s, p) => s + p.total, 0); }

  legal(seat) {
    const p = this.p(seat);
    if (this.done || !p || this.turn !== seat) return null;
    const toCall = Math.min(this.currentBet - p.bet, p.stack);
    const maxTo = p.bet + p.stack;
    const minTo = Math.min(this.currentBet + this.minRaise, maxTo);
    const othersCanAct = this.players.some((o) => o !== p && this.canAct(o));
    const reopened = p.seen === -1 || p.seen < this.fullRaises;
    const canRaise = maxTo > this.currentBet && reopened && othersCanAct;
    return { toCall, canCheck: toCall === 0, minTo, maxTo, canRaise, currentBet: this.currentBet, bet: p.bet, stack: p.stack };
  }

  /** action: {type:'fold'|'check'|'call'|'raise'|'allin', to?:number} */
  act(seat, action) {
    if (this.done) throw new Error("HAND_OVER");
    if (this.turn !== seat) throw new Error("NOT_YOUR_TURN");
    const p = this.p(seat);
    const L = this.legal(seat);
    let type = action.type;
    if (type === "allin") {
      if (L.canRaise) { type = "raise"; action = { type: "raise", to: L.maxTo }; } else type = "call";
    }
    switch (type) {
      case "fold":
        p.folded = true; p.lastAction = "fold";
        this.log.push({ seat, action: "fold" });
        break;
      case "check":
        if (!L.canCheck) throw new Error("CANNOT_CHECK");
        p.lastAction = "check";
        this.log.push({ seat, action: "check" });
        break;
      case "call": {
        if (L.toCall === 0) { p.lastAction = "check"; this.log.push({ seat, action: "check" }); break; }
        const a = L.toCall;
        p.stack -= a; p.bet += a; p.total += a;
        if (p.stack === 0) p.allIn = true;
        p.lastAction = p.allIn ? "all-in" : "call";
        this.log.push({ seat, action: "call", amount: a });
        break;
      }
      case "raise": {
        if (!L.canRaise) throw new Error("CANNOT_RAISE");
        let to = Math.floor(Number(action.to));
        if (!Number.isFinite(to)) throw new Error("BAD_AMOUNT");
        if (to >= L.maxTo) to = L.maxTo;
        else if (to < L.minTo) throw new Error("RAISE_TOO_SMALL");
        const wasOpen = this.currentBet === 0;
        const inc = to - this.currentBet;
        const a = to - p.bet;
        p.stack -= a; p.bet = to; p.total += a;
        if (p.stack === 0) p.allIn = true;
        if (inc >= this.minRaise) { this.minRaise = inc; this.fullRaises++; }
        this.currentBet = to;
        for (const o of this.players) if (o !== p && this.canAct(o)) o.acted = false;
        p.lastAction = p.allIn ? "all-in" : wasOpen ? "bet" : "raise";
        this.log.push({ seat, action: "raise", to, street: this.street });
        break;
      }
      default:
        throw new Error("BAD_ACTION");
    }
    p.acted = true;
    p.seen = this.fullRaises;
    this.actionSeq++;
    this.afterAction(false);
    return this;
  }

  roundComplete() {
    return this.players.every((p) => p.folded || p.allIn || (p.acted && p.bet === this.currentBet));
  }

  afterAction(fromStart) {
    if (this.live().length === 1) return this.finishUncontested();
    if (!fromStart) {
      if (this.roundComplete()) return this.endStreet();
      this.turn = this.nextFrom(this.turn, (p) => this.canAct(p) && (!p.acted || p.bet < this.currentBet));
      if (this.turn == null) return this.endStreet();
    } else if (this.turn == null || this.roundComplete()) {
      // ex.: toți sunt all-in din blinduri
      return this.endStreet();
    }
  }

  endStreet() {
    for (const p of this.players) { p.bet = 0; p.acted = false; p.seen = -1; if (!p.folded && !p.allIn) p.lastAction = null; }
    this.currentBet = 0;
    this.minRaise = this.bbAmt;
    this.fullRaises = 0;
    const si = STREETS.indexOf(this.street);
    if (si === 3) return this.showdown();
    // nimeni nu mai poate paria: cărțile jucătorilor se întorc, iar ale mesei vin pe rând (runoutStep)
    if (this.pace && this.players.filter((p) => this.canAct(p)).length <= 1) { this.runout = true; this.ranOut = true; this.turn = null; return; }
    this.street = STREETS[si + 1];
    this.draw(); // carte arsă
    if (this.street === "flop") this.board.push(this.draw(), this.draw(), this.draw());
    else this.board.push(this.draw());
    this.log.push({ street: this.street, board: this.board.slice() }); // pentru reluarea mâinii
    const able = this.players.filter((p) => this.canAct(p));
    if (able.length <= 1) return this.endStreet(); // nimeni nu mai poate paria: se întorc toate cărțile
    this.turn = this.nextFrom(this.dealer, (p) => this.canAct(p));
  }

  /** All-in întors pe rând: următoarea stradă, iar după river showdown-ul. */
  runoutStep() {
    if (!this.runout || this.done) return this;
    const si = STREETS.indexOf(this.street);
    if (si === 3) { this.runout = false; this.showdown(); return this; }
    this.street = STREETS[si + 1];
    this.draw(); // carte arsă
    if (this.street === "flop") this.board.push(this.draw(), this.draw(), this.draw());
    else this.board.push(this.draw());
    this.log.push({ street: this.street, board: this.board.slice() });
    return this;
  }

  /** Comisionul dintr-un pot disputat: doar după flop („no flop, no drop”), rotunjit în jos. */
  rakeOf(amount) {
    if (!this.rakeBp || this.board.length < 3) return 0;
    return Math.floor((amount * this.rakeBp) / 10000);
  }

  finishUncontested() {
    const w = this.live()[0];
    const pot = this.pot();
    // partea neplătită de nimeni din pariul câștigătorului nu se comisionează: i se întoarce
    const others = Math.max(0, ...this.players.filter((p) => p !== w).map((p) => p.total));
    const rake = this.rakeOf(pot - Math.max(0, w.total - others));
    const amount = pot - rake;
    w.stack += amount;
    this.rake = rake;
    this.turn = null;
    this.done = true;
    this.result = { uncontested: true, winners: [{ seat: w.seat, amount, hand: null }], pots: [{ amount, seats: [w.seat] }], shown: {}, rake };
    this.result.presentation=describe(this);
  }

  /** Poturi (principal + secundare) din contribuțiile totale. */
  buildPots() {
    const levels = [...new Set(this.live().map((p) => p.total))].sort((a, b) => a - b);
    const pots = [];
    let prev = 0;
    for (const L of levels) {
      const amount = this.players.reduce((s, p) => s + Math.max(0, Math.min(p.total, L) - prev), 0);
      const seats = this.live().filter((p) => p.total >= L).map((p) => p.seat);
      if (amount > 0) pots.push({ amount, seats });
      prev = L;
    }
    // jetoane ale celor care au renunțat peste nivelul maxim (rar) merg la ultimul pot
    const counted = pots.reduce((s, x) => s + x.amount, 0);
    const rest = this.pot() - counted;
    if (rest > 0 && pots.length) pots[pots.length - 1].amount += rest;
    return pots;
  }

  showdown() {
    this.turn = null;
    const evals = new Map();
    for (const p of this.live()) evals.set(p.seat, bestHand([...p.cards, ...this.board]));
    const pots = this.buildPots();
    const won = new Map();
    const di = this.idx(this.dealer);
    const clockwiseFromDealer = (seat) => (this.idx(seat) - di - 1 + this.players.length) % this.players.length;
    let rake = 0;
    for (const pot of pots) {
      // un pot cu un singur jucător e doar pariul lui neplătit, întors înapoi: fără comision
      if (pot.seats.length > 1) { const r = this.rakeOf(pot.amount); pot.amount -= r; rake += r; }
      const best = Math.max(...pot.seats.map((s) => evals.get(s).score));
      const winners = pot.seats.filter((s) => evals.get(s).score === best).sort((a, b) => clockwiseFromDealer(a) - clockwiseFromDealer(b));
      const share = Math.floor(pot.amount / winners.length);
      let odd = pot.amount - share * winners.length;
      pot.awards=[];
      for (const s of winners) {
        const amt = share + (odd > 0 ? 1 : 0);
        if (odd > 0) odd--;
        pot.awards.push({seat:s,amount:amt});
        won.set(s, (won.get(s) || 0) + amt);
      }
      pot.winners = winners;
    }
    for (const [s, a] of won) this.p(s).stack += a;
    this.rake = rake;
    const shown = {};
    for (const p of this.live()) shown[p.seat] = p.cards;
    this.done = true;
    this.result = {
      uncontested: false,
      winners: [...won.entries()].map(([seat, amount]) => ({ seat, amount, hand: evals.get(seat).name })),
      pots: pots.map((x) => ({ amount: x.amount, seats: x.seats, awards:x.awards, winners: x.winners })),
      shown,
      hands: Object.fromEntries([...evals.entries()].map(([s, e]) => [s, e.name])),
      rake,
    };
    this.result.presentation=describe(this);
  }

  /** Vedere publică; `seat` vede propriile cărți. */
  view(seat) {
    const showAll = (this.done && !this.result?.uncontested) || !!this.runout;
    return {
      street: this.street,
      runout: !!this.runout,
      board: this.board.slice(),
      pot: this.pot(),
      currentBet: this.currentBet,
      dealer: this.dealer, sbSeat: this.sbSeat, bbSeat: this.bbSeat,
      turn: this.turn,
      done: this.done,
      result: this.result,
      players: this.players.map((p) => ({
        seat: p.seat, userId: p.userId, name: p.name, stack: p.stack, bet: p.bet, total: p.total,
        folded: p.folded, allIn: p.allIn, lastAction: p.lastAction,
        cards: p.seat === seat || (showAll && !p.folded) ? p.cards.slice() : p.cards.length ? [null, null] : [],
      })),
      legal: seat != null ? this.legal(seat) : null,
    };
  }
}

