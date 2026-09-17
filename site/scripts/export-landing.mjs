import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const contentPath = path.join(root, 'content/landing.json');
const outputPath = path.join(root, 'content/landing.md');
const content = JSON.parse(await readFile(contentPath, 'utf8'));
const lines = [
  '# Текст главной страницы',
  '',
  'Источник для сайта — `landing.json`. Этот файл автоматически собирается из него для чтения и обсуждения.',
  '',
  `Версия текста: ${content.meta.copyVersion}`,
  '',
  content.meta.conceptStatus,
  content.meta.edition,
  '',
  '## Навигация',
  '',
  content.nav.map(item => `[${item.label}](#${item.id})`).join(' · '),
  '',
  `## 00. ${content.hero.title} {#hero}`,
  '',
  content.hero.lead,
  '',
  content.hero.body,
  '',
  content.hero.actions.map(item => `[${item.label}](${item.href})`).join(' · '),
  '',
  `**${content.hero.routesLabel}** ${content.hero.routes.map(item => `[${item.label}](${item.href})`).join(' · ')}`,
  '',
  `*Подпись к визуалу:* ${content.hero.visualCaption}`,
];

for (const section of content.sections) {
  lines.push('', `## ${section.title} {#${section.id}}`, '', section.intro);
  for (const frame of section.frames) {
    lines.push('', `### ${frame.number}. ${frame.title} {#${frame.id}}`, '', frame.eyebrow, '');
    for (const paragraph of frame.paragraphs) lines.push(paragraph, '');
    if (frame.diagram) {
      const d = frame.diagram;
      lines.push(`**Схема «${d.id}».**`);
      for (const [label, value] of Object.entries(d)) {
        if (['id', 'type', 'caption', 'note'].includes(label)) continue;
        lines.push(`- ${label}: ${Array.isArray(value) ? value.map(item => typeof item === 'object' ? `${item.label}: ${item.value}` : item).join(' → ') : value}`);
      }
      lines.push('', `*Подпись:* ${d.caption}`);
      if (d.note) lines.push('', `*Уточнение:* ${d.note}`);
    }
    if (frame.more) lines.push('', `[${frame.more.label}](${frame.more.href})`);
    if (frame.materials) {
      for (const material of frame.materials) lines.push('', `[${material.label}](${material.href}) — ${material.description}.`);
    }
    if (frame.contactLabel) lines.push('', `**${frame.contactLabel}.** ${frame.contactHelp || ''}`);
  }
}
lines.push('', '---', '', content.meta.footerNote, '');
await writeFile(outputPath, lines.join('\n'));
console.log(`Текст для чтения обновлён: ${outputPath}`);
