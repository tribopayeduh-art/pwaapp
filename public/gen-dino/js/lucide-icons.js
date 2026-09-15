/*
 * Minimal offline Lucide-style icon subset used by the GEN DINO interface.
 * Keeping the icons local makes the mobile demo work without a CDN.
 */
(function () {
    'use strict';

    var icons = {
        'arrow-left': '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>',
        'arrow-right': '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
        'arrow-up-right': '<path d="M7 17 17 7"/><path d="M7 7h10v10"/>',
        'circle-plus': '<circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/>',
        'circle-check': '<circle cx="12" cy="12" r="10"/><path d="m8 12 2.6 2.6L16.5 8.7"/>',
        'chevron-right': '<path d="m9 18 6-6-6-6"/>',
        'gamepad-2': '<line x1="6" x2="10" y1="11" y2="11"/><line x1="8" x2="8" y1="9" y2="13"/><line x1="15" x2="15.01" y1="12" y2="12"/><line x1="18" x2="18.01" y1="10" y2="10"/><path d="M17.5 5h-11A3.5 3.5 0 0 0 3 8.5v6A3.5 3.5 0 0 0 6.5 18H8l2-2h4l2 2h1.5a3.5 3.5 0 0 0 3.5-3.5v-6A3.5 3.5 0 0 0 17.5 5Z"/>',
        'hand': '<path d="M18 11V6a2 2 0 0 0-4 0v4"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/><path d="M10 10V5a2 2 0 0 0-4 0v9"/><path d="m18 8 1.7-1.7a2.12 2.12 0 0 1 3 3L19 13v5a6 6 0 0 1-6 6h-2c-3.3 0-6-2.7-6-6v-3.5a2 2 0 0 1 4 0V16"/>',
        'heart': '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78Z"/>',
        'house': '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="M9 22v-8h6v8"/>',
        'play': '<polygon points="5 3 19 12 5 21 5 3"/>',
        'pencil': '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
        'lock-keyhole': '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/><circle cx="12" cy="16" r="1"/><path d="M12 17v2"/>',
        'log-out': '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>',
        'rotate-ccw': '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>',
        'shield-check': '<path d="M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V5l8-3 8 3Z"/><path d="m9 12 2 2 4-4"/>',
        'user-round': '<circle cx="12" cy="8" r="4"/><path d="M4 22a8 8 0 0 1 16 0"/>',
        'wallet-cards': '<rect width="18" height="12" x="3" y="6" rx="2"/><path d="M3 10h18"/><path d="M16 14h2"/>',
        'zap': '<path d="M4 14a1 1 0 0 1-.78-1.63l9-11A.5.5 0 0 1 13.1 2l-1.7 6H20a1 1 0 0 1 .78 1.63l-9 11A.5.5 0 0 1 10.9 20l1.7-6Z"/>',
        'copy': '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
        'check': '<path d="M20 6 9 17l-5-5"/>',
        'share-2': '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/>',
        'sparkles': '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>',
        'badge-dollar-sign': '<path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 6v12"/>'
    };

    function render(scope) {
        (scope || document).querySelectorAll('[data-icon]').forEach(function (node) {
            var iconName = node.getAttribute('data-icon');
            var paths = icons[iconName];

            if (!paths) {
                return;
            }

            node.setAttribute('aria-hidden', 'true');
            node.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" focusable="false">' + paths + '</svg>';
        });
    }

    window.GenDinoLucide = { render: render };
})();
