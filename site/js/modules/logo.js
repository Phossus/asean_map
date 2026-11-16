// Swaps the dashed [LOGO] placeholders for a real image when one exists.
// Header logo: assets/images/logo.(svg|png|webp)   Footer logo: logo-light.* (falls back to logo.*)
const EXTENSIONS = ['svg', 'png', 'jpg', 'jpeg', 'webp'];

export function firstImage(basePaths, quiet = false) {
  const urls = basePaths.flatMap((base) => EXTENSIONS.map((ext) => base + '.' + ext));
  return new Promise((resolve) => {
    let i = 0;
    const probe = new Image();
    probe.onload = () => resolve(urls[i]);
    probe.onerror = () => {
      i += 1;
      if (i < urls.length) { probe.src = urls[i]; }
      else { if (!quiet) console.info('Image not found. Looked for: ' + urls.join(', ')); resolve(null); }
    };
    probe.src = urls[0];
  });
}

export async function initLogos() {
  // Automatically detect the GitHub Pages repository path.
  const isGitHubPages = location.hostname.endsWith('github.io');

  const pathParts = location.pathname.split('/').filter(Boolean);

  const siteBase = isGitHubPages && pathParts.length > 0
    ? `/${pathParts[0]}/`
    : '/';

export async function initLogos() {
  const siteBase = new URL('./', document.baseURI).pathname;

  for (const box of document.querySelectorAll('[data-logo]')) {
    const light = box.dataset.logo === 'light';

    const paths = light
      ? [
          `${siteBase}assets/images/logo-light`,
          `${siteBase}assets/images/logo`
        ]
      : [
          `${siteBase}assets/images/logo`
        ];

    const url = await firstImage(paths);

    if (!url) {
      console.warn('Could not find logo for:', box);
      continue;
    }

    const img = document.createElement('img');
    img.className = 'brand__logo brand__logo--image';
    img.src = url;
    img.alt = '';

    box.replaceWith(img);
  }
}
}
