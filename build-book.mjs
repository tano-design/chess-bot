#!/usr/bin/env node
/*  TANOBOT trainer: turns tano's chess.com games into public/chess/tano-book.json
 *
 *  Run it from this folder (chess-tools) on your laptop:
 *    npm install                      (once)
 *    node build-book.mjs              (fetches itstano's games from chess.com and analyses them)
 *
 *  Options:
 *    node build-book.mjs someoneElse  another chess.com username
 *    --pgn path/to/games.pgn          use a PGN file you downloaded instead of the chess.com API
 *    --fast                           skip the Stockfish analysis (openings + basic habits only, ~10 seconds)
 *    --depth 10                       how deep Stockfish grades each of your moves (default 10)
 *    --out ../public/chess/tano-book.json
 *
 *  What it learns:
 *    book      every position from your first moves, and which move you played there (and how often)
 *    accuracy  Stockfish grades every move you made: how much winning chance it gave away.
 *              The bot copies that distribution, so it makes mistakes about as often as you do.
 *    style     what you like to do compared with what the engine would do: piece choices,
 *              captures, checks, castling side, early queen moves, per game phase.
 *    resign    how often you resign a lost game instead of playing it out.
 */
import { Chess } from "chess.js";
import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";

const require = createRequire(import.meta.url);

// ── settings ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const flag = (name) => args.includes(name);
const VALUE_FLAGS = ["--pgn", "--depth", "--out"];
const USER = (args.find((a, i) => !a.startsWith("--") && !VALUE_FLAGS.includes(args[i - 1])) || "itstano").toLowerCase();
const PGN_FILE = opt("--pgn", null);
const FAST = flag("--fast");
const DEPTH = +opt("--depth", 10);
// writes into public/chess if this folder sits in the repo, otherwise next to this script
const IN_REPO = new URL("../public/chess/", import.meta.url);
const OUT = opt("--out", existsSync(IN_REPO) ? new URL("tano-book.json", IN_REPO).pathname : new URL("tano-book.json", import.meta.url).pathname);
const BOOK_PLIES = 20;         // remember your moves for the first 10 moves of each game
const KEEP_SINGLES_UNTIL = 14; // positions you only reached once are kept until ply 14
const RECENT_SINCE = Date.UTC(2025, 0, 1) / 1000; // games after this count double in the book
const WORKERS = Math.max(1, Math.min(6, os.cpus().length));
const BUCKETS = [2, 5, 10, 20, 35];   // win-chance lost per move, in %: 0-2, 2-5, 5-10, 10-20, 20-35, 35+
const SKIP_TC = new Set(["bullet"]);  // bullet moves are not graded (too fast to mean anything)

