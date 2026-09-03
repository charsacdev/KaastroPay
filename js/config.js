/* ==========================================================================
   Kaastro Pay — country map, asset catalogue, formatting
   Every page reads currency, KYC method and funding rail from here.
   Nothing in the UI should ever hardcode a currency symbol.
   ========================================================================== */
(function (global) {
    'use strict';

    /* ---------------------------- Countries ---------------------------- */

    var COUNTRIES = {
        NG: {
            code: 'NG', name: 'Nigeria', flag: '🇳🇬',
            currency: 'NGN', symbol: '₦', dp: 2,
            idLabel: 'NIN or BVN',
            idFields: [
                { key: 'nin', label: 'National Identity Number (NIN)', len: 11, hint: '11 digits' },
                { key: 'bvn', label: 'Bank Verification Number (BVN)', len: 11, hint: '11 digits' }
            ],
            fundingRail: 'virtual_account',
            fundingLabel: 'Dedicated virtual account',
            payoutRail: 'bank',
            banks: ['Access Bank', 'GTBank', 'Zenith Bank', 'UBA', 'First Bank', 'Kuda Microfinance Bank', 'Opay', 'Moniepoint', 'Wema Bank'],
            enabled: true
        },
        GH: {
            code: 'GH', name: 'Ghana', flag: '🇬🇭',
            currency: 'GHS', symbol: 'GH₵', dp: 2,
            idLabel: 'Ghana Card',
            idFields: [{ key: 'ghana_card', label: 'Ghana Card Number', len: 15, hint: 'GHA-XXXXXXXXX-X' }],
            fundingRail: 'mobile_money',
            fundingLabel: 'Mobile money',
            payoutRail: 'mobile_money',
            banks: ['MTN MoMo', 'Telecel Cash', 'AirtelTigo Money', 'GCB Bank', 'Absa Ghana'],
            enabled: true
        },
        KE: {
            code: 'KE', name: 'Kenya', flag: '🇰🇪',
            currency: 'KES', symbol: 'KSh', dp: 2,
            idLabel: 'National ID',
            idFields: [{ key: 'national_id', label: 'National ID Number', len: 8, hint: '8 digits' }],
            fundingRail: 'mobile_money',
            fundingLabel: 'Mobile money',
            payoutRail: 'mobile_money',
            banks: ['M-Pesa', 'Airtel Money', 'Equity Bank', 'KCB Bank', 'Co-operative Bank'],
            enabled: true
        },
        TZ: {
            code: 'TZ', name: 'Tanzania', flag: '🇹🇿',
            currency: 'TZS', symbol: 'TSh', dp: 0,
            idLabel: 'NIDA Number',
            idFields: [{ key: 'nida', label: 'NIDA Number', len: 20, hint: '20 digits' }],
            fundingRail: 'mobile_money',
            fundingLabel: 'Mobile money',
            payoutRail: 'mobile_money',
            banks: ['M-Pesa Tanzania', 'Tigo Pesa', 'Airtel Money', 'CRDB Bank', 'NMB Bank'],
            enabled: true
        },
        UG: {
            code: 'UG', name: 'Uganda', flag: '🇺🇬',
            currency: 'UGX', symbol: 'USh', dp: 0,
            idLabel: 'National ID (NIN)',
            idFields: [{ key: 'nin_ug', label: 'National ID Number', len: 14, hint: '14 characters' }],
            fundingRail: 'mobile_money',
            fundingLabel: 'Mobile money',
            payoutRail: 'mobile_money',
            banks: ['MTN MoMo Uganda', 'Airtel Money', 'Stanbic Bank', 'Centenary Bank'],
            enabled: true
        }
    };

    var COUNTRY_LIST = Object.keys(COUNTRIES).map(function (k) { return COUNTRIES[k]; });

    /* ------------------------------ Assets ------------------------------ */

    var ASSETS = {
        USDT: {
            symbol: 'USDT', name: 'Tether USD', color: '#26A17B', dp: 6, displayDp: 2,
            usd: 1.00, minDeposit: 10, minWithdraw: 20, withdrawFee: { TRC20: 1, BEP20: 0.5, ERC20: 6 },
            networks: [
                { id: 'TRC20', name: 'Tron (TRC20)', conf: 12, note: 'Lowest fee · fastest' },
                { id: 'BEP20', name: 'BNB Smart Chain (BEP20)', conf: 15, note: 'Low fee' },
                { id: 'ERC20', name: 'Ethereum (ERC20)', conf: 32, note: 'Highest network fee' }
            ]
        },
        USDC: {
            symbol: 'USDC', name: 'USD Coin', color: '#2775CA', dp: 6, displayDp: 2,
            usd: 1.00, minDeposit: 10, minWithdraw: 20, withdrawFee: { TRC20: 1, BEP20: 0.5, ERC20: 6 },
            networks: [
                { id: 'TRC20', name: 'Tron (TRC20)', conf: 12, note: 'Lowest fee · fastest' },
                { id: 'BEP20', name: 'BNB Smart Chain (BEP20)', conf: 15, note: 'Low fee' },
                { id: 'ERC20', name: 'Ethereum (ERC20)', conf: 32, note: 'Highest network fee' }
            ]
        },
        BTC: {
            symbol: 'BTC', name: 'Bitcoin', color: '#F7931A', dp: 8, displayDp: 6,
            usd: 67420.00, minDeposit: 0.0002, minWithdraw: 0.0005, withdrawFee: { BTC: 0.00015 },
            networks: [{ id: 'BTC', name: 'Bitcoin Network', conf: 2, note: 'Native chain' }]
        },
        ETH: {
            symbol: 'ETH', name: 'Ethereum', color: '#627EEA', dp: 8, displayDp: 5,
            usd: 3184.50, minDeposit: 0.005, minWithdraw: 0.01, withdrawFee: { ERC20: 0.0018 },
            networks: [{ id: 'ERC20', name: 'Ethereum (ERC20)', conf: 32, note: 'Native chain' }]
        },
        BNB: {
            symbol: 'BNB', name: 'BNB', color: '#F3BA2F', dp: 8, displayDp: 4,
            usd: 601.20, minDeposit: 0.01, minWithdraw: 0.02, withdrawFee: { BEP20: 0.0005 },
            networks: [{ id: 'BEP20', name: 'BNB Smart Chain (BEP20)', conf: 15, note: 'Native chain' }]
        },
        TRX: {
            symbol: 'TRX', name: 'Tron', color: '#EB0029', dp: 6, displayDp: 2,
            usd: 0.1642, minDeposit: 20, minWithdraw: 50, withdrawFee: { TRC20: 1 },
            networks: [{ id: 'TRC20', name: 'Tron (TRC20)', conf: 12, note: 'Native chain' }]
        }
    };

    var ASSET_LIST = Object.keys(ASSETS).map(function (k) { return ASSETS[k]; });

    /* ------------------- USD → local currency reference ------------------- */
    /* Mid-market. Spreads applied by the rates engine, set in admin. */
    var USD_RATE = {
        NGN: 1500.00, GHS: 15.42, KES: 129.30, TZS: 2685.00, UGX: 3742.00,
        /* Send-abroad destinations we pay out to but do not host accounts in. */
        RWF: 1305.00, ZAR: 18.20
    };

    /* ------------------------------ Tiers ------------------------------ */

    var TIERS = [
        { id: 0, name: 'Unverified', dailyUsd: 0,     perTxUsd: 0,     needs: 'Email verified only' },
        { id: 1, name: 'Tier 1',     dailyUsd: 1000,  perTxUsd: 500,   needs: 'National ID verified' },
        { id: 2, name: 'Tier 2',     dailyUsd: 10000, perTxUsd: 5000,  needs: 'ID + proof of address' },
        { id: 3, name: 'Tier 3',     dailyUsd: 100000, perTxUsd: 50000, needs: 'Full KYC + source of funds' }
    ];

    /* ---------------------------- Formatting ---------------------------- */

    /* Corridors we pay out to but do not host accounts in still need a symbol. */
    var EXTRA_SYMBOLS = { RWF: { symbol: 'FRw', dp: 0 }, ZAR: { symbol: 'R', dp: 2 } };

    function fiat(amount, currency, opts) {
        opts = opts || {};
        var c = null;
        for (var k in COUNTRIES) { if (COUNTRIES[k].currency === currency) { c = COUNTRIES[k]; break; } }
        if (!c) c = EXTRA_SYMBOLS[currency] || null;
        var sym = c ? c.symbol : (currency + ' ');
        var dp = opts.dp != null ? opts.dp : (c ? c.dp : 2);
        var n = Number(amount || 0);
        var s = n.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
        return (opts.noSymbol ? '' : sym) + s;
    }

    function crypto(amount, symbol, opts) {
        opts = opts || {};
        var a = ASSETS[symbol];
        var dp = opts.full ? (a ? a.dp : 8) : (a ? a.displayDp : 4);
        var n = Number(amount || 0);
        var s = n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: dp });
        return s + (opts.noSymbol ? '' : ' ' + symbol);
    }

    function usd(amount) {
        return '$' + Number(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function compact(n) {
        n = Number(n || 0);
        if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2) + 'B';
        if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + 'M';
        if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + 'K';
        return n.toFixed(0);
    }

    /* --------------------------- Session user --------------------------- */
    /* Which country the demo user is browsing as. Switchable in the navbar so
       you can see the Ghana / Kenya view without a second account. */

    var CK = 'kaastro-country';

    function currentCountry() {
        var code;
        try { code = localStorage.getItem(CK); } catch (e) { code = null; }
        return COUNTRIES[code] || COUNTRIES.NG;
    }

    function setCountry(code) {
        try { localStorage.setItem(CK, code); } catch (e) { }
    }

    /* Convenience: format in the current user's own currency. */
    function local(amount, opts) {
        return fiat(amount, currentCountry().currency, opts);
    }

    /* USD value → the current user's local currency. */
    function fromUsd(amountUsd) {
        return Number(amountUsd || 0) * (USD_RATE[currentCountry().currency] || 1);
    }

    /* ===================== Payment statuses =====================
       One vocabulary for a payment in flight, used by the payer's public page,
       the recipient's app and the back office. Both sides read the same state,
       so a payer asking "did it land?" and a recipient asking "where is it?"
       are answered by the same word.

       Six of these are the happy path, in order. The last four are terminal
       exceptions — a payment that arrived wrong, ran out of time, or was
       called off. `step` is its position on the track (null = off-path), and
       `tone` decides how it is painted. */
    var PAYMENT_STATUS = {
        awaiting:   { key: 'awaiting',   step: 0, tone: 'wait', label: 'Awaiting payment',
                      payer: 'Send the exact amount to the address shown.',
                      payee: 'Waiting for your payer to send.' },
        detected:   { key: 'detected',   step: 1, tone: 'wait', label: 'Payment detected',
                      payer: 'We can see your transaction on the network.',
                      payee: 'A payment has appeared on the network.' },
        confirming: { key: 'confirming', step: 2, tone: 'wait', label: 'Confirming on blockchain',
                      payer: 'Waiting for the network to confirm.',
                      payee: 'Waiting for network confirmations.' },
        confirmed:  { key: 'confirmed',  step: 3, tone: 'ok',   label: 'Payment confirmed',
                      payer: 'The network has confirmed your payment.',
                      payee: 'Confirmed on-chain. Converting next.' },
        converted:  { key: 'converted',  step: 4, tone: 'ok',   label: 'Converted to Naira',
                      payer: 'Converted at the rate shown.',
                      payee: 'Converted and about to hit your balance.' },
        completed:  { key: 'completed',  step: 5, tone: 'ok',   label: 'Completed',
                      payer: 'Done. The recipient has been paid.',
                      payee: 'Done. Your balance has been credited.' },

        underpaid:  { key: 'underpaid',  step: null, tone: 'warn', label: 'Underpaid',
                      payer: 'Less arrived than was requested. Send the difference or ask for a refund.',
                      payee: 'Less arrived than you requested.' },
        overpaid:   { key: 'overpaid',   step: null, tone: 'warn', label: 'Overpaid',
                      payer: 'More arrived than was requested. The excess is refundable.',
                      payee: 'More arrived than you requested.' },
        expired:    { key: 'expired',    step: null, tone: 'fail', label: 'Expired',
                      payer: 'This link timed out. Ask the recipient for a new one.',
                      payee: 'The link timed out before anyone paid.' },
        cancelled:  { key: 'cancelled',  step: null, tone: 'fail', label: 'Cancelled',
                      payer: 'The recipient called this request off.',
                      payee: 'You cancelled this request.' }
    };

    /* The happy path, in order — what the progress track renders. */
    var PAYMENT_TRACK = ['awaiting', 'detected', 'confirming', 'confirmed', 'converted', 'completed'];

    /* A Naira bank transfer has no chain to confirm on and nothing to convert:
       the money is already in the currency the recipient is paid in. Same
       vocabulary, two rails, so neither side is told about a blockchain that
       was never involved. */
    var PAYMENT_TRACK_BANK = ['awaiting', 'detected', 'confirming', 'confirmed', 'completed'];

    var BANK_WORDS = {
        confirming: { label: 'Confirming with the bank',
                      payer: 'Waiting for the bank to confirm the transfer.',
                      payee: 'Waiting for the bank to confirm.' },
        confirmed:  { label: 'Payment confirmed',
                      payer: 'The bank has confirmed your transfer.',
                      payee: 'Confirmed by the bank. Crediting next.' }
    };

    function paymentTrack(rail) {
        return rail === 'bank' ? PAYMENT_TRACK_BANK.slice() : PAYMENT_TRACK.slice();
    }

    /* `rail` is optional and defaults to crypto, so every existing caller keeps
       working unchanged. `step` is recomputed against the rail's own track,
       because the bank path is one stage shorter. */
    function paymentStatus(key, rail) {
        var s = PAYMENT_STATUS[key] || PAYMENT_STATUS.awaiting;
        if (rail !== 'bank') return s;
        var track = PAYMENT_TRACK_BANK;
        var idx = track.indexOf(s.key);
        var out = {
            key: s.key, tone: s.tone, label: s.label, payer: s.payer, payee: s.payee,
            step: idx === -1 ? null : idx
        };
        var o = BANK_WORDS[s.key];
        if (o) { out.label = o.label; out.payer = o.payer; out.payee = o.payee; }
        return out;
    }

    /* Compare what actually arrived against what was asked for. A payer who is
       a few cents out should not be told they underpaid, so anything inside a
       1% band counts as exact. */
    function settlementOf(expected, received) {
        if (!received) return 'awaiting';
        var d = (received - expected) / expected;
        if (d < -0.01) return 'underpaid';
        if (d > 0.01) return 'overpaid';
        return 'exact';
    }

    var STATUS_PILL = { ok: 'pill-success', wait: 'pill-manual', warn: 'pill-warn', fail: 'pill-danger' };

    function statusPill(key, rail) {
        var s = paymentStatus(key, rail);
        return '<span class="pill ' + (STATUS_PILL[s.tone] || 'pill-neutral') + '">'
            + '<i class="fas ' + (s.tone === 'ok' ? 'fa-circle-check'
                : s.tone === 'fail' ? 'fa-circle-xmark'
                : s.tone === 'warn' ? 'fa-triangle-exclamation' : 'fa-clock') + '"></i>'
            + s.label + '</span>';
    }

    global.KP = global.KP || {};
    global.KP.COUNTRIES = COUNTRIES;
    global.KP.COUNTRY_LIST = COUNTRY_LIST;
    global.KP.ASSETS = ASSETS;
    global.KP.ASSET_LIST = ASSET_LIST;
    global.KP.USD_RATE = USD_RATE;
    global.KP.TIERS = TIERS;
    global.KP.PAYMENT_STATUS = PAYMENT_STATUS;
    global.KP.PAYMENT_TRACK = PAYMENT_TRACK;
    global.KP.paymentTrack = paymentTrack;
    global.KP.paymentStatus = paymentStatus;
    global.KP.settlementOf = settlementOf;
    global.KP.statusPill = statusPill;
    global.KP.fmt = { fiat: fiat, crypto: crypto, usd: usd, compact: compact, local: local };
    global.KP.currentCountry = currentCountry;
    global.KP.setCountry = setCountry;
    global.KP.fromUsd = fromUsd;

})(window);
