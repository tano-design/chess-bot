# TANOMATE

A chess bot that plays like me. Not like a grandmaster, like **me**: my openings, my habits, my blunders.

**Play it:** [tanodsgn.com/chess](https://tanodsgn.com/chess)

I built it as an easter egg for my portfolio site. It learned from 598 of my own games on chess.com (`itstano`), so if you beat it, you've beaten a reasonable impression of Chris DeGaetano.

## How it plays

- **Openings from memory.** For the first 10 moves it plays from an opening book built from my games, weighted toward my recent ones. That means the King's Indian as Black, 1.e4 as White, and the occasional Danish or Englund gambit.
- **Then it thinks like me.** After the opening, Stockfish suggests a range of candidate moves. The bot picks among them using my real mistake rate for each phase of the game (opening, middlegame, endgame). It makes about as many inaccuracies as I do, at about the moments I make them.
- **House rules.** It never plays obvious troll moves, like a knight on the rim or an early edge-pawn push. It does sometimes walk its king, because I genuinely do that. It almost always grabs free material in the opening.
- **No server, no cost.** Everything runs in the visitor's browser. Stockfish runs as WebAssembly in a background worker, and nothing is sent anywhere while you play.
- **Win counter.** Beat it and you're added to the "visitors who've beaten Chris" count. That's the only server call: a tiny Vercel function backed by Redis, limited to one counted win per visitor every 6 hours.

## What's inside

| Path | What it is |
|---|---|
| `public/chess/tano-chess.js` | The board, the UI and the bot's move choice |
| `public/chess/tano-book.json` | The opening book and style stats built from my games |
| `public/chess/embed.js` | Drops the game into a page on my Cargo site |
| `public/chess/stockfish.*` | The Stockfish 19 chess engine (WebAssembly) |
| `api/wins.js` | The win counter |

The design matches [tanodsgn.com](https://tanodsgn.com): Monument Grotesk and OCR-A type, my site's colors, and the glitch effects from the rest of the site. It follows the site's light/dark toggle.

## Credits

- [Stockfish](https://github.com/official-stockfish/Stockfish) 19 via [stockfish.js](https://github.com/nmrugg/stockfish.js), GPLv3 (see `public/chess/STOCKFISH-LICENSE.txt`)
- [chess.js](https://github.com/jhlywa/chess.js), BSD-2-Clause
- Pieces: the "cburnett" set by Colin M.L. Burnett, recolored
- Built with help from Claude

Full credits are in `public/chess/CREDITS.txt`.

Made by [Chris DeGaetano](https://tanodsgn.com), graphic and brand designer.
