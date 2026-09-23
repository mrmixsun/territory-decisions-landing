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
const releaseTag = String(content.meta.copyVersion || 'current')
  .match(/s\d+(?:\.\d+)?/)?.[0]
  ?.replace('.', '-') || 'current';
const buildDate = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
  timeZone: process.env.SITE_TIME_ZONE || 'Asia/Novosibirsk'
}).format(new Date());

const esc = (value = '') => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const safeHref = (href = '') => /^(?:#|(?:\.\/)?(?:index|concept)\.html(?:#|$)|mailto:[^\s"<>]+$)/.test(href) ? href : '#';
const safeContentHref = (href = '') => /^https:\/\//i.test(href) ? href : safeHref(href);
const e = (value = '') => esc(value);
const para = (items = []) => items.map(item => `<p>${e(item)}</p>`).join('\n');
const list = (items = []) => `<ul>${items.map(item => `<li>${e(item)}</li>`).join('')}</ul>`;
const versioned = (href) => `${href}?v=${releaseTag}`;
const asset = (name) => versioned(`./assets/${name}`);

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
  const navLabel = label => e(label).replace(/\u00a0/g, '&nbsp;');
  const nav = content.nav.map(item => {
    const target = item.href || `#${item.id}`;
    const href = current === 'home' || !target.startsWith('#') ? target : `./index.html${target}`;
    return `<a href="${e(safeHref(href))}">${navLabel(item.label)}</a>`;
  }).join('');
  const supportHref = current === 'home' ? '#materials' : './index.html#materials';
  const mark = content.meta.copyVersion?.startsWith('strict/s1.')
    ? '<span class="site-mark__monogram">ИМТ<span>.</span></span>'
    : '<span class="site-mark__symbol" aria-hidden="true">⌖</span><span>Территория и решения</span>';
  return `<header class="site-header"><div class="container header-inner"><a class="site-mark" href="./index.html" aria-label="На главную страницу">${mark}</a><nav class="desktop-nav" aria-label="Разделы сайта">${nav}</nav><a class="header-full text-link" href="${supportHref}">Поддержать концепцию</a><button class="menu-toggle" type="button" aria-controls="mobile-nav" aria-expanded="false" aria-label="Открыть меню"><span aria-hidden="true"></span></button></div><nav class="mobile-nav" id="mobile-nav" aria-label="Мобильная навигация">${nav}<a href="${supportHref}">Поддержать концепцию</a></nav></header>`;
}

