/* ==========================================================================
   Kaastro Pay — back-office review drawer
   Nothing gets approved from a table row. Every queue opens the full record
   here first: copiable fields, the user behind it, and the approve / reject /
   manual controls in one place. Shared by the agent and admin portals.
   ========================================================================== */
(function (global, $) {
    'use strict';

    /* A field the operator can copy with one tap — references, hashes and
       account numbers are the whole reason this drawer exists. */
    function field(label, value, opts) {
        opts = opts || {};
        if (value == null || value === '') value = '—';
        var raw = opts.copy != null ? opts.copy : value;
        var body = opts.html ? value : String(value);
        return '<div class="rv-row">'
            + '<span class="rv-k">' + label + '</span>'
            + '<span class="rv-v' + (opts.mono ? ' mono' : '') + '">' + body
            + (opts.nocopy ? '' :
                '<button class="rv-copy kp-copy" data-copy="' + String(raw).replace(/"/g, '&quot;')
                + '" title="Copy"><i class="fas fa-copy"></i></button>')
            + '</span></div>';
    }

    function group(title, rows) {
        return '<div class="rv-group"><div class="rv-title">' + title + '</div>' + rows.join('') + '</div>';
    }

    function userBlock(u) {
        var C = KP.COUNTRIES[u.country];
        return '<div class="rv-user">'
            + '<img src="../images/' + u.avatar + '" class="rounded-circle" width="42" height="42" alt="">'
            + '<div class="min-w-0"><div class="rv-user-name">' + u.name + '</div>'
            + '<div class="rv-user-sub">' + u.id + ' · ' + C.flag + ' ' + C.name
            + ' · <span class="tier-badge tier-' + u.tier + '">Tier ' + u.tier + '</span></div></div>'
            + '<a href="users.html" class="btn btn-soft btn-sm ms-auto flex-shrink-0">'
            + '<i class="fas fa-user me-1"></i>Profile</a></div>';
    }

    /* spec: {
         title, ref, status, user, headline, headSub,
         groups: [[title, [fieldHtml…]]…],
         receipt: {…}  → passed to KP.receipt.show
         actions: bool, onApprove, onReject, onManual, locked, lockedNote
       } */
    function open(spec) {
        $('#kpReview').remove();

        var canAct = spec.actions !== false
            && ['successful', 'approved', 'rejected', 'failed', 'delivered'].indexOf(spec.status) === -1;

        var actionBar = '';
        if (canAct) {
            actionBar = spec.locked
                ? '<div class="k-alert k-warn w-100"><i class="fas fa-lock"></i><div>'
                  + (spec.lockedNote || 'You cannot act on this right now.') + '</div></div>'
                : '<button class="btn btn-soft text-danger flex-grow-1 rv-reject">'
                  + '<i class="fas fa-xmark me-1"></i>Reject</button>'
                  + '<button class="btn btn-soft flex-grow-1 rv-manual">'
                  + '<i class="fas fa-hand me-1"></i>Manual</button>'
                  + '<button class="btn btn-primary flex-grow-1 rv-approve">'
                  + '<i class="fas fa-check me-1"></i>Approve</button>';
        } else {
            actionBar = '<button class="btn btn-soft flex-grow-1" data-bs-dismiss="modal">Close</button>';
        }

        $('body').append(
            '<div class="modal fade" id="kpReview" tabindex="-1">'
            + '<div class="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-lg">'
            + '<div class="modal-content">'
            + '<div class="modal-header">'
            + '<div class="min-w-0"><h5 class="modal-title">' + spec.title + '</h5>'
            + '<div class="t-mono">' + spec.ref + '</div></div>'
            + '<button class="btn-close ms-auto" data-bs-dismiss="modal" aria-label="Close"></button></div>'

            + '<div class="modal-body">'
            + '<div class="rv-head">'
            + '<div class="min-w-0"><div class="rv-amount">' + spec.headline + '</div>'
            + '<div class="rv-sub">' + (spec.headSub || '') + '</div></div>'
            + '<span class="ms-auto flex-shrink-0">' + KP.bo.pill(spec.status) + '</span></div>'
            + (spec.user ? userBlock(spec.user) : '')
            + spec.groups.map(function (g) { return group(g[0], g[1]); }).join('')
            + (spec.footNote
                ? '<div class="k-alert k-info mt-2"><i class="fas fa-circle-info"></i><div>'
                  + spec.footNote + '</div></div>' : '')
            + '</div>'

            + '<div class="modal-footer flex-wrap gap-2">'
            + (spec.receipt
                ? '<button class="btn btn-soft w-100 rv-receipt"><i class="fas fa-receipt me-1"></i>'
                  + 'View &amp; download receipt</button>' : '')
            + '<div class="d-flex gap-2 w-100">' + actionBar + '</div>'
            + '</div></div></div></div>'
        );

        var el = document.getElementById('kpReview');
        var modal = new bootstrap.Modal(el);
        modal.show();
        el.addEventListener('hidden.bs.modal', function () { $(el).remove(); });

        $(el).on('click', '.rv-receipt', function () {
            modal.hide();
            setTimeout(function () { KP.receipt.show(spec.receipt); }, 250);
        });
        $(el).on('click', '.rv-approve', function () {
            modal.hide();
            spec.onApprove && spec.onApprove();
        });
        $(el).on('click', '.rv-reject', function () {
            modal.hide();
            spec.onReject && spec.onReject();
        });
        $(el).on('click', '.rv-manual', function () {
            modal.hide();
            setTimeout(function () { spec.onManual && spec.onManual(); }, 250);
        });

        return modal;
    }

    /* Copy every field in the drawer as one block — handy for pasting into a
       provider's support ticket. */
    function copyAll(spec) {
        var lines = [spec.title, spec.ref, spec.headline];
        spec.groups.forEach(function (g) {
            g[1].forEach(function (html) {
                var k = (html.match(/rv-k">([^<]*)</) || [])[1];
                var v = (html.match(/data-copy="([^"]*)"/) || [])[1];
                if (k && v) lines.push(k + ': ' + v.replace(/&quot;/g, '"'));
            });
        });
        return lines.join('\n');
    }

    global.KP = global.KP || {};
    global.KP.review = { open: open, field: field, copyAll: copyAll };

})(window, jQuery);
