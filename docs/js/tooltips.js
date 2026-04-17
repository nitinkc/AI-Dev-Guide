/**
 * Tooltip engine for abbr[title] elements.
 * Appends tooltip div to <body> — never clipped by table overflow.
 */
(function () {
  const tip = document.createElement("div");
  tip.id = "abbr-tooltip";
  tip.style.cssText = [
    "position:fixed",
    "z-index:9999",
    "max-width:320px",
    "padding:7px 11px",
    "background:#1e1e2e",
    "color:#cdd6f4",
    "font-size:0.8rem",
    "line-height:1.5",
    "border-radius:6px",
    "box-shadow:0 4px 14px rgba(0,0,0,0.4)",
    "pointer-events:none",
    "display:none",
    "white-space:normal",
    "word-break:break-word"
  ].join(";");
  document.body.appendChild(tip);

  function show(e) {
    var text = e.currentTarget.dataset.title;
    if (!text) return;
    tip.textContent = text;
    tip.style.display = "block";
    move(e);
  }

  function move(e) {
    var GAP = 14;
    var vw  = window.innerWidth;
    var tw  = tip.offsetWidth;
    var th  = tip.offsetHeight;
    var x   = e.clientX + GAP;
    var y   = e.clientY - th - GAP;
    if (x + tw > vw - 8) { x = e.clientX - tw - GAP; }
    if (y < 8)            { y = e.clientY + GAP; }
    tip.style.left = x + "px";
    tip.style.top  = y + "px";
  }

  function hide() { tip.style.display = "none"; }

  function attach() {
    document.querySelectorAll("abbr[title], abbr[data-title]").forEach(function (el) {
      // Move title into data-title so the browser's native tooltip doesn't overlap
      if (!el.dataset.title && el.getAttribute("title")) {
        el.dataset.title = el.getAttribute("title");
        el.removeAttribute("title");
      }
      el.removeEventListener("mouseenter", show);
      el.removeEventListener("mousemove",  move);
      el.removeEventListener("mouseleave", hide);
      el.addEventListener("mouseenter", show);
      el.addEventListener("mousemove",  move);
      el.addEventListener("mouseleave", hide);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", attach);
  } else {
    attach();
  }

  // Re-attach after MkDocs Material instant-navigation page swaps
  document.addEventListener("DOMContentSwapped", attach);
})();
