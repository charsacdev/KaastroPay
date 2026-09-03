/* ==========================================================================
   Kaastro Pay — install and offline
   Registers the service worker, captures Chrome's install prompt so we can
   fire it from our own button, and hand-holds iOS, which has no install API
   at all and needs the Share-sheet instructions spelled out.
   ========================================================================== */
(function (global) {
    'use strict';

    var deferred = null;                 // Chrome's beforeinstallprompt event
    var listeners = [];
    var DISMISS_KEY = 'kaastro-install-dismissed';

    function root() {
        // Pages live at the root and one level down; resolve either way.
        return /\/(dashboard|agent|admin)\//.test(location.pathname) ? '../' : './';
    }

    /* ---------------------------- platform ---------------------------- */

    var ua = navigator.userAgent || '';
    var isIOS = /iPad|iPhone|iPod/.test(ua)
        || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    var isAndroid = /Android/.test(ua);
    var isSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(ua);

    /* Some embedded webviews have no matchMedia at all, so never assume it. */
    function displayMode(mode) {
        try { return !!(global.matchMedia && global.matchMedia('(display-mode: ' + mode + ')').matches); }
        catch (e) { return false; }
    }

    function isInstalled() {
        return displayMode('standalone') || displayMode('minimal-ui')
            || navigator.standalone === true;
    }

    /* Can we actually do something useful if the button is pressed? */
    function canInstall() {
        if (isInstalled()) return false;
        return !!deferred || isIOS;
    }

    function notify() { listeners.forEach(function (f) { try { f(); } catch (e) { } }); }
    function onChange(fn) { listeners.push(fn); fn(); }

    global.addEventListener('beforeinstallprompt', function (e) {
        // Chrome shows its own mini-infobar otherwise; we want our own button.
        e.preventDefault();
        deferred = e;
        notify();
    });

    global.addEventListener('appinstalled', function () {
        deferred = null;
        notify();
        if (global.KP && KP.rails) KP.rails.toast('Kaastro Pay installed. Look for it on your home screen.');
    });

    /* ------------------------------ prompt ------------------------------ */

    function install() {
        if (isInstalled()) {
            toast('Kaastro Pay is already installed on this device.');
            return Promise.resolve('installed');
        }
        if (deferred) {
            var e = deferred;
            deferred = null;
            // prompt() throws if it is called twice, or outside a user gesture.
            // Never let that leave the button doing nothing.
            try {
                var choice = e.prompt();
                var settled = (choice && typeof choice.then === 'function') ? choice : e.userChoice;
                return Promise.resolve(settled).then(function (res) {
                    notify();
                    // Chrome does not hand the event back, so keep the sheet as a route in.
                    if (!res || res.outcome !== 'accepted') showSheet();
                    return (res && res.outcome) || 'dismissed';
                }).catch(function () {
                    showSheet();
                    return 'instructions';
                });
            } catch (err) {
                showSheet();
                return Promise.resolve('instructions');
            }
        }
        showSheet();
        return Promise.resolve('instructions');
    }

    function toast(msg, tone) {
        if (global.KP && KP.rails && KP.rails.toast) KP.rails.toast(msg, tone);
    }

    /* -------------------------- how-to sheet -------------------------- */
    /* Safari on iOS has no install API. The only route is Share → Add to Home
       Screen, so the button explains that rather than doing nothing. */

    function steps() {
        if (isIOS) {
            return {
                title: 'Add Kaastro Pay to your Home Screen',
                lead: 'iPhone and iPad install from the Share menu — it takes two taps.',
                items: [
                    ['fa-arrow-up-from-bracket', 'Tap Share',
                     'The square with an arrow, at the bottom of Safari.'],
                    ['fa-square-plus', 'Choose "Add to Home Screen"',
                     'Scroll down the list if you do not see it straight away.'],
                    ['fa-check', 'Tap Add',
                     'Kaastro Pay lands on your home screen like any other app.']
                ],
                note: isSafari ? null
                    : 'You are not in Safari. On iPhone, only Safari can add an app to the '
                      + 'home screen — open this page there first.'
            };
        }
        if (isAndroid) {
            return {
                title: 'Install Kaastro Pay',
                lead: 'Add it to your home screen and it opens full screen, no browser bar.',
                items: [
                    ['fa-ellipsis-vertical', 'Open the browser menu',
                     'The three dots, top right of Chrome.'],
                    ['fa-download', 'Tap "Install app" or "Add to Home screen"', 'Either wording works.'],
                    ['fa-check', 'Confirm', 'The icon appears with your other apps.']
                ],
                note: null
            };
        }
        return {
            title: 'Install Kaastro Pay',
            lead: 'Install it as a desktop app and it opens in its own window.',
            items: [
                ['fa-download', 'Click the install icon in the address bar',
                 'A monitor with a downward arrow, on the right-hand side.'],
                ['fa-ellipsis-vertical', 'Or use the browser menu',
                 'Look for "Install Kaastro Pay" or "Create shortcut".'],
                ['fa-check', 'Confirm', 'It gets its own window and taskbar icon.']
            ],
            note: null
        };
    }

    function showSheet() {
        var s = steps();
        var id = 'kpInstallSheet';
        var el = document.getElementById(id);
        if (el) el.remove();

        var html = '<div class="modal fade" id="' + id + '" tabindex="-1">'
            + '<div class="modal-dialog modal-dialog-centered">'
            + '<div class="modal-content"><div class="modal-body p-4">'
            + '<div class="text-center mb-3">'
            + '<img src="' + root() + 'images/icon-maskable-192.png" width="64" height="64" alt="" '
            + 'style="border-radius:18px;box-shadow:0 10px 24px -10px rgba(0,0,0,.5)">'
            + '<h5 class="fw-bold mt-3 mb-1">' + s.title + '</h5>'
            + '<p class="text-muted mb-0" style="font-size:.85rem">' + s.lead + '</p></div>'
            + '<div class="install-steps">'
            + s.items.map(function (it, i) {
                return '<div class="install-step">'
                    + '<span class="is-n">' + (i + 1) + '</span>'
                    + '<span class="is-ico"><i class="fas ' + it[0] + '"></i></span>'
                    + '<span class="min-w-0"><b>' + it[1] + '</b><span>' + it[2] + '</span></span></div>';
            }).join('')
            + '</div>'
            + (s.note ? '<div class="k-alert k-warn mt-3"><i class="fas fa-circle-info"></i><div>'
                + s.note + '</div></div>' : '')
            + '<button class="btn btn-soft w-100 mt-3" data-bs-dismiss="modal">Got it</button>'
            + '</div></div></div></div>';

        document.body.insertAdjacentHTML('beforeend', html);
        var node = document.getElementById(id);
        new bootstrap.Modal(node).show();
        node.addEventListener('hidden.bs.modal', function () { node.remove(); });
    }

    /* ------------------------- service worker ------------------------- */

    function register() {
        if (!('serviceWorker' in navigator)) return;
        // file:// has no service worker support; only register over http(s).
        if (location.protocol === 'file:') return;

        navigator.serviceWorker.register(root() + 'sw.js', { scope: root() })
            .then(function (reg) {
                reg.addEventListener('updatefound', function () {
                    var sw = reg.installing;
                    if (!sw) return;
                    sw.addEventListener('statechange', function () {
                        if (sw.state === 'installed' && navigator.serviceWorker.controller) {
                            showUpdateBar(reg);
                        }
                    });
                });
            })
            .catch(function () { /* not fatal — the app still works online */ });
    }

    function showUpdateBar(reg) {
        if (document.getElementById('kpUpdateBar')) return;
        document.body.insertAdjacentHTML('beforeend',
            '<div class="update-bar" id="kpUpdateBar">'
            + '<i class="fas fa-arrows-rotate"></i>'
            + '<span>A new version of Kaastro Pay is ready.</span>'
            + '<button class="btn btn-sm btn-primary ms-auto" id="kpUpdateNow">Reload</button>'
            + '<button class="btn btn-sm btn-soft" id="kpUpdateLater">Later</button></div>');
        document.getElementById('kpUpdateNow').addEventListener('click', function () {
            if (reg.waiting) reg.waiting.postMessage('skipWaiting');
            location.reload();
        });
        document.getElementById('kpUpdateLater').addEventListener('click', function () {
            document.getElementById('kpUpdateBar').remove();
        });
    }

    /* --------------------------- offline flag --------------------------- */

    function watchConnection() {
        function paint() {
            var off = !navigator.onLine;
            var bar = document.getElementById('kpOfflineBar');
            if (off && !bar) {
                document.body.insertAdjacentHTML('beforeend',
                    '<div class="offline-bar" id="kpOfflineBar">'
                    + '<i class="fas fa-wifi"></i>You are offline. Balances and rates may be out of date.'
                    + '</div>');
            } else if (!off && bar) {
                bar.remove();
            }
        }
        global.addEventListener('online', paint);
        global.addEventListener('offline', paint);
        paint();
    }

    /* ---------------------------- wiring ---------------------------- */

    function wireButtons() {
        document.addEventListener('click', function (e) {
            var btn = e.target.closest('[data-install]');
            if (btn) { e.preventDefault(); install(); return; }
            /* A second entry point that always explains rather than prompting.
               Someone who clicks "Installation guide" wants the steps, not a
               dialog their browser may never show. */
            var guide = e.target.closest('[data-install-guide]');
            if (guide) { e.preventDefault(); showSheet(); }
        });

        // Hide install affordances once the app is actually installed.
        onChange(function () {
            var installed = isInstalled();
            document.querySelectorAll('[data-install-hide-when-installed]').forEach(function (n) {
                n.hidden = installed;
            });
            document.querySelectorAll('[data-install-state]').forEach(function (n) {
                n.textContent = installed ? 'Installed' : 'Install app';
            });
        });
    }

    function init() {
        register();
        wireButtons();
        watchConnection();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    global.KP = global.KP || {};
    global.KP.pwa = {
        install: install,
        showSheet: showSheet,
        canInstall: canInstall,
        isInstalled: isInstalled,
        onChange: onChange,
        platform: isIOS ? 'ios' : isAndroid ? 'android' : 'desktop'
    };

})(window);
