/* ==========================================================================
   Kaastro Pay — shared back-office pages
   Admin is a superset of agent, so the queue pages are written once here and
   mounted by both portals. `role` is the only difference: admins get unblock,
   override and destructive actions; agents get block and approve only.

   Nothing is approved straight from a table row. Every queue opens the full
   record in the review drawer first (js/review.js), where the fields are
   copiable and the receipt is one click away.
   ========================================================================== */
(function (global, $) {
    'use strict';

    var P = {};

    function F() { return KP.fmt; }
    function fld() { return KP.review.field; }

    /* An agent can be stopped three ways: outside their shift, missing the
       permission an admin granted, or suspended outright. Admins are not on a
       rota and hold every permission by definition. */
    function locked(role, perm) {
        if (role !== 'agent') return false;
        if (!KP.rails.shift.inShift()) return true;
        if (perm && !KP.rails.can(perm)) return true;
        var me = KP.rails.myAgent();
        return !!(me && me.status !== 'active');
    }
    /* A short heading to sit above the reason. */
    function lockTitle(perm) {
        var me = KP.rails.myAgent();
        if (me && me.status === 'suspended') return 'Your account is suspended.';
        if (me && me.status === 'invited') return 'Your account setup is not finished.';
        if (perm && !KP.rails.can(perm)) return 'You do not have this permission.';
        return 'You are outside your shift window.';
    }
    function lockNote(perm) {
        var me = KP.rails.myAgent();
        if (me && me.status === 'suspended') {
            return 'Your account is suspended. Contact an administrator — you cannot approve anything.';
        }
        if (me && me.status === 'invited') {
            return 'Your account setup is not finished. Set a password and enrol two-factor first.';
        }
        if (perm && !KP.rails.can(perm)) {
            return 'You do not have the ' + perm + ' permission. An administrator grants it from the Agents page.';
        }
        return 'You are outside your shift window (' + KP.rails.shift.LABELS[KP.rails.shift.ASSIGNED]
            + '). Approvals, rejections and manual confirmations are disabled until it begins.';
    }
    function actor(role) { return role === 'admin' ? 'Admin User' : 'James Bond'; }

    /* One USD figure for any queue row. Crypto rows carry usdValue; cash rows
       carry an amount in a local currency, which has to be converted before it
       can be summed alongside them. */
    function rowUsd(r) {
        if (r.usdValue != null) return r.usdValue;
        if (r.amount != null && r.currency) return r.amount / (KP.USD_RATE[r.currency] || 1);
        return 0;
    }

    /* Every queue's last column. A blocked or escalated row says so here, so
       an operator scanning the table sees it without opening each one — the
       whole point of a block is that it is not a surprise at the last step. */
    function reviewBtn(r) {
        var k = r.ref || r.id;
        var flag = '';
        if (KP.rails.txblock.isBlocked(k)) {
            flag = '<span class="pill pill-danger me-1" title="'
                + KP.rails.txblock.get(k).reason + '"><i class="fas fa-ban"></i>Blocked</span>';
        } else if (r.escalation) {
            flag = '<span class="pill pill-manual me-1" title="' + r.escalation
                + '"><i class="fas fa-arrow-up-right-dots"></i>With admin</span>';
        }
        return '<div class="d-flex align-items-center justify-content-end gap-1 flex-wrap">' + flag
            + '<button class="btn btn-sm btn-soft rv-open" data-ref="' + k + '">'
            + '<i class="fas fa-eye me-1"></i>Review</button></div>';
    }

    /* ============================ Deposits ============================ */

    P.deposits = function ($el, role) {
        var BO = KP.bo, D = KP.data, f = fld();

        $el.html('<div id="dGuard"></div><div id="dStats"></div><ul class="nav nav-tabs mb-3">'
            + '<li class="nav-item"><button class="nav-link active" data-bs-toggle="tab" data-bs-target="#dCrypto">Crypto</button></li>'
            + '<li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#dFiat">Cash</button></li>'
            + '</ul><div class="tab-content">'
            + '<div class="tab-pane fade show active" id="dCrypto"></div>'
            + '<div class="tab-pane fade" id="dFiat"></div></div>');

        if (locked(role, 'deposits')) KP.rails.applyLock($('#dGuard'), lockTitle('deposits'), lockNote('deposits'));

        var bar = BO.statBar({
            el: $('#dStats'),
            title: 'Deposits in this period',
            source: function () { return D.CRYPTO_DEPOSITS.concat(D.FIAT_DEPOSITS); },
            stats: [
                { label: 'Deposits', icon: 'fa-arrow-down', value: function (rs) { return rs.length; },
                  sub: function (rs) { return rs.filter(function (r) { return r.status === 'successful'; }).length + ' credited'; } },
                { label: 'Value', icon: 'fa-sack-dollar',
                  value: function (rs) { return F().usd(rs.reduce(function (s, r) { return s + rowUsd(r); }, 0)); },
                  sub: function () { return 'USD equivalent'; } },
                { label: 'Awaiting', icon: 'fa-hourglass-half', tone: 'qa-amber qa-warn',
                  value: function (rs) { return rs.filter(function (r) { return r.status === 'pending' || r.status === 'confirming' || r.status === 'proof'; }).length; },
                  sub: function () { return 'still open'; } },
                { label: 'Manual', icon: 'fa-hand', tone: 'qa-amber qa-warn',
                  value: function (rs) { return rs.filter(function (r) { return r.manual; }).length; },
                  sub: function () { return 'settled by hand'; } }
            ],
            onChange: function () { qc.repaint(); qf.repaint(); }
        });


        /* ---- crypto ---- */
        var qc = BO.queue({
            el: $('#dCrypto'),
            rows: function () { return bar.filter(D.CRYPTO_DEPOSITS); },
            filters: [
                { id: 'all', label: 'All' },
                { id: 'open', label: 'Awaiting', count: D.CRYPTO_DEPOSITS.filter(function (r) { return r.status === 'pending' || r.status === 'confirming'; }).length },
                { id: 'manual', label: 'Manually settled' },
                { id: 'successful', label: 'Credited' }
            ],
            match: function (r, fl) {
                if (fl === 'open') return r.status === 'pending' || r.status === 'confirming';
                if (fl === 'manual') return !!r.manual;
                return r.status === fl;
            },
            empty: 'No crypto deposits match this filter.',
            emptyIcon: 'fa-bitcoin-sign',
            columns: [
                { title: 'Reference', cell: function (r) { return '<span class="t-strong">' + r.ref + '</span>' + (r.manual ? ' ' + BO.pill('manual') : ''); } },
                { title: 'User', cell: function (r) { return BO.userCell(r.user); } },
                { title: 'Amount', cell: function (r) { return BO.assetCell(r.asset, r.amount, r.network + ' · ' + F().usd(r.usdValue)); } },
                { title: 'Confirmations', cell: function (r) {
                    var pct = Math.min(100, (r.confirmations / r.confirmsNeeded) * 100);
                    return '<div style="min-width:92px"><div class="t-mono mb-1">' + r.confirmations + ' / ' + r.confirmsNeeded + '</div>'
                        + '<div class="progress" style="height:4px"><div class="progress-bar" style="width:' + pct + '%;background:var(--primary-color)"></div></div></div>';
                } },
                { title: 'Tx hash', cell: function (r) { return '<span class="t-mono">' + BO.trunc(r.txHash, 16) + '</span>'; } },
                { title: 'Status', cell: function (r) { return BO.pill(r.status); } },
                { title: 'Date', cell: function (r) { return '<span class="t-mono">' + r.date + '</span>'; } },
                { title: '', right: true, cell: reviewBtn }
            ]
        });

        $('#dCrypto').on('click', '.rv-open', function () {
            var r = qc.rowOf(this); if (!r) return;
            var a = KP.ASSETS[r.asset];
            KP.review.open({
                role: role,
                onBlock: function () { qc.repaint(); },
                title: 'Crypto deposit', ref: r.ref, status: r.status, user: r.user,
                headline: F().crypto(r.amount, r.asset),
                headSub: F().usd(r.usdValue) + ' · ' + r.network + ' · ' + r.date,
                groups: [
                    ['Deposit', [
                        f('Reference', r.ref, { mono: true }),
                        f('Asset', a.name + ' (' + r.asset + ')'),
                        f('Network', r.network),
                        f('Amount', F().crypto(r.amount, r.asset, { full: true })),
                        f('USD value', F().usd(r.usdValue)),
                        f('Confirmations', r.confirmations + ' of ' + r.confirmsNeeded, { nocopy: true })
                    ]],
                    ['On-chain', [
                        f('Transaction hash', r.txHash, { mono: true }),
                        f('Deposit address', r.address, { mono: true }),
                        f('Detected', r.date)
                    ]],
                    ['Account', [
                        f('User', r.user.name),
                        f('User ID', r.user.id, { mono: true }),
                        f('Email', r.user.email),
                        f('Phone', r.user.phone),
                        f('KYC', r.user.kyc, { nocopy: true }),
                        f('Settled manually', r.manual ? 'Yes' : 'No', { nocopy: true })
                    ]]
                ],
                footNote: 'Verify the hash on the block explorer before approving. '
                    + 'The amount and the destination address must both match.',
                receipt: {
                    title: 'Crypto deposit', ref: r.ref,
                    amount: F().crypto(r.amount, r.asset), sub: r.asset + ' · ' + r.network,
                    status: r.status,
                    rows: [['Reference', r.ref], ['User', r.user.name], ['Asset', r.asset],
                           ['Network', r.network], ['Amount', F().crypto(r.amount, r.asset, { full: true })],
                           ['USD value', F().usd(r.usdValue)], ['Tx hash', BO.trunc(r.txHash, 24)],
                           ['Date', r.date]]
                },
                locked: locked(role, 'deposits'), lockedNote: lockNote('deposits'),
                onApprove: function () { r.status = 'successful'; KP.rails.toast('Approved ' + r.ref + ' — credited to ' + r.user.name + '.'); qc.repaint(); },
                onReject: function () { r.status = 'rejected'; KP.rails.toast('Rejected ' + r.ref + '. The user has been notified.', 'warning'); qc.repaint(); },
                onManual: function () {
                    KP.rails.manualConfirm({ ref: r.ref, who: r.user.name, what: 'Credit ' + r.asset + ' deposit',
                        amount: F().crypto(r.amount, r.asset), usd: r.usdValue, actor: actor(role) })
                        .then(function () { r.status = 'successful'; r.manual = true; qc.repaint(); });
                },
                /* Only an agent gets this. An admin can already decide,
                   so handing it up would just move it in a circle. */
                onEscalate: role === 'agent' ? function () {
                    KP.rails.escalate({ ref: r.ref, who: r.user.name, what: 'Credit ' + r.asset + ' deposit',
                        amount: F().crypto(r.amount, r.asset), usd: r.usdValue, kind: 'crypto-deposit',
                        actor: actor(role) })
                        .then(function (e) { r.escalation = e.id; qc.repaint(); });
                } : null
            });
        });

        /* ---- cash ---- */
        var qf = BO.queue({
            el: $('#dFiat'),
            rows: function () { return bar.filter(D.FIAT_DEPOSITS); },
            filters: [
                { id: 'all', label: 'All' },
                { id: 'pending', label: 'Awaiting', count: D.FIAT_DEPOSITS.filter(function (r) { return r.status === 'pending'; }).length },
                { id: 'proof', label: 'Proof uploaded' },
                { id: 'successful', label: 'Credited' }
            ],
            match: function (r, fl) { return fl === 'proof' ? r.hasProof : r.status === fl; },
            empty: 'No cash deposits match this filter.',
            emptyIcon: 'fa-building-columns',
            columns: [
                { title: 'Reference', cell: function (r) { return '<span class="t-strong">' + r.ref + '</span>' + (r.manual ? ' ' + BO.pill('manual') : ''); } },
                { title: 'User', cell: function (r) { return BO.userCell(r.user); } },
                { title: 'Amount', cell: function (r) { return '<span class="t-strong">' + F().fiat(r.amount, r.currency) + '</span>'; } },
                { title: 'Rail', cell: function (r) {
                    return '<div style="line-height:1.25"><div class="t-strong">' + r.source + '</div>'
                        + '<div class="t-mono">' + (r.rail === 'virtual_account' ? 'Virtual account' : 'Mobile money') + '</div></div>';
                } },
                { title: 'Proof', cell: function (r) {
                    return r.hasProof ? '<span class="pill pill-manual"><i class="fas fa-paperclip"></i>Uploaded</span>'
                                      : '<span class="text-muted" style="font-size:.75rem">auto</span>';
                } },
                { title: 'Status', cell: function (r) { return BO.pill(r.status); } },
                { title: 'Date', cell: function (r) { return '<span class="t-mono">' + r.date + '</span>'; } },
                { title: '', right: true, cell: reviewBtn }
            ]
        });

        $('#dFiat').on('click', '.rv-open', function () {
            var r = qf.rowOf(this); if (!r) return;
            var usd = r.amount / (KP.USD_RATE[r.currency] || 1);
            KP.review.open({
                role: role,
                onBlock: function () { qf.repaint(); },
                title: 'Cash deposit', ref: r.ref, status: r.status, user: r.user,
                headline: F().fiat(r.amount, r.currency),
                headSub: F().usd(usd) + ' · ' + r.source + ' · ' + r.date,
                groups: [
                    ['Deposit', [
                        f('Reference', r.ref, { mono: true }),
                        f('Amount', F().fiat(r.amount, r.currency)),
                        f('Currency', r.currency),
                        f('USD value', F().usd(usd)),
                        f('Rail', r.rail === 'virtual_account' ? 'Dedicated virtual account' : 'Mobile money'),
                        f('Source', r.source),
                        f('Session ID', r.sessionId, { mono: true })
                    ]],
                    ['Account', [
                        f('User', r.user.name),
                        f('User ID', r.user.id, { mono: true }),
                        f('Email', r.user.email),
                        f('Phone', r.user.phone),
                        f('Deposit account', r.user.virtualAccount
                            ? r.user.virtualAccount.bank + ' · ' + r.user.virtualAccount.number : 'Not issued'),
                        f('Settled manually', r.manual ? 'Yes' : 'No', { nocopy: true })
                    ]],
                    ['Evidence', [ r.hasProof
                        ? '<div class="rv-row"><span class="rv-k">Proof of payment</span>'
                          + '<span class="rv-v"><a href="#" class="btn btn-sm btn-soft view-proof">'
                          + '<i class="fas fa-file-image me-1"></i>Open</a></span></div>'
                        : f('Proof of payment', 'Not required — credited automatically', { nocopy: true })
                    ]]
                ],
                footNote: r.hasProof
                    ? 'Check the amount, the sender name and the timestamp on the proof against the statement before approving.'
                    : 'This credited through the automatic rail. No manual verification needed.',
                receipt: {
                    title: 'Cash deposit', ref: r.ref,
                    amount: F().fiat(r.amount, r.currency), sub: r.source, status: r.status,
                    rows: [['Reference', r.ref], ['User', r.user.name],
                           ['Amount', F().fiat(r.amount, r.currency)], ['Rail', r.source],
                           ['Session ID', r.sessionId], ['Date', r.date]]
                },
                locked: locked(role, 'deposits'), lockedNote: lockNote('deposits'),
                onApprove: function () { r.status = 'successful'; KP.rails.toast('Approved ' + r.ref + ' — credited to ' + r.user.name + '.'); qf.repaint(); },
                onReject: function () { r.status = 'rejected'; KP.rails.toast('Rejected ' + r.ref + '.', 'warning'); qf.repaint(); },
                onManual: function () {
                    KP.rails.manualConfirm({ ref: r.ref, who: r.user.name, what: 'Credit cash deposit',
                        amount: F().fiat(r.amount, r.currency), usd: usd, actor: actor(role) })
                        .then(function () { r.status = 'successful'; r.manual = true; qf.repaint(); });
                },
                /* Only an agent gets this. An admin can already decide,
                   so handing it up would just move it in a circle. */
                onEscalate: role === 'agent' ? function () {
                    KP.rails.escalate({ ref: r.ref, who: r.user.name, what: 'Credit cash deposit',
                        amount: F().fiat(r.amount, r.currency), usd: usd, kind: 'cash-deposit',
                        actor: actor(role) })
                        .then(function (e) { r.escalation = e.id; qf.repaint(); });
                } : null
            });
        });

        $(document).on('click', '.view-proof', function (e) {
            e.preventDefault();
            KP.showModal('Proof of payment',
                '<img src="../images/kyc-document-sample.jpg" class="w-100 rounded" alt="">'
                + '<p class="text-muted mt-2 mb-0" style="font-size:.8rem">'
                + 'Check the amount, the sender name and the timestamp against the record before confirming.</p>');
        });
    };

    /* =========================== Withdrawals =========================== */

    P.withdrawals = function ($el, role) {
        var BO = KP.bo, D = KP.data, f = fld();

        $el.html('<div id="wGuard"></div><div id="wStats"></div><ul class="nav nav-tabs mb-3">'
            + '<li class="nav-item"><button class="nav-link active" data-bs-toggle="tab" data-bs-target="#wFiat">Cash payouts</button></li>'
            + '<li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#wCrypto">Crypto sends</button></li>'
            + '</ul><div class="tab-content">'
            + '<div class="tab-pane fade show active" id="wFiat"></div>'
            + '<div class="tab-pane fade" id="wCrypto"></div></div>');

        if (KP.rails.panic.isActive()) {
            $('#wGuard').html('<div class="sys-banner sys-panic"><i class="fas fa-triangle-exclamation fs-5"></i>'
                + '<div><b class="hd">Platform freeze is on — payouts are held.</b>'
                + '<div class="small">Set by ' + KP.rails.panic.by() + '. Nothing here is released until it is lifted.</div></div></div>');
        }
        if (locked(role, 'withdrawals')) KP.rails.applyLock($('#wGuard'), lockTitle('withdrawals'), lockNote('withdrawals'));

        var bar = BO.statBar({
            el: $('#wStats'),
            title: 'Withdrawals in this period',
            source: function () { return D.FIAT_WITHDRAWALS.concat(D.CRYPTO_WITHDRAWALS); },
            stats: [
                { label: 'Payouts', icon: 'fa-arrow-up', value: function (rs) { return rs.length; },
                  sub: function (rs) { return rs.filter(function (r) { return r.status === 'successful'; }).length + ' settled'; } },
                { label: 'Value', icon: 'fa-sack-dollar',
                  value: function (rs) { return F().usd(rs.reduce(function (s, r) { return s + rowUsd(r); }, 0)); },
                  sub: function () { return 'USD equivalent'; } },
                { label: 'Awaiting', icon: 'fa-hourglass-half', tone: 'qa-amber qa-warn',
                  value: function (rs) { return rs.filter(function (r) { return r.status === 'pending' || r.status === 'processing'; }).length; },
                  sub: function () { return 'still open'; } },
                { label: 'Manual', icon: 'fa-hand', tone: 'qa-amber qa-warn',
                  value: function (rs) { return rs.filter(function (r) { return r.manual; }).length; },
                  sub: function () { return 'settled by hand'; } }
            ],
            onChange: function () { qf.repaint(); qc.repaint(); }
        });


        var qf = BO.queue({
            el: $('#wFiat'),
            rows: function () { return bar.filter(D.FIAT_WITHDRAWALS); },
            filters: [
                { id: 'all', label: 'All' },
                { id: 'open', label: 'Awaiting', count: D.FIAT_WITHDRAWALS.filter(function (r) { return r.status === 'pending' || r.status === 'processing'; }).length },
                { id: 'manual', label: 'Manually settled' },
                { id: 'successful', label: 'Settled' },
                { id: 'failed', label: 'Failed' }
            ],
            match: function (r, fl) {
                if (fl === 'open') return r.status === 'pending' || r.status === 'processing';
                if (fl === 'manual') return !!r.manual;
                return r.status === fl;
            },
            empty: 'No payouts match this filter.',
            emptyIcon: 'fa-money-bill-transfer',
            columns: [
                { title: 'Reference', cell: function (r) { return '<span class="t-strong">' + r.ref + '</span>' + (r.manual ? ' ' + BO.pill('manual') : ''); } },
                { title: 'User', cell: function (r) { return BO.userCell(r.user); } },
                { title: 'Amount', cell: function (r) {
                    return '<div style="line-height:1.25"><div class="t-strong">' + F().fiat(r.amount, r.currency) + '</div>'
                        + '<div class="t-mono">net ' + F().fiat(r.amount - r.fee, r.currency) + '</div></div>';
                } },
                { title: 'Destination', cell: function (r) {
                    return '<div style="line-height:1.25"><div class="t-strong">' + r.destination + '</div>'
                        + '<div class="t-mono">' + r.accountNumber + '</div></div>';
                } },
                { title: 'Status', cell: function (r) { return BO.pill(r.status); } },
                { title: 'Date', cell: function (r) { return '<span class="t-mono">' + r.date + '</span>'; } },
                { title: '', right: true, cell: reviewBtn }
            ]
        });

        $('#wFiat').on('click', '.rv-open', function () {
            var r = qf.rowOf(this); if (!r) return;
            var usd = r.amount / (KP.USD_RATE[r.currency] || 1);
            KP.review.open({
                role: role,
                onBlock: function () { qf.repaint(); },
                title: 'Cash payout', ref: r.ref, status: r.status, user: r.user,
                headline: F().fiat(r.amount - r.fee, r.currency),
                headSub: 'from ' + F().fiat(r.amount, r.currency) + ' · fee ' + F().fiat(r.fee, r.currency),
                groups: [
                    ['Payout', [
                        f('Reference', r.ref, { mono: true }),
                        f('Requested', F().fiat(r.amount, r.currency)),
                        f('Fee', F().fiat(r.fee, r.currency)),
                        f('Net to recipient', F().fiat(r.amount - r.fee, r.currency)),
                        f('USD value', F().usd(usd)),
                        f('Requested at', r.date)
                    ]],
                    ['Destination', [
                        f('Institution', r.destination),
                        f('Account number', r.accountNumber, { mono: true }),
                        f('Account name', r.accountName),
                        f('Country', KP.COUNTRIES[r.user.country].name, { nocopy: true })
                    ]],
                    ['Account', [
                        f('User', r.user.name),
                        f('User ID', r.user.id, { mono: true }),
                        f('Email', r.user.email),
                        f('Phone', r.user.phone),
                        f('Tier', 'Tier ' + r.user.tier, { nocopy: true }),
                        f('Cash balance', F().fiat(r.user.fiatBalance, r.user.currency), { nocopy: true }),
                        f('Settled manually', r.manual ? 'Yes' : 'No', { nocopy: true })
                    ]]
                ],
                footNote: 'Confirm the account name matches the verified account holder. '
                    + 'Payouts to a third party must be rejected.',
                receipt: {
                    title: 'Cash payout', ref: r.ref,
                    amount: F().fiat(r.amount - r.fee, r.currency),
                    sub: 'to ' + r.destination, status: r.status,
                    rows: [['Reference', r.ref], ['User', r.user.name],
                           ['Destination', r.destination], ['Account', r.accountNumber],
                           ['Account name', r.accountName], ['Amount', F().fiat(r.amount, r.currency)],
                           ['Fee', F().fiat(r.fee, r.currency)],
                           ['Net', F().fiat(r.amount - r.fee, r.currency)], ['Date', r.date]]
                },
                locked: locked(role, 'withdrawals') || KP.rails.panic.isActive(),
                lockedNote: KP.rails.panic.isActive()
                    ? 'The platform freeze is on. Payouts cannot be released until it is lifted.'
                    : lockNote('withdrawals'),
                onApprove: function () { r.status = 'successful'; KP.rails.toast('Released ' + r.ref + ' to ' + r.destination + '.'); qf.repaint(); },
                onReject: function () { r.status = 'rejected'; KP.rails.toast('Rejected ' + r.ref + ' — the hold is released.', 'warning'); qf.repaint(); },
                onManual: function () {
                    KP.rails.manualConfirm({ ref: r.ref, who: r.user.name, what: 'Settle cash payout',
                        amount: F().fiat(r.amount, r.currency), usd: usd, actor: actor(role) })
                        .then(function () { r.status = 'successful'; r.manual = true; qf.repaint(); });
                },
                /* Only an agent gets this. An admin can already decide,
                   so handing it up would just move it in a circle. */
                onEscalate: role === 'agent' ? function () {
                    KP.rails.escalate({ ref: r.ref, who: r.user.name, what: 'Settle cash payout',
                        amount: F().fiat(r.amount, r.currency), usd: usd, kind: 'cash-withdrawal',
                        actor: actor(role) })
                        .then(function (e) { r.escalation = e.id; qf.repaint(); });
                } : null
            });
        });

        var qc = BO.queue({
            el: $('#wCrypto'),
            rows: function () { return bar.filter(D.CRYPTO_WITHDRAWALS); },
            filters: [
                { id: 'all', label: 'All' },
                { id: 'pending', label: 'Awaiting', count: D.CRYPTO_WITHDRAWALS.filter(function (r) { return r.status === 'pending'; }).length },
                { id: 'manual', label: 'Manually settled' },
                { id: 'successful', label: 'Broadcast' }
            ],
            match: function (r, fl) { return fl === 'manual' ? !!r.manual : r.status === fl; },
            empty: 'No crypto sends match this filter.',
            emptyIcon: 'fa-paper-plane',
            columns: [
                { title: 'Reference', cell: function (r) { return '<span class="t-strong">' + r.ref + '</span>' + (r.manual ? ' ' + BO.pill('manual') : ''); } },
                { title: 'User', cell: function (r) { return BO.userCell(r.user); } },
                { title: 'Amount', cell: function (r) { return BO.assetCell(r.asset, r.amount, 'fee ' + F().crypto(r.fee, r.asset, { noSymbol: true }) + ' · ' + F().usd(r.usdValue)); } },
                { title: 'To address', cell: function (r) {
                    return '<div style="line-height:1.25"><div class="t-mono">' + BO.trunc(r.address, 18) + '</div>'
                        + '<div class="t-mono">' + r.network + '</div></div>';
                } },
                { title: 'Tx hash', cell: function (r) { return '<span class="t-mono">' + BO.trunc(r.txHash, 14) + '</span>'; } },
                { title: 'Status', cell: function (r) { return BO.pill(r.status); } },
                { title: '', right: true, cell: reviewBtn }
            ]
        });

        $('#wCrypto').on('click', '.rv-open', function () {
            var r = qc.rowOf(this); if (!r) return;
            KP.review.open({
                role: role,
                onBlock: function () { qc.repaint(); },
                title: 'Crypto send', ref: r.ref, status: r.status, user: r.user,
                headline: F().crypto(r.amount - r.fee, r.asset),
                headSub: 'from ' + F().crypto(r.amount, r.asset) + ' · network fee '
                    + F().crypto(r.fee, r.asset) + ' · ' + r.network,
                groups: [
                    ['Send', [
                        f('Reference', r.ref, { mono: true }),
                        f('Asset', KP.ASSETS[r.asset].name + ' (' + r.asset + ')'),
                        f('Network', r.network),
                        f('Amount', F().crypto(r.amount, r.asset, { full: true })),
                        f('Network fee', F().crypto(r.fee, r.asset, { full: true })),
                        f('Recipient gets', F().crypto(r.amount - r.fee, r.asset, { full: true })),
                        f('USD value', F().usd(r.usdValue))
                    ]],
                    ['On-chain', [
                        f('Destination address', r.address, { mono: true }),
                        f('Transaction hash', r.txHash || 'Not broadcast yet', { mono: true }),
                        f('Requested at', r.date)
                    ]],
                    ['Account', [
                        f('User', r.user.name),
                        f('User ID', r.user.id, { mono: true }),
                        f('Email', r.user.email),
                        f('Tier', 'Tier ' + r.user.tier, { nocopy: true }),
                        f('Settled manually', r.manual ? 'Yes' : 'No', { nocopy: true })
                    ]]
                ],
                footNote: 'On-chain sends are irreversible. Check the destination address against '
                    + 'the user\'s whitelist before approving.',
                receipt: {
                    title: 'Crypto send', ref: r.ref,
                    amount: F().crypto(r.amount - r.fee, r.asset),
                    sub: r.asset + ' · ' + r.network, status: r.status,
                    rows: [['Reference', r.ref], ['User', r.user.name], ['Asset', r.asset],
                           ['Network', r.network], ['Amount', F().crypto(r.amount, r.asset, { full: true })],
                           ['Network fee', F().crypto(r.fee, r.asset)],
                           ['To address', BO.trunc(r.address, 26)],
                           ['Tx hash', r.txHash ? BO.trunc(r.txHash, 24) : '—'], ['Date', r.date]]
                },
                locked: locked(role, 'withdrawals') || KP.rails.panic.isActive(),
                lockedNote: KP.rails.panic.isActive()
                    ? 'The platform freeze is on. Crypto sends cannot be broadcast until it is lifted.'
                    : lockNote('withdrawals'),
                onApprove: function () { r.status = 'successful'; KP.rails.toast('Broadcast ' + r.ref + ' to the ' + r.network + ' network.'); qc.repaint(); },
                onReject: function () { r.status = 'rejected'; KP.rails.toast('Rejected ' + r.ref + ' — the hold is released.', 'warning'); qc.repaint(); },
                onManual: function () {
                    KP.rails.manualConfirm({ ref: r.ref, who: r.user.name, what: 'Broadcast ' + r.asset + ' send',
                        amount: F().crypto(r.amount, r.asset), usd: r.usdValue, actor: actor(role) })
                        .then(function () { r.status = 'successful'; r.manual = true; qc.repaint(); });
                },
                /* Only an agent gets this. An admin can already decide,
                   so handing it up would just move it in a circle. */
                onEscalate: role === 'agent' ? function () {
                    KP.rails.escalate({ ref: r.ref, who: r.user.name, what: 'Broadcast ' + r.asset + ' send',
                        amount: F().crypto(r.amount, r.asset), usd: r.usdValue, kind: 'crypto-withdrawal',
                        actor: actor(role) })
                        .then(function (e) { r.escalation = e.id; qc.repaint(); });
                } : null
            });
        });
    };

    /* ============================== KYC ============================== */
    /* The queue only lists and links. The full document review lives on its own
       page, because a two-panel layout cannot show documents at a usable size. */

    P.kyc = function ($el, role) {
        var BO = KP.bo, D = KP.data;

        $el.html('<div id="kGuard"></div>'
            + '<div class="stat-strip mb-3" id="kStats"></div>'
            + '<div class="strip-dots" data-for="kStats"></div>'
            + '<div id="kQueue" class="mt-2"></div>');

        if (locked(role, 'kyc')) KP.rails.applyLock($('#kGuard'), lockTitle('kyc'), lockNote('kyc'));

        var pending = D.KYC_QUEUE.filter(function (k) { return k.status === 'pending'; }).length;
        var rejected = D.KYC_QUEUE.filter(function (k) { return k.status === 'rejected'; }).length;
        var verified = D.USERS.filter(function (u) { return u.kyc === 'verified'; }).length;
        var oldest = D.KYC_QUEUE.reduce(function (m, k) { return Math.max(m, k.daysAgo); }, 0);

        $('#kStats').html(
            BO.statTile({ label: 'Awaiting review', value: pending, icon: 'fa-hourglass-half', tone: 'amber', note: 'documents in the queue' })
            + BO.statTile({ label: 'Verified users', value: verified, icon: 'fa-circle-check', tone: 'green', note: 'across all tiers' })
            + BO.statTile({ label: 'Rejected', value: rejected, icon: 'fa-circle-xmark', tone: 'red', note: 'awaiting resubmission' })
            + BO.statTile({ label: 'Oldest item', value: oldest === 0 ? 'Today' : oldest + 'd', icon: 'fa-clock', tone: 'blue', note: 'act on this first' })
        );
        BO.stripDots('#kStats');

        BO.queue({
            el: $('#kQueue'),
            rows: function () { return D.KYC_QUEUE; },
            filters: [
                { id: 'all', label: 'All' },
                { id: 'pending', label: 'Waiting', count: pending },
                { id: 'rejected', label: 'Rejected' },
                { id: 'approved', label: 'Approved' }
            ],
            match: function (r, fl) { return r.status === fl; },
            empty: 'No submissions in this queue.',
            emptyIcon: 'fa-id-card',
            columns: [
                { title: 'Reference', cell: function (r) { return '<span class="t-strong">' + r.ref + '</span>'; } },
                { title: 'User', cell: function (r) { return BO.userCell(r.user); } },
                { title: 'Document', cell: function (r) {
                    return '<div style="line-height:1.25"><div class="t-strong">' + r.idType + '</div>'
                        + '<div class="t-mono">' + r.docType + '</div></div>';
                } },
                { title: 'Requesting', cell: function (r) { return '<span class="tier-badge tier-' + r.targetTier + '">Tier ' + r.targetTier + '</span>'; } },
                { title: 'Submitted', cell: function (r) { return '<span class="t-mono">' + r.submitted + '</span>'; } },
                { title: 'Status', cell: function (r) { return BO.pill(r.status); } },
                { title: '', right: true, cell: function (r) {
                    return '<a class="btn btn-sm btn-primary" href="kyc-review.html?ref=' + r.ref + '">'
                        + '<i class="fas fa-id-card me-1"></i>Review</a>';
                } }
            ]
        });
    };

    /* ============================== Users ============================== */

    P.users = function ($el, role) {
        var BO = KP.bo, D = KP.data;

        $el.html('<div class="stat-strip mb-3" id="uStats"></div>'
            + '<div class="strip-dots" data-for="uStats"></div>'
            + '<div id="uQueue" class="mt-2"></div>');

        var total = D.USERS.length;
        var verified = D.USERS.filter(function (u) { return u.kyc === 'verified'; }).length;
        var pendingKyc = D.USERS.filter(function (u) { return u.kyc === 'pending'; }).length;
        var unverified = D.USERS.filter(function (u) { return u.kyc === 'unverified'; }).length;
        var blocked = D.USERS.filter(function (u) { return KP.rails.block.isBlocked(u); }).length;
        var newToday = D.USERS.filter(function (u) { return u.joinedDaysAgo === 0; }).length;
        var balUsd = D.USERS.reduce(function (s, u) {
            return s + u.usdValue + u.fiatBalance / (KP.USD_RATE[u.currency] || 1);
        }, 0);

        $('#uStats').html(
            BO.statTile({ label: 'Total users', value: total, icon: 'fa-users', tone: 'blue', note: 'on the platform' })
            + BO.statTile({ label: 'Verified', value: verified, icon: 'fa-circle-check', tone: 'green',
                note: Math.round(verified / total * 100) + '% of all users' })
            + BO.statTile({ label: 'KYC pending', value: pendingKyc, icon: 'fa-hourglass-half', tone: 'amber', note: 'awaiting review' })
            + BO.statTile({ label: 'Unverified', value: unverified, icon: 'fa-user-slash', tone: 'slate', note: 'cannot transact' })
            + BO.statTile({ label: 'Blocked', value: blocked, icon: 'fa-ban', tone: 'red', note: 'access suspended' })
            + BO.statTile({ label: 'New today', value: newToday, icon: 'fa-user-plus', tone: 'purple', note: 'signed up in 24h' })
            + BO.statTile({ label: 'Held balances', value: '$' + KP.fmt.compact(balUsd), icon: 'fa-vault', tone: 'green', note: 'cash and crypto' })
        );
        BO.stripDots('#uStats');

        var q = BO.queue({
            el: $('#uQueue'),
            rows: function () { return D.USERS; },
            filters: [
                { id: 'all', label: 'All', count: total },
                { id: 'verified', label: 'Verified' },
                { id: 'pending', label: 'KYC pending' },
                { id: 'unverified', label: 'Unverified' },
                { id: 'blocked', label: 'Blocked' }
            ],
            match: function (r, fl) {
                if (fl === 'blocked') return KP.rails.block.isBlocked(r);
                if (fl === 'verified') return r.kyc === 'verified';
                if (fl === 'pending') return r.kyc === 'pending';
                if (fl === 'unverified') return r.kyc === 'unverified' || r.kyc === 'rejected';
                return true;
            },
            empty: 'No users match this filter.',
            emptyIcon: 'fa-users',
            columns: [
                { title: 'User', cell: function (r) { return BO.userCell(r); } },
                { title: 'Contact', cell: function (r) {
                    return '<div style="line-height:1.25"><div class="t-strong">' + r.email + '</div>'
                        + '<div class="t-mono">' + r.phone + '</div></div>';
                } },
                { title: 'Tier', cell: function (r) { return '<span class="tier-badge tier-' + r.tier + '">Tier ' + r.tier + '</span>'; } },
                { title: 'KYC', cell: function (r) { return BO.pill(r.kyc); } },
                { title: 'Cash', cell: function (r) { return '<span class="t-strong">' + KP.fmt.fiat(r.fiatBalance, r.currency) + '</span>'; } },
                { title: 'Crypto', cell: function (r) { return '<span class="t-strong">' + KP.fmt.usd(r.usdValue) + '</span>'; } },
                { title: 'Status', cell: function (r) { return BO.pill(KP.rails.block.isBlocked(r) ? 'blocked' : 'active'); } },
                { title: 'Joined', cell: function (r) { return '<span class="t-mono">' + r.joined + '</span>'; } },
                { title: '', right: true, cell: function (r) {
                    return '<a class="btn btn-sm btn-soft" href="user-details.html?id=' + r.id + '">'
                        + '<i class="fas fa-eye me-1"></i>View</a>';
                } }
            ]
        });
    };

    /* ============================== Trades ============================== */

    P.trades = function ($el, role) {
        var BO = KP.bo, D = KP.data, f = fld();
        $el.html('<div id="tStats"></div><div id="tQueue"></div>');

        /* Same ranged bar the deposit and withdrawal queues use, so "last 30
           days" means the same thing on every operational screen. */
        var bar = BO.statBar({
            el: $('#tStats'),
            title: 'Trading in this period',
            source: function () { return D.TRADES; },
            stats: [
                { label: 'Trades', icon: 'fa-right-left',
                  value: function (rs) { return rs.length; },
                  sub: function () { return 'in this period'; } },
                { label: 'Volume', icon: 'fa-chart-simple',
                  value: function (rs) { return '$' + KP.fmt.compact(rs.reduce(function (s, t) { return s + t.usdValue; }, 0)); },
                  sub: function () { return 'USD equivalent'; } },
                { label: 'Margin earned', icon: 'fa-sack-dollar',
                  value: function (rs) { return '$' + KP.fmt.compact(rs.reduce(function (s, t) { return s + t.marginEarnedUsd; }, 0)); },
                  sub: function () { return 'realised spread'; } },
                { label: 'Take rate', icon: 'fa-percent',
                  value: function (rs) {
                      var v = rs.reduce(function (s, t) { return s + t.usdValue; }, 0);
                      var m = rs.reduce(function (s, t) { return s + t.marginEarnedUsd; }, 0);
                      return v ? (m / v * 100).toFixed(2) + '%' : '—';
                  },
                  sub: function () { return 'margin over volume'; } }
            ],
            onChange: function () { q.repaint(); }
        });

        var q = BO.queue({
            el: $('#tQueue'),
            rows: function () { return bar.filter(D.TRADES); },
            filters: [
                { id: 'all', label: 'All', count: D.TRADES.length },
                { id: 'buy', label: 'Buys' },
                { id: 'sell', label: 'Sells' },
                { id: 'swap', label: 'Swaps' },
                { id: 'failed', label: 'Failed' }
            ],
            match: function (r, fl) { return fl === 'failed' ? r.status === 'failed' : r.kind === fl; },
            empty: 'No trades match this filter.',
            emptyIcon: 'fa-right-left',
            columns: [
                { title: 'Reference', cell: function (r) { return '<span class="t-strong">' + r.ref + '</span>'; } },
                { title: 'User', cell: function (r) { return BO.userCell(r.user); } },
                { title: 'Type', cell: function (r) {
                    var tone = r.kind === 'buy' ? 'pill-success' : r.kind === 'sell' ? 'pill-pending' : 'pill-manual';
                    return '<span class="pill ' + tone + '">' + r.kind + '</span>';
                } },
                { title: 'Pair', cell: function (r) { return '<span class="t-strong">' + r.from + ' → ' + r.to + '</span>'; } },
                { title: 'Size', cell: function (r) {
                    return '<div style="line-height:1.25"><div class="t-strong">' + KP.fmt.usd(r.usdValue) + '</div>'
                        + '<div class="t-mono">' + KP.fmt.fiat(r.fiatValue, r.currency) + '</div></div>';
                } },
                { title: 'Margin', cell: function (r) { return '<span class="t-strong text-up">' + KP.fmt.usd(r.marginEarnedUsd) + '</span>'; } },
                { title: 'Status', cell: function (r) { return BO.pill(r.status); } },
                { title: 'Date', cell: function (r) { return '<span class="t-mono">' + r.date + '</span>'; } },
                { title: '', right: true, cell: reviewBtn }
            ]
        });

        $('#tQueue').on('click', '.rv-open', function () {
            var r = q.rowOf(this); if (!r) return;
            var isSwap = r.kind === 'swap';
            KP.review.open({
                role: role,
                title: r.kind.charAt(0).toUpperCase() + r.kind.slice(1), ref: r.ref,
                status: r.status, user: r.user,
                headline: r.from + ' → ' + r.to,
                headSub: KP.fmt.usd(r.usdValue) + ' · ' + r.date,
                groups: [
                    ['Trade', [
                        f('Reference', r.ref, { mono: true }),
                        f('Type', r.kind),
                        f('Pair', r.from + ' → ' + r.to),
                        f('Quantity', KP.fmt.crypto(r.qty, KP.ASSETS[r.from] ? r.from : r.to, { full: true })),
                        f('USD value', KP.fmt.usd(r.usdValue)),
                        f('Local value', KP.fmt.fiat(r.fiatValue, r.currency))
                    ]],
                    ['Pricing', [
                        f('Rate applied', isSwap
                            ? '1 ' + r.from + ' = ' + r.rate.toFixed(8) + ' ' + r.to
                            : '1 ' + (KP.ASSETS[r.from] ? r.from : r.to) + ' = ' + KP.fmt.fiat(r.rate, r.currency)),
                        f('Margin earned', KP.fmt.usd(r.marginEarnedUsd)),
                        f('Effective spread', (r.marginEarnedUsd / r.usdValue * 100).toFixed(2) + '%', { nocopy: true }),
                        f('Executed at', r.date)
                    ]],
                    ['Account', [
                        f('User', r.user.name),
                        f('User ID', r.user.id, { mono: true }),
                        f('Email', r.user.email),
                        f('Country', KP.COUNTRIES[r.user.country].name, { nocopy: true }),
                        f('Tier', 'Tier ' + r.user.tier, { nocopy: true })
                    ]]
                ],
                footNote: 'Trades settle instantly against our own book. There is nothing to '
                    + 'approve — this record is here for audit and support.',
                receipt: {
                    title: r.kind.charAt(0).toUpperCase() + r.kind.slice(1), ref: r.ref,
                    amount: r.from + ' → ' + r.to, sub: KP.fmt.usd(r.usdValue), status: r.status,
                    rows: [['Reference', r.ref], ['User', r.user.name], ['Type', r.kind],
                           ['Pair', r.from + ' → ' + r.to], ['USD value', KP.fmt.usd(r.usdValue)],
                           ['Local value', KP.fmt.fiat(r.fiatValue, r.currency)],
                           ['Margin', KP.fmt.usd(r.marginEarnedUsd)], ['Date', r.date]]
                },
                actions: false
            });
        });
    };

    /* ========================== All transactions ========================== */

    P.transactions = function ($el, role) {
        var BO = KP.bo, D = KP.data, f = fld();

        var all = [];
        D.CRYPTO_DEPOSITS.forEach(function (r) {
            all.push({ ref: r.ref, user: r.user, type: 'Crypto deposit', dir: 'in', src: r,
                detail: KP.fmt.crypto(r.amount, r.asset) + ' · ' + r.network, usd: r.usdValue,
                status: r.status, date: r.date, daysAgo: r.daysAgo, manual: r.manual });
        });
        D.FIAT_DEPOSITS.forEach(function (r) {
            all.push({ ref: r.ref, user: r.user, type: 'Cash deposit', dir: 'in', src: r,
                detail: KP.fmt.fiat(r.amount, r.currency) + ' · ' + r.source,
                usd: r.amount / (KP.USD_RATE[r.currency] || 1),
                status: r.status, date: r.date, daysAgo: r.daysAgo, manual: r.manual });
        });
        D.TRADES.forEach(function (r) {
            all.push({ ref: r.ref, user: r.user, type: r.kind.charAt(0).toUpperCase() + r.kind.slice(1),
                dir: 'swap', src: r, detail: r.from + ' → ' + r.to, usd: r.usdValue,
                status: r.status, date: r.date, daysAgo: r.daysAgo, manual: false });
        });
        D.FIAT_WITHDRAWALS.forEach(function (r) {
            all.push({ ref: r.ref, user: r.user, type: 'Cash payout', dir: 'out', src: r,
                detail: KP.fmt.fiat(r.amount, r.currency) + ' → ' + r.destination,
                usd: r.amount / (KP.USD_RATE[r.currency] || 1),
                status: r.status, date: r.date, daysAgo: r.daysAgo, manual: r.manual });
        });
        D.CRYPTO_WITHDRAWALS.forEach(function (r) {
            all.push({ ref: r.ref, user: r.user, type: 'Crypto send', dir: 'out', src: r,
                detail: KP.fmt.crypto(r.amount, r.asset) + ' · ' + r.network, usd: r.usdValue,
                status: r.status, date: r.date, daysAgo: r.daysAgo, manual: r.manual });
        });
        all.sort(function (a, b) { return a.daysAgo - b.daysAgo; });

        $el.html('<div class="stat-strip mb-3" id="aStats"></div>'
            + '<div class="strip-dots" data-for="aStats"></div>'
            + '<div id="aQueue" class="mt-2"></div>');

        var vol = all.reduce(function (s, r) { return s + r.usd; }, 0);
        var ok = all.filter(function (r) { return r.status === 'successful'; }).length;
        $('#aStats').html(
            BO.statTile({ label: 'Transactions', value: all.length, icon: 'fa-list', tone: 'blue', note: 'all movements' })
            + BO.statTile({ label: 'Volume', value: '$' + KP.fmt.compact(vol), icon: 'fa-chart-simple', tone: 'green', note: 'USD equivalent' })
            + BO.statTile({ label: 'Success rate', value: (ok / all.length * 100).toFixed(1) + '%', icon: 'fa-circle-check', tone: 'green', note: 'settled first time' })
            + BO.statTile({ label: 'Manual', value: all.filter(function (r) { return r.manual; }).length, icon: 'fa-hand', tone: 'purple', note: 'settled by an agent' })
        );
        BO.stripDots('#aStats');

        var q = BO.queue({
            el: $('#aQueue'),
            rows: function () { return all; },
            filters: [
                { id: 'all', label: 'All', count: all.length },
                { id: 'in', label: 'Credits' },
                { id: 'out', label: 'Debits' },
                { id: 'swap', label: 'Trades' },
                { id: 'manual', label: 'Manual' }
            ],
            match: function (r, fl) { return fl === 'manual' ? !!r.manual : r.dir === fl; },
            empty: 'No transactions match this filter.',
            emptyIcon: 'fa-list',
            columns: [
                { title: 'Reference', cell: function (r) { return '<span class="t-strong">' + r.ref + '</span>' + (r.manual ? ' ' + BO.pill('manual') : ''); } },
                { title: 'User', cell: function (r) { return BO.userCell(r.user); } },
                { title: 'Type', cell: function (r) {
                    var ic = r.dir === 'in' ? 'fa-arrow-down' : r.dir === 'out' ? 'fa-arrow-up' : 'fa-right-left';
                    var tone = r.dir === 'in' ? 'tx-in' : r.dir === 'out' ? 'tx-out' : 'tx-swap';
                    return '<div class="d-flex align-items-center gap-2">'
                        + '<span class="tx-icon ' + tone + '" style="width:26px;height:26px;font-size:.62rem"><i class="fas ' + ic + '"></i></span>'
                        + '<span class="t-strong">' + r.type + '</span></div>';
                } },
                { title: 'Detail', cell: function (r) { return '<span class="t-mono">' + r.detail + '</span>'; } },
                { title: 'USD value', cell: function (r) { return '<span class="t-strong">' + KP.fmt.usd(r.usd) + '</span>'; } },
                { title: 'Status', cell: function (r) { return BO.pill(r.status); } },
                { title: 'Date', cell: function (r) { return '<span class="t-mono">' + r.date + '</span>'; } },
                { title: '', right: true, cell: reviewBtn }
            ]
        });

        $('#aQueue').on('click', '.rv-open', function () {
            var r = q.rowOf(this); if (!r) return;
            KP.review.open({
                role: role,
                onBlock: function () { q.repaint(); },
                title: r.type, ref: r.ref, status: r.status, user: r.user,
                headline: KP.fmt.usd(r.usd), headSub: r.detail + ' · ' + r.date,
                groups: [
                    ['Transaction', [
                        f('Reference', r.ref, { mono: true }),
                        f('Type', r.type),
                        f('Direction', r.dir === 'in' ? 'Credit' : r.dir === 'out' ? 'Debit' : 'Trade', { nocopy: true }),
                        f('Detail', r.detail),
                        f('USD value', KP.fmt.usd(r.usd)),
                        f('Status', r.status, { nocopy: true }),
                        f('Settled manually', r.manual ? 'Yes' : 'No', { nocopy: true }),
                        f('Date', r.date)
                    ]],
                    ['Account', [
                        f('User', r.user.name),
                        f('User ID', r.user.id, { mono: true }),
                        f('Email', r.user.email),
                        f('Phone', r.user.phone),
                        f('Country', KP.COUNTRIES[r.user.country].name, { nocopy: true })
                    ]]
                ],
                footNote: 'Open the originating queue to act on this record. This view is read-only.',
                receipt: {
                    title: r.type, ref: r.ref, amount: KP.fmt.usd(r.usd),
                    sub: r.detail, status: r.status,
                    rows: [['Reference', r.ref], ['User', r.user.name], ['Type', r.type],
                           ['Detail', r.detail], ['USD value', KP.fmt.usd(r.usd)],
                           ['Status', r.status], ['Date', r.date]]
                },
                actions: false
            });
        });
    };

    /* ============================= Support ============================= */

    P.support = function ($el, role) {
        var BO = KP.bo, D = KP.data;
        $el.html('<div class="row g-3"><div class="col-lg-5"><div id="sQueue"></div></div>'
            + '<div class="col-lg-7"><div class="card p-3" id="sThread">'
            + '<div class="empty-state"><i class="fas fa-comments"></i><p>Open a ticket to reply.</p></div></div></div></div>');

        var q = BO.queue({
            el: $('#sQueue'),
            rows: function () { return D.TICKETS; },
            filters: [
                { id: 'all', label: 'All' },
                { id: 'open', label: 'Open', count: D.TICKETS.filter(function (t) { return t.status === 'open'; }).length },
                { id: 'resolved', label: 'Resolved' }
            ],
            match: function (r, fl) { return r.status === fl; },
            empty: 'No tickets here.',
            emptyIcon: 'fa-headset',
            columns: [
                { title: 'Ticket', cell: function (r) {
                    return '<div style="line-height:1.3"><div class="t-strong">' + r.subject + '</div>'
                        + '<div class="t-mono">' + r.id + ' · ' + r.user.name + '</div></div>';
                } },
                { title: 'Status', cell: function (r) { return BO.pill(r.status); } },
                { title: '', right: true, cell: function (r) {
                    return '<button class="btn btn-sm btn-soft s-open" data-ref="' + r.id + '">Open</button>'; } }
            ]
        });

        $('#sQueue').on('click', '.s-open', function () {
            var t = q.rowOf(this); if (!t) return;
            $('#sThread').html(
                '<div class="d-flex align-items-center gap-2 mb-3">'
                + '<img src="../images/' + t.user.avatar + '" class="rounded-circle" width="40" height="40" alt="">'
                + '<div class="min-w-0"><h2 class="card-title mb-0">' + t.subject + '</h2>'
                + '<div class="t-mono">' + t.id + ' · ' + t.user.name + ' · ' + t.last + '</div></div>'
                + '<span class="ms-auto">' + BO.pill(t.status) + '</span></div>'
                + '<div class="summary-rows mb-3" style="max-height:280px;overflow:auto">'
                + '<div class="mb-2"><b style="font-size:.8rem">' + t.user.name + '</b>'
                + '<p class="mb-0 text-muted" style="font-size:.82rem">' + t.subject
                + '. Please check — the reference is on my transaction list.</p>'
                /* What the user attached when they raised it. Being able to see
                   the evidence without leaving the thread is the whole point. */
                + '<div class="kp-attach-list mt-2" style="display:grid;gap:.4rem">'
                + '<div class="kp-attach-item"><span class="qa-icon qa-green sm">'
                + '<i class="fas fa-image"></i></span>'
                + '<span class="min-w-0"><span class="ai-name d-block text-truncate">bank-app-screenshot.png</span>'
                + '<span class="ai-size d-block">412 KB · from ' + t.user.name.split(' ')[0] + '</span></span>'
                + '<a class="ai-x" href="../images/kyc-document-sample.jpg" target="_blank" '
                + 'rel="noopener" title="Open"><i class="fas fa-arrow-up-right-from-square"></i></a></div>'
                + '</div></div>'
                + '<div class="mb-2 text-end"><b style="font-size:.8rem">You</b>'
                + '<p class="mb-0 text-muted" style="font-size:.82rem">Thanks — checking the queue now.</p></div></div>'
                + '<textarea class="form-control mb-2" rows="3" id="sReplyBody" placeholder="Type your reply…"></textarea>'
                + '<div class="mb-2" id="sAttachSlot"></div>'
                + '<div class="d-flex gap-2"><button class="btn btn-primary flex-grow-1 s-reply">Send reply</button>'
                + '<button class="btn btn-soft s-resolve">Mark resolved</button></div>'
            );

            /* Same control the user files evidence with, so an agent can send a
               screenshot back — a corrected reference, a provider's response. */
            $('#sAttachSlot').html(KP.rails.attachField('sup-' + t.id, {
                label: 'Attach a file to your reply',
                hint: 'PNG, JPG or PDF · up to 5MB each'
            }));
            $('#sThread').data('ticket', t.id);
        });

        $('#sThread').on('click', '.s-reply', function () {
            var id = $('#sThread').data('ticket');
            var body = ($('#sReplyBody').val() || '').trim();
            if (!body) { KP.rails.toast('Write a reply first.', 'danger'); return; }
            var files = KP.rails.attached('sup-' + id);
            $('#sReplyBody').val('');
            KP.rails.clearAttached('sup-' + id);
            KP.rails.toast('Reply sent to the user'
                + (files.length ? ' with ' + files.length + ' attachment' + (files.length > 1 ? 's' : '') : '')
                + '.');
        });
        $('#sThread').on('click', '.s-resolve', function () { KP.rails.toast('Ticket marked resolved.'); q.repaint(); });
    };


    /* ========================= Payment links =========================
       Both back-office portals get the same view: every link on the platform,
       whoever created it, with the ranged stat bar the other queues use so
       "last 30 days" means the same thing here as it does on deposits.

       There is nothing to approve — a link settles itself when someone pays
       it. This exists for support ("my client says they paid") and for
       compliance, which is why the drawer leads with who created it. */

    P.paymentLinks = function ($el, role) {
        var BO = KP.bo, D = KP.data, f = fld();
        $el.html('<div id="plStats"></div><div id="plQueue"></div>');

        var bar = BO.statBar({
            el: $('#plStats'),
            title: 'Payment links in this period',
            source: function () { return D.PAYMENT_LINKS; },
            stats: [
                { label: 'Active', icon: 'fa-link',
                  value: function (rs) { return rs.filter(function (l) { return l.status === 'active'; }).length; },
                  sub: function () { return 'awaiting payment'; } },
                { label: 'Paid', icon: 'fa-circle-check',
                  value: function (rs) { return rs.filter(function (l) { return l.status === 'paid'; }).length; },
                  sub: function (rs) {
                      return KP.fmt.usd(rs.filter(function (l) { return l.status === 'paid'; })
                          .reduce(function (s, l) { return s + l.usdValue; }, 0)) + ' collected'; } },
                { label: 'Expired', icon: 'fa-clock', tone: 'qa-amber qa-warn',
                  value: function (rs) { return rs.filter(function (l) { return l.status === 'expired'; }).length; },
                  sub: function () { return 'never paid'; } },
                { label: 'Cancelled', icon: 'fa-circle-xmark', tone: 'qa-red',
                  value: function (rs) { return rs.filter(function (l) { return l.status === 'cancelled'; }).length; },
                  sub: function () { return 'called off'; } }
            ],
            onChange: function () { q.repaint(); }
        });

        var q = BO.queue({
            el: $('#plQueue'),
            rows: function () { return bar.filter(D.PAYMENT_LINKS); },
            filters: [
                { id: 'all', label: 'All' },
                { id: 'active', label: 'Active',
                  count: D.PAYMENT_LINKS.filter(function (l) { return l.status === 'active'; }).length },
                { id: 'paid', label: 'Paid' },
                { id: 'expired', label: 'Expired' },
                { id: 'cancelled', label: 'Cancelled' }
            ],
            match: function (r, fl) { return r.status === fl; },
            empty: 'No payment links match this filter.',
            emptyIcon: 'fa-link',
            columns: [
                { title: 'Link', cell: function (r) {
                    return '<div style="line-height:1.3"><div class="t-strong">' + r.title + '</div>'
                        + '<div class="t-mono">' + r.ref + '</div></div>';
                } },
                { title: 'Created by', cell: function (r) { return BO.userCell(r.user); } },
                { title: 'Amount', cell: function (r) {
                    return '<div style="line-height:1.3"><div class="t-strong">'
                        + KP.fmt.fiat(r.amount, r.currency) + '</div>'
                        + '<div class="t-mono">' + r.asset + ' · ' + r.network + '</div></div>';
                } },
                { title: 'Received', cell: function (r) {
                    return r.paidAmount
                        ? '<span class="t-strong text-up">' + KP.fmt.fiat(r.paidAmount, r.currency) + '</span>'
                        : '<span class="text-muted">—</span>';
                } },
                { title: 'Views', cell: function (r) { return '<span class="t-mono">' + r.views + '</span>'; } },
                { title: 'Status', cell: function (r) { return BO.pill(r.status); } },
                { title: 'Created', cell: function (r) { return '<span class="t-mono">' + r.date + '</span>'; } },
                { title: '', right: true, cell: reviewBtn }
            ]
        });

        $('#plQueue').on('click', '.rv-open', function () {
            var r = q.rowOf(this); if (!r) return;
            KP.review.open({
                role: role,
                title: r.title,
                ref: r.ref,
                status: r.status,
                user: r.user,
                headline: KP.fmt.fiat(r.amount, r.currency),
                headSub: r.asset + ' · ' + r.network + ' · ' + KP.fmt.usd(r.usdValue),
                groups: [
                    ['Link', [
                        f('Reference', r.ref, { mono: true }),
                        f('Title', r.title),
                        f('Amount', KP.fmt.fiat(r.amount, r.currency)),
                        f('Asset', r.asset, { nocopy: true }),
                        f('Network', r.network, { nocopy: true }),
                        f('Expiry', r.expiry, { nocopy: true }),
                        f('Created', r.date, { nocopy: true })
                    ]],
                    ['Settlement', [
                        f('Status', r.status, { nocopy: true }),
                        f('Received', KP.fmt.fiat(r.paidAmount, r.currency)),
                        f('Payments', String(r.payments), { nocopy: true }),
                        f('Views', String(r.views), { nocopy: true })
                    ]],
                    ['Created by', [
                        f('User', r.user.name),
                        f('User ID', r.user.id, { mono: true }),
                        f('Email', r.user.email),
                        f('Country', KP.COUNTRIES[r.user.country].name, { nocopy: true }),
                        f('Tier', 'Tier ' + r.user.tier, { nocopy: true })
                    ]]
                ],
                footNote: 'A payment link settles itself when someone pays it. There is nothing '
                    + 'to approve here — this record is for support and compliance.',
                actions: false
            });
        });
    };
    /* ============================== Helpers ============================== */

    global.KP = global.KP || {};
    global.KP.pages = P;

})(window, jQuery);
