// Swaps the dashed [LOGO] placeholders for a real image when one exists.
// Header logo: assets/images/logo.(svg|png|webp)   Footer logo: logo-light.* (falls back to logo.*)
const EXTENSIONS = ['svg', 'png', 'webp'];

export function firstImage(basePaths) {
  const urls = basePaths.flatMap((base) => EXTENSIONS.map((ext) => base + '.' + ext));
  return new Promise((resolve) => {
    let i = 0;
    const probe = new Image();
    probe.onload = () => resolve(urls[i]);
    probe.onerror = () => { i += 1; if (i < urls.length) probe.src = urls[i]; else resolve(null); };
    probe.src = urls[0];
  });
}

export async function initLogos() {
  for (const box of document.querySelectorAll('[data-logo]')) {
    const light = box.dataset.logo === 'light';
    const url = await firstImage(light ? ['/assets/images/logo-light', '/assets/images/logo'] : ['/assets/images/logo']);
    if (!url) continue;
    const img = document.createElement('img');
    img.className = 'brand__logo brand__logo--image';
    img.src = url; img.alt = '';
    box.replaceWith(img);
  }
}
