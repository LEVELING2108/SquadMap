// Runs before the app loads so the page never flashes the wrong theme.
// Keep in step with src/lib/theme.ts (same storage key, same rules).
(function () {
  var choice = null;
  try {
    choice = window.localStorage.getItem('squadmap.theme');
  } catch (e) {
    // Storage can be blocked (private mode); fall back to the system setting.
  }
  var theme =
    choice === 'light' || choice === 'dark' || choice === 'atlas'
      ? choice
      : window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
  document.documentElement.setAttribute('data-theme', theme);
  var bar = { light: '#F3EFE6', dark: '#0B1524', atlas: '#EFE6D2' }[theme];
  var metas = document.querySelectorAll('meta[name="theme-color"]');
  for (var i = 0; i < metas.length; i++) metas[i].setAttribute('content', bar);
})();
