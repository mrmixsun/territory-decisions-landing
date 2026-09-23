import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const pageNames = ['index.html', 'concept.html'];
const files = new Set(await readdir(dist));
for (const file of pageNames) if (!files.has(file)) throw new Error(`Нет ${file}; сначала выполните npm run build`);
const pages = Object.fromEntries(await Promise.all(pageNames.map(async file => [file, await readFile(path.join(dist, file), 'utf8')])));
for (const [file, html] of Object.entries(pages)) {
  if ((html.match(/<h1\b/g) || []).length !== 1) throw new Error(`${file}: должна быть одна h1`);
  for (const target of ['style.css', 'tokens.css', 'main.js', 'favicon.svg']) if (!files.has(target)) throw new Error(`Нет ${target}`);
  for (const [, href] of html.matchAll(/href="([^"]+)"/g)) {
    if (/^(?:https:\/\/|mailto:|tel:)/.test(href)) continue;
    if (href.startsWith('#')) { if (!html.includes(`id="${href.slice(1)}"`)) throw new Error(`${file}: нет якоря ${href}`); continue; }
    const [localWithQuery, fragment] = href.replace(/^\.\//, '').split('#');
    const local = localWithQuery.split('?')[0];
    if (!local || local.endsWith('.css') || local.endsWith('.svg')) continue;
    if (!files.has(local)) throw new Error(`${file}: нет страницы ${local}`);
    if (fragment && !pages[local]?.includes(`id="${fragment}"`)) throw new Error(`${file}: нет якоря ${href}`);
  }
  for (const [, src] of html.matchAll(/(?:src|srcset)="([^"]+)"/g)) {
    const local = src.replace(/^\.\//, '').split('?')[0];
    await stat(path.join(dist, local));
  }
}
const concept = pages['concept.html'];
for (let n = 1; n <= 12; n++) if (!concept.includes(`id="m${n}"`)) throw new Error(`Нет раздела m${n}`);
console.log('Проверка пройдена: 2 страницы, ссылки, ресурсы и 12 разделов полного текста.');
