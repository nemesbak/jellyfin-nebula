/* Nebula — idiomas. Carga los textos de esta carpeta (languages.json + <código>.json) y los aplica al tema
   (variables --nb-txt-*). Lo cargan nebula-home.js y emby/nebula-emby-home.js; no hace falta pegarlo en ningún sitio.

   El idioma es siempre el de la interfaz: Jellyfin lo pone en <html lang> a partir de «Ajustes → Visualización →
   Idioma» de cada usuario (o el del navegador, en «Auto»). Si no lo tenemos traducido, inglés.

   Uso:   NebulaI18n.load().then(function (I) { I.t('carousel.play'); I.t('carousel.seasons', { n: 3 }); });
          NebulaI18n.onChange(function (I) { … });   // cuando Jellyfin cambia de idioma
   Añadir un idioma: copia en.json como <código>.json, tradúcelo y añádelo a languages.json. */
(function () {
  'use strict';
  if (window.NebulaI18n) return;
  var src = (document.currentScript && document.currentScript.src) || '';
  var BASE = src.replace(/[?#].*$/, '').replace(/[^/]*$/, '');
  var V = (src.match(/[?&]v=([^&#]+)/) || [])[1];

  var I = window.NebulaI18n = { lang: 'en', languages: { en: 'English' } };
  var dict = {}, en = {}, dics = {}, lista = null, cargado = null, quiere = null, cargando = null, oyentes = [], reglas = {};

  function get(f) {
    return fetch(BASE + f + (V ? '?v=' + V : '')).then(function (r) {
      if (!r.ok) throw new Error(f + ' → ' + r.status);
      return r.json();
    });
  }
  function aviso(e) { console.warn('[Nebula] idiomas:', e); return null; }
  function leer(o, k) { return k.split('.').reduce(function (o, p) { return o != null ? o[p] : undefined; }, o); }

  // El de la interfaz y, si aún no lo ha puesto Jellyfin, el del navegador; exacto o sin la región (es-MX → es)
  function elegir() {
    var c = [document.documentElement.lang].concat(navigator.languages || [navigator.language]);
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
      var l = elegir();
      if (l === cargado) return I;
      if (cargando && quiere === l) return cargando;
      quiere = l;
      cargando = Promise.all([dic(l), dic('en')]).then(function (r) {
        if (quiere !== l) return I.load();          // mientras tanto cambió el idioma
        var antes = cargado;
        dict = r[0] || {}; en = r[1] || {};
        I.lang = cargado = l; cargando = null;
        aplicarCss();
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

  I.onChange = function (f) { oyentes.push(f); };

  /* Textos del tema: la sección «theme» pasa a variables CSS (noFavorites → --nb-txt-no-favorites).
     Va al principio de <head>: gana a los valores por defecto de nebula.css y pierde ante el «CSS personalizado». */
  function cadenaCss(s) { return '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\A ') + '"'; }
  function aplicarCss() {
    var th = {}, css = '', k, st = document.getElementById('nbLangTxt');
    [en.theme, dict.theme].forEach(function (o) { for (k in o) if (typeof o[k] === 'string') th[k] = o[k]; });
    for (k in th) css += '--nb-txt-' + k.replace(/[A-Z]/g, function (m) { return '-' + m.toLowerCase(); }) + ':' + cadenaCss(th[k]) + ';';
    if (!st) { st = document.createElement('style'); st.id = 'nbLangTxt'; document.head.insertBefore(st, document.head.firstChild); }
    st.textContent = css ? ':root{' + css + '}' : '';
  }

  // Jellyfin pone <html lang> al arrancar y lo cambia si el usuario elige otro idioma: le seguimos
  new MutationObserver(function () { I.load(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  I.load();
})();
