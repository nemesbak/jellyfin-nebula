#!/usr/bin/env node
/* Une lang/*.json en el bloque «var T = {...}» de los dos scripts del carrusel.
   Uso (desde la raíz del repo):  node lang/build.js */
const fs = require('fs'), path = require('path');
const dir = __dirname, root = path.join(dir, '..');
const objetivos = ['nebula-home.js', 'emby/nebula-emby-home.js'];
const idiomas = fs.readdirSync(dir).filter(f => f.endsWith('.json'))
  .sort((a, b) => a === 'en.json' ? -1 : b === 'en.json' ? 1 : a.localeCompare(b));
const lineas = idiomas.map(f => {
  const cod = f.replace(/\.json$/, '').toLowerCase();
  const datos = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  return '    ' + JSON.stringify(cod) + ': ' + JSON.stringify(datos);
});
const bloque = '/* LANG:BEGIN (generado por lang/build.js, no editar a mano) */\n  var T = {\n' + lineas.join(',\n') + '\n  };\n  /* LANG:END */';
for (const rel of objetivos) {
  const p = path.join(root, rel);
  let s = fs.readFileSync(p, 'utf8');
  const crlf = s.includes('\r\n');
  if (crlf) s = s.replace(/\r\n/g, '\n');
  const re = /\/\* LANG:BEGIN[\s\S]*?\/\* LANG:END \*\//;
  if (!re.test(s)) { console.error('Faltan las marcas LANG:BEGIN/END en ' + rel); process.exit(1); }
  s = s.replace(re, () => bloque);
  fs.writeFileSync(p, crlf ? s.replace(/\n/g, '\r\n') : s);
  console.log('OK ' + rel + ' (' + idiomas.length + ' idiomas)');
}
