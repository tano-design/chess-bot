/*  TANOMATE: a chess bot that plays like tano.  Easter egg for tanodsgn.com
 *
 *  Loaded by embed.js when a page has <div data-tano-chess></div>.
 *  Everything runs in the visitor's browser: chess.js for the rules, Stockfish (WASM) as the engine,
 *  and tano-book.json for tano's openings, habits, and mistake rate. No server, no API costs.
 *
 *  To retrain on new games: see chess-tools/README.md (one command, then upload tano-book.json).
 */
import { Chess } from "./chess.js";

// ── Design settings: edit these ─────────────────────────────────────────────
const NAME = "TANOMATE";
const PINK = "#E68DF9";               // emphasis color (dot, highlights, move hints)
const PINK_DARK = "#a24db5";          // dot flicker color on hover
// The site's web font first, so every visitor (and your own Mac, even with Monument installed locally) gets the same metrics.
const BRAND_FONT = '"Monument Grotesk Variable", "Monument Grotesk", "ABC Monument Grotesk", "Helvetica Neue", Helvetica, Arial, sans-serif';
const MONO_FONT = BRAND_FONT;          // labels, status, ratings
// The TANOMATE title uses exactly the TanoLLM title's font, size and dot nudge, so the two match everywhere.
const TITLE_FONT = '"Monument Grotesk Mono", "ABC Monument Grotesk Mono", "Monument Grotesk Mono Variable", "Monument Grotesk", "Monument Grotesk Variable", "ABC Monument Grotesk", "Helvetica Neue", Helvetica, Arial, sans-serif';
const NUM_FONT = '"ocr-a-std", "OCR A Std", "OCR-A", "OCR A", monospace'; // ratings + move list
const FONT_CSS = "https://use.typekit.net/xnk0one.css"; // tano's Adobe Fonts kit (has OCR-A)
const TITLE_SIZE = "1.1rem";          // TANOMATE title + buttons, same as the TanoLLM title
const BODY_SIZE = "1.1rem";           // body text, matches the site
const SMALL_SIZE = "0.85rem";
const HEADER_SIZE = "1.6rem";         // header line under TANOMATE, same size as the TanoLLM greeting
const BOARD_MAX = "min(680px, calc(100vh - 3rem))"; // biggest the board gets on desktop (also never taller than the window)
const PANEL_MAX = "380px";            // widest the text panel gets beside the board
const TWO_COLUMN_AT = 760;            // container width (px) where the panel moves beside the board
const RADIUS = "0";                   // corners on buttons and board

// Buttons, styled like the site's grey buttons.
const BTN_BG = "#767776";             // site button grey (All Projects, 3D & Motion)
const BTN_FG = "#ffffff";
const BTN_SIZE = "1rem";              // button text size; button height follows it
const BTN_PAD = ".7em 1em";           // space around the button text (top/bottom, left/right), scales with BTN_SIZE

// Pink dot next to TANOMATE: moves it up (positive) or down (negative), same values as the TanoLLM title.
const TITLE_DOT_NUDGE = 2.5;          // same as TanoLLM
const MOBILE_TITLE_DOT_NUDGE = 0.5;   // same as TanoLLM

// Board colors per theme. Pieces: --pl light body, --pk dark body, --ps outline, --pd black-piece details.
const BOARD = {
  // dark squares are the site background, so the board melts into the page and flips with the toggle
  dark:  { light: "#2e2e2e", dark: "#191919",
           white: { pl: "#ececec", pk: "#191919", ps: "#191919", pd: "#191919" },
           black: { pl: "#0e0e0e", pk: "#6b3a7a", ps: "#0e0e0e", pd: "#0e0e0e" } },   // dark purple for now
  light: { light: "#ececec", dark: "#D9D9D9",
           white: { pl: "#ffffff", pk: "#191919", ps: "#191919", pd: "#191919" },
           black: { pl: "#191919", pk: "#191919", ps: "#191919", pd: "#ececec", pxfill: "#4a4a4a" } },  // pxfill: phone pixel pieces get a grey fill so the outline reads
};

// ── Bot settings ────────────────────────────────────────────────────────────
const BOOK_PLIES = 20;                // play from tano's opening memory for the first 10 moves each
const DEPTH = 9;                      // engine depth (desktop)
const DEPTH_MOBILE = 8;               // engine depth (phones)
const PIXEL_PIECES_BELOW = 768;
// shown when a visitor beats the bot: a button that emails Chris
const WIN_EMAIL = "cdegaetadesign@gmail.com";
const WIN_LINE = "You beat Chris. Go ahead, tell him. He hates that.";
// ── trash talk ── one line is picked at random from a group when that moment happens. {piece} = the piece's name.
const QUIPS = {
  hang:    ["Thanks for the free {piece}. \u{1F639}", "Chris doesn't miss those. He misses everything else.", "Free real estate.",
            "Blud is trolling \u{1F480}", "Did you mean to leave your {piece} there? \u{1F480}"],
  queen:   ["Your queen has left the chat. \u{1F940}", "Rest in peace, your queen. \u{1F940}", "That was your queen, by the way. \u{1F480}"],
  youTook: ["Okay, you earned that one. Chris is calling it a sacrifice.", "Chris is blaming lag for that. \u{1F940}", "Nice take. He'll be thinking about that one."],
  blunder: ["That one's a blunder. Very on brand.", "Even Chris saw that coming. Too late. \u{1F480}", "Chris would like that one back. He doesn't get an undo either."],
  kingWalk:["Ke2. Fully intentional. The king wanted fresh air.", "Ke2. Calculated. Don't ask by what.", "The king is walking because he can. \u{1F639}"],
  castle:  ["King tucked away. Rare moment of responsibility."],
  gambit:  ["A pawn, on the house. It's a trap. Probably.", "Free pawn? Sure. Totally free. \u{1F639}"],
  undo:    ["That's your one undo. Make it count.", "Undo spent. No more safety net. \u{1F940}", "One take-back. Chris is keeping receipts."],
  mated:   ["Checkmate. He's going to be insufferable about this.", "gg ez \u{1F639}", "Beaten by a 929. Sit with that. \u{1F480}",
            "Checkmate. Chris is already telling people. \u{1F639}", "That's mate. Your undo can't save you now. \u{1F940}",
            "Checkmate. He'd like you to know he wasn't even trying.", "Unlucky. Rematch? \u{1F480}"],
};
const QUIP_CHANCE = { youTook: 0.6, castle: 0.5, gambit: 0.7 };   // groups not listed always show
const PIECE_NAME = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };
const VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
function quip(group, piece) {
  if (Math.random() >= (QUIP_CHANCE[group] ?? 1)) return "";
  const list = QUIPS[group]; const line = list[Math.floor(Math.random() * list.length)];
  return line.replace("{piece}", PIECE_NAME[piece] || "piece");
}
const WIN_GLITCH_MS = 140;     // one on/off flash of the winning piece + dot (even rhythm, no easing)
const UNDOS_PER_GAME = 1;      // take-backs allowed per game
const WIN_COUNT_LABEL = "Visitors who've beaten Chris: ";   // shared counter on the win screen (api/wins.js)
const WIN_GLITCH_TIMES = 6;    // how many flashes (6 x 140ms = under a second)
const SECTION_GAP = "1.5rem";   // space between every block (title, intro, ratings, status, buttons, play as, moves)
// phones only: the Cargo page has no padding (so the board lines up with HOME on desktop),
// so the game adds its own side padding on phones, plus room at the bottom for the menu key
const MOBILE_SIDE_PAD = "1.5rem";
const MOBILE_BOTTOM_PAD = "8rem";       // on screens this narrow or less, use the pixel pieces (like the nav icons)
const MULTIPV = 30;                   // how many moves the engine scores, so the bot can pick "human" ones
const THINK_MS = [550, 1500];         // how long tano "thinks" (min, max), in milliseconds
const RESIGN_CP = -700;               // tano considers resigning when he is this far behind (centipawns)

