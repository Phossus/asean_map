export function initNavToggle() {
  const button = document.querySelector('[data-menu-toggle]');
  const nav = document.querySelector('#site-nav');
  if (!button || !nav) return;
  button.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    button.setAttribute('aria-expanded', String(open));
  });
}
