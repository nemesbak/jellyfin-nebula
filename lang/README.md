# Languages · [Español](README.es.md)

Texts of the home carousel ("Watch now", "More info", "2 seasons"…), one JSON file per language.
They are merged into `nebula-home.js` and `emby/nebula-emby-home.js` by a small build script, so users still download a single file.

## How the language is chosen

In this order; the first one that exists wins:

1. `--nb-hero-lang` in the custom CSS (or `window.NebulaHero.lang`).
2. The language the user selected in Jellyfin.
3. The page language and then the browser language.
4. **English** (`en`) if none of them is available.

Each step tries the full code first (`pt-BR`), then the base language (`pt`). A few aliases exist (`zh-HK` → `zh-TW`, `nn` → `nb`).
A language file may be **partial**: any missing key falls back to English.

## File format

File name = language code as Jellyfin uses it (`it.json`, `pt-BR.json`, `zh-CN.json`, `nb.json`…).

```json
{
  "watch": "Watch now",
  "info": "More info",
  "series": "Series",
  "prev": "Previous",
  "next": "Next",
  "go": "Go to",
  "season_one": "season",
  "season_other": "seasons"
}
```

| Key | Where it appears |
|---|---|
| `watch`, `info` | The two buttons |
| `series` | Shown instead of the season count when it is unknown |
| `prev`, `next` | Arrow buttons (screen readers) |
| `go` | Dots under the carousel, "Go to 3" (screen readers) |
| `tags`, `links`, `watched`, `no_favs` | Texts used by the stylesheet: "Tags" and "Links" labels on the item page, the "✓ Watched" badge on episodes, and the empty-favourites message (`
` splits the two lines) |
| `season_<category>` | Word after the number: "**3** seasons". The number is added by the code |

### Plurals

`season_*` follows the [CLDR plural categories](https://www.unicode.org/cldr/charts/latest/supplemental/language_plural_rules.html): `zero`, `one`, `two`, `few`, `many`, `other`.
Always provide `season_other`; add the others only if your language needs them (English: `one` + `other`; Russian: `one`, `few`, `many`, `other`; Japanese: just `other`).

## Add or fix a language

1. Copy `en.json` to `<code>.json` and translate the values (keep the keys).
2. From the repository root run:

   ```
   node lang/build.js
   ```

   This rewrites the block between `LANG:BEGIN` and `LANG:END` in both scripts. Do not edit that block by hand.
3. Open a pull request with the JSON and the two regenerated scripts.

Keep the texts short: they have to fit on the buttons.
