#!/bin/bash
# Nebula — pone el carrusel en Jellyfin y/o Emby (y, opcionalmente, el tema en «CSS personalizado»).
# Busca solo TODOS los Jellyfin y Emby del equipo: en contenedores Docker o instalados directamente en el sistema.
# Idempotente: ejecutarlo de nuevo no duplica nada. Lo normal es usar install/nebula.sh, que llama a este.
#
# Uso:  inject-docker.sh [contenedor | auto | host] [--cron | --watch | --uninstall]
#   auto (por defecto)  todos los Jellyfin/Emby que encuentre (Docker y sistema)
#   <contenedor>        solo ese contenedor de Docker
#   host                solo la instalación directa en el sistema (sin Docker)
#   --watch             se queda vigilando en bucle (lo usa el contenedor «nebula»)
#   --cron              además lo programa cada 10 min en el crontab
#   --uninstall         quita el carrusel (el CSS personalizado no se toca)
# Variables opcionales:
#   JELLYFIN_API_KEY / EMBY_API_KEY  clave de API: pone el tema en «CSS personalizado» si aún no lo tiene
#                     (nunca borra lo que haya). Con los dos servidores, cada uno usa la suya.
#   NEBULA_OPTIONS    opciones separadas por coma, p. ej. "cabecera-minima,acento-coral" (solo Jellyfin)
#   INTERVAL          segundos entre comprobaciones con --watch (por defecto 600)
#   SERVER_PORT       puerto interno si no es el habitual (se detecta solo: 8096, 8097, 8920)
#   WEB               carpeta web si no está en el sitio habitual
set -u
ARG="${1:-${JELLYFIN_CONTAINER:-${EMBY_CONTAINER:-auto}}}"; MODO="${2:-}"
case "$ARG" in --*) MODO="$ARG"; ARG="${JELLYFIN_CONTAINER:-${EMBY_CONTAINER:-auto}}" ;; esac
CDN="https://cdn.jsdelivr.net/gh/nemesbak/jellyfin-nebula@main"
REPO="https://raw.githubusercontent.com/nemesbak/jellyfin-nebula/main"
DIR="${NEBULA_DIR:-$HOME/.nebula-jellyfin}"
WEBS="/jellyfin/jellyfin-web /usr/share/jellyfin/web /usr/lib/jellyfin/bin/jellyfin-web /app/emby/system/dashboard-ui /app/emby/dashboard-ui /opt/emby-server/system/dashboard-ui /system/dashboard-ui /usr/lib/emby-server/system/dashboard-ui /var/lib/emby/dashboard-ui"
HAY_DOCKER=0; command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1 && HAY_DOCKER=1

# --- acceso al destino: T = nombre del contenedor, o «host» para el propio sistema ---
x()    { if [ "$T" = host ]; then "$@"; else docker exec "$T" "$@"; fi; }
xi()   { if [ "$T" = host ]; then "$@"; else docker exec -i "$T" "$@"; fi; }
# copia el CONTENIDO de la carpeta $1 en la carpeta $2 del destino
meter() { x mkdir -p "$2" && if [ "$T" = host ]; then cp -R "$1/." "$2/" && chmod -R a+rX "$2"; else docker cp "$1/." "$T:$2/" >/dev/null; fi; }
nombre() { if [ "$T" = host ]; then echo "este equipo"; else echo "el contenedor «$T»"; fi; }

# ¿Jellyfin o Emby? Se mira qué carpeta web tiene
detectar() {
  local d; WEB=""
  for d in ${NEBULA_WEB:-} $WEBS; do
    if x test -f "$d/index.html" >/dev/null 2>&1; then WEB="$d"; break; fi
  done
  [ -n "$WEB" ] || return 1
  case "$WEB" in
    *dashboard-ui*) SERVIDOR=emby;     JS_SRC="emby/nebula-emby-home.js"; CSS_SRC="emby/nebula-emby.css"; PRE="/emby"; KEY="${EMBY_API_KEY:-${JELLYFIN_API_KEY:-}}" ;;
    *)              SERVIDOR=jellyfin; JS_SRC="nebula-home.js";           CSS_SRC="nebula.css";            PRE="";      KEY="${JELLYFIN_API_KEY:-${EMBY_API_KEY:-}}" ;;
  esac
  [ -n "${JELLYFIN_API_KEY:-}" ] && [ -n "${EMBY_API_KEY:-}" ] && { [ $SERVIDOR = emby ] && KEY="$EMBY_API_KEY" || KEY="$JELLYFIN_API_KEY"; }
  return 0
}

