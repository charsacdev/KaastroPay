/* Kaastro Pay — one-line boot.
   Loads the vendor CSS/JS and every app module in the right order so each
   page's <head> stays two lines instead of twelve.
   Usage:  <script src="../js/boot.js" data-root="../"></script>
   Page code goes in a  KP.ready(fn)  callback. */
(function () {
    'use strict';

    var self = document.currentScript;
    var root = (self && self.getAttribute('data-root')) || '';

    // Theme before first paint, so a dark-mode user never sees a white flash.
    try {
        document.documentElement.setAttribute('data-bs-theme',
            localStorage.getItem('kaastro-theme') || 'light');
    } catch (e) { }

    function css(href) {
        document.write('<link rel="stylesheet" href="' + href + '">');
    }
    function js(src) {
        document.write('<script src="' + src + '"><\/script>');
    }

    css('https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css');
    css('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css');
    css('https://cdn.datatables.net/1.13.7/css/dataTables.bootstrap5.min.css');
    css('https://cdn.datatables.net/responsive/2.5.0/css/responsive.bootstrap5.min.css');
    css(root + 'css/kaastro.css');

    js('https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.min.js');
    js('https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js');
    js('https://cdn.datatables.net/1.13.7/js/jquery.dataTables.min.js');
    js('https://cdn.datatables.net/1.13.7/js/dataTables.bootstrap5.min.js');
    js('https://cdn.datatables.net/responsive/2.5.0/js/dataTables.responsive.min.js');
    js('https://cdn.datatables.net/responsive/2.5.0/js/responsive.bootstrap5.min.js');
    js(root + 'js/config.js');
    js(root + 'js/rates-engine.js');
    js(root + 'js/mock-data.js');
    js('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
    js(root + 'js/rails.js');
    js(root + 'js/receipt.js');
    js(root + 'js/review.js');
    js(root + 'js/shell.js');
    js(root + 'js/pwa.js');

    window.KP = window.KP || {};
    window.KP.ready = function (fn) {
        document.addEventListener('DOMContentLoaded', function () {
            // shell.js builds the chrome on its own DOM-ready handler; queue
            // page code behind it so the top bar exists before pages touch it.
            setTimeout(fn, 0);
        });
    };
})();
