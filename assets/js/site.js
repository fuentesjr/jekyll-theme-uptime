---
---
/* uptime theme — vanilla JS for command palette, keyboard nav, theme/density toggles.
   Exposed as window.__uptime for debugging. */

(function () {
  "use strict";

  var LS_KEY = "uptime.prefs.v1";
  var DEFAULTS = {
    theme: "{{ site.uptime.default_theme | default: 'dark' }}",
    density: "{{ site.uptime.default_density | default: 'comfortable' }}"
  };

  // ─── Prefs ─────────────────────────────────────────────────────────────
  function loadPrefs() {
    try {
      var v = JSON.parse(localStorage.getItem(LS_KEY));
      if (v && typeof v === "object") return Object.assign({}, DEFAULTS, v);
    } catch (_) {}
    return Object.assign({}, DEFAULTS);
  }
  function savePrefs(p) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(p)); } catch (_) {}
  }
  function applyPrefs(p) {
    document.documentElement.dataset.theme = p.theme;
    document.documentElement.dataset.density = p.density;
    // update toggle glyph if present
    var tb = document.querySelector("[data-action='toggle-theme']");
    if (tb) tb.textContent = p.theme === "light" ? "☾" : "☀";
  }

  var prefs = loadPrefs();
  applyPrefs(prefs);

  // ─── Accent hue override from ?accent= or localStorage ─────────────────
  function applyAccentHue(h) {
    var n = parseFloat(h);
    if (!isFinite(n)) return false;
    document.documentElement.style.setProperty("--accent-hue", n);
    return true;
  }
  var urlHue = new URLSearchParams(location.search).get("accent");
  if (urlHue != null) {
    if (applyAccentHue(urlHue)) {
      try { localStorage.setItem("uptime.accent_hue", urlHue); } catch (_) {}
    }
  } else {
    try {
      var stored = localStorage.getItem("uptime.accent_hue");
      if (stored != null) applyAccentHue(stored);
    } catch (_) {}
  }

  function setPref(k, v) { prefs[k] = v; savePrefs(prefs); applyPrefs(prefs); }
  function toggleTheme() { setPref("theme", prefs.theme === "light" ? "dark" : "light"); }
  function cycleDensity() {
    var order = ["compact", "comfortable", "spacious"];
    var i = order.indexOf(prefs.density);
    setPref("density", order[(i + 1) % order.length]);
    flash("density: " + prefs.density);
  }

  // ─── Recents (for command-palette ranking) ─────────────────────────────
  var RECENTS_KEY = "uptime.recents.v1";
  function loadRecents() {
    try { return JSON.parse(localStorage.getItem(RECENTS_KEY)) || []; } catch (_) { return []; }
  }
  function pushRecent(label) {
    var r = loadRecents().filter(function (x) { return x !== label; });
    r.unshift(label); r = r.slice(0, 8);
    try { localStorage.setItem(RECENTS_KEY, JSON.stringify(r)); } catch (_) {}
  }

  // ─── Copy-code buttons on <pre> blocks ────────────────────────────────
  function initCopyCode() {
    var blocks = document.querySelectorAll(".post__body pre, .post__body .highlight");
    blocks.forEach(function (pre) {
      if (pre.parentElement && pre.parentElement.classList.contains("code-wrap")) return;
      var wrap = document.createElement("div");
      wrap.className = "code-wrap";
      pre.parentNode.insertBefore(wrap, pre);
      wrap.appendChild(pre);

      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "copy-btn";
      btn.textContent = "copy";
      btn.setAttribute("aria-label", "Copy code to clipboard");
      wrap.appendChild(btn);

      btn.addEventListener("click", function () {
        var code = pre.querySelector("code") || pre;
        var text = code.innerText;
        if (navigator.clipboard) {
          navigator.clipboard.writeText(text).then(function () { mark(); });
        } else {
          var ta = document.createElement("textarea");
          ta.value = text; document.body.appendChild(ta);
          ta.select(); try { document.execCommand("copy"); } catch (_) {}
          ta.remove(); mark();
        }
      });

      function mark() {
        btn.textContent = "copied";
        btn.classList.add("is-done");
        setTimeout(function () { btn.textContent = "copy"; btn.classList.remove("is-done"); }, 1400);
      }
    });
  }

  // ─── Reading progress (edge glow) ──────────────────────────────────────
  function initReadProgress() {
    var bar = document.querySelector(".read-progress");
    if (!bar) return;
    var body = document.querySelector(".post__body");
    if (!body) return;
    function update() {
      var rect = body.getBoundingClientRect();
      var total = rect.height - window.innerHeight + rect.top + window.scrollY;
      var read = Math.min(Math.max(window.scrollY - (rect.top + window.scrollY - window.innerHeight * 0.3), 0), total);
      var pct = total > 0 ? (read / total) * 100 : 0;
      bar.style.setProperty("--read-pct", Math.min(pct, 100) + "%");
    }
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
  }

  // ─── Featured-tile sparklines (seeded by a data-spark attr) ───────────
  function initSparks() {
    // LCG seeded by the tile's seed so each tile has a stable but different shape.
    function rng(seed) { var s = (seed || 1) * 9301 + 49297; return function () { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }
    document.querySelectorAll(".dash-sli__spark").forEach(function (el) {
      var seed = parseInt(el.dataset.spark, 10) || Math.floor(Math.random() * 1000);
      var r = rng(seed + 7);
      var n = 12, html = "";
      // Gentle upward trend, Perlin-ish via smoothing two rand walks.
      var h = 0.35 + r() * 0.25;
      for (var i = 0; i < n; i++) {
        h = Math.max(0.15, Math.min(0.95, h + (r() - 0.45) * 0.22 + 0.015));
        html += '<span style="height:' + Math.round(h * 100) + '%"></span>';
      }
      el.innerHTML = html;
    });
  }

  // ─── Uptime counter in top bar ─────────────────────────────────────────
  function initUptime() {
    var el = document.querySelector("[data-uptime-since]");
    if (!el) return;
    var since = new Date(el.dataset.uptimeSince);
    if (isNaN(since)) return;
    function pad(n) { return n < 10 ? "0" + n : "" + n; }
    function tick() {
      var s = Math.max(0, Math.floor((Date.now() - since.getTime()) / 1000));
      var y = Math.floor(s / (365.25 * 86400)); s -= Math.floor(y * 365.25 * 86400);
      var d = Math.floor(s / 86400);            s -= d * 86400;
      var h = Math.floor(s / 3600);             s -= h * 3600;
      var m = Math.floor(s / 60);               s -= m * 60;
      el.textContent = y + "y " + pad(d) + "d " + pad(h) + ":" + pad(m) + ":" + pad(s);
    }
    tick();
    setInterval(tick, 1000);
  }

  // ─── Command palette ───────────────────────────────────────────────────
  var palette = {
    el: null, input: null, list: null, overlay: null,
    actions: [], filtered: [], idx: 0, open: false,
    init: function () {
      this.overlay = document.getElementById("cmdk");
      if (!this.overlay) return;
      this.el = this.overlay.querySelector(".cmdk");
      this.input = this.overlay.querySelector(".cmdk__input");
      this.list = this.overlay.querySelector(".cmdk__list");

      // Load actions from embedded JSON + built-ins
      var data = document.getElementById("cmdk-data");
      var posts = [], tags = [];
      if (data) {
        try {
          var parsed = JSON.parse(data.textContent) || {};
          // Backwards compatible: old format was a bare array of posts.
          if (Array.isArray(parsed)) { posts = parsed; }
          else { posts = parsed.posts || []; tags = parsed.tags || []; }
        } catch (_) {}
      }

      this.actions = [
        { group: "Navigate", icon: "§", label: "Home",    hint: "g h", run: function () { location.href = "{{ '/' | relative_url }}"; } },
        { group: "Navigate", icon: "§", label: "About",   hint: "g a", run: function () { location.href = "{{ '/about/' | relative_url }}"; } },
        { group: "Navigate", icon: "§", label: "Archive", hint: "g r", run: function () { location.href = "{{ '/archive/' | relative_url }}"; } },
        { group: "Navigate", icon: "§", label: "Tags",    hint: "g t", run: function () { location.href = "{{ '/tags/' | relative_url }}"; } },

        { group: "Appearance", icon: "◐", label: "Toggle theme (light/dark)", hint: "t", run: toggleTheme },
        { group: "Appearance", icon: "▪", label: "Density: compact",          run: function () { setPref("density", "compact"); } },
        { group: "Appearance", icon: "▫", label: "Density: comfortable",      run: function () { setPref("density", "comfortable"); } },
        { group: "Appearance", icon: "□", label: "Density: spacious",         run: function () { setPref("density", "spacious"); } },
        { group: "Appearance", icon: "◎", label: "Accent: reset to theme default", run: function () {
            document.documentElement.style.removeProperty("--accent-hue");
            try { localStorage.removeItem("uptime.accent_hue"); } catch (_) {}
            flash("accent reset");
        } },

        { group: "Page", icon: "↗", label: "Copy permalink", run: function () {
            navigator.clipboard && navigator.clipboard.writeText(location.href);
            flash("permalink copied");
        } },
        { group: "Page", icon: "↑", label: "Scroll to top", run: function () { window.scrollTo({ top: 0, behavior: "smooth" }); } },
        { group: "Page", icon: "?", label: "Keyboard shortcuts", hint: "?", run: function () { help.toggle(true); } },

        { group: "RSS", icon: "»", label: "Subscribe via RSS", run: function () { location.href = "{{ '/feed.xml' | relative_url }}"; } }
      ];

      // Append posts as "Go to post" actions
      for (var i = 0; i < posts.length; i++) {
        (function (p) {
          palette.actions.push({
            group: "Posts", icon: "›", label: p.title, hint: p.date,
            run: function () { location.href = p.url; }
          });
        })(posts[i]);
      }

      // Append tags as "Jump to tag" actions
      for (var j = 0; j < tags.length; j++) {
        (function (t) {
          palette.actions.push({
            group: "Tags", icon: "#", label: "Jump to #" + t.name, hint: t.count + " post" + (t.count === 1 ? "" : "s"),
            run: function () { location.href = t.url; }
          });
        })(tags[j]);
      }

      this.overlay.addEventListener("click", function (e) {
        if (e.target === palette.overlay) palette.toggle(false);
      });
      this.input.addEventListener("input", function () { palette.filter(palette.input.value); });
      this.input.addEventListener("keydown", function (e) {
        if (e.key === "ArrowDown") { e.preventDefault(); palette.move(1); }
        else if (e.key === "ArrowUp") { e.preventDefault(); palette.move(-1); }
        else if (e.key === "Enter") { e.preventDefault(); palette.run(); }
        else if (e.key === "Escape") { palette.toggle(false); }
      });

      this.filter("");
    },
    toggle: function (open) {
      if (!this.overlay) return;
      this.open = open == null ? !this.open : open;
      this.overlay.hidden = !this.open;
      if (this.open) {
        this.input.value = "";
        this.filter("");
        setTimeout(function () { palette.input.focus(); }, 20);
      }
    },
    filter: function (q) {
      q = (q || "").toLowerCase().trim();
      var recents = loadRecents();
      var scored = this.actions.map(function (a) {
        var score = fuzzyScore(q, (a.label + " " + (a.hint || "") + " " + (a.group || "")).toLowerCase());
        // Recent boost — actions run recently float up when the query is empty or short.
        var ri = recents.indexOf(a.label);
        if (ri >= 0) score += (8 - ri) * (q ? 0.5 : 3);
        return { a: a, score: score };
      });
      if (q) scored = scored.filter(function (x) { return x.score > 0; });
      scored.sort(function (x, y) { return y.score - x.score; });
      this.filtered = scored.map(function (x) { return x.a; });
      this.idx = 0;
      this.render();
    },
    move: function (d) {
      this.idx = Math.max(0, Math.min(this.filtered.length - 1, this.idx + d));
      this.render();
      var sel = this.list.querySelector(".is-selected");
      if (sel) sel.scrollIntoView({ block: "nearest" });
    },
    run: function () {
      var a = this.filtered[this.idx];
      if (a) {
        pushRecent(a.label);
        this.toggle(false);
        try { a.run(); } catch (e) { console.error(e); }
      }
    },
    render: function () {
      var html = "", group = null, running = 0;
      if (!this.filtered.length) {
        html = '<div class="cmdk__empty">No matches. Try <code>theme</code>, <code>tags</code>, or <code>rss</code>.</div>';
      } else {
        for (var i = 0; i < this.filtered.length; i++) {
          var a = this.filtered[i];
          if (a.group !== group) {
            group = a.group;
            html += '<div class="cmdk__group-label">' + esc(group) + '</div>';
          }
          html += '<div class="cmdk__item' + (running === this.idx ? ' is-selected' : '') +
            '" data-i="' + running + '">' +
            '<span class="cmdk__icon">' + esc(a.icon || "◆") + '</span>' +
            '<span class="cmdk__label">' + esc(a.label) + '</span>' +
            (a.hint ? '<span class="cmdk__hint">' + esc(a.hint) + '</span>' : '') +
            '</div>';
          running++;
        }
      }
      this.list.innerHTML = html;
      var self = this;
      this.list.querySelectorAll(".cmdk__item").forEach(function (el) {
        el.addEventListener("mouseenter", function () { self.idx = parseInt(el.dataset.i, 10); self.render(); });
        el.addEventListener("click", function () { self.idx = parseInt(el.dataset.i, 10); self.run(); });
      });
    }
  };

  // ─── Help overlay ──────────────────────────────────────────────────────
  var help = {
    el: null,
    init: function () {
      this.el = document.getElementById("help-overlay");
      if (!this.el) return;
      this.el.addEventListener("click", function (e) {
        if (e.target === help.el) help.toggle(false);
      });
    },
    toggle: function (open) {
      if (!this.el) return;
      this.el.hidden = open == null ? !this.el.hidden === false : !open;
    }
  };

  // ─── Flash message (for "copied" etc.) ─────────────────────────────────
  function flash(msg) {
    var f = document.createElement("div");
    f.textContent = msg;
    f.style.cssText = "position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--bg-elev);border:1px solid var(--hairline);color:var(--ink);padding:8px 14px;border-radius:8px;font-family:var(--mono);font-size:12px;z-index:200;box-shadow:var(--shadow-md);";
    document.body.appendChild(f);
    setTimeout(function () { f.remove(); }, 1600);
  }

  // ─── Keyboard nav ──────────────────────────────────────────────────────
  var gPrefix = false;
  document.addEventListener("keydown", function (e) {
    var tag = (e.target && e.target.tagName) || "";
    var typing = tag === "INPUT" || tag === "TEXTAREA" || e.target.isContentEditable;

    // ⌘K / Ctrl-K always active
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault(); palette.toggle(); return;
    }
    if (e.key === "Escape") { palette.toggle(false); help.toggle(false); return; }
    if (typing) return;

    if (e.key === "?") { help.toggle(); return; }
    if (e.key.toLowerCase() === "t") { toggleTheme(); return; }
    if (e.key.toLowerCase() === "d") { cycleDensity(); return; }

    if (gPrefix) {
      gPrefix = false;
      var k = e.key.toLowerCase();
      if (k === "h") location.href = "{{ '/' | relative_url }}";
      else if (k === "a") location.href = "{{ '/about/' | relative_url }}";
      else if (k === "r") location.href = "{{ '/archive/' | relative_url }}";
      else if (k === "t") location.href = "{{ '/tags/' | relative_url }}";
      return;
    }
    if (e.key.toLowerCase() === "g") { gPrefix = true; setTimeout(function () { gPrefix = false; }, 900); }
  });

  // ─── Click handlers for corner buttons ─────────────────────────────────
  document.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-action]");
    if (!btn) return;
    var a = btn.dataset.action;
    if (a === "toggle-theme") toggleTheme();
    else if (a === "open-palette") palette.toggle(true);
    else if (a === "open-help") help.toggle(true);
  });

  // ─── Fuzzy scoring (subsequence match; rewards contiguity + word boundaries) ─
  function fuzzyScore(q, hay) {
    if (!q) return 1;
    var qi = 0, hi = 0, score = 0, streak = 0, prev = -2;
    while (qi < q.length && hi < hay.length) {
      if (q.charCodeAt(qi) === hay.charCodeAt(hi)) {
        score += 1 + streak; streak++;
        if (hi === 0 || hay.charCodeAt(hi - 1) === 32 || hay.charCodeAt(hi - 1) === 45) score += 3; // word start
        if (hi === prev + 1) score += 2; // contiguous
        prev = hi; qi++;
      } else { streak = 0; }
      hi++;
    }
    return qi === q.length ? score : 0;
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // ─── boot ──────────────────────────────────────────────────────────────
  document.addEventListener("DOMContentLoaded", function () {
    palette.init();
    help.init();
    initReadProgress();
    initUptime();
    initCopyCode();
    initSparks();

    // Console easter egg
    if (!sessionStorage.getItem("uptime.greeted")) {
      console.log("%c hello 👋", "font: 14px/1.4 ui-monospace, monospace; color: #c26a4a;");
      console.log("%c try ⌘K — the site has a command palette.", "font: 12px/1.4 ui-monospace, monospace; color: #888;");
      sessionStorage.setItem("uptime.greeted", "1");
    }
  });

  window.__uptime = { palette: palette, prefs: prefs, setPref: setPref };
})();
