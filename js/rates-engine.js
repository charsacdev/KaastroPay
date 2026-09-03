/* ==========================================================================
   Kaastro Pay — rates engine
   One source of truth for every price shown anywhere: the rates page, the
   buy/sell/swap quote countdowns, and every balance's local-currency value.

   Deterministic drift (no Math.random) so admin and agent always agree, with
   a visible tick so quotes expire the way they would against a real feed.
   ========================================================================== */
(function (global) {
    'use strict';

    var TICK_MS = 30000;      // matches the "rates update every 30 seconds" promise
    var QUOTE_TTL = 30;       // seconds a quote stays dealable

    /* Margins the admin sets, in basis points.
       `deposit` is taken off the mid when we credit an incoming crypto deposit
       in Naira. `withdrawal` is added when a user pays Naira to send crypto
       out. There is no buy/sell/swap — the platform never holds crypto. */
    var MARGINS = {
        deposit: 150,      // 1.50% under mid on the way in
        withdrawal: 150,   // 1.50% over mid on the way out
        remittance: 200    // 2.00% on a cross-border payout
    };

    /* Per-country overrides. A market with thinner liquidity or a costlier
       payout rail needs its own spread, so the global numbers are only a
       fallback. Keyed by currency: { NGN: {buy, sell, swap}, … } */
    var OVERRIDES = {};

    function loadMargins() {
        try {
            var s = JSON.parse(localStorage.getItem('kaastro-margins') || 'null');
            if (s && s.deposit != null) {
                MARGINS.deposit = s.deposit;
                MARGINS.withdrawal = s.withdrawal;
                MARGINS.remittance = s.remittance != null ? s.remittance : MARGINS.remittance;
            }
        } catch (e) { }
        try {
            OVERRIDES = JSON.parse(localStorage.getItem('kaastro-margins-by-ccy') || '{}') || {};
        } catch (e) { OVERRIDES = {}; }
    }
    function saveMargins(m) {
        MARGINS.deposit = m.deposit; MARGINS.withdrawal = m.withdrawal;
        MARGINS.remittance = m.remittance;
        try { localStorage.setItem('kaastro-margins', JSON.stringify(MARGINS)); } catch (e) { }
    }

    /* Pass null to clear a country back to the global spread. */
    function setCountryMargins(currency, m) {
        if (m) {
            OVERRIDES[currency] = {
                deposit: m.deposit, withdrawal: m.withdrawal, remittance: m.remittance
            };
        } else { delete OVERRIDES[currency]; }
        try { localStorage.setItem('kaastro-margins-by-ccy', JSON.stringify(OVERRIDES)); } catch (e) { }
    }
    function countryMargins(currency) { return OVERRIDES[currency] || null; }

    /* The spread actually applied in a market. */
    function effective(currency) {
        var o = OVERRIDES[currency];
        return {
            deposit: o ? o.deposit : MARGINS.deposit,
            withdrawal: o ? o.withdrawal : MARGINS.withdrawal,
            remittance: o && o.remittance != null ? o.remittance : MARGINS.remittance,
            overridden: !!o
        };
    }

    /* A market can also be quoted off a manual reference rate instead of the
       feed — what a desk does when the interbank price stops being real. */
    var FX_OVERRIDE = {};
    function loadFx() {
        try { FX_OVERRIDE = JSON.parse(localStorage.getItem('kaastro-fx') || '{}') || {}; }
        catch (e) { FX_OVERRIDE = {}; }
    }
    function setFxRate(currency, rate) {
        if (rate) FX_OVERRIDE[currency] = Number(rate);
        else delete FX_OVERRIDE[currency];
        try { localStorage.setItem('kaastro-fx', JSON.stringify(FX_OVERRIDE)); } catch (e) { }
    }
    function fxRate(currency) {
        return FX_OVERRIDE[currency] || global.KP.USD_RATE[currency] || 1;
    }
    function isFxOverridden(currency) { return FX_OVERRIDE[currency] != null; }

    loadMargins();
    loadFx();

    /* --------------------------- price drift --------------------------- */
    /* A smooth deterministic wave per asset, seeded off the symbol, so prices
       move believably on every tick without ever being random. */

    function seed(sym) {
        var s = 0;
        for (var i = 0; i < sym.length; i++) s += sym.charCodeAt(i) * (i + 3);
        return s;
    }

    function driftFor(sym, t) {
        var s = seed(sym);
        var a = Math.sin((t / 90000) + s) * 0.006;
        var b = Math.sin((t / 23000) + s * 1.7) * 0.0025;
        var c = Math.sin((t / 7000) + s * 0.4) * 0.0009;
        return 1 + a + b + c;
    }

    /* Mid price of an asset in USD, right now. */
    function midUsd(sym) {
        var a = global.KP.ASSETS[sym];
        if (!a) return 0;
        if (sym === 'USDT' || sym === 'USDC') return a.usd;   // stables don't wobble in the demo
        return a.usd * driftFor(sym, Date.now());
    }

    /* 24h change, derived from the same wave so the arrow always agrees with
       the chart instead of contradicting it. */
    function change24h(sym) {
        if (sym === 'USDT' || sym === 'USDC') return 0.01;
        var now = Date.now();
        var then = now - 86400000;
        var a = global.KP.ASSETS[sym];
        var p0 = a.usd * driftFor(sym, then);
        var p1 = a.usd * driftFor(sym, now);
        return ((p1 - p0) / p0) * 100;
    }

    /* Mid price in a given fiat currency, honouring any manual FX override. */
    function midFiat(sym, currency) {
        return midUsd(sym) * fxRate(currency);
    }

    /* ===================== Rate mode =====================
       Two ways to price. In 'auto' the deposit and withdrawal rates are derived
       from the live mid price and the configured margins — the feed moves, the
       rates move. In 'manual' the platform publishes its own numbers and the
       feed is ignored entirely: an admin types the rate they want and it is the
       rate, however far it sits from mid.

       Manual is deliberately unconstrained. It exists for the days the feed is
       wrong, a corridor is illiquid, or a promotion needs a rate no formula
       would produce. The admin screen shows the gap to mid so the cost of that
       freedom stays visible. */

    var RATE_MODE_KEY = 'kaastro-rate-mode';
    var MANUAL_KEY = 'kaastro-manual-rates';

    var RATE_MODE = 'auto';
    /* { "NGN": { "USDT": { deposit: 1500, withdrawal: 1470 } } } */
    var MANUAL_RATES = {};

    (function loadRateMode() {
        try {
            RATE_MODE = localStorage.getItem(RATE_MODE_KEY) || 'auto';
            MANUAL_RATES = JSON.parse(localStorage.getItem(MANUAL_KEY) || '{}') || {};
        } catch (e) { RATE_MODE = 'auto'; MANUAL_RATES = {}; }
    })();

    function rateMode() { return RATE_MODE; }
    function isManual() { return RATE_MODE === 'manual'; }

    function setRateMode(mode) {
        RATE_MODE = mode === 'manual' ? 'manual' : 'auto';
        try { localStorage.setItem(RATE_MODE_KEY, RATE_MODE); } catch (e) { }
        return RATE_MODE;
    }

    function persistManual() {
        try { localStorage.setItem(MANUAL_KEY, JSON.stringify(MANUAL_RATES)); } catch (e) { }
    }

    /* What the admin has typed for this pair, or null if they have not. */
    function manualRate(sym, currency) {
        var c = MANUAL_RATES[currency];
        return (c && c[sym]) ? c[sym] : null;
    }

    /* Seed a pair from the current automatic rates, so switching to manual
       starts from today's numbers rather than an empty box. */
    function seedManual(sym, currency) {
        if (manualRate(sym, currency)) return manualRate(sym, currency);
        var m = MANUAL_RATES[currency] || (MANUAL_RATES[currency] = {});
        m[sym] = { deposit: autoDeposit(sym, currency), withdrawal: autoWithdrawal(sym, currency) };
        persistManual();
        return m[sym];
    }

    function setManualRate(sym, currency, vals) {
        var m = MANUAL_RATES[currency] || (MANUAL_RATES[currency] = {});
        var cur = m[sym] || seedManual(sym, currency);
        if (vals.deposit != null) cur.deposit = Number(vals.deposit) || 0;
        if (vals.withdrawal != null) cur.withdrawal = Number(vals.withdrawal) || 0;
        m[sym] = cur;
        persistManual();
        return cur;
    }

    /* Nudge one side by an absolute amount. No clamp and no ceiling — the whole
       point of manual is that the admin decides. */
    function adjustManualRate(sym, currency, side, delta) {
        var cur = seedManual(sym, currency);
        cur[side] = Math.max(0, (cur[side] || 0) + Number(delta || 0));
        persistManual();
        return cur;
    }

    function clearManual(sym, currency) {
        if (!sym) { MANUAL_RATES = {}; persistManual(); return; }
        var c = MANUAL_RATES[currency];
        if (c) { delete c[sym]; persistManual(); }
    }

    /* How far a manual rate sits from where the feed would have put it, in
       basis points. This is the number that tells an admin what they are
       actually doing. */
    function manualDrift(sym, currency, side) {
        var man = manualRate(sym, currency);
        if (!man) return 0;
        var auto = side === 'deposit' ? autoDeposit(sym, currency) : autoWithdrawal(sym, currency);
        if (!auto) return 0;
        return ((man[side] - auto) / auto) * 10000;
    }

    /* The two rates the whole product runs on.
       depositRate — Naira credited per unit of crypto received.
       withdrawalRate — Naira charged per unit of crypto sent out.

       In auto mode these come off the live mid price and the margins. In
       manual mode the platform's own published number wins outright, and the
       feed is not consulted at all. Everything downstream — the wallet, the
       payment link, the receipts — reads these two functions, so flipping the
       mode changes the whole product with one switch. */
    function autoDeposit(sym, currency) {
        return midFiat(sym, currency) * (1 - effective(currency).deposit / 10000);
    }
    function autoWithdrawal(sym, currency) {
        return midFiat(sym, currency) * (1 + effective(currency).withdrawal / 10000);
    }
    function depositRate(sym, currency) {
        if (isManual()) {
            var m = manualRate(sym, currency);
            if (m && m.deposit > 0) return m.deposit;
        }
        return autoDeposit(sym, currency);
    }
    function withdrawalRate(sym, currency) {
        if (isManual()) {
            var m = manualRate(sym, currency);
            if (m && m.withdrawal > 0) return m.withdrawal;
        }
        return autoWithdrawal(sym, currency);
    }

    /* Cross-border: how much of `to` a unit of `from` buys, after our cut. */
    function remitRate(fromCcy, toCcy) {
        var usdFrom = 1 / (global.KP.USD_RATE[fromCcy] || 1);
        var out = usdFrom * (global.KP.USD_RATE[toCcy] || 1);
        return out * (1 - effective(fromCcy).remittance / 10000);
    }

    /* ------------------------------ quotes ------------------------------ */
    /* A displayed rate and a dealable rate are different objects. Committing
       to an amount issues a quote that pins rate, margin and fee until it
       expires — the saga carries the quote, not just the amount. */

    var quoteSeq = 1000;

    function issueQuote(spec) {
        var q = {
            id: 'QT-' + (++quoteSeq),
            kind: spec.kind,                 // 'buy' | 'sell' | 'swap'
            from: spec.from, to: spec.to,
            fromAmount: spec.fromAmount, toAmount: spec.toAmount,
            rate: spec.rate,
            marginBps: spec.marginBps,
            fee: spec.fee || 0,
            issuedAt: Date.now(),
            expiresAt: Date.now() + QUOTE_TTL * 1000
        };
        return q;
    }

    function quoteSecondsLeft(q) {
        return Math.max(0, Math.ceil((q.expiresAt - Date.now()) / 1000));
    }

    /* ------------------------- history for charts ------------------------- */

    function history(sym, currency, points, spanMs) {
        var out = [];
        var now = Date.now();
        var a = global.KP.ASSETS[sym];
        var fx = global.KP.USD_RATE[currency] || 1;
        for (var i = points - 1; i >= 0; i--) {
            var t = now - (i * (spanMs / points));
            var p = (sym === 'USDT' || sym === 'USDC')
                ? a.usd * (1 + Math.sin(t / 400000 + seed(sym)) * 0.0008)
                : a.usd * driftFor(sym, t);
            out.push({ t: t, v: p * fx });
        }
        return out;
    }

    /* ------------------------------ ticker ------------------------------ */

    var listeners = [];
    function onTick(fn) { listeners.push(fn); return fn; }
    function emit() { listeners.forEach(function (f) { try { f(); } catch (e) { } }); }

    var timer = null;
    function start() {
        if (timer) return;
        timer = setInterval(emit, TICK_MS);
    }

    /* Countdown to the next tick, for the "refreshes in Ns" label. */
    var lastTick = Date.now();
    function secondsToTick() {
        return Math.max(0, Math.ceil((TICK_MS - (Date.now() - lastTick)) / 1000));
    }
    onTick(function () { lastTick = Date.now(); });

    global.KP = global.KP || {};
    global.KP.rates = {
        TICK_MS: TICK_MS,
        QUOTE_TTL: QUOTE_TTL,
        margins: function () { return MARGINS; },
        saveMargins: saveMargins,
        setCountryMargins: setCountryMargins,
        countryMargins: countryMargins,
        effective: effective,
        rateMode: rateMode, isManual: isManual, setRateMode: setRateMode,
        manualRate: manualRate, seedManual: seedManual, setManualRate: setManualRate,
        adjustManualRate: adjustManualRate, clearManual: clearManual, manualDrift: manualDrift,
        autoDeposit: autoDeposit, autoWithdrawal: autoWithdrawal,
        setFxRate: setFxRate,
        fxRate: fxRate,
        isFxOverridden: isFxOverridden,
        midUsd: midUsd,
        midFiat: midFiat,
        depositRate: depositRate,
        withdrawalRate: withdrawalRate,
        remitRate: remitRate,
        change24h: change24h,
        issueQuote: issueQuote,
        quoteSecondsLeft: quoteSecondsLeft,
        history: history,
        onTick: onTick,
        start: start,
        secondsToTick: secondsToTick
    };

    start();

})(window);