# Descarga un archivo del repo en $TMP, con la misma ruta
bajar() { mkdir -p "$TMP/$(dirname "$1")" && curl -fsSL "$REPO/$1" -o "$TMP/$1"; }

# Todo va a la carpeta «nebula» de la web, con la misma estructura que el repo:
#   nebula/nebula-home.js (o nebula/emby/nebula-emby-home.js) + nebula/localization/ (idiomas)
carrusel() {
  local TMP V c j
  [ -n "$WEB" ] || return 1
  for j in aurora-home.js nebula-home.js nebula-emby-home.js; do   # versiones anteriores, sueltas en la raíz de la web
    if x grep -q "src=\"$j?v=" "$WEB/index.html" 2>/dev/null; then
      x sed -i "s#<script defer src=\"$j?v=[^\"]*\"></script>##" "$WEB/index.html"; x rm -f "$WEB/$j"
    fi
  done
  TMP="$(mktemp -d)"
  if ! { bajar "$JS_SRC" && bajar localization/nebula-i18n.js && bajar localization/languages.json; }; then
    echo "  ✗ No se pudo descargar el carrusel (¿hay internet?)"; rm -rf "$TMP"; return 1
  fi
  for c in $(grep -o '"[A-Za-z-]*"[[:space:]]*:' "$TMP/localization/languages.json" | sed 's/[":[:space:]]//g'); do
    bajar "localization/$c.json" || echo "  · Falta el idioma «$c»"
  done
  chmod -R a+rX "$TMP"
  V=$(cd "$TMP" && find . -type f | LC_ALL=C sort | xargs cat | md5sum | cut -c1-8)   # cambia si cambia cualquier archivo
  if ! x test -f "$WEB/nebula/$JS_SRC" || ! x grep -q "nebula/$JS_SRC?v=$V" "$WEB/index.html"; then
    x rm -rf "$WEB/nebula"
    meter "$TMP" "$WEB/nebula" && echo "  ✓ Carrusel e idiomas copiados"
    x sed -i -e "s#<script defer src=\"nebula/$JS_SRC?v=[^\"]*\"></script>##" \
      -e "s#</body>#<script defer src=\"nebula/$JS_SRC?v=$V\"></script></body>#" "$WEB/index.html" && echo "  ✓ Carrusel enganchado"
  fi
  rm -rf "$TMP"
}

# Puerto interno: con red «host» el 8096 puede ser OTRO servidor (p. ej. Jellyfin junto a Emby)
puerto() {
  local p info
  for p in ${SERVER_PORT:-} 8096 8097 8920; do
    info=$(x curl -fs -m 4 "http://localhost:$p/System/Info/Public" 2>/dev/null) || continue
    if [ "$SERVIDOR" = jellyfin ]; then printf '%s' "$info" | grep -q '"ProductName":"Jellyfin' && { echo "$p"; return; }
    else printf '%s' "$info" | grep -q 'Jellyfin' || { echo "$p"; return; }; fi
  done
}

tema_css() {
  [ -n "$KEY" ] || return 0
  local P H U B IMP o NB NL='\n'
  P=$(puerto); [ -n "$P" ] || { echo "  · No encuentro el puerto de $SERVIDOR (usa SERVER_PORT=)"; return 0; }
  H="Authorization: MediaBrowser Token=\"$KEY\""
  U="http://localhost:$P$PRE/System/Configuration/branding"
  B=$(x curl -fs -H "$H" -H "X-Emby-Token: $KEY" "$U") || { echo "  · No pude leer la configuración (¿clave de API correcta?)"; return 0; }
  printf '%s' "$B" | grep -qiE 'nebula|aurora' && return 0     # ya tiene el tema: no se toca
  IMP="@import url('$CDN/$CSS_SRC');"
  if [ "$SERVIDOR" = jellyfin ]; then
    for o in $(printf '%s' "${NEBULA_OPTIONS:-}" | tr ',' ' '); do IMP="$IMP$NL@import url('$CDN/opciones/${o%.css}.css');"; done
  fi
  NB=$(printf '%s' "$B" | sed 's#"CustomCss":null#"CustomCss":""#' | \
       IMP="$IMP$NL" awk '{ i = index($0, "\"CustomCss\":\""); if (i) $0 = substr($0, 1, i + 12) ENVIRON["IMP"] substr($0, i + 13); print }')
  printf '%s' "$NB" | xi curl -fs -o /dev/null -X POST -H "$H" -H "X-Emby-Token: $KEY" -H 'Content-Type: application/json' \
    --data-binary @- "$U" && echo "  ✓ Tema puesto en «CSS personalizado»"
}

