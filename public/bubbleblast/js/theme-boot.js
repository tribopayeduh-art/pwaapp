(function () {
  try {
    var stored = localStorage.getItem('bubbles-theme');
    var theme = stored === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'light' ? '#c9a8e8' : '#0d081e');
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
