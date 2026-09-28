(function () {
  function cachePublic(cfg) {
    if (cfg && typeof cfg === 'object') {
      window.__BB_PUBLIC_CONFIG__ = cfg;
      sessionStorage.setItem('bb-public-config-v1', JSON.stringify(cfg));
      return true;
    }
    return false;
  }

  function cacheGame(cfg) {
    if (cfg && typeof cfg === 'object') {
      window.__BB_GAME_CONFIG__ = cfg;
      sessionStorage.setItem('bb-game-config-v1', JSON.stringify(cfg));
      return true;
    }
    return false;
  }

  try {
    if (!cachePublic(window.__BB_PUBLIC_CONFIG__)) {
      var publicCached = sessionStorage.getItem('bb-public-config-v1');
      if (publicCached) {
        window.__BB_PUBLIC_CONFIG__ = JSON.parse(publicCached);
      }
      window.__BB_PUBLIC_CONFIG_PROMISE__ = fetch('/api/public/config', {
        credentials: 'same-origin',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      })
        .then(function (res) {
          return res.ok ? res.json() : null;
        })
        .then(function (data) {
          cachePublic(data);
          return data;
        })
        .catch(function () {
          return null;
        });
    }

    var hasSession = document.cookie.split(';').some(function (c) {
      return c.trim().indexOf('bb_session=') === 0;
    });
    if (!hasSession) {
      sessionStorage.removeItem('bb-game-config-v1');
      return;
    }

    if (!cacheGame(window.__BB_GAME_CONFIG__)) {
      var gameCached = sessionStorage.getItem('bb-game-config-v1');
      if (gameCached) {
        window.__BB_GAME_CONFIG__ = JSON.parse(gameCached);
      }
      window.__BB_GAME_CONFIG_PROMISE__ = fetch('/api/game/config', {
        credentials: 'same-origin',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      })
        .then(function (res) {
          return res.ok ? res.json() : null;
        })
        .then(function (data) {
          cacheGame(data);
          return data;
        })
        .catch(function () {
          return null;
        });
    }
  } catch (e) {}
})();
