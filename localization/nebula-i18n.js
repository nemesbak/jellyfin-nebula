/* Nebula — idiomas. Carga los textos de esta carpeta (languages.json + <código>.json), los aplica al tema
   (variables --nb-txt-*) y pone un botón de idioma en la barra superior de Jellyfin y Emby.
   Lo cargan nebula-home.js y emby/nebula-emby-home.js; no hace falta pegarlo en ningún sitio.

   Uso:   NebulaI18n.load().then(function (I) { I.t('carousel.play'); I.t('carousel.seasons', { n: 3 }); });
          NebulaI18n.onChange(function (I) { … });   // al cambiar de idioma
          NebulaI18n.set('es');  NebulaI18n.set('');  // elegir idioma / volver a automático

   Qué idioma se usa: el elegido con el botón (se guarda en este navegador) › --nb-lang en «CSS personalizado»
   › el de la interfaz de Jellyfin/Emby (<html lang>) › el del navegador › inglés.
   Añadir un idioma: copia en.json como <código>.json, tradúcelo y añádelo a languages.json. */
(function () {
  'use strict';
  if (window.NebulaI18n) return;
  var src = (document.currentScript && document.currentScript.src) || '';
  var BASE = src.replace(/[?#].*$/, '').replace(/[^/]*$/, '');
  var V = (src.match(/[?&]v=([^&#]+)/) || [])[1];
  var KEY = 'nebula-lang';

  var I = window.NebulaI18n = { lang: 'en', choice: '', languages: { en: 'English' } };
  var dict = {}, en = {}, dics = {}, lista = null, cargado = null, quiere = null, cargando = null, oyentes = [], reglas = {};

  function get(f) {
    return fetch(BASE + f + (V ? '?v=' + V : '')).then(function (r) {
      if (!r.ok) throw new Error(f + ' → ' + r.status);
      return r.json();
    });
  }
  function aviso(e) { console.warn('[Nebula] idiomas:', e); return null; }
  function leer(o, k) { return k.split('.').reduce(function (o, p) { return o != null ? o[p] : undefined; }, o); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function guardado() { try { return localStorage.getItem(KEY) || ''; } catch (e) { return ''; } }

  // Primer candidato que tengamos traducido, exacto o sin la región (es-MX → es)
  function elegir(sinGuardado) {
    var css = getComputedStyle(document.documentElement).getPropertyValue('--nb-lang').trim().replace(/^["']|["']$/g, '');
    var c = [sinGuardado ? '' : guardado(), css, document.documentElement.lang].concat(navigator.languages || [navigator.language]);
    for (var i = 0; i < c.length; i++) {
      var l = String(c[i] || '').toLowerCase();
      if (I.languages[l]) return l;
      if (l && I.languages[l.split('-')[0]]) return l.split('-')[0];
    }
    return 'en';
  }

  function idiomas() {
    return lista || (lista = get('languages.json').then(function (j) { I.languages = j; }, aviso));
  }
  // Cada idioma se pide una sola vez (si falla, se reintenta la próxima)
  function dic(l) {
    return dics[l] || (dics[l] = get(l + '.json').catch(function (e) { delete dics[l]; return aviso(e); }));
  }

  // Carga el idioma que toca ahora (si ya está cargado, no vuelve a pedir nada)
  I.load = function () {
    return idiomas().then(function () {
      var l = elegir(), g = guardado();
      I.choice = I.languages[g] ? g : '';
      if (l === cargado) return I;
      if (cargando && quiere === l) return cargando;
      quiere = l;
      cargando = Promise.all([dic(l), dic('en')]).then(function (r) {
        if (quiere !== l) return I.load();          // mientras tanto se pidió otro idioma
        var antes = cargado;
        dict = r[0] || {}; en = r[1] || {};
        I.lang = cargado = l; cargando = null;
        aplicarCss();
        Array.prototype.forEach.call(document.querySelectorAll('.nbLangBtn'), rotular);
        if (antes) oyentes.forEach(function (f) { try { f(I); } catch (e) { aviso(e); } });
        return I;
      });
      return cargando;
    });
  };

  // Texto por clave («carousel.play»). Si falta en el idioma, sale en inglés; si tampoco está, la clave.
  // Plurales: { "one": "{n} season", "other": "{n} seasons" } y t(clave, { n: 3 }).
  I.t = function (k, vars) {
    var s = leer(dict, k);
    if (s == null) s = leer(en, k);
    if (s && typeof s === 'object' && vars && vars.n != null) { var p = plural(vars.n); s = s[p] != null ? s[p] : s.other; }
    if (typeof s !== 'string') return k;
    return vars ? s.replace(/\{(\w+)\}/g, function (m, v) { return vars[v] != null ? vars[v] : m; }) : s;
  };
  function plural(n) {
    try { return (reglas[I.lang] || (reglas[I.lang] = new Intl.PluralRules(I.lang))).select(n); }
    catch (e) { return n === 1 ? 'one' : 'other'; }
  }

  I.set = function (code) {
    try { if (code) localStorage.setItem(KEY, code); else localStorage.removeItem(KEY); } catch (e) {}
    return I.load();
  };
  I.onChange = function (f) { oyentes.push(f); };

  /* ---------- textos del tema: la sección «theme» pasa a variables CSS (noFavorites → --nb-txt-no-favorites) ----------
     Va al principio de <head>: gana a los valores por defecto de nebula.css y pierde ante el «CSS personalizado». */
  function estilo(id) {
    var s = document.getElementById(id);
    if (!s) { s = document.createElement('style'); s.id = id; document.head.insertBefore(s, document.head.firstChild); }
    return s;
  }
  function cadenaCss(s) { return '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\A ') + '"'; }
  function aplicarCss() {
    var th = {}, css = '', k;
    [en.theme, dict.theme].forEach(function (o) { for (k in o) if (typeof o[k] === 'string') th[k] = o[k]; });
    for (k in th) css += '--nb-txt-' + k.replace(/[A-Z]/g, function (m) { return '-' + m.toLowerCase(); }) + ':' + cadenaCss(th[k]) + ';';
    estilo('nbLangTxt').textContent = css ? ':root{' + css + '}' : '';
  }

  /* ---------- botón de idioma en la barra superior ---------- */
  var ICONO = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/></svg>';
  var menu = null;

  function rotular(b) {
    var t = I.t('language.title') + ' · ' + (I.languages[I.lang] || I.lang);
    b.title = t; b.setAttribute('aria-label', t);
  }
  function boton(clase) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = clase + ' nbLangBtn'; b.innerHTML = ICONO;
    b.setAttribute('aria-haspopup', 'menu');
    rotular(b);
    b.addEventListener('click', function (e) { e.stopPropagation(); if (menu) cerrar(); else abrir(b); });
    return b;
  }
  function ponerBoton() {
    if (!cargado || document.querySelector('.nbLangBtn')) return;
    // Jellyfin 10.9+ (barra MUI): al final de los botones de la derecha (búsqueda…), antes del menú de usuario
    var u = document.querySelector('.MuiToolbar-root [aria-controls="app-user-menu"]');
    var fila = u && u.parentElement && u.parentElement.previousElementSibling;
    if (fila) {
      var ref = fila.querySelector('.MuiIconButton-root');
      fila.appendChild(boton(ref ? ref.className.replace(/\bMui-(disabled|focusVisible)\b/g, '') : 'MuiButtonBase-root MuiIconButton-root'));
      return;
    }
    // Jellyfin clásico y Emby: en .headerRight, antes del botón de usuario
    var der = document.querySelector('.skinHeader .headerRight');
    if (der) der.insertBefore(boton('headerButton headerButtonRight paper-icon-button-light'), der.querySelector('.headerUserButton'));
  }

  function opcion(code, texto, sub) {
    var on = I.choice === code;
    return '<button type="button" role="menuitemradio" aria-checked="' + on + '" data-lang="' + esc(code) + '"' + (code ? ' lang="' + esc(code) + '"' : '') + '>' +
      '<span>' + esc(texto) + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</span>' + (on ? '<i aria-hidden="true">✓</i>' : '') + '</button>';
  }
  function abrir(b) {
    cerrar();
    menu = document.createElement('div');
    menu.className = 'nbLangMenu'; menu.setAttribute('role', 'menu'); menu.setAttribute('aria-label', I.t('language.title'));
    menu.innerHTML = '<div class="nbLangMenu-title">' + esc(I.t('language.title')) + '</div>' +
      opcion('', I.t('language.auto'), I.languages[elegir(true)]) +
      Object.keys(I.languages).map(function (c) { return opcion(c, I.languages[c]); }).join('');
    menu.addEventListener('click', function (e) {
      var o = e.target.closest('[data-lang]');
      if (!o) return;
      cerrar(); I.set(o.getAttribute('data-lang')); b.focus();
    });
    document.body.appendChild(menu);
    var r = b.getBoundingClientRect();
    menu.style.top = Math.round(r.bottom + 6) + 'px';
    menu.style.right = Math.max(8, Math.round(window.innerWidth - r.right)) + 'px';
    b.setAttribute('aria-expanded', 'true');
    (menu.querySelector('[aria-checked="true"]') || menu.querySelector('[data-lang]')).focus();
  }
  function cerrar() {
    if (!menu) return;
    menu.remove(); menu = null;
    Array.prototype.forEach.call(document.querySelectorAll('.nbLangBtn'), function (b) { b.setAttribute('aria-expanded', 'false'); });
  }
  document.addEventListener('pointerdown', function (e) {
    if (menu && !menu.contains(e.target) && !(e.target.closest && e.target.closest('.nbLangBtn'))) cerrar();
  }, true);
  document.addEventListener('keydown', function (e) {
    if (!menu) return;
    if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); cerrar(); var b = document.querySelector('.nbLangBtn'); if (b) b.focus(); return; }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    var os = Array.prototype.slice.call(menu.querySelectorAll('[data-lang]')), i = os.indexOf(document.activeElement);
    os[(i + (e.key === 'ArrowDown' ? 1 : -1) + os.length) % os.length].focus();
    e.preventDefault();
  }, true);
  window.addEventListener('hashchange', cerrar);
  window.addEventListener('resize', cerrar);

  estilo('nbLangCss').textContent =
    '.nbLangBtn svg{width:24px;height:24px;fill:currentColor;display:block;margin:auto}' +
    '.nbLangMenu{position:fixed;z-index:2000;min-width:210px;max-height:70vh;overflow:auto;padding:4px;border-radius:16px;' +
      'background:rgba(24,24,30,.86);-webkit-backdrop-filter:blur(22px) saturate(150%);backdrop-filter:blur(22px) saturate(150%);' +
      'border:1px solid var(--nb-line,rgba(255,255,255,.08));box-shadow:0 24px 60px rgba(0,0,0,.6);color:var(--nb-text,#ececf1);' +
      'font-size:.95rem;animation:nbLangIn .16s ease-out}' +
    '.nbLangMenu-title{padding:.6em .9em .35em;font-size:.75em;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--nb-muted,#8b8b96)}' +
    '.nbLangMenu button{display:flex;align-items:center;justify-content:space-between;gap:1em;width:100%;margin:1px 0;padding:.6em .9em;' +
      'border:0;border-radius:10px;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer}' +
    '.nbLangMenu button:hover,.nbLangMenu button:focus-visible{background:rgba(255,255,255,.08);outline:none}' +
    '.nbLangMenu button[aria-checked="true"]{font-weight:600}' +
    '.nbLangMenu small{margin-left:.5em;color:var(--nb-muted,#8b8b96);font-size:.85em;font-weight:400}' +
    '.nbLangMenu i{font-style:normal;color:var(--nb-a2,#22d3ee)}' +
    '@keyframes nbLangIn{from{opacity:0;transform:translateY(-4px)}}' +
    '@media (prefers-reduced-motion:reduce){.nbLangMenu{animation:none}}';

  // En «Automático» se sigue a Jellyfin cuando cambia el idioma de la interfaz (<html lang>),
  // a «--nb-lang» si llega después (el CSS personalizado se pone tarde) y a otras pestañas.
  new MutationObserver(function () { I.load(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  window.addEventListener('hashchange', function () { I.load(); });
  window.addEventListener('storage', function (e) { if (e.key === KEY) I.load(); });
  var pend = false;
  new MutationObserver(function () {
    if (pend) return; pend = true;
    setTimeout(function () { pend = false; ponerBoton(); }, 100);
  }).observe(document.documentElement, { childList: true, subtree: true });

  I.load().then(ponerBoton);
})();
