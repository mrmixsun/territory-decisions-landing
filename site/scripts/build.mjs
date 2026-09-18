import { readFile, writeFile, mkdir, cp, rm, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const siteDir = path.resolve(here, '..');
const prototypeDir = path.resolve(siteDir, '..');
const distDir = path.join(siteDir, 'dist');
const contentDir = path.join(prototypeDir, 'content');
const designDir = path.join(prototypeDir, 'design');
const assetsDir = path.join(designDir, 'assets');

const content = JSON.parse(await readFile(path.join(contentDir, 'landing.json'), 'utf8'));
const tokens = JSON.parse(await readFile(path.join(designDir, 'tokens.json'), 'utf8'));
const fullText = await readFile(path.join(contentDir, 'full-text.md'), 'utf8');
const assetNames = new Set(await readdir(assetsDir));

const esc = (value = '') => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const safeHref = (href = '') => /^(?:#|(?:\.\/)?(?:index|concept)\.html(?:#|$))/.test(href) ? href : '#';
const safeContentHref = (href = '') => /^https:\/\//i.test(href) ? href : safeHref(href);
const e = (value = '') => esc(value);
const para = (items = []) => items.map(item => `<p>${e(item)}</p>`).join('\n');
const list = (items = []) => `<ul>${items.map(item => `<li>${e(item)}</li>`).join('')}</ul>`;
const asset = (name) => `./assets/${name}`;

function picture(name, mobileName, alt, className = '') {
  if (!assetNames.has(name)) return '';
  const mobile = mobileName && assetNames.has(mobileName)
    ? `<source media="(max-width: 760px)" srcset="${asset(mobileName)}">` : '';
  return `<picture class="${className}">${mobile}<img src="${asset(name)}" alt="${e(alt)}" loading="lazy" decoding="async"></picture>`;
}

function documentLink(link, className = 'text-link') {
  if (!link) return '';
  return `<a class="${className}" href="${e(safeHref(link.href))}">${e(link.label)}</a>`;
}

function diagramFigure(frame, file, mobileFile, alt, extra = '') {
  const diagram = frame.diagram;
  return `<figure class="diagram ${extra}">
    <div class="diagram__image">${picture(file, mobileFile, alt)}</div>
    <figcaption>${e(diagram.caption)}${diagram.note ? `<br><span>${e(diagram.note)}</span>` : ''}</figcaption>
  </figure>`;
}

function frameTitle(frame) {
  return `<div class="frame-heading"><span class="eyebrow">${e(frame.eyebrow)}</span><h3>${e(frame.title)}</h3></div>`;
}

function frameCopy(frame) {
  return `<div class="section-copy">${para(frame.paragraphs)}${frame.more ? `<p class="frame-more">${documentLink(frame.more)}</p>` : ''}</div>`;
}

function frameTop(frame) {
  return `<article class="frame frame--${e(frame.diagram?.type || 'materials')}" id="${e(frame.id)}" data-figma-frame="${e(frame.number)}">
    <div class="frame-index">${e(frame.number)}</div>${frameTitle(frame)}`;
}

function renderProcess(frame) {
  const d = frame.diagram;
  return `${frameTop(frame)}
    <div class="frame-intro">${frameCopy(frame)}</div>
    <div class="comparison-intro"><div><h4>${e(d.beforeLabel)}</h4><p>После утверждения содержание переносят заново. Появляются копии, которые нужно сравнивать.</p></div><div><h4>${e(d.afterLabel)}</h4><p>Видно, какая версия прошла процедуры и каким актом она утверждена.</p></div></div>
    ${diagramFigure(frame, 'process-comparison.svg', 'process-comparison-mobile.svg', `${d.beforeLabel}: ${d.beforeSteps.join(' → ')}. ${d.afterLabel}: ${d.afterSteps.join(' → ')}.`, 'diagram--wide')}
  </article>`;
}

function renderTimeline(frame) {
  const d = frame.diagram;
  const items = d.steps.map((step, index) => `<li class="timeline-step ${index === 1 ? 'timeline-step--accent' : ''}"><span class="timeline-step__num">0${index + 1}</span><strong>${e(step)}</strong></li>`).join('');
  return `${frameTop(frame)}<div class="section-grid"><div>${frameCopy(frame)}</div><figure class="diagram diagram--html"><div class="diagram__image"><ol class="timeline-list">${items}</ol></div><figcaption>${e(d.caption)}${d.note ? `<br>${e(d.note)}` : ''}</figcaption></figure></div></article>`;
}

function renderLayers(frame) {
  const d = frame.diagram;
  const layers = d.layers.map((layer, index) => `<div class="layer-card"><span class="layer-card__num">0${index + 1}</span><strong>${e(layer)}</strong><span class="status-label">${index === 0 ? 'Подтверждено' : index === 1 ? 'Уже действует' : 'Пока проект'}</span></div>`).join('');
  return `${frameTop(frame)}<div class="section-grid"><div>${frameCopy(frame)}</div><figure class="diagram diagram--html"><div class="diagram__image"><div class="layer-stack">${layers}</div><div class="metadata-strip">${d.metadata.map(item => `<span>${e(item)}</span>`).join('')}</div></div><figcaption>${e(d.caption)}</figcaption></figure></div></article>`;
}

function renderReview(frame) {
  const d = frame.diagram;
  const facts = d.fields.map(row => `<div><dt>${e(row.label)}</dt><dd>${e(row.value)}</dd></div>`).join('');
  return `${frameTop(frame)}<div class="frame-intro">${frameCopy(frame)}</div>${diagramFigure(frame, 'planning-check.svg', 'planning-check-mobile.svg', `Условный проект планировки и замечание: ${d.fields.map(x => `${x.label} — ${x.value}`).join('; ')}.`, 'diagram--wide')}<div class="example-card"><div><span class="micro-heading">Что показывает проверка</span><dl class="example-facts">${facts}</dl></div><div class="example-card__note"><span class="status-label status-label--accent">Нужна проверка</span><p>Это сигнал для специалиста, а не автоматический отказ по проекту.</p></div></div></article>`;
}

function renderNetwork(frame) {
  const d = frame.diagram;
  return `${frameTop(frame)}<div class="frame-intro">${frameCopy(frame)}</div>${diagramFigure(frame, 'linked-change.svg', 'linked-change-mobile.svg', `${d.center}. Связанные вопросы: ${d.links.join(', ')}.`, 'diagram--wide')}<div class="linked-questions"><span class="micro-heading">Вопросы к изменению</span><ul class="questions">${d.questions.map(q => `<li>${e(q)}</li>`).join('')}</ul></div></article>`;
}

function renderStages(frame) {
  const d = frame.diagram;
  return `${frameTop(frame)}<div class="frame-intro">${frameCopy(frame)}</div><ol class="phase-list">${d.stages.map((stage, index) => `<li><strong>${e(stage)}</strong>${index === 0 ? '<p>Не терять связь между содержанием решения и актом.</p>' : index === 1 ? '<p>Добавлять нужные сведения по мере готовности.</p>' : '<p>Строить выводы на проверенных данных.</p>'}</li>`).join('')}</ol><div class="paired-lists"><div><h4>${e(d.measureLabel)}</h4>${list(d.measures)}</div><div><h4>${e(d.costsLabel)}</h4>${list(d.costs)}</div></div><p class="diagram-alt">${e(d.caption)}</p></article>`;
}

function renderSystems(frame) {
  const d = frame.diagram;
  return `${frameTop(frame)}<div class="section-grid"><div>${frameCopy(frame)}</div><figure class="diagram diagram--html"><div class="diagram__image"><div class="systems-grid">${d.systems.map((system, i) => `<div class="system-node"><span>0${i + 1}</span><strong>${e(system)}</strong></div>`).join('')}</div><div class="shared-rules"><span class="micro-heading">Общие правила обмена</span>${d.sharedRules.map(rule => `<span class="rule-chip">${e(rule)}</span>`).join('')}</div></div><figcaption>${e(d.caption)}</figcaption></figure></div></article>`;
}

function renderMaterials(frame) {
  const material = frame.materials?.[0];
  return `<article class="frame frame--materials" id="${e(frame.id)}" data-figma-frame="${e(frame.number)}"><div class="materials-panel"><div><span class="eyebrow">${e(frame.eyebrow)}</span><h3>${e(frame.title)}</h3>${para(frame.paragraphs)}${material ? `<a class="button-link" href="${e(safeHref(material.href))}">${e(material.label)} <span aria-hidden="true">↗</span></a><p class="material-description">${e(material.description)}</p>` : ''}</div><aside><strong>${e(frame.contactLabel)}</strong><p>${e(frame.contactHelp)}</p></aside></div></article>`;
}

function renderFrame(frame) {
  const renderers = { comparison: renderProcess, timeline: renderTimeline, layers: renderLayers, 'issue-card': renderReview, network: renderNetwork, stages: renderStages, systems: renderSystems };
  return (renderers[frame.diagram?.type] || renderMaterials)(frame);
}

function renderSection(section, index) {
  const tint = index % 2 ? 'section--surface' : 'section--paper';
  return `<section class="section ${tint}" id="${e(section.id)}" aria-labelledby="heading-${e(section.id)}" data-figma-section="${e(section.id)}"><div class="container"><div class="section-head"><span class="section-index">0${index + 1} / 06</span><span class="eyebrow">${e(section.navLabel)}</span><h2 id="heading-${e(section.id)}">${e(section.title)}</h2><p>${e(section.intro)}</p></div>${section.frames.map(renderFrame).join('\n')}</div></section>`;
}

function header(current = 'home') {
  const nav = content.nav.map(item => `<a href="${current === 'home' ? `#${e(item.id)}` : `./index.html#${e(item.id)}`}">${e(item.label)}</a>`).join('');
  const mark = content.meta.copyVersion?.startsWith('strict/s1.')
    ? '<span class="site-mark__monogram">ЦУ<span>РТ</span></span><span class="site-mark__wordmark">Цифровое управление<br>развитием территорий</span>'
    : '<span class="site-mark__symbol" aria-hidden="true">⌖</span><span>Территория и решения</span>';
  return `<header class="site-header"><div class="container header-inner"><a class="site-mark" href="./index.html" aria-label="На главную страницу">${mark}</a><nav class="desktop-nav" aria-label="Разделы сайта">${nav}</nav><a class="header-full text-link" href="./concept.html">Полный текст</a><button class="menu-toggle" type="button" aria-controls="mobile-nav" aria-expanded="false" aria-label="Открыть меню"><span aria-hidden="true"></span></button></div><nav class="mobile-nav" id="mobile-nav" aria-label="Мобильная навигация">${nav}<a href="./concept.html">Полный текст</a></nav></header>`;
}

function footer() {
  return `<footer class="site-footer"><div class="container footer-inner"><p>${e(content.meta.footerNote)}</p><a href="./concept.html">Полный текст Концепции</a></div></footer>`;
}

function pageShell({ title, description, body, current, bodyClass = '' }) {
  const figmaCapture = process.env.FIGMA_CAPTURE === '1' ? '<script src="https://mcp.figma.com/mcp/html-to-design/capture.js" async></script>' : '';
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>${e(title)}</title><meta name="description" content="${e(description)}"><link rel="icon" type="image/svg+xml" href="./favicon.svg"><link rel="stylesheet" href="./style.css">${figmaCapture}</head><body class="${e(bodyClass)}"><a class="skip-link" href="#main">К содержанию</a>${header(current)}<main id="main">${body}</main>${footer()}<script src="./main.js" defer></script></body></html>`;
}

function landingPageS11() {
  const { hero, about, story, sections } = content;
  const byId = id => sections.find(section => section.id === id);
  const card = (frame, type) => `<article class="s11-card s11-card--${type}" id="${e(frame.id)}"><div class="s11-card__top"><span class="s11-num">${e(frame.number)}</span><span class="s11-kicker">${e(frame.eyebrow)}</span></div><h3>${e(frame.title)}</h3><p>${e(frame.paragraphs[0])}</p><a href="${e(safeHref(frame.more?.href))}">Подробнее <span aria-hidden="true">↗</span></a></article>`;
  const sectionTitle = (label, title, intro = '') => `<div class="s11-heading"><span class="s11-kicker">${e(label)}</span><h2>${e(title)}</h2>${intro ? `<p>${e(intro)}</p>` : ''}</div>`;
  const sceneOverlay = [
    '',
    '<div class="s11-scene-tag s11-scene-tag--school"><span>01 · участок</span><strong>Школа</strong><small>Транспорт · сети · социальная инфраструктура</small></div>',
    '<div class="s11-scene-gap"><div><span>Документ</span><strong>Утверждённое содержание</strong></div><b>↔</b><div><span>Система</span><strong>Отдельная копия данных</strong></div><small>Ручной перенос · расхождение версий</small></div>',
    '<div class="s11-scene-link"><div><span>Версия данных</span><strong>Содержание решения</strong></div><b>↔</b><div><span>Правовое основание</span><strong>Акт уполномоченного субъекта</strong></div></div>'
  ];
  const slides = story.slides.map((slide, i) => `<article class="s11-story-slide${i === 0 ? ' is-active' : ''}" data-slide="${i}" ${i ? 'hidden' : ''}><div class="s11-story-copy"><span class="s11-step">${e(slide.number)} / 04 · ${e(slide.label)}</span><h3>${e(slide.title)}</h3><p>${e(slide.body)}</p></div><div class="s11-story-art s11-story-art--${i + 1}"><img src="${asset('territory-isometric.svg')}" alt="Изометрическая схема городской территории" loading="lazy">${sceneOverlay[i]}<span class="s11-art-marker">${e(slide.label)}</span></div></article>`).join('');
  const tabs = story.slides.map((slide, i) => `<button type="button" class="s11-story-tab${i === 0 ? ' is-active' : ''}" data-story-tab="${i}" aria-label="Показать слайд ${i + 1}: ${e(slide.title)}" aria-selected="${i === 0}"><span>${e(slide.number)}</span>${e(slide.title)}</button>`).join('');
  const principles = byId('how').frames;
  const practice = byId('practice').frames;
  const transition = byId('transition').frames[0];
  const compatibility = byId('development').frames[0];
  const materials = byId('materials').frames[0];
  const body = `<section class="s11-hero" id="hero"><div class="container s11-hero__grid"><div class="s11-hero__copy"><span class="s11-kicker">${e(hero.eyebrow)}</span><h1><span>Цифровое управление</span><span>развитием территорий</span></h1><p>${e(hero.lead)}</p></div><figure class="s11-hero__visual"><img src="${asset('territory-isometric.svg')}" alt="${e(hero.visualCaption)}"><figcaption>Территория · данные · решение</figcaption></figure></div></section>
  <section class="s11-section s11-about" id="why"><div class="container">${sectionTitle(about.eyebrow, about.title)}<div class="s11-about__grid"><div><span class="s11-num">01 / Кто мы</span><p>${e(about.who)}</p></div><div><span class="s11-num">02 / Зачем</span><p>${e(about.why)}</p></div><div><span class="s11-num">03 / Как</span><p>${e(about.how)}</p></div></div></div></section>
  <section class="s11-section s11-section--mist s11-story" id="story"><div class="container">${sectionTitle(story.eyebrow, story.title)}<div class="s11-story-shell"><div class="s11-story-stage">${slides}</div><div class="s11-story-controls"><div class="s11-story-tabs" role="tablist" aria-label="Этапы истории">${tabs}</div><div class="s11-story-arrows"><button type="button" data-story-prev aria-label="Предыдущий слайд">←</button><button type="button" data-story-next aria-label="Следующий слайд">→</button></div></div></div><p class="s11-footnote">${e(story.videoNote)}</p></div></section>
  <section class="s11-section" id="how"><div class="container">${sectionTitle('Принципы / 02', 'У решения должна быть точная цифровая основа', byId('how').intro)}<div class="s11-card-grid">${principles.map(f => card(f, 'principle')).join('')}</div><div class="s11-statement"><span>Структурированные данные и реестры</span><b>→</b><span>Юридически значимые цифровые решения</span><b>→</b><span>Аналитика и моделирование</span></div></div></section>
  <section class="s11-section s11-section--mist" id="practice"><div class="container">${sectionTitle('В работе / 03', 'Связанные сведения помогают видеть последствия', byId('practice').intro)}<div class="s11-card-grid">${practice.map(f => card(f, 'case')).join('')}</div></div></section>
  <section class="s11-section" id="transition"><div class="container">${sectionTitle('Этапы / 04', byId('transition').title, byId('transition').intro)}<div class="s11-phases">${transition.diagram.stages.map((s, i) => `<div class="s11-phase"><span class="s11-num">0${i + 1}</span><h3>${e(s)}</h3><p>${e([transition.paragraphs[0],transition.paragraphs[1],transition.diagram.caption][i])}</p></div>`).join('')}</div><p class="s11-footnote">Эффект оценивается с учётом переходных и регулярных затрат, а не по неподтверждённым цифрам экономии.</p></div></section>
  <section class="s11-section s11-section--mist" id="development"><div class="container s11-split">${sectionTitle('Совместимость / 05', byId('development').title, byId('development').intro)}<div class="s11-split__card"><span class="s11-num">Общие правила</span><p>${e(compatibility.paragraphs[0])}</p><div class="s11-chips">${compatibility.diagram.sharedRules.map(x => `<span>${e(x)}</span>`).join('')}</div><p>${e(compatibility.paragraphs[1])}</p></div></div></section>
  <section class="s11-section s11-materials" id="materials"><div class="container s11-materials__grid"><div>${sectionTitle('Материалы / 06', materials.title, byId('materials').intro)}<p>${e(materials.paragraphs[0])}</p></div><div class="s11-materials__action"><a class="s11-button" href="${e(safeHref(materials.supportAction.href))}">${e(materials.supportAction.label)} <span aria-hidden="true">↗</span></a><span>${e(materials.supportAction.help)}</span><span>${e(content.meta.footerNote)}</span></div></div></section>`;
  return pageShell({title:content.meta.title,description:content.meta.description,current:'home',body,bodyClass:'landing--s11'});
}

function landingPage() {
  if (content.meta.copyVersion?.startsWith('strict/s1.')) return landingPageS11();
  const hero = content.hero;
  const actions = hero.actions.map(action => `<a class="button-link ${action.kind === 'secondary' ? 'button-link--secondary' : ''}" href="${e(safeHref(action.href))}">${e(action.label)}</a>`).join('');
  const routes = hero.routes.map(route => `<a href="${e(safeHref(route.href))}">${e(route.label)}</a>`).join('');
  const heroFigure = `<figure class="hero-visual">${picture('hero-territory.svg', null, hero.visualCaption)}<figcaption>${e(hero.visualCaption)}</figcaption></figure>`;
  const notePrefix = hero.eyebrow === content.meta.conceptStatus ? '' : `${e(content.meta.conceptStatus)}. `;
  const heroClass = content.meta.copyVersion?.startsWith('strict/') ? 'hero hero--strict' : 'hero';
  const heroHtml = `<section class="${heroClass}" id="hero" aria-labelledby="hero-title" data-figma-section="hero"><div class="container"><div class="hero-layout"><div class="hero-copy"><span class="eyebrow">${e(hero.eyebrow)}</span><h1 id="hero-title">${e(hero.title)}</h1><p class="hero-lead">${e(hero.lead)}</p><div class="hero-actions">${actions}</div><p class="hero-note">${notePrefix}${e(hero.body)}</p></div>${heroFigure}</div><nav class="role-paths" aria-label="Быстрые входы по задачам"><span class="role-paths__label">${e(hero.routesLabel)}</span>${routes}</nav></div></section>`;
  return pageShell({ title: content.meta.title, description: content.meta.description, current: 'home', body: heroHtml + content.sections.map(renderSection).join('\n') });
}

function inlineMarkdown(raw) {
  let html = e(raw);
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
    const target = safeContentHref(href.replace(/&amp;/g, '&'));
    return `<a href="${e(target)}"${/^https:\/\//i.test(target) ? ' class="external-link" title="Внешний ресурс"' : ''}>${label}</a>`;
  });
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  return html;
}

function isBlockStart(line) {
  return /^\s*$|^<a id="[^"]+"><\/a>$|^#{1,6} |^\|.*\|$|^[-*] |^\d+\. |^> |^---$/.test(line);
}

function parseMarkdown(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let i = 0;
  let pendingId = '';
  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) { i++; continue; }
    const anchor = line.match(/^<a id="([a-z0-9-]+)"><\/a>$/i);
    if (anchor) { pendingId = anchor[1]; i++; continue; }
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      out.push(`<h${level}${pendingId ? ` id="${e(pendingId)}"` : ''}>${inlineMarkdown(heading[2])}</h${level}>`);
      pendingId = ''; i++; continue;
    }
    if (line === '---') { out.push('<hr>'); i++; continue; }
    if (/^\|.*\|$/.test(line) && /^\|[\s:|-]+\|$/.test((lines[i + 1] || '').trim())) {
      const cells = row => row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => cell.trim());
      const heads = cells(line);
      i += 2;
      const rows = [];
      while (i < lines.length && /^\|.*\|$/.test(lines[i].trim())) { rows.push(cells(lines[i])); i++; }
      out.push(`<div class="table-wrap"><table><thead><tr>${heads.map(cell => `<th>${inlineMarkdown(cell)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${inlineMarkdown(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }
    if (/^[-*] /.test(line) || /^\d+\. /.test(line)) {
      const ordered = /^\d+\. /.test(line);
      const items = [];
      while (i < lines.length && (ordered ? /^\d+\. / : /^[-*] /).test(lines[i].trim())) {
        items.push(lines[i].trim().replace(ordered ? /^\d+\. / : /^[-*] /, '')); i++;
      }
      const tag = ordered ? 'ol' : 'ul';
      out.push(`<${tag}>${items.map(item => `<li>${inlineMarkdown(item)}</li>`).join('')}</${tag}>`);
      continue;
    }
    if (/^> /.test(line)) {
      const quote = [];
      while (i < lines.length && /^> /.test(lines[i].trim())) { quote.push(lines[i].trim().slice(2)); i++; }
      out.push(`<blockquote><p>${inlineMarkdown(quote.join(' '))}</p></blockquote>`); continue;
    }
    const paragraph = [line]; i++;
    while (i < lines.length && !isBlockStart(lines[i].trim())) { paragraph.push(lines[i].trim()); i++; }
    out.push(`<p>${inlineMarkdown(paragraph.join(' '))}</p>`);
  }
  return out.join('\n');
}

function fullTextPage() {
  const firstSection = fullText.indexOf('<a id="m1"></a>');
  if (firstSection < 0) throw new Error('В полном тексте не найден якорь m1');
  const mainMd = fullText.slice(firstSection);
  const headings = [...mainMd.matchAll(/<a id="(m\d+|[ab])"><\/a>\s*\n##\s+(.+)/g)].map((match) => ({ id: match[1], title: match[2] }));
  if (headings.filter(h => /^m\d+$/.test(h.id)).length !== 12) throw new Error('В полном тексте нужны 12 основных разделов');
  const toc = `<aside class="document-toc" aria-label="Оглавление"><h2>Содержание</h2><ol>${headings.filter(h => /^m\d+$/.test(h.id)).map(h => `<li><a href="#${e(h.id)}">${e(h.title.replace(/^\d+\.\s*/, ''))}</a></li>`).join('')}</ol><p><a href="#a">Приложение А</a> · <a href="#b">Приложение Б</a></p></aside>`;
  const body = `<header class="document-hero"><div class="container"><span class="eyebrow">${e(content.meta.conceptStatus)}</span><h1>${e(content.meta.title)}</h1><p>${e(content.meta.edition)}. Полный текст Концепции; правовая детализация, программа внедрения и проверка эффектов требуют дальнейшей работы.</p><a class="document-back" href="./index.html">← Вернуться к краткому изложению</a></div></header><div class="container document-layout">${toc}<article class="document-body">${parseMarkdown(mainMd)}</article></div>`;
  return pageShell({ title: `Полный текст — ${content.meta.title}`, description: content.meta.description, current: 'concept', body });
}

function px(n) { return `${n}px`; }
function tokenCss() {
  const c = tokens.color;
  const l = tokens.layout;
  const font = tokens.font;
  const lines = [':root {'];
  Object.entries(c).forEach(([key, value]) => lines.push(`  --color-${key}: ${value};`));
  const cssFamily = (value) => value.split(',').map(part => {
    const name = part.trim();
    return name.includes(' ') && !/^['"]/.test(name) ? `"${name}"` : name;
  }).join(', ');
  lines.push(`  --font-family: ${cssFamily(font.family)};`, `  --font-mono: ${cssFamily(font.mono)};`, `  --container-max: ${px(l.containerMax)};`);
  Object.entries(l).filter(([key, value]) => typeof value === 'number').forEach(([key, value]) => lines.push(`  --layout-${key}: ${px(value)};`));
  Object.entries(tokens.radius).forEach(([key, value]) => lines.push(`  --radius-${key}: ${px(value)};`));
  Object.entries(tokens.shadow).forEach(([key, value]) => lines.push(`  --shadow-${key}: ${value};`));
  for (const [name, val] of Object.entries(font.desktop)) {
    lines.push(`  --type-${name}-size: ${px(val.size)};`, `  --type-${name}-line-height: ${px(val.lineHeight)};`, `  --type-${name}-tracking: ${px(val.tracking)};`, `  --type-${name}-weight: ${val.weight};`);
  }
  lines.push('}', '@media (max-width: 760px) {', '  :root {');
  for (const [name, val] of Object.entries(font.mobile)) {
    lines.push(`    --type-${name}-size: ${px(val.size)};`, `    --type-${name}-line-height: ${px(val.lineHeight)};`, `    --type-${name}-tracking: ${px(val.tracking)};`, `    --type-${name}-weight: ${val.weight};`);
  }
  lines.push('  }', '}');
  return lines.join('\n');
}

await rm(distDir, { recursive: true, force: true });
await mkdir(path.join(distDir, 'assets'), { recursive: true });
await cp(assetsDir, path.join(distDir, 'assets'), { recursive: true });
await writeFile(path.join(distDir, 'index.html'), landingPage());
await writeFile(path.join(distDir, 'concept.html'), fullTextPage());
await writeFile(path.join(distDir, 'tokens.css'), tokenCss());
await cp(path.join(siteDir, 'src', 'style.css'), path.join(distDir, 'style.css'));
await cp(path.join(siteDir, 'src', 'main.js'), path.join(distDir, 'main.js'));
await cp(path.join(siteDir, 'src', 'favicon.svg'), path.join(distDir, 'favicon.svg'));
console.log(`Сайт собран: ${distDir}`);
