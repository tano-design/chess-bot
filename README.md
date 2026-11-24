# Retrain TANOBOT on your newer games

The bot's brain is one file: `public/chess/tano-book.json`. This folder rebuilds it from your chess.com games.

**Easiest:** ask Claude in the tanodsgn project to "retrain the chess bot". It pulls your games, rebuilds the file, and hands it back.

**Do it yourself (needs Node 20+ from nodejs.org, about 2 minutes):**

1. Download this `chess-tools` folder to your laptop.
2. Open Terminal in it and run:
   ```
   npm install
   node build-book.mjs
   ```
   It downloads every itstano game from chess.com, has Stockfish grade each of your moves, and writes `tano-book.json` next to the script.
3. On GitHub, open `public/chess/` in your chess repo, click **Add file → Upload files**, drop in the new `tano-book.json`, and commit. Vercel redeploys in about a minute.

Options: `node build-book.mjs --fast` skips the Stockfish grading (openings only, a few seconds).
`node build-book.mjs --pgn mygames.pgn` uses a PGN you downloaded from chess.com instead.

**What it learns**
- **Openings:** every position from your first 10 moves, and how often you played each move there. Games since 2025 count double.
- **Mistakes:** Stockfish scores how much winning chance each of your moves gave away. The bot copies that spread, separately for opening, middlegame and endgame, so it blunders about as often as you do.
- **Habits:** how often you capture, check, castle each side, push pawns, or move each piece, compared with what Stockfish would do in the same spot.
- **Resigning:** how often you resign a lost game. The bot does too.
