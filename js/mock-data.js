/* ==========================================================================
   Kaastro Pay — shared mock datasets for the user, agent and admin portals.
   Deterministic (no Math.random) so all three portals always render the same
   figures. Crypto only: deposits, buys, sells, swaps, withdrawals, KYC.
   ========================================================================== */
(function (global) {
    'use strict';

    var REF = new Date(2026, 8, 1);   // fixed reference date: Sep 1, 2026

    var NAMES = [
        'Chukwudi Okeke', 'Sarah Adams', 'Michael Kelvin', 'Blessing Okafor', 'Tunde Alabi',
        'Amaka Chinwe', 'David Mensah', 'Grace Okoro', 'Ibrahim Musa', 'Chidinma Eze',
        'Peter Obi-Anya', 'Fatima Bello', 'Emeka Nwosu', 'Ruth Adebayo', 'Samuel Okon',
        'Ngozi Umeh', 'Kelvin Iheanacho', 'Aisha Yusuf', 'Victor Uche', 'Patience Effiong',
        'Daniel Osei', 'Comfort Etim', 'Yusuf Aliyu', 'Joy Nnamdi', 'Bright Amadi',
        'Akosua Boateng', 'Wanjiru Kamau', 'Juma Mwakalinga', 'Nakato Ssali', 'Kwame Asante'
    ];
    var DOMAINS = ['gmail.com', 'yahoo.com', 'outlook.com', 'proton.me'];
    var CC = ['NG', 'NG', 'NG', 'GH', 'KE', 'NG', 'TZ', 'NG', 'UG', 'GH'];
    var ASSET_KEYS = ['USDT', 'USDT', 'BTC', 'USDT', 'ETH', 'USDC', 'USDT', 'BNB', 'TRX', 'BTC'];
    var NETS = { USDT: ['TRC20', 'BEP20', 'ERC20'], USDC: ['TRC20', 'BEP20'], BTC: ['BTC'], ETH: ['ERC20'], BNB: ['BEP20'], TRX: ['TRC20'] };
    var AVATARS = ['avatar-john.jpg', 'avatar-a1.jpg', 'avatar-b2.jpg', 'avatar-c3.jpg',
        'avatar-mercy24.jpg', 'avatar-tunde2000.jpg', 'avatar-blessingfx.jpg', 'avatar-johntrader.jpg'];

    var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    function dateBack(daysAgo, hh, mm) {
        var d = new Date(REF.getTime());
        d.setDate(d.getDate() - daysAgo);
        var t = (hh % 12 === 0 ? 12 : hh % 12) + ':' + String(mm).padStart(2, '0') + (hh < 12 ? ' AM' : ' PM');
        return MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear() + ' · ' + t;
    }
    function shortDate(daysAgo) {
        var d = new Date(REF.getTime());
        d.setDate(d.getDate() - daysAgo);
        return MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
    }
    /* Compact form for table cells — the receipt still carries the full stamp. */
    function shortStamp(daysAgo, hh, mm) {
        var d = new Date(REF.getTime());
        d.setDate(d.getDate() - daysAgo);
        var t = (hh % 12 === 0 ? 12 : hh % 12) + ':' + String(mm).padStart(2, '0') + (hh < 12 ? 'am' : 'pm');
        return MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + t;
    }

    function relDay(daysAgo) {
        if (daysAgo === 0) return 'Today';
        if (daysAgo === 1) return 'Yesterday';
        return shortDate(daysAgo);
    }
    function hashAddr(prefix, i, len) {
        var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz123456789';
        var out = prefix;
        var s = i * 7919 + 13;
        while (out.length < len) {
            s = (s * 1103515245 + 12345) % 2147483648;
            out += chars[s % chars.length];
        }
        return out;
    }
    function txHash(i) { return hashAddr('0x', i, 42); }
    function statusFor(i, pendEvery, failEvery) {
        if (i % pendEvery === 0) return 'pending';
        if (i % failEvery === 0) return 'failed';
        return 'successful';
    }

    /* ------------------------------- Users ------------------------------- */

    var USERS = NAMES.map(function (name, i) {
        var cc = CC[i % CC.length];
        var c = global.KP.COUNTRIES[cc];
        var joinedDaysAgo = i < 3 ? 0 : 12 + i * 9;
        var base = name.toLowerCase().replace(/[^a-z\s]/g, '').trim().split(/\s+/).join('.');
        var tier = i % 4;
        return {
            id: 'KP-' + (10240 + i),
            name: name,
            email: base + (i || '') + '@' + DOMAINS[i % DOMAINS.length],
            phone: '+' + (cc === 'NG' ? '234' : cc === 'GH' ? '233' : cc === 'KE' ? '254' : cc === 'TZ' ? '255' : '256')
                + ' ' + (700 + i) + ' ' + (100 + i * 7) + ' ' + (2000 + i * 13).toString().slice(-4),
            country: cc,
            countryName: c.name,
            currency: c.currency,
            tier: tier,
            kyc: (i % 5 === 4) ? 'pending' : (i % 7 === 6 ? 'rejected' : (tier === 0 ? 'unverified' : 'verified')),
            status: (i % 11 === 10) ? 'blocked' : 'active',
            virtualAccount: tier > 0 ? {
                bank: cc === 'NG' ? 'Providus Bank' : c.banks[0],
                number: cc === 'NG' ? String(9020000000 + i * 137) : '+' + (233000000 + i),
                name: 'KAASTRO/' + name.toUpperCase()
            } : null,
            fiatBalance: [245680, 18400, 92300, 1240, 0, 560700, 34100, 7800, 128900, 4300][i % 10] * (c.dp === 0 ? 40 : 1),
            usdValue: [1420.50, 320.10, 8940.00, 65.20, 0, 2180.75, 540.00, 12400.30, 88.40, 730.60][i % 10],
            joined: shortDate(joinedDaysAgo),
            joinedDaysAgo: joinedDaysAgo,
            lastSeen: relDay(i % 5),
            avatar: AVATARS[i % AVATARS.length]
        };
    });

    function userAt(i) { return USERS[i % USERS.length]; }

    /* ------------------------- Crypto deposits ------------------------- */

    var CRYPTO_DEPOSITS = [];
    for (var i = 0; i < 26; i++) {
        var u = userAt(i * 3 + 1);
        var sym = ASSET_KEYS[i % ASSET_KEYS.length];
        var a = global.KP.ASSETS[sym];
        var net = NETS[sym][i % NETS[sym].length];
        var amt = [100, 250, 0.0125, 500, 0.42, 1000, 75, 1.5, 3200, 0.0075][i % 10];
        if (sym === 'BTC') amt = [0.0125, 0.0075, 0.031][i % 3];
        if (sym === 'ETH') amt = [0.42, 1.15, 0.28][i % 3];
        if (sym === 'BNB') amt = [1.5, 0.8, 3.2][i % 3];
        if (sym === 'TRX') amt = [3200, 1500, 8000][i % 3];
        var st = statusFor(i, 6, 17);
        if (st === 'pending') st = (i % 12 === 0) ? 'pending' : 'confirming';
        CRYPTO_DEPOSITS.push({
            ref: 'DEP-C' + (48210 + i),
            user: u,
            asset: sym, network: net,
            amount: amt,
            usdValue: amt * a.usd,
            confirmations: st === 'confirming' ? (i % 9) + 1 : a.networks.find(function (n) { return n.id === net; }).conf,
            confirmsNeeded: a.networks.find(function (n) { return n.id === net; }).conf,
            txHash: txHash(i + 40),
            address: sym === 'BTC' ? hashAddr('bc1q', i, 42) : (net === 'TRC20' ? hashAddr('T', i, 34) : hashAddr('0x', i, 42)),
            status: st,
            manual: i % 19 === 0,
            date: dateBack(i % 9, (7 + i) % 24, (i * 7) % 60),
            daysAgo: i % 9
        });
    }

    /* -------------------------- Fiat deposits -------------------------- */

    var FIAT_DEPOSITS = [];
    for (i = 0; i < 20; i++) {
        var fu = userAt(i * 2);
        var fc = global.KP.COUNTRIES[fu.country];
        var famt = [50000, 120000, 25000, 300, 5400, 850000, 1200, 76000, 15000, 240000][i % 10] * (fc.dp === 0 ? 30 : 1);
        var fst = statusFor(i, 5, 13);
        FIAT_DEPOSITS.push({
            ref: 'DEP-F' + (31500 + i),
            user: fu,
            currency: fc.currency,
            amount: famt,
            rail: fc.fundingRail,
            source: fc.fundingRail === 'virtual_account' ? (fu.virtualAccount ? fu.virtualAccount.bank : 'Providus Bank') : fc.banks[0],
            sessionId: 'SESS' + (900000000 + i * 7919),
            status: fst,
            manual: i % 7 === 0,
            hasProof: i % 7 === 0,
            date: dateBack(i % 8, (9 + i) % 24, (i * 11) % 60),
            daysAgo: i % 8
        });
    }

    /* --------------------------- Conversions ---------------------------- */
    /* Every crypto deposit becomes one of these automatically. Nothing here is
       a trade the user chose to make — it is the rail doing its job. */

    var TRADES = [];
    for (i = 0; i < 34; i++) {
        var tu = userAt(i * 5 + 2);
        var tc = global.KP.COUNTRIES[tu.country];
        var kind = ['deposit_conversion', 'withdrawal_conversion'][i % 2];
        var s1 = ASSET_KEYS[i % ASSET_KEYS.length];
        var s2 = ASSET_KEYS[(i + 3) % ASSET_KEYS.length];
        if (s2 === s1) s2 = s1 === 'USDT' ? 'BTC' : 'USDT';
        var qty = s1 === 'BTC' ? [0.005, 0.012, 0.03][i % 3]
            : s1 === 'ETH' ? [0.2, 0.75, 1.4][i % 3]
                : s1 === 'BNB' ? [0.5, 1.2, 2.4][i % 3]
                    : s1 === 'TRX' ? [1500, 4000, 9000][i % 3]
                        : [50, 120, 300, 800][i % 4];
        var usdV = qty * global.KP.ASSETS[s1].usd;
        TRADES.push({
            ref: 'CNV-' + (77100 + i),
            user: tu,
            kind: kind,
            from: kind === 'deposit_conversion' ? s1 : tc.currency,
            to: kind === 'deposit_conversion' ? tc.currency : s1,
            qty: qty,
            usdValue: usdV,
            fiatValue: usdV * (global.KP.USD_RATE[tc.currency] || 1),
            currency: tc.currency,
            asset: s1,
            rate: global.KP.ASSETS[s1].usd * (global.KP.USD_RATE[tc.currency] || 1),
            marginEarnedUsd: usdV * 0.015,
            status: statusFor(i, 11, 23),
            date: dateBack(i % 10, (8 + i) % 24, (i * 13) % 60),
            daysAgo: i % 10
        });
    }

    /* --------------------------- Withdrawals --------------------------- */

    var FIAT_WITHDRAWALS = [];
    for (i = 0; i < 22; i++) {
        var wu = userAt(i * 4 + 3);
        var wc = global.KP.COUNTRIES[wu.country];
        var wamt = [50000, 200000, 12000, 450, 8900, 620000, 2400, 95000, 30000, 175000][i % 10] * (wc.dp === 0 ? 25 : 1);
        var wst = statusFor(i, 4, 15);
        if (wst === 'pending' && i % 8 === 0) wst = 'processing';
        FIAT_WITHDRAWALS.push({
            ref: 'WDR-F' + (52300 + i),
            user: wu,
            currency: wc.currency,
            amount: wamt,
            fee: wc.dp === 0 ? 500 : (wc.currency === 'NGN' ? 100 : 2),
            destination: wc.banks[i % wc.banks.length],
            accountNumber: wc.payoutRail === 'bank' ? String(212000000 + i * 4391) : wu.phone,
            accountName: wu.name.toUpperCase(),
            status: wst,
            manual: i % 9 === 0,
            date: dateBack(i % 7, (10 + i) % 24, (i * 17) % 60),
            daysAgo: i % 7
        });
    }

    var CRYPTO_WITHDRAWALS = [];
    for (i = 0; i < 18; i++) {
        var cu = userAt(i * 6 + 5);
        var csym = ASSET_KEYS[(i + 2) % ASSET_KEYS.length];
        var ca = global.KP.ASSETS[csym];
        var cnet = NETS[csym][i % NETS[csym].length];
        var camt = csym === 'BTC' ? [0.004, 0.011][i % 2]
            : csym === 'ETH' ? [0.15, 0.6][i % 2]
                : csym === 'BNB' ? [0.4, 1.1][i % 2]
                    : csym === 'TRX' ? [2000, 5500][i % 2]
                        : [40, 150, 400][i % 3];
        CRYPTO_WITHDRAWALS.push({
            ref: 'WDR-C' + (61100 + i),
            user: cu,
            asset: csym, network: cnet,
            amount: camt,
            fee: (ca.withdrawFee[cnet] != null ? ca.withdrawFee[cnet] : 0),
            usdValue: camt * ca.usd,
            address: csym === 'BTC' ? hashAddr('bc1q', i + 9, 42) : (cnet === 'TRC20' ? hashAddr('T', i + 9, 34) : hashAddr('0x', i + 9, 42)),
            txHash: i % 4 === 0 ? null : txHash(i + 90),
            status: statusFor(i, 4, 13),
            manual: i % 11 === 0,
            date: dateBack(i % 6, (11 + i) % 24, (i * 19) % 60),
            daysAgo: i % 6
        });
    }

    /* ------------------------------- KYC ------------------------------- */

    var KYC_QUEUE = USERS.filter(function (u) { return u.kyc === 'pending' || u.kyc === 'rejected'; })
        .map(function (u, i) {
            var c = global.KP.COUNTRIES[u.country];
            return {
                ref: 'KYC-' + (9100 + i),
                user: u,
                country: u.country,
                idType: c.idLabel,
                idNumber: String(10000000000 + i * 918273).slice(0, c.idFields[0].len || 11),
                docType: ['National ID', 'International Passport', "Driver's License", "Voter's Card"][i % 4],
                submitted: dateBack(i % 4, (9 + i) % 24, (i * 23) % 60),
                daysAgo: i % 4,
                targetTier: (i % 2) + 1,
                status: u.kyc === 'rejected' ? 'rejected' : 'pending',
                rejectReason: u.kyc === 'rejected' ? 'Document photo was blurred — please resubmit a clear image of the full document.' : null
            };
        });

    /* ------------------------------ Agents ------------------------------ */

    /* What an agent is allowed to touch. An admin picks these when creating the
       account, and the agent portal reads them at render time. */
    var AGENT_PERMISSIONS = [
        { key: 'kyc',         label: 'Review KYC',            desc: 'Approve or decline identity submissions' },
        { key: 'deposits',    label: 'Approve deposits',      desc: 'Release crypto and cash deposits' },
        { key: 'withdrawals', label: 'Approve withdrawals',   desc: 'Release payouts and crypto sends' },
        { key: 'manual',      label: 'Manual confirmation',   desc: 'Bypass the automated rail when a provider is down' },
        { key: 'block',       label: 'Block users',           desc: 'Suspend an account. Only an admin can unblock' },
        { key: 'support',     label: 'Answer support',        desc: 'Reply to tickets and close them' }
    ];

    var DEFAULT_PERMS = ['kyc', 'deposits', 'withdrawals', 'support'];

    var SEED_AGENTS = [
        { id: 'AG-01', name: 'James Bond', email: 'james@kaastropay.com', phone: '+234 803 111 2233',
          shift: 'morning', status: 'active', approvals: 412, manualActions: 18,
          perms: ['kyc', 'deposits', 'withdrawals', 'manual', 'block', 'support'],
          dailyCap: 10, avatar: 'avatar-johntrader.jpg', added: shortDate(240), addedBy: 'Admin User' },
        { id: 'AG-02', name: 'Amara Obi', email: 'amara@kaastropay.com', phone: '+234 806 445 8890',
          shift: 'night', status: 'active', approvals: 388, manualActions: 7,
          perms: ['kyc', 'deposits', 'withdrawals', 'manual', 'support'],
          dailyCap: 10, avatar: 'avatar-mercy24.jpg', added: shortDate(198), addedBy: 'Admin User' },
        { id: 'AG-03', name: 'Tunde Fashola', email: 'tunde@kaastropay.com', phone: '+234 701 220 6677',
          shift: 'morning', status: 'active', approvals: 256, manualActions: 31,
          perms: ['deposits', 'withdrawals', 'manual', 'support'],
          dailyCap: 15, avatar: 'avatar-tunde2000.jpg', added: shortDate(120), addedBy: 'Admin User' },
        { id: 'AG-04', name: 'Grace Adeyemi', email: 'grace@kaastropay.com', phone: '+233 24 556 1180',
          shift: 'night', status: 'suspended', approvals: 94, manualActions: 2,
          perms: ['kyc', 'support'],
          dailyCap: 5, avatar: 'avatar-blessingfx.jpg', added: shortDate(64), addedBy: 'Admin User' }
    ];

    /* Agents an admin creates are kept in localStorage so they survive a reload,
       and are merged over the seeded four. Edits to seeded agents are stored the
       same way rather than mutating the source list. */
    var AGENT_KEY = 'kaastro-agents';
    var AGENT_AVATARS = ['avatar-a1.jpg', 'avatar-b2.jpg', 'avatar-c3.jpg',
        'avatar-john.jpg', 'avatar-mercy24.jpg', 'avatar-tunde2000.jpg'];

    function agentStore() {
        try { return JSON.parse(localStorage.getItem(AGENT_KEY) || '{}') || {}; }
        catch (e) { return {}; }
    }
    function saveAgentStore(st) {
        try { localStorage.setItem(AGENT_KEY, JSON.stringify(st)); } catch (e) { }
    }

    /* The live list: seeds with any stored edits applied, then created agents. */
    function agents() {
        var st = agentStore();
        var out = SEED_AGENTS.map(function (a) {
            var patch = st.edits && st.edits[a.id];
            return patch ? Object.keys(patch).reduce(function (m, k) {
                m[k] = patch[k]; return m;
            }, JSON.parse(JSON.stringify(a))) : a;
        });
        (st.created || []).forEach(function (a) { out.push(a); });
        return out.filter(function (a) { return !(st.removed || []).length || (st.removed || []).indexOf(a.id) === -1; });
    }

    function nextAgentId() {
        var n = agents().reduce(function (m, a) {
            var v = parseInt(a.id.replace(/\D/g, ''), 10) || 0;
            return Math.max(m, v);
        }, 0);
        return 'AG-' + String(n + 1).padStart(2, '0');
    }

    function addAgent(spec) {
        var st = agentStore();
        st.created = st.created || [];
        var a = {
            id: nextAgentId(),
            name: spec.name,
            email: spec.email,
            phone: spec.phone || '',
            shift: spec.shift || 'morning',
            status: 'invited',
            approvals: 0,
            manualActions: 0,
            perms: spec.perms && spec.perms.length ? spec.perms : DEFAULT_PERMS.slice(),
            dailyCap: spec.dailyCap != null ? spec.dailyCap : 10,
            avatar: AGENT_AVATARS[st.created.length % AGENT_AVATARS.length],
            added: shortDate(0),
            addedBy: spec.addedBy || 'Admin User',
            createdAt: new Date().toISOString()
        };
        st.created.push(a);
        saveAgentStore(st);
        return a;
    }

    function updateAgent(id, patch) {
        var st = agentStore();
        var created = (st.created || []).filter(function (a) { return a.id === id; })[0];
        if (created) {
            Object.keys(patch).forEach(function (k) { created[k] = patch[k]; });
        } else {
            st.edits = st.edits || {};
            st.edits[id] = st.edits[id] || {};
            Object.keys(patch).forEach(function (k) { st.edits[id][k] = patch[k]; });
        }
        saveAgentStore(st);
    }

    function removeAgent(id) {
        var st = agentStore();
        st.created = (st.created || []).filter(function (a) { return a.id !== id; });
        st.removed = (st.removed || []);
        if (st.removed.indexOf(id) === -1) st.removed.push(id);
        saveAgentStore(st);
    }

    function resetAgents() {
        try { localStorage.removeItem(AGENT_KEY); } catch (e) { }
    }

    var AGENTS = agents();

    /* ------------------------------ Support ------------------------------ */

    var TICKETS = [
        { id: 'TK-4410', user: userAt(1), subject: 'Deposit not credited after 30 minutes', status: 'open', priority: 'high', last: 'Today · 10:42 AM', msgs: 3 },
        { id: 'TK-4409', user: userAt(4), subject: 'Wrong network — sent USDT via ERC20', status: 'open', priority: 'high', last: 'Today · 09:15 AM', msgs: 5 },
        { id: 'TK-4408', user: userAt(7), subject: 'KYC rejected, what do I do?', status: 'open', priority: 'normal', last: 'Today · 08:50 AM', msgs: 2 },
        { id: 'TK-4407', user: userAt(2), subject: 'Withdrawal pending since yesterday', status: 'pending', priority: 'normal', last: 'Yesterday · 06:20 PM', msgs: 4 },
        { id: 'TK-4406', user: userAt(9), subject: 'Cannot set my transaction PIN', status: 'resolved', priority: 'low', last: 'Yesterday · 02:05 PM', msgs: 6 },
        { id: 'TK-4405', user: userAt(5), subject: 'Rate difference on swap', status: 'resolved', priority: 'low', last: 'Aug 30 · 11:30 AM', msgs: 3 }
    ];

    /* ------------------------- Peer transfers -------------------------- */
    /* Kaastro user to Kaastro user. Instant, free, and never leaves the
       platform, so there is nothing to approve. */

    var TRANSFERS = [];
    for (i = 0; i < 18; i++) {
        var sender = userAt(i * 3);
        var recip = userAt(i * 3 + 4);
        var sc = global.KP.COUNTRIES[sender.country];
        var samt = [5000, 25000, 12000, 80000, 3500, 150000, 47000, 9000][i % 8]
            * (sc.dp === 0 ? 30 : 1);
        TRANSFERS.push({
            ref: 'TRF-' + (64200 + i),
            user: sender,
            recipient: recip,
            handle: '@' + recip.name.toLowerCase().split(' ')[0],
            currency: sc.currency,
            amount: samt,
            note: ['Rent', 'Thanks!', 'For the goods', '', 'Lunch', 'Split the bill', '', 'Salary'][i % 8],
            status: statusFor(i, 13, 29),
            date: dateBack(i % 7, (8 + i) % 24, (i * 9) % 60),
            daysAgo: i % 7
        });
    }

    /* ------------------------- Payment requests ------------------------- */

    var REQUESTS = [];
    for (i = 0; i < 12; i++) {
        var asker = userAt(i * 2 + 1);
        var payer = userAt(i * 5 + 3);
        var qc2 = global.KP.COUNTRIES[asker.country];
        REQUESTS.push({
            ref: 'REQ-' + (58100 + i),
            user: asker,
            from: payer,
            currency: qc2.currency,
            amount: [2000, 15000, 7500, 40000, 1200, 90000][i % 6] * (qc2.dp === 0 ? 30 : 1),
            reason: ['Invoice 0042', 'Shared taxi', 'Design work', 'Materials', 'Ticket', 'Deposit'][i % 6],
            status: ['pending', 'paid', 'pending', 'declined', 'paid', 'pending'][i % 6],
            date: dateBack(i % 6, (10 + i) % 24, (i * 11) % 60),
            daysAgo: i % 6
        });
    }

    /* --------------------------- Send abroad ---------------------------- */
    /* Naira in, another African currency out. The corridor decides the rate
       and the payout rail on the far side. */

    var CORRIDORS = [
        { to: 'GH', name: 'Ghana', flag: '\uD83C\uDDEC\uD83C\uDDED', ccy: 'GHS', rail: 'MTN MoMo · Telecel Cash · bank', eta: 'Minutes' },
        { to: 'KE', name: 'Kenya', flag: '\uD83C\uDDF0\uD83C\uDDEA', ccy: 'KES', rail: 'M-Pesa · Airtel Money · bank', eta: 'Minutes' },
        { to: 'TZ', name: 'Tanzania', flag: '\uD83C\uDDF9\uD83C\uDDFF', ccy: 'TZS', rail: 'M-Pesa · Tigo Pesa · bank', eta: 'Under an hour' },
        { to: 'UG', name: 'Uganda', flag: '\uD83C\uDDFA\uD83C\uDDEC', ccy: 'UGX', rail: 'MTN MoMo · Airtel Money', eta: 'Under an hour' },
        { to: 'RW', name: 'Rwanda', flag: '\uD83C\uDDF7\uD83C\uDDFC', ccy: 'RWF', rail: 'MTN MoMo · Bank of Kigali', eta: 'Under an hour' },
        { to: 'ZA', name: 'South Africa', flag: '\uD83C\uDDFF\uD83C\uDDE6', ccy: 'ZAR', rail: 'Bank transfer · Capitec, FNB, Standard', eta: '1\u20132 hours' }
    ];

    var REMITTANCES = [];
    for (i = 0; i < 16; i++) {
        var ru = userAt(i * 4 + 2);
        var corr = CORRIDORS[i % CORRIDORS.length];
        var rc = global.KP.COUNTRIES[ru.country] || global.KP.COUNTRIES.NG;
        var ramt = [50000, 120000, 25000, 300000, 75000, 18000][i % 6];
        REMITTANCES.push({
            ref: 'ABR-' + (71300 + i),
            user: ru,
            corridor: corr,
            fromCurrency: rc.currency,
            amount: ramt,
            fee: 500,
            recipient: ['Ama Mensah', 'Wanjiru Kamau', 'Juma Mwakalinga', 'Nakato Ssali',
                        'Uwase Claudine', 'Thabo Nkosi'][i % 6],
            destination: corr.rail.split(' \u00b7 ')[0],
            account: '+' + (233000000 + i * 7919),
            status: statusFor(i, 7, 19),
            date: dateBack(i % 8, (9 + i) % 24, (i * 13) % 60),
            daysAgo: i % 8
        });
    }

    /* --------------------------- Notifications --------------------------- */

    var NOTIFS = [
        { id: 'n1', icon: 'fa-arrow-down', tone: 'in', cat: 'transaction', read: false,
          title: 'Deposit confirmed', body: '250 USDT credited to your wallet after 12 confirmations.',
          time: '12 min ago', day: 'Today', ref: 'DEP-C48231' },
        { id: 'n2', icon: 'fa-shield-halved', tone: 'swap', cat: 'account', read: false,
          title: 'KYC approved', body: 'You are now Tier 2. Your daily limit is raised to $10,000.',
          time: '2 hours ago', day: 'Today', ref: null },
        { id: 'n3', icon: 'fa-bolt', tone: 'out', cat: 'transaction', read: false,
          title: 'Electricity bill paid', body: 'IKEDC Prepaid token sent to 04223344556.',
          time: '4 hours ago', day: 'Today', ref: 'BIL-20481' },
        { id: 'n4', icon: 'fa-arrow-up', tone: 'out', cat: 'transaction', read: true,
          title: 'Withdrawal settled', body: 'Payout of NGN 50,000 sent to GTBank ••••6789.',
          time: 'Yesterday, 6:20 PM', day: 'Yesterday', ref: 'WDR-F52310' },
        { id: 'n5', icon: 'fa-chart-line', tone: 'swap', cat: 'price', read: true,
          title: 'BTC moved 3% in an hour', body: 'You asked to be told when Bitcoin moves sharply.',
          time: 'Yesterday, 2:05 PM', day: 'Yesterday', ref: null },
        { id: 'n6', icon: 'fa-right-left', tone: 'swap', cat: 'transaction', read: true,
          title: 'Swap completed', body: '100 USDT swapped to 0.0042 BTC at the quoted rate.',
          time: 'Yesterday, 11:30 AM', day: 'Yesterday', ref: 'TRD-77098' },
        { id: 'n7', icon: 'fa-lock', tone: 'out', cat: 'security', read: true,
          title: 'New device signed in', body: 'Chrome on Windows, Lagos. If this was not you, change your password.',
          time: 'Aug 30', day: 'Earlier', ref: null },
        { id: 'n8', icon: 'fa-building-columns', tone: 'in', cat: 'transaction', read: true,
          title: 'Cash deposit received', body: 'NGN 500,000 credited from your Providus virtual account.',
          time: 'Aug 30', day: 'Earlier', ref: 'DEP-F31508' },
        { id: 'n9', icon: 'fa-circle-info', tone: 'swap', cat: 'account', read: true,
          title: 'Withdrawal fees updated', body: 'The flat cash withdrawal fee in Nigeria is now NGN 100.',
          time: 'Aug 28', day: 'Earlier', ref: null }
    ];

    /* Read state persists per browser so the badge behaves like the real thing. */
    var NOTIF_READ_KEY = 'kaastro-notifs-read';
    function readSet() {
        try { return new Set(JSON.parse(localStorage.getItem(NOTIF_READ_KEY) || '[]')); }
        catch (e) { return new Set(); }
    }
    function isRead(n) { return n.read || readSet().has(n.id); }
    function markRead(id) {
        var s = readSet();
        if (id) { s.add(id); } else { NOTIFS.forEach(function (n) { s.add(n.id); }); }
        try { localStorage.setItem(NOTIF_READ_KEY, JSON.stringify(Array.from(s))); } catch (e) { }
    }
    function unreadNotifications() {
        return NOTIFS.filter(function (n) { return !isRead(n); }).length;
    }

    /* ------------------------------ Billers ------------------------------ */
    /* Bills are paid from the local cash balance, so the catalogue is scoped
       to the user's country the same way every other amount is. */

    var BILLERS = {
        airtime: {
            id: 'airtime', name: 'Airtime', icon: 'fa-mobile-screen', tone: 'qa-green',
            blurb: 'Top up any number instantly',
            providers: {
                NG: ['MTN', 'Airtel', 'Glo', '9mobile'],
                GH: ['MTN Ghana', 'Telecel', 'AirtelTigo'],
                KE: ['Safaricom', 'Airtel Kenya', 'Telkom'],
                TZ: ['Vodacom', 'Airtel Tanzania', 'Tigo'],
                UG: ['MTN Uganda', 'Airtel Uganda']
            },
            presets: { NG: [100, 200, 500, 1000, 2000, 5000], GH: [5, 10, 20, 50, 100, 200],
                       KE: [50, 100, 250, 500, 1000, 2000], TZ: [1000, 2000, 5000, 10000, 20000, 50000],
                       UG: [1000, 2000, 5000, 10000, 20000, 50000] },
            field: 'Phone number', placeholder: '0803 123 4567', fee: 0
        },
        data: {
            id: 'data', name: 'Data', icon: 'fa-wifi', tone: 'qa-blue',
            blurb: 'Buy a data bundle',
            providers: {
                NG: ['MTN', 'Airtel', 'Glo', '9mobile'],
                GH: ['MTN Ghana', 'Telecel', 'AirtelTigo'],
                KE: ['Safaricom', 'Airtel Kenya'],
                TZ: ['Vodacom', 'Airtel Tanzania'],
                UG: ['MTN Uganda', 'Airtel Uganda']
            },
            bundles: {
                NG: [['500 MB · 1 day', 150], ['1 GB · 7 days', 500], ['2 GB · 30 days', 1200],
                     ['5 GB · 30 days', 2500], ['10 GB · 30 days', 4000], ['25 GB · 30 days', 9000]],
                GH: [['500 MB · 1 day', 3], ['1 GB · 7 days', 8], ['3 GB · 30 days', 25],
                     ['6 GB · 30 days', 45], ['12 GB · 30 days', 80], ['25 GB · 30 days', 150]],
                KE: [['500 MB · 1 day', 50], ['1 GB · 7 days', 110], ['3 GB · 30 days', 300],
                     ['8 GB · 30 days', 700], ['15 GB · 30 days', 1200], ['30 GB · 30 days', 2200]],
                TZ: [['500 MB · 1 day', 1000], ['1 GB · 7 days', 2500], ['3 GB · 30 days', 7000],
                     ['8 GB · 30 days', 15000], ['15 GB · 30 days', 27000], ['30 GB · 30 days', 48000]],
                UG: [['500 MB · 1 day', 1500], ['1 GB · 7 days', 3500], ['3 GB · 30 days', 9000],
                     ['8 GB · 30 days', 20000], ['15 GB · 30 days', 35000], ['30 GB · 30 days', 60000]]
            },
            field: 'Phone number', placeholder: '0803 123 4567', fee: 0
        },
        electricity: {
            id: 'electricity', name: 'Electricity', icon: 'fa-bolt', tone: 'qa-amber',
            blurb: 'Prepaid token or postpaid bill',
            providers: {
                NG: ['IKEDC — Ikeja', 'EKEDC — Eko', 'AEDC — Abuja', 'PHED — Port Harcourt', 'KEDCO — Kano'],
                GH: ['ECG — Electricity Company of Ghana', 'NEDCo'],
                KE: ['Kenya Power — Prepaid', 'Kenya Power — Postpaid'],
                TZ: ['TANESCO — LUKU'],
                UG: ['UMEME — Yaka']
            },
            presets: { NG: [1000, 2000, 5000, 10000, 20000, 50000], GH: [20, 50, 100, 200, 400, 800],
                       KE: [200, 500, 1000, 2000, 5000, 10000], TZ: [5000, 10000, 20000, 50000, 100000, 200000],
                       UG: [5000, 10000, 20000, 50000, 100000, 200000] },
            field: 'Meter number', placeholder: '04223344556', fee: 0,
            meterTypes: ['Prepaid', 'Postpaid']
        },
        betting: {
            id: 'betting', name: 'Betting', icon: 'fa-futbol', tone: 'qa-purple',
            blurb: 'Fund your betting wallet',
            providers: {
                NG: ['Bet9ja', 'SportyBet', 'BetKing', '1xBet', 'NairaBet', 'MerryBet'],
                GH: ['SportyBet Ghana', 'Betway Ghana', 'Soccabet'],
                KE: ['SportPesa', 'Betika', 'Odibets'],
                TZ: ['Betway Tanzania', 'Premier Bet'],
                UG: ['SportPesa Uganda', 'Betway Uganda']
            },
            presets: { NG: [500, 1000, 2000, 5000, 10000, 20000], GH: [10, 20, 50, 100, 200, 500],
                       KE: [100, 250, 500, 1000, 2000, 5000], TZ: [2000, 5000, 10000, 20000, 50000, 100000],
                       UG: [2000, 5000, 10000, 20000, 50000, 100000] },
            field: 'Betting ID', placeholder: 'Your user ID with the operator', fee: 0
        }
    };

    var BILL_HISTORY = [
        { ref: 'BIL-20481', service: 'Electricity', provider: 'IKEDC — Ikeja', account: '04223344556',
          amount: 15000, currency: 'NGN', token: '4821 7739 0146 5528 9903', status: 'successful',
          date: dateBack(0, 14, 12), daysAgo: 0 },
        { ref: 'BIL-20478', service: 'Airtime', provider: 'MTN', account: '0803 123 4567',
          amount: 2000, currency: 'NGN', token: null, status: 'successful',
          date: dateBack(1, 9, 40), daysAgo: 1 },
        { ref: 'BIL-20470', service: 'Data', provider: 'MTN', account: '0803 123 4567',
          amount: 2500, currency: 'NGN', token: null, status: 'successful',
          date: dateBack(3, 18, 5), daysAgo: 3 },
        { ref: 'BIL-20455', service: 'Electricity', provider: 'EKEDC — Eko', account: '04559911223',
          amount: 10000, currency: 'NGN', token: '1120 4478 9930 5561 2204', status: 'successful',
          date: dateBack(6, 11, 22), daysAgo: 6 },
        { ref: 'BIL-20441', service: 'Airtime', provider: 'Airtel', account: '0902 887 6655',
          amount: 500, currency: 'NGN', token: null, status: 'failed',
          date: dateBack(9, 16, 48), daysAgo: 9 }
    ];

    /* ------------------------- Aggregate figures ------------------------- */

    function stats() {
        var volUsd = 0, profitUsd = 0, cnt = 0, ok = 0;
        CRYPTO_DEPOSITS.forEach(function (d) { volUsd += d.usdValue; cnt++; if (d.status === 'successful') ok++; });
        FIAT_DEPOSITS.forEach(function (d) { cnt++; if (d.status === 'successful') ok++; });
        TRADES.forEach(function (t) { volUsd += t.usdValue; profitUsd += t.marginEarnedUsd; cnt++; if (t.status === 'successful') ok++; });
        CRYPTO_WITHDRAWALS.forEach(function (w) { volUsd += w.usdValue; cnt++; if (w.status === 'successful') ok++; });
        FIAT_WITHDRAWALS.forEach(function (w) { cnt++; if (w.status === 'successful') ok++; });
        return {
            volumeUsd: volUsd * 46,          // scaled so the demo reads like a live platform
            profitUsd: profitUsd * 46,
            txCount: cnt * 46,
            successRate: (ok / cnt) * 100,
            activeUsers: USERS.filter(function (u) { return u.status === 'active'; }).length * 87,
            newToday: USERS.filter(function (u) { return u.joinedDaysAgo === 0; }).length * 9,
            liquidityUsd: 1284000
        };
    }

    function pendingCounts() {
        return {
            kyc: KYC_QUEUE.filter(function (k) { return k.status === 'pending'; }).length,
            cryptoDeposits: CRYPTO_DEPOSITS.filter(function (d) { return d.status === 'pending' || d.status === 'confirming'; }).length,
            fiatDeposits: FIAT_DEPOSITS.filter(function (d) { return d.status === 'pending'; }).length,
            fiatWithdrawals: FIAT_WITHDRAWALS.filter(function (w) { return w.status === 'pending' || w.status === 'processing'; }).length,
            cryptoWithdrawals: CRYPTO_WITHDRAWALS.filter(function (w) { return w.status === 'pending'; }).length,
            tickets: TICKETS.filter(function (t) { return t.status === 'open'; }).length
        };
    }

    /* Volume over the last 7 days, for the admin chart. */
    function weekSeries() {
        var labels = [], vals = [];
        for (var d = 6; d >= 0; d--) {
            var dt = new Date(REF.getTime()); dt.setDate(dt.getDate() - d);
            labels.push(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dt.getDay()]);
            var v = 0;
            CRYPTO_DEPOSITS.forEach(function (x) { if (x.daysAgo === d) v += x.usdValue; });
            TRADES.forEach(function (x) { if (x.daysAgo === d) v += x.usdValue; });
            CRYPTO_WITHDRAWALS.forEach(function (x) { if (x.daysAgo === d) v += x.usdValue; });
            vals.push(Math.round(v * 46));
        }
        return { labels: labels, values: vals };
    }

    /* No wallets. The platform does not hold crypto — a deposit converts to
       Naira on confirmation, and a withdrawal sells Naira for coin at send
       time. The only balance a user has is cash. */

    var ME = {
        id: 'KP-10240',
        name: 'Chukwudi Okeke',
        firstName: 'Chukwudi',
        email: 'chukwudi.okeke@gmail.com',
        phone: '+234 803 123 4567',
        tier: 2,
        kyc: 'verified',
        avatar: 'avatar-john.jpg',
        fiatBalance: 245680.00,
        virtualAccount: { bank: 'Providus Bank', number: '9020147385', name: 'KAASTRO/CHUKWUDI OKEKE' },
        bankAccounts: [
            { bank: 'GTBank', number: '0123456789', name: 'CHUKWUDI OKEKE', primary: true },
            { bank: 'Kuda Microfinance Bank', number: '2019384756', name: 'CHUKWUDI OKEKE', primary: false }
        ],
        savedAddresses: [
            { label: 'Binance USDT', asset: 'USDT', network: 'TRC20', address: 'TJmV8kL2pQxR9nWc4bF7aG1hYzNvB6dEuS' },
            { label: 'Ledger BTC', asset: 'BTC', network: 'BTC', address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh' }
        ]
    };

    /* ========================== Contacts ==========================
       This is NOT the phone book. A contact gets here one of two ways, and
       `source` records which: 'paid' means it was created the first time money
       moved to them, 'manual' means the user added it deliberately. Nothing is
       ever imported from the device.

       Two kinds of person, and neither is a bank account. A Kaastro contact is
       another user, addressed by @handle and paid instantly. A recipient is
       someone abroad, reached over a delivery rail — mobile money or a local
       bank in their own country — which is why they carry a country, a
       currency and a provider rather than an account number on our side. */
    var CONTACTS = [
        { id: 'CT-01', kind: 'kaastro', source: 'paid',   name: 'Ada Okafor',    handle: '@adaokafor', phone: '0803 111 2233', avatar: 'avatar-a1.jpg',        verified: true, favourite: true,  lastAmount: 25000,  lastAgo: 0, times: 12 },
        { id: 'CT-02', kind: 'kaastro', source: 'paid',   name: 'Emeka John',    handle: '@emekaj',    phone: '0805 444 1122', avatar: 'avatar-b2.jpg',        verified: true, favourite: true,  lastAmount: 12000,  lastAgo: 1, times: 8 },
        { id: 'CT-03', kind: 'kaastro', source: 'paid',   name: 'Chidi Nwosu',   handle: '@chidin',    phone: '0812 909 7766', avatar: 'avatar-c3.jpg',        verified: true, favourite: true,  lastAmount: 8500,   lastAgo: 2, times: 5 },
        { id: 'CT-04', kind: 'kaastro', source: 'manual', name: 'Sarah Bello',   handle: '@sarahb',    phone: '0701 335 8890', avatar: 'avatar-mercy24.jpg',   verified: true, favourite: true,  lastAmount: 40000,  lastAgo: 3, times: 3 },
        { id: 'CT-05', kind: 'kaastro', source: 'paid',   name: 'Amina Yusuf',   handle: '@aminay',    phone: '0809 220 6644', avatar: 'avatar-blessingfx.jpg', verified: true, favourite: false, lastAmount: 50000, lastAgo: 1, times: 7 },
        { id: 'CT-06', kind: 'kaastro', source: 'manual', name: 'Tunde Adebayo', handle: '@tundeadebayo', phone: '0706 771 4432', avatar: 'avatar-tunde2000.jpg', verified: true, favourite: false, lastAmount: 15000, lastAgo: 6, times: 2 },

        { id: 'CT-07', kind: 'recipient', source: 'paid',   name: 'John Kimani',  country: 'KE', ccy: 'KES', dial: '+254', phone: '712 345 678', method: 'Mobile Money', provider: 'M-Pesa',    relation: 'Friend',  purpose: 'Family support', verified: true, favourite: true,  lastAmount: 100000, lastAgo: 2, times: 9 },
        { id: 'CT-08', kind: 'recipient', source: 'manual', name: 'Kwame Mensah', country: 'GH', ccy: 'GHS', dial: '+233', phone: '24 556 1180', method: 'Mobile Money', provider: 'MTN MoMo',  relation: 'Family', purpose: 'Family support', verified: true, favourite: false, lastAmount: 25000, lastAgo: 4, times: 4 },
        { id: 'CT-09', kind: 'recipient', source: 'paid',   name: 'Grace Wanjiru', country: 'KE', ccy: 'KES', dial: '+254', phone: '733 210 445', method: 'Bank transfer', provider: 'KCB Bank', relation: 'Family', purpose: 'Education',      verified: true, favourite: false, lastAmount: 75000, lastAgo: 5, times: 6 },
        { id: 'CT-10', kind: 'recipient', source: 'manual', name: 'Joseph Okello', country: 'UG', ccy: 'UGX', dial: '+256', phone: '77 118 9042', method: 'Mobile Money', provider: 'Airtel Money', relation: 'Friend', purpose: 'Business',   verified: true, favourite: false, lastAmount: 9000,  lastAgo: 7, times: 1 }
    ];

    /* The rails a cross-border recipient can be reached on, per country. */
    var DELIVERY = {
        KE: { methods: ['Mobile Money', 'Bank transfer'], providers: { 'Mobile Money': ['M-Pesa', 'Airtel Money'], 'Bank transfer': ['KCB Bank', 'Equity Bank', 'Co-operative Bank'] } },
        GH: { methods: ['Mobile Money', 'Bank transfer'], providers: { 'Mobile Money': ['MTN MoMo', 'Vodafone Cash', 'AirtelTigo'], 'Bank transfer': ['GCB Bank', 'Absa Ghana', 'Fidelity Bank'] } },
        TZ: { methods: ['Mobile Money', 'Bank transfer'], providers: { 'Mobile Money': ['M-Pesa', 'Tigo Pesa', 'Airtel Money'], 'Bank transfer': ['CRDB Bank', 'NMB Bank'] } },
        UG: { methods: ['Mobile Money', 'Bank transfer'], providers: { 'Mobile Money': ['MTN MoMo', 'Airtel Money'], 'Bank transfer': ['Stanbic Bank', 'Centenary Bank'] } },
        NG: { methods: ['Bank transfer'], providers: { 'Bank transfer': ['GTBank', 'Access Bank', 'Zenith Bank', 'Kuda', 'Opay'] } }
    };

    var RELATIONSHIPS = ['Friend', 'Family', 'Business partner', 'Employee', 'Supplier', 'Myself', 'Other'];
    var PURPOSES = ['Family support', 'Education', 'Business', 'Rent', 'Medical', 'Salary', 'Gift', 'Other'];

    function contacts(kind) {
        if (!kind || kind === 'all') return CONTACTS.slice();
        return CONTACTS.filter(function (c) { return c.kind === kind; });
    }
    function favourites() {
        return CONTACTS.filter(function (c) { return c.favourite; });
    }
    /* Most recently paid first — the order the "Recent Recipients" list uses. */
    function recentContacts(n) {
        return CONTACTS.slice().sort(function (a, b) { return a.lastAgo - b.lastAgo; }).slice(0, n || 4);
    }
    function findContact(id) {
        return CONTACTS.filter(function (c) { return c.id === id; })[0] || null;
    }
    /* Manual add. A Kaastro handle resolves to a verified user, so it is
       trusted on save; a cross-border recipient is only confirmed when the
       delivery partner checks the name, which happens at send time. */
    function addContact(rec) {
        var c = {
            id: 'CT-' + String(CONTACTS.length + 1).padStart(2, '0'),
            kind: rec.kind || 'kaastro',
            source: 'manual',
            name: rec.name,
            verified: rec.kind === 'kaastro',
            favourite: !!rec.favourite,
            lastAmount: 0,
            lastAgo: -1,
            times: 0
        };
        if (c.kind === 'kaastro') {
            c.handle = rec.handle && rec.handle[0] === '@' ? rec.handle : '@' + (rec.handle || '');
            c.phone = rec.phone || '';
        } else {
            c.country = rec.country || 'KE';
            c.ccy = (global.KP.COUNTRIES[c.country] || {}).currency || '';
            c.dial = (global.KP.COUNTRIES[c.country] || {}).dial || '';
            c.phone = rec.phone || '';
            c.method = rec.method || 'Mobile Money';
            c.provider = rec.provider || '';
            c.relation = rec.relation || '';
            c.purpose = rec.purpose || '';
        }
        CONTACTS.push(c);
        return c;
    }
    function removeContact(id) {
        var i = CONTACTS.map(function (c) { return c.id; }).indexOf(id);
        if (i > -1) CONTACTS.splice(i, 1);
        return i > -1;
    }
    function toggleFavourite(id) {
        var c = findContact(id);
        if (c) c.favourite = !c.favourite;
        return c;
    }


    /* ========================= Payment links =========================
       A link is created by one user and paid by anyone, so it is platform
       data rather than something hanging off ME: the user's own page filters
       by owner, the back office sees the lot.

       Four states, and they are not all the same kind of thing. `active` and
       `paid` are the happy path. `expired` ran out of time with nothing
       received. `cancelled` was called off by whoever created it — which is
       worth separating from expired, because one is the platform's clock and
       the other is a decision someone made. */
    var LINK_TITLES = [
        'Website design', 'Invoice #104', 'Consulting retainer', 'Logo package',
        'Order #882', 'Monthly retainer', 'Photography session', 'Brand audit',
        'App maintenance', 'Copywriting', 'Order #915', 'Invoice #118',
        'Video edit', 'Social media pack', 'Site migration', 'Invoice #121'
    ];

    var PAYMENT_LINKS = [];
    for (i = 0; i < 26; i++) {
        var lu = userAt(i * 2 + 3);
        var lsym = ['USDT', 'USDT', 'USDC', 'BTC', 'USDT', 'ETH'][i % 6];
        var lamt = [150000, 75000, 250000, 40000, 500000, 120000, 90000, 300000][i % 8];
        /* Weighted so the queue looks like a real one: mostly paid or waiting,
           a handful expired, a couple called off. */
        var lst = i % 11 === 0 ? 'cancelled'
                : i % 7 === 0 ? 'expired'
                : i % 3 === 0 ? 'active'
                : 'paid';
        var lnet = lsym === 'BTC' ? 'BTC' : lsym === 'ETH' ? 'ERC20' : ['TRC20', 'BEP20', 'ERC20'][i % 3];
        PAYMENT_LINKS.push({
            ref: 'KPR-' + (204100 + i * 7),
            user: lu,
            title: LINK_TITLES[i % LINK_TITLES.length],
            amount: lamt,
            currency: (global.KP.COUNTRIES[lu.country] || {}).currency || 'NGN',
            asset: lsym,
            network: lnet,
            status: lst,
            /* Only a paid link has anything received against it. */
            paidAmount: lst === 'paid' ? lamt : 0,
            payments: lst === 'paid' ? (i % 3) + 1 : 0,
            views: 3 + (i * 5) % 40,
            expiry: ['1 hour', '24 hours', '3 days', 'No expiry'][i % 4],
            usdValue: lamt / (global.KP.USD_RATE[(global.KP.COUNTRIES[lu.country] || {}).currency || 'NGN'] || 1),
            date: dateBack(i % 12, (8 + i) % 24, (i * 11) % 60),
            daysAgo: i % 12
        });
    }

    /* The user's own links. Everything on their page reads through this. */
    function myPaymentLinks(status) {
        var mine = PAYMENT_LINKS.filter(function (l) { return l.user.id === ME.id; });
        /* The seeded set is spread across users, so make sure the signed-in
           one always has a representative handful to look at. */
        if (mine.length < 6) {
            /* The seeded set is spread across countries. Re-homing a link onto
               the signed-in user has to re-home its currency too, or the list
               shows cedis while the totals underneath are in naira. */
            var myCcy = global.KP.currentCountry().currency;
            mine = PAYMENT_LINKS.slice(0, 9).map(function (l) {
                var c = {}; for (var k in l) c[k] = l[k];
                c.user = ME;
                c.currency = myCcy;
                return c;
            });
        }
        return (!status || status === 'all') ? mine
            : mine.filter(function (l) { return l.status === status; });
    }

    /* Counts and value per state, for the stat cards on every one of the
       three portals. */
    function linkStats(rows) {
        rows = rows || PAYMENT_LINKS;
        var s = { total: rows.length, active: 0, paid: 0, expired: 0, cancelled: 0, collected: 0, pending: 0 };
        rows.forEach(function (l) {
            s[l.status] = (s[l.status] || 0) + 1;
            if (l.status === 'paid') s.collected += l.paidAmount;
            if (l.status === 'active') s.pending += l.amount;
        });
        return s;
    }

    function findLink(ref) {
        return PAYMENT_LINKS.filter(function (l) { return l.ref === ref; })[0] || null;
    }

    function cancelLink(ref) {
        var l = findLink(ref);
        if (l && l.status === 'active') { l.status = 'cancelled'; return true; }
        return false;
    }
    /* My own transaction feed, drawn from the platform sets. */
    function myTransactions() {
        var out = [];
        out.push({ ref: 'DEP-C48231', type: 'deposit', kind: 'crypto', label: 'Deposit · USDT', sub: 'TRC20 · 12/12 confirmations', asset: 'USDT', amount: 250, fiat: null, dir: 'in', status: 'successful', date: dateBack(0, 10, 42), daysAgo: 0 });
        out.push({ ref: 'TRD-77104', type: 'sell', kind: 'trade', label: 'Sold USDT', sub: 'to NGN @ ₦1,477.50', asset: 'USDT', amount: 100, fiat: 147750, dir: 'in', status: 'successful', date: dateBack(0, 9, 15), daysAgo: 0 });
        out.push({ ref: 'WDR-F52310', type: 'withdrawal', kind: 'fiat', label: 'Withdrawal to GTBank', sub: '••••6789 · fee ₦100', asset: null, amount: null, fiat: 50000, dir: 'out', status: 'processing', date: dateBack(0, 8, 5), daysAgo: 0 });
        out.push({ ref: 'TRD-77098', type: 'swap', kind: 'trade', label: 'Swapped USDT → BTC', sub: 'Rate 1 BTC = 67,420 USDT', asset: 'BTC', amount: 0.0042, fiat: null, dir: 'in', status: 'successful', date: dateBack(1, 18, 30), daysAgo: 1 });
        out.push({ ref: 'TRD-77091', type: 'buy', kind: 'trade', label: 'Bought ETH', sub: 'with NGN @ ₦4,847,000', asset: 'ETH', amount: 0.15, fiat: 727050, dir: 'in', status: 'successful', date: dateBack(1, 14, 12), daysAgo: 1 });
        out.push({ ref: 'DEP-F31508', type: 'deposit', kind: 'fiat', label: 'Deposit · Providus Bank', sub: 'Virtual account ••••7385', asset: null, amount: null, fiat: 500000, dir: 'in', status: 'successful', date: dateBack(1, 11, 3), daysAgo: 1 });
        out.push({ ref: 'WDR-C61104', type: 'withdrawal', kind: 'crypto', label: 'Sent USDT', sub: 'TRC20 · TJmV8k…dEuS', asset: 'USDT', amount: 150, fiat: null, dir: 'out', status: 'successful', date: dateBack(2, 16, 45), daysAgo: 2 });
        out.push({ ref: 'TRD-77082', type: 'sell', kind: 'trade', label: 'Sold BTC', sub: 'to NGN @ ₦99,595,000', asset: 'BTC', amount: 0.008, fiat: 796760, dir: 'in', status: 'successful', date: dateBack(3, 12, 20), daysAgo: 3 });
        out.push({ ref: 'DEP-C48198', type: 'deposit', kind: 'crypto', label: 'Deposit · BTC', sub: 'Bitcoin network · 2/2', asset: 'BTC', amount: 0.0125, fiat: null, dir: 'in', status: 'successful', date: dateBack(4, 9, 8), daysAgo: 4 });
        out.push({ ref: 'TRD-77070', type: 'buy', kind: 'trade', label: 'Bought USDT', sub: 'with NGN @ ₦1,522.50', asset: 'USDT', amount: 400, fiat: 609000, dir: 'in', status: 'successful', date: dateBack(5, 15, 55), daysAgo: 5 });
        out.push({ ref: 'WDR-F52288', type: 'withdrawal', kind: 'fiat', label: 'Withdrawal to Kuda', sub: '••••4756 · fee ₦100', asset: null, amount: null, fiat: 120000, dir: 'out', status: 'successful', date: dateBack(6, 10, 30), daysAgo: 6 });
        out.push({ ref: 'DEP-C48170', type: 'deposit', kind: 'crypto', label: 'Deposit · ETH', sub: 'ERC20 · failed — below minimum', asset: 'ETH', amount: 0.001, fiat: null, dir: 'in', status: 'failed', date: dateBack(8, 13, 14), daysAgo: 8 });
        out.push({ ref: 'BIL-20481', type: 'bill', kind: 'bill', label: 'Electricity · IKEDC', sub: 'Prepaid · meter 04223344556', asset: null, amount: null, fiat: 15000, dir: 'out', status: 'successful', date: dateBack(0, 14, 12), daysAgo: 0 });
        out.push({ ref: 'BIL-20478', type: 'bill', kind: 'bill', label: 'Airtime · MTN', sub: '0803 123 4567', asset: null, amount: null, fiat: 2000, dir: 'out', status: 'successful', date: dateBack(1, 9, 40), daysAgo: 1 });
        out.push({ ref: 'BIL-20470', type: 'bill', kind: 'bill', label: 'Data · MTN 5GB', sub: '0803 123 4567 · 30 days', asset: null, amount: null, fiat: 2500, dir: 'out', status: 'successful', date: dateBack(3, 18, 5), daysAgo: 3 });
        out.sort(function (a, b) { return a.daysAgo - b.daysAgo; });
        return out;
    }

    global.KP = global.KP || {};
    global.KP.data = {
        REF: REF,
        USERS: USERS,
        ME: ME,
        CONTACTS: CONTACTS,
        contacts: contacts,
        favourites: favourites,
        recentContacts: recentContacts,
        findContact: findContact,
        PAYMENT_LINKS: PAYMENT_LINKS,
        myPaymentLinks: myPaymentLinks,
        linkStats: linkStats,
        findLink: findLink,
        cancelLink: cancelLink,
        addContact: addContact,
        removeContact: removeContact,
        toggleFavourite: toggleFavourite,
        DELIVERY: DELIVERY,
        RELATIONSHIPS: RELATIONSHIPS,
        PURPOSES: PURPOSES,
        CRYPTO_DEPOSITS: CRYPTO_DEPOSITS,
        FIAT_DEPOSITS: FIAT_DEPOSITS,
        TRADES: TRADES,
        TRANSFERS: TRANSFERS,
        REQUESTS: REQUESTS,
        REMITTANCES: REMITTANCES,
        CORRIDORS: CORRIDORS,
        FIAT_WITHDRAWALS: FIAT_WITHDRAWALS,
        CRYPTO_WITHDRAWALS: CRYPTO_WITHDRAWALS,
        KYC_QUEUE: KYC_QUEUE,
        AGENTS: AGENTS,
        AGENT_PERMISSIONS: AGENT_PERMISSIONS,
        agents: agents,
        addAgent: addAgent,
        updateAgent: updateAgent,
        removeAgent: removeAgent,
        resetAgents: resetAgents,
        nextAgentId: nextAgentId,
        TICKETS: TICKETS,
        NOTIFS: NOTIFS,
        isNotifRead: isRead,
        markNotifRead: markRead,
        unreadNotifications: unreadNotifications,
        BILLERS: BILLERS,
        BILL_HISTORY: BILL_HISTORY,
        myTransactions: myTransactions,
        stats: stats,
        pendingCounts: pendingCounts,
        weekSeries: weekSeries,
        dateBack: dateBack,
        shortDate: shortDate,
        shortStamp: shortStamp,
        relDay: relDay,
        hashAddr: hashAddr
    };

})(window);
