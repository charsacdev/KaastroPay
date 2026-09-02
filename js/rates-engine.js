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

    /* The two rates the whole product runs on.
       depositRate — Naira credited per unit of crypto received.
       withdrawalRate — Naira charged per unit of crypto sent out. */
    function depositRate(sym, currency) {
        return midFiat(sym, currency) * (1 - effective(currency).deposit / 10000);
    }
    function withdrawalRate(sym, currency) {
        return midFiat(sym, currency) * (1 + effective(currency).withdrawal / 10000);
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
