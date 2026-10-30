/* P-Mentor Checklist — SPA vanilla, offline-first */
(function () {
  'use strict';

  var DATA = null;
  var BY_ID = {};
  var $view = document.getElementById('view');
  var STORE = 'pm.v1.';

  /* ---------- storage (tolerante a falha) ---------- */
  function load(key, def) {
    try { var v = localStorage.getItem(STORE + key); return v ? JSON.parse(v) : def; } catch (e) { return def; }
  }
  function save(key, val) {
    try { localStorage.setItem(STORE + key, JSON.stringify(val)); } catch (e) { /* ignora */ }
  }
  var checks = load('checks', {});

  /* ---------- helpers ---------- */
  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === 'class') el.className = attrs[k];
      else if (k === 'text') el.textContent = attrs[k];
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), attrs[k]);
      else el.setAttribute(k, attrs[k]);
    }
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c == null) continue;
      el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return el;
  }
  function toast(msg) {
    var t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('on');
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('on'); }, 1600);
  }
  function norm(s) {
    return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }
  function sevName(s) { return { warning: 'EMERGÊNCIA', caution: 'CAUTION', advisory: 'ADVISORY', normal: 'NORMAL' }[s] || s; }
  function hasMem(cl) { return cl.s.some(function (x) { return x.m; }); }
  function itemCount(cl) { return cl.s.filter(function (x) { return x.k != null; }).length; }
  function highlight(text, tokens) {
    if (!tokens.length) return document.createTextNode(text);
    var frag = document.createDocumentFragment(), low = norm(text), i = 0;
    // marcação simples: encontra o primeiro token e destaca
    var best = -1, len = 0;
    tokens.forEach(function (t) { var p = low.indexOf(t); if (p >= 0 && (best < 0 || p < best)) { best = p; len = t.length; } });
    if (best < 0) return document.createTextNode(text);
    frag.appendChild(document.createTextNode(text.slice(0, best)));
    frag.appendChild(h('mark', { text: text.slice(best, best + len) }));
    frag.appendChild(document.createTextNode(text.slice(best + len)));
    return frag;
  }

  /* ---------- tema ---------- */
  function applyTheme(mode) {
    var r = document.documentElement;
    if (mode === 'light' || mode === 'dark') r.setAttribute('data-theme', mode); else r.removeAttribute('data-theme');
    var dark = mode === 'dark' || (mode !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.querySelector('meta[name=theme-color]').setAttribute('content', dark ? '#0b0f14' : '#f4f5f7');
  }
  var theme = load('theme', 'auto');
  applyTheme(theme);
  document.getElementById('btn-theme').addEventListener('click', function () {
    theme = { auto: 'dark', dark: 'light', light: 'auto' }[theme];
    save('theme', theme); applyTheme(theme);
    toast({ auto: 'Tema: automático', dark: 'Tema: noturno', light: 'Tema: diurno' }[theme]);
  });

  /* ---------- manter tela ligada ---------- */
  var wake = null, $awake = document.getElementById('btn-awake');
  if (!('wakeLock' in navigator)) $awake.hidden = true;
  async function setAwake(on) {
    try {
      if (on) { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', function () { $awake.setAttribute('aria-pressed', 'false'); }); }
      else if (wake) { await wake.release(); wake = null; }
      $awake.setAttribute('aria-pressed', on ? 'true' : 'false');
      toast(on ? 'Tela permanece ligada' : 'Tela normal');
    } catch (e) { toast('Não foi possível manter a tela ligada'); }
  }
  $awake.addEventListener('click', function () { setAwake($awake.getAttribute('aria-pressed') !== 'true'); });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && $awake.getAttribute('aria-pressed') === 'true' && !wake) setAwake(true);
  });

  /* ---------- velocidades ---------- */
  var $dlg = document.getElementById('dlg-speeds');
  document.getElementById('btn-speeds').addEventListener('click', function () {
    var body = document.getElementById('speeds-body');
    body.textContent = '';
    var g = h('div', { class: 'speeds' });
    DATA.speeds.forEach(function (s) { g.appendChild(h('div', { text: s.k })); g.appendChild(h('div', { text: s.a })); });
    body.appendChild(g);
    $dlg.showModal();
  });

  /* ---------- views ---------- */
  function setTab(t) {
    document.querySelectorAll('.tab').forEach(function (a) {
      var on = a.getAttribute('data-tab') === t;
      a.classList.toggle('on', on); a.setAttribute('aria-selected', on ? 'true' : 'false');
    });
  }
  function catOf(id) { return DATA.categories.filter(function (c) { return c.id === id; })[0]; }

  function rowFor(cl, tokens, showCat) {
    var sev = cl.sev || 'normal';
    var t = h('span', { class: 't' });
    t.appendChild(highlight(cl.t, tokens || []));
    if (hasMem(cl)) t.appendChild(h('span', { class: 'tag', text: 'MEMORY' }));
    if (showCat) t.appendChild(h('span', { class: 'cat-tag', text: cl.cat ? catOf(cl.cat).name : cl.phase }));
    return h('a', { class: 'row sev-' + sev, href: '#/k/' + cl.id },
      h('span', { class: 'ref', text: cl.ref }), t, h('span', { class: 'go', text: '›' }));
  }

  function viewEmergencyHome() {
    setTab('e');
    var wrap = h('div');
    wrap.appendChild(h('h2', { class: 'sec', text: 'Categorias de emergência' }));
    var g = h('div', { class: 'grid' });
    DATA.categories.forEach(function (c) {
      var list = DATA.emergency.filter(function (x) { return x.cat === c.id; });
      var worst = list.some(function (x) { return x.sev === 'warning'; }) ? 'warning' : list.some(function (x) { return x.sev === 'caution'; }) ? 'caution' : 'advisory';
      g.appendChild(h('a', { class: 'cat sev-' + worst + ' ' + c.id, href: '#/c/' + c.id },
        h('span', { class: 't', text: c.name }), h('span', { class: 'n', text: list.length + ' checklists' })));
    });
    wrap.appendChild(g);

    wrap.appendChild(h('h2', { class: 'sec', text: 'Acesso rápido' }));
    var quick = ['e-7-1', 'e-7-2', 'e-11-3', 'e-9', 'e-16-1', 'e-13'];
    var l = h('div', { class: 'list' });
    quick.forEach(function (id) { l.appendChild(rowFor(BY_ID[id], null, true)); });
    wrap.appendChild(l);
    wrap.appendChild(disclaimer());
    return wrap;
  }

  function viewCategory(id) {
    setTab('e');
    var c = catOf(id);
    if (!c) return viewEmergencyHome();
    var wrap = h('div');
    wrap.appendChild(h('div', { class: 'crumb' }, h('a', { class: 'back', href: '#/e', text: '‹ Emergências' })));
    wrap.appendChild(h('h1', { text: c.name }));
    var order = { warning: 0, caution: 1, advisory: 2 };
    var list = DATA.emergency.filter(function (x) { return x.cat === id; })
      .sort(function (a, b) { return order[a.sev] - order[b.sev]; });
    var l = h('div', { class: 'list' });
    list.forEach(function (cl) { l.appendChild(rowFor(cl)); });
    wrap.appendChild(l);
    return wrap;
  }

  function viewNormal() {
    setTab('n');
    var wrap = h('div');
    var phases = [];
    DATA.normal.forEach(function (x) { if (phases.indexOf(x.phase) < 0) phases.push(x.phase); });
    phases.forEach(function (p) {
      wrap.appendChild(h('h2', { class: 'sec', text: p }));
      var l = h('div', { class: 'list' });
      DATA.normal.filter(function (x) { return x.phase === p; }).forEach(function (cl) { l.appendChild(rowFor(cl)); });
      wrap.appendChild(l);
    });
    wrap.appendChild(disclaimer());
    return wrap;
  }

  function disclaimer() {
    return h('p', { class: 'disclaimer', text: 'Auxílio de consulta baseado no AFM P-Mentor E01-R08 (Seções 3 e 4). Não substitui o AFM oficial em vigor da aeronave. Sempre confira com o manual aprovado.' });
  }

  function viewChecklist(id) {
    var cl = BY_ID[id];
    if (!cl) return viewEmergencyHome();
    var isE = !!cl.cat;
    setTab(isE ? 'e' : 'n');
    var sev = cl.sev || 'normal';
    var done = checks[id] || [];
    var wrap = h('div');
    var backHref = isE ? '#/c/' + cl.cat : '#/n';
    wrap.appendChild(h('div', { class: 'crumb' },
      h('a', { class: 'back', href: backHref, text: '‹ ' + (isE ? catOf(cl.cat).name : 'Normal') })));

    var bar = h('i');
    var count = h('span');
    wrap.appendChild(h('div', { class: 'cl-head sev-' + sev },
      h('h1', { text: cl.t }),
      h('div', { class: 'cl-meta' }, h('span', { class: 'badge ' + sev, text: sevName(sev) }), h('span', { text: 'AFM §' + cl.ref }), count),
      h('div', { class: 'bar' }, bar)));

    var resetBtn = h('button', { class: 'btn', type: 'button', text: '↺ Reset', onclick: function () {
      done = []; delete checks[id]; save('checks', checks); paint(); toast('Checklist reiniciado');
    } });
    wrap.appendChild(h('div', { class: 'actions' }, resetBtn,
      h('button', { class: 'btn', type: 'button', text: '✓ Marcar tudo', onclick: function () {
        done = []; cl.s.forEach(function (x, i) { if (x.k != null) done.push(i); }); checks[id] = done; save('checks', checks); paint();
      } })));

    var ol = h('ol', { class: 'steps' });
    wrap.appendChild(ol);
    wrap.appendChild(disclaimer());

    var total = itemCount(cl);
    var rows = [];

    function build() {
      var n = 0, inMem = false;
      cl.s.forEach(function (x, i) {
        if (x.c != null) { inMem = false; ol.appendChild(h('li', { class: 'cond', text: x.c })); return; }
        if (x.n != null) {
          var t = x.t || 'note';
          ol.appendChild(h('li', { class: 'note ' + t }, h('b', { text: t.toUpperCase() }), x.n)); return;
        }
        n++;
        if (x.m && !inMem) { ol.appendChild(h('li', { class: 'memlabel', text: 'MEMORY ITEMS — executar de memória, na ordem' })); }
        inMem = !!x.m;
        var single = !x.a;
        var li = h('li', { class: 'step' + (x.m ? ' mem' : '') + (single ? ' single' : ''), role: 'checkbox', tabindex: '0', 'aria-checked': 'false' },
          h('span', { class: 'no', text: String(n) }),
          h('span', { class: 'body' },
            h('span', { class: 'k', text: x.k }),
            h('span', { class: 'dots' }),
            h('span', { class: 'a', text: x.a || '' })),
          h('span', { class: 'box', 'aria-hidden': 'true' }));
        function toggle() {
          var p = done.indexOf(i);
          if (p >= 0) done.splice(p, 1); else done.push(i);
          if (done.length) checks[id] = done; else delete checks[id];
          save('checks', checks); paint();
          if (navigator.vibrate) { try { navigator.vibrate(10); } catch (e) { /* ignora */ } }
        }
        li.addEventListener('click', toggle);
        li.addEventListener('keydown', function (e) { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(); } });
        rows.push({ i: i, li: li });
        ol.appendChild(li);
      });
    }

    function paint() {
      var cur = true;
      rows.forEach(function (r) {
        var d = done.indexOf(r.i) >= 0;
        r.li.classList.toggle('done', d);
        r.li.setAttribute('aria-checked', d ? 'true' : 'false');
        r.li.classList.toggle('cur', !d && cur);
        if (!d) cur = false;
      });
      var c = rows.filter(function (r) { return done.indexOf(r.i) >= 0; }).length;
      bar.style.width = (total ? (c / total) * 100 : 0) + '%';
      count.textContent = c + ' / ' + total + (c === total && total ? ' ✓ COMPLETO' : '');
    }
    build(); paint();
    return wrap;
  }

  /* ---------- busca ---------- */
  function searchView(query) {
    var tokens = norm(query).split(/\s+/).filter(Boolean);
    var all = DATA.emergency.concat(DATA.normal);
    var scored = [];
    all.forEach(function (cl) {
      var title = norm(cl.t), kw = norm((cl.kw || []).join(' ') + ' ' + cl.ref);
      var body = norm(cl.s.map(function (x) { return (x.k || '') + ' ' + (x.a || '') + ' ' + (x.c || '') + ' ' + (x.n || ''); }).join(' '));
      var score = 0, ok = true;
      tokens.forEach(function (t) {
        var s = 0;
        if (title.indexOf(t) >= 0) s += 10;
        if (kw.indexOf(t) >= 0) s += 6;
        if (body.indexOf(t) >= 0) s += 1;
        if (!s) ok = false; score += s;
      });
      if (ok) scored.push({ cl: cl, score: score + (cl.cat ? 0.5 : 0) + (cl.sev === 'warning' ? 0.3 : 0) });
    });
    scored.sort(function (a, b) { return b.score - a.score; });
    var wrap = h('div');
    wrap.appendChild(h('h2', { class: 'sec', text: scored.length + ' resultado(s) para "' + query + '"' }));
    var l = h('div', { class: 'list' });
    if (!scored.length) wrap.appendChild(h('p', { class: 'empty', text: 'Nada encontrado. Tente: engine, fire, fuel, oil, volt, spin, flaps, trim, pitot, COM…' }));
    scored.slice(0, 40).forEach(function (s) { l.appendChild(rowFor(s.cl, tokens, true)); });
    wrap.appendChild(l);
    return wrap;
  }

  /* ---------- router ---------- */
  function render() {
    if (!DATA) return;
    var node;
    var parts = location.hash.replace(/^#\/?/, '').split('/');
    if (parts[0] === 'k') node = viewChecklist(parts[1]);
    else if (parts[0] === 'c') node = viewCategory(parts[1]);
    else if (parts[0] === 'n') node = viewNormal();
    else node = viewEmergencyHome();
    $view.textContent = '';
    $view.appendChild(node);
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', render);

  /* ---------- boot ---------- */
  fetch('data/checklists.json').then(function (r) { return r.json(); }).then(function (d) {
    DATA = d;
    d.emergency.concat(d.normal).forEach(function (x) { BY_ID[x.id] = x; });
    render();
  }).catch(function () {
    $view.textContent = 'Falha ao carregar os dados. Abra uma vez com internet para habilitar o modo offline.';
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () { /* ignora */ }); });
  }
})();
