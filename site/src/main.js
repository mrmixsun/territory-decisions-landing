const menuButton = document.querySelector('.menu-toggle');
const mobileNav = document.querySelector('.mobile-nav');

if (menuButton && mobileNav) {
  const closeMenu = () => {
    mobileNav.classList.remove('is-open');
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', 'Открыть меню');
    document.body.classList.remove('menu-open');
  };
  menuButton.addEventListener('click', () => {
    const opened = menuButton.getAttribute('aria-expanded') === 'true';
    if (opened) closeMenu();
    else {
      mobileNav.classList.add('is-open');
      menuButton.setAttribute('aria-expanded', 'true');
      menuButton.setAttribute('aria-label', 'Закрыть меню');
      document.body.classList.add('menu-open');
    }
  });
  mobileNav.addEventListener('click', event => {
    if (event.target.closest('a')) closeMenu();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeMenu();
  });
  window.addEventListener('resize', () => {
    if (window.innerWidth > 760) closeMenu();
  });
}

const sectionNavLinks = [...document.querySelectorAll('.desktop-nav a[href^="#"], .mobile-nav a[href^="#"]')];
if (sectionNavLinks.length) {
  const header = document.querySelector('.site-header');
  const sections = [...new Set(sectionNavLinks.map(link => link.getAttribute('href')))]
    .map(href => ({ href, element: document.getElementById(href.slice(1)) }))
    .filter(item => item.element);
  let scheduled = false;

  const setActiveSection = href => {
    sectionNavLinks.forEach(link => {
      const active = link.getAttribute('href') === href;
      link.classList.toggle('is-active', active);
      if (active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  };

  const updateActiveSection = () => {
    const marker = (header?.getBoundingClientRect().bottom || 0) + Math.min(window.innerHeight * .22, 170);
    const current = sections.find(({ element }) => {
      const rect = element.getBoundingClientRect();
      return rect.top <= marker && rect.bottom > marker;
    });
    setActiveSection(current?.href || '');
    scheduled = false;
  };

  const scheduleActiveSectionUpdate = () => {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(updateActiveSection);
  };

  sectionNavLinks.forEach(link => link.addEventListener('click', () => {
    setActiveSection(link.getAttribute('href'));
    window.setTimeout(scheduleActiveSectionUpdate, 80);
  }));
  window.addEventListener('scroll', scheduleActiveSectionUpdate, { passive: true });
  window.addEventListener('resize', scheduleActiveSectionUpdate);
  window.addEventListener('hashchange', scheduleActiveSectionUpdate);
  updateActiveSection();
}

const story = document.querySelector('.s11-story');
if (story) {
  const slides = [...story.querySelectorAll('[data-slide]')];
  const tabs = [...story.querySelectorAll('[data-story-tab]')];
  let active = 0;
  const show = next => {
    active = (next + slides.length) % slides.length;
    slides.forEach((slide, index) => {
      slide.hidden = index !== active;
      slide.classList.toggle('is-active', index === active);
    });
    tabs.forEach((tab, index) => {
      tab.classList.toggle('is-active', index === active);
      tab.setAttribute('aria-selected', String(index === active));
      tab.setAttribute('tabindex', index === active ? '0' : '-1');
    });
  };
  tabs.forEach((tab, index) => tab.addEventListener('click', () => show(index)));
  tabs.forEach((tab, index) => tab.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : index + (event.key === 'ArrowRight' ? 1 : -1);
    show(next);
    tabs[(next + tabs.length) % tabs.length].focus();
  }));
  story.querySelector('[data-story-prev]')?.addEventListener('click', () => show(active - 1));
  story.querySelector('[data-story-next]')?.addEventListener('click', () => show(active + 1));
}
