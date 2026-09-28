(function () {
  'use strict';

  var WELCOME = '/audio/speaks/bemvindo.mp3';
  var welcomeEl = null;
  var speakEl = null;
  var speakPath = '';
  var welcomeStarted = false;

  function norm(url) {
    try {
      return new URL(url, window.location.origin).pathname;
    } catch (e) {
      return String(url || '').split('?')[0];
    }
  }

  function onTutorialPage() {
    return /\/tutorial\/?$/.test(window.location.pathname);
  }

  /** Só o bemvindo — toca no tutorial após gesto do usuário. */
  window.__bbPlayWelcome = function () {
    if (welcomeStarted && welcomeEl && !welcomeEl.paused) {
      return Promise.resolve();
    }
    welcomeStarted = true;
    if (!welcomeEl) {
      welcomeEl = new Audio(WELCOME);
      welcomeEl.setAttribute('playsinline', '');
      welcomeEl.playsInline = true;
      welcomeEl.preload = 'auto';
      welcomeEl.volume = 1;
    }
    welcomeEl.currentTime = 0;
    return welcomeEl.play().catch(function (err) {
      welcomeStarted = false;
      console.warn('[tutorial welcome]', err);
      throw err;
    }).then(function (result) {
      try {
        sessionStorage.removeItem('bb-welcome-pending');
      } catch (e) {}
      return result;
    });
  };

  /** Narrações das etapas (tutorialpt1, meta, bomba, …) — canal separado. */
  window.__bbPlaySpeak = function (url, volume) {
    if (!url) return Promise.reject(new Error('empty url'));
    if (norm(url) === norm(WELCOME)) {
      return window.__bbPlayWelcome();
    }

    var path = norm(url);
    var vol = Math.min(1, Math.max(0, volume == null ? 1 : volume));

    if (welcomeEl && !welcomeEl.paused) {
      try {
        welcomeEl.pause();
      } catch (e) {}
    }

    if (speakEl && speakPath === path && !speakEl.paused) {
      return Promise.resolve();
    }

    if (speakEl && speakPath !== path) {
      try {
        speakEl.pause();
        speakEl.currentTime = 0;
      } catch (e) {}
    }

    if (!speakEl || speakPath !== path) {
      speakEl = new Audio(url);
      speakPath = path;
      speakEl.setAttribute('playsinline', '');
      speakEl.playsInline = true;
      speakEl.preload = 'auto';
    }
    speakEl.volume = vol;
    return speakEl.play().catch(function (err) {
      console.warn('[tutorial speak]', url, err);
      throw err;
    });
  };

  /** Para só a narração da etapa — não mata o bemvindo. */
  window.__bbStopSpeak = function () {
    try {
      if (speakEl) {
        speakEl.pause();
        speakEl.currentTime = 0;
      }
    } catch (e) {}
  };

  window.__bbStopWelcome = function () {
    try {
      if (welcomeEl) {
        welcomeEl.pause();
        welcomeEl.currentTime = 0;
      }
    } catch (e) {}
    welcomeStarted = false;
  };

  document.addEventListener(
    'pointerdown',
    function () {
      if (!onTutorialPage()) return;
      try {
        if (sessionStorage.getItem('bb-welcome-pending') === '1') {
          window.__bbPlayWelcome().catch(function () {});
        }
      } catch (e) {}
    },
    { once: true, passive: true }
  );
})();