// ── helpers ─────────────────────────────────────────────────────────────────
const fen4 = (fen) => fen.split(" ").slice(0, 4).join(" ");
const winPct = (cp) => 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
const VAL = { p: 0, n: 3, b: 3, r: 5, q: 9, k: 0 };
function phaseOf(chess, ply) {
  if (ply < 20) return "opening";
  let m = 0;
  for (const row of chess.board()) for (const sq of row) if (sq) m += VAL[sq.type];
  return m <= 26 ? "endgame" : "middlegame";
}
function moveKeys(mv) {
  // the habit "tags" a move carries
  const k = [mv.piece];
  if (mv.isKingsideCastle?.() || mv.san.startsWith("O-O") && !mv.san.startsWith("O-O-O")) k.push("castleK");
  if (mv.san.startsWith("O-O-O")) k.push("castleQ");
  if (mv.captured) k.push("capture");
  if (/[+#]/.test(mv.san)) k.push("check");
  if (mv.piece === "p" && Math.abs(+mv.to[1] - +mv.from[1]) === 2) k.push("pawn2");
  return k;
}

async function getJSON(url) {
  const r = await fetch(url, { headers: { "User-Agent": "tanobot-book-builder" } });
  if (!r.ok) throw new Error(url + " -> HTTP " + r.status);
  return r.json();
}

function side(h, winning) {
  if (h.Result === winning) return "win";
  if (h.Result === "1/2-1/2") return "agreed";
  return /resign/i.test(h.Termination || "") ? "resigned" : "lost";
}

async function loadGames() {
  if (PGN_FILE) {
    const text = readFileSync(PGN_FILE, "utf8");
    return text.split(/\n(?=\[Event )/).filter((t) => t.trim()).map((pgn) => {
      const h = Object.fromEntries([...pgn.matchAll(/\[(\w+) "([^"]*)"\]/g)].map((m) => [m[1], m[2]]));
      const tc = h.TimeControl || "";
      const base = +tc.split("+")[0] || 600;
      const time_class = tc.includes("/") ? "daily" : base < 180 ? "bullet" : base < 600 ? "blitz" : "rapid";
      return { pgn, time_class, rules: h.Variant ? "other" : "chess", end_time: Date.parse((h.UTCDate || h.Date || "").replace(/\./g, "-")) / 1000 || 0,
        white: { username: h.White || "", rating: +h.WhiteElo, result: side(h, "1-0") },
        black: { username: h.Black || "", rating: +h.BlackElo, result: side(h, "0-1") } };
    });
  }
  console.log(`Fetching ${USER}'s games from chess.com…`);
  const { archives } = await getJSON(`https://api.chess.com/pub/player/${USER}/games/archives`);
  const games = [];
  for (const url of archives) games.push(...(await getJSON(url)).games);
  return games;
}

// ── a small pool of Stockfish processes ─────────────────────────────────────
function makeEngine() {
  const path = require("stockfish").findEngine("lite-single");
  const proc = spawn(process.execPath, [path], { stdio: ["pipe", "pipe", "ignore"] });
  let buf = "", waiter = null, lastScore = null;
  proc.stdout.on("data", (d) => {
    buf += d.toString();
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      const s = line.match(/ score (cp|mate) (-?\d+)/);
      if (s && / multipv 1 /.test(" " + line + " ") || (s && !/multipv/.test(line))) lastScore = s[1] === "cp" ? +s[2] : (s[2] > 0 ? 10000 - s[2] * 10 : -10000 - s[2] * 10);
      const bm = line.match(/^bestmove (\S+)/);
      if (bm && waiter) { const w = waiter; waiter = null; w({ best: bm[1], cp: lastScore }); }
      if (line === "uciok" && waiter) { const w = waiter; waiter = null; w(); }
    }
  });
  const send = (cmd) => proc.stdin.write(cmd + "\n");
  const wait = () => new Promise((r) => (waiter = r));
  return {
    async init() { const p = wait(); send("uci"); await p; send("setoption name Hash value 16"); },
    async eval(fen, uci) {
      lastScore = null; send("position fen " + fen);
      let p = wait(); send(`go depth ${DEPTH}`); const best = await p;
      if (best.best === uci) return { best: best.best, bestCp: best.cp, moveCp: best.cp };
      lastScore = null; p = wait(); send(`go depth ${DEPTH} searchmoves ${uci}`); const mine = await p;
      return { best: best.best, bestCp: best.cp, moveCp: mine.cp };
    },
    quit() { send("quit"); proc.kill(); },
  };
}

// ── main ────────────────────────────────────────────────────────────────────
const all = await loadGames();
const games = all.filter((g) => g.rules === "chess" && g.pgn);
console.log(`${games.length} standard games (${all.length - games.length} variants skipped).`);

const book = new Map();              // fen4 -> Map(san -> weight)
const jobs = [];                     // moves to grade
const ratings = {};
let wins = 0, losses = 0, resigns = 0, draws = 0, asWhite = 0;
const firstMoves = { w: {}, b: {} };

for (const g of games) {
  const me = g.white.username.toLowerCase() === USER ? "w" : g.black.username.toLowerCase() === USER ? "b" : null;
  if (!me) continue;
  const mine = me === "w" ? g.white : g.black;
  if (mine.rating) ratings[g.time_class] = mine.rating; // games are in date order, so this ends on the latest
  if (mine.result === "win") wins++; else if (["resigned", "checkmated", "timeout", "abandoned", "lost"].includes(mine.result)) { losses++; if (mine.result === "resigned") resigns++; } else draws++;
  if (me === "w") asWhite++;

  const replay = new Chess();
  try { replay.loadPgn(g.pgn); } catch { continue; }
  const moves = replay.history({ verbose: true });
  const chess = new Chess();
  const weight = g.end_time >= RECENT_SINCE ? 2 : 1;
  moves.forEach((mv, ply) => {
    const myTurn = chess.turn() === me;
    if (myTurn) {
      const key = fen4(chess.fen());
      if (ply < BOOK_PLIES) {
        if (!book.has(key)) book.set(key, { ply, moves: new Map() });
        const m = book.get(key).moves; m.set(mv.san, (m.get(mv.san) || 0) + weight);
      }
      if (ply < 2) firstMoves[me][mv.san] = (firstMoves[me][mv.san] || 0) + 1;
      if (!SKIP_TC.has(g.time_class)) {
        jobs.push({ fen: chess.fen(), uci: mv.from + mv.to + (mv.promotion || ""), san: mv.san, keys: moveKeys(mv), phase: phaseOf(chess, ply), tc: g.time_class });
      }
    }
    chess.move(mv.san);
  });
}

// trim the book: drop one-off positions deep in the opening
const bookOut = {};
for (const [key, { ply, moves }] of book) {
  const total = [...moves.values()].reduce((a, b) => a + b, 0);
  if (ply >= KEEP_SINGLES_UNTIL && total < 2) continue;
  bookOut[key] = [...moves.entries()].sort((a, b) => b[1] - a[1]);
}
console.log(`Opening book: ${Object.keys(bookOut).length} positions.`);

// ── grade every move with Stockfish ─────────────────────────────────────────
const PHASES = ["opening", "middlegame", "endgame"];
const accuracy = {}, style = {};
let graded = 0, topMatch = 0;
if (!FAST) {
  console.log(`Grading ${jobs.length} of your moves with Stockfish (depth ${DEPTH}, ${WORKERS} at a time). This takes a few minutes…`);
  const engines = await Promise.all(Array.from({ length: WORKERS }, async () => { const e = makeEngine(); await e.init(); return e; }));
  let next = 0, done = 0; const t0 = Date.now();
  await Promise.all(engines.map(async (e) => {
    while (next < jobs.length) {
      const j = jobs[next++];
      const r = await e.eval(j.fen, j.uci);
      if (r.bestCp == null || r.moveCp == null) continue;
      j.loss = Math.max(0, winPct(r.bestCp) - winPct(r.moveCp));
      j.bestCp = r.bestCp;
      const c = new Chess(j.fen);
      try { const bm = c.move({ from: r.best.slice(0, 2), to: r.best.slice(2, 4), promotion: r.best[4] }); j.bestKeys = moveKeys(bm); } catch { j.bestKeys = null; }
      if (++done % 500 === 0) process.stdout.write(`  ${done}/${jobs.length} (${Math.round((Date.now() - t0) / 1000)}s)\n`);
    }
  }));
  engines.forEach((e) => e.quit());

  for (const ph of PHASES) {
    const js = jobs.filter((j) => j.phase === ph && j.loss != null);
    // accuracy: share of moves in each "win chance lost" bucket. Rapid and daily count double (you had time to think).
    const hist = new Array(BUCKETS.length + 1).fill(0); let wsum = 0;
    for (const j of js) {
      const w = j.tc === "blitz" ? 1 : 2;
      let b = BUCKETS.findIndex((edge) => j.loss < edge); if (b < 0) b = BUCKETS.length;
      hist[b] += w; wsum += w;
    }
    accuracy[ph] = { moves: js.length, dist: hist.map((h) => +(h / (wsum || 1)).toFixed(4)), avgLoss: +(js.reduce((a, j) => a + j.loss, 0) / (js.length || 1)).toFixed(2) };
    // style: how much more (or less) often you do something than the engine would, in the same positions
    const keys = ["p", "n", "b", "r", "q", "k", "castleK", "castleQ", "capture", "check", "pawn2"];
    style[ph] = {};
    for (const k of keys) {
      const mineN = js.filter((j) => j.keys.includes(k)).length;
      const engN = js.filter((j) => j.bestKeys?.includes(k)).length;
      const ratio = (mineN + 3) / (engN + 3);              // +3 keeps rare things from swinging wildly
      style[ph][k] = +Math.min(2.5, Math.max(0.4, ratio)).toFixed(3);
    }
    graded += js.length; topMatch += js.filter((j) => j.bestKeys && j.loss < 0.5).length;
  }
}

const tot = (o) => Object.values(o).reduce((a, b) => a + b, 0);
const top = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([san, n]) => ({ san, pct: Math.round((100 * n) / tot(o)) }));
const out = {
  user: USER,
  built: new Date().toISOString().slice(0, 10),
  games: games.length,
  asWhite,
  record: { wins, losses, draws },
  ratings,
  resignRate: +(resigns / (losses || 1)).toFixed(3),
  favorites: { white: top(firstMoves.w), black: top(firstMoves.b) },
  graded: FAST ? 0 : graded,
  engineMatch: FAST ? null : +(topMatch / (graded || 1)).toFixed(3),
  buckets: BUCKETS,
  accuracy: FAST ? null : accuracy,
  style: FAST ? null : style,
  book: bookOut,
};
writeFileSync(OUT, JSON.stringify(out));
console.log(`\nSaved ${OUT}`);
console.log(`Record ${wins}-${losses}-${draws}, resigns ${Math.round(out.resignRate * 100)}% of losses.`);
if (!FAST) {
  console.log(`Graded ${graded} moves. Matched Stockfish's top move ${Math.round(out.engineMatch * 100)}% of the time.`);
  for (const ph of PHASES) console.log(`  ${ph.padEnd(10)} avg win chance lost per move ${accuracy[ph].avgLoss}%  buckets ${accuracy[ph].dist.join(" / ")}`);
}
console.log("Next: upload public/chess/tano-book.json to GitHub (replace the old one).");
