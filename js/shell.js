/* ==========================================================================
   Kaastro Pay — portal shell
   The reference repeats its sidebar markup in every file, which is how nav
   items drift out of sync. Here one renderer builds the sidebar, the mobile
   offcanvas, the top bar and the mobile tab bar from a single nav definition,
   driven by <body data-portal="user|agent|admin" data-page="...">.
   ========================================================================== */
(function (global, $) {
    'use strict';

    var NAV = {
        user: [
            { id: 'home', href: 'index.html', icon: 'fa-house', label: 'Home' },
            { s: 'Money' },
            { id: 'deposit', href: 'deposit.html', icon: 'fa-arrow-down', label: 'Deposit' },
            { id: 'withdraw', href: 'withdraw.html', icon: 'fa-arrow-up', label: 'Withdraw' },
            { id: 'transfer', href: 'transfer.html', icon: 'fa-paper-plane', label: 'Transfer' },
            { id: 'request', href: 'request.html', icon: 'fa-hand-holding-dollar', label: 'Request' },
            { id: 'payment-links', href: 'payment-links.html', icon: 'fa-link', label: 'Payment Links' },
            { id: 'send-abroad', href: 'send-abroad.html', icon: 'fa-earth-africa', label: 'Send Abroad' },
            { id: 'scan', href: 'scan.html', icon: 'fa-qrcode', label: 'Scan &amp; Pay' },
            { id: 'contacts', href: 'contacts.html', icon: 'fa-user-group', label: 'Contacts' },
            { s: 'Services' },
            { id: 'bills', href: 'bills.html', icon: 'fa-bolt', label: 'Pay Bills' },
            { id: 'rates', href: 'rates.html', icon: 'fa-chart-line', label: 'Today\u2019s Rates' },
            { id: 'alerts', href: 'alerts.html', icon: 'fa-bell-concierge', label: 'Rate Alerts' },
            { id: 'rewards', href: 'rewards.html', icon: 'fa-gift', label: 'Rewards' },
            { s: 'Account' },
            { id: 'insights', href: 'insights.html', icon: 'fa-chart-pie', label: 'Insights' },
            { id: 'verification', href: 'profile.html#verification', icon: 'fa-user-shield', label: 'Verification' },
            { id: 'notifications', href: 'notifications.html', icon: 'fa-bell', label: 'Notifications', badge: 'notifs' },
            { id: 'profile', href: 'profile.html', icon: 'fa-gear', label: 'Profile &amp; Security' },
            { id: 'security', href: 'security.html', icon: 'fa-sliders', label: 'Limits &amp; Devices' },
            { id: 'support', href: 'support.html', icon: 'fa-headset', label: 'Support' }
        ],
        agent: [
            { id: 'dashboard', href: 'dashboard.html', icon: 'fa-gauge-high', label: 'Dashboard' },
            { id: 'users', href: 'users.html', icon: 'fa-users', label: 'Users' },
            { id: 'kyc', href: 'kyc.html', icon: 'fa-user-shield', label: 'KYC Queue', badge: 'kyc' },
            { s: 'Queues' },
            { id: 'deposits', href: 'deposits.html', icon: 'fa-arrow-down', label: 'Deposits', badge: 'deposits' },
            { id: 'withdrawals', href: 'withdrawals.html', icon: 'fa-arrow-up', label: 'Withdrawals', badge: 'withdrawals' },
            { id: 'trades', href: 'trades.html', icon: 'fa-right-left', label: 'Trades' },
            { id: 'payment-links', href: 'payment-links.html', icon: 'fa-link', label: 'Payment Links' },
            { s: 'Other' },
            { id: 'transactions', href: 'transactions.html', icon: 'fa-list', label: 'All Transactions' },
            { id: 'support', href: 'support.html', icon: 'fa-headset', label: 'Support', badge: 'tickets' },
            { id: 'settings', href: 'settings.html', icon: 'fa-gear', label: 'Settings' }
        ],
        admin: [
            { id: 'dashboard', href: 'dashboard.html', icon: 'fa-gauge-high', label: 'Dashboard' },
            { id: 'users', href: 'users.html', icon: 'fa-users', label: 'Users' },
            { id: 'kyc', href: 'kyc.html', icon: 'fa-user-shield', label: 'KYC Queue', badge: 'kyc' },
            { s: 'Queues' },
            { id: 'deposits', href: 'deposits.html', icon: 'fa-arrow-down', label: 'Deposits', badge: 'deposits' },
            { id: 'withdrawals', href: 'withdrawals.html', icon: 'fa-arrow-up', label: 'Withdrawals', badge: 'withdrawals' },
            { id: 'trades', href: 'trades.html', icon: 'fa-right-left', label: 'Trades' },
            { id: 'payment-links', href: 'payment-links.html', icon: 'fa-link', label: 'Payment Links' },
            { id: 'escalations', href: 'escalations.html', icon: 'fa-arrow-up-right-dots', label: 'Escalations', badge: 'escalations' },
            { id: 'transactions', href: 'transactions.html', icon: 'fa-list', label: 'All Transactions' },
            { s: 'Control' },
            { id: 'rates', href: 'rates.html', icon: 'fa-percent', label: 'Rates & Margins' },
            { id: 'fees', href: 'fees.html', icon: 'fa-receipt', label: 'Fee Manager' },
            { id: 'tiers', href: 'tiers.html', icon: 'fa-layer-group', label: 'Tiers & Limits' },
            { id: 'countries', href: 'countries.html', icon: 'fa-earth-africa', label: 'Countries' },
            { id: 'treasury', href: 'treasury.html', icon: 'fa-vault', label: 'Treasury' },
            { s: 'Platform' },
            { id: 'agents', href: 'agents.html', icon: 'fa-user-tie', label: 'Agents' },
            { id: 'reports', href: 'reports.html', icon: 'fa-chart-pie', label: 'Reports' },
            { id: 'support', href: 'support.html', icon: 'fa-headset', label: 'Support', badge: 'tickets' },
            { id: 'settings', href: 'settings.html', icon: 'fa-gear', label: 'Settings' }
        ]
    };

    /* Five tabs, with Scan raised in the middle — the shape in the mockups. */
    var TABBAR = [
        { id: 'home', href: 'index.html', icon: 'fa-house', label: 'Home' },
        { id: 'contacts', href: 'contacts.html', icon: 'fa-user-group', label: 'Contacts' },
        { id: 'scan', href: 'scan.html', icon: 'fa-qrcode', label: 'Scan', fab: true },
        { id: 'insights', href: 'insights.html', icon: 'fa-chart-simple', label: 'Insights' },
        { id: 'more', href: 'more.html', icon: 'fa-grip', label: 'More', dot: 'notifs' }
    ];

    /* Pages that are not themselves a tab still light one up, so the bar never
       shows an empty state while the user is inside a flow. Rates moved off the
       bar when Contacts took its slot, so it points at More alongside the rest
       of the account tools. */
    var TAB_ALIAS = {
        deposit: 'home', withdraw: 'home', transfer: 'home',
        request: 'home', 'send-abroad': 'home', bills: 'home',
        'payment-links': 'home', beneficiaries: 'contacts',
        rates: 'more', profile: 'more', security: 'more', settings: 'more',
        verification: 'more', support: 'more', notifications: 'more',
        statements: 'more', limits: 'more', rewards: 'more', alerts: 'more'
    };

    var PORTAL_META = {
        user: { tag: 'Wallet', root: '../' },
        agent: { tag: 'Agent', root: '../' },
        admin: { tag: 'Admin', root: '../' }
    };

    function loginHref(portal) {
        return portal === 'agent' ? '../agent-login.html'
             : portal === 'admin' ? '../admin-login.html'
             : '../login.html';
    }

    function badgeCount(key) {
        var p = global.KP.data.pendingCounts();
        if (key === 'kyc') return p.kyc;
        if (key === 'deposits') return p.cryptoDeposits + p.fiatDeposits;
        if (key === 'withdrawals') return p.fiatWithdrawals + p.cryptoWithdrawals;
        if (key === 'escalations') { try { return KP.rails.escalation.open().length; } catch (e) { return 0; } }
        if (key === 'tickets') return p.tickets;
        if (key === 'notifs') return global.KP.data.unreadNotifications();
        return 0;
    }

    /* Detail pages are not nav entries, but they still belong to one — keep
       the sidebar highlighted so the operator never loses their place. */
    var NAV_ALIAS = { 'kyc-review': 'kyc', 'user-details': 'users', more: 'profile' };

    function navHtml(portal, page) {
        page = NAV_ALIAS[page] || page;
        return NAV[portal].map(function (n) {
            if (n.s) return '<div class="nav-section">' + n.s + '</div>';
            var b = '';
            if (n.badge) {
                var c = badgeCount(n.badge);
                if (c) b = '<span class="badge rounded-pill bg-danger">' + c + '</span>';
            }
            return '<a href="' + n.href + '" class="nav-link' + (n.id === page ? ' active' : '') + '">' +
                '<i class="fas ' + n.icon + '"></i><span>' + n.label + '</span>' + b + '</a>';
        }).join('');
    }

    function brandHtml(portal) {
        var m = PORTAL_META[portal];
        /* Both wordmark variants ship; CSS reveals whichever suits the theme,
           because "PAY" is near-white and the sidebar is not always dark. */
        return '<a href="' + (portal === 'user' ? 'index.html' : 'dashboard.html') + '" class="brand-logo">' +
            '<span class="brand-img">' +
            '<img src="../images/logo-onLight.png" alt="Kaastro Pay" class="bi-light">' +
            '<img src="../images/logo-onDark.png" alt="" aria-hidden="true" class="bi-dark">' +
            '</span>' +
            '<span class="brand-tag">' + m.tag + '</span></a>';
    }

    function countrySwitcher() {
        var cur = global.KP.currentCountry();
        var items = global.KP.COUNTRY_LIST.map(function (c) {
            return '<li><a class="dropdown-item d-flex align-items-center gap-2 kp-country" href="#" data-cc="' + c.code + '">' +
                '<span>' + c.flag + '</span><span class="flex-grow-1">' + c.name + '</span>' +
                '<small class="text-muted">' + c.currency + '</small>' +
                (c.code === cur.code ? '<i class="fas fa-check text-primary-k ms-1"></i>' : '') + '</a></li>';
        }).join('');
        return '<div class="dropdown">' +
            '<button class="btn btn-soft btn-sm d-flex align-items-center gap-2" data-bs-toggle="dropdown" title="Preview another country">' +
            '<span>' + cur.flag + '</span><span class="d-none d-sm-inline">' + cur.currency + '</span>' +
            '<i class="fas fa-chevron-down" style="font-size:.6rem"></i></button>' +
            '<ul class="dropdown-menu dropdown-menu-end p-2">' +
            '<li><p class="small text-muted px-2 mb-2">View the app as a user from…</p></li>' + items + '</ul></div>';
    }

    function topbarHtml(portal, opts) {
        var me = global.KP.data.ME;
        var who = portal === 'user' ? me.name
            : portal === 'agent' ? 'James Bond' : 'Admin User';
        var role = portal === 'user'
            ? '<span class="tier-badge tier-' + me.tier + '">Tier ' + me.tier + '</span>'
            : '<span class="tier-badge tier-2">' + (portal === 'agent' ? 'Agent · Morning' : 'Super Admin') + '</span>';
        var avatar = portal === 'user' ? me.avatar : (portal === 'agent' ? 'avatar-johntrader.jpg' : 'avatar-a1.jpg');

        var unread = global.KP.data.unreadNotifications();
        var notifs = global.KP.data.NOTIFS.slice(0, 4).map(function (n) {
            return '<li><div class="dropdown-item d-flex gap-2 align-items-start" style="white-space:normal">' +
                '<div class="tx-icon tx-' + n.tone + '" style="width:30px;height:30px;font-size:.7rem"><i class="fas ' + n.icon + '"></i></div>' +
                '<div><b class="d-block" style="font-size:.8rem">' + n.title + '</b>' +
                '<small class="text-muted">' + n.body + '</small><br><small class="text-muted" style="font-size:.68rem">' + n.time + '</small></div></div></li>';
        }).join('<li><hr class="dropdown-divider my-1"></li>');

        return '<header class="top-navbar d-flex align-items-center justify-content-between gap-2">' +
            '<div class="d-flex align-items-center gap-2 min-w-0">' +
            '<button class="icon-btn d-lg-none" data-bs-toggle="offcanvas" data-bs-target="#kpMobileNav" aria-label="Menu"><i class="fas fa-bars"></i></button>' +
            '<div class="min-w-0"><h1 class="page-title text-truncate">' + (opts.title || '') + '</h1>' +
            (opts.sub ? '<p class="page-sub text-truncate">' + opts.sub + '</p>' : '') + '</div></div>' +
            '<div class="d-flex align-items-center gap-2 flex-shrink-0">' +
            (portal === 'user' ? countrySwitcher() : '') +
            '<button class="icon-btn" id="kpThemeBtn" aria-label="Toggle dark mode"><i class="fas fa-moon"></i></button>' +
            '<div class="dropdown"><button class="icon-btn position-relative" data-bs-toggle="dropdown" aria-label="Notifications">' +
            '<i class="fas fa-bell"></i>' + (unread ? '<span class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger" style="font-size:.55rem">' + unread + '</span>' : '') + '</button>' +
            '<ul class="dropdown-menu dropdown-menu-end p-2" style="width:300px">' +
            '<li><p class="small text-muted px-2 mb-2 fw-bold">Notifications</p></li>' + notifs +
            (portal === 'user' ? '<li><hr class="dropdown-divider my-1"></li>' +
                '<li><a class="dropdown-item text-center fw-bold text-primary-k" href="notifications.html">See all</a></li>' : '') +
            '</ul></div>' +
            '<div class="dropdown"><div class="d-flex align-items-center gap-2 cursor-pointer" data-bs-toggle="dropdown">' +
            '<img src="../images/' + avatar + '" class="rounded-circle" width="36" height="36" alt="">' +
            '<div class="d-none d-md-block lh-sm"><div style="font-size:.8rem;font-weight:700">' + who + '</div>' + role + '</div></div>' +
            '<ul class="dropdown-menu dropdown-menu-end p-2">' +
            (portal === 'user' ? '<li><a class="dropdown-item" href="profile.html"><i class="fas fa-user me-2"></i>Profile</a></li>' +
                '<li><a class="dropdown-item" href="profile.html#verification"><i class="fas fa-user-shield me-2"></i>Verification</a></li>' : '') +
            '<li><hr class="dropdown-divider"></li>' +
            '<li><a class="dropdown-item text-danger" href="' + loginHref(portal) + '"><i class="fas fa-right-from-bracket me-2"></i>Log out</a></li>' +
            '</ul></div></div></header>';
    }

    function tabbarHtml(page) {
        var active = TAB_ALIAS[page] || page;
        return '<nav class="tabbar d-lg-none">' + TABBAR.map(function (t) {
            var dot = t.dot && badgeCount(t.dot) ? '<span class="tb-dot"></span>' : '';
            return '<a href="' + t.href + '" class="'
                + (t.fab ? 'tb-fab ' : '') + (t.id === active ? 'active' : '') + '">'
                + '<span class="tb-ico"><i class="fas ' + t.icon + '"></i></span>' + dot
                + '<span>' + t.label + '</span></a>';
        }).join('') + '</nav>';
    }

    function build() {
        var $b = $('body');
        var portal = $b.data('portal');
        if (!portal) return;
        var page = $b.data('page');
        var title = $b.data('title') || '';
        var sub = $b.data('sub') || '';

        var nav = navHtml(portal, page);

        $b.prepend(
            '<aside class="sidebar d-none d-lg-flex">' + brandHtml(portal) +
            '<nav class="nav flex-column mt-3">' + nav + '</nav>' +
            '<div class="sidebar-footer"><hr>' +
            '<a href="' + loginHref(portal) + '" class="nav-link text-danger"><i class="fas fa-right-from-bracket"></i><span>Log out</span></a>' +
            '</div></aside>' +
            '<div class="offcanvas offcanvas-start offcanvas-sidebar d-lg-none" tabindex="-1" id="kpMobileNav">' +
            '<div class="offcanvas-header pb-0">' + brandHtml(portal) +
            '<button type="button" class="btn-close" data-bs-dismiss="offcanvas" aria-label="Close"></button></div>' +
            '<div class="offcanvas-body"><nav class="nav flex-column">' + nav +
            '<a href="' + loginHref(portal) + '" class="nav-link text-danger mt-3"><i class="fas fa-right-from-bracket"></i><span>Log out</span></a>' +
            '</nav></div></div>'
        );

        $('.main-content').prepend(topbarHtml(portal, { title: title, sub: sub }));

        if (portal === 'user') {
            $b.append(tabbarHtml(page));
        }

        // Country switch reloads the page so every formatted amount re-renders.
        $(document).on('click', '.kp-country', function (e) {
            e.preventDefault();
            global.KP.setCountry($(this).data('cc'));
            location.reload();
        });
    }

    global.KP = global.KP || {};
    global.KP.shell = { build: build, NAV: NAV };

    $(build);

})(window, jQuery);