// ─────────────────────────────────────────────────────────────────────────────
let BASE = "";
let BOOK = null;
const STORE_KEY = "tanobot-game-v1";
const fen4 = (fen) => fen.split(" ").slice(0, 4).join(" ");
const winPct = (cp) => 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
const FILES = "abcdefgh";
const rand = (a, b) => a + Math.random() * (b - a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isMobile = () => matchMedia("(max-width: 768px), (pointer: coarse)").matches;
const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
function track(name, params) { try { if (typeof window.gtag === "function") window.gtag("event", name, params || {}); } catch (e) {} }

// ── Engine (Stockfish in a web worker) ──────────────────────────────────────
let engine = null;
function makeEngine() {
  const js = BASE + "/chess/stockfish.js", wasm = BASE + "/chess/stockfish.wasm";
  let worker;
  if (new URL(js).origin === location.origin) worker = new Worker(js);
  else {
    // the site and the engine live on different domains, so start the worker from a tiny blob that pulls the engine in
    const blob = new Blob(["importScripts(" + JSON.stringify(js) + ");"], { type: "application/javascript" });
    worker = new Worker(URL.createObjectURL(blob) + "#" + encodeURIComponent(wasm));
  }
  let listener = null;
  worker.onmessage = (e) => listener && listener(String(e.data));
  const ready = new Promise((res) => { listener = (l) => { if (l === "uciok") res(); }; worker.postMessage("uci"); });
  let busy = Promise.resolve();
  return {
    ready,
    // returns [{ uci, cp }] from the side to move's point of view, best first
    analyse(fen, depth, multipv) {
      const run = async () => {
        await ready;
        const lines = new Map();
        const done = new Promise((res) => {
          listener = (l) => {
            if (l.startsWith("info") && l.includes(" pv ")) {
              const d = +(l.match(/ depth (\d+)/) || [])[1];
              const k = +((l.match(/ multipv (\d+)/) || [])[1] || 1);
              const s = l.match(/ score (cp|mate) (-?\d+)/);
              const mv = (l.match(/ pv (\S+)/) || [])[1];
              if (!s || !mv || / (lowerbound|upperbound)/.test(l)) return;
              const cp = s[1] === "cp" ? +s[2] : (+s[2] > 0 ? 10000 - +s[2] * 10 : -10000 - +s[2] * 10);
              const prev = lines.get(k);
              if (!prev || d >= prev.d) lines.set(k, { uci: mv, cp, d });
            } else if (l.startsWith("bestmove")) res();
          };
        });
        worker.postMessage("setoption name MultiPV value " + multipv);
        worker.postMessage("position fen " + fen);
        worker.postMessage("go depth " + depth);
        await done;
        // keep one line per move (the deepest), best first
        const byMove = new Map();
        for (const v of lines.values()) if (!byMove.has(v.uci) || v.d > byMove.get(v.uci).d) byMove.set(v.uci, v);
        return [...byMove.values()].sort((a, b) => b.cp - a.cp);
      };
      busy = busy.then(run, run);
      return busy;
    },
    stop() { worker.postMessage("stop"); },
  };
}

// ── "Play like tano" ────────────────────────────────────────────────────────
function phaseOf(chess) {
  if (chess.history().length < 20) return "opening";
  const v = { n: 3, b: 3, r: 5, q: 9 };
  let m = 0;
  for (const row of chess.board()) for (const sq of row) if (sq && v[sq.type]) m += v[sq.type];
  return m <= 26 ? "endgame" : "middlegame";
}
function tagsOf(mv) {
  const t = [mv.piece];
  if (mv.san.startsWith("O-O-O")) t.push("castleQ"); else if (mv.san.startsWith("O-O")) t.push("castleK");
  if (mv.captured) t.push("capture");
  if (/[+#]/.test(mv.san)) t.push("check");
  if (mv.piece === "p" && Math.abs(+mv.to[1] - +mv.from[1]) === 2) t.push("pawn2");
  return t;
}
function pickWeighted(items, weightOf) {
  const total = items.reduce((a, it) => a + weightOf(it), 0);
  let r = Math.random() * total;
  for (const it of items) { r -= weightOf(it); if (r <= 0) return it; }
  return items[items.length - 1];
}
// moves tano only plays when trolling (rim knights, crab pawns, king walks): never in the opening
function trollMove(mv, ply, inCheck) {
  if (mv.piece === "n" && /^[ah]/.test(mv.to) && !mv.captured) return true;
  if (mv.piece === "p" && /^[ah]/.test(mv.from) && !mv.captured && ply < 12) return true;
  return false;   // king walks (Ke2) are allowed: tano trolls with them, then plays it out properly
}
const uciOf = (mv) => mv.from + mv.to + (mv.promotion || "");
const FREE_GAP_CP = 150;        // a capture this much better than any quiet move = free material
const TAKE_FREE = { opening: 1, middlegame: 0.85, endgame: 0.85 };   // how often tano grabs it
const OPENING_MAX_LOSS = 6;     // in the opening tano doesn't give away more than this much win chance (%)
const BOOK_VETO_LOSS = 20;      // a remembered move that loses this much (hangs a piece) is skipped; gambits stay
// obvious free material: the best move is a capture and it's far better than every non-capture
function freeGrab(chess, lines) {
  if (!lines.length) return null;
  const moves = new Chess(chess.fen()).moves({ verbose: true });
  const byUci = new Map(moves.map((m) => [uciOf(m), m]));
  const best = byUci.get(lines[0].uci);
  if (!best || !best.captured) return null;
  const quiet = lines.find((l) => { const m = byUci.get(l.uci); return m && !m.captured; });
  if (quiet && lines[0].cp - quiet.cp < FREE_GAP_CP) return null;
  return Math.random() < (TAKE_FREE[phaseOf(chess)] || 0.85) ? best.san : null;
}
// how much win chance a move gives away, from the engine lines (null if the engine didn't list it)
function lossOf(lines, uci) {
  const l = lines.find((x) => x.uci === uci);
  return l ? Math.max(0, winPct(lines[0].cp) - winPct(l.cp)) : null;
}
function bookMove(chess, lines) {
  if (!BOOK || chess.history().length >= BOOK_PLIES) return null;
  const entry = BOOK.book[fen4(chess.fen())];
  if (!entry) return null;
  const ply = chess.history().length, inCheck = chess.inCheck();
  const legal = entry.filter(([san]) => {
    let mv; try { mv = new Chess(chess.fen()).move(san); } catch (e) { return false; }
    if (!mv || trollMove(mv, ply, inCheck)) return false;
    const loss = lines ? lossOf(lines, uciOf(mv)) : null;
    return loss == null || loss < BOOK_VETO_LOSS;   // gambits lose a little and stay; hanging a piece doesn't
  });
  if (!legal.length) return null;
  const [san, n] = pickWeighted(legal, (e) => e[1]);
  const total = legal.reduce((a, e) => a + e[1], 0);
  return { san, n, total };
}
// Stockfish scores every move; tano's own mistake rate decides how much winning chance to give away,
// and his habits pick between moves that are about that good.
function humanMove(chess, lines) {
  const phase = phaseOf(chess);
  const acc = BOOK && BOOK.accuracy && BOOK.accuracy[phase];
  const style = (BOOK && BOOK.style && BOOK.style[phase]) || {};
  const edges = (BOOK && BOOK.buckets) || [2, 5, 10, 20, 35];
  const best = winPct(lines[0].cp);
  const cands = [];
  for (const l of lines) {
    let mv;
    try { mv = new Chess(chess.fen()).move({ from: l.uci.slice(0, 2), to: l.uci.slice(2, 4), promotion: l.uci[4] || "q" }); } catch (e) { continue; }
    const loss = Math.max(0, best - winPct(l.cp));
    if (phase === "opening" && (loss >= OPENING_MAX_LOSS || trollMove(mv, chess.history().length, chess.inCheck())) && l !== lines[0]) continue;
    let b = edges.findIndex((e) => loss < e); if (b < 0) b = edges.length;
    const w = tagsOf(mv).reduce((a, t) => a * (style[t] || 1), 1);
    cands.push({ san: mv.san, cp: l.cp, loss, bucket: b, w });
  }
  if (!cands.length) return null;
  const dist = acc ? acc.dist : [1];
  const want = pickWeighted(dist.map((p, i) => ({ i, p })), (x) => x.p).i;
  let pool = [];
  for (let off = 0; off <= edges.length && !pool.length; off++) {
    for (const b of off ? [want - off, want + off] : [want]) pool.push(...cands.filter((c) => c.bucket === b));
  }
  const pick = pickWeighted(pool, (c) => c.w);
  return { san: pick.san, loss: pick.loss, bestCp: lines[0].cp };
}

// ── UI ──────────────────────────────────────────────────────────────────────
const css = `
  :host { all: initial; display: block; visibility: inherit; }   /* "all: initial" would otherwise force it visible when the page hides it */
  * { box-sizing: border-box; margin: 0; padding: 0; }
  .wrap {
    --bg: #191919; --fg: rgba(255,255,255,.85); --strong: #fff; --mute: rgba(255,255,255,.42); --line: rgba(255,255,255,.12);
    --field: rgba(255,255,255,.07); --btn-line: rgba(255,255,255,.18); --thumb: #3a3a3a;
    --glitch-hi: #ffffff; --glitch-lo: rgba(255,255,255,.25);
    --pink: ${PINK}; --pink-dark: ${PINK_DARK};
    font: ${BODY_SIZE}/1.35 ${BRAND_FONT}; color: var(--fg); -webkit-font-smoothing: antialiased;
    container-type: inline-size; width: 100%;
    touch-action: manipulation;   /* no double-tap zoom anywhere on the game (pinch zoom still works) */
  }
  @media (max-width: ${PIXEL_PIECES_BELOW}px) {
    .wrap { padding: 0 ${MOBILE_SIDE_PAD} ${MOBILE_BOTTOM_PAD}; }
  }
  .wrap.light {
    --bg: #D9D9D9; --fg: rgba(25,25,25,.9); --strong: #191919; --mute: rgba(25,25,25,.55); --line: rgba(25,25,25,.15);
    --field: rgba(25,25,25,.06); --btn-line: #AEAEAE; --thumb: #AEAEAE;
    --glitch-hi: #e78cf9; --glitch-lo: #9d649f;
  }
  .wrap, .wrap * { transition: color .4s ease, border-color .4s ease; }
  /* phones / narrow columns: title, board, then status right under it */
  .layout { display: flex; flex-direction: column; gap: ${SECTION_GAP}; }
  .panel { display: contents; }
  .title { order: 1; } .lede { order: 2; } .stats { order: 3; }
  .board-col { order: 4; margin: .4rem 0 .2rem; display: flex; flex-direction: column; gap: .75rem; min-width: 0; }
  .wrap { --dot-nudge: ${MOBILE_TITLE_DOT_NUDGE}px; }
  .foot { order: 5; margin-top: -.35rem; }
  .status { order: 6; } .row-btns { order: 7; } .side-pick { order: 8; } .move-list { order: 9; }
  .row-btns { display: flex; }
  .row-btns .btn { flex: 1 1 auto; white-space: nowrap; }
  .seg { width: 100%; } .seg button { flex: 1; text-align: center; }
  @container (min-width: ${TWO_COLUMN_AT}px) {
    .layout { display: grid; gap: 1.5rem; grid-template-columns: minmax(0, ${BOARD_MAX}) minmax(0, ${PANEL_MAX}); align-items: start; }
    .panel { display: flex; flex-direction: column; gap: ${SECTION_GAP}; }
    .board-col { margin: 0; order: 0; }
    .row-btns { display: flex; flex-wrap: wrap; }
    .row-btns .btn { flex: none; }
    .wrap { --dot-nudge: ${TITLE_DOT_NUDGE}px; }
    .seg { width: max-content; } .seg button { flex: none; }
    /* real record sits in the right column, bottom edge level with the board's bottom edge;
       if it wraps to two lines it grows upward */
    .panel { align-self: stretch; }
    .foot { order: 10; margin-top: auto; }
  }
  /* wide enough that the panel fits beside the board: panel height follows the board,
     the move list scrolls, so the record line always lands on the board's bottom edge */
  @container (min-width: 1000px) {
    .panel { height: 0; min-height: 100%; }
    .panel > * { flex-shrink: 0; }
    .panel > .move-list { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; }
    .move-list .moves { flex: 1 1 auto; min-height: 3em; max-height: none; align-content: start; }
  }

  /* Board */
  .board-wrap { position: relative; width: 100%; max-width: ${BOARD_MAX}; aspect-ratio: 1; user-select: none; -webkit-user-select: none;
                touch-action: none; -webkit-touch-callout: none; }
  .board { position: absolute; inset: 0; display: grid; grid-template-columns: repeat(8, 1fr); grid-template-rows: repeat(8, 1fr); }
  .sq { position: relative; background: var(--sq-light); transition: none; }
  .sq.d { background: var(--sq-dark); }
  /* you won: the winning piece's square and the title dot glitch pink together, same stepped flicker as the buttons */
  .sq.win-glitch::after { content: ""; position: absolute; inset: 0; pointer-events: none; z-index: 1;
    animation: win-glitch ${WIN_GLITCH_MS}ms steps(1, end) ${WIN_GLITCH_TIMES}; }
  .dot.win-glitch { animation: win-glitch ${WIN_GLITCH_MS}ms steps(1, end) ${WIN_GLITCH_TIMES}; }
  @keyframes win-glitch { 0%, 49.99% { background: var(--pink); } 50%, 100% { background: transparent; } }
  @media (prefers-reduced-motion: reduce) { .sq.win-glitch::after { animation: none; background: color-mix(in srgb, var(--pink) 45%, transparent); } .dot.win-glitch { animation: none; } }
  .sq.last::before, .sq.sel::before, .sq.check::before { content: ""; position: absolute; inset: 0; pointer-events: none; }
  .sq.last::before { background: color-mix(in srgb, var(--pink) 30%, transparent); }
  .sq.sel::before { background: color-mix(in srgb, var(--pink) 52%, transparent); }
  .sq.check::before { background: radial-gradient(circle, var(--pink) 0%, color-mix(in srgb, var(--pink) 45%, transparent) 45%, transparent 72%); }
  .sq.hint::after { content: ""; position: absolute; left: 50%; top: 50%; width: 16%; height: 16%; transform: translate(-50%, -50%);
                    border-radius: 50%; background: var(--pink); opacity: .75; pointer-events: none; }
  .sq.hint.cap::after { width: 80%; height: 80%; background: transparent; border: 2px solid var(--pink); opacity: .75; }
  .sq.over { box-shadow: inset 0 0 0 3px var(--pink); }
  .pc { position: absolute; inset: 0; z-index: 2; pointer-events: none; }
  .pc svg { width: 100%; height: 100%; display: block; fill: var(--pk); }
  .pc.w { --pl: var(--w-pl); --pk: var(--w-pk); --ps: var(--w-ps); --pd: var(--w-pd); --fc: var(--w-pl); }
  .pc.b { --pl: var(--b-pl); --pk: var(--b-pk); --ps: var(--b-ps); --pd: var(--b-pd); --fc: var(--b-pxfill, var(--b-pk)); }
  .pc.lift { opacity: .3; }
  .pc.slide { transition: transform .19s cubic-bezier(.3,.6,.3,1); }
  .ghost { position: absolute; z-index: 10; pointer-events: none; width: 12.5%; height: 12.5%; transform: translate(-50%, -50%) scale(1.12); }
  .board-wrap.busy { cursor: progress; }

  /* promotion picker */
  .promo { position: absolute; inset: 0; z-index: 20; display: grid; place-items: center; background: color-mix(in srgb, var(--bg) 70%, transparent); }
  .promo[hidden] { display: none; }
  .promo .row { display: grid; grid-template-columns: repeat(4, 1fr); width: 60%; background: var(--bg); border: 1px solid var(--line); }
  .promo button { aspect-ratio: 1; position: relative; }
  .promo button:hover { background: var(--field); }

  /* Panel */
  .title { display: flex; align-items: center; gap: 9px; font-family: ${BRAND_FONT}; font-size: ${TITLE_SIZE}; font-weight: 700;
           letter-spacing: .04em; text-transform: uppercase; color: var(--strong); }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--pink); flex: none; transform: translateY(calc(var(--dot-nudge) * -1)); }
  .dot.think { animation: blink .9s steps(1, end) infinite; }
  @keyframes blink { 0%,100% { background: var(--pink); } 50% { background: var(--pink-dark); } }
  .lede { color: var(--strong); font: 700 ${HEADER_SIZE}/1.15 ${BRAND_FONT}; min-height: 2.3em; }
  .stats { display: grid; grid-template-columns: repeat(3, auto); justify-content: start; gap: .2rem 1.4rem; }
  .stat .k, .label { font: 500 ${SMALL_SIZE}/1.2 ${MONO_FONT}; letter-spacing: .04em; text-transform: uppercase; color: var(--mute); }
  .stat .v { font: 500 ${BODY_SIZE}/1.3 ${MONO_FONT}; color: var(--strong); font-variant-numeric: tabular-nums; }
  .status { border-top: 1px solid var(--line); padding-top: 1.75rem; display: flex; flex-direction: column; gap: .35rem; }
  .status .main { font: 700 ${TITLE_SIZE}/1.2 ${MONO_FONT}; letter-spacing: .04em; text-transform: uppercase; color: var(--strong); min-height: 1.2em; }
  .status .sub { color: var(--mute); min-height: 1.35em; }
  .status .sub b { color: var(--fg); font-weight: inherit; }
  .win-cta { display: flex; gap: 8px; flex-wrap: wrap; margin-top: .6rem; }
  .win-cta .btn { text-decoration: none; }
  .win-cta .btn.mail { background: ${PINK}; color: #ffffff; font-weight: 700; }
  .win-cta[hidden], .win-count[hidden] { display: none; }
  .win-count { font-variant-numeric: tabular-nums; }

  .seg { display: flex; gap: 6px; max-width: 100%; }
  .seg button { box-shadow: inset 0 0 0 1px ${BTN_BG}; color: var(--fg); }
  .seg button[aria-pressed="true"] { background: ${BTN_BG}; color: ${BTN_FG}; box-shadow: none; }
  .row-btns { gap: 8px; }

  button { all: unset; cursor: pointer; box-sizing: border-box; }
  button:focus-visible { outline: 1px solid var(--fg); outline-offset: 2px; }
  .btn, .seg button { font: 500 ${BTN_SIZE}/1 ${BRAND_FONT}; padding: ${BTN_PAD}; display: inline-flex; align-items: center; justify-content: center; border-radius: ${RADIUS}; }
  .btn { background: ${BTN_BG}; color: ${BTN_FG}; position: relative; overflow: hidden; }
  .btn:disabled { opacity: .35; cursor: default; }
  .btn::after, .seg button::after { content: ""; position: absolute; inset: 0; pointer-events: none; }
  .seg button { position: relative; overflow: hidden; }
  .btn:not(:disabled):hover::after, .btn:focus-visible::after, .seg button:hover::after { animation: glitch .45s steps(1, end) forwards; }
  .light .btn:not(:disabled):hover::after, .light .seg button:hover::after { animation: glitch-light .45s steps(1, end) forwards; }
  @keyframes glitch {
    0% { background-color: rgba(255,255,255,0); } 10% { background-color: rgba(255,255,255,.35); } 20% { background-color: rgba(0,0,0,.35); }
    30% { background-color: rgba(255,255,255,.3); } 40% { background-color: rgba(0,0,0,.4); } 52% { background-color: rgba(255,255,255,.22); }
    62% { background-color: rgba(0,0,0,.35); } 75% { background-color: rgba(255,255,255,.12); } 85%, 100% { background-color: rgba(119,119,119,.3); }
  }
  @keyframes glitch-light {
    0% { background-color: rgba(0,0,0,0); } 10% { background-color: rgba(231,140,249,.45); } 20% { background-color: rgba(0,0,0,.12); }
    30% { background-color: rgba(231,140,249,.3); } 40% { background-color: rgba(0,0,0,.18); } 52% { background-color: rgba(157,100,159,.3); }
    62% { background-color: rgba(0,0,0,.1); } 75% { background-color: rgba(231,140,249,.2); } 85%, 100% { background-color: rgba(174,174,174,.35); }
  }
  .btn, .btn::after, .seg button, .seg button::after { transition: none; }

  .moves { font: 400 ${SMALL_SIZE}/1.55 ${NUM_FONT}; color: var(--fg);
           scrollbar-width: thin; scrollbar-color: var(--thumb) transparent;
           display: grid; grid-template-columns: 2.4em 5.5em 5.5em; justify-content: start; column-gap: .6em; max-height: 13.5em; overflow-y: auto; }
  .moves .n { color: var(--mute); }
  .moves::-webkit-scrollbar { width: 4px; }
  .moves::-webkit-scrollbar-track { background: transparent; }
  .moves::-webkit-scrollbar-thumb { background: var(--thumb); border-radius: 999px; }
  .moves .cur { color: var(--pink); }
  .light .moves .cur { color: #a24db5; }
  .moves:empty::before { content: "No moves yet."; grid-column: 1 / -1; color: var(--mute); font-family: ${BRAND_FONT}; font-size: ${BODY_SIZE}; }
  .foot { color: var(--mute); font-size: ${SMALL_SIZE}; line-height: 1.4; }
  /* Monument Grotesk has tall built-in space above the capitals, which pushes text down in buttons and
     next to the dot. Trim every label to its cap height so centering is optical, not font-metric. */
  .t { display: block; text-box: trim-both cap alphabetic; }
  @supports not (text-box: trim-both cap alphabetic) { .t { position: relative; top: var(--trim-fallback, -2px); } }
  .err { color: var(--pink); }
`;

// Pixel pieces for phones: "#" is the piece; a 1-pixel outline is added around it automatically.
const PIXEL = {
  p: ["............", ".....##.....", "....####....", "....####....", ".....##.....", "....####....", ".....##.....", "....####....", "...######...", "..########..", ".##########.", ".##########."],
  r: [".##.####.##.", ".##.####.##.", ".##########.", "..########..", "...######...", "...######...", "...######...", "...######...", "...######...", "..########..", ".##########.", ".##########."],
  n: ["....##.#....", "...#######..", "..#########.", ".###.######.", ".##..######.", "......#####.", ".....######.", "....#######.", "...########.", "..########..", ".##########.", ".##########."],
  b: [".....##.....", "....####....", "...####.#...", "...###.##...", "...##.###...", "...######...", "....####....", ".....##.....", "....####....", "..########..", ".##########.", ".##########."],
  q: [".#...##...#.", ".#...##...#.", ".##..##..##.", ".###.##.###.", ".##########.", "..########..", "...######...", "...######...", "...######...", "..########..", ".##########.", ".##########."],
  k: [".....##.....", "...######...", ".....##.....", ".....##.....", "..########..", ".##########.", ".##########.", "..########..", "...######...", "...######...", ".##########.", ".##########."],
};
const pixelCache = {};
function pixelSvg(type) {
  if (pixelCache[type]) return pixelCache[type];
  const m = PIXEL[type], H = m.length + 2, W = m[0].length + 2;
  const on = (x, y) => y >= 1 && y <= m.length && x >= 1 && x <= m[0].length && m[y - 1][x - 1] === "#";
  let fill = "", line = "";
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (on(x, y)) fill += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
    else if (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1)) line += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
  }
  return (pixelCache[type] = `<svg class="px" viewBox="-2.5 -3 ${W + 5} ${H + 5}" shape-rendering="crispEdges" aria-hidden="true"><g style="fill:var(--ps)">${line}</g><g style="fill:var(--fc)">${fill}</g></svg>`);
}
const usePixels = () => matchMedia(`(max-width: ${PIXEL_PIECES_BELOW}px)`).matches;

const PIECES = {"wp":"<path d=\"M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03-3 1.06-7.41 5.55-7.41 13.47h23c0-7.92-4.41-12.41-7.41-13.47 1.47-1.19 2.41-3 2.41-5.03 0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z\" stroke-width=\"1.5\" stroke-linecap=\"round\" style=\"fill:var(--pl);stroke:var(--ps)\"/>","wb":"<g fill-rule=\"evenodd\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" style=\"fill:none;stroke:var(--ps)\"><g stroke-linecap=\"butt\" style=\"fill:var(--pl)\"><path d=\"M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.354.49-2.323.47-3-.5 1.354-1.94 3-2 3-2z\"/><path d=\"M15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2z\"/><path d=\"M25 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 1 1 5 0z\"/></g><path d=\"M17.5 26h10M15 30h15m-7.5-14.5v5M20 18h5\" stroke-linejoin=\"miter\"/></g>","wn":"<g fill-rule=\"evenodd\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" style=\"fill:none;stroke:var(--ps)\"><path d=\"M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21\" style=\"fill:var(--pl)\"/><path d=\"M24 18c.38 2.91-5.55 7.37-8 9-3 2-2.82 4.34-5 4-1.042-.94 1.41-3.04 0-3-1 0 .19 1.23-1 2-1 0-4.003 1-4-4 0-2 6-12 6-12s1.89-1.9 2-3.5c-.73-.994-.5-2-.5-3 1-1 3 2.5 3 2.5h2s.78-1.992 2.5-3c1 0 1 3 1 3\" style=\"fill:var(--pl)\"/><path d=\"M9.5 25.5a.5.5 0 1 1-1 0 .5.5 0 1 1 1 0zm5.433-9.75a.5 1.5 30 1 1-.866-.5.5 1.5 30 1 1 .866.5z\" style=\"fill:var(--pk)\"/></g>","wr":"<g fill-rule=\"evenodd\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" style=\"fill:var(--pl);stroke:var(--ps)\"><path d=\"M9 39h27v-3H9v3zm3-3v-4h21v4H12zm-1-22V9h4v2h5V9h5v2h5V9h4v5\" stroke-linecap=\"butt\"/><path d=\"M34 14l-3 3H14l-3-3\"/><path d=\"M31 17v12.5H14V17\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\"/><path d=\"M31 29.5l1.5 2.5h-20l1.5-2.5\"/><path d=\"M11 14h23\" stroke-linejoin=\"miter\" style=\"fill:none\"/></g>","wq":"<g fill-rule=\"evenodd\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" style=\"fill:var(--pl);stroke:var(--ps)\"><path d=\"M8 12a2 2 0 1 1-4 0 2 2 0 1 1 4 0zm16.5-4.5a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM41 12a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM16 8.5a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM33 9a2 2 0 1 1-4 0 2 2 0 1 1 4 0z\"/><path d=\"M9 26c8.5-1.5 21-1.5 27 0l2-12-7 11V11l-5.5 13.5-3-15-3 15-5.5-14V25L7 14l2 12z\" stroke-linecap=\"butt\"/><path d=\"M9 26c0 2 1.5 2 2.5 4 1 1.5 1 1 .5 3.5-1.5 1-1.5 2.5-1.5 2.5-1.5 1.5.5 2.5.5 2.5 6.5 1 16.5 1 23 0 0 0 1.5-1 0-2.5 0 0 .5-1.5-1-2.5-.5-2.5-.5-2 .5-3.5 1-2 2.5-2 2.5-4-8.5-1.5-18.5-1.5-27 0z\" stroke-linecap=\"butt\"/><path d=\"M11.5 30c3.5-1 18.5-1 22 0M12 33.5c6-1 15-1 21 0\" style=\"fill:none\"/></g>","wk":"<g fill-rule=\"evenodd\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" style=\"fill:none;stroke:var(--ps)\"><path d=\"M22.5 11.63V6M20 8h5\" stroke-linejoin=\"miter\"/><path d=\"M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" style=\"fill:var(--pl)\"/><path d=\"M11.5 37c5.5 3.5 15.5 3.5 21 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4V27v-3.5c-3.5-7.5-13-10.5-16-4-3 6 5 10 5 10V37z\" style=\"fill:var(--pl)\"/><path d=\"M11.5 30c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0\"/></g>","bp":"<path d=\"M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03-3 1.06-7.41 5.55-7.41 13.47h23c0-7.92-4.41-12.41-7.41-13.47 1.47-1.19 2.41-3 2.41-5.03 0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z\" stroke-width=\"1.5\" stroke-linecap=\"round\" style=\"stroke:var(--ps)\"/>","bb":"<g fill-rule=\"evenodd\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" style=\"fill:none;stroke:var(--ps)\"><g stroke-linecap=\"butt\" style=\"fill:var(--pk)\"><path d=\"M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.354.49-2.323.47-3-.5 1.354-1.94 3-2 3-2z\"/><path d=\"M15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2z\"/><path d=\"M25 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 1 1 5 0z\"/></g><path d=\"M17.5 26h10M15 30h15m-7.5-14.5v5M20 18h5\" stroke-linejoin=\"miter\" style=\"stroke:var(--pd)\"/></g>","bn":"<g fill-rule=\"evenodd\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" style=\"fill:none;stroke:var(--ps)\"><path d=\"M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21\" style=\"fill:var(--pk)\"/><path d=\"M24 18c.38 2.91-5.55 7.37-8 9-3 2-2.82 4.34-5 4-1.042-.94 1.41-3.04 0-3-1 0 .19 1.23-1 2-1 0-4.003 1-4-4 0-2 6-12 6-12s1.89-1.9 2-3.5c-.73-.994-.5-2-.5-3 1-1 3 2.5 3 2.5h2s.78-1.992 2.5-3c1 0 1 3 1 3\" style=\"fill:var(--pk)\"/><path d=\"M9.5 25.5a.5.5 0 1 1-1 0 .5.5 0 1 1 1 0zm5.433-9.75a.5 1.5 30 1 1-.866-.5.5 1.5 30 1 1 .866.5z\" style=\"fill:var(--pd);stroke:var(--pd)\"/><path d=\"M24.55 10.4l-.45 1.45.5.15c3.15 1 5.65 2.49 7.9 6.75S35.75 29.06 35.25 39l-.05.5h2.25l.05-.5c.5-10.06-.88-16.85-3.25-21.34-2.37-4.49-5.79-6.64-9.19-7.16l-.51-.1z\" style=\"fill:var(--pd);stroke:none\"/></g>","br":"<g fill-rule=\"evenodd\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" style=\"stroke:var(--ps)\"><path d=\"M9 39h27v-3H9v3zm3.5-7l1.5-2.5h17l1.5 2.5h-20zm-.5 4v-4h21v4H12z\" stroke-linecap=\"butt\"/><path d=\"M14 29.5v-13h17v13H14z\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\"/><path d=\"M14 16.5L11 14h23l-3 2.5H14zM11 14V9h4v2h5V9h5v2h5V9h4v5H11z\" stroke-linecap=\"butt\"/><path d=\"M12 35.5h21m-20-4h19m-18-2h17m-17-13h17M11 14h23\" stroke-width=\"1\" stroke-linejoin=\"miter\" style=\"fill:none;stroke:var(--pd)\"/></g>","bq":"<g fill-rule=\"evenodd\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" style=\"stroke:var(--ps)\"><g style=\"stroke:none\"><circle cx=\"6\" cy=\"12\" r=\"2.75\"/><circle cx=\"14\" cy=\"9\" r=\"2.75\"/><circle cx=\"22.5\" cy=\"8\" r=\"2.75\"/><circle cx=\"31\" cy=\"9\" r=\"2.75\"/><circle cx=\"39\" cy=\"12\" r=\"2.75\"/></g><path d=\"M9 26c8.5-1.5 21-1.5 27 0l2.5-12.5L31 25l-.3-14.1-5.2 13.6-3-14.5-3 14.5-5.2-13.6L14 25 6.5 13.5 9 26z\" stroke-linecap=\"butt\"/><path d=\"M9 26c0 2 1.5 2 2.5 4 1 1.5 1 1 .5 3.5-1.5 1-1.5 2.5-1.5 2.5-1.5 1.5.5 2.5.5 2.5 6.5 1 16.5 1 23 0 0 0 1.5-1 0-2.5 0 0 .5-1.5-1-2.5-.5-2.5-.5-2 .5-3.5 1-2 2.5-2 2.5-4-8.5-1.5-18.5-1.5-27 0z\" stroke-linecap=\"butt\"/><path d=\"M11 38.5a35 35 1 0 0 23 0\" stroke-linecap=\"butt\" style=\"fill:none\"/><path d=\"M11 29a35 35 1 0 1 23 0m-21.5 2.5h20m-21 3a35 35 1 0 0 22 0m-23 3a35 35 1 0 0 24 0\" style=\"fill:none;stroke:var(--pd)\"/></g>","bk":"<g fill-rule=\"evenodd\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" style=\"fill:none;stroke:var(--ps)\"><path d=\"M22.5 11.63V6\" stroke-linejoin=\"miter\"/><path d=\"M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\" style=\"fill:var(--pk)\"/><path d=\"M11.5 37c5.5 3.5 15.5 3.5 21 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4V27v-3.5c-3.5-7.5-13-10.5-16-4-3 6 5 10 5 10V37z\" style=\"fill:var(--pk)\"/><path d=\"M20 8h5\" stroke-linejoin=\"miter\"/><path d=\"M32 29.5s8.5-4 6.03-9.65C34.15 14 25 18 22.5 24.5l.01 2.1-.01-2.1C20 18 9.906 14 6.997 19.85c-2.497 5.65 4.853 9 4.853 9\" style=\"stroke:var(--pd)\"/><path d=\"M11.5 30c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0\" style=\"stroke:var(--pd)\"/></g>"};
const pieceSvg = (color, type) => usePixels() ? pixelSvg(type) : `<svg viewBox="0 0 45 45" aria-hidden="true">${PIECES[color + type]}</svg>`;
const NAMES = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };

