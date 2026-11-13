/*!
 * theme-toggle.js — animated sun/moon dark-mode switch for Roadaro
 * Vanilla port of the React/shadcn <ThemeToggle> component.
 *
 * Usage:  <theme-toggle></theme-toggle>            (size="md" default)
 *         <theme-toggle size="sm"></theme-toggle>
 *         <theme-toggle size="lg"></theme-toggle>
 *
 * Wires into Roadaro's canonical theme system:
 *   - toggles  <html data-theme="dark">   (styled by premium.css)
 *   - persists localStorage["dv_theme"] = "dark" | "light"
 *   - stays in sync with the nav toggle / dvTheme() / toggleTheme()
 *
 * Self-contained (Shadow DOM): no Tailwind, no build step, no deps.
 */
(function () {
  "use strict";
  if (window.customElements && customElements.get("theme-toggle")) return;

  var SIZES = {
    sm: { track: [44, 24], knob: 16, pad: 2, icon: 12 },
    md: { track: [56, 32], knob: 24, pad: 2, icon: 16 },
    lg: { track: [72, 40], knob: 32, pad: 2, icon: 20 }
  };

  // Lucide "moon" path, sun matches the original component's inline SVG.
  function sunSVG(size) {
    return (
      '<svg class="icon sun" aria-hidden="true" width="' + size + '" height="' + size +
      '" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      '<circle cx="12" cy="12" r="3.25" fill="currentColor"/>' +
      '<g stroke="currentColor" stroke-linecap="round" stroke-width="2">' +
      '<path d="M12 2.5v2.5"/><path d="M12 19v2.5"/>' +
      '<path d="M4.22 4.22l1.77 1.77"/><path d="M18.01 18.01l1.77 1.77"/>' +
      '<path d="M2.5 12h2.5"/><path d="M19 12h2.5"/>' +
      '<path d="M4.22 19.78l1.77-1.77"/><path d="M18.01 5.99l1.77-1.77"/></g></svg>'
    );
  }
  function moonSVG(size) {
    return (
      '<svg class="icon moon" aria-hidden="true" width="' + size + '" height="' + size +
      '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>'
    );
  }

  function isDark() {
    return document.documentElement.getAttribute("data-theme") === "dark";
  }

  // Apply theme through Roadaro's canonical path so all toggles stay in sync.
  function applyTheme(dark) {
    var d = document.documentElement;
    if (dark) d.setAttribute("data-theme", "dark");
    else d.removeAttribute("data-theme");
    try { localStorage.setItem("dv_theme", dark ? "dark" : "light"); } catch (e) {}
    // Notify any other on-page toggles (e.g. dashboard's #theme-tg icon).
    try { document.querySelectorAll("#theme-tg i").forEach(function (i) {
      i.className = "ti ti-" + (dark ? "sun" : "moon");
    }); } catch (e) {}
    window.dispatchEvent(new CustomEvent("roadaro:themechange", { detail: { dark: dark } }));
  }

  var EASE = "cubic-bezier(0.68,-0.55,0.265,1.55)";

  /* ── Circular reveal transition ──────────────────────────────────────────
   * v1 (instant swap) was a flash-bang; v2 (full-screen curtain) made the whole
   * page vanish for a second — owner disliked both. v3: the View Transitions
   * API morphs the page in place — the NEW theme expands from the toggle in a
   * growing circle while the old theme is still visible around it. Content
   * never disappears. Falls back to an instant flip when the API is missing
   * or the user prefers reduced motion. */
  var _revealing = false;

  function revealToggle(x, y) {
    if (_revealing) return;
    var next = !isDark();
    var rm = false;
    try { rm = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
    if (rm || typeof document.startViewTransition !== "function") { applyTheme(next); return; }
    if (x == null || y == null) { x = window.innerWidth - 40; y = 24; }  // toggle lives top-right-ish
    _revealing = true;

    // Kill the API's default crossfade so ONLY our circle drives the reveal.
    if (!document.getElementById("tt-vt-css")) {
      var st = document.createElement("style");
      st.id = "tt-vt-css";
      st.textContent = "::view-transition-old(root),::view-transition-new(root){animation:none;mix-blend-mode:normal;}" +
                       "::view-transition-old(root){z-index:1;}::view-transition-new(root){z-index:2;}";
      document.head.appendChild(st);
    }

    var vt = document.startViewTransition(function () { applyTheme(next); });
    vt.ready.then(function () {
      var r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
      var anim = document.documentElement.animate(
        { clipPath: ["circle(0px at " + x + "px " + y + "px)", "circle(" + r + "px at " + x + "px " + y + "px)"] },
        { duration: 480, easing: "cubic-bezier(0.4, 0, 0.2, 1)", pseudoElement: "::view-transition-new(root)" }
      );
      anim.finished.catch(function () {}).then(function () { _revealing = false; });
    }).catch(function () { _revealing = false; });
    vt.finished.catch(function () {}).then(function () { _revealing = false; });
  }
  // Back-compat: page-local toggles were pointed at the curtain name.
  window.roadaroThemeCurtainToggle = revealToggle;
  window.roadaroThemeRevealToggle = revealToggle;

  function css(cfg) {
    var trackW = cfg.track[0], trackH = cfg.track[1], knob = cfg.knob, pad = cfg.pad;
    var border = 2; // matches the 2px track border below
    // Knob is absolutely positioned inside the padding box (trackW - 2*border wide),
    // so travel must subtract both borders as well as the start/end padding.
    var travel = trackW - knob - pad * 2 - border * 2; // px the knob slides
    return (
      ":host{display:inline-block;line-height:0}" +
      ".track{position:relative;box-sizing:border-box;cursor:pointer;border-radius:9999px;" +
        "border:2px solid;padding:0;width:" + trackW + "px;height:" + trackH + "px;" +
        "transition:background-color .7s " + EASE + ",border-color .7s " + EASE + ";" +
        "border-color:#e8d5b7;background:#fef3c7}" +
      ":host([data-dark]) .track{border-color:#2d2a4e;background:#1a1838}" +
      ".knob{position:absolute;top:50%;left:" + pad + "px;" +
        "width:" + knob + "px;height:" + knob + "px;border-radius:9999px;" +
        "display:grid;place-items:center;transform:translateY(-50%);" +
        "transition:left .7s " + EASE + ",background-color .7s " + EASE + ";" +
        "background:#ff9500;color:#fff}" +
      ":host([data-dark]) .knob{left:" + (pad + travel) + "px;background:#e8e6f0;color:#1a1838}" +
      ".icon{grid-area:1/1;display:block;transform-origin:center;" +
        "transition:transform .5s " + EASE + ",opacity .5s " + EASE + "}" +
      ".sun{transform:rotate(0) scale(1);opacity:1}" +
      ".moon{transform:rotate(-90deg) scale(.5);opacity:0}" +
      ":host([data-dark]) .sun{transform:rotate(90deg) scale(.5);opacity:0}" +
      ":host([data-dark]) .moon{transform:rotate(0) scale(1);opacity:1}" +
      "@media (prefers-reduced-motion:reduce){.track,.knob,.icon{transition:none}}"
    );
  }

  var Toggle = function () {};
  Toggle.prototype = Object.create(HTMLElement.prototype);

  function defineToggle() {
    class ThemeToggle extends HTMLElement {
      connectedCallback() {
        var size = (this.getAttribute("size") || "md").toLowerCase();
        var cfg = SIZES[size] || SIZES.md;

        var root = this.attachShadow({ mode: "open" });
        root.innerHTML =
          "<style>" + css(cfg) + "</style>" +
          '<button class="track" type="button" aria-label="Toggle theme" role="switch">' +
            '<span class="knob">' + sunSVG(cfg.icon) + moonSVG(cfg.icon) + "</span>" +
          "</button>";

        this._btn = root.querySelector(".track");
        var self = this;
        this._onClick = function (ev) {
          // reveal expands from the toggle itself
          var r = self._btn.getBoundingClientRect();
          revealToggle(r.left + r.width / 2, r.top + r.height / 2);
        };
        this._btn.addEventListener("click", this._onClick);

        // Re-sync when theme changes elsewhere (other toggle, another tab).
        this._sync = this.sync.bind(this);
        window.addEventListener("roadaro:themechange", this._sync);
        window.addEventListener("storage", this._sync);

        this.sync();
      }

      disconnectedCallback() {
        if (this._btn) this._btn.removeEventListener("click", this._onClick);
        window.removeEventListener("roadaro:themechange", this._sync);
        window.removeEventListener("storage", this._sync);
      }

      sync() {
        var dark = isDark();
        if (dark) this.setAttribute("data-dark", "");
        else this.removeAttribute("data-dark");
        if (this._btn) this._btn.setAttribute("aria-checked", dark ? "true" : "false");
      }
    }
    customElements.define("theme-toggle", ThemeToggle);
  }

  if (window.customElements) defineToggle();
})();
