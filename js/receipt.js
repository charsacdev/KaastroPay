/* ==========================================================================
   Kaastro Pay — receipt sheet
   One branded receipt used by transactions, bills and every trade confirmation.
   Downloads as a real PNG via html2canvas; falls back to the browser's print
   dialog if the library did not load.
   ========================================================================== */
(function (global, $) {
    'use strict';

    var LOGO = '';   // resolved relative to the page that mounts the modal

    function logoPath() {
        if (LOGO) return LOGO;
        LOGO = (location.pathname.indexOf('/dashboard/') > -1
             || location.pathname.indexOf('/agent/') > -1
             || location.pathname.indexOf('/admin/') > -1) ? '../images/logo.png' : 'images/logo.png';
        return LOGO;
    }

    function row(k, v) {
        return '<div class="rs-row"><span>' + k + '</span><span>' + v + '</span></div>';
    }

    /* spec: { title, amount, sub, status, rows: [[k,v],…], note } */
    function build(spec) {
        var ok = spec.status === 'successful' || spec.status === 'delivered';
        return '<div class="receipt-sheet" id="kpReceiptSheet">'
            + '<img src="' + logoPath() + '" alt="Kaastro Pay" class="rs-logo">'
            + '<div class="rs-tag">Transaction receipt</div>'
            + '<div class="rs-div"></div>'
            + '<div class="rs-amt">' + spec.amount + '</div>'
            + '<div class="rs-sub">' + (spec.sub || '') + '</div>'
            + '<div class="text-center mt-2"><span class="rs-stamp" style="'
            + (ok ? '' : 'border-color:#b45309;color:#b45309') + '">'
            + (spec.status || 'successful') + '</span></div>'
            + '<div class="rs-div"></div>'
            + spec.rows.map(function (r) { return row(r[0], r[1]); }).join('')
            + '<div class="rs-div"></div>'
            + '<div class="rs-foot">' + (spec.note || 'Keep this receipt for your records.') + '<br>'
            + 'kaastropay.com · support@kaastropay.com</div>'
            + '</div>';
    }

    function modal(spec) {
        $('#kpReceiptModal').remove();
        $('body').append(
            '<div class="modal fade" id="kpReceiptModal" tabindex="-1">'
            + '<div class="modal-dialog modal-dialog-centered modal-dialog-scrollable">'
            + '<div class="modal-content"><div class="modal-header">'
            + '<h5 class="modal-title">' + (spec.title || 'Receipt') + '</h5>'
            + '<button class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button></div>'
            + '<div class="modal-body">' + build(spec) + '</div>'
            + '<div class="modal-footer">'
            + '<button class="btn btn-soft flex-grow-1" id="kpRxShare"><i class="fas fa-share-nodes me-1"></i>Share</button>'
            + '<button class="btn btn-primary flex-grow-1" id="kpRxDownload"><i class="fas fa-download me-1"></i>Download</button>'
            + '</div></div></div></div>'
        );
        new bootstrap.Modal(document.getElementById('kpReceiptModal')).show();

        $('#kpRxShare').on('click', function () {
            var text = spec.title + ' · ' + spec.amount + ' · ' + (spec.ref || '');
            if (navigator.share) { navigator.share({ title: 'Kaastro Pay receipt', text: text }); }
            else { navigator.clipboard.writeText(text); KP.rails.toast('Receipt details copied'); }
        });

        $('#kpRxDownload').on('click', function () { download(spec); });
    }

    function download(spec) {
        var node = document.getElementById('kpReceiptSheet');
        var name = 'kaastro-receipt-' + (spec.ref || Date.now()) + '.png';

        if (typeof html2canvas !== 'function') { printFallback(); return; }

        KP.rails.toast('Preparing your receipt…');
        html2canvas(node, { backgroundColor: '#ffffff', scale: 2, useCORS: true, logging: false })
            .then(function (canvas) {
                canvas.toBlob(function (blob) {
                    if (!blob) { printFallback(); return; }
                    var url = URL.createObjectURL(blob);
                    var a = document.createElement('a');
                    a.href = url; a.download = name;
                    document.body.appendChild(a); a.click();
                    document.body.removeChild(a);
                    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
                    KP.rails.toast('Receipt saved as ' + name);
                }, 'image/png');
            })
            .catch(printFallback);
    }

    function printFallback() {
        var html = document.getElementById('kpReceiptSheet').outerHTML;
        var w = window.open('', '_blank', 'width=460,height=760');
        if (!w) { KP.rails.toast('Allow pop-ups to save the receipt.', 'warning'); return; }
        w.document.write('<!doctype html><html><head><title>Kaastro Pay receipt</title>'
            + '<link rel="stylesheet" href="' + location.origin
            + location.pathname.replace(/[^/]*$/, '') + '../css/kaastro.css">'
            + '<style>body{background:#fff;padding:18px;font-family:system-ui,sans-serif}</style>'
            + '</head><body>' + html + '</body></html>');
        w.document.close();
        setTimeout(function () { w.focus(); w.print(); }, 500);
    }

    global.KP = global.KP || {};
    global.KP.receipt = { show: modal, build: build, download: download };

})(window, jQuery);