const SCRAMBLE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+=/<>[]_-";
const SCR_UP = "ABCDEFGHIJKLMNOPQRSTUVWXYZ", SCR_LO = "abcdefghijklmnopqrstuvwxyz", SCR_NUM = "0123456789";
function scrChar(c) {
  const pool = /[0-9]/.test(c) ? SCR_NUM : /[A-Z]/.test(c) ? SCR_UP : /[a-z]/.test(c) ? SCR_LO : "";
  return pool ? pool[Math.floor(Math.random() * pool.length)] : c;
}
// Each character sits in a box locked to the width of its real letter, so the scrambled
// text takes exactly the same space as the final text: no extra lines, no jumping spacing.
// Words stay unbreakable, so line breaks happen in the same places as the final text.
function scramble(el, text, ms = 900) {
  if (el.__scr) cancelAnimationFrame(el.__scr);
  if (reduceMotion() || !el.isConnected) { el.textContent = text; el.__scr = null; return; }
  el.textContent = "";
  const boxes = [];
  for (const part of text.split(/( +)/)) {
    if (!part) continue;
    if (part.trim() === "") { el.appendChild(document.createTextNode(part)); continue; }
    const word = document.createElement("span");
    word.style.whiteSpace = "nowrap";
    for (const c of part) {
      const b = document.createElement("span");
      b.textContent = c;
      b.style.cssText = "display:inline-block;text-align:center;overflow:visible;white-space:pre";
      word.appendChild(b); boxes.push([b, c]);
    }
    el.appendChild(word);
  }
  for (const [b] of boxes) b.style.width = b.getBoundingClientRect().width + "px";
  const order = boxes.map((_, i) => i);
  const t0 = performance.now();
  const frame = (now) => {
    const p = Math.min(1, (now - t0) / ms);
    const settled = Math.floor(p * boxes.length);
    for (let i = 0; i < boxes.length; i++) {
      const [b, c] = boxes[order[i]];
      b.textContent = i < settled ? c : scrChar(c);
    }
    if (p < 1 && el.isConnected) el.__scr = requestAnimationFrame(frame);
    else { el.textContent = text; el.__scr = null; }
  };
  frame(t0);   // starts scrambled on the very first paint, then resolves
  el.__scr = requestAnimationFrame(frame);
}

