/* ==========================================================================
   Kaastro Pay — operational rails
   Ported from the CheapNaria prototype, which is the most valuable thing in
   that folder: panic mode, agent shift lock, block/unblock asymmetry, the
   transaction PIN, and the manual confirmation fallback.

   Static prototype — state lives in localStorage so it persists across pages
   and tabs in the same browser.
   ========================================================================== */
(function (global, $) {
    'use strict';

    /* ============================ Theme ============================ */

    var THEME_KEY = 'kaastro-theme';

    function currentTheme() {
        try { return localStorage.getItem(THEME_KEY) || 'light'; } catch (e) { return 'light'; }
    }
    function applyTheme(t) {
        document.documentElement.setAttribute('data-bs-theme', t);
        try { localStorage.setItem(THEME_KEY, t); } catch (e) { }
        $('#kpThemeBtn i').attr('class', t === 'dark' ? 'fas fa-sun' : 'fas fa-moon');
    }
    $(document).on('click', '#kpThemeBtn', function () {
        applyTheme(currentTheme() === 'dark' ? 'light' : 'dark');
    });

    /* ========================== Panic mode ==========================
       Platform-wide freeze. Either an agent or an admin can pull it from
       Settings. Extended past the reference: it halts trading too, because a
       rate-feed outage is exactly when you want buys and sells stopped. */

    var PANIC = {
        KEY: 'kaastro-panic', BY: 'kaastro-panic-by', AT: 'kaastro-panic-at',
        isActive: function () { try { return localStorage.getItem(this.KEY) === '1'; } catch (e) { return false; } },
        set: function (on, actor) {
            try {
                localStorage.setItem(this.KEY, on ? '1' : '0');
                if (on) {
                    localStorage.setItem(this.BY, actor || 'Unknown');
                    localStorage.setItem(this.AT, new Date().toLocaleString());
                }
            } catch (e) { }
        },
        by: function () { try { return localStorage.getItem(this.BY) || '—'; } catch (e) { return '—'; } },
        at: function () { try { return localStorage.getItem(this.AT) || '—'; } catch (e) { return '—'; } }
    };

    /* Any page that moves money calls this. Returns true if it blocked. */
    function guardPanic($mount, what) {
        if (!PANIC.isActive()) return false;
        var html = '<div class="sys-banner sys-panic">' +
            '<i class="fas fa-triangle-exclamation fs-5"></i>' +
            '<div><b>' + (what || 'Transactions') + ' are temporarily frozen.</b>' +
            '<div class="small">Platform freeze activated by ' + PANIC.by() + ' on ' + PANIC.at() +
            '. Your funds are safe — this lifts as soon as our providers are back.</div></div></div>';
        $mount.prepend(html);
        $mount.find('button[type=submit], .kp-submit').prop('disabled', true).addClass('disabled');
        return true;
    }

    /* ========================== Agent shift ==========================
       The demo agent works Mornings. Approvals lock outside the window; the
       navbar control simulates a different time so you can see both states. */

    /* The signed-in demo agent. Their permissions come from the admin's agent
       list, so revoking one there really does disable it in this portal. */
    var ME_AGENT_ID = 'AG-01';

    function myAgent() {
        try {
            return global.KP.data.agents().filter(function (a) { return a.id === ME_AGENT_ID; })[0] || null;
        } catch (e) { return null; }
    }
    function can(perm) {
        var a = myAgent();
        if (!a) return true;
        if (a.status !== 'active') return false;
        return (a.perms || []).indexOf(perm) > -1;
    }

    var SHIFT = {
        ASSIGNED: 'morning',
        KEY: 'kaastro-sim-shift',
        LABELS: { morning: 'Morning · 8:00 AM – 8:00 PM', night: 'Night · 8:00 PM – 8:00 AM' },
        sim: function () { try { return localStorage.getItem(this.KEY) || 'morning'; } catch (e) { return 'morning'; } },
        setSim: function (v) { try { localStorage.setItem(this.KEY, v); } catch (e) { } },
        inShift: function () { return this.sim() === this.ASSIGNED; }
    };

    function mountShiftControl() {
        if (!$('.top-navbar').length || $('#kpShiftBtn').length) return;
        var on = SHIFT.inShift();
        var html = '<div class="dropdown">' +
            '<button class="btn btn-sm rounded-pill px-3 border ' + (on ? 'border-success text-success' : 'border-danger text-danger') +
            '" id="kpShiftBtn" data-bs-toggle="dropdown" style="font-size:.72rem;font-weight:700">' +
            '<i class="fas ' + (SHIFT.sim() === 'morning' ? 'fa-sun' : 'fa-moon') + ' me-1"></i>' +
            (SHIFT.sim() === 'morning' ? 'Morning' : 'Night') + '</button>' +
            '<ul class="dropdown-menu dropdown-menu-end p-2">' +
            '<li><p class="small text-muted px-2 mb-2">Simulate current time</p></li>' +
            '<li><a class="dropdown-item kp-shift" href="#" data-shift="morning"><i class="fas fa-sun me-2 text-warning"></i>Morning · 8AM–8PM</a></li>' +
            '<li><a class="dropdown-item kp-shift" href="#" data-shift="night"><i class="fas fa-moon me-2 text-info"></i>Night · 8PM–8AM</a></li>' +
            '</ul></div>';
        $('.top-navbar > div:last-child').prepend(html);
    }

    $(document).on('click', '.kp-shift', function (e) {
        e.preventDefault();
        SHIFT.setSim($(this).data('shift'));
        location.reload();
    });

    /* Renders a lock banner and disables the action controls beneath it.
       Callers pass the reason, because an agent can be stopped by their shift,
       by a revoked permission, or by a suspended account. */
    function applyLock($mount, title, note) {
        $mount.prepend('<div class="sys-banner sys-shift">'
            + '<i class="fas fa-lock fs-5"></i><div><b>' + title + '</b>'
            + '<div class="small">' + note + '</div></div></div>');
        $mount.find('.kp-approve, .kp-reject, .kp-manual').prop('disabled', true).addClass('disabled');
        return true;
    }

    /* Shift-only convenience, kept for callers that have no permission to check. */
    function applyShiftLock($mount) {
        if (SHIFT.inShift()) return false;
        return applyLock($mount, 'You are outside your shift window.',
            'Your assigned shift is ' + SHIFT.LABELS[SHIFT.ASSIGNED]
            + '. Approvals, rejections and manual confirmations are disabled until it begins.');
    }

    /* ======================= Block / unblock =======================
       Agents block only; admins block and unblock. Keeping that asymmetry
       from the reference — it is a real control, not a UI quirk. */

    var BLOCK = {
        B: 'kaastro-blocked', U: 'kaastro-unblocked',
        _get: function (k) { try { return new Set(JSON.parse(localStorage.getItem(k) || '[]')); } catch (e) { return new Set(); } },
        _save: function (k, s) { try { localStorage.setItem(k, JSON.stringify(Array.from(s))); } catch (e) { } },
        isBlocked: function (u) {
            if (this._get(this.U).has(u.id)) return false;
            return u.status === 'blocked' || this._get(this.B).has(u.id);
        },
        block: function (id) {
            var b = this._get(this.B); b.add(id); this._save(this.B, b);
            var un = this._get(this.U); un.delete(id); this._save(this.U, un);
        },
        unblock: function (id) {
            var un = this._get(this.U); un.add(id); this._save(this.U, un);
            var b = this._get(this.B); b.delete(id); this._save(this.B, b);
        }
    };

    /* ======================= Transaction PIN =======================
       Four-digit gate on every debit: sell, swap, and both withdrawal types.
       Stands in for the SMS OTP a real build would send. */

    var PIN = {
        DEMO: '1234',            // prototype: one PIN for every account
        isSet: function () { return true; },
        verify: function (p) { return p === this.DEMO; }
    };

    var pinResolve = null;

    function pinModal() {
        if ($('#kpPinModal').length) return;
        $('body').append(
            '<div class="modal fade" id="kpPinModal" tabindex="-1"><div class="modal-dialog modal-dialog-centered modal-sm">' +
            '<div class="modal-content"><div class="modal-body p-4 text-center">' +
            '<div class="qa-icon qa-green mx-auto mb-3"><i class="fas fa-lock"></i></div>' +
            '<h6 class="fw-bold mb-1" id="kpPinTitle">Enter your transaction PIN</h6>' +
            '<p class="text-muted mb-3" style="font-size:.78rem" id="kpPinSub">Confirm this transaction</p>' +
            '<div class="pin-dots mb-3" id="kpPinDots">' +
            '<div class="pin-dot"></div><div class="pin-dot"></div><div class="pin-dot"></div><div class="pin-dot"></div></div>' +
            '<p class="text-danger mb-2 d-none" style="font-size:.75rem" id="kpPinErr">Incorrect PIN. Try again.</p>' +
            '<p class="text-muted mb-2" style="font-size:.72rem">Demo PIN is <b>1234</b></p>' +
            '<div class="pin-keys">' +
            [1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (n) { return '<button type="button" class="kp-pin-key" data-k="' + n + '">' + n + '</button>'; }).join('') +
            '<button type="button" class="kp-pin-clear"><i class="fas fa-xmark"></i></button>' +
            '<button type="button" class="kp-pin-key" data-k="0">0</button>' +
            '<button type="button" class="kp-pin-del"><i class="fas fa-delete-left"></i></button>' +
            '</div>' +
            '<button type="button" class="btn btn-soft w-100 mt-3" data-bs-dismiss="modal">Cancel</button>' +
            '</div></div></div></div>'
        );
    }

    var pinBuf = '';
    function renderPin() {
        $('#kpPinDots .pin-dot').each(function (i) { $(this).toggleClass('filled', i < pinBuf.length); });
    }

    $(document).on('click', '.kp-pin-key', function () {
        if (pinBuf.length >= 4) return;
        pinBuf += $(this).data('k');
        $('#kpPinErr').addClass('d-none');
        renderPin();
        if (pinBuf.length === 4) setTimeout(submitPin, 160);
    });
    $(document).on('click', '.kp-pin-del', function () { pinBuf = pinBuf.slice(0, -1); renderPin(); });
    $(document).on('click', '.kp-pin-clear', function () { pinBuf = ''; renderPin(); });

    function submitPin() {
        if (PIN.verify(pinBuf)) {
            var r = pinResolve; pinResolve = null; pinBuf = ''; renderPin();
            bootstrap.Modal.getInstance(document.getElementById('kpPinModal')).hide();
            if (r) r(true);
        } else {
            $('#kpPinErr').removeClass('d-none');
            pinBuf = ''; renderPin();
        }
    }

    /* Usage: KP.rails.requirePin('Withdraw ₦50,000').then(ok => { ... }) */
    function requirePin(subtitle) {
        pinModal();
        pinBuf = ''; renderPin();
        $('#kpPinErr').addClass('d-none');
        $('#kpPinSub').text(subtitle || 'Confirm this transaction');
        $('#kpPinTitle').text('Enter your transaction PIN');
        new bootstrap.Modal(document.getElementById('kpPinModal')).show();
        return new Promise(function (resolve) {
            pinResolve = resolve;
            $('#kpPinModal').one('hidden.bs.modal', function () { if (pinResolve) { pinResolve(false); pinResolve = null; } });
        });
    }

    /* ==================== Manual confirmation ====================
       The provider-down fallback, and the single most sensitive surface in
       the product. Every manual credit or debit demands a reason, evidence
       and the acting agent's name; anything above the threshold needs a
       second approver. An agent who can credit balances unaided is the
       largest internal fraud risk a platform like this has. */

    var MANUAL = {
        THRESHOLD_USD: 1000,
        LOG_KEY: 'kaastro-manual-log',
        log: function () { try { return JSON.parse(localStorage.getItem(this.LOG_KEY) || '[]'); } catch (e) { return []; } },
        record: function (entry) {
            var l = this.log();
            l.unshift(entry);
            try { localStorage.setItem(this.LOG_KEY, JSON.stringify(l.slice(0, 200))); } catch (e) { }
        }
    };

    function manualModal() {
        if ($('#kpManualModal').length) return;
        $('body').append(
            '<div class="modal fade" id="kpManualModal" tabindex="-1"><div class="modal-dialog modal-dialog-centered">' +
            '<div class="modal-content"><div class="modal-header">' +
            '<h5 class="modal-title"><i class="fas fa-hand text-warning me-2"></i>Manual confirmation</h5>' +
            '<button class="btn-close" data-bs-dismiss="modal"></button></div>' +
            '<div class="modal-body">' +
            '<div class="k-alert k-warn mb-3"><i class="fas fa-triangle-exclamation"></i><div>' +
            '<b>This bypasses the automated rail.</b>Use it only when a provider is down and you have verified the movement independently. ' +
            'Every manual action is permanently attributed to you.</div></div>' +
            '<div class="summary-rows mb-3" id="kpManualSummary"></div>' +
            '<div class="mb-3"><label class="form-label">Reason <span class="text-danger">*</span></label>' +
            '<select class="form-select" id="kpManualReason">' +
            '<option value="">Select a reason…</option>' +
            '<option>Provider API unavailable — confirmed on bank statement</option>' +
            '<option>Webhook missed — confirmed on block explorer</option>' +
            '<option>Provider timeout — settlement verified by phone</option>' +
            '<option>Reconciliation break resolved in user&rsquo;s favour</option>' +
            '<option>Other (describe below)</option></select></div>' +
            '<div class="mb-3"><label class="form-label">Notes <span class="text-danger">*</span></label>' +
            '<textarea class="form-control" id="kpManualNotes" rows="2" placeholder="What did you verify, and how?"></textarea></div>' +
            '<div class="mb-3"><label class="form-label">Evidence <span class="text-danger">*</span></label>' +
            '<input type="file" class="form-control" id="kpManualProof">' +
            '<div class="form-text">Bank statement, explorer screenshot, or provider correspondence.</div></div>' +
            '<div id="kpManualSecond" class="d-none"><div class="k-alert k-danger mb-2">' +
            '<i class="fas fa-user-shield"></i><div><b>Second approver required.</b>' +
            'This amount is above the ' + '$' + MANUAL.THRESHOLD_USD.toLocaleString() + ' threshold.</div></div>' +
            '<label class="form-label">Approving supervisor</label>' +
            '<select class="form-select" id="kpManualApprover"><option value="">Select…</option>' +
            '<option>Amara Obi (AG-02)</option><option>Admin User</option></select></div>' +
            '</div><div class="modal-footer">' +
            '<button class="btn btn-soft" data-bs-dismiss="modal">Cancel</button>' +
            '<button class="btn btn-primary" id="kpManualConfirm">Confirm manually</button>' +
            '</div></div></div></div>'
        );
    }

    var manualCtx = null;

    /* KP.rails.manualConfirm({ref, who, what, amount, usd, actor}).then(res => …) */
    function manualConfirm(ctx) {
        manualModal();
        manualCtx = ctx;
        $('#kpManualSummary').html(
            '<div class="sr"><span>Reference</span><span>' + ctx.ref + '</span></div>' +
            '<div class="sr"><span>User</span><span>' + ctx.who + '</span></div>' +
            '<div class="sr"><span>Action</span><span>' + ctx.what + '</span></div>' +
            '<div class="sr total"><span>Amount</span><span>' + ctx.amount + '</span></div>'
        );
        $('#kpManualSecond').toggleClass('d-none', !(ctx.usd > MANUAL.THRESHOLD_USD));
        $('#kpManualReason,#kpManualNotes,#kpManualApprover').val('');
        $('#kpManualProof').val('');
        new bootstrap.Modal(document.getElementById('kpManualModal')).show();
        return new Promise(function (resolve) { manualCtx.resolve = resolve; });
    }

    $(document).on('click', '#kpManualConfirm', function () {
        var reason = $('#kpManualReason').val();
        var notes = $('#kpManualNotes').val().trim();
        var proof = $('#kpManualProof').val();
        var needSecond = !$('#kpManualSecond').hasClass('d-none');
        var approver = $('#kpManualApprover').val();

        if (!reason || !notes || !proof || (needSecond && !approver)) {
            KP.rails.toast('Reason, notes and evidence are all required.', 'danger');
            return;
        }
        var entry = {
            ref: manualCtx.ref, what: manualCtx.what, amount: manualCtx.amount,
            actor: manualCtx.actor || 'James Bond',
            approver: needSecond ? approver : null,
            reason: reason, notes: notes,
            at: new Date().toLocaleString()
        };
        MANUAL.record(entry);
        bootstrap.Modal.getInstance(document.getElementById('kpManualModal')).hide();
        KP.rails.toast('Manually confirmed and logged against your name.', 'success');
        if (manualCtx.resolve) manualCtx.resolve(entry);
        manualCtx = null;
    });

    /* ============================ Toast ============================ */

    function toast(msg, tone) {
        var id = 'tst' + Date.now();
        if (!$('#kpToasts').length) {
            $('body').append('<div id="kpToasts" class="position-fixed bottom-0 end-0 p-3" style="z-index:2000"></div>');
        }
        var color = tone === 'danger' ? 'text-bg-danger' : tone === 'warning' ? 'text-bg-warning' : 'text-bg-dark';
        $('#kpToasts').append(
            '<div id="' + id + '" class="toast align-items-center ' + color + ' border-0 mb-2" role="alert">' +
            '<div class="d-flex"><div class="toast-body" style="font-size:.85rem;font-weight:600">' + msg + '</div>' +
            '<button class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div></div>'
        );
        var el = document.getElementById(id);
        new bootstrap.Toast(el, { delay: 3200 }).show();
        el.addEventListener('hidden.bs.toast', function () { el.remove(); });
    }

    /* ========================= Copy helper ========================= */

    $(document).on('click', '.kp-copy', function () {
        var v = $(this).data('copy') || $($(this).data('target')).text();
        navigator.clipboard.writeText(String(v).trim()).then(function () {
            toast('Copied to clipboard');
        }, function () { toast('Could not copy', 'danger'); });
    });

    /* ============================ Boot ============================ */

    $(function () {
        applyTheme(currentTheme());
        if ($('body').data('portal') === 'agent') mountShiftControl();
    });

    global.KP = global.KP || {};
    global.KP.rails = {
        theme: { current: currentTheme, apply: applyTheme },
        panic: PANIC, guardPanic: guardPanic,
        shift: SHIFT, applyShiftLock: applyShiftLock, applyLock: applyLock,
        myAgent: myAgent, can: can,
        block: BLOCK,
        pin: PIN, requirePin: requirePin,
        manual: MANUAL, manualConfirm: manualConfirm,
        toast: toast
    };

})(window, jQuery);