function footer() {
  const version = content.meta.copyVersion?.match(/s([\d.]+)/)?.[1] || content.meta.copyVersion || '—';
  const telegramIcon = '<svg class="footer-channel-icon footer-channel-icon--telegram" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="24" fill="#229ED9"/><path fill="#fff" d="M34.6 14.5 31 33.3c-.3 1.3-1 1.6-2.1 1l-5.5-4.1-2.7 2.6c-.3.3-.5.5-1.1.5l.4-5.6 10.2-9.2c.4-.4-.1-.6-.7-.2l-12.6 7.9-5.4-1.7c-1.2-.4-1.2-1.2.2-1.8l21.1-8.1c1-.4 1.9.2 1.8-.1Z"/></svg>';
  const maxIcon = '<svg class="footer-channel-icon footer-channel-icon--max" viewBox="0 0 1000 1000" aria-hidden="true"><defs><linearGradient id="max-gradient" x1="117.8" x2="1000" y1="760.5" y2="500" gradientUnits="userSpaceOnUse"><stop stop-color="#44CCFF"/><stop offset=".662" stop-color="#5533EE"/><stop offset="1" stop-color="#9933DD"/></linearGradient><radialGradient id="max-glow" cx="0" cy="1" r="1" gradientTransform="matrix(1515 -1233 508 624 -490 1087)" gradientUnits="userSpaceOnUse"><stop stop-color="#0000FF"/><stop offset="1" stop-color="#0000FF" stop-opacity="0"/></radialGradient></defs><rect width="1000" height="1000" rx="250" fill="url(#max-gradient)"/><rect width="1000" height="1000" rx="250" fill="url(#max-glow)"/><path fill="#fff" fill-rule="evenodd" d="M508 878c-75 0-110-11-170-55-38 50-160 88-165 22 0-49-11-91-23-136-15-57-32-119-32-210 0-216 178-380 388-380 211 0 376 171 376 382 1 207-167 376-374 377Zm3-571c-102-5-182 66-200 177-15 92 11 204 33 210 11 3 38-19 54-36 27 19 58 31 93 33 106 5 197-76 204-182 4-106-78-196-184-202Z" clip-rule="evenodd"/></svg>';
  return `<footer class="site-footer"><div class="container footer-inner">
    <div class="footer-intro"><a class="footer-mark" href="./index.html" aria-label="На главную страницу">ИМТ<span>.</span></a><p>Концепция цифрового управления развитием территорий</p></div>
    <div class="footer-grid">
      <section class="footer-column" aria-labelledby="footer-materials"><h2 id="footer-materials">Материалы</h2><a class="footer-primary-link" href="./concept.html">Полная версия концепции <span aria-hidden="true">↗</span></a><p>Развёрнутое описание принципов, целевого контура и этапов перехода.</p></section>
      <section class="footer-column" aria-labelledby="footer-version"><h2 id="footer-version">Текущая редакция</h2><p class="footer-value">${e(content.meta.edition)}</p><dl class="footer-meta"><div><dt>Версия сайта</dt><dd>${e(version)}</dd></div><div><dt>Обновлено</dt><dd>${e(buildDate)}</dd></div></dl></section>
      <section class="footer-column" aria-labelledby="footer-contact"><h2 id="footer-contact">Связаться</h2><a class="footer-primary-link" href="mailto:mstorozhilov@gemsdev.com">mstorozhilov@gemsdev.com</a><p>Вопросы, замечания и предложения по развитию концепции.</p></section>
      <section class="footer-column" aria-labelledby="footer-social"><h2 id="footer-social">Наши каналы</h2><div class="footer-socials"><a href="https://max.ru/join/EhGgOYRiKikL6YMSTDTMUirONsn2FJPSL9m8mW9nJoc" target="_blank" rel="noopener noreferrer" aria-label="Канал в мессенджере MAX">${maxIcon}<span>MAX</span></a><a href="https://t.me/+VwkQgNwHejM1ZWMy" target="_blank" rel="noopener noreferrer" aria-label="Канал в Telegram">${telegramIcon}<span>Telegram</span></a></div></section>
    </div>
    <div class="footer-legal"><div><span class="footer-legal__label">Владелец сайта</span><strong>ООО «Джемс Девелопмент»</strong></div><dl><div><dt>ИНН</dt><dd>7203423815</dd></div><div><dt>ОГРН</dt><dd>1177232019909</dd></div></dl><address>625048, Тюменская область, г. Тюмень, ул. Мельничная, д. 8, помещ. 1</address><a href="mailto:post@gemsdev.ru">post@gemsdev.ru</a></div>
    <div class="footer-bottom"><p>${e(content.meta.footerNote)}</p><p>GEMS развивает и популяризирует концепцию.</p></div>
  </div></footer>`;
}