function buildUI() {
  const host = document.createElement("div");
  host.className = "tanobot-host";
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `<style>${css}</style>
  <div class="wrap">
    <div class="layout">
      <div class="board-col">
      <div class="board-wrap" aria-label="Chess board">
        <div class="board"></div>
        <div class="promo" hidden><div class="row"></div></div>
      </div>
      </div>
      <div class="panel">
        <div class="title"><span class="dot"></span><span class="name">${NAME}</span></div>
        <p class="lede"></p>
        <div class="stats">${["Rapid", "Daily", "Blitz"].map((k) => `<div class="stat"><div class="k">${k}</div><div class="v" data-v>${Array.from({ length: 4 }, () => scrChar("0")).join("")}</div></div>`).join("")}</div>
        <div class="side-pick">
          <div class="label" style="margin-bottom:.5rem">Play as</div>
          <div class="seg" role="group" aria-label="Play as">
            <button data-side="w" aria-pressed="true"><span class="t">White</span></button><button data-side="b" aria-pressed="false"><span class="t">Black</span></button><button data-side="r" aria-pressed="false"><span class="t">Random</span></button>
          </div>
        </div>
        <div class="row-btns">
          <button class="btn primary" data-act="new"><span class="t">New game</span></button>
          <button class="btn" data-act="undo"><span class="t">Undo</span></button>
          <button class="btn" data-act="flip"><span class="t">Flip</span></button>
          <button class="btn" data-act="resign"><span class="t">Resign</span></button>
        </div>
        <div class="status" aria-live="polite"><div class="main t"></div><div class="sub"></div><div class="win-cta" hidden><a class="btn mail" target="_blank" rel="noopener"><span class="t">Email Chris \u2197</span></a></div></div>
        <div class="move-list">
          <div class="label" style="margin-bottom:.5rem">Moves</div>
          <div class="moves"></div>
        </div>
        <div class="foot"><div class="win-count" hidden></div><div class="record"></div></div>
      </div>
    </div>
  </div>`;
  return { host, root };
}

