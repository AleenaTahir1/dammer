// Inner pages: the footer's "you have been here for" timer. The bar fills once a minute.
(() => {
  const time = document.getElementById('stay');
  const bar = document.getElementById('stayBar');
  if (!time || !bar) return;
  const arrived = Date.now();
  setInterval(() => {
    const seconds = Math.floor((Date.now() - arrived) / 1000);
    time.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    bar.style.setProperty('--p', String((seconds % 60) / 59));
  }, 1000);
})();
