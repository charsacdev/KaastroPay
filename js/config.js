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
    var USD_RATE = { NGN: 1500.00, GHS: 15.42, KES: 129.30, TZS: 2685.00, UGX: 3742.00 };

    /* ------------------------------ Tiers ------------------------------ */

    var TIERS = [
        { id: 0, name: 'Unverified', dailyUsd: 0,     perTxUsd: 0,     needs: 'Email verified only' },
        { id: 1, name: 'Tier 1',     dailyUsd: 1000,  perTxUsd: 500,   needs: 'National ID verified' },
        { id: 2, name: 'Tier 2',     dailyUsd: 10000, perTxUsd: 5000,  needs: 'ID + proof of address' },
        { id: 3, name: 'Tier 3',     dailyUsd: 100000, perTxUsd: 50000, needs: 'Full KYC + source of funds' }
    ];

    /* ---------------------------- Formatting ---------------------------- */

    function fiat(amount, currency, opts) {
        opts = opts || {};
        var c = null;
        for (var k in COUNTRIES) { if (COUNTRIES[k].currency === currency) { c = COUNTRIES[k]; break; } }
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

    global.KP = global.KP || {};
    global.KP.COUNTRIES = COUNTRIES;
    global.KP.COUNTRY_LIST = COUNTRY_LIST;
    global.KP.ASSETS = ASSETS;
    global.KP.ASSET_LIST = ASSET_LIST;
    global.KP.USD_RATE = USD_RATE;
    global.KP.TIERS = TIERS;
    global.KP.fmt = { fiat: fiat, crypto: crypto, usd: usd, compact: compact, local: local };
    global.KP.currentCountry = currentCountry;
    global.KP.setCountry = setCountry;
    global.KP.fromUsd = fromUsd;

})(window);
