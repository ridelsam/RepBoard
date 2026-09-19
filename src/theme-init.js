// Apply the saved appearance before styles load, avoiding a dark flash in light mode.
(() => {
  let theme = 'dark';
  try {
    const saved = JSON.parse(localStorage.getItem('repboard-state-v1'));
    if (saved?.settings?.theme === 'light') theme = 'light';
  } catch { /* New or unreadable preferences use Quiet Form dark. */ }
  document.documentElement.dataset.theme = theme;
})();
