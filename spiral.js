/* Spiral hero. P45.23, polished in P45.24, live prices in P45.25.
   Kill switch: ?hero=wave restores the wavefield in the hero. Default is this scene.

   Motion model. The group spins about the view axis with one Web Animations rotate.
   Every card carries a counter-spin on the same clock, so a card's on-screen tilt is
   only its seeded roll and pitch. Nothing is ever upside down.
   Idle runs no JS per frame. requestAnimationFrame runs only during a drag, a fling,
   a settle, a step, a pause ramp, and the 2 second fps sample after load.

   Layout. Slots are designed in units of the vortex radius R, then zoomed so the
   circle every card sweeps stays clear of the type at every orbit phase.
   Depth is static per slot, so dimming and blur are static too.

   Image weight: 10 x 320px WebP = 315,898 bytes. Nearest three = 88,658 bytes.
   Detail art is the existing 400px file in /binder/, loaded on open.

   Prices. /hero/cards.json is the hand list. /hero/prices.json is written daily by
   scripts/hero-prices.mjs and merged here by card_id. Both are static files; the page
   never calls the database. A missing file or card shows no number. Older than 10 days
   shows the date. Older than 21 days drops price, move and line. */
(function () {
  if (document.documentElement.getAttribute('data-hero') !== 'spiral') return;

  var GAMES = {
    'one-piece': {
      label: 'One Piece',
      legal: 'CardOS TCG is a fan-made collection tracker. Not affiliated with, endorsed, or sponsored by Bandai, Shueisha, Toei Animation, Eiichiro Oda, Riot Games, UVS Games, Bushiroad, or Pocketpair.'
    },
    riftbound: {
      label: 'Riftbound',
      legal: 'RIFTBOUND: LEAGUE OF LEGENDS manufactured by UVS Games under license from Riot Games. ™ & © 2026 Riot Games, Inc.'
    },
    palworld: {
      label: 'Palworld',
      legal: 'CardOS TCG is a fan-made collection tracker. Not affiliated with, endorsed, or sponsored by Bandai, Shueisha, Toei Animation, Eiichiro Oda, Riot Games, UVS Games, Bushiroad, or Pocketpair.'
    }
  };
  var MAT = { op: '#F99D1B', rb: '#4E1D4C', pw: '#064F6E' };
  var EST = 'Estimates are tagged Est.';
  var DUR = 90000;
  var P = 1200;
  var RATIO = 88 / 63;
  var HALF_DIAG = Math.sqrt(1 + RATIO * RATIO) / 2;
  var LIFT = 1.075;
  var EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

  var stage = document.getElementById('top');
  var root = document.getElementById('spiral');
  var spin = document.getElementById('spiral-spin');
  var view = document.getElementById('spiral-view');
  var cap = document.getElementById('spiral-cap');
  var tag = document.getElementById('spiral-tag');
  var pill = document.getElementById('spiral-pill');
  var tap = document.getElementById('spiral-tap');
  var hint = document.getElementById('spiral-hint');
  var dialog = document.getElementById('sp-dialog');
  var motionBtn = document.getElementById('motion');
  var logCta = document.getElementById('log-cta');
  if (!stage || !root || !spin || !view || !dialog) return;
  var art = document.getElementById('sp-art');
  var mat = document.getElementById('sp-mat');
  var shot = document.getElementById('sp-shot');
  var sheet = document.getElementById('sp-sheet');
  var copy = document.getElementById('sp-copy');
  var count = document.getElementById('sp-count');

  var reducedMq = matchMedia('(prefers-reduced-motion: reduce)');
  var reduced = reducedMq.matches;
  var motionOn = true;
  try { motionOn = localStorage.getItem('cardos_motion') !== 'off'; } catch (e) {}

  var cards = [];
  var anims = [];
  var shape = null;
  var phase = 0;
  var rate = 0;
  var ramp = 0;
  var tween = 0;
  var capTimer = 0;
  var gesture = false;
  var busy = false;
  var hoverCard = null;
  var focusIn = false;
  var vis = true;
  var open = false;
  var openAt = -1;
  var active = 0;
  var front = Math.PI * 0.75;
  var interacted = false;
  var heroSeen = false;
  var aimed = false;
  var lite = !!((navigator.deviceMemory && navigator.deviceMemory <= 4) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4));

  function still() { return reduced || !motionOn; }
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function mod(a, n) { return ((a % n) + n) % n; }
  function easeOut(k) { return 1 - Math.pow(1 - k, 3); }
  function easeInOut(k) { return k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; }
  function money(v) {
    if (!isNum(v) || v <= 0) return 'N/A';
    return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function moveText(v) {
    if (!isNum(v)) return 'N/A';
    var abs = Math.abs(v).toFixed(1) + '%';
    if (Math.abs(v) < 0.05) return '0.0%';
    if (v > 0) return '▲ +' + abs;
    return '▼ −' + abs;
  }
  function usDate(iso) {
    var p = String(iso || '').split('-');
    if (p.length < 3) return '';
    return p[1] + '/' + p[2] + '/' + p[0];
  }
  /* The one place a card's shown numbers come from. Tile A, Tile B, the line, the pill
     and the button label all read this, so they cannot disagree. */
  function priceView(c) {
    var age = ageDays(c.as_of);
    var priced = isNum(c.price) && c.price > 0 && age != null && age <= 21;
    var move = priced && isNum(c.move_30d) ? c.move_30d : null;
    var series = priced && Array.isArray(c.series_30d) ? c.series_30d.filter(isNum) : [];
    return {
      price: priced ? c.price : null,
      move: move,
      series: series.length > 1 ? series : null,
      date: priced && age > 10 ? 'Est. as of ' + usDate(c.as_of) : ''
    };
  }
  function ageDays(iso) {
    var p = String(iso || '').split('-');
    if (p.length < 3 || !p[0]) return null;
    var then = Date.UTC(+p[0], +p[1] - 1, +p[2]);
    if (!isFinite(then)) return null;
    var now = new Date();
    var today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    return Math.round((today - then) / 86400000);
  }
  function unit(i) {
    var x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function gameOf(c) { return GAMES[c.game] || { label: c.game, legal: '' }; }
  function track(event, props) {
    if (window.ph && typeof window.ph.track === 'function') window.ph.track(event, props || {});
  }
  function hrefFor(card, source) {
    var u = new URL('https://app.cardostcg.com/');
    u.searchParams.set('utm_source', 'web');
    u.searchParams.set('utm_medium', 'teaser');
    u.searchParams.set('source', source);
    if (card) {
      u.searchParams.set('card_id', card.card_id);
      u.searchParams.set('game', card.game);
    }
    return u.toString();
  }
  function hideHint() {
    interacted = true;
    if (hint) hint.hidden = true;
    if (tap) tap.hidden = true;
  }

  /* ---------- orbit clock ---------- */

  function readPhase() {
    var ct = anims.length ? anims[0].currentTime : null;
    if (isNum(ct)) phase = mod(ct, DUR) / DUR * 360;
    return phase;
  }
  function setPhase(deg) {
    phase = mod(deg, 360);
    var ct = phase / 360 * DUR;
    for (var i = 0; i < anims.length; i++) anims[i].currentTime = ct;
  }
  function applyRate(r) {
    var was = rate;
    rate = r;
    if (!anims.length) return;
    if (r <= 0) {
      readPhase();
      anims.forEach(function (a) { a.pause(); });
      setPhase(phase);
      return;
    }
    if (was <= 0) readPhase();
    anims.forEach(function (a) {
      a.playbackRate = r;
      if (a.playState !== 'running') a.play();
    });
    if (was <= 0) setPhase(phase);
  }
  function wantRate() {
    return (!still() && vis && !document.hidden && !open && !busy && !gesture && !hoverCard && !focusIn) ? 1 : 0;
  }
  function update() {
    var target = wantRate();
    cancelAnimationFrame(ramp);
    ramp = 0;
    var hard = !vis || document.hidden || open || busy || gesture || still();
    if (target === rate || (target === 0 && hard)) {
      applyRate(target);
      capWatch();
      return;
    }
    var from = rate;
    var dur = target > from ? 600 : 400;
    var t0 = 0;
    function stepRamp(ts) {
      if (!t0) t0 = ts;
      var k = Math.min(1, (ts - t0) / dur);
      var r = from + (target - from) * easeInOut(k);
      applyRate(k >= 1 ? target : Math.max(r, 0.0001));
      if (k < 1) ramp = requestAnimationFrame(stepRamp);
      else { ramp = 0; capWatch(); }
    }
    ramp = requestAnimationFrame(stepRamp);
    capWatch();
  }
  function capWatch() {
    var moving = rate > 0 || ramp;
    if (moving && !capTimer) capTimer = setInterval(function () { refreshActive(); }, 450);
    if (!moving && capTimer) { clearInterval(capTimer); capTimer = 0; }
    refreshActive();
  }

  /* ---------- the front slot and the caption ---------- */

  function worldAngle(c) { return c.th + readPhase() * Math.PI / 180; }
  function facingScore(c) { return c.t * 1100 + Math.cos(worldAngle(c) - front) * 380; }
  function refreshActive(force) {
    if (!cards.length || open) return;
    var best = 0;
    var bestScore = -Infinity;
    cards.forEach(function (c, i) {
      var s = facingScore(c);
      if (s > bestScore) { bestScore = s; best = i; }
    });
    if (best !== active || force) setActive(best);
  }
  function setActive(i) {
    active = i;
    paintCaption();
    if (logCta && cards[active]) logCta.href = hrefFor(cards[active], 'hero');
  }
  /* Pill: "Est. $3,711.35  ▲ 4.2%". No valid move shows the price alone. No price, or a
     price older than 21 days, hides the pill. Never "▲ 0%", never N/A, never "$0.00". */
  function pillParts(c) {
    var v = priceView(c);
    if (v.price == null) return null;
    var parts = { price: 'Est. ' + money(v.price), move: '', cls: '' };
    if (v.move != null && Math.abs(v.move) >= 0.05) {
      parts.move = (v.move > 0 ? '▲ ' : '▼ ') + Math.abs(v.move).toFixed(1) + '%';
      parts.cls = v.move > 0 ? 'is-up' : 'is-down';
    }
    return parts;
  }
  function paintPill(c) {
    if (!pill) return;
    var p = c ? pillParts(c) : null;
    pill.textContent = '';
    pill.hidden = !p;
    if (!p) return;
    var a = document.createElement('span');
    a.textContent = p.price;
    pill.appendChild(a);
    if (p.move) {
      var b = document.createElement('span');
      b.className = p.cls;
      b.textContent = p.move;
      pill.appendChild(b);
    }
  }
  function paintCaption() {
    var i = open ? openAt : active;
    var c = cards[i];
    if (!c || !cap) return;
    var text = pad(i + 1) + '  ·  ' + gameOf(c).label + '  ·  ' + c.name + '  ·  ' + c.card_id;
    if (cap.textContent === text && cap.getAttribute('data-card') === c.card_id) return;
    cap.setAttribute('data-card', c.card_id);
    var parts = [cap];
    if (pill) parts.push(pill);
    if (still() || !cap.animate || !cap.textContent) { cap.textContent = text; paintPill(c); return; }
    var outs = parts.map(function (el) { return el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 100, fill: 'forwards' }); });
    outs[0].onfinish = function () {
      cap.textContent = text;
      paintPill(c);
      outs.forEach(function (o) { o.cancel(); });
      parts.forEach(function (el) { el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 100 }); });
    };
  }

  /* ---------- layout ---------- */

  /* floor is the far card width in R: 0.08 on desktop, 0.10 under 900px (P45.25).
     The near card stays 0.44R. The angular step is searched again for each floor. */
  function design(n, floor) {
    var best = null;
    for (var deg = 60; deg <= 170; deg++) {
      var pts = [];
      for (var i = 0; i < n; i++) {
        var t = n > 1 ? i / (n - 1) : 1;
        var w = floor + (0.44 - floor) * Math.pow(t, 3);
        var rho = 0.13 + 0.47 * t;
        var th = i * deg * Math.PI / 180;
        pts.push({ t: t, w: w, rho: rho, th: th, x: rho * Math.cos(th), y: rho * Math.sin(th) });
      }
      var score = Infinity;
      for (var a = 0; a < n; a++) {
        for (var b = a + 1; b < n; b++) {
          var d = Math.hypot(pts[a].x - pts[b].x, pts[a].y - pts[b].y);
          var need = 0.6 * (pts[a].w + pts[b].w) + 0.08 * Math.max(pts[a].w, pts[b].w);
          score = Math.min(score, d - need);
        }
      }
      if (!best || score > best.score) best = { score: score, deg: deg, pts: pts };
    }
    return best;
  }

  function rectsIn(sr) {
    var sel = '#top .wrap > *, #spiral-tag, #spiral-hint, #top > .ov';
    return Array.prototype.map.call(document.querySelectorAll(sel), function (el) {
      var r = el.getBoundingClientRect();
      if (!r.width || !r.height) return null;
      return { l: r.left - sr.left, r: r.right - sr.left, t: r.top - sr.top, b: r.bottom - sr.top, el: el };
    }).filter(Boolean);
  }
  function distToRect(x, y, q) {
    var dx = Math.max(q.l - x, 0, x - q.r);
    var dy = Math.max(q.t - y, 0, y - q.b);
    return Math.hypot(dx, dy);
  }

  function layout() {
    if (!cards.length) return;
    var n = cards.length;
    var mobile = window.innerWidth < 900;
    var desktop = window.innerWidth >= 1100;
    var floor = mobile ? 0.10 : 0.08;
    if (!shape || shape.n !== n || shape.floor !== floor) { shape = design(n, floor); shape.n = n; shape.floor = floor; }
    var sr = stage.getBoundingClientRect();
    var W = sr.width;
    var H = sr.height;
    var eyebrow = document.querySelector('#top .wrap > .label');
    if (tag) {
      if (mobile) {
        /* Caption block sits at the bottom of the spiral band, just above the eyebrow. */
        var er0 = eyebrow ? eyebrow.getBoundingClientRect() : null;
        var tagTop = (er0 ? er0.top - sr.top : H * 0.5) - 10 - tag.offsetHeight;
        tag.style.top = Math.round(tagTop) + 'px';
      } else {
        tag.style.top = '';
      }
    }
    var rects = rectsIn(sr);
    var cx;
    var cy;
    var R;
    var pad = mobile ? 14 : 24;
    if (!mobile) {
      var col = rects.filter(function (q) { return q.el.parentNode && q.el.parentNode.classList && q.el.parentNode.classList.contains('wrap'); });
      var T = col.reduce(function (m, q) { return Math.max(m, q.r); }, W * 0.45);
      cx = (T + W) / 2;
      cy = H / 2;
      R = Math.min((W - T) / 2 - pad, H / 2 - 16);
      root.style.setProperty('--scrim', Math.round(T + pad) + 'px');
    } else {
      /* Band: under the top overlay label, down to the caption block. Sized by the band
         height. The near card may bleed up to 12 percent of its width past the side
         edges; the stage clips it, and the type clearance below still applies. */
      var tagQ = rects.filter(function (q) { return q.el === tag; })[0];
      var ovQ = rects.filter(function (q) { return q.el.classList && q.el.classList.contains('ov-tl'); })[0];
      var er = eyebrow ? eyebrow.getBoundingClientRect() : null;
      var top = (ovQ ? ovQ.b : 0) + pad;
      var bot = tagQ ? tagQ.t - pad : (er ? er.top - sr.top - 10 : H * 0.5);
      cx = W / 2;
      cy = (top + bot) / 2;
      R = (bot - top) / 2;
      root.style.setProperty('--scrim', Math.round(er ? er.top - sr.top - 10 : bot) + 'px');
    }
    if (!(R > 60)) R = 60;
    var pts = shape.pts;
    var reach = function (p) { return p.rho + p.w * HALF_DIAG * LIFT; };
    var maxReach = pts.reduce(function (m, p) { return Math.max(m, reach(p)); }, 0);
    var Reff = R / maxReach;
    if (mobile) {
      /* Side limit: cx + reach * Reff <= W + 0.12 * near card width. */
      var nearW0 = pts[n - 1].w;
      var side = Math.min(cx, W - cx);
      Reff = Math.min(Reff, side / (maxReach - 0.12 * nearW0));
    }
    function clear(Rv) {
      for (var k = 0; k < rects.length; k++) {
        var q = rects[k];
        var d = distToRect(cx, cy, q);
        for (var i = 0; i < pts.length; i++) {
          if (d < reach(pts[i]) * Rv + pad) return false;
        }
      }
      return true;
    }
    for (var g = 0; g < 24 && !clear(Reff); g++) Reff *= 0.94;

    var nearW = pts[n - 1].w * Reff;
    var capW = desktop ? 210 : (mobile ? 150 : 190);
    var cw = Math.min(nearW, capW);
    var sizeK = cw / nearW;

    root.style.setProperty('--cx', cx.toFixed(1) + 'px');
    root.style.setProperty('--cy', cy.toFixed(1) + 'px');
    root.style.setProperty('--R', Reff.toFixed(1) + 'px');
    root.style.setProperty('--cw', cw.toFixed(1) + 'px');
    root.classList.add('is-sized');

    var blur = desktop && !lite && !still();
    var tapRank = mobile ? 8 : n;
    pts.forEach(function (p, i) {
      var c = cards[i];
      var sw = p.w * Reff * sizeK;
      var s = sw / cw;
      var z = P * (1 - 1 / s);
      var x = p.rho * Reff * Math.cos(p.th) / s;
      var y = p.rho * Reff * Math.sin(p.th) / s;
      c.t = p.t;
      c.th = p.th;
      c.s = s;
      var el = c.el;
      el.style.setProperty('--x', x.toFixed(1) + 'px');
      el.style.setProperty('--y', y.toFixed(1) + 'px');
      el.style.setProperty('--z', z.toFixed(1) + 'px');
      el.style.setProperty('--lift', ((P - z) * (1 - 1 / LIFT)).toFixed(1) + 'px');
      var face = c.face;
      face.style.opacity = (0.45 + 0.55 * Math.pow(p.t, 1.2)).toFixed(3);
      var fx = 'brightness(' + (0.6 + 0.4 * p.t).toFixed(3) + ')';
      if (blur && p.t < 0.34) fx += ' blur(' + ((1.6 + 1.2 * (1 - p.t / 0.34)) / s).toFixed(2) + 'px)';
      c.img.style.filter = fx;
      var tappable = (n - 1 - i) < tapRank;
      el.classList.toggle('is-untappable', !tappable);
      c.btn.tabIndex = tappable ? 0 : -1;
    });

    var chaseMax = mobile ? 2 : 3;
    var chase = cards.filter(function (c) { return c.chase; }).sort(function (a, b) { return b.t - a.t; }).slice(0, chaseMax);
    cards.forEach(function (c) { c.el.classList.toggle('chase', chase.indexOf(c) !== -1); });

    front = (mobile ? 0.5 : 0.75) * Math.PI;
    if (!aimed) {
      aimed = true;
      setPhase((front - pts[n - 1].th) * 180 / Math.PI);
    }
    refreshActive(true);
  }

  /* ---------- turning the funnel by hand ---------- */

  function phaseToFront(i, dir) {
    var target = (front - cards[i].th) * 180 / Math.PI;
    var now = readPhase();
    var delta = mod(target - now + 180, 360) - 180;
    if (dir > 0 && delta < 0) delta += 360;
    if (dir < 0 && delta > 0) delta -= 360;
    return now + delta;
  }
  function tweenPhase(to, ms, done) {
    cancelAnimationFrame(tween);
    var from = readPhase();
    if (still() || ms <= 0) { setPhase(to); tween = 0; if (done) done(); return; }
    var t0 = 0;
    function frame(ts) {
      if (!t0) t0 = ts;
      var k = Math.min(1, (ts - t0) / ms);
      setPhase(from + (to - from) * easeOut(k));
      if (k < 1) tween = requestAnimationFrame(frame);
      else { tween = 0; if (done) done(); }
    }
    tween = requestAnimationFrame(frame);
  }
  function settle() {
    var best = 0;
    var bestScore = -Infinity;
    cards.forEach(function (c, i) {
      var s = facingScore(c);
      if (s > bestScore) { bestScore = s; best = i; }
    });
    tweenPhase(phaseToFront(best, 0), 700, function () {
      gesture = false;
      setActive(best);
      update();
    });
  }
  function stepSlot(dir) {
    if (!cards.length) return;
    hideHint();
    var k = mod(active + dir, cards.length);
    gesture = true;
    update();
    setActive(k);
    var focusOnCard = spin.contains(document.activeElement);
    if (focusOnCard) cards[k].btn.focus({ preventScroll: true });
    tweenPhase(phaseToFront(k, -dir), 700, function () {
      gesture = false;
      update();
    });
  }

  var drag = null;
  var suppressClick = false;
  view.addEventListener('pointerdown', function (e) {
    if (open || (e.pointerType === 'mouse' && e.button !== 0)) return;
    if (e.pointerType === 'touch' && (e.clientX < 24 || e.clientX > window.innerWidth - 24)) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, locked: '', samples: [] };
  });
  view.addEventListener('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    var dx = e.clientX - drag.x;
    var dy = e.clientY - drag.y;
    if (!drag.locked) {
      if (Math.hypot(dx, dy) < 8) return;
      drag.locked = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (drag.locked === 'y') { drag = null; return; }
      try { view.setPointerCapture(e.pointerId); } catch (err) {}
      cancelAnimationFrame(tween);
      gesture = true;
      suppressClick = true;
      root.classList.add('is-grabbing');
      hideHint();
      update();
    }
    var degPerPx = 180 / Math.max(320, window.innerWidth);
    setPhase(readPhase() + dx * degPerPx);
    drag.x = e.clientX;
    drag.y = e.clientY;
    var now = performance.now();
    drag.samples.push({ t: now, d: dx * degPerPx });
    while (drag.samples.length && now - drag.samples[0].t > 90) drag.samples.shift();
  });
  function endDrag(e) {
    if (!drag || e.pointerId !== drag.id) return;
    var d = drag;
    drag = null;
    root.classList.remove('is-grabbing');
    if (d.locked !== 'x') return;
    setTimeout(function () { suppressClick = false; }, 0);
    if (still()) { gesture = false; update(); refreshActive(); return; }
    var span = d.samples.length > 1 ? d.samples[d.samples.length - 1].t - d.samples[0].t : 0;
    var sum = d.samples.reduce(function (a, s) { return a + s.d; }, 0);
    var v = span > 0 && e.type === 'pointerup' ? sum / Math.max(span, 16) : 0;
    v = Math.max(-1.2, Math.min(1.2, v));
    var last = 0;
    function fling(ts) {
      var dt = last ? Math.min(34, ts - last) : 16;
      last = ts;
      setPhase(readPhase() + v * dt);
      v *= Math.exp(-dt / 325);
      refreshActive();
      if (Math.abs(v) > 0.02) tween = requestAnimationFrame(fling);
      else { tween = 0; settle(); }
    }
    if (Math.abs(v) > 0.02) tween = requestAnimationFrame(fling);
    else settle();
  }
  view.addEventListener('pointerup', endDrag);
  view.addEventListener('pointercancel', endDrag);
  view.addEventListener('lostpointercapture', endDrag);

  spin.addEventListener('focusin', function () { focusIn = true; update(); });
  spin.addEventListener('focusout', function (e) {
    if (e.relatedTarget && spin.contains(e.relatedTarget)) return;
    focusIn = false;
    update();
  });

  /* ---------- detail ---------- */

  function fillDetail(i) {
    var c = cards[i];
    if (!c) return;
    openAt = i;
    var g = gameOf(c);
    var v = priceView(c);
    document.getElementById('sp-eyebrow').textContent = g.label + '  ·  ' + c.set_code + '  ·  ' + c.number;
    document.getElementById('sp-title').textContent = c.name;
    var sub = [c.rarity, c.printing].filter(Boolean).join(' · ');
    var subEl = document.getElementById('sp-sub');
    subEl.hidden = !sub;
    subEl.textContent = sub;
    var priceEl = document.getElementById('sp-price');
    var moveEl = document.getElementById('sp-move');
    var asofEl = document.getElementById('sp-asof');
    priceEl.textContent = money(v.price);
    priceEl.className = 'sp-num' + (v.price != null ? '' : ' is-flat');
    var mv = v.move;
    moveEl.textContent = moveText(mv);
    moveEl.className = 'sp-num' + (isNum(mv) ? (mv > 0 ? ' is-up' : (mv < 0 ? ' is-down' : ' is-flat')) : ' is-flat');
    asofEl.hidden = false;
    asofEl.textContent = v.date;
    drawSpark(v.series);
    var bits = [c.set_code + '-' + c.number];
    if (c.printing) bits.push(c.printing);
    document.getElementById('sp-meta').textContent = bits.join('  ·  ');
    art.alt = g.label + ', ' + c.name + ', ' + c.card_id;
    var src = '/binder/' + c.card_image_id + '.webp';
    if (art.getAttribute('src') !== src) art.src = src;
    if (mat) mat.style.setProperty('--mat', MAT[c.mat] || MAT.op);
    if (mat) mat.setAttribute('data-mat', c.mat || '');
    document.getElementById('sp-cta').href = hrefFor(c, 'detail');
    document.getElementById('sp-legal').textContent = (g.legal ? g.legal + ' ' : '') + EST;
    if (count) count.textContent = pad(i + 1) + ' / ' + pad(cards.length);
    var live = document.getElementById('sp-live');
    if (live) live.textContent = 'Card ' + (i + 1) + ' of ' + cards.length + ', ' + c.name;
    cards.forEach(function (o, k) { o.el.classList.toggle('is-out', k === i); });
    paintCaption();
  }

  /* Full-width 30 day line under the tiles, a dot on the last point, a "30D" label.
     The row keeps its height when there is no series (no layout shift). */
  function drawSpark(series) {
    var row = document.getElementById('sp-trend');
    var svg = document.getElementById('sp-spark');
    var dot = document.getElementById('sp-spark-dot');
    if (!row || !svg) return;
    var nums = series ? series.filter(isNum) : [];
    if (nums.length < 2) {
      row.classList.add('is-empty');
      svg.innerHTML = '';
      return;
    }
    row.classList.remove('is-empty');
    var min = Math.min.apply(null, nums);
    var max = Math.max.apply(null, nums);
    var span = max - min;
    var pts = nums.map(function (v, i) {
      return { x: (i / (nums.length - 1)) * 300, y: span > 0 ? 36 - ((v - min) / span) * 32 : 20 };
    });
    var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + p.x.toFixed(1) + ' ' + p.y.toFixed(1); }).join(' ');
    svg.innerHTML = '<path d="' + d + '" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>';
    var last = pts[pts.length - 1];
    if (dot) {
      dot.style.left = (last.x / 300 * 100).toFixed(2) + '%';
      dot.style.top = (last.y / 40 * 100).toFixed(2) + '%';
    }
  }

  /* The flat card flies between its slot and the detail pose. The start pose is the
     slot's projected centre, its on-screen width and its seeded roll. */
  function slotPose(c) {
    var b = c.face.getBoundingClientRect();
    if (!b.width) return null;
    var r = Math.abs(c.roll) * Math.PI / 180;
    var w = b.width / (Math.cos(r) + RATIO * Math.sin(r));
    return { x: b.left + b.width / 2, y: b.top + b.height / 2, w: w, roll: c.roll };
  }
  function flight(c, toDetail, ms, done) {
    var pose = slotPose(c);
    var dest = mat.getBoundingClientRect();
    if (!pose || !dest.width) { if (done) done(); return; }
    var ghost = mat.cloneNode(true);
    ghost.removeAttribute('id');
    ghost.classList.add('sp-ghost');
    var gi = ghost.querySelector('img');
    if (gi) { gi.removeAttribute('id'); gi.alt = ''; gi.style.visibility = 'visible'; }
    ghost.style.left = dest.left + 'px';
    ghost.style.top = dest.top + 'px';
    ghost.style.width = dest.width + 'px';
    ghost.style.height = dest.height + 'px';
    dialog.appendChild(ghost);
    var from = 'translate(' + (pose.x - (dest.left + dest.width / 2)).toFixed(1) + 'px,' + (pose.y - (dest.top + dest.height / 2)).toFixed(1) + 'px) rotate(' + pose.roll.toFixed(2) + 'deg) scale(' + (pose.w / dest.width).toFixed(4) + ')';
    var frames = [{ transform: from }, { transform: 'none' }];
    if (!toDetail) frames.reverse();
    mat.style.visibility = 'hidden';
    var a = ghost.animate(frames, { duration: ms, easing: EASE, fill: 'forwards' });
    a.onfinish = function () {
      if (toDetail) mat.style.visibility = '';
      ghost.remove();
      if (done) done();
    };
  }
  function riseRows() {
    if (still()) return;
    Array.prototype.forEach.call(copy.children, function (el, k) {
      if (el.hidden) return;
      el.animate([{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 420, delay: 160 + k * 40, easing: EASE, fill: 'backwards' });
    });
  }

  function openCard(i) {
    if (open || busy || !cards[i]) return;
    open = true;
    busy = true;
    hideHint();
    update();
    stage.classList.add('is-detail');
    dialog.classList.remove('is-closing');
    fillDetail(i);
    if (typeof dialog.showModal === 'function' && !dialog.open) dialog.showModal();
    else dialog.setAttribute('open', '');
    var closeBtn = document.getElementById('sp-close');
    if (closeBtn) closeBtn.focus({ preventScroll: true });
    track('spiral_open', { card_id: cards[i].card_id, game: cards[i].game, position: i + 1 });
    if (still()) {
      dialog.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200 });
      busy = false;
      return;
    }
    riseRows();
    flight(cards[i], true, 650, function () { busy = false; });
  }

  function finishClose() {
    var c = cards[openAt];
    dialog.classList.remove('is-closing');
    mat.style.visibility = '';
    if (dialog.open && dialog.close) dialog.close();
    else dialog.removeAttribute('open');
    open = false;
    busy = false;
    stage.classList.remove('is-detail');
    cards.forEach(function (o) { o.el.classList.remove('is-out'); });
    if (c) c.btn.focus({ preventScroll: true });
    update();
    refreshActive(true);
  }
  function closeCard() {
    if (!open || busy) return;
    busy = true;
    dialog.classList.add('is-closing');
    if (still()) {
      var f = dialog.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' });
      f.onfinish = function () { f.cancel(); finishClose(); };
      return;
    }
    var c = cards[openAt];
    flight(c, false, 500, finishClose);
  }

  function switchCard(dir) {
    if (!open || busy || !cards.length) return;
    var i = mod(openAt + dir, cards.length);
    track('spiral_open', { card_id: cards[i].card_id, game: cards[i].game, position: i + 1 });
    if (still()) {
      fillDetail(i);
      copy.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200 });
      shot.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200 });
      return;
    }
    busy = true;
    var outA = mat.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(' + (-28 * dir) + 'px) rotate(' + (-2 * dir) + 'deg)' }], { duration: 200, easing: 'ease-in', fill: 'forwards' });
    copy.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' });
    outA.onfinish = function () {
      fillDetail(i);
      outA.cancel();
      mat.animate([{ opacity: 0, transform: 'translateX(' + (28 * dir) + 'px) rotate(' + (2 * dir) + 'deg)' }, { opacity: 1, transform: 'none' }], { duration: 300, easing: EASE });
      copy.getAnimations().forEach(function (a) { a.cancel(); });
      copy.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200 });
      setTimeout(function () { busy = false; }, 300);
    };
  }

  /* Mobile sheet: swipe down closes, horizontal swipe on the art switches. */
  var touch = null;
  function touchStart(e) {
    if (e.touches.length !== 1) { touch = null; return; }
    touch = { x: e.touches[0].clientX, y: e.touches[0].clientY, top: sheet ? sheet.scrollTop : 0, onArt: shot.contains(e.target) };
  }
  function touchEnd(e) {
    if (!touch || !e.changedTouches.length) return;
    var dx = e.changedTouches[0].clientX - touch.x;
    var dy = e.changedTouches[0].clientY - touch.y;
    var t = touch;
    touch = null;
    if (t.onArt && Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.3) { switchCard(dx < 0 ? 1 : -1); return; }
    if (!t.onArt && t.top <= 0 && dy > 90 && Math.abs(dy) > Math.abs(dx) * 1.3) closeCard();
  }
  dialog.addEventListener('touchstart', touchStart, { passive: true });
  dialog.addEventListener('touchend', touchEnd, { passive: true });

  /* ---------- build ---------- */

  function build(list, prices) {
    var n = list.length;
    var live = (prices && prices.cards && typeof prices.cards === 'object') ? prices.cards : {};
    var eagerFrom = Math.max(0, n - 3);
    list.forEach(function (raw, i) {
      var pe = live[String(raw.card_id)] || {};
      var c = {
        card_id: String(raw.card_id),
        card_image_id: String(raw.card_image_id),
        game: raw.game,
        set_code: raw.set_code,
        number: raw.number,
        name: raw.name,
        rarity: raw.rarity || null,
        printing: raw.printing || null,
        mat: raw.mat,
        chase: raw.chase === true,
        price: isNum(pe.price) && pe.price > 0 ? pe.price : null,
        move_30d: isNum(pe.move_30d) ? pe.move_30d : null,
        series_30d: Array.isArray(pe.series_30d) ? pe.series_30d : null,
        as_of: typeof pe.as_of === 'string' ? pe.as_of : null,
        t: 0,
        th: 0,
        s: 1,
        roll: (4 + unit(i) * 10) * (unit(i + 4) > 0.5 ? 1 : -1),
        pitch: (3 + unit(i + 2) * 6) * (unit(i + 6) > 0.5 ? 1 : -1)
      };
      var g = gameOf(c);
      var slot = document.createElement('div');
      slot.className = 'sp-card';
      slot.setAttribute('role', 'listitem');
      slot.setAttribute('data-mat', c.mat);
      slot.style.setProperty('--mat', MAT[c.mat] || MAT.op);
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sp-btn';
      var shown = priceView(c).price;
      btn.setAttribute('aria-label', g.label + ', ' + c.name + ', ' + c.card_id + (shown != null ? ', Est. ' + money(shown) : ''));
      var tilt = document.createElement('span');
      tilt.className = 'sp-tilt';
      tilt.style.transform = 'rotateZ(' + c.roll.toFixed(2) + 'deg) rotateX(' + c.pitch.toFixed(2) + 'deg)';
      var face = document.createElement('span');
      face.className = 'sp-face';
      face.style.setProperty('--dx', ((2 + unit(i) * 2) * (unit(i + 9) > 0.5 ? 1 : -1)).toFixed(2) + 'px');
      face.style.setProperty('--dy', ((2 + unit(i + 3) * 2) * (unit(i + 11) > 0.5 ? 1 : -1)).toFixed(2) + 'px');
      face.style.animationDuration = (7 + unit(i + 5) * 4).toFixed(2) + 's';
      face.style.animationDelay = (-unit(i + 7) * 9).toFixed(2) + 's';
      var img = document.createElement('img');
      img.alt = '';
      img.width = 320;
      img.height = 446;
      img.decoding = 'async';
      img.draggable = false;
      var src = '/hero/' + c.card_image_id + '.webp';
      if (i >= eagerFrom) { img.loading = 'eager'; img.src = src; }
      else { img.loading = 'lazy'; img.dataset.src = src; }
      face.appendChild(img);
      tilt.appendChild(face);
      btn.appendChild(tilt);
      slot.appendChild(btn);
      c.el = slot;
      c.btn = btn;
      c.face = face;
      c.img = img;
      btn.addEventListener('click', function (e) {
        if (suppressClick) { e.preventDefault(); return; }
        openCard(cards.indexOf(c));
      });
      slot.addEventListener('pointerenter', function (e) {
        if (e.pointerType !== 'mouse' || open) return;
        hoverCard = c;
        update();
      });
      slot.addEventListener('pointerleave', function (e) {
        if (e.pointerType !== 'mouse') return;
        if (hoverCard === c) hoverCard = null;
        update();
      });
      cards.push(c);
    });
    for (var k = cards.length - 1; k >= 0; k--) spin.appendChild(cards[k].el);
    cards.forEach(function (c) {
      c.img.addEventListener('error', function () { drop(c); });
    });
    var idle = window.requestIdleCallback || function (fn) { setTimeout(fn, 200); };
    idle(function () {
      cards.forEach(function (c) {
        if (c.img.dataset.src && !c.img.getAttribute('src')) c.img.src = c.img.dataset.src;
      });
    });
    startClock();
    document.documentElement.classList.add('spiral-ready');
    layout();
    syncMotion();
    watchHero();
    sampleFps();
  }

  function startClock() {
    anims.forEach(function (a) { a.cancel(); });
    anims = [];
    if (!spin.animate) return;
    var opts = { duration: DUR, iterations: Infinity, easing: 'linear' };
    anims.push(spin.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }], opts));
    cards.forEach(function (c) {
      anims.push(c.btn.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(-360deg)' }], opts));
    });
    anims.forEach(function (a) { a.pause(); });
    rate = 0;
    setPhase(phase);
  }

  function drop(c) {
    var i = cards.indexOf(c);
    if (i === -1) return;
    var keep = readPhase();
    c.el.remove();
    cards.splice(i, 1);
    if (!cards.length) { fail(); return; }
    active = Math.min(active, cards.length - 1);
    shape = null;
    aimed = true;
    startClock();
    setPhase(keep);
    layout();
    update();
  }

  function sampleFps() {
    if (lite || still()) return;
    var times = [];
    var last = 0;
    var t0 = 0;
    function frame(ts) {
      if (!t0) t0 = ts;
      if (last) times.push(ts - last);
      last = ts;
      if (ts - t0 < 2000) { requestAnimationFrame(frame); return; }
      var avg = times.reduce(function (a, b) { return a + b; }, 0) / Math.max(1, times.length);
      if (avg > 25) {
        lite = true;
        root.classList.add('is-lite');
        layout();
      }
    }
    requestAnimationFrame(frame);
  }

  function fail() {
    stage.classList.add('spiral-failed');
    root.classList.add('is-failed');
  }

  function watchHero() {
    if (!('IntersectionObserver' in window)) return;
    var timer = 0;
    var io = new IntersectionObserver(function (entries) {
      var ratio = entries[0].intersectionRatio;
      vis = entries[0].isIntersecting && ratio >= 0.15;
      update();
      if (ratio < 0.5) { clearTimeout(timer); return; }
      if (heroSeen) return;
      clearTimeout(timer);
      timer = setTimeout(function () {
        if (heroSeen) return;
        heroSeen = true;
        track('hero_view', { hero: 'spiral' });
      }, 1000);
    }, { threshold: [0, 0.15, 0.5] });
    io.observe(stage);
  }

  function syncMotion() {
    var showOn = motionOn && !reduced;
    if (motionBtn) {
      motionBtn.textContent = showOn ? 'Motion on' : 'Motion off';
      motionBtn.setAttribute('aria-pressed', String(showOn));
    }
    root.classList.toggle('is-paused', !showOn);
    root.classList.toggle('is-still', still());
    if (hint) hint.hidden = reduced || interacted;
    if (tap) tap.hidden = reduced || interacted;
    update();
  }

  /* ---------- wiring ---------- */

  document.addEventListener('keydown', function (e) {
    if (open && dialog.contains(document.activeElement)) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        switchCard(e.key === 'ArrowRight' ? 1 : -1);
      }
      return;
    }
    if (!spin.contains(document.activeElement)) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      stepSlot(e.key === 'ArrowRight' ? 1 : -1);
    }
  });

  document.getElementById('sp-close').addEventListener('click', closeCard);
  document.getElementById('sp-prev').addEventListener('click', function () { switchCard(-1); });
  document.getElementById('sp-next').addEventListener('click', function () { switchCard(1); });
  dialog.addEventListener('cancel', function (e) { e.preventDefault(); closeCard(); });
  dialog.addEventListener('click', function (e) {
    if (e.target === dialog) closeCard();
  });
  dialog.addEventListener('close', function () {
    if (!open) return;
    open = false;
    busy = false;
    stage.classList.remove('is-detail');
    cards.forEach(function (o) { o.el.classList.remove('is-out'); });
    update();
  });
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('#log-cta, #sp-cta');
    if (!a) return;
    var source = a.id === 'sp-cta' ? 'detail' : 'hero';
    var props = { source: source };
    var card = source === 'detail' ? cards[openAt] : cards[active];
    if (card) props.card_id = card.card_id;
    track('cta_click', props);
  });

  if (motionBtn) {
    motionBtn.addEventListener('click', function () {
      if (reduced) return;
      motionOn = !motionOn;
      try { localStorage.setItem('cardos_motion', motionOn ? 'on' : 'off'); } catch (e) {}
      syncMotion();
      layout();
    });
  }
  if (reducedMq.addEventListener) {
    reducedMq.addEventListener('change', function (e) {
      reduced = e.matches;
      syncMotion();
      layout();
    });
  }
  document.addEventListener('visibilitychange', update);
  window.addEventListener('resize', function () {
    clearTimeout(layout._t);
    layout._t = setTimeout(layout, 150);
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { layout(); });

  /* Prices are optional: a failed or missing prices.json leaves art and names, no numbers.
     The query string is the UTC date so a CDN copy turns over once a day. */
  var today = new Date().toISOString().slice(0, 10);
  var pricesReq = fetch('/hero/prices.json?d=' + today, { credentials: 'same-origin' }).then(function (r) {
    if (!r.ok) throw new Error('prices');
    return r.json();
  }).catch(function () { return null; });
  fetch('/hero/cards.json', { credentials: 'same-origin' }).then(function (r) {
    if (!r.ok) throw new Error('cards');
    return r.json();
  }).then(function (data) {
    var list = data && data.cards;
    if (!list || !list.length) throw new Error('empty');
    return pricesReq.then(function (prices) { build(list, prices); });
  }).catch(fail);

  root.classList.add('is-on');
  syncMotion();
})();
