# Idiomas · [English](README.md)

Textos del carrusel de la portada («Ver ahora», «Más info», «2 temporadas»…), un archivo JSON por idioma.
Un pequeño script los une dentro de `nebula-home.js` y `emby/nebula-emby-home.js`, así que el usuario sigue descargando un único archivo.

## Cómo se elige el idioma

En este orden; gana el primero que exista:

1. `--nb-hero-lang` en el CSS personalizado (o `window.NebulaHero.lang`).
2. El idioma que el usuario eligió en Jellyfin.
3. El idioma de la página y después el del navegador.
4. **Inglés** (`en`) si no hay ninguno disponible.

En cada paso se prueba primero el código completo (`pt-BR`) y luego el idioma base (`pt`). Hay algunos alias (`zh-HK` → `zh-TW`, `nn` → `nb`).
Un archivo de idioma puede ser **parcial**: las claves que falten se toman del inglés.

## Formato

Nombre del archivo = código del idioma como lo usa Jellyfin (`it.json`, `pt-BR.json`, `zh-CN.json`, `nb.json`…).

```json
{
  "watch": "Ver ahora",
  "info": "Más info",
  "series": "Serie",
  "prev": "Anterior",
  "next": "Siguiente",
  "go": "Ir a",
  "season_one": "temporada",
  "season_other": "temporadas"
}
```

| Clave | Dónde aparece |
|---|---|
| `watch`, `info` | Los dos botones |
| `series` | Se muestra en lugar del número de temporadas cuando no se conoce |
| `prev`, `next` | Botones de flecha (lectores de pantalla) |
| `go` | Puntos bajo el carrusel, «Ir a 3» (lectores de pantalla) |
| `tags`, `links`, `watched`, `no_favs` | Textos que usa la hoja de estilos: etiquetas «Etiquetas» y «Enlaces» de la ficha, la marca «✓ Visto» de los episodios y el mensaje de favoritos vacíos (`\n` separa las dos líneas) |
| `season_<categoría>` | Palabra tras el número: «**3** temporadas». El número lo pone el código |

### Plurales

`season_*` sigue las [categorías de plural de CLDR](https://www.unicode.org/cldr/charts/latest/supplemental/language_plural_rules.html): `zero`, `one`, `two`, `few`, `many`, `other`.
Pon siempre `season_other`; añade las demás solo si tu idioma las necesita (español e inglés: `one` + `other`; ruso: `one`, `few`, `many`, `other`; japonés: solo `other`).

## Añadir o corregir un idioma

1. Copia `en.json` a `<código>.json` y traduce los valores (sin tocar las claves).
2. Desde la raíz del repositorio ejecuta:

   ```
   node lang/build.js
   ```

   Reescribe el bloque entre `LANG:BEGIN` y `LANG:END` en los dos scripts. No edites ese bloque a mano.
3. Abre un pull request con el JSON y los dos scripts regenerados.

Mantén los textos cortos: tienen que caber en los botones.