function boot(base) {
  BASE = base;
  // load tano's Adobe Fonts kit (OCR-A) once, unless the site already has it
  if (FONT_CSS && !document.querySelector(`link[href="${FONT_CSS}"]`)) {
    const l = document.createElement("link"); l.rel = "stylesheet"; l.href = FONT_CSS; document.head.appendChild(l);
  }
  const { host, root } = buildUI();
  const $ = (s) => root.querySelector(s);
  const wrap = $(".wrap"), boardEl = $(".board"), boardWrap = $(".board-wrap");
  const mainEl = $(".status .main"), subEl = $(".status .sub"), movesEl = $(".moves"), dot = $(".dot");

  let chess = new Chess();
  let me = "w";                 // the visitor's color
  let sidePref = "w";
  let orient = "w";
  let undosLeft = UNDOS_PER_GAME;
  let lastQuip = "";
  let selected = null;
  let gameId = 0;
  let botBusy = false;
  let over = null;              // { text, sub, result }
  let resignDecided = false;
  let lastSource = null;
  let started = false;

  // ── theme ──
  function applyTheme() {
    const light = document.documentElement.getAttribute("data-theme") === "light";
    wrap.classList.toggle("light", light);
    const t = BOARD[light ? "light" : "dark"];
    const s = wrap.style;
    s.setProperty("--sq-light", t.light); s.setProperty("--sq-dark", t.dark);
    for (const k of ["pl", "pk", "ps", "pd"]) { s.setProperty("--w-" + k, t.white[k]); s.setProperty("--b-" + k, t.black[k]); }
    if (t.black.pxfill) s.setProperty("--b-pxfill", t.black.pxfill); else s.removeProperty("--b-pxfill");
  }
  applyTheme();
  try { matchMedia(`(max-width: ${PIXEL_PIECES_BELOW}px)`).addEventListener("change", () => render(false)); } catch (e) {}
  new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  // ── save / restore ──
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ moves: chess.history(), me, sidePref, orient, over, undosLeft })); } catch (e) {}
  }
  function restore() {
    // testing: open the page with #test-win to get a mate-in-one (play Qxf7) and see the win celebration
    if (/test-win/.test(location.hash)) {
      const c = new Chess(); ["e4", "e5", "Bc4", "Nc6", "Qh5", "Nf6"].forEach((m) => c.move(m));
      chess = c; me = "w"; sidePref = "w"; orient = "w"; over = null;
      try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
      return true;
    }
    try {
      const s = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
      if (!s) return false;
      const c = new Chess();
      for (const m of s.moves || []) c.move(m);
      chess = c; me = s.me || "w"; sidePref = s.sidePref || me; orient = s.orient || me; over = s.over || null; undosLeft = typeof s.undosLeft === "number" ? s.undosLeft : UNDOS_PER_GAME;
      return true;
    } catch (e) { return false; }
  }

  // ── board rendering ──
  const squares = [];
  function squareAt(i) { // i = visual index 0..63, top-left first
    const r = Math.floor(i / 8), f = i % 8;
    return orient === "w" ? FILES[f] + (8 - r) : FILES[7 - f] + (r + 1);
  }
  for (let i = 0; i < 64; i++) { const d = document.createElement("div"); d.className = "sq"; boardEl.appendChild(d); squares.push(d); }

  function lastMove() { const h = chess.history({ verbose: true }); return h[h.length - 1] || null; }
  function kingSquare(color) {
    for (const row of chess.board()) for (const sq of row) if (sq && sq.type === "k" && sq.color === color) return sq.square;
  }
  function render(anim) {
    const lm = lastMove();
    const hints = selected ? chess.moves({ square: selected, verbose: true }) : [];
    const checkSq = chess.inCheck() ? kingSquare(chess.turn()) : null;
    for (let i = 0; i < 64; i++) {
      const sq = squareAt(i), el = squares[i];
      const fi = FILES.indexOf(sq[0]), rk = +sq[1];
      el.dataset.sq = sq;
      el.className = "sq" + ((fi + rk) % 2 === 1 ? " d" : "");
      if (lm && (lm.from === sq || lm.to === sq)) el.classList.add("last");
      if (selected === sq) el.classList.add("sel");
      if (checkSq === sq) el.classList.add("check");
      const h = hints.find((m) => m.to === sq);
      if (h) el.classList.add("hint"), h.captured && el.classList.add("cap");
      const p = chess.get(sq);
      let html = "";
      if (p) html += `<div class="pc ${p.color}" data-p="${p.color}${p.type}">${pieceSvg(p.color, p.type)}</div>`;
      el.innerHTML = html;
    }
    if (anim && lm && !reduceMotion()) slide(lm);
    renderMoves();
  }
  function visualPos(sq) {
    const f = FILES.indexOf(sq[0]), r = +sq[1];
    return orient === "w" ? { x: f, y: 8 - r } : { x: 7 - f, y: r - 1 };
  }
  function slide(mv) {
    const el = squares.find((s) => s.dataset.sq === mv.to)?.querySelector(".pc");
    if (!el) return;
    const a = visualPos(mv.from), b = visualPos(mv.to);
    el.style.transform = `translate(${(a.x - b.x) * 100}%, ${(a.y - b.y) * 100}%)`;
    el.getBoundingClientRect();
    el.classList.add("slide");
    el.style.transform = "";
    // castling: slide the rook too
    if (mv.san.startsWith("O-O")) {
      const rank = mv.to[1], long = mv.san.startsWith("O-O-O");
      const rf = (long ? "a" : "h") + rank, rt = (long ? "d" : "f") + rank;
      const rel = squares.find((s) => s.dataset.sq === rt)?.querySelector(".pc");
      if (rel) {
        const c = visualPos(rf), d = visualPos(rt);
        rel.style.transform = `translate(${(c.x - d.x) * 100}%, ${(c.y - d.y) * 100}%)`;
        rel.getBoundingClientRect(); rel.classList.add("slide"); rel.style.transform = "";
      }
    }
  }
  function renderMoves() {
    const h = chess.history();
    let html = "";
    for (let i = 0; i < h.length; i += 2) {
      html += `<span class="n">${i / 2 + 1}.</span><span${i === h.length - 1 ? ' class="cur"' : ""}>${h[i]}</span><span${i + 1 === h.length - 1 ? ' class="cur"' : ""}>${h[i + 1] || ""}</span>`;
    }
    movesEl.innerHTML = html;
    movesEl.scrollTop = movesEl.scrollHeight;
  }

  // ── status line ──
  let lastMain = "", booted = false;   // the status line only scrambles after the page has loaded
  function status(main, sub, scr = true) {
    if (main !== lastMain) { scr && booted ? scramble(mainEl, main, 600) : (mainEl.textContent = main); lastMain = main; }
    subEl.innerHTML = sub || "";
  }
  function sourceText(src) {
    if (!src) return "";
    if (src.type === "book") return src.total > 1
      ? `From memory: tano played <b>${src.san}</b> here ${src.n === src.total ? "every time" : Math.round((100 * src.n) / src.total) + "% of the time"}.`
      : `From memory: <b>${src.san}</b>, straight out of one of tano's games.`;
    if (src.loss >= 20) return `<b>${src.san}</b>. That one's a blunder. Very on brand.`;
    if (src.loss >= 10) return `Improvising: <b>${src.san}</b>. Not his best.`;
    return `Improvising: <b>${src.san}</b>.`;
  }
  function updateButtons() {
    const h = chess.history().length;
    root.querySelector('[data-act="resign"]').disabled = !!over || h < 2;
    root.querySelector('[data-act="undo"]').disabled = !!over || botBusy || undosLeft < 1 || h === 0 || (me === "b" && h <= 1);
    root.querySelectorAll(".seg button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.side === sidePref)));
  }
  const winCta = $(".win-cta");
  winCta.addEventListener("click", (e) => { const a = e.target.closest("a"); if (a) track("tanomate_win_contact", { via: "email", moves: chess.history().length }); });
  function refreshStatus() {
    const won = !!over && over.result === "win";
    winCta.hidden = !won;

    if (won) {
      const n = Math.ceil(chess.history().length / 2);
      winCta.querySelector(".mail").href = `mailto:${WIN_EMAIL}?subject=${encodeURIComponent("I beat TANOMATE")}&body=${encodeURIComponent(`Hey Chris, I just beat your chess bot in ${n} moves (${over.text.toLowerCase()}).`)}`;
    }
    if (over) { status(over.text, won ? WIN_LINE : over.sub); dot.classList.remove("think"); }
    else if (chess.turn() === me) status(chess.inCheck() ? "Check. Your move" : "Your move", lastQuip || sourceText(lastSource));
    updateButtons();
  }

  // ── game flow ──
  function checkOver() {
    if (over) return true;
    if (chess.isCheckmate()) {
      const youWon = chess.turn() !== me;
      over = youWon ? { text: "Checkmate. You win", sub: "You beat tano. Screenshot it.", result: "win" }
                    : { text: "Checkmate. Tano wins", sub: quip("mated"), result: "loss" };
    } else if (chess.isDraw() || chess.isStalemate()) {
      const why = chess.isStalemate() ? "Stalemate" : chess.isThreefoldRepetition() ? "Draw by repetition" : chess.isInsufficientMaterial() ? "Draw. Not enough pieces" : "Draw";
      const rec = (BOOK && BOOK.record) || null;
      const pct = rec ? Math.max(1, Math.round((100 * rec.draws) / (rec.wins + rec.losses + rec.draws))) : 3;
      over = { text: why, sub: `Nobody wins. Only ${pct}% of tano's real games end in a draw.`, result: "draw" };
    }
    if (over) { track("tanobot_end", { result: over.result, moves: chess.history().length }); save(); if (over.result === "win") celebrate(); }
    return !!over;
  }
  let celebrateT = 0;
  // shared win counter: each browser adds itself once; the server also caps one count per visitor every 6 hours
  const winCount = $(".win-count");
  let countShown = null, countReq = 0;
  function showCount(n, animate) {
    if (typeof n !== "number" || !isFinite(n) || n < 1) return;
    winCount.hidden = false;
    const text = WIN_COUNT_LABEL + n;
    if (animate && countShown !== n) scramble(winCount, text, 700); else winCount.textContent = text;
    countShown = n;
  }
  function loadCount(add) {
    let already = false;
    try { already = localStorage.getItem("tanomate-win-counted") === "1"; } catch (e) {}
    const post = add && !already;
    const id = ++countReq;   // the newest request wins (a win's POST beats an earlier GET)
    fetch(BASE + "/api/wins", { method: post ? "POST" : "GET" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d || id !== countReq) return;
        if (post) { try { localStorage.setItem("tanomate-win-counted", "1"); } catch (e) {} }
        showCount(d.count, post);
      })
      .catch(() => {});
  }
  function celebrate() {
    countReq++; loadCount(true);
    const last = chess.history({ verbose: true }).filter((m) => m.color === me).pop();
    const sqEl = last && boardEl.querySelector(`.sq[data-sq="${last.to}"]`);
    const els = [dot, sqEl].filter(Boolean);
    els.forEach((el) => { el.classList.remove("win-glitch"); void el.offsetWidth; el.classList.add("win-glitch"); });
    clearTimeout(celebrateT);
    celebrateT = setTimeout(() => els.forEach((el) => el.classList.remove("win-glitch")), WIN_GLITCH_MS * WIN_GLITCH_TIMES + 100);
  }
  function afterMove(anim) {
    selected = null;
    render(anim);
    save();
    if (checkOver()) { refreshStatus(); return; }
    if (chess.turn() !== me) botTurn(); else refreshStatus();
  }
  function tryMove(from, to, promotion) {
    if (over || botBusy || chess.turn() !== me) return false;
    const legal = chess.moves({ square: from, verbose: true }).filter((m) => m.to === to);
    if (!legal.length) return false;
    if (legal.some((m) => m.promotion) && !promotion) { askPromotion(from, to); return true; }
    chess.move({ from, to, promotion: promotion || undefined });
    if (!started) { started = true; track("tanobot_start", { side: me }); }
    afterMove(false);
    return true;
  }

  async function botTurn() {
    const id = gameId;
    botBusy = true; boardWrap.classList.add("busy"); dot.classList.add("think");
    status("Tano is thinking", sourceText(lastSource));
    updateButtons();
    const t0 = performance.now();
    let pick = null, src = null, grab = null;
    try {
      if (!engine) engine = makeEngine();
      const lines = await engine.analyse(chess.fen(), isMobile() ? DEPTH_MOBILE : DEPTH, MULTIPV);
      if (id !== gameId) return;
      grab = freeGrab(chess, lines);
      const b = grab ? null : bookMove(chess, lines);
      if (grab) { pick = grab; src = { type: "engine", san: grab, loss: 0 }; }
      else if (b) { pick = b.san; src = { type: "book", san: b.san, n: b.n, total: b.total }; }
      else {
        // tano resigns lost positions about as often as he really does
        if (!resignDecided && lines.length && lines[0].cp <= RESIGN_CP) {
          resignDecided = true;
          if (Math.random() < ((BOOK && BOOK.resignRate) || 0.7)) {
            await sleep(rand(700, 1300)); if (id !== gameId) return;
            over = { text: "Tano resigned", sub: `He resigns ${Math.round(((BOOK && BOOK.resignRate) || 0.7) * 100)}% of the games he loses. Real stat.`, result: "win" };
            track("tanobot_end", { result: "win_resign", moves: chess.history().length });
            botBusy = false; boardWrap.classList.remove("busy"); save(); refreshStatus(); celebrate(); return;
          }
        }
        const h = humanMove(chess, lines);
        if (h) { pick = h.san; src = { type: "engine", san: h.san, loss: h.loss }; }
      }
    } catch (e) { console.warn("[tanobot]", e); }
    if (id !== gameId) return;
    if (!pick) { // fallback: any legal move, so the game never stalls
      const all = chess.moves(); pick = all[Math.floor(Math.random() * all.length)];
      src = { type: "engine", san: pick, loss: 0 };
    }
    const min = src.type === "book" ? THINK_MS[0] : rand(THINK_MS[0], THINK_MS[1]);
    const wait = min - (performance.now() - t0);
    if (wait > 0) await sleep(wait);
    if (id !== gameId) return;
    const plyBefore = chess.history().length, wasCheck = chess.inCheck();
    const prev = chess.history({ verbose: true }).pop();   // your last move
    const mv = chess.move(pick);
    lastSource = src;
    // pick a line of trash talk for this moment (or none)
    lastQuip = "";
    if (mv) {
      const castled = /^O-O/.test(mv.san);
      const youCanTake = mv.piece === "p" && chess.moves({ verbose: true }).some((m) => m.to === mv.to && m.captured);
      if (mv.captured === "q") lastQuip = quip("queen");
      else if (grab && mv.captured) lastQuip = quip("hang", mv.captured);
      else if (src.type === "engine" && src.loss >= 20) lastQuip = quip("blunder");
      else if (mv.piece === "k" && !castled && !wasCheck && plyBefore < BOOK_PLIES) lastQuip = quip("kingWalk");
      else if (castled) lastQuip = quip("castle");
      else if (src.type === "book" && plyBefore < 10 && youCanTake) lastQuip = quip("gambit");
      else if (prev && prev.captured && VALUE[prev.captured] >= 3 && !mv.captured) lastQuip = quip("youTook");
    }
    botBusy = false; boardWrap.classList.remove("busy"); dot.classList.remove("think");
    afterMove(true);
  }

  function newGame() {
    gameId++; botBusy = false; boardWrap.classList.remove("busy"); dot.classList.remove("think");
    chess = new Chess(); over = null; selected = null; resignDecided = false; lastSource = null; started = false; undosLeft = UNDOS_PER_GAME; lastQuip = "";
    me = sidePref === "r" ? (Math.random() < 0.5 ? "w" : "b") : sidePref;
    orient = me;
    lastMain = "";
    render(false); save();
    if (me === "b") botTurn(); else { status("Your move", "You're White. Good luck."); updateButtons(); }
  }

  // ── promotion ──
  const promo = $(".promo"), promoRow = $(".promo .row");
  function askPromotion(from, to) {
    promoRow.innerHTML = "";
    for (const t of ["q", "r", "b", "n"]) {
      const b = document.createElement("button");
      b.setAttribute("aria-label", "Promote to " + NAMES[t]);
      b.innerHTML = `<div class="pc ${me}">${pieceSvg(me, t)}</div>`;
      b.onclick = () => { promo.hidden = true; tryMove(from, to, t); };
      promoRow.appendChild(b);
    }
    promo.hidden = false;
  }
  promo.addEventListener("click", (e) => { if (e.target === promo) { promo.hidden = true; selected = null; render(false); } });

  // ── input: tap-tap or drag ──
  let drag = null;
  function sqFromPoint(x, y) {
    const r = boardWrap.getBoundingClientRect();
    const fx = Math.floor(((x - r.left) / r.width) * 8), fy = Math.floor(((y - r.top) / r.height) * 8);
    if (fx < 0 || fx > 7 || fy < 0 || fy > 7) return null;
    return squareAt(fy * 8 + fx);
  }
  function ownPiece(sq) { const p = sq && chess.get(sq); return p && p.color === me; }
  boardWrap.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || over || botBusy || chess.turn() !== me || !promo.hidden) return;
    const sq = sqFromPoint(e.clientX, e.clientY);
    if (!sq) return;
    if (selected && selected !== sq && !ownPiece(sq)) { if (!tryMove(selected, sq)) { selected = null; render(false); } return; }
    if (!ownPiece(sq)) { if (selected) { selected = null; render(false); } return; }
    const wasSelected = selected === sq;
    selected = sq; render(false);
    const p = chess.get(sq);
    drag = { from: sq, x: e.clientX, y: e.clientY, moved: false, ghost: null, wasSelected, p, id: e.pointerId };
    boardWrap.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  boardWrap.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const r = boardWrap.getBoundingClientRect();
    if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 5) return;
    if (!drag.moved) {
      drag.moved = true;
      const g = document.createElement("div");
      g.className = "pc ghost " + drag.p.color;
      g.innerHTML = pieceSvg(drag.p.color, drag.p.type);
      boardWrap.appendChild(g); drag.ghost = g;
      squares.find((s) => s.dataset.sq === drag.from)?.querySelector(".pc")?.classList.add("lift");
    }
    drag.ghost.style.left = e.clientX - r.left + "px";
    drag.ghost.style.top = e.clientY - r.top + "px";
    const over = sqFromPoint(e.clientX, e.clientY);
    squares.forEach((s) => s.classList.toggle("over", s.dataset.sq === over && over !== drag.from));
  });
  function endDrag(e, cancel) {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null;
    if (d.ghost) d.ghost.remove();
    squares.forEach((s) => s.classList.remove("over"));
    const to = cancel ? null : sqFromPoint(e.clientX, e.clientY);
    if (d.moved) {
      if (!to || to === d.from || !tryMove(d.from, to)) render(false);
    } else if (d.wasSelected) { selected = null; render(false); }
  }
  boardWrap.addEventListener("pointerup", (e) => endDrag(e, false));
  boardWrap.addEventListener("pointercancel", (e) => endDrag(e, true));

  // ── buttons ──
  root.querySelector(".seg").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    sidePref = b.dataset.side; updateButtons(); save();
    if (!chess.history().length || over) newGame();
  });
  root.querySelector(".row-btns").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b || b.disabled) return;
    const act = b.dataset.act;
    if (act === "new") newGame();
    if (act === "flip") { orient = orient === "w" ? "b" : "w"; render(false); save(); }
    if (act === "undo") {   // one take-back per game (tano's rule), and none once the game is over
      if (undosLeft < 1 || over) return;
      undosLeft--;
      gameId++; botBusy = false; boardWrap.classList.remove("busy"); dot.classList.remove("think");
      if (engine) engine.stop();
      selected = null; lastSource = null; lastQuip = quip("undo");
      chess.undo();
      if (chess.turn() !== me) chess.undo();
      render(false); save(); refreshStatus();
      if (chess.turn() !== me) botTurn();
    }
    if (act === "resign") {
      gameId++; botBusy = false; boardWrap.classList.remove("busy");
      over = { text: "You resigned", sub: "Respect. Tano does it all the time.", result: "resign" };
      track("tanobot_end", { result: "resign", moves: chess.history().length });
      save(); refreshStatus();
    }
  });

  // ── intro text + stats ──
  function intro() {
    const lede = $(".lede"), stats = $(".stats"), foot = $(".foot");
    if (!BOOK) {
      lede.textContent = "Built from tano's chess.com games. Plays Chris's openings, instincts, and mistakes.";
      return;
    }
    lede.textContent = (`Built from ${BOOK.games} of tano's chess.com games. Plays Chris's openings, instincts, and mistakes.`);
    const r = BOOK.ratings || {};
    const cells = [["Rapid", r.rapid], ["Daily", r.daily], ["Blitz", r.blitz]].filter((c) => c[1]);
    const same = cells.map((c) => c[0]).join() === [...stats.querySelectorAll(".k")].map((k) => k.textContent).join();
    if (!same) stats.innerHTML = cells.map(([k]) => `<div class="stat"><div class="k">${k}</div><div class="v" data-v></div></div>`).join("");
    stats.querySelectorAll("[data-v]").forEach((el, i) => scramble(el, String(cells[i][1]), 700));
    const rec = BOOK.record || {};
    foot.querySelector(".record").textContent = `Real record ${rec.wins}W ${rec.losses}L ${rec.draws}D · Updated ${BOOK.built}`;
  }

  // ── start ──
  const resumed = restore();
  render(false);
  updateButtons();
  loadCount(false);   // "Visitors who've beaten Chris" line above the record (hidden until the first win)
  fetch(BASE + "/chess/tano-book.json").then((r) => r.json()).then((b) => { BOOK = b; intro(); })
    .catch(() => { intro(); })
    .finally(() => {
      if (over) refreshStatus();
      else if (resumed && chess.history().length) { started = true; chess.turn() === me ? refreshStatus() : botTurn(); }
      else newGame();
      booted = true;
    });
  // warm the engine up while the visitor reads, so the first move out of book is quick
  setTimeout(() => { if (!engine) engine = makeEngine(); }, 1500);

  return host;
}

// ── mount: Cargo swaps pages without reloading, so keep checking ───────────
let hostEl = null;
export function mount(base) {
  const place = () => {
    const m = document.querySelector("[data-tano-chess]");
    if (!m) return;
    if (!hostEl) hostEl = boot(base);
    if (hostEl.parentNode !== m) m.appendChild(hostEl);
  };
  place();
  let q = false;
  new MutationObserver(() => { if (q) return; q = true; requestAnimationFrame(() => { q = false; place(); }); })
    .observe(document.body, { childList: true, subtree: true });
}

