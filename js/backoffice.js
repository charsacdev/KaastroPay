/* ==========================================================================
   Kaastro Pay — back-office building blocks
   Admin is a strict superset of agent, so both portals render the same
   queues from this one module. The only difference is `role`: admins get
   unblock, override and destructive actions; agents do not.
   ========================================================================== */
(function (global, $) {
    'use strict';

    var F;
    $(function () { F = KP.fmt; });

    /* ---------------------------- primitives ---------------------------- */

    function pill(status) {
        var m = {
            successful: 'pill-success', approved: 'pill-success', verified: 'pill-success',
            active: 'pill-success', delivered: 'pill-success',
            pending: 'pill-pending', unverified: 'pill-neutral',
            confirming: 'pill-confirming', processing: 'pill-processing',
            failed: 'pill-failed', rejected: 'pill-rejected', blocked: 'pill-failed',
            suspended: 'pill-failed', manual: 'pill-manual', open: 'pill-pending', resolved: 'pill-success',
            invited: 'pill-confirming'
        };
        return '<span class="pill ' + (m[status] || 'pill-neutral') + '">' + status + '</span>';
    }

    function userCell(u) {
        return '<div class="d-flex align-items-center gap-2">'
            + '<img src="../images/' + u.avatar + '" class="rounded-circle" width="30" height="30" alt="">'
            + '<div style="line-height:1.25"><div class="t-strong">' + u.name + '</div>'
            + '<div class="t-mono">' + u.id + ' · ' + KP.COUNTRIES[u.country].flag + ' ' + u.country + '</div></div></div>';
    }

    function assetCell(sym, amount, sub) {
        var a = KP.ASSETS[sym];
        return '<div class="d-flex align-items-center gap-2">'
            + '<span class="asset-icon sm" style="background:' + a.color + '">' + sym.slice(0, 3) + '</span>'
            + '<div style="line-height:1.25"><div class="t-strong">' + KP.fmt.crypto(amount, sym) + '</div>'
            + (sub ? '<div class="t-mono">' + sub + '</div>' : '') + '</div></div>';
    }

    function trunc(s, n) {
        if (!s) return '—';
        n = n || 16;
        return s.length <= n ? s : s.slice(0, n / 2) + '…' + s.slice(-n / 2);
    }

    /* Stat tiles used on both dashboards. */
    function statTile(o) {
        return '<div class="stat-tile">'
            + '<div class="st-top"><span class="st-label">' + o.label + '</span>'
            + '<span class="st-icon qa-' + (o.tone || 'green') + '"><i class="fas ' + o.icon + '"></i></span></div>'
            + '<div class="st-value">' + o.value + '</div>'
            + (o.delta != null
                ? '<div class="st-delta ' + (o.delta >= 0 ? 'text-up' : 'text-down') + '">'
                + (o.delta >= 0 ? '▲ +' : '▼ ') + Math.abs(o.delta).toFixed(1) + '% <span class="st-note fw-normal">this week</span></div>'
                : '<div class="st-note">' + (o.note || '') + '</div>')
            + '</div>';
    }

    /* A queue table: chip filters on top of a Bootstrap DataTable, so every
       back-office list gets search, sort, pagination and responsive collapse
       from one implementation. */
    var qSeq = 0;

    function queue(opts) {
        var $el = opts.el;
        var id = 'dt' + (++qSeq);
        var state = { filter: opts.filters[0].id };
        var dt = null;

        $el.html(
            '<div class="card p-3">'
            + '<div class="filterbar mb-3">'
            + opts.filters.map(function (f, i) {
                return '<button class="chip-btn' + (i === 0 ? ' active' : '') + '" data-f="' + f.id + '">'
                    + f.label + (f.count != null ? ' <span class="opacity-75">' + f.count + '</span>' : '') + '</button>';
            }).join('')
            + '</div>'
            + '<div class="table-responsive"><table id="' + id + '" class="table w-100 dt-nowrap"><thead><tr>'
            + opts.columns.map(function (c) { return '<th' + (c.right ? ' class="text-end"' : '') + '>' + c.title + '</th>'; }).join('')
            + '</tr></thead><tbody></tbody></table></div>'
            + '</div>'
        );

        function keyOf(r) { return r.ref || r.id; }

        function rowsFor() {
            return opts.rows().filter(function (r) {
                return state.filter === 'all' || opts.match(r, state.filter);
            });
        }

        /* The visible row index is what the action handlers look up, so the
           filtered set is cached alongside the table on every draw. */
        function draw() {
            var rows = rowsFor();
            $el.data('rows', rows);
            var data = rows.map(function (r) {
                return opts.columns.map(function (c) { return c.cell(r); });
            });
            if (dt) { dt.clear(); dt.rows.add(data); dt.draw(false); return; }

            dt = $('#' + id).DataTable({
                data: data,
                autoWidth: false,
                responsive: true,
                order: [],
                pageLength: 10,
                lengthMenu: [10, 25, 50],
                language: {
                    search: '', searchPlaceholder: 'Search…',
                    lengthMenu: '_MENU_ per page',
                    info: '_START_–_END_ of _TOTAL_',
                    infoEmpty: 'Nothing here',
                    zeroRecords: '<div class="empty-state"><i class="fas ' + (opts.emptyIcon || 'fa-inbox')
                        + '"></i><p>' + (opts.empty || 'Nothing in this queue.') + '</p></div>',
                    emptyTable: '<div class="empty-state"><i class="fas ' + (opts.emptyIcon || 'fa-inbox')
                        + '"></i><p>' + (opts.empty || 'Nothing in this queue.') + '</p></div>',
                    paginate: { previous: '<i class="fas fa-chevron-left"></i>', next: '<i class="fas fa-chevron-right"></i>' }
                },
                columnDefs: [
                    { targets: opts.columns.map(function (c, i) { return c.right ? i : -1; })
                        .filter(function (i) { return i >= 0; }), className: 'text-end' },
                    { targets: '_all', orderable: true }
                ]
            });
        }

        $el.on('click', '.chip-btn', function () {
            $el.find('.chip-btn').removeClass('active');
            $(this).addClass('active');
            state.filter = $(this).data('f');
            draw();
        });

        draw();

        return {
            repaint: draw,
            /* Handlers resolve their row from the key stamped on the button, so
               it keeps working when responsive mode moves cells into a child row. */
            rowOf: function (el) {
                var k = $(el).closest('[data-ref]').data('ref') || $(el).data('ref');
                return ($el.data('rows') || []).filter(function (r) { return keyOf(r) === k; })[0];
            }
        };
    }

    /* Approve / reject / manual buttons, gated by role and shift. */
    function actions(r, role) {
        var terminal = ['successful', 'approved', 'rejected', 'failed'].indexOf(r.status) !== -1;
        if (terminal) return '<span class="text-muted" style="font-size:.75rem">—</span>';
        var k = r.ref || r.id;
        return '<div class="d-flex gap-1 justify-content-end" data-ref="' + k + '">'
            + '<button class="btn btn-sm btn-primary kp-approve" title="Approve"><i class="fas fa-check"></i></button>'
            + '<button class="btn btn-sm btn-soft text-danger kp-reject" title="Reject"><i class="fas fa-xmark"></i></button>'
            + '<button class="btn btn-sm btn-soft kp-manual" title="Confirm manually"><i class="fas fa-hand"></i></button>'
            + '</div>';
    }

    /* Wire up the three action buttons for a queue. */
    function wireActions($el, q, role, describe) {
        $el.on('click', '.kp-approve', function () {
            var r = q.rowOf(this);
            if (!r) return;
            r.status = 'successful';
            KP.rails.toast('Approved ' + r.ref + ' — released to the automated rail.');
            q.repaint();
        });

        $el.on('click', '.kp-reject', function () {
            var r = q.rowOf(this);
            if (!r) return;
            r.status = 'rejected';
            KP.rails.toast('Rejected ' + r.ref + '. The user has been notified.', 'warning');
            q.repaint();
        });

        $el.on('click', '.kp-manual', function () {
            var r = q.rowOf(this);
            if (!r) return;
            var d = describe(r);
            KP.rails.manualConfirm({
                ref: r.ref, who: r.user.name, what: d.what, amount: d.amount, usd: d.usd,
                actor: role === 'admin' ? 'Admin User' : 'James Bond'
            }).then(function (entry) {
                r.status = 'successful';
                r.manual = true;
                q.repaint();
            });
        });
    }

    /* Sparkline / bar chart for the admin dashboard. */
    function barChart(canvas, labels, values, accent) {
        var ctx = canvas.getContext('2d');
        var dpr = window.devicePixelRatio || 1;
        var w = canvas.clientWidth, h = canvas.height / (canvas._dpr || 1) || 160;
        canvas.width = w * dpr; canvas.height = h * dpr; canvas._dpr = dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);

        var max = Math.max.apply(null, values) * 1.15 || 1;
        var pad = 22, bw = (w - pad) / values.length;
        var muted = getComputedStyle(document.body).getPropertyValue('--text-muted').trim();
        var grid = getComputedStyle(document.body).getPropertyValue('--border-color').trim();

        ctx.strokeStyle = grid; ctx.lineWidth = 1;
        for (var g = 0; g <= 3; g++) {
            var yy = ((h - pad) / 3) * g;
            ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(w, yy); ctx.stroke();
        }

        values.forEach(function (v, i) {
            var bh = (v / max) * (h - pad);
            var x = i * bw + bw * 0.22;
            var bwid = bw * 0.56;
            var y = (h - pad) - bh;
            var grad = ctx.createLinearGradient(0, y, 0, h - pad);
            grad.addColorStop(0, accent || '#10b981');
            grad.addColorStop(1, 'rgba(16,185,129,.28)');
            ctx.fillStyle = grad;
            var rr = Math.min(5, bwid / 2);
            ctx.beginPath();
            ctx.moveTo(x, h - pad);
            ctx.lineTo(x, y + rr);
            ctx.quadraticCurveTo(x, y, x + rr, y);
            ctx.lineTo(x + bwid - rr, y);
            ctx.quadraticCurveTo(x + bwid, y, x + bwid, y + rr);
            ctx.lineTo(x + bwid, h - pad);
            ctx.closePath(); ctx.fill();

            ctx.fillStyle = muted;
            ctx.font = '600 10px "Plus Jakarta Sans", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(labels[i], x + bwid / 2, h - 6);
        });
    }

    function donut(canvas, slices) {
        var ctx = canvas.getContext('2d');
        var dpr = window.devicePixelRatio || 1;
        var w = canvas.clientWidth, h = 170;
        canvas.width = w * dpr; canvas.height = h * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);
        var total = slices.reduce(function (s, x) { return s + x.v; }, 0) || 1;
        var cx = w / 2, cy = h / 2, r = Math.min(w, h) / 2 - 8, ir = r * 0.62;
        var a0 = -Math.PI / 2;
        slices.forEach(function (s) {
            var a1 = a0 + (s.v / total) * Math.PI * 2;
            ctx.beginPath();
            ctx.arc(cx, cy, r, a0, a1);
            ctx.arc(cx, cy, ir, a1, a0, true);
            ctx.closePath();
            ctx.fillStyle = s.c; ctx.fill();
            a0 = a1;
        });
        ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--text-main').trim();
        ctx.font = '800 15px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(slices.length + ' types', cx, cy);
    }

    /* Scroll dots for the mobile stat strip — the strip is a scroll container
       under md, so the dots are the only affordance telling you there is more. */
    function stripDots(sel) {
        var $strip = $(sel);
        var $dots = $('.strip-dots[data-for="' + sel.replace('#', '') + '"]');
        if (!$strip.length || !$dots.length) return;
        var n = $strip.children().length;
        $dots.html(new Array(n).fill(0).map(function (_, i) {
            return '<span class="' + (i === 0 ? 'on' : '') + '"></span>';
        }).join(''));
        $strip.on('scroll', function () {
            var w = this.scrollWidth / n;
            var i = Math.min(n - 1, Math.round(this.scrollLeft / w));
            $dots.children().removeClass('on').eq(i).addClass('on');
        });
    }

    /* A plain modal, shared by every back-office page. */
    function showModal(title, body, size) {
        $('#boModal').remove();
        $('body').append('<div class="modal fade" id="boModal" tabindex="-1">'
            + '<div class="modal-dialog modal-dialog-centered modal-dialog-scrollable ' + (size || '') + '">'
            + '<div class="modal-content"><div class="modal-header">'
            + '<h5 class="modal-title">' + title + '</h5>'
            + '<button class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button></div>'
            + '<div class="modal-body">' + body + '</div></div></div></div>');
        var el = document.getElementById('boModal');
        new bootstrap.Modal(el).show();
        el.addEventListener('hidden.bs.modal', function () { $(el).remove(); });
    }

    global.KP = global.KP || {};
    global.KP.showModal = showModal;
    global.KP.bo = {
        pill: pill, userCell: userCell, assetCell: assetCell, trunc: trunc,
        statTile: statTile, stripDots: stripDots,
        queue: queue, actions: actions, wireActions: wireActions,
        barChart: barChart, donut: donut
    };

})(window, jQuery);
