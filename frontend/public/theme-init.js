// Runs before the app loads so the page never flashes the wrong theme.
// Keep in step with src/lib/theme.ts (same storage key, same rules).
(function () {
  var choice = null;
  try {
    choice = window.localStorage.getItem('squadmap.theme');
  } catch (e) {
    // Storage can be blocked (private mode); fall back to the system setting.
  }
  var dark =
    choice === 'dark' ||
    (choice !== 'light' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  var metas = document.querySelectorAll('meta[name="theme-color"]');
  for (var i = 0; i < metas.length; i++) metas[i].setAttribute('content', dark ? '#0B1524' : '#F3EFE6');
})();
