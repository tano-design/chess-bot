/*  TANOBOT loader. Paste ONE line into Cargo (Site Settings → CSS / HTML → HTML, at the very end):
 *    <script src="https://YOUR-VERCEL-ADDRESS/chess/embed.js" defer></script>
 *  Then on the hidden page, in code view:  <div data-tano-chess></div>
 *  This file is tiny. The game itself only downloads on the page that has that div.
 */
(function () {
  if (window.__tanoChessLoader) return; // Cargo can re-run scripts between pages
  window.__tanoChessLoader = true;
  var base = new URL(document.currentScript.src).origin;
  var loading = false;
  function check() {
    if (loading || !document.querySelector("[data-tano-chess]")) return;
    loading = true;
    import(base + "/chess/tano-chess.js").then(function (m) { m.mount(base); })
      .catch(function (e) { loading = false; console.warn("[tanobot] could not load", e); });
  }
  check();
  new MutationObserver(check).observe(document.documentElement, { childList: true, subtree: true });
})();
