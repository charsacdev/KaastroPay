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

    /* Two surfaces, two defaults. The wallet is dark; the marketing and legal
       pages are light, the way both are drawn. A page states its own default
       with <html data-theme-default="light"> and the app falls back to dark,
       so neither has to know about the other. A theme the user actually chose
       always wins over both. */
    function defaultTheme() {
        return document.documentElement.getAttribute('data-theme-default') || 'dark';
    }
    function storedTheme() {
        try { return localStorage.getItem(THEME_KEY); } catch (e) { return null; }
    }
    function currentTheme() {
        return storedTheme() || defaultTheme();
    }
    /* persist defaults to true: only an explicit choice should be written, or
       the first page a visitor happens to land on would pin their theme for
       every page after it. */
    function applyTheme(t, persist) {
        document.documentElement.setAttribute('data-bs-theme', t);
        if (persist !== false) { try { localStorage.setItem(THEME_KEY, t); } catch (e) { } }
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
            '<div><b class="hd">' + (what || 'Transactions') + ' are temporarily frozen.</b>' +
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
            + '<i class="fas fa-lock fs-5"></i><div><b class="hd">' + title + '</b>'
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
            '<i class="fas fa-user-shield"></i><div><b class="hd">Second approver required.</b>' +
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

    /* ================== Blocked transactions ==================
       Blocking one transaction is not the same as blocking an account. A user
       can be in good standing and still have a single movement that must not
       settle — a duplicate, a chargeback risk, a compliance hold on one
       counterparty. This keeps the block on the transaction, with the reason
       attached, so anyone who opens it afterwards sees why it stopped and who
       stopped it rather than guessing.

       Only an admin can place or lift one. An agent sees the block and the
       reason, and cannot act on the row. */

    var TXBLOCK = {
        KEY: 'kaastro-blocked-tx',
        REASONS: [
            'Suspected fraud — under investigation',
            'Duplicate of an earlier transaction',
            'Compliance hold — sanctions or PEP screening',
            'Chargeback or reversal risk',
            'Counterparty account under review',
            'Awaiting source-of-funds evidence',
            'Other (described below)'
        ],
        all: function () {
            try { return JSON.parse(localStorage.getItem(this.KEY) || '{}') || {}; } catch (e) { return {}; }
        },
        save: function (m) {
            try { localStorage.setItem(this.KEY, JSON.stringify(m)); } catch (e) { }
        },
        get: function (ref) { return this.all()[ref] || null; },
        isBlocked: function (ref) { return !!this.all()[ref]; },
        count: function () { return Object.keys(this.all()).length; },
        list: function () {
            var m = this.all();
            return Object.keys(m).map(function (k) { return m[k]; })
                .sort(function (a, b) { return (b.atMs || 0) - (a.atMs || 0); });
        },
        block: function (entry) {
            var m = this.all();
            m[entry.ref] = entry;
            this.save(m);
            return entry;
        },
        unblock: function (ref, by, note) {
            var m = this.all();
            var e = m[ref];
            delete m[ref];
            this.save(m);
            return e ? $.extend({}, e, { liftedBy: by, liftNote: note }) : null;
        }
    };

    var blockCtx = null;

    function blockModal() {
        if ($('#kpBlockModal').length) return;
        $('body').append(
            '<div class="modal fade" id="kpBlockModal" tabindex="-1">' +
            '<div class="modal-dialog modal-dialog-centered modal-dialog-scrollable">' +
            '<div class="modal-content"><div class="modal-header">' +
            '<h5 class="modal-title"><i class="fas fa-ban text-danger me-2"></i>Block this transaction</h5>' +
            '<button class="btn-close" data-bs-dismiss="modal"></button></div>' +
            '<div class="modal-body">' +
            '<div class="k-alert k-danger mb-3"><i class="fas fa-triangle-exclamation"></i><div>' +
            '<b class="hd">This stops the transaction, not the account.</b>' +
            'It cannot be approved, rejected or manually confirmed while blocked. The user ' +
            'is told it is under review; they are not told why.</div></div>' +
            '<div class="summary-rows mb-3" id="kpBlockSummary"></div>' +
            '<div class="mb-3"><label class="form-label">Reason <span class="text-danger">*</span></label>' +
            '<select class="form-select" id="kpBlockReason">' +
            '<option value="">Select a reason…</option>' +
            TXBLOCK.REASONS.map(function (r) { return '<option>' + r + '</option>'; }).join('') +
            '</select></div>' +
            '<div class="mb-3"><label class="form-label">Details <span class="text-danger">*</span></label>' +
            '<textarea class="form-control" id="kpBlockNotes" rows="3" ' +
            'placeholder="What prompted the block, and what has to happen before it can be lifted."></textarea>' +
            '<div class="form-text">Whoever lifts this will read your note first.</div></div>' +
            '<div class="mb-3"><label class="form-label">Notify the user</label>' +
            '<div class="form-check form-switch"><input class="form-check-input" type="checkbox" ' +
            'id="kpBlockNotify" checked><label class="form-check-label" for="kpBlockNotify" ' +
            'style="font-size:.83rem">Tell them it is under review</label></div></div>' +
            '<div class="mb-2"><label class="form-label">Evidence</label><div id="kpBlockAttach"></div></div>' +
            '</div><div class="modal-footer">' +
            '<button class="btn btn-soft" data-bs-dismiss="modal">Cancel</button>' +
            '<button class="btn btn-danger" id="kpBlockGo">Block transaction</button>' +
            '</div></div></div></div>'
        );
    }

    /* KP.rails.blockTransaction({ref, who, what, amount, actor}) -> Promise */
    function blockTransaction(ctx) {
        blockModal();
        blockCtx = ctx;
        $('#kpBlockSummary').html(
            '<div class="sr"><span>Reference</span><span>' + ctx.ref + '</span></div>' +
            '<div class="sr"><span>User</span><span>' + ctx.who + '</span></div>' +
            '<div class="sr"><span>Transaction</span><span>' + ctx.what + '</span></div>' +
            '<div class="sr total"><span>Amount</span><span>' + ctx.amount + '</span></div>'
        );
        $('#kpBlockReason,#kpBlockNotes').val('');
        $('#kpBlockNotify').prop('checked', true);
        $('#kpBlockAttach').html(attachField('block', {
            label: 'Attach supporting evidence',
            hint: 'Screening result, provider notice or internal memo'
        }));
        new bootstrap.Modal(document.getElementById('kpBlockModal')).show();
        return new Promise(function (resolve) { blockCtx.resolve = resolve; });
    }

    $(document).on('click', '#kpBlockGo', function () {
        var reason = $('#kpBlockReason').val();
        var notes = ($('#kpBlockNotes').val() || '').trim();
        if (!reason || !notes) {
            toast('A reason and your notes are both required.', 'danger');
            return;
        }
        var entry = TXBLOCK.block({
            ref: blockCtx.ref,
            who: blockCtx.who,
            what: blockCtx.what,
            amount: blockCtx.amount,
            reason: reason,
            notes: notes,
            notified: $('#kpBlockNotify').is(':checked'),
            evidence: attached('block').map(function (f) { return f.name; }),
            by: blockCtx.actor || 'Admin User',
            at: new Date().toLocaleString(),
            atMs: Date.now()
        });
        clearAttached('block');
        bootstrap.Modal.getInstance(document.getElementById('kpBlockModal')).hide();
        toast('Transaction ' + entry.ref + ' blocked.', 'danger');
        if (blockCtx.resolve) blockCtx.resolve(entry);
        blockCtx = null;
    });

    /* Lifting takes a note too — a block that is quietly removed is worse than
       one that was never placed. */
    function unblockTransaction(ref, actor) {
        var b = TXBLOCK.get(ref);
        if (!b) return Promise.resolve(null);
        return new Promise(function (resolve) {
            sheet('Lift the block on ' + ref + '?',
                '<div class="summary-rows mb-3">'
                + '<div class="sr"><span>Blocked by</span><span>' + b.by + '</span></div>'
                + '<div class="sr"><span>When</span><span>' + b.at + '</span></div>'
                + '<div class="sr total"><span>Reason</span><span>' + b.reason + '</span></div></div>'
                + '<p class="text-muted" style="font-size:.83rem">' + b.notes + '</p>'
                + '<label class="form-label">Why is it safe to lift?</label>'
                + '<textarea class="form-control mb-3" id="kpUnblockNote" rows="2" '
                + 'placeholder="What changed since the block was placed."></textarea>'
                + '<button class="btn btn-primary w-100" id="kpUnblockGo">Lift the block</button>');
            $(document).off('click.unblock').on('click.unblock', '#kpUnblockGo', function () {
                var note = ($('#kpUnblockNote').val() || '').trim();
                if (!note) { toast('Say why it is safe to lift.', 'danger'); return; }
                var e = TXBLOCK.unblock(ref, actor || 'Admin User', note);
                closeSheet();
                toast('Block lifted on ' + ref + '.', 'success');
                resolve(e);
            });
        });
    }

    /* ====================== Escalation to an admin ======================
       The honest alternative to a manual confirmation. When an agent is not
       certain — the evidence is thin, the amount is large, the user's story
       does not reconcile — the safe move is to hand it up rather than credit
       a balance and hope. Escalations queue for an admin, carry the same
       evidence a manual confirmation would have needed, and are attributed to
       the agent who raised them. */

    var ESCALATION = {
        KEY: 'kaastro-escalations',
        all: function () {
            try { return JSON.parse(localStorage.getItem(this.KEY) || '[]'); } catch (e) { return []; }
        },
        save: function (list) {
            try { localStorage.setItem(this.KEY, JSON.stringify(list.slice(0, 200))); } catch (e) { }
        },
        add: function (entry) {
            var l = this.all();
            l.unshift(entry);
            this.save(l);
            return entry;
        },
        open: function () {
            return this.all().filter(function (e) { return e.status === 'open'; });
        },
        /* A deposit escalation often exists precisely because the recorded
           amount is wrong — the provider reported one figure, the statement
           shows another. An admin can correct it before deciding, and the
           original is kept alongside so the change is never silent. */
        amountParts: function (s) {
            var m = String(s || '').match(/^([^\d\-]*)([\d,.\-]+)(.*)$/);
            if (!m) return null;
            return { prefix: m[1], value: parseFloat(m[2].replace(/,/g, '')) || 0, suffix: m[3] };
        },
        setAmount: function (id, newValue, by, note) {
            var l = this.all(), self = this;
            l.forEach(function (e) {
                if (e.id !== id) return;
                var p = self.amountParts(e.amount);
                if (!p) return;
                if (e.amountOriginal == null) e.amountOriginal = e.amount;
                var dp = p.value % 1 ? 2 : (String(p.value).length > 6 ? 2 : 2);
                e.amount = p.prefix + Number(newValue).toLocaleString('en-US',
                    { minimumFractionDigits: dp, maximumFractionDigits: dp }) + p.suffix;
                e.amountEditedBy = by;
                e.amountEditedAt = new Date().toLocaleString();
                e.amountEditNote = note || '';
            });
            this.save(l);
            return l.filter(function (e) { return e.id === id; })[0] || null;
        },
        resolve: function (id, outcome, by, note) {
            var l = this.all();
            l.forEach(function (e) {
                if (e.id === id) {
                    e.status = outcome;          /* 'approved' | 'declined' */
                    e.decidedBy = by;
                    e.decidedAt = new Date().toLocaleString();
                    e.decisionNote = note || '';
                }
            });
            this.save(l);
        }
    };

    var escalateCtx = null;

    function escalateModal() {
        if ($('#kpEscalateModal').length) return;
        $('body').append(
            '<div class="modal fade" id="kpEscalateModal" tabindex="-1">' +
            '<div class="modal-dialog modal-dialog-centered modal-dialog-scrollable">' +
            '<div class="modal-content"><div class="modal-header">' +
            '<h5 class="modal-title"><i class="fas fa-arrow-up-right-dots text-warning me-2"></i>' +
            'Escalate to an admin</h5>' +
            '<button class="btn-close" data-bs-dismiss="modal"></button></div>' +
            '<div class="modal-body">' +
            '<div class="k-alert k-info mb-3"><i class="fas fa-circle-info"></i><div>' +
            '<b class="hd">This is the safe path when you are not sure.</b>' +
            'Nothing moves until an admin decides. The user keeps waiting, but no ' +
            'balance is credited on thin evidence.</div></div>' +
            '<div class="summary-rows mb-3" id="kpEscSummary"></div>' +
            '<div class="mb-3"><label class="form-label">Why are you escalating? ' +
            '<span class="text-danger">*</span></label>' +
            '<select class="form-select" id="kpEscReason">' +
            '<option value="">Select a reason…</option>' +
            '<option>Evidence is inconclusive</option>' +
            '<option>Amount is above my comfort or daily cap</option>' +
            '<option>User&rsquo;s account is under review</option>' +
            '<option>Possible duplicate or double credit</option>' +
            '<option>Suspected fraud — needs compliance</option>' +
            '<option>Provider dispute, outcome unclear</option>' +
            '<option>Other (describe below)</option></select></div>' +
            '<div class="mb-3"><label class="form-label">What have you checked? ' +
            '<span class="text-danger">*</span></label>' +
            '<textarea class="form-control" id="kpEscNotes" rows="3" ' +
            'placeholder="What you verified, what does not add up, what you need decided."></textarea></div>' +
            '<div class="mb-3"><label class="form-label">Priority</label>' +
            '<div class="seg" id="kpEscPriority">' +
            '<button type="button" data-p="normal" class="active">Normal</button>' +
            '<button type="button" data-p="high">High</button>' +
            '<button type="button" data-p="urgent">Urgent</button></div></div>' +
            '<div class="mb-2"><label class="form-label">Evidence</label>' +
            '<div id="kpEscAttach"></div></div>' +
            '</div><div class="modal-footer">' +
            '<button class="btn btn-soft" data-bs-dismiss="modal">Cancel</button>' +
            '<button class="btn btn-primary" id="kpEscSend">Send to admin</button>' +
            '</div></div></div></div>'
        );
    }

    /* KP.rails.escalate({ref, who, what, amount, usd, actor, kind}) -> Promise */
    function escalate(ctx) {
        escalateModal();
        escalateCtx = ctx;
        $('#kpEscSummary').html(
            '<div class="sr"><span>Reference</span><span>' + ctx.ref + '</span></div>' +
            '<div class="sr"><span>User</span><span>' + ctx.who + '</span></div>' +
            '<div class="sr"><span>Action requested</span><span>' + ctx.what + '</span></div>' +
            '<div class="sr total"><span>Amount</span><span>' + ctx.amount + '</span></div>'
        );
        $('#kpEscReason,#kpEscNotes').val('');
        $('#kpEscPriority button').removeClass('active').first().addClass('active');
        $('#kpEscAttach').html(attachField('escalate', {
            label: 'Attach what you looked at',
            hint: 'Statement, explorer page or provider email · PNG, JPG or PDF'
        }));
        new bootstrap.Modal(document.getElementById('kpEscalateModal')).show();
        return new Promise(function (resolve) { escalateCtx.resolve = resolve; });
    }

    $(document).on('click', '#kpEscPriority button', function () {
        $('#kpEscPriority button').removeClass('active');
        $(this).addClass('active');
    });

    $(document).on('click', '#kpEscSend', function () {
        var reason = $('#kpEscReason').val();
        var notes = ($('#kpEscNotes').val() || '').trim();
        if (!reason || !notes) {
            toast('A reason and your notes are both required.', 'danger');
            return;
        }
        var files = attached('escalate');
        var entry = ESCALATION.add({
            id: 'ESC-' + Math.floor(10000 + Math.random() * 89999),
            ref: escalateCtx.ref,
            who: escalateCtx.who,
            what: escalateCtx.what,
            amount: escalateCtx.amount,
            usd: escalateCtx.usd || 0,
            kind: escalateCtx.kind || 'manual',
            reason: reason,
            notes: notes,
            priority: $('#kpEscPriority button.active').data('p'),
            evidence: files.map(function (f) { return f.name; }),
            raisedBy: escalateCtx.actor || (myAgent() ? myAgent().name : 'Agent'),
            raisedAt: new Date().toLocaleString(),
            status: 'open'
        });
        clearAttached('escalate');
        bootstrap.Modal.getInstance(document.getElementById('kpEscalateModal')).hide();
        toast('Escalated to an admin as ' + entry.id + '.', 'success');
        if (escalateCtx.resolve) escalateCtx.resolve(entry);
        escalateCtx = null;
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

    /* =========================== Attachments ===========================
       Support runs on evidence — a screenshot of the bank app, a block explorer
       page, a photo of a receipt. One control, used by the user's ticket form,
       the agent's and admin's reply box, and the escalation dialog, so an
       attachment behaves and validates the same wherever it is offered. */

    var ATTACH = {
        MAX_MB: 5,
        MAX_FILES: 4,
        ACCEPT: 'image/png,image/jpeg,image/webp,application/pdf',
        store: {}          /* id -> [ {name, size, type} ] */
    };

    function humanSize(b) {
        if (b >= 1048576) return (b / 1048576).toFixed(1) + ' MB';
        if (b >= 1024) return Math.round(b / 1024) + ' KB';
        return b + ' B';
    }

    /* Renders the field. `id` must be unique on the page; read the result back
       with KP.rails.attached(id). */
    function attachField(id, opts) {
        opts = opts || {};
        ATTACH.store[id] = [];
        return '<div class="kp-attach" data-attach="' + id + '">'
            + '<input type="file" class="kp-attach-input" hidden multiple'
            + ' accept="' + (opts.accept || ATTACH.ACCEPT) + '">'
            + '<button type="button" class="kp-attach-drop">'
            + '<i class="fas fa-paperclip"></i>'
            + '<span><b>' + (opts.label || 'Attach evidence') + '</b>'
            + '<small>' + (opts.hint || 'PNG, JPG or PDF · up to '
                + ATTACH.MAX_MB + 'MB each · ' + ATTACH.MAX_FILES + ' files')
            + '</small></span></button>'
            + '<div class="kp-attach-list"></div></div>';
    }

    function attached(id) { return (ATTACH.store[id] || []).slice(); }
    function clearAttached(id) {
        ATTACH.store[id] = [];
        $('.kp-attach[data-attach="' + id + '"] .kp-attach-list').empty();
        $('.kp-attach[data-attach="' + id + '"] .kp-attach-input').val('');
    }

    function paintAttachList($wrap) {
        var id = $wrap.data('attach');
        var files = ATTACH.store[id] || [];
        $wrap.find('.kp-attach-list').html(files.map(function (f, i) {
            var isImg = f.type.indexOf('image/') === 0;
            return '<div class="kp-attach-item">'
                + '<span class="qa-icon qa-green sm"><i class="fas '
                + (isImg ? 'fa-image' : 'fa-file-pdf') + '"></i></span>'
                + '<span class="min-w-0"><span class="ai-name d-block text-truncate">' + f.name + '</span>'
                + '<span class="ai-size d-block">' + humanSize(f.size) + '</span></span>'
                + '<button type="button" class="ai-x" data-rm="' + i + '" title="Remove">'
                + '<i class="fas fa-xmark"></i></button></div>';
        }).join(''));
    }

    $(document).on('click', '.kp-attach-drop', function () {
        $(this).closest('.kp-attach').find('.kp-attach-input').trigger('click');
    });

    $(document).on('change', '.kp-attach-input', function () {
        var $wrap = $(this).closest('.kp-attach');
        var id = $wrap.data('attach');
        var list = ATTACH.store[id] || (ATTACH.store[id] = []);

        Array.prototype.forEach.call(this.files, function (f) {
            if (list.length >= ATTACH.MAX_FILES) {
                toast('You can attach ' + ATTACH.MAX_FILES + ' files at most.', 'danger');
                return;
            }
            if (f.size > ATTACH.MAX_MB * 1048576) {
                toast(f.name + ' is over ' + ATTACH.MAX_MB + 'MB.', 'danger');
                return;
            }
            list.push({ name: f.name, size: f.size, type: f.type });
        });

        /* Reset the input so re-picking the same file still fires a change. */
        this.value = '';
        paintAttachList($wrap);
    });

    $(document).on('click', '.kp-attach-item .ai-x', function () {
        var $wrap = $(this).closest('.kp-attach');
        var id = $wrap.data('attach');
        (ATTACH.store[id] || []).splice($(this).data('rm'), 1);
        paintAttachList($wrap);
    });

    /* ============================ Sheet ============================
       The user portal needs the same "ask one question over the current
       screen" affordance the back office gets from KP.showModal, but without
       pulling backoffice.js into every wallet page. On phones this rises from
       the bottom the way the mockups draw it; on desktop it centres. */

    function sheet(title, body, opts) {
        opts = opts || {};
        $('#kpSheet').remove();
        $('body').append('<div class="modal fade kp-sheet" id="kpSheet" tabindex="-1">'
            + '<div class="modal-dialog modal-dialog-centered ' + (opts.size || '') + '">'
            + '<div class="modal-content">'
            + '<div class="modal-header">'
            + '<h5 class="modal-title">' + title + '</h5>'
            + '<button class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button></div>'
            + '<div class="modal-body">' + body + '</div></div></div></div>');
        var el = document.getElementById('kpSheet');
        var m = new bootstrap.Modal(el);
        m.show();
        el.addEventListener('hidden.bs.modal', function () { $(el).remove(); });
        return m;
    }
    function closeSheet() {
        var el = document.getElementById('kpSheet');
        if (el) { var m = bootstrap.Modal.getInstance(el); if (m) m.hide(); }
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
        applyTheme(currentTheme(), false);
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
        escalation: ESCALATION, escalate: escalate,
        txblock: TXBLOCK, blockTransaction: blockTransaction, unblockTransaction: unblockTransaction,
        toast: toast,
        sheet: sheet, closeSheet: closeSheet,
        attachField: attachField, attached: attached, clearAttached: clearAttached
    };

})(window, jQuery);
