/* ==========================================================================
   Kaastro Pay — full-page detail views
   KYC review and the user record are too dense for a modal, so they get their
   own pages. Both portals mount the same code; `role` gates the destructive
   actions (only an admin unblocks, only an admin overrides a tier).
   ========================================================================== */
(function (global, $) {
    'use strict';

    var DP = {};

    function param(k) {
        return (new RegExp('[?&]' + k + '=([^&]+)').exec(location.search) || [])[1];
    }
    function locked(role, perm) {
        if (role !== 'agent') return false;
        if (!KP.rails.shift.inShift()) return true;
        if (perm && !KP.rails.can(perm)) return true;
        var me = KP.rails.myAgent();
        return !!(me && me.status !== 'active');
    }
    function f() { return KP.review.field; }

    /* ============================ KYC review ============================ */

    DP.kycReview = function ($el, role) {
        var D = KP.data, BO = KP.bo;
        var ref = decodeURIComponent(param('ref') || '');
        var rec = D.KYC_QUEUE.filter(function (k) { return k.ref === ref; })[0] || D.KYC_QUEUE[0];

        if (!rec) {
            $el.html('<div class="card p-4"><div class="empty-state"><i class="fas fa-id-card"></i>'
                + '<p>That submission no longer exists.</p>'
                + '<a href="kyc.html" class="btn btn-primary btn-sm mt-3">Back to the queue</a></div></div>');
            return;
        }

        var u = rec.user;
        var C = KP.COUNTRIES[rec.country];
        var isLocked = locked(role, 'kyc');

        $el.html(
            '<a href="kyc.html" class="btn btn-soft btn-sm mb-3"><i class="fas fa-arrow-left me-1"></i>Back to queue</a>'
            + '<div id="kGuard"></div>'
            + '<div class="row g-3">'

            /* ---- documents ---- */
            + '<div class="col-lg-7">'
            + '<div class="card p-3 p-md-4">'
            + '<div class="section-head"><h2>Submitted documents</h2>'
            + '<span class="small text-muted">click to enlarge</span></div>'
            + '<div class="row g-3" id="docs"></div>'
            + '<div class="k-alert k-warn mt-3"><i class="fas fa-magnifying-glass"></i><div>'
            + '<b>Check all four before deciding.</b>The name on the document must match the '
            + 'account, the face must match the selfie, the number must match what was typed, '
            + 'and the document must not be expired.</div></div>'
            + '</div>'

            + '<div class="card p-3 p-md-4 mt-3">'
            + '<div class="section-head"><h2>Verification checklist</h2></div>'
            + '<div id="checklist"></div>'
            + '</div>'
            + '</div>'

            /* ---- decision ---- */
            + '<div class="col-lg-5">'
            + '<div class="card p-3 p-md-4">'
            + '<div class="rv-head">'
            + '<div class="min-w-0"><div class="rv-amount" style="font-size:1.15rem">' + u.name + '</div>'
            + '<div class="rv-sub">' + rec.ref + ' · submitted ' + rec.submitted + '</div></div>'
            + '<span class="ms-auto flex-shrink-0">' + BO.pill(rec.status) + '</span></div>'

            + '<div class="rv-user mb-3">'
            + '<img src="../images/' + u.avatar + '" class="rounded-circle" width="42" height="42" alt="">'
            + '<div class="min-w-0"><div class="rv-user-name">' + u.name + '</div>'
            + '<div class="rv-user-sub">' + u.id + ' · ' + C.flag + ' ' + C.name + '</div></div>'
            + '<a href="user-details.html?id=' + u.id + '" class="btn btn-soft btn-sm ms-auto flex-shrink-0">'
            + '<i class="fas fa-user me-1"></i>Full record</a></div>'

            + '<div id="fields"></div>'

            + (rec.rejectReason
                ? '<div class="k-alert k-danger mt-3"><i class="fas fa-circle-xmark"></i><div>'
                  + '<b>Previously rejected</b>' + rec.rejectReason + '</div></div>' : '')

            + '<hr class="my-3">'
            + '<label class="form-label">Decision note</label>'
            + '<textarea class="form-control mb-2" id="kNote" rows="3" '
            + 'placeholder="Required when rejecting — the user sees this word for word."></textarea>'
            + '<div class="d-flex flex-wrap gap-2 mb-3" id="reasons"></div>'

            + '<div id="actions"></div>'
            + '</div></div></div>'
        );

        if (isLocked) {
            var me = KP.rails.myAgent();
            KP.rails.applyLock($('#kGuard'),
                me && me.status !== 'active' ? 'Your account is ' + me.status + '.'
                    : !KP.rails.can('kyc') ? 'You do not have the KYC permission.'
                    : 'You are outside your shift window.',
                me && me.status !== 'active' ? 'Contact an administrator — you cannot decide KYC.'
                    : !KP.rails.can('kyc') ? 'An administrator grants it from the Agents page.'
                    : 'Decisions are disabled until ' + KP.rails.shift.LABELS[KP.rails.shift.ASSIGNED] + '.');
        }

        var DOCS = [
            ['Identity document', '../images/kyc-id-sample.jpg', rec.docType],
            ['Live selfie', '../images/kyc-selfie-sample.jpg', 'Captured at submission'],
            ['Proof of address', '../images/kyc-document-sample.jpg', 'Utility bill, under 3 months'],
            ['Document reverse', '../images/kyc-id-sample.jpg', 'Back of the ' + rec.docType]
        ];
        $('#docs').html(DOCS.map(function (d, i) {
            return '<div class="col-6"><div class="doc-card open-doc" data-i="' + i + '">'
                + '<img src="' + d[1] + '" alt="' + d[0] + '">'
                + '<div class="doc-meta"><b>' + d[0] + '</b><span>' + d[2] + '</span></div>'
                + '<span class="doc-zoom"><i class="fas fa-expand"></i></span></div></div>';
        }).join(''));

        $('#docs').on('click', '.open-doc', function () {
            var d = DOCS[+$(this).data('i')];
            KP.showModal(d[0], '<img src="' + d[1] + '" class="w-100 rounded" alt="">'
                + '<p class="text-muted mt-2 mb-0" style="font-size:.8rem">' + d[2] + '</p>', 'modal-lg');
        });

        var F = f();
        $('#fields').html(
            '<div class="rv-group"><div class="rv-title">Submitted details</div>'
            + F('Reference', rec.ref, { mono: true })
            + F('Country', C.flag + ' ' + C.name, { copy: C.name })
            + F('Identity type', rec.idType)
            + F('Identity number', rec.idNumber, { mono: true })
            + F('Document', rec.docType)
            + F('Requesting', 'Tier ' + rec.targetTier, { nocopy: true })
            + F('Submitted', rec.submitted)
            + '</div>'
            + '<div class="rv-group"><div class="rv-title">Account</div>'
            + F('Full name', u.name)
            + F('User ID', u.id, { mono: true })
            + F('Email', u.email)
            + F('Phone', u.phone)
            + F('Current tier', 'Tier ' + u.tier, { nocopy: true })
            + F('Joined', u.joined)
            + '</div>'
        );

        $('#checklist').html([
            ['Name matches the account', 'The document name is the same as the registered name.'],
            ['Face matches the selfie', 'The person in the selfie is the person on the document.'],
            ['Number matches what was typed', rec.idType + ' on the document equals ' + rec.idNumber + '.'],
            ['Document is in date', 'Not expired, and the expiry is legible.'],
            ['Image is legible', 'All four corners visible, no glare, no crop.'],
            ['No signs of tampering', 'Fonts, spacing and photo edges look untouched.']
        ].map(function (c, i) {
            return '<label class="asset-row" style="cursor:pointer">'
                + '<input class="form-check-input mt-0 me-1 kchk" type="checkbox" id="chk' + i + '">'
                + '<div class="flex-grow-1 min-w-0"><div class="ar-name">' + c[0] + '</div>'
                + '<div class="ar-sub">' + c[1] + '</div></div></label>';
        }).join(''));

        var REASONS = [
            'Document photo is blurred or cropped',
            'Name does not match the account',
            'Document has expired',
            'Selfie does not match the document',
            'Identity number does not match',
            'Suspected tampering'
        ];
        $('#reasons').html(REASONS.map(function (r) {
            return '<button class="chip-btn r-pick">' + r + '</button>';
        }).join(''));
        $('#reasons').on('click', '.r-pick', function () {
            $('#kNote').val($(this).text() + ' — please resubmit a clear, in-date document.');
        });

        function paintActions() {
            var done = ['approved', 'rejected'].indexOf(rec.status) !== -1;
            if (done) {
                $('#actions').html('<div class="k-alert ' + (rec.status === 'approved' ? 'k-ok' : 'k-danger') + '">'
                    + '<i class="fas fa-' + (rec.status === 'approved' ? 'circle-check' : 'circle-xmark') + '"></i>'
                    + '<div><b>Already ' + rec.status + '.</b>'
                    + (rec.status === 'approved'
                        ? u.name + ' is now Tier ' + u.tier + '.'
                        : 'The user can resubmit at any time.') + '</div></div>'
                    + '<a href="kyc.html" class="btn btn-soft w-100 mt-2">Back to the queue</a>');
                return;
            }
            if (isLocked) {
                var me = KP.rails.myAgent();
                var why = me && me.status !== 'active'
                    ? '<b>Your account is ' + me.status + '.</b>Contact an administrator.'
                    : !KP.rails.can('kyc')
                        ? '<b>You do not have the KYC permission.</b>An administrator grants it from the Agents page.'
                        : '<b>Outside your shift.</b>Decisions are disabled until '
                          + KP.rails.shift.LABELS[KP.rails.shift.ASSIGNED] + '.';
                $('#actions').html('<div class="k-alert k-warn"><i class="fas fa-lock"></i><div>' + why + '</div></div>');
                return;
            }
            $('#actions').html(
                '<div class="d-grid gap-2">'
                + '<button class="btn btn-primary" id="kApprove">'
                + '<i class="fas fa-check me-1"></i>Approve Tier ' + rec.targetTier + '</button>'
                + '<button class="btn btn-soft text-danger" id="kReject">'
                + '<i class="fas fa-xmark me-1"></i>Reject and ask for a resubmission</button>'
                + '</div>'
                + '<p class="text-muted text-center mt-2 mb-0" style="font-size:.72rem">'
                + 'Your name is attached to this decision permanently.</p>');
        }
        paintActions();

        $('#actions').on('click', '#kApprove', function () {
            var checked = $('.kchk:checked').length;
            if (checked < 6 && !confirm('You have ticked ' + checked + ' of 6 checks. Approve anyway?')) return;
            rec.status = 'approved';
            u.kyc = 'verified';
            u.tier = rec.targetTier;
            KP.rails.toast('Approved. ' + u.name + ' is now Tier ' + rec.targetTier + '.');
            paintActions();
        });

        $('#actions').on('click', '#kReject', function () {
            var note = $('#kNote').val().trim();
            if (!note) { KP.rails.toast('Give the user a reason — they see this note.', 'danger'); return; }
            rec.status = 'rejected';
            rec.rejectReason = note;
            u.kyc = 'rejected';
            KP.rails.toast('Rejected with your note. The user can resubmit.', 'warning');
            paintActions();
        });
    };

    /* =========================== User details =========================== */

    DP.userDetails = function ($el, role) {
        var D = KP.data, BO = KP.bo, F = f();
        var id = decodeURIComponent(param('id') || '');
        var u = D.USERS.filter(function (x) { return x.id === id; })[0] || D.USERS[0];
        var C = KP.COUNTRIES[u.country];

        /* Everything this user has ever done, pulled from every dataset. */
        function activity() {
            var out = [];
            D.CRYPTO_DEPOSITS.forEach(function (r) { if (r.user.id === u.id) out.push({ ref: r.ref, type: 'Crypto deposit', dir: 'in', detail: KP.fmt.crypto(r.amount, r.asset) + ' · ' + r.network, usd: r.usdValue, status: r.status, date: r.date, daysAgo: r.daysAgo }); });
            D.FIAT_DEPOSITS.forEach(function (r) { if (r.user.id === u.id) out.push({ ref: r.ref, type: 'Cash deposit', dir: 'in', detail: KP.fmt.fiat(r.amount, r.currency) + ' · ' + r.source, usd: r.amount / (KP.USD_RATE[r.currency] || 1), status: r.status, date: r.date, daysAgo: r.daysAgo }); });
            D.TRADES.forEach(function (r) { if (r.user.id === u.id) out.push({ ref: r.ref, type: r.kind.charAt(0).toUpperCase() + r.kind.slice(1), dir: 'swap', detail: r.from + ' → ' + r.to, usd: r.usdValue, status: r.status, date: r.date, daysAgo: r.daysAgo }); });
            D.FIAT_WITHDRAWALS.forEach(function (r) { if (r.user.id === u.id) out.push({ ref: r.ref, type: 'Cash payout', dir: 'out', detail: KP.fmt.fiat(r.amount, r.currency) + ' → ' + r.destination, usd: r.amount / (KP.USD_RATE[r.currency] || 1), status: r.status, date: r.date, daysAgo: r.daysAgo }); });
            D.CRYPTO_WITHDRAWALS.forEach(function (r) { if (r.user.id === u.id) out.push({ ref: r.ref, type: 'Crypto send', dir: 'out', detail: KP.fmt.crypto(r.amount, r.asset) + ' · ' + r.network, usd: r.usdValue, status: r.status, date: r.date, daysAgo: r.daysAgo }); });
            return out.sort(function (a, b) { return a.daysAgo - b.daysAgo; });
        }
        var acts = activity();
        var volUsd = acts.reduce(function (s, a) { return s + a.usd; }, 0);
        var okRate = acts.length ? acts.filter(function (a) { return a.status === 'successful'; }).length / acts.length * 100 : 0;
        var blocked = KP.rails.block.isBlocked(u);

        /* Deterministic device and session history, seeded off the user id. */
        var seed = parseInt(u.id.replace(/\D/g, ''), 10) || 1;
        function ip(n) { return (102 + n % 40) + '.' + (89 + n % 60) + '.' + (n * 7 % 250) + '.' + (n * 13 % 250); }
        var DEVICES = [
            { d: 'iPhone 15 Pro · iOS 17.4', i: 'fa-mobile-screen', loc: C.name, ip: ip(seed), last: 'Active now', cur: true, trusted: true },
            { d: 'Chrome 121 · Windows 11', i: 'fa-desktop', loc: C.name, ip: ip(seed + 3), last: '2 hours ago', cur: false, trusted: true },
            { d: 'Safari · macOS Sonoma', i: 'fa-laptop', loc: 'Accra, Ghana', ip: ip(seed + 11), last: '4 days ago', cur: false, trusted: false }
        ];

        $el.html(
            '<a href="users.html" class="btn btn-soft btn-sm mb-3"><i class="fas fa-arrow-left me-1"></i>Back to users</a>'

            /* header */
            + '<div class="card p-3 p-md-4 mb-3">'
            + '<div class="d-flex align-items-center gap-3 flex-wrap">'
            + '<img src="../images/' + u.avatar + '" class="rounded-circle flex-shrink-0" width="66" height="66" alt="">'
            + '<div class="min-w-0 flex-grow-1">'
            + '<div class="d-flex align-items-center gap-2 flex-wrap">'
            + '<h2 class="card-title" style="font-size:1.15rem">' + u.name + '</h2>'
            + '<span class="tier-badge tier-' + u.tier + '">Tier ' + u.tier + '</span>'
            + BO.pill(u.kyc) + BO.pill(blocked ? 'blocked' : 'active') + '</div>'
            + '<div class="small text-muted mt-1">' + u.id + ' · ' + C.flag + ' ' + C.name
            + ' · joined ' + u.joined + ' · last seen ' + u.lastSeen + '</div></div>'
            + '<div class="d-flex gap-2 flex-wrap" id="userActions"></div>'
            + '</div></div>'

            /* stats */
            + '<div class="stat-strip mb-3" id="uStats"></div>'
            + '<div class="strip-dots" data-for="uStats"></div>'

            + '<div class="row g-3 mt-0">'
            + '<div class="col-lg-5">'
            + '<div class="card p-3 p-md-4"><div class="section-head"><h2>Profile</h2></div>'
            + '<div id="profileFields"></div></div>'
            + '<div class="card p-3 p-md-4 mt-3"><div class="section-head"><h2>Balances</h2></div>'
            + '<div id="balances"></div></div>'
            + '</div>'

            + '<div class="col-lg-7">'
            + '<ul class="nav nav-tabs mb-3">'
            + '<li class="nav-item"><button class="nav-link active" data-bs-toggle="tab" data-bs-target="#uAct">Activity</button></li>'
            + '<li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#uSec">Security</button></li>'
            + '<li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#uKyc">KYC</button></li>'
            + '</ul>'
            + '<div class="tab-content">'
            + '<div class="tab-pane fade show active" id="uAct"><div class="card p-3">'
            + '<div class="table-responsive"><table id="actTable" class="table w-100 dt-nowrap"><thead><tr>'
            + '<th>Reference</th><th>Type</th><th>Detail</th><th class="text-end">USD</th>'
            + '<th>Status</th><th>Date</th></tr></thead><tbody></tbody></table></div></div></div>'
            + '<div class="tab-pane fade" id="uSec"></div>'
            + '<div class="tab-pane fade" id="uKyc"></div>'
            + '</div></div></div>'
        );

        /* --- stats --- */
        $('#uStats').html(
            BO.statTile({ label: 'Transactions', value: acts.length, icon: 'fa-list', tone: 'blue', note: 'lifetime' })
            + BO.statTile({ label: 'Lifetime volume', value: '$' + KP.fmt.compact(volUsd), icon: 'fa-chart-simple', tone: 'green', note: 'USD equivalent' })
            + BO.statTile({ label: 'Cash balance', value: KP.fmt.fiat(u.fiatBalance, u.currency), icon: 'fa-wallet', tone: 'green', note: u.currency + ' available' })
            + BO.statTile({ label: 'Crypto value', value: KP.fmt.usd(u.usdValue), icon: 'fa-bitcoin-sign', tone: 'amber', note: 'across all wallets' })
            + BO.statTile({ label: 'Success rate', value: okRate.toFixed(0) + '%', icon: 'fa-circle-check', tone: 'green', note: 'settled first time' })
            + BO.statTile({ label: 'Daily limit', value: KP.fmt.usd(KP.TIERS[u.tier].dailyUsd), icon: 'fa-gauge-high', tone: 'purple', note: 'Tier ' + u.tier })
        );
        BO.stripDots('#uStats');

        /* --- profile --- */
        $('#profileFields').html(
            '<div class="rv-group"><div class="rv-title">Identity</div>'
            + F('Full name', u.name) + F('User ID', u.id, { mono: true })
            + F('Email', u.email) + F('Phone', u.phone)
            + F('Country', C.flag + ' ' + C.name, { copy: C.name })
            + F('Base currency', u.currency, { nocopy: true })
            + '</div>'
            + '<div class="rv-group"><div class="rv-title">Account</div>'
            + F('Tier', 'Tier ' + u.tier + ' · ' + KP.TIERS[u.tier].name, { nocopy: true })
            + F('KYC status', u.kyc, { nocopy: true })
            + F('Access', blocked ? 'Blocked' : 'Active', { nocopy: true })
            + F('Joined', u.joined) + F('Last seen', u.lastSeen, { nocopy: true })
            + '</div>'
            + '<div class="rv-group"><div class="rv-title">Deposit account</div>'
            + (u.virtualAccount
                ? F('Institution', u.virtualAccount.bank)
                  + F('Number', u.virtualAccount.number, { mono: true })
                  + F('Account name', u.virtualAccount.name)
                : F('Status', 'Not issued — user is not verified', { nocopy: true }))
            + '</div>'
        );

        /* --- balances --- */
        var holdings = KP.ASSET_LIST.slice(0, 4).map(function (a, i) {
            var qty = (u.usdValue / KP.rates.midUsd(a.symbol)) * [0.5, 0.25, 0.15, 0.1][i];
            return { a: a, qty: qty, usd: qty * KP.rates.midUsd(a.symbol) };
        });
        $('#balances').html(
            '<div class="asset-row"><div class="qa-icon qa-green sm"><i class="fas fa-money-bill"></i></div>'
            + '<div class="flex-grow-1 min-w-0"><div class="ar-name">Cash · ' + u.currency + '</div>'
            + '<div class="ar-sub">' + KP.fmt.usd(u.fiatBalance / (KP.USD_RATE[u.currency] || 1)) + ' equivalent</div></div>'
            + '<div class="ar-right"><div class="ar-amt">' + KP.fmt.fiat(u.fiatBalance, u.currency) + '</div></div></div>'
            + holdings.map(function (h) {
                return '<div class="asset-row">'
                    + '<div class="asset-icon sm" style="background:' + h.a.color + '">' + h.a.symbol.slice(0, 3) + '</div>'
                    + '<div class="flex-grow-1 min-w-0"><div class="ar-name">' + h.a.symbol + '</div>'
                    + '<div class="ar-sub">' + h.a.name + '</div></div>'
                    + '<div class="ar-right"><div class="ar-amt">' + KP.fmt.crypto(h.qty, h.a.symbol) + '</div>'
                    + '<div class="ar-sub">' + KP.fmt.usd(h.usd) + '</div></div></div>';
            }).join('')
        );

        /* --- activity table --- */
        $('#actTable').DataTable({
            data: acts.map(function (a) {
                var ic = a.dir === 'in' ? 'fa-arrow-down' : a.dir === 'out' ? 'fa-arrow-up' : 'fa-right-left';
                var tone = a.dir === 'in' ? 'tx-in' : a.dir === 'out' ? 'tx-out' : 'tx-swap';
                return [
                    '<span class="t-strong">' + a.ref + '</span>',
                    '<div class="d-flex align-items-center gap-2">'
                        + '<span class="tx-icon ' + tone + '" style="width:24px;height:24px;font-size:.58rem">'
                        + '<i class="fas ' + ic + '"></i></span>' + a.type + '</div>',
                    '<span class="t-mono">' + a.detail + '</span>',
                    '<span class="t-strong">' + KP.fmt.usd(a.usd) + '</span>',
                    BO.pill(a.status),
                    '<span class="t-mono">' + a.date + '</span>'
                ];
            }),
            autoWidth: false, responsive: true, order: [], pageLength: 8, lengthChange: false,
            columnDefs: [{ targets: 3, className: 'text-end' }],
            language: {
                search: '', searchPlaceholder: 'Search this user…',
                info: '_START_–_END_ of _TOTAL_', infoEmpty: 'No activity',
                emptyTable: '<div class="empty-state"><i class="fas fa-list"></i><p>This user has not transacted yet.</p></div>',
                paginate: { previous: '<i class="fas fa-chevron-left"></i>', next: '<i class="fas fa-chevron-right"></i>' }
            }
        });

        /* --- security --- */
        $('#uSec').html(
            '<div class="card p-3 p-md-4"><div class="section-head"><h2>Devices &amp; sessions</h2>'
            + '<span class="small text-muted">' + DEVICES.length + ' known</span></div>'
            + DEVICES.map(function (d) {
                return '<div class="asset-row">'
                    + '<div class="qa-icon ' + (d.cur ? 'qa-green' : 'qa-slate') + ' sm"><i class="fas ' + d.i + '"></i></div>'
                    + '<div class="flex-grow-1 min-w-0"><div class="ar-name">' + d.d
                    + (d.cur ? ' <span class="pill pill-success">current</span>' : '')
                    + (d.trusted ? '' : ' <span class="pill pill-pending">unrecognised</span>') + '</div>'
                    + '<div class="ar-sub">' + d.loc + ' · IP ' + d.ip + ' · ' + d.last + '</div></div>'
                    + '<button class="rv-copy kp-copy" data-copy="' + d.ip + '" title="Copy IP">'
                    + '<i class="fas fa-copy"></i></button></div>';
            }).join('')
            + '</div>'

            + '<div class="card p-3 p-md-4 mt-3"><div class="section-head"><h2>Security posture</h2></div>'
            + [['Transaction PIN', 'Set', 'pill-success'],
               ['Two-factor authentication', u.tier > 1 ? 'Enabled' : 'Not enabled', u.tier > 1 ? 'pill-success' : 'pill-pending'],
               ['Address whitelisting', u.tier > 1 ? 'On' : 'Off', u.tier > 1 ? 'pill-success' : 'pill-pending'],
               ['Password age', '3 months', 'pill-neutral'],
               ['Failed PIN attempts (30d)', String(seed % 4), (seed % 4) > 2 ? 'pill-pending' : 'pill-success'],
               ['Sanctions screening', 'Clear', 'pill-success'],
               ['Risk score', (seed % 30) + ' / 100', (seed % 30) > 20 ? 'pill-pending' : 'pill-success']
              ].map(function (x) {
                return '<div class="rv-row"><span class="rv-k">' + x[0] + '</span>'
                    + '<span class="rv-v"><span class="pill ' + x[2] + '">' + x[1] + '</span></span></div>';
              }).join('')
            + '</div>'

            + '<div class="card p-3 p-md-4 mt-3"><div class="section-head"><h2>Access control</h2></div>'
            + '<div id="accessBox"></div></div>'
        );

        /* --- KYC tab --- */
        var kyc = D.KYC_QUEUE.filter(function (k) { return k.user.id === u.id; })[0];
        $('#uKyc').html('<div class="card p-3 p-md-4">'
            + '<div class="section-head"><h2>Verification</h2>'
            + (kyc ? '<a href="kyc-review.html?ref=' + kyc.ref + '" class="btn btn-primary btn-sm">'
                     + '<i class="fas fa-id-card me-1"></i>Open review</a>' : '') + '</div>'
            + (kyc
                ? '<div class="rv-group">'
                  + F('Reference', kyc.ref, { mono: true })
                  + F('Identity type', kyc.idType)
                  + F('Identity number', kyc.idNumber, { mono: true })
                  + F('Document', kyc.docType)
                  + F('Requesting', 'Tier ' + kyc.targetTier, { nocopy: true })
                  + F('Submitted', kyc.submitted)
                  + F('Status', kyc.status, { nocopy: true })
                  + '</div>'
                  + (kyc.rejectReason
                    ? '<div class="k-alert k-danger mt-2"><i class="fas fa-circle-xmark"></i><div>'
                      + '<b>Rejection reason</b>' + kyc.rejectReason + '</div></div>' : '')
                : '<div class="empty-state"><i class="fas fa-id-card"></i>'
                  + '<p>No submission on file. This user is on Tier ' + u.tier + '.</p></div>')
            + '<hr class="my-3"><div class="rv-group"><div class="rv-title">Limits at this tier</div>'
            + F('Daily', KP.fmt.usd(KP.TIERS[u.tier].dailyUsd), { nocopy: true })
            + F('Per transaction', KP.fmt.usd(KP.TIERS[u.tier].perTxUsd), { nocopy: true })
            + F('Unlocked by', KP.TIERS[u.tier].needs, { nocopy: true })
            + '</div></div>');

        /* --- actions, gated by role --- */
        function paintAccess() {
            var b = KP.rails.block.isBlocked(u);
            $('#userActions').html(
                (b
                    ? (role === 'admin'
                        ? '<button class="btn btn-primary btn-sm" id="unblockBtn"><i class="fas fa-unlock me-1"></i>Unblock</button>'
                        : '<span class="pill pill-neutral"><i class="fas fa-lock"></i>Admin unblocks</span>')
                    : (role === 'admin' || KP.rails.can('block')
                        ? '<button class="btn btn-soft btn-sm text-danger" id="blockBtn"><i class="fas fa-ban me-1"></i>Block</button>'
                        : '<span class="pill pill-neutral"><i class="fas fa-lock"></i>No block permission</span>'))
                + '<button class="btn btn-soft btn-sm" id="msgBtn"><i class="fas fa-envelope me-1"></i>Message</button>'
            );
            $('#accessBox').html(
                '<div class="k-alert ' + (b ? 'k-danger' : 'k-ok') + ' mb-3">'
                + '<i class="fas fa-' + (b ? 'ban' : 'circle-check') + '"></i><div>'
                + '<b>' + (b ? 'This account is blocked.' : 'This account is active.') + '</b>'
                + (b ? 'The user cannot log in, trade or withdraw. Balances are untouched.'
                     : 'The user has full access at Tier ' + u.tier + '.') + '</div></div>'
                + (b
                    ? (role === 'admin'
                        ? '<button class="btn btn-primary w-100" id="unblockBtn2"><i class="fas fa-unlock me-1"></i>Restore access</button>'
                        : '<div class="k-alert k-warn"><i class="fas fa-lock"></i><div>'
                          + '<b>Only an admin can lift a block.</b>An agent cannot quietly undo '
                          + 'their own restriction — that asymmetry is the control.</div></div>')
                    : '<button class="btn btn-soft w-100 text-danger" id="blockBtn2">'
                      + '<i class="fas fa-ban me-1"></i>Block this account</button>')
            );
        }
        paintAccess();

        $el.on('click', '#blockBtn, #blockBtn2', function () {
            KP.rails.block.block(u.id);
            KP.rails.toast('Blocked ' + u.name + '. Only an admin can lift this.', 'warning');
            paintAccess();
        });
        $el.on('click', '#unblockBtn, #unblockBtn2', function () {
            KP.rails.block.unblock(u.id);
            KP.rails.toast('Restored access for ' + u.name + '.');
            paintAccess();
        });
        $el.on('click', '#msgBtn', function () {
            KP.rails.toast('Opens a support thread with this user attached.');
        });
    };

    global.KP = global.KP || {};
    global.KP.detail = DP;

})(window, jQuery);
