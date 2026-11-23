/* Spiral hero. P45.23.
   Kill switch: ?hero=wave restores the wavefield. Default is this scene.
   Image weight: 10 x 320px WebP = 315,898 bytes. Nearest three = 88,658 bytes.
   Detail art is the existing 400px file in /binder/, loaded on open. */
(function () {
  if (document.documentElement.getAttribute('data-hero') !== 'spiral') return;

  var GAMES = {
    'one-piece': {
      label: 'One Piece',
      legal: 'CardOS TCG is a fan-made collection tracker. Not affiliated with, endorsed, or sponsored by Bandai, Shueisha, Toei Animation, Eiichiro Oda, Riot Games, UVS Games, Bushiroad, or Pocketpair.'
    },
    riftbound: {
      label: 'Riftbound',
      legal: 'RIFTBOUND: LEAGUE OF LEGENDS manufactured by UVS Games under license from Riot Games. \u2122 & \u00A9 2026 Riot Games, Inc.'
    },
    palworld: {
      label: 'Palworld',
      legal: 'CardOS TCG is a fan-made collection tracker. Not affiliated with, endorsed, or sponsored by Bandai, Shueisha, Toei Animation, Eiichiro Oda, Riot Games, UVS Games, Bushiroad, or Pocketpair.'
    }
  };
  var MAT = { op: '#F99D1B', rb: '#4E1D4C', pw: '#FDBF68' };
  var EST = 'Estimates are tagged Est.';

  var stage = document.getElementById('top');
  var root = document.getElementById('spiral');
  var spin = document.getElementById('spiral-spin');
  var view = document.getElementById('spiral-view');
  var cap = document.getElementById('spiral-cap');
  var hint = document.getElementById('spiral-hint');
  var dialog = document.getElementById('sp-dialog');
  var motionBtn = document.getElementById('motion');
  var logCta = document.getElementById('log-cta');
  if (!stage || !root || !spin || !view || !dialog) return;

  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var motionOn = true;
  try { motionOn = localStorage.getItem('cardos_motion') !== 'off'; } catch (e) {}
  if (reduced) motionOn = false;

  var cards = [];
  var angle = 0;
  var speed = 0;
  var speedTarget = 0;
  var raf = 0;
  var last = 0;
  var vis = true;
  var open = false;
  var openAt = -1;
  var active = 0;
  var dragging = false;
  var dragId = 0;
  var dragX = 0;
  var dragY = 0;
  var dragLocked = '';
  var interacted = false;
  var lite = (navigator.deviceMemory && navigator.deviceMemory <= 4) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2);
  var frameTimes = [];
  var heroSeen = false;

  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function money(v) {
    if (!isNum(v) || v <= 0) return '\u2014';
    return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function moveText(v) {
    if (!isNum(v)) return '\u2014';
    var n = (v > 0 ? '+' : '') + v.toFixed(1) + '%';
    return n;
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
  function paused() { return reduced || !motionOn || open; }

  function syncMotion() {
    var showOn = motionOn && !reduced;
    if (motionBtn) {
      motionBtn.textContent = showOn ? 'Motion on' : 'Motion off';
      motionBtn.setAttribute('aria-pressed', String(showOn));
    }
    root.classList.toggle('is-paused', !showOn);
    if (hint) hint.hidden = reduced || interacted;
    speedTarget = paused() || !vis || document.hidden ? 0 : 1;
    if (!showOn) speed = 0;
    kick();
  }

  function layout() {
    var w = view.clientWidth || 320;
    var h = view.clientHeight || 320;
    var short = Math.min(window.innerWidth || w, window.innerHeight || h);
    var box = Math.min(w, h);
    var far = Math.min(short * 0.1, box * 0.16);
    var near = Math.min(short * 0.36, box * 0.4);
    var n = cards.length;
    var turns = 2.2 * (n / 20);
    var mobile = window.innerWidth < 700;
    var desktop = window.innerWidth >= 1100;
    cards.forEach(function (c, i) {
      var depthT = n === 1 ? 1 : i / (n - 1);
      c.depthT = depthT;
      c.ang = (i / n) * turns * Math.PI * 2;
      var radius = far + (near - far) * depthT;
      var z = -1800 + depthT * 2060;
      var x = Math.cos(c.ang) * radius;
      var y = Math.sin(c.ang) * radius * 0.62;
      var roll = (6 + unit(i) * 8) * (unit(i + 4) > 0.5 ? 1 : -1);
      var pitch = (4 + unit(i + 2) * 5) * (unit(i + 6) > 0.5 ? 1 : -1);
      c.el.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,' + z.toFixed(1) + 'px) rotateZ(' + roll.toFixed(2) + 'deg) rotateX(' + pitch.toFixed(2) + 'deg)';
      c.el.classList.toggle('is-far', desktop && !lite && !reduced && depthT < 0.4);
    });
    var chaseKeep = cards.map(function (c, i) { return c.chase ? i : -1; }).filter(function (i) { return i >= 0; });
    chaseKeep.sort(function (a, b) { return cards[b].depthT - cards[a].depthT; });
    var chaseMax = mobile ? 2 : 3;
    cards.forEach(function (c, i) {
      c.el.classList.toggle('chase', chaseKeep.indexOf(i) !== -1 && chaseKeep.indexOf(i) < chaseMax);
    });
    stack();
  }

  function facingScore(c) {
    var world = c.ang + angle * Math.PI / 180;
    var front = -0.35;
    return c.depthT * 900 + Math.cos(world - front) * 420;
  }

  function stack() {
    if (!cards.length) return;
    var mobile = window.innerWidth < 700;
    var ranked = cards.map(function (c, i) { return { i: i, s: facingScore(c) }; });
    ranked.sort(function (a, b) { return b.s - a.s; });
    var best = ranked[0].i;
    ranked.forEach(function (row, rank) {
      var c = cards[row.i];
      c.el.style.zIndex = String(100 + Math.round(row.s));
      var tappable = !mobile || rank < 8;
      c.el.style.pointerEvents = tappable ? '' : 'none';
      c.el.tabIndex = tappable ? 0 : -1;
    });
    if (!open && best !== active) {
      active = best;
      paintCaption();
      if (logCta) logCta.href = hrefFor(cards[active], 'hero');
    }
  }

  function paintCaption() {
    var c = cards[active];
    if (!c || !cap) return;
    cap.textContent = pad(active + 1) + '  \u00B7  ' + gameOf(c).label + '  \u00B7  ' + c.name + '  \u00B7  ' + c.card_id;
  }

  function tick(ts) {
    raf = 0;
    var dt = last ? Math.min(34, ts - last) : 16;
    last = ts;
    if (!lite && frameTimes.length < 120) {
      frameTimes.push(dt);
      if (frameTimes.length === 120) {
        var avg = frameTimes.reduce(function (a, b) { return a + b; }, 0) / frameTimes.length;
        if (avg > 25) { lite = true; root.classList.add('is-lite'); layout(); }
      }
    }
    var dur = speedTarget > speed ? 600 : 400;
    speed += (speedTarget - speed) * Math.min(1, dt / dur);
    if (speed < 0.001) speed = 0;
    if (speed) angle = (angle + dt * 360 / 90000 * speed) % 360;
    spin.style.transform = 'rotateZ(' + angle.toFixed(3) + 'deg)';
    if (speed || dragging) stack();
    if (vis && !document.hidden && (speed > 0 || dragging || Math.abs(speedTarget - speed) > 0.01)) {
      raf = requestAnimationFrame(tick);
    }
  }
  function kick() {
    if (!raf && vis && !document.hidden) raf = requestAnimationFrame(tick);
  }

  function hideHint() {
    interacted = true;
    if (hint) hint.hidden = true;
  }

  function fillDetail(i) {
    var c = cards[i];
    if (!c) return;
    openAt = i;
    var g = gameOf(c);
    var age = ageDays(c.as_of);
    var stale = age != null && age > 21;
    var showDate = age != null && age > 10 && !stale;
    document.getElementById('sp-eyebrow').textContent = g.label + '  \u00B7  ' + c.set_code + '  \u00B7  ' + c.number;
    document.getElementById('sp-title').textContent = c.name;
    var sub = [c.rarity, c.printing].filter(Boolean).join(' \u00B7 ');
    var subEl = document.getElementById('sp-sub');
    subEl.hidden = !sub;
    subEl.textContent = sub;
    var priceEl = document.getElementById('sp-price');
    var moveEl = document.getElementById('sp-move');
    var asofEl = document.getElementById('sp-asof');
    var tiles = document.getElementById('sp-tiles');
    tiles.hidden = false;
    priceEl.textContent = stale ? '\u2014' : money(c.price);
    priceEl.className = 'sp-num';
    var mv = stale ? null : c.move_30d;
    moveEl.textContent = moveText(mv);
    moveEl.className = 'sp-num' + (isNum(mv) ? (mv > 0 ? ' is-up' : (mv < 0 ? ' is-down' : ' is-flat')) : '');
    asofEl.hidden = !showDate;
    if (showDate) asofEl.textContent = 'Est. as of ' + c.as_of;
    var spark = document.getElementById('sp-spark');
    var series = !stale && Array.isArray(c.series_30d) && c.series_30d.length > 1 ? c.series_30d : null;
    spark.hidden = !series;
    if (series) drawSpark(spark, series);
    var meta = document.getElementById('sp-meta');
    var bits = [c.set_code + '-' + c.number];
    if (c.printing) bits.push(c.printing);
    if (c.as_of && !stale) bits.push('Updated ' + c.as_of);
    meta.textContent = bits.join('  \u00B7  ');
    var art = document.getElementById('sp-art');
    art.alt = g.label + ', ' + c.name + ', ' + c.card_id;
    if (art.getAttribute('src') !== '/binder/' + c.card_image_id + '.webp') {
      art.src = '/binder/' + c.card_image_id + '.webp';
    }
    var cta = document.getElementById('sp-cta');
    cta.href = hrefFor(c, 'detail');
    document.getElementById('sp-legal').textContent = (g.legal ? g.legal + ' ' : '') + EST;
    var live = document.getElementById('sp-live');
    if (live) live.textContent = 'Card ' + (i + 1) + ' of ' + cards.length + ', ' + c.name;
    paintCaption();
  }

  function drawSpark(svg, series) {
    var nums = series.filter(isNum);
    if (nums.length < 2) { svg.hidden = true; return; }
    var min = Math.min.apply(null, nums);
    var max = Math.max.apply(null, nums);
    var span = max - min || 1;
    var d = nums.map(function (v, i) {
      var x = (i / (nums.length - 1)) * 120;
      var y = 28 - ((v - min) / span) * 24;
      return (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
    }).join(' ');
    svg.innerHTML = '<path d="' + d + '" fill="none" stroke="currentColor" stroke-width="1.5"/>';
  }

  function openCard(i, fromEl) {
    if (open) { fillDetail(i); return; }
    open = true;
    hideHint();
    stage.classList.add('is-detail');
    fillDetail(i);
    speedTarget = 0;
    if (typeof dialog.showModal === 'function' && !dialog.open) dialog.showModal();
    else dialog.setAttribute('open', '');
    var closeBtn = document.getElementById('sp-close');
    if (closeBtn) closeBtn.focus();
    track('spiral_open', { card_id: cards[i].card_id, game: cards[i].game, position: i + 1 });
    if (!reduced && motionOn && fromEl) fly(fromEl, document.getElementById('sp-art'));
    kick();
  }

  function closeCard() {
    if (!open) return;
    open = false;
    stage.classList.remove('is-detail');
    if (dialog.open && dialog.close) dialog.close();
    else dialog.removeAttribute('open');
    var back = cards[openAt] && cards[openAt].el;
    if (back) back.focus();
    syncMotion();
  }

  function step(dir) {
    if (!cards.length) return;
    var i = (openAt + dir + cards.length) % cards.length;
    var from = cards[openAt] && cards[openAt].el;
    if (!open) openCard(i, from);
    else {
      fillDetail(i);
      track('spiral_open', { card_id: cards[i].card_id, game: cards[i].game, position: i + 1 });
    }
  }

  function fly(fromEl, toEl) {
    if (!fromEl || !toEl) return;
    var img = fromEl.querySelector('img');
    if (!img) return;
    var a = fromEl.getBoundingClientRect();
    if (!a.width || !a.height) return;
    var ghost = img.cloneNode();
    ghost.alt = '';
    ghost.style.cssText = 'position:fixed;left:' + a.left + 'px;top:' + a.top + 'px;width:' + a.width + 'px;height:' + a.height + 'px;z-index:2147483646;margin:0;pointer-events:none;border-radius:6px;object-fit:cover;transform-origin:0 0;transition:transform 650ms cubic-bezier(0.22,1,0.36,1),opacity 650ms;';
    document.body.appendChild(ghost);
    toEl.style.opacity = '0';
    requestAnimationFrame(function () {
      var b = toEl.getBoundingClientRect();
      if (!b.width) { ghost.remove(); toEl.style.opacity = ''; return; }
      ghost.style.transform = 'translate(' + (b.left - a.left) + 'px,' + (b.top - a.top) + 'px) scale(' + (b.width / a.width) + ',' + (b.height / a.height) + ')';
    });
    setTimeout(function () {
      ghost.style.opacity = '0';
      toEl.style.opacity = '';
      setTimeout(function () { ghost.remove(); }, 180);
    }, 650);
  }

  function build(list) {
    var n = list.length;
    var eagerFrom = Math.max(0, n - 3);
    list.forEach(function (raw, i) {
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
        price: isNum(raw.price) ? raw.price : null,
        move_7d: isNum(raw.move_7d) ? raw.move_7d : null,
        move_30d: isNum(raw.move_30d) ? raw.move_30d : null,
        series_30d: raw.series_30d || null,
        as_of: raw.as_of || null,
        depthT: 0,
        ang: 0
      };
      var g = gameOf(c);
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sp-card';
      btn.setAttribute('data-mat', c.mat);
      btn.style.setProperty('--mat', MAT[c.mat] || '#F99D1B');
      btn.style.setProperty('--dx', (2 + unit(i) * 2).toFixed(2) + 'px');
      btn.style.setProperty('--dy', (2 + unit(i + 3) * 2).toFixed(2) + 'px');
      var priceLabel = money(c.price);
      btn.setAttribute('aria-label', g.label + ', ' + c.name + ', ' + c.card_id + ', Est. ' + priceLabel);
      var face = document.createElement('span');
      face.className = 'sp-face';
      var img = document.createElement('img');
      img.alt = g.label + ', ' + c.name + ', ' + c.card_id;
      img.width = 320;
      img.height = 446;
      img.decoding = 'async';
      var src = '/hero/' + c.card_image_id + '.webp';
      if (i >= eagerFrom) {
        img.loading = 'eager';
        img.src = src;
      } else {
        img.loading = 'lazy';
        img.dataset.src = src;
      }
      img.addEventListener('error', function () { btn.remove(); });
      face.appendChild(img);
      btn.appendChild(face);
      btn.addEventListener('click', function () { openCard(i, btn); });
      spin.appendChild(btn);
      c.el = btn;
      cards.push(c);
    });
    var idle = window.requestIdleCallback || function (fn) { setTimeout(fn, 200); };
    idle(function () {
      cards.forEach(function (c) {
        var img = c.el.querySelector('img');
        if (img && img.dataset.src && !img.getAttribute('src')) img.src = img.dataset.src;
      });
    });
    document.documentElement.classList.add('spiral-ready');
    layout();
    active = cards.length - 1;
    paintCaption();
    if (logCta) logCta.href = hrefFor(cards[active], 'hero');
    syncMotion();
    watchHero();
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
      if (!vis) speedTarget = 0;
      else syncMotion();
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

  view.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    dragging = true;
    dragLocked = '';
    dragId = e.pointerId;
    dragX = e.clientX;
    dragY = e.clientY;
  });
  view.addEventListener('pointermove', function (e) {
    if (!dragging || e.pointerId !== dragId) return;
    var dx = e.clientX - dragX;
    var dy = e.clientY - dragY;
    if (!dragLocked) {
      if (Math.hypot(dx, dy) < 8) return;
      dragLocked = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (dragLocked === 'y') { dragging = false; return; }
      view.setPointerCapture(e.pointerId);
    }
    if (dragLocked !== 'x') return;
    angle += dx * 0.35;
    dragX = e.clientX;
    dragY = e.clientY;
    hideHint();
    spin.style.transform = 'rotateZ(' + angle.toFixed(3) + 'deg)';
    stack();
  });
  function endDrag(e) {
    if (e.pointerId !== dragId) return;
    dragging = false;
    dragLocked = '';
  }
  view.addEventListener('pointerup', endDrag);
  view.addEventListener('pointercancel', endDrag);
  view.addEventListener('pointerenter', function (e) {
    if (e.pointerType !== 'mouse' || open) return;
    speedTarget = 0;
    kick();
  });
  view.addEventListener('pointerleave', function (e) {
    if (e.pointerType !== 'mouse') return;
    endDrag(e);
    if (!open) syncMotion();
  });
  spin.addEventListener('focusin', function () { speedTarget = 0; kick(); });
  spin.addEventListener('focusout', function (e) {
    if (spin.contains(e.relatedTarget) || open) return;
    syncMotion();
  });

  document.addEventListener('keydown', function (e) {
    var inHero = stage.contains(document.activeElement) || (dialog.open && dialog.contains(document.activeElement));
    if (!inHero) return;
    if (e.key === 'Escape' && open) { e.preventDefault(); closeCard(); return; }
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      hideHint();
      if (open) step(e.key === 'ArrowRight' ? 1 : -1);
      else {
        angle += e.key === 'ArrowRight' ? 18 : -18;
        spin.style.transform = 'rotateZ(' + angle.toFixed(3) + 'deg)';
        stack();
      }
    }
  });

  document.getElementById('sp-close').addEventListener('click', closeCard);
  document.getElementById('sp-prev').addEventListener('click', function () { step(-1); });
  document.getElementById('sp-next').addEventListener('click', function () { step(1); });
  dialog.addEventListener('cancel', function (e) { e.preventDefault(); closeCard(); });
  dialog.addEventListener('close', function () {
    if (!open) return;
    open = false;
    stage.classList.remove('is-detail');
    syncMotion();
  });
  document.addEventListener('click', function (e) {
    var a = e.target.closest('#log-cta, #sp-cta');
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
    });
  }
  if (matchMedia('(prefers-reduced-motion: reduce)').addEventListener) {
    matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', function (e) {
      reduced = e.matches;
      if (reduced) motionOn = false;
      syncMotion();
      layout();
    });
  }
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { speedTarget = 0; return; }
    syncMotion();
  });
  window.addEventListener('resize', function () {
    clearTimeout(layout._t);
    layout._t = setTimeout(layout, 150);
  });

  fetch('/hero/cards.json', { credentials: 'same-origin' }).then(function (r) {
    if (!r.ok) throw new Error('cards');
    return r.json();
  }).then(function (data) {
    var list = data && data.cards;
    if (!list || !list.length) throw new Error('empty');
    build(list);
  }).catch(fail);

  root.classList.add('is-on');
  syncMotion();
})();
