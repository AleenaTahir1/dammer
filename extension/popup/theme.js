// Runs before first paint so the popup never flashes the wrong theme.
// popup.js keeps this localStorage copy in step with the saved settings.
(() => {
  let look = {};
  try {
    look = JSON.parse(localStorage.getItem('dammer:look')) ?? {};
  } catch {}
  const system = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.dataset.theme = ['light', 'dark', 'glass'].includes(look.theme) ? look.theme : system;
  document.documentElement.dataset.accent = look.accent ?? 'moss';
})();
