// Cărți, pachet și evaluarea mâinilor (Texas Hold'em, cea mai bună combinație de 5 din 7).
import { randomInt } from "node:crypto";

export const RANKS = "23456789TJQKA";
export const SUITS = "shdc";

export function newDeck() {
  const d = [];
  for (const r of RANKS) for (const s of SUITS) d.push(r + s);
  return d;
}

export function shuffle(deck) {
  const d = deck.slice();
  for (let i = d.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

const rv = (c) => RANKS.indexOf(c[0]) + 2;

export const CATEGORY_NAMES = [
  "Carte mare", "Pereche", "Două perechi", "Trei de un fel", "Chintă",
  "Culoare", "Full", "Careu", "Chintă de culoare",
];

/** Scor numeric pentru exact 5 cărți: mai mare = mai bun. */
export function eval5(cards) {
  const vals = cards.map(rv).sort((a, b) => b - a);
  const flush = cards.every((c) => c[1] === cards[0][1]);
  const uniq = [...new Set(vals)];
  let straightHigh = 0;
  if (uniq.length === 5) {
    if (vals[0] - vals[4] === 4) straightHigh = vals[0];
    else if (vals[0] === 14 && vals[1] === 5) straightHigh = 5; // A-2-3-4-5
  }
  const counts = new Map();
  for (const v of vals) counts.set(v, (counts.get(v) || 0) + 1);
  // grupuri sortate după (număr, valoare)
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const kick = groups.map((g) => g[0]);
  let cat;
  let tiebreak;
  if (straightHigh && flush) { cat = 8; tiebreak = [straightHigh]; }
  else if (groups[0][1] === 4) { cat = 7; tiebreak = kick; }
  else if (groups[0][1] === 3 && groups[1][1] === 2) { cat = 6; tiebreak = kick; }
  else if (flush) { cat = 5; tiebreak = vals; }
  else if (straightHigh) { cat = 4; tiebreak = [straightHigh]; }
  else if (groups[0][1] === 3) { cat = 3; tiebreak = kick; }
  else if (groups[0][1] === 2 && groups[1][1] === 2) { cat = 2; tiebreak = kick; }
  else if (groups[0][1] === 2) { cat = 1; tiebreak = kick; }
  else { cat = 0; tiebreak = vals; }
  let score = cat;
  for (let i = 0; i < 5; i++) score = score * 15 + (tiebreak[i] || 0);
  return score;
}

export function categoryOf(score) {
  return Math.floor(score / 15 ** 5);
}

/** Cea mai bună mână din 5–7 cărți. */
export function bestHand(cards) {
  let best = -1;
  let bestCards = null;
  const n = cards.length;
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (let c = b + 1; c < n; c++)
    for (let d = c + 1; d < n; d++) for (let e = d + 1; e < n; e++) {
      const five = [cards[a], cards[b], cards[c], cards[d], cards[e]];
      const s = eval5(five);
      if (s > best) { best = s; bestCards = five; }
    }
  const cat = categoryOf(best);
  let name = CATEGORY_NAMES[cat];
  if (cat === 8 && bestCards.some((c) => c[0] === "A") && bestCards.some((c) => c[0] === "K")) name = "Chintă roială";
  return { score: best, cards: bestCards, name };
}