function pageShell({ title, description, body, current, bodyClass = '' }) {
  const figmaCapture = process.env.FIGMA_CAPTURE === '1' ? '<script src="https://mcp.figma.com/mcp/html-to-design/capture.js" async></script>' : '';
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>${e(title)}</title><meta name="description" content="${e(description)}"><link rel="icon" type="image/svg+xml" href="${versioned('./favicon.svg')}"><link rel="stylesheet" href="${versioned('./style.css')}">${figmaCapture}</head><body class="${e(bodyClass)}"><a class="skip-link" href="#main">К содержанию</a>${header(current)}<main id="main">${body}</main>${footer()}<script src="${versioned('./main.js')}" defer></script></body></html>`;
}

function landingPageS11() {
  const { hero, about, story, sections } = content;
  const byId = id => sections.find(section => section.id === id);
  const card = (frame, type) => `<article class="s11-card s11-card--${type}" id="${e(frame.id)}"><div class="s11-card__top"><span class="s11-num">${e(frame.number)}</span><span class="s11-kicker">${e(frame.eyebrow)}</span></div><h3>${e(frame.title)}</h3><p>${e(frame.paragraphs[0])}</p><a href="${e(safeHref(frame.more?.href))}">Подробнее <span aria-hidden="true">↗</span></a></article>`;
  const sectionTitle = (label, title, intro = '') => {
    const cleanLabel = String(label).replace(/\s*\/\s*\d+\s*$/, '');
    const introMarkup = Array.isArray(intro)
      ? intro.map(paragraph => `<p>${e(paragraph)}</p>`).join('')
      : intro ? `<p>${e(intro)}</p>` : '';
    return `<div class="s11-heading"><span class="s11-kicker">${e(cleanLabel)}</span><h2>${e(title)}</h2>${introMarkup}</div>`;
  };
  const lifecycleArt = kind => {
    const visuals = {
      versions: '<div class="life-versions"><span>v1</span><span>v2<i></i></span></div><small>состав изменений сохранён</small>',
      procedures: '<div class="life-procedures"><span>проверка</span><b>v2</b><span>согласование</span><span>обсуждение</span></div><small>доработка возвращает новую редакцию</small>',
      act: '<div class="life-link"><span>итоговая<br>редакция</span><i>↔</i><span>акт</span></div><small>однозначная проверяемая связь</small>',
      status: '<div class="life-status"><span></span><span></span><span class="is-active"></span><span></span><span></span></div><div class="life-status-labels"><small>проект</small><small>действует</small><small>заменена</small></div>',
      update: '<div class="life-update"><span class="life-map"><i></i><i></i><i></i></span><b>↻</b><span class="life-source">источник<small>23.09.2026</small></span></div><small>дата актуальности и история</small>',
      reuse: '<div class="life-reuse"><b>v2</b><span>карта</span><span>таблица</span><span>чертёж</span><span>задача</span></div><small>одно содержание — разные применения</small>'
    };
    return `<div class="s11-lifecycle-art s11-lifecycle-art--${e(kind)}" aria-hidden="true">${visuals[kind] || ''}</div>`;
  };
  const lifecycleCard = frame => `<article class="s11-lifecycle-card" id="${e(frame.id)}"><div class="s11-lifecycle-card__head"><span class="s11-lifecycle-num">${e(frame.number)}</span>${lifecycleArt(frame.visual)}</div><h3>${e(frame.title)}</h3><p>${e(frame.paragraphs[0])}</p></article>`;
  const practiceCard = frame => {
    const steps = frame.steps.map((step, index) => `<li><span class="s11-practice-step__num">0${index + 1}</span><div><strong>${e(step.label)}</strong><p>${e(step.text)}</p></div></li>`).join('');
    return `<article class="s11-practice-card" id="${e(frame.id)}"><div class="s11-practice-card__top"><span class="s11-practice-num">${e(frame.number)}</span><span class="s11-kicker">${e(frame.eyebrow)}</span></div><h3>${e(frame.title)}</h3><ol class="s11-practice-steps">${steps}</ol><a class="s11-practice-more" href="${e(safeHref(frame.more?.href))}">${e(frame.more?.label || 'Подробнее')} <span aria-hidden="true">↗</span></a></article>`;
  };
  const slides = story.slides.map((slide, i) => `<article class="s11-story-slide${i === 0 ? ' is-active' : ''}" id="story-slide-${i + 1}" role="tabpanel" aria-labelledby="story-tab-${i + 1}" data-slide="${i}" ${i ? 'hidden' : ''}><div class="s11-story-copy"><span class="s11-step">${e(slide.number)} / 04 · ${e(slide.label)}</span><h3>${e(slide.title)}</h3><p>${e(slide.body)}</p></div><figure class="s11-story-art s11-story-art--${i + 1}"><picture><source media="(max-width: 760px)" srcset="${asset(slide.mobileAsset)}"><img src="${asset(slide.asset)}" alt="${e(slide.alt)}" loading="lazy" decoding="async"></picture></figure></article>`).join('');
  const tabs = story.slides.map((slide, i) => `<button type="button" class="s11-story-tab${i === 0 ? ' is-active' : ''}" id="story-tab-${i + 1}" data-story-tab="${i}" role="tab" aria-controls="story-slide-${i + 1}" aria-selected="${i === 0}" tabindex="${i === 0 ? '0' : '-1'}"><span>${e(slide.number)}</span>${e(slide.tabTitle || slide.title)}</button>`).join('');
  const how = byId('how');
  const practice = byId('practice').frames;
  const transition = byId('transition').frames[0];
  const compatibility = byId('development').frames[0];
  const materials = byId('materials').frames[0];
  const developmentSuppliers = (compatibility.diagram.suppliers || compatibility.diagram.systems || []).map(item => `<li>${e(item)}</li>`).join('');
  const developmentRules = (compatibility.diagram.sharedRules || []).map(item => `<span>${e(item)}</span>`).join('');
  const developmentModels = (compatibility.diagram.models || []).map(item => `<li>${e(item)}</li>`).join('');
  const developmentTasks = (compatibility.paragraphs || []).map((item, index) => `<li><span>0${index + 1}</span><p>${e(item)}</p></li>`).join('');
  const developmentChallenges = (compatibility.challenges || []).map((item, index) => `<li><span>0${index + 1}</span><div><strong>${e(item.title)}</strong><p>${e(item.text)}</p></div></li>`).join('');
  const contributionItems = (materials.contributions || []).map((item, index) => `<li><span>0${index + 1}</span><div><strong>${e(item.title)}</strong><p>${e(item.text)}</p></div></li>`).join('');
  const materialLink = materials.materials?.[0];
  const heroTitle = (hero.titleLines || [hero.title]).map(line => `<span>${e(line)}</span>`).join('');
  const heroLead = (hero.leadLines || [hero.lead]).map(line => `<span>${e(line)}</span>`).join('');
  const body = `<section class="s11-hero" id="hero"><div class="container s11-hero__grid"><div class="s11-hero__copy"><span class="s11-kicker">${e(hero.eyebrow)}</span><h1>${heroTitle}</h1><p>${heroLead}</p></div><figure class="s11-hero__visual"><img src="${asset('hero-imt-ecosystem-blue.png')}" alt="${e(hero.visualCaption)}"></figure></div></section>
  <section class="s11-section s11-section--mist s11-story" id="story"><div class="container">${sectionTitle(story.eyebrow, story.title, story.introParagraphs || story.intro)}<div class="s11-story-shell"><div class="s11-story-stage">${slides}</div><div class="s11-story-controls"><div class="s11-story-tabs" role="tablist" aria-label="Четыре шага объяснения Концепции">${tabs}</div><div class="s11-story-arrows"><button type="button" data-story-prev aria-label="Предыдущий слайд">←</button><button type="button" data-story-next aria-label="Следующий слайд">→</button></div></div></div></div></section>
  <section class="s11-section s11-lifecycle-section" id="how"><div class="container">${sectionTitle('Что предлагает концепция', how.title, how.intro)}<div class="s11-lifecycle">${how.frames.map(lifecycleCard).join('')}</div><div class="s11-lifecycle-summary"><strong>${e(how.summary)}</strong></div></div></section>
  <section class="s11-section s11-section--mist s11-practice-section" id="practice"><div class="container">${sectionTitle(byId('practice').navLabel, byId('practice').title, byId('practice').intro)}<div class="s11-practice-notice"><strong>Условные примеры</strong><span>${e(byId('practice').notice)}</span></div><div class="s11-practice-grid">${practice.map(practiceCard).join('')}</div></div></section>
  <section class="s11-section s11-transition-section" id="transition"><div class="container">${sectionTitle('Этапы / 04', byId('transition').title, byId('transition').intro)}<div class="s11-phases">${transition.diagram.stages.map((stage, i) => `<article class="s11-phase"><div class="s11-phase__head"><span class="s11-phase__num">0${i + 1}</span><span class="s11-phase__label">Этап</span></div><h3>${e(stage)}</h3><p>${e(transition.diagram.stageDetails[i].body)}</p><div class="s11-phase__result"><span>Результат</span><strong>${e(transition.diagram.stageDetails[i].result)}</strong></div></article>`).join('')}</div><div class="s11-transition-path"><span class="s11-kicker">${e(transition.diagram.pathLabel)}</span><div class="s11-transition-path__columns"><p>${e(transition.paragraphs[0])}</p><p>${e(transition.paragraphs[1])}</p><p>${e(transition.diagram.caption)}</p></div><a class="s11-button s11-transition-path__button" href="${e(safeHref(transition.more?.href))}">${e(transition.more?.label)} <span aria-hidden="true">↗</span></a></div></div></section>
  <section class="s11-section s11-section--mist s11-development" id="development"><div class="container"><div class="s11-development__heading">${sectionTitle('Развитие концепции', byId('development').title, byId('development').intro)}</div><div class="s11-development__layout"><div class="s11-development__copy"><span class="s11-kicker">Что предстоит сделать</span><ol class="s11-development__tasks">${developmentTasks}</ol><div class="s11-development__summary"><strong>${e(compatibility.summary)}</strong><a href="${e(safeHref(compatibility.more?.href))}">${e(compatibility.more?.label)} <span aria-hidden="true">↗</span></a></div></div><figure class="s11-development__flow"><div class="s11-development__suppliers"><span class="s11-development__flow-label">Поставщики данных</span><ul>${developmentSuppliers}</ul></div><div class="s11-development__rules" aria-label="Условия совместного использования">${developmentRules}</div><div class="s11-development__hub"><span>Связанные данные о территории</span><small>общие идентификаторы · семантика · проверка · история</small></div><div class="s11-development__models"><span class="s11-development__flow-label">Отраслевые модели</span><ul>${developmentModels}</ul></div><div class="s11-development__result"><span>Результат</span><p>${e(compatibility.diagram.result)}</p></div><figcaption>${e(compatibility.diagram.caption)}</figcaption></figure></div><div class="s11-development__challenges"><span class="s11-kicker">Основные сложности</span><ol>${developmentChallenges}</ol></div></div></section>
  <section class="s11-section s11-materials" id="materials"><div class="container"><div class="s11-materials__grid"><div class="s11-materials__main">${sectionTitle('Участие / 06', materials.title, materials.paragraphs)}<ol class="s11-materials__contributions">${contributionItems}</ol></div><aside class="s11-materials__action"><span class="s11-materials__label">Связаться</span><strong>${e(materials.contact?.name)}</strong><p>${e(materials.contact?.role)}</p><a class="s11-materials__email" href="mailto:${e(materials.contact?.email)}">${e(materials.contact?.email)}</a><a class="s11-button" href="${e(safeHref(materials.supportAction.href))}">${e(materials.supportAction.label)} <span aria-hidden="true">↗</span></a>${materialLink ? `<a class="s11-materials__secondary" href="${e(safeHref(materialLink.href))}">${e(materialLink.label)} <span aria-hidden="true">↗</span></a>` : ''}</aside></div><div class="s11-materials__future"><span>Следующий этап</span><p>${e(materials.future)}</p><small>${e(materials.disclaimer)}</small></div></div></section>
  <section class="s11-section s11-about" id="why"><div class="container">${sectionTitle(about.eyebrow, about.title)}<div class="s11-about__grid"><div><span class="s11-num">01 / Кто мы</span><p>${e(about.who)}</p></div><div><span class="s11-num">02 / Зачем</span><p>${e(about.why)}</p></div><div><span class="s11-num">03 / Как</span><p>${e(about.how)}</p></div></div></div></section>`;
  return pageShell({title:content.meta.title,description:content.meta.description,current:'home',body,bodyClass:'landing--s11 landing--imt'});
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
  return pageShell({ title: `Полный текст — ${content.meta.title}`, description: content.meta.description, current: 'concept', body, bodyClass: 'document--imt' });
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
