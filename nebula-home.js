/* Nebula — carrusel destacado en la portada de Jellyfin.
   Se carga desde index.html (ver install/inject-docker.sh). Solo lee la API con la sesión del usuario. */
(function () {
  'use strict';
  /* La app de Jellyfin para iOS (WKWebView) puede entrar en un bucle de recargas con el carrusel: en iOS no se carga. */
  if (/iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)) return;
  /* Ajustes: se leen de variables CSS (ponlas en «CSS personalizado», ver README) o de window.NebulaHero.
     Ejemplo:  :root { --nb-hero-count: 10; --nb-hero-source: toprated; --nb-hero-library: "Películas"; } */
  var DEF = {
    lang: '',                 // idioma de los textos (es, en, it...); vacío = el del usuario
    count: 8,                 // títulos en el carrusel (0 = sin carrusel)
    interval: 8,              // segundos entre diapositivas (0 = sin autoavance)
    source: 'recent',         // recent | random | toprated | favorites
    types: 'Movie,Series',    // Movie, Series o ambos
    library: '',              // nombre(s) de biblioteca separados por coma; vacío = todas
    days: 120,                // solo añadidos en los últimos N días (source=recent); 0 = sin límite
    unwatched: 1,             // 1 = solo no vistos
    logo: 1,                  // 1 = solo títulos con logo; 0 = también sin logo (muestra el nombre)
    overview: 1, genres: 1, rating: 1,
    buttons: 1,               // botones «Ver ahora» / «Más info»
    play: 1                   // 1 = «Ver ahora» reproduce directamente
  };
  var cache = null, cacheKey = null, cacheAt = 0;

  /* Textos del carrusel: se generan desde lang/*.json con «node lang/build.js». */
  /* LANG:BEGIN (generado por lang/build.js, no editar a mano) */
  var T = {
    "en": {"watch":"Watch now","info":"More info","series":"Series","prev":"Previous","next":"Next","go":"Go to","season_one":"season","season_other":"seasons"},
    "ar": {"watch":"شاهد الآن","info":"المزيد من المعلومات","series":"مسلسل","prev":"السابق","next":"التالي","go":"اذهب إلى","season_one":"موسم","season_two":"موسمان","season_few":"مواسم","season_many":"موسمًا","season_other":"موسم"},
    "ca": {"watch":"Mira-ho ara","info":"Més informació","series":"Sèrie","prev":"Anterior","next":"Següent","go":"Ves a","season_one":"temporada","season_other":"temporades"},
    "cs": {"watch":"Přehrát","info":"Více info","series":"Seriál","prev":"Předchozí","next":"Další","go":"Přejít na","season_one":"sezóna","season_few":"sezóny","season_many":"sezóny","season_other":"sezón"},
    "da": {"watch":"Se nu","info":"Mere info","series":"Serie","prev":"Forrige","next":"Næste","go":"Gå til","season_one":"sæson","season_other":"sæsoner"},
    "de": {"watch":"Jetzt ansehen","info":"Mehr Infos","series":"Serie","prev":"Zurück","next":"Weiter","go":"Gehe zu","season_one":"Staffel","season_other":"Staffeln"},
    "el": {"watch":"Δες τώρα","info":"Περισσότερα","series":"Σειρά","prev":"Προηγούμενο","next":"Επόμενο","go":"Μετάβαση σε","season_one":"σεζόν","season_other":"σεζόν"},
    "es": {"watch":"Ver ahora","info":"Más info","series":"Serie","prev":"Anterior","next":"Siguiente","go":"Ir a","season_one":"temporada","season_other":"temporadas"},
    "fi": {"watch":"Katso nyt","info":"Lisätietoja","series":"Sarja","prev":"Edellinen","next":"Seuraava","go":"Siirry","season_one":"kausi","season_other":"kautta"},
    "fr": {"watch":"Regarder","info":"Plus d'infos","series":"Série","prev":"Précédent","next":"Suivant","go":"Aller à","season_one":"saison","season_other":"saisons"},
    "hu": {"watch":"Megnézem","info":"További infó","series":"Sorozat","prev":"Előző","next":"Következő","go":"Ugrás ide","season_one":"évad","season_other":"évad"},
    "it": {"watch":"Guarda ora","info":"Maggiori info","series":"Serie","prev":"Precedente","next":"Successivo","go":"Vai a","season_one":"stagione","season_other":"stagioni"},
    "ja": {"watch":"今すぐ見る","info":"詳細","series":"シリーズ","prev":"前へ","next":"次へ","go":"移動","season_other":"シーズン"},
    "ko": {"watch":"지금 보기","info":"상세 정보","series":"시리즈","prev":"이전","next":"다음","go":"이동","season_other":"시즌"},
    "nb": {"watch":"Se nå","info":"Mer info","series":"Serie","prev":"Forrige","next":"Neste","go":"Gå til","season_one":"sesong","season_other":"sesonger"},
    "nl": {"watch":"Nu kijken","info":"Meer info","series":"Serie","prev":"Vorige","next":"Volgende","go":"Ga naar","season_one":"seizoen","season_other":"seizoenen"},
    "pl": {"watch":"Oglądaj","info":"Więcej info","series":"Serial","prev":"Poprzedni","next":"Następny","go":"Przejdź do","season_one":"sezon","season_few":"sezony","season_many":"sezonów","season_other":"sezonu"},
    "pt-br": {"watch":"Assistir agora","info":"Mais info","series":"Série","prev":"Anterior","next":"Próximo","go":"Ir para","season_one":"temporada","season_other":"temporadas"},
    "pt": {"watch":"Ver agora","info":"Mais info","series":"Série","prev":"Anterior","next":"Seguinte","go":"Ir para","season_one":"temporada","season_other":"temporadas"},
    "ro": {"watch":"Vizionează","info":"Mai multe info","series":"Serial","prev":"Anterior","next":"Următorul","go":"Mergi la","season_one":"sezon","season_few":"sezoane","season_other":"de sezoane"},
    "ru": {"watch":"Смотреть","info":"Подробнее","series":"Сериал","prev":"Назад","next":"Вперёд","go":"Перейти к","season_one":"сезон","season_few":"сезона","season_many":"сезонов","season_other":"сезона"},
    "sv": {"watch":"Titta nu","info":"Mer info","series":"Serie","prev":"Föregående","next":"Nästa","go":"Gå till","season_one":"säsong","season_other":"säsonger"},
    "tr": {"watch":"Şimdi izle","info":"Daha fazla bilgi","series":"Dizi","prev":"Önceki","next":"Sonraki","go":"Git","season_one":"sezon","season_other":"sezon"},
    "uk": {"watch":"Дивитися","info":"Докладніше","series":"Серіал","prev":"Назад","next":"Далі","go":"Перейти до","season_one":"сезон","season_few":"сезони","season_many":"сезонів","season_other":"сезону"},
    "zh-cn": {"watch":"立即观看","info":"更多信息","series":"剧集","prev":"上一个","next":"下一个","go":"前往","season_other":"季"},
    "zh-tw": {"watch":"立即觀看","info":"更多資訊","series":"影集","prev":"上一個","next":"下一個","go":"前往","season_other":"季"}
  };
  /* LANG:END */
  var ALIAS = { 'zh-hk': 'zh-tw', 'zh-mo': 'zh-tw', 'zh-sg': 'zh-cn', nn: 'nb', no: 'nb' };
  function conIngles(k) {
    var r = {};
    Object.keys(T.en).forEach(function (x) { r[x] = T.en[x]; });
    Object.keys(T[k]).forEach(function (x) { r[x] = T[k][x]; });
    r.code = k;
    return r;
  }
  function idioma(c) {
    var cand = [c && c.lang];
    try { var uid = window.ApiClient && window.ApiClient.getCurrentUserId && window.ApiClient.getCurrentUserId(); if (uid) cand.push(localStorage.getItem(uid + '-language')); } catch (e) {}
    cand.push(document.documentElement.lang, navigator.language);
    for (var n = 0; n < cand.length; n++) {
      var full = String(cand[n] || '').toLowerCase().replace('_', '-'), base = full.split('-')[0];
      var k = [full, ALIAS[full], base, ALIAS[base]].filter(function (x) { return x && T[x]; })[0];
      if (k) return conIngles(k);
    }
    return conIngles('en');
  }
  function temporadas(L, n) {
    var cat = 'other';
    try { cat = new Intl.PluralRules(L.code).select(n); } catch (e) {}
    return n + ' ' + (L['season_' + cat] || L.season_other);
  }

  function cfg() {
    var c = {}, st = getComputedStyle(document.documentElement), ext = window.NebulaHero || {};
    Object.keys(DEF).forEach(function (k) {
      var v = ext[k] != null ? String(ext[k]) : st.getPropertyValue('--nb-hero-' + k).trim().replace(/^["']|["']$/g, '');
      if (v === '') { c[k] = DEF[k]; return; }
      c[k] = typeof DEF[k] === 'number' ? (parseFloat(v) || 0) : v;
    });
    return c;
  }

  function api() { return window.ApiClient; }
  function enHome() { if (/[?&]tab=[1-9]/.test(location.hash)) return false; return /^#\/home(\.html)?(\?|$)/.test(location.hash) || location.hash === '' || location.hash === '#/'; }

  function img(id, tipo, extra) {
    return api().getUrl('Items/' + id + '/Images/' + tipo + (extra || ''), { quality: 90, maxWidth: tipo === 'Logo' ? 700 : 1920 });
  }

  function bibliotecas(c, uid) {
    if (!c.library) return Promise.resolve([null]);
    var want = c.library.split(',').map(function (x) { return x.trim().toLowerCase(); });
    return api().getJSON(api().getUrl('Users/' + uid + '/Views')).then(function (r) {
      var ids = (r.Items || []).filter(function (v) { return want.indexOf((v.Name || '').toLowerCase()) >= 0; }).map(function (v) { return v.Id; });
      if (!ids.length) console.warn('[NebulaHero] no encuentro la biblioteca', c.library);
      return ids.length ? ids : [null];
    });
  }

  // nota para «toprated»: media de público y crítica; sin nota de crítica (títulos con pocos votos) penaliza
  function nota(i) { var p = i.CommunityRating || 0; return i.CriticRating ? (p + i.CriticRating / 10) / 2 : p - 2; }

  function cargar(c) {
    var a = api(), uid = a.getCurrentUserId(), key = uid + JSON.stringify(c);
    if (cache && cacheKey === key && Date.now() - cacheAt < 10 * 60 * 1000) return Promise.resolve(cache);
    var orden = { recent: 'DateCreated', toprated: 'CommunityRating', random: 'Random', favorites: 'Random' }[c.source] || 'DateCreated';
    return bibliotecas(c, uid).then(function (libs) {
      return Promise.all(libs.map(function (lib) {
        var q = {
          Recursive: true, IncludeItemTypes: c.types, ImageTypes: c.logo ? 'Backdrop,Logo' : 'Backdrop',
          Fields: 'Overview,Genres,ProductionYear,CommunityRating,OfficialRating,RunTimeTicks,ChildCount,ImageTags,BackdropImageTags,UserData',
          HasOverview: true, Limit: c.source === 'toprated' ? 150 : 40, SortBy: orden, SortOrder: 'Descending'
        };
        if (c.unwatched) q.IsPlayed = false;
        if (c.source === 'favorites') q.IsFavorite = true;
        if (c.source === 'recent' && c.days > 0) q.MinDateLastSaved = new Date(Date.now() - c.days * 864e5).toISOString();
        if (lib) q.ParentId = lib;
        return a.getJSON(a.getUrl('Users/' + uid + '/Items', q)).then(function (r) { return r.Items || []; });
      }));
    }).then(function (listas) {
      var items = [].concat.apply([], listas).filter(function (i) {
        return i.BackdropImageTags && i.BackdropImageTags.length && (!c.logo || (i.ImageTags && i.ImageTags.Logo));
      });
      // recent: mezcla priorizando nota alta; toprated: por nota; random/favorites: al azar
      if (c.source === 'toprated') items.sort(function (x, y) { return nota(y) - nota(x); });
      else if (c.source === 'recent') items.sort(function (x, y) { return (y.CommunityRating || 0) - (x.CommunityRating || 0) + (Math.random() - .5) * 3; });
      else items.sort(function () { return Math.random() - .5; });
      cache = items.slice(0, Math.max(1, c.count)); cacheKey = key; cacheAt = Date.now();
      return cache;
    });
  }

  function dur(t) { if (!t) return ''; var m = Math.round(t / 6e8); return m >= 60 ? Math.floor(m / 60) + ' h ' + (m % 60) + ' min' : m + ' min'; }
  function esc(s) { return String(s || '').replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function construir(items, c) {
    var sid = api().serverId(), L = idioma(c);
    var el = document.createElement('section');
    el.className = 'nbHero';
    el.innerHTML =
      '<div class="nbHero-slides">' + items.map(function (i, n) {
        var meta = [i.ProductionYear, i.Type === 'Series' ? (i.ChildCount ? temporadas(L, i.ChildCount) : L.series) : dur(i.RunTimeTicks), i.OfficialRating]
          .filter(Boolean).map(function (x) { return '<span>' + esc(x) + '</span>'; }).join('');
        if (c.rating && i.CommunityRating) meta += '<span class="nbHero-star">★ ' + i.CommunityRating.toFixed(1) + '</span>';
        var gen = (c.genres ? i.Genres || [] : []).slice(0, 3).map(function (g) { return '<span class="nbHero-chip">' + esc(g) + '</span>'; }).join('');
        var url = '#/details?id=' + i.Id + '&serverId=' + sid;
        return '<article class="nbHero-slide' + (n === 0 ? ' is-active' : '') + '" data-i="' + n + '">' +
          '<div class="nbHero-bg" style="background-image:url(\'' + img(i.Id, 'Backdrop', '/0') + '\')"></div>' +
          '<div class="nbHero-shade"></div>' +
          '<div class="nbHero-body">' +
            (i.ImageTags && i.ImageTags.Logo ? '<img class="nbHero-logo" alt="' + esc(i.Name) + '" src="' + img(i.Id, 'Logo') + '">' : '<h2 class="nbHero-title">' + esc(i.Name) + '</h2>') +
            '<div class="nbHero-meta">' + meta + '</div>' +
            '<div class="nbHero-genres">' + gen + '</div>' +
            (c.overview ? '<p class="nbHero-overview">' + esc(i.Overview) + '</p>' : '') +
            (!c.buttons ? '' : '<div class="nbHero-actions">' +
              '<a class="nbHero-btn nbHero-btn--main" data-play="' + i.Id + '" href="' + url + '"><span class="material-icons">play_arrow</span>' + L.watch + '</a>' +
              '<a class="nbHero-btn" href="' + url + '"><span class="material-icons">info_outline</span>' + L.info + '</a>' +
            '</div>') +
          '</div></article>';
      }).join('') + '</div>' +
      '<button class="nbHero-nav nbHero-prev" aria-label="' + L.prev + '"><span class="material-icons">chevron_left</span></button>' +
      '<button class="nbHero-nav nbHero-next" aria-label="' + L.next + '"><span class="material-icons">chevron_right</span></button>' +
      '<div class="nbHero-dots">' + items.map(function (_, n) { return '<button class="nbHero-dot' + (n === 0 ? ' is-active' : '') + '" data-i="' + n + '" aria-label="' + L.go + ' ' + (n + 1) + '"><i></i></button>'; }).join('') + '</div>';

    var actual = 0, timer = null, slides = el.querySelectorAll('.nbHero-slide'), dots = el.querySelectorAll('.nbHero-dot');
    function ir(n) {
      n = (n + slides.length) % slides.length;
      slides[actual].classList.remove('is-active'); dots[actual].classList.remove('is-active');
      actual = n;
      slides[actual].classList.add('is-active');
      dots[actual].classList.remove('is-active'); void dots[actual].offsetWidth; dots[actual].classList.add('is-active');
    }
    var INTERVALO = c.interval * 1000;
    if (!INTERVALO) el.classList.add('is-static');
    function play() { stop(); if (!INTERVALO) return; timer = setInterval(function () { if (!document.hidden && document.body.contains(el)) ir(actual + 1); else if (!document.body.contains(el)) stop(); }, INTERVALO); el.classList.remove('is-paused'); }
    function stop() { if (timer) clearInterval(timer); timer = null; }
    el.querySelector('.nbHero-prev').onclick = function () { ir(actual - 1); play(); };
    el.querySelector('.nbHero-next').onclick = function () { ir(actual + 1); play(); };
    dots.forEach(function (d) { d.onclick = function () { ir(+d.dataset.i); play(); }; });
    el.addEventListener('mouseenter', function () { stop(); el.classList.add('is-paused'); });
    el.addEventListener('mouseleave', play);
    var x0 = null;
    el.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    el.addEventListener('touchend', function (e) { if (x0 === null) return; var dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 50) { ir(actual + (dx < 0 ? 1 : -1)); play(); } x0 = null; });
    if (c.play) el.querySelectorAll('[data-play]').forEach(function (b) { b.addEventListener('click', function () { try { sessionStorage.setItem('nbAutoplay', b.dataset.play); } catch (e) {} }); });
    el.style.setProperty('--nb-int', INTERVALO + 'ms');
    play();
    return el;
  }

  var montando = false;
  function montar() {
    if (!enHome() || !api() || !api().getCurrentUserId || !api().getCurrentUserId()) return;
    var page = document.querySelector('.homePage:not(.hide)');
    var cont = page && page.querySelector('.homeSectionsContainer');
    if (!cont || page.querySelector('.nbHero') || montando) return;
    var c = cfg();
    if (c.count <= 0) return;
    montando = true;
    cargar(c).then(function (items) {
      montando = false;
      if (!items.length || page.querySelector('.nbHero')) return;
      cont.parentNode.insertBefore(construir(items, c), cont);
    }).catch(function (e) { montando = false; console.warn('[NebulaHero]', e); });
  }

  // «Ver ahora»: al llegar a la ficha pulsa su botón de reproducir una sola vez
  function autoplay() {
    var id; try { id = sessionStorage.getItem('nbAutoplay'); } catch (e) { return; }
    if (!id || location.hash.indexOf('id=' + id) < 0) return;
    var b = document.querySelector('.itemDetailPage:not(.hide) .mainDetailButtons .btnPlay:not(.hide)');
    if (!b) return;
    try { sessionStorage.removeItem('nbAutoplay'); } catch (e) {}
    setTimeout(function () { b.click(); }, 350);
  }

  // El panel de administración de la 12.x no aplica el CSS personalizado: se lo ponemos nosotros
  var cssPedido = false;
  function cssPanel() {
    if (!/^#\/dashboard|^#\/(users|libraries|plugins|tasks|devices|activity|logs|playback|networking|branding|apikeys|livetv\/)/i.test(location.hash.replace('#!', '#'))) return;
    if (cssPedido || document.getElementById('nbPanelCss')) return;
    var hay = Array.prototype.some.call(document.querySelectorAll('style'), function (s) { return s.id !== 'nbPanelCss' && s.textContent.indexOf('Nebula') >= 0; });
    if (hay) return;
    cssPedido = true;
    fetch(api().getUrl('Branding/Css')).then(function (r) { return r.text(); }).then(function (t) {
      var st = document.createElement('style'); st.id = 'nbPanelCss'; st.textContent = t; document.head.appendChild(st);
    }).catch(function () { cssPedido = false; });
  }

  // Red de seguridad: Jellyfin cierra menús y diálogos al terminar su animación de salida («animationend»).
  // Si esa animación no llega a terminar (movimiento reducido, ahorro de energía, otro CSS…), el menú
  // se quedaba abierto tapando todo. Si medio segundo después de empezar a cerrarse sigue ahí, lo rematamos.
  document.addEventListener('closing', function (e) {
    var d = e.target;
    if (!d || !d.classList || !d.classList.contains('dialog')) return;
    setTimeout(function () {
      if (d.isConnected && !d.classList.contains('hide')) d.dispatchEvent(new Event('animationend'));
    }, 500);
  }, true);

  // Fallo de Jellyfin 12: los menús nuevos (MUI: «Más», usuario, panel…) no se cierran con el botón Atrás.
  // Al navegar se cambiaba de página pero el menú seguía montado con una capa invisible que bloqueaba todos
  // los toques (muy típico con el Atrás de Android). Al cambiar de página, los cerramos como si se tocara fuera.
  function cerrarMenusMui() {
    Array.prototype.forEach.call(document.querySelectorAll('.MuiModal-root:not(.MuiModal-hidden)'), function (m) {
      var b = m.querySelector('.MuiBackdrop-root');
      if (!b) return;
      ['mousedown', 'mouseup', 'click'].forEach(function (t) { b.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true })); });
    });
  }
  window.addEventListener('popstate', function () { setTimeout(cerrarMenusMui, 0); });
  window.addEventListener('hashchange', function () { setTimeout(cerrarMenusMui, 0); });

  var pend = false;
  new MutationObserver(function () {
    if (pend) return; pend = true;
    // en segundo plano no hay fotogramas (rAF congelado): usamos un temporizador
    (document.hidden ? function (f) { setTimeout(f, 50); } : requestAnimationFrame)(function () { pend = false; cssPanel(); if (enHome()) montar(); else autoplay(); });
  }).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('hashchange', function () { cssPanel(); montar(); });
})();