quitar() {
  local j
  for j in nebula/nebula-home.js nebula/emby/nebula-emby-home.js nebula-home.js nebula-emby-home.js aurora-home.js; do
    x sed -i "s#<script defer src=\"$j?v=[^\"]*\"></script>##" "$WEB/index.html"
  done
  x rm -rf "$WEB/nebula" "$WEB/nebula-home.js" "$WEB/nebula-emby-home.js" "$WEB/aurora-home.js"
  echo "  ✓ Carrusel quitado de $SERVIDOR ($(nombre))"
}

# Lista de destinos: contenedores en marcha con Jellyfin/Emby dentro + el propio sistema si lo tiene instalado
destinos() {
  case "$ARG" in
    host) echo host ;;
    auto)
      if [ "$HAY_DOCKER" = 1 ]; then
        docker ps --format '{{.Names}}' | while read -r c; do
          [ "$c" = nebula ] && continue
          T="$c"; detectar >/dev/null 2>&1 && echo "$c"
        done
      fi
      if [ ! -f /.dockerenv ]; then T=host; detectar >/dev/null 2>&1 && echo host; fi ;;
    *) echo "$ARG" ;;
  esac
}

una_pasada() {
  local n=0
  for T in $(destinos); do
    if [ "$T" != host ] && ! docker inspect -f '{{.State.Running}}' "$T" 2>/dev/null | grep -q true; then
      echo "El contenedor «$T» no está en marcha"; continue
    fi
    detectar || { echo "No encuentro Jellyfin ni Emby en $(nombre) (usa NEBULA_WEB=/ruta/a/la/web)"; continue; }
    n=$((n + 1))
    if [ "$MODO" = "--uninstall" ]; then quitar; continue; fi
    echo "▶ $SERVIDOR en $(nombre)"
    carrusel; tema_css
  done
  [ "$n" -gt 0 ] || echo "No he encontrado ningún Jellyfin ni Emby en este equipo."
  [ "$n" -gt 0 ]
}

if [ "$MODO" = "--watch" ]; then
  echo "Nebula vigilando cada ${INTERVAL:-600}s ($ARG)"
  while :; do una_pasada >/dev/null 2>&1 || true; sleep "${INTERVAL:-600}"; done
fi

una_pasada; OK=$?

if [ "$MODO" = "--uninstall" ]; then
  crontab -l 2>/dev/null | grep -vE "nebula-jellyfin|aurora-glass" | crontab - 2>/dev/null
  rm -f /etc/cron.d/nebula 2>/dev/null
  echo "Listo. Recarga la web con Ctrl+F5 (el CSS personalizado quítalo a mano si quieres)."; exit 0
fi

if [ "$MODO" = "--cron" ] && [ $OK = 0 ]; then
  mkdir -p "$DIR" && curl -fsSL "$REPO/install/inject-docker.sh" -o "$DIR/inject-docker.sh" && chmod +x "$DIR/inject-docker.sh"
  LINEA="*/10 * * * * $DIR/inject-docker.sh $ARG >/dev/null 2>&1 # nebula-jellyfin $ARG"
  ( crontab -l 2>/dev/null | grep -v "nebula-jellyfin" | grep -v "aurora-glass"; echo "$LINEA" ) | crontab - && echo "Programado cada 10 min"
fi
[ $OK = 0 ] && echo "Listo. Recarga la web con Ctrl+F5."
exit $OK
