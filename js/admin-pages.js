/* ==========================================================================
   Kaastro Pay — admin-only pages
   Rates and margins per market, fees, tiers, agents, reports, and the settings
   page shared with the agent portal.
   ========================================================================== */
(function (global, $) {
    'use strict';

    var A = {};

    /* Small helper for the "unsaved changes" bar every editable page uses.
       Nothing here writes on keystroke — an operator must commit deliberately. */
    function saveBar(id, label) {
        return '<div class="save-bar" id="' + id + '">'
            + '<span class="sb-note"><i class="fas fa-circle-info me-1"></i>'
            + '<span class="sb-text">No unsaved changes</span></span>'
            + '<div class="d-flex gap-2 ms-auto">'
            + '<button class="btn btn-soft btn-sm sb-reset" disabled>Discard</button>'
            + '<button class="btn btn-primary btn-sm sb-save" disabled>'
            + '<i class="fas fa-floppy-disk me-1"></i>' + (label || 'Save changes') + '</button>'
            + '</div></div>';
    }
    function markDirty($bar, n) {
        $bar.toggleClass('dirty', n > 0);
        $bar.find('.sb-text').text(n ? n + ' unsaved change' + (n === 1 ? '' : 's') : 'No unsaved changes');
        $bar.find('.sb-save, .sb-reset').prop('disabled', !n);
    }

    /* ========================= Rates & margins ========================= */

    A.rates = function ($el) {
        var F = KP.fmt, BO = KP.bo, D = KP.data;
        var ccy = KP.currentCountry().currency;

        /* ---------- rate source: the feed, or our own number ---------- */

        var RATE_SOURCE_PANE =
            '<div class="tab-pane fade show active" id="rSource">'
            + '<div class="row g-3"><div class="col-lg-5">'
            + '<div class="card p-3 p-md-4">'
            + '<div class="section-head"><h2>Where rates come from</h2></div>'
            + '<p class="text-muted" style="font-size:.82rem">'
            + 'Automatic prices every asset off the live feed and your spreads. '
            + 'Kaastro rate ignores the feed and publishes the numbers you type.</p>'
            + '<div class="d-grid gap-2" id="modePick"></div>'
            + '<div id="modeNote" class="mt-3"></div>'
            + '</div></div>'
            + '<div class="col-lg-7"><div class="card p-3 p-md-4">'
            + '<div class="section-head"><h2>Published rates</h2>'
            + '<select class="form-select form-select-sm" id="srcCcy" style="width:auto"></select></div>'
            + '<div id="srcBody"></div></div></div></div></div>';

        $el.html(
            '<ul class="nav nav-tabs mb-3">'
            + '<li class="nav-item"><button class="nav-link active" data-bs-toggle="tab" data-bs-target="#rSource">Rate source</button></li>'
            + '<li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#rMarkets">Per market</button></li>'
            + '<li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#rGlobal">Global default</button></li>'
            + '<li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#rLive">Live board</button></li>'
            + '</ul><div class="tab-content">'

            /* --- per market --- */
            + RATE_SOURCE_PANE
            + '<div class="tab-pane fade" id="rMarkets">'
            + '<div class="card p-3 p-md-4">'
            + '<div class="section-head"><h2>Rates by country</h2>'
            + '<span class="small text-muted">every market can be priced on its own</span></div>'
            + '<p class="text-muted" style="font-size:.82rem">'
            + 'Set the reference rate and the spread per market. A country with a thinner book '
            + 'or a costlier payout rail should not be forced onto one global number. Leave a row '
            + 'on <b>Default</b> and it follows the global spread.</p>'
            + '<div class="table-wrap"><table class="k-table" style="min-width:820px">'
            + '<thead><tr><th>Market</th><th>Reference rate</th><th>Deposit spread</th>'
            + '<th>Withdrawal spread</th><th>Remittance</th><th class="text-end">USDT in / out</th>'
            + '<th class="text-end">Source</th></tr></thead>'
            + '<tbody id="mktRows"></tbody></table></div>'
            + saveBar('mktBar', 'Apply market rates')
            + '</div></div>'

            /* --- global --- */
            + '<div class="tab-pane fade" id="rGlobal">'
            + '<div class="row g-3"><div class="col-lg-5">'
            + '<div class="card p-3 p-md-4">'
            + '<div class="section-head"><h2>Global default spread</h2></div>'
            + '<p class="text-muted" style="font-size:.82rem">'
            + 'Applies to any market without its own override. Basis points: 100 bps = 1%.</p>'
            + '<label class="form-label mt-2">Deposit margin</label>'
            + '<div class="input-group mb-1"><input type="number" class="form-control" id="mBuy" step="5">'
            + '<span class="input-group-text">bps</span></div>'
            + '<div class="form-text mb-3" id="mBuyPct"></div>'
            + '<label class="form-label">Withdrawal margin</label>'
            + '<div class="input-group mb-1"><input type="number" class="form-control" id="mSell" step="5">'
            + '<span class="input-group-text">bps</span></div>'
            + '<div class="form-text mb-3" id="mSellPct"></div>'
            + '<label class="form-label">Remittance margin</label>'
            + '<div class="input-group mb-1"><input type="number" class="form-control" id="mSwap" step="5">'
            + '<span class="input-group-text">bps</span></div>'
            + '<div class="form-text mb-3" id="mSwapPct"></div>'
            + '<button class="btn btn-primary w-100" id="saveGlobal">'
            + '<i class="fas fa-floppy-disk me-1"></i>Save global spread</button>'
            + '<p class="text-muted text-center mt-2 mb-0" style="font-size:.72rem">'
            + 'Takes effect on the next quote. In-flight quotes keep their pinned rate.</p>'
            + '</div></div>'
            + '<div class="col-lg-7"><div class="card p-3 p-md-4">'
            + '<div class="section-head"><h2>Feed health</h2></div><div id="feeds"></div></div>'
            + '<div class="card p-3 p-md-4 mt-3"><div class="section-head"><h2>Margin earned by asset</h2></div>'
            + '<p class="text-muted" style="font-size:.8rem">'
            + 'Realised margin from completed trades — the number that matters more than the setting.</p>'
            + '<div id="earned"></div></div></div></div></div>'

            /* --- live board --- */
            + '<div class="tab-pane fade" id="rLive">'
            + '<div class="card p-3 p-md-4">'
            + '<div class="section-head"><h2>Effective rates</h2>'
            + '<div class="d-flex align-items-center gap-2">'
            + '<select class="form-select form-select-sm" id="ccySel" style="width:auto"></select>'
            + '<span class="small text-muted" id="tickIn"></span></div></div>'
            + '<div class="table-wrap"><table class="k-table"><thead><tr>'
            + '<th>Asset</th><th class="text-end">Mid (USD)</th><th class="text-end">Mid</th>'
            + '<th class="text-end">Deposit rate</th><th class="text-end">Withdrawal rate</th>'
            + '<th class="text-end">Spread</th><th class="text-end">24h</th></tr></thead>'
            + '<tbody id="rateRows"></tbody></table></div></div></div>'

            + '</div>'
        );

        /* ---------- rate source wiring ---------- */

        var srcCcy = ccy;

        $('#srcCcy').html(KP.COUNTRY_LIST.map(function (c) {
            return '<option value="' + c.currency + '"' + (c.currency === srcCcy ? ' selected' : '') + '>'
                + c.flag + ' ' + c.currency + '</option>';
        }).join(''));

        function paintMode() {
            var manual = KP.rates.isManual();
            $('#modePick').html([
                ['auto', 'fa-satellite-dish', 'Automatic',
                 'Live feed price, minus your deposit spread and plus your withdrawal spread. Rates move as the market moves.'],
                ['manual', 'fa-sliders', 'Kaastro Pay rate',
                 'You publish the number. The feed is ignored until you switch back.']
            ].map(function (m) {
                var on = (m[0] === 'manual') === manual;
                return '<button class="method-card' + (on ? ' selected' : '') + '" data-mode="' + m[0] + '">'
                    + '<span class="qa-icon ' + (on ? 'qa-green' : 'qa-slate') + '">'
                    + '<i class="fas ' + m[1] + '"></i></span>'
                    + '<span class="mc-body"><span class="mc-title">' + m[2]
                    + (on ? ' <span class="pill pill-success">Active</span>' : '') + '</span>'
                    + '<span class="mc-desc">' + m[3] + '</span></span></button>';
            }).join(''));

            $('#modeNote').html(manual
                ? '<div class="k-alert k-warn"><i class="fas fa-triangle-exclamation"></i><div>'
                  + '<b class="hd">The feed is not being consulted.</b>'
                  + 'Every quote, receipt and payment link uses the numbers on the right. '
                  + 'Nothing stops you pricing away from the market, so check the drift column.</div></div>'
                : '<div class="k-alert k-ok"><i class="fas fa-shield-halved"></i><div>'
                  + 'Rates follow the feed. Spreads are set under <b>Per market</b> and '
                  + '<b>Global default</b>.</div></div>');
        }

        function paintSource() {
            var manual = KP.rates.isManual();
            if (!manual) {
                $('#srcBody').html(
                    '<p class="text-muted" style="font-size:.82rem">Derived live from the feed. '
                    + 'Switch to <b>Kaastro Pay rate</b> to publish your own.</p>'
                    + '<div class="table-wrap"><table class="k-table"><thead><tr>'
                    + '<th>Asset</th><th class="text-end">Deposit</th>'
                    + '<th class="text-end">Withdrawal</th></tr></thead><tbody>'
                    + KP.ASSET_LIST.map(function (a) {
                        return '<tr><td class="t-strong">' + a.symbol + '</td>'
                            + '<td class="text-end t-strong text-up">'
                            + F.fiat(KP.rates.depositRate(a.symbol, srcCcy), srcCcy) + '</td>'
                            + '<td class="text-end t-strong">'
                            + F.fiat(KP.rates.withdrawalRate(a.symbol, srcCcy), srcCcy) + '</td></tr>';
                    }).join('') + '</tbody></table></div>');
                return;
            }

            $('#srcBody').html(
                '<p class="text-muted" style="font-size:.82rem">'
                + 'Type any value. Drift shows how far you are from where the feed would price it.</p>'
                + '<div class="table-wrap"><table class="k-table" style="min-width:640px"><thead><tr>'
                + '<th>Asset</th><th>Deposit rate</th><th>Withdrawal rate</th>'
                + '<th class="text-end">Drift vs mid</th></tr></thead><tbody>'
                + KP.ASSET_LIST.map(function (a) {
                    var m = KP.rates.seedManual(a.symbol, srcCcy);
                    return '<tr data-sym="' + a.symbol + '">'
                        + '<td><div class="d-flex align-items-center gap-2">'
                        + '<span class="asset-icon sm" style="background:' + a.color + '">'
                        + a.symbol.slice(0, 3) + '</span><span class="t-strong">' + a.symbol + '</span></div></td>'
                        + ['deposit', 'withdrawal'].map(function (side) {
                            return '<td><div class="rate-step">'
                                + '<button class="btn btn-sm btn-soft rs-dn" data-side="' + side + '">'
                                + '<i class="fas fa-minus"></i></button>'
                                + '<input class="form-control form-control-sm rs-in" data-side="' + side + '" '
                                + 'inputmode="decimal" value="' + (m[side] || 0).toFixed(2) + '">'
                                + '<button class="btn btn-sm btn-soft rs-up" data-side="' + side + '">'
                                + '<i class="fas fa-plus"></i></button></div></td>';
                        }).join('')
                        + '<td class="text-end t-mono rs-drift">' + driftText(a.symbol) + '</td></tr>';
                }).join('') + '</tbody></table></div>'
                + '<div class="d-flex gap-2 mt-3">'
                + '<button class="btn btn-soft flex-grow-1" id="srcReseed">'
                + '<i class="fas fa-rotate me-1"></i>Reset to feed prices</button>'
                + '<button class="btn btn-primary flex-grow-1" id="srcSave">'
                + '<i class="fas fa-floppy-disk me-1"></i>Publish rates</button></div>');
        }

        function driftText(sym) {
            var d = KP.rates.manualDrift(sym, srcCcy, 'deposit');
            var w = KP.rates.manualDrift(sym, srcCcy, 'withdrawal');
            function one(v) {
                var cls = Math.abs(v) < 25 ? 'text-muted' : v > 0 ? 'text-up' : 'text-down';
                return '<span class="' + cls + '">' + (v > 0 ? '+' : '') + Math.round(v) + '</span>';
            }
            return one(d) + ' / ' + one(w) + ' bps';
        }

        function stepFor(sym) {
            /* A sensible nudge depends on the size of the number: one Naira on
               USDT, a thousand on Bitcoin. */
            var v = KP.rates.depositRate(sym, srcCcy);
            if (v >= 1e6) return 10000;
            if (v >= 1e4) return 100;
            if (v >= 100) return 1;
            return 0.5;
        }

        $el.on('click', '[data-mode]', function () {
            KP.rates.setRateMode($(this).data('mode'));
            paintMode(); paintSource();
            KP.rails.toast(KP.rates.isManual()
                ? 'Now publishing Kaastro Pay rates. The feed is ignored.'
                : 'Back on the live feed.', KP.rates.isManual() ? 'warning' : 'success');
        });

        $el.on('change', '#srcCcy', function () { srcCcy = $(this).val(); paintSource(); });

        $el.on('click', '.rs-up, .rs-dn', function () {
            var $tr = $(this).closest('tr');
            var sym = $tr.data('sym');
            var side = $(this).data('side');
            var step = stepFor(sym) * ($(this).hasClass('rs-dn') ? -1 : 1);
            var m = KP.rates.adjustManualRate(sym, srcCcy, side, step);
            $tr.find('.rs-in[data-side="' + side + '"]').val(m[side].toFixed(2));
            $tr.find('.rs-drift').html(driftText(sym));
        });

        $el.on('change', '.rs-in', function () {
            var $tr = $(this).closest('tr');
            var sym = $tr.data('sym');
            var side = $(this).data('side');
            var v = parseFloat(($(this).val() || '').replace(/,/g, ''));
            if (isNaN(v) || v < 0) { KP.rails.toast('Enter a number.', 'danger'); paintSource(); return; }
            var m = KP.rates.setManualRate(sym, srcCcy, side === 'deposit' ? { deposit: v } : { withdrawal: v });
            $(this).val(m[side].toFixed(2));
            $tr.find('.rs-drift').html(driftText(sym));
        });

        $el.on('click', '#srcSave', function () {
            KP.rails.toast('Rates published. Every new quote uses them.', 'success');
        });

        $el.on('click', '#srcReseed', function () {
            KP.rails.sheet('Reset to feed prices?',
                '<p class="text-muted" style="font-size:.83rem">Your typed rates for '
                + srcCcy + ' are replaced with what the feed would price right now. '
                + 'You stay in Kaastro Pay rate mode.</p>'
                + '<div class="d-grid gap-2">'
                + '<button class="btn btn-primary" id="srcReseedYes">Reset to feed prices</button>'
                + '<button class="btn btn-soft" data-bs-dismiss="modal">Keep my rates</button></div>');
        });
        $(document).off('click.srcReseed').on('click.srcReseed', '#srcReseedYes', function () {
            KP.ASSET_LIST.forEach(function (a) { KP.rates.clearManual(a.symbol, srcCcy); });
            KP.rails.closeSheet();
            paintSource();
            KP.rails.toast('Reset to feed prices.');
        });

        paintMode();
        paintSource();

        /* ---------- per-market editor ---------- */

        var draft = {};   // currency → {fx, buy, sell, swap} while unsaved

        function current(c) {
            var m = KP.rates.effective(c.currency);
            return draft[c.currency] || {
                fx: KP.rates.fxRate(c.currency),
                deposit: m.deposit, withdrawal: m.withdrawal, remittance: m.remittance,
                overridden: m.overridden || KP.rates.isFxOverridden(c.currency)
            };
        }

        function paintMarkets() {
            $('#mktRows').html(KP.COUNTRY_LIST.map(function (c) {
                var v = current(c);
                var eff = KP.rates.midUsd('USDT') * v.fx;
                var dep = eff * (1 - v.deposit / 10000);
                var wdr = eff * (1 + v.withdrawal / 10000);
                var over = !!draft[c.currency] || KP.rates.effective(c.currency).overridden
                    || KP.rates.isFxOverridden(c.currency);
                return '<tr data-ccy="' + c.currency + '">'
                    + '<td><div class="d-flex align-items-center gap-2">'
                    + '<span style="font-size:1.1rem">' + c.flag + '</span>'
                    + '<div style="line-height:1.25"><div class="t-strong">' + c.name + '</div>'
                    + '<div class="t-mono">' + c.currency + '</div></div></div></td>'
                    + '<td><div class="input-group input-group-sm" style="width:150px">'
                    + '<span class="input-group-text">' + c.symbol + '</span>'
                    + '<input class="form-control mk-fx" type="number" step="0.01" value="' + v.fx + '"></div>'
                    + '<div class="t-mono mt-1">per USD</div></td>'
                    + '<td><div class="input-group input-group-sm" style="width:112px">'
                    + '<input class="form-control mk-dep" type="number" step="5" value="' + v.deposit + '">'
                    + '<span class="input-group-text">bps</span></div></td>'
                    + '<td><div class="input-group input-group-sm" style="width:112px">'
                    + '<input class="form-control mk-wdr" type="number" step="5" value="' + v.withdrawal + '">'
                    + '<span class="input-group-text">bps</span></div></td>'
                    + '<td><div class="input-group input-group-sm" style="width:112px">'
                    + '<input class="form-control mk-rem" type="number" step="5" value="' + v.remittance + '">'
                    + '<span class="input-group-text">bps</span></div></td>'
                    + '<td class="text-end"><div class="t-strong text-up">' + F.fiat(dep, c.currency) + '</div>'
                    + '<div class="t-mono">' + F.fiat(wdr, c.currency) + '</div></td>'
                    + '<td class="text-end">'
                    + (over ? '<span class="pill pill-manual">Override</span>'
                            : '<span class="pill pill-neutral">Default</span>')
                    + (over ? '<br><button class="btn btn-sm btn-soft mt-1 mk-clear">Reset</button>' : '')
                    + '</td></tr>';
            }).join(''));
        }
        paintMarkets();

        var $bar = $('#mktBar');
        $('#mktRows').on('input', '.mk-fx, .mk-dep, .mk-wdr, .mk-rem', function () {
            var $tr = $(this).closest('tr');
            draft[$tr.data('ccy')] = {
                fx: parseFloat($tr.find('.mk-fx').val()) || 0,
                deposit: parseInt($tr.find('.mk-dep').val(), 10) || 0,
                withdrawal: parseInt($tr.find('.mk-wdr').val(), 10) || 0,
                remittance: parseInt($tr.find('.mk-rem').val(), 10) || 0
            };
            markDirty($bar, Object.keys(draft).length);
        });

        $('#mktRows').on('click', '.mk-clear', function () {
            var c = $(this).closest('tr').data('ccy');
            delete draft[c];
            KP.rates.setCountryMargins(c, null);
            KP.rates.setFxRate(c, null);
            KP.rails.toast(c + ' is back on the global spread and the live feed.');
            paintMarkets();
            markDirty($bar, Object.keys(draft).length);
        });

        $bar.on('click', '.sb-save', function () {
            Object.keys(draft).forEach(function (c) {
                var d = draft[c];
                KP.rates.setCountryMargins(c, {
                    deposit: d.deposit, withdrawal: d.withdrawal, remittance: d.remittance
                });
                KP.rates.setFxRate(c, d.fx);
            });
            var n = Object.keys(draft).length;
            draft = {};
            markDirty($bar, 0);
            paintMarkets(); paintRates();
            KP.rails.toast('Applied rates for ' + n + ' market' + (n === 1 ? '' : 's') + '. New quotes use them immediately.');
        });
        $bar.on('click', '.sb-reset', function () {
            draft = {}; markDirty($bar, 0); paintMarkets();
            KP.rails.toast('Changes discarded.', 'warning');
        });

        /* ---------- global ---------- */

        function loadGlobal() {
            var m = KP.rates.margins();
            $('#mBuy').val(m.deposit); $('#mSell').val(m.withdrawal); $('#mSwap').val(m.remittance);
            paintPct();
        }
        function paintPct() {
            $('#mBuyPct').text('Deposits credit ' + ($('#mBuy').val() / 100).toFixed(2) + '% under mid.');
            $('#mSellPct').text('Withdrawals charge ' + ($('#mSell').val() / 100).toFixed(2) + '% over mid.');
            $('#mSwapPct').text('Cross-border payouts cost ' + ($('#mSwap').val() / 100).toFixed(2) + '%.');
        }
        $('#mBuy,#mSell,#mSwap').on('input', paintPct);
        $('#saveGlobal').on('click', function () {
            KP.rates.saveMargins({
                deposit: +$('#mBuy').val() || 0,
                withdrawal: +$('#mSell').val() || 0,
                remittance: +$('#mSwap').val() || 0
            });
            KP.rails.toast('Global spread saved. Markets without an override follow it now.');
            paintMarkets(); paintRates();
        });
        loadGlobal();

        /* ---------- live board ---------- */

        $('#ccySel').html(KP.COUNTRY_LIST.map(function (c) {
            return '<option value="' + c.currency + '"' + (c.currency === ccy ? ' selected' : '') + '>'
                + c.flag + ' ' + c.currency + '</option>';
        }).join(''));
        $('#ccySel').on('change', function () { ccy = $(this).val(); paintRates(); });

        function paintRates() {
            $('#rateRows').html(KP.ASSET_LIST.map(function (a) {
                var mid = KP.rates.midFiat(a.symbol, ccy);
                var b = KP.rates.depositRate(a.symbol, ccy);
                var s = KP.rates.withdrawalRate(a.symbol, ccy);
                var ch = KP.rates.change24h(a.symbol);
                return '<tr>'
                    + '<td><div class="d-flex align-items-center gap-2">'
                    + '<span class="asset-icon sm" style="background:' + a.color + '">' + a.symbol.slice(0, 3) + '</span>'
                    + '<div style="line-height:1.25"><div class="t-strong">' + a.symbol + '</div>'
                    + '<div class="t-mono">' + a.name + '</div></div></div></td>'
                    + '<td class="text-end t-mono">' + F.usd(KP.rates.midUsd(a.symbol)) + '</td>'
                    + '<td class="text-end t-strong">' + F.fiat(mid, ccy) + '</td>'
                    + '<td class="text-end t-strong text-up">' + F.fiat(b, ccy) + '</td>'
                    + '<td class="text-end t-strong">' + F.fiat(s, ccy) + '</td>'
                    + '<td class="text-end t-mono">' + ((s - b) / mid * 100).toFixed(2) + '%</td>'
                    + '<td class="text-end t-strong ' + (ch >= 0 ? 'text-up' : 'text-down') + '">'
                    + (ch >= 0 ? '+' : '') + ch.toFixed(2) + '%</td></tr>';
            }).join(''));
        }
        paintRates();

        $('#feeds').html([
            ['Binance', 'successful', 'Live · 0.4s'],
            ['Coinbase', 'successful', 'Live · 0.7s'],
            ['Kraken', 'successful', 'Live · 1.1s']
        ].map(function (f) {
            return '<div class="asset-row"><div class="flex-grow-1 min-w-0">'
                + '<div class="ar-name" style="font-size:.83rem">' + f[0] + '</div>'
                + '<div class="ar-sub">' + f[2] + '</div></div>' + BO.pill(f[1]) + '</div>';
        }).join('')
            + '<div class="k-alert k-info mt-2"><i class="fas fa-circle-info"></i><div>'
            + '<b class="hd">Median of three.</b>A single feed’s bad tick becomes a bad trade. Quoting halts '
            + 'automatically if the feeds disagree beyond tolerance. A market on a manual reference '
            + 'rate ignores the feed entirely.</div></div>');

        var byAsset = {};
        D.TRADES.filter(function (t) { return t.status === 'successful'; }).forEach(function (t) {
            var s = t.kind === 'buy' ? t.to : t.from;
            if (KP.ASSETS[s]) byAsset[s] = (byAsset[s] || 0) + t.marginEarnedUsd;
        });
        var max = Math.max.apply(null, Object.keys(byAsset).map(function (k) { return byAsset[k]; })) || 1;
        $('#earned').html(Object.keys(byAsset)
            .sort(function (a, b) { return byAsset[b] - byAsset[a]; })
            .map(function (s) {
                var a = KP.ASSETS[s];
                return '<div class="py-2"><div class="d-flex justify-content-between align-items-center mb-1">'
                    + '<span style="font-size:.84rem;font-weight:700">'
                    + '<span class="asset-icon sm d-inline-grid align-middle me-1" style="background:' + a.color + '">' + s.slice(0, 3) + '</span>'
                    + s + '</span><span class="t-mono">' + F.usd(byAsset[s] * 46) + '</span></div>'
                    + '<div class="progress" style="height:5px"><div class="progress-bar" '
                    + 'style="width:' + (byAsset[s] / max * 100) + '%;background:var(--primary-color)"></div></div></div>';
            }).join(''));

        KP.rates.onTick(function () { paintRates(); paintMarkets(); });
        setInterval(function () { $('#tickIn').text(KP.rates.secondsToTick() + 's'); }, 1000);
    };

    /* ============================== Fees ============================== */

    A.fees = function ($el) {
        var F = KP.fmt;
        var FEE_KEY = 'kaastro-fees';
        var fees = {};
        try { fees = JSON.parse(localStorage.getItem(FEE_KEY) || '{}') || {}; } catch (e) { fees = {}; }

        function fiatFee(c) {
            if (fees['fiat_' + c.currency] != null) return fees['fiat_' + c.currency];
            return c.dp === 0 ? 500 : (c.currency === 'NGN' ? 100 : 2);
        }
        function fiatMin(c) {
            if (fees['min_' + c.currency] != null) return fees['min_' + c.currency];
            return fiatFee(c) * 10;
        }
        function cryptoFee(sym, net) {
            var k = 'cx_' + sym + '_' + net;
            if (fees[k] != null) return fees[k];
            return KP.ASSETS[sym].withdrawFee[net];
        }

        $el.html('<div class="row g-3">'
            + '<div class="col-lg-6"><div class="card p-3 p-md-4">'
            + '<div class="section-head"><h2>Cash withdrawal fees</h2></div>'
            + '<p class="text-muted" style="font-size:.8rem">Charged per payout, in the user’s own currency.</p>'
            + '<div class="table-wrap"><table class="k-table" style="min-width:0">'
            + '<thead><tr><th>Country</th><th>Fee</th><th>Minimum payout</th></tr></thead>'
            + '<tbody id="feeFiat"></tbody></table></div></div>'
            + '<div class="card p-3 p-md-4 mt-3"><div class="section-head"><h2>Deposit fees</h2></div>'
            + '<p class="text-muted mb-0" style="font-size:.8rem">'
            + 'Crypto deposits are free — the sender pays the network. Cash deposits carry the '
            + 'provider’s own charge only, which we pass through at cost.</p></div></div>'

            + '<div class="col-lg-6"><div class="card p-3 p-md-4">'
            + '<div class="section-head"><h2>Crypto withdrawal fees</h2></div>'
            + '<p class="text-muted" style="font-size:.8rem">'
            + 'Covers the network fee we pay to broadcast. Set per asset, per network.</p>'
            + '<div class="table-wrap"><table class="k-table" style="min-width:0">'
            + '<thead><tr><th>Asset</th><th>Network</th><th>Fee</th><th class="text-end">≈ USD</th></tr></thead>'
            + '<tbody id="feeCrypto"></tbody></table></div></div></div>'
            + '</div>'
            + saveBar('feeBar', 'Save fees'));

        function paint() {
            $('#feeFiat').html(KP.COUNTRY_LIST.map(function (c) {
                return '<tr><td class="t-strong">' + c.flag + ' ' + c.name + '</td>'
                    + '<td><div class="input-group input-group-sm" style="width:140px">'
                    + '<span class="input-group-text">' + c.symbol + '</span>'
                    + '<input class="form-control fee-in" data-k="fiat_' + c.currency + '" type="number" '
                    + 'step="any" value="' + fiatFee(c) + '"></div></td>'
                    + '<td><div class="input-group input-group-sm" style="width:140px">'
                    + '<span class="input-group-text">' + c.symbol + '</span>'
                    + '<input class="form-control fee-in" data-k="min_' + c.currency + '" type="number" '
                    + 'step="any" value="' + fiatMin(c) + '"></div></td></tr>';
            }).join(''));

            var rows = [];
            KP.ASSET_LIST.forEach(function (a) {
                Object.keys(a.withdrawFee).forEach(function (net) {
                    var v = cryptoFee(a.symbol, net);
                    rows.push('<tr><td><div class="d-flex align-items-center gap-2">'
                        + '<span class="asset-icon sm" style="background:' + a.color + '">' + a.symbol.slice(0, 3) + '</span>'
                        + '<span class="t-strong">' + a.symbol + '</span></div></td>'
                        + '<td class="t-mono">' + net + '</td>'
                        + '<td><input class="form-control form-control-sm fee-in" style="width:120px" '
                        + 'data-k="cx_' + a.symbol + '_' + net + '" type="number" step="any" value="' + v + '"></td>'
                        + '<td class="text-end t-mono">' + F.usd(v * KP.rates.midUsd(a.symbol)) + '</td></tr>');
                });
            });
            $('#feeCrypto').html(rows.join(''));
        }
        paint();

        var $bar = $('#feeBar');
        var draft = {};
        $el.on('input', '.fee-in', function () {
            draft[$(this).data('k')] = parseFloat($(this).val());
            markDirty($bar, Object.keys(draft).length);
        });
        $bar.on('click', '.sb-save', function () {
            Object.keys(draft).forEach(function (k) { fees[k] = draft[k]; });
            try { localStorage.setItem(FEE_KEY, JSON.stringify(fees)); } catch (e) { }
            var n = Object.keys(draft).length;
            draft = {}; markDirty($bar, 0); paint();
            KP.rails.toast('Saved ' + n + ' fee change' + (n === 1 ? '' : 's') + '. Applied to new transactions.');
        });
        $bar.on('click', '.sb-reset', function () {
            draft = {}; markDirty($bar, 0); paint();
            KP.rails.toast('Changes discarded.', 'warning');
        });
    };

    /* ============================== Tiers ============================== */

    A.tiers = function ($el) {
        var F = KP.fmt, D = KP.data;
        var counts = {};
        D.USERS.forEach(function (u) { counts[u.tier] = (counts[u.tier] || 0) + 1; });

        $el.html('<div class="row g-3">'
            + '<div class="col-lg-8"><div class="card p-3 p-md-4">'
            + '<div class="section-head"><h2>Tiers and limits</h2></div>'
            + '<p class="text-muted" style="font-size:.8rem">'
            + 'Limits are enforced in the domain layer — not in the app, and not by the payment provider.</p>'
            + '<div class="table-wrap"><table class="k-table"><thead><tr>'
            + '<th>Tier</th><th>Unlocked by</th><th>Daily limit</th>'
            + '<th>Per transaction</th><th class="text-end">Users</th></tr></thead>'
            + '<tbody id="tierRows"></tbody></table></div>'
            + saveBar('tierBar', 'Save limits')
            + '</div></div>'
            + '<div class="col-lg-4"><div class="card p-3 p-md-4 h-100">'
            + '<div class="section-head"><h2>Distribution</h2></div><div id="tierDist"></div>'
            + '<div class="k-alert k-info mt-3"><i class="fas fa-circle-info"></i><div>'
            + '<b class="hd">Local caps can be lower.</b>Where a regulator sets a tighter ceiling than your '
            + 'global tier, the lower of the two applies.</div></div></div></div></div>');

        $('#tierRows').html(KP.TIERS.map(function (t) {
            return '<tr><td><span class="tier-badge tier-' + t.id + '">' + t.name + '</span></td>'
                + '<td class="text-muted">' + t.needs + '</td>'
                + '<td><div class="input-group input-group-sm" style="width:150px">'
                + '<span class="input-group-text">$</span>'
                + '<input class="form-control tier-in" data-t="' + t.id + '" data-f="dailyUsd" '
                + 'type="number" value="' + (t.dailyUsd || 0) + '"></div></td>'
                + '<td><div class="input-group input-group-sm" style="width:150px">'
                + '<span class="input-group-text">$</span>'
                + '<input class="form-control tier-in" data-t="' + t.id + '" data-f="perTxUsd" '
                + 'type="number" value="' + (t.perTxUsd || 0) + '"></div></td>'
                + '<td class="text-end t-strong">' + (counts[t.id] || 0) + '</td></tr>';
        }).join(''));

        var total = D.USERS.length;
        $('#tierDist').html(KP.TIERS.map(function (t) {
            var n = counts[t.id] || 0;
            return '<div class="py-2"><div class="d-flex justify-content-between mb-1">'
                + '<span style="font-size:.83rem;font-weight:700">' + t.name + '</span>'
                + '<span class="t-mono">' + n + ' · ' + Math.round(n / total * 100) + '%</span></div>'
                + '<div class="progress" style="height:5px"><div class="progress-bar" style="width:'
                + (n / total * 100) + '%;background:var(--primary-color)"></div></div></div>';
        }).join(''));

        var $bar = $('#tierBar'), draft = {};
        $el.on('input', '.tier-in', function () {
            draft[$(this).data('t') + '.' + $(this).data('f')] = parseFloat($(this).val()) || 0;
            markDirty($bar, Object.keys(draft).length);
        });
        $bar.on('click', '.sb-save', function () {
            Object.keys(draft).forEach(function (k) {
                var p = k.split('.');
                KP.TIERS[+p[0]][p[1]] = draft[k];
            });
            var n = Object.keys(draft).length;
            draft = {}; markDirty($bar, 0);
            KP.rails.toast('Saved ' + n + ' limit change' + (n === 1 ? '' : 's') + '.');
        });
        $bar.on('click', '.sb-reset', function () {
            draft = {}; markDirty($bar, 0);
            KP.rails.toast('Changes discarded.', 'warning');
        });
    };

    /* ============================== Agents ============================== */

    A.agents = function ($el) {
        var BO = KP.bo, D = KP.data;
        var PERMS = D.AGENT_PERMISSIONS;

        $el.html(
            '<div class="stat-strip mb-3" id="agStats"></div>'
            + '<div class="strip-dots" data-for="agStats"></div>'

            + '<div class="card p-3 mt-2">'
            + '<div class="section-head"><h2>Agents</h2>'
            + '<div class="d-flex gap-2">'
            + '<button class="btn btn-soft btn-sm" id="resetAgents" title="Restore the seeded list">'
            + '<i class="fas fa-rotate-left"></i></button>'
            + '<button class="btn btn-primary btn-sm" id="addAgent">'
            + '<i class="fas fa-user-plus me-1"></i>Add agent</button></div></div>'
            + '<div class="table-responsive"><table id="agTable" class="table w-100 dt-nowrap"><thead><tr>'
            + '<th>Agent</th><th>Shift</th><th>Permissions</th><th class="text-end">Approvals</th>'
            + '<th class="text-end">Manual</th><th>Risk</th><th>Status</th><th class="text-end"></th>'
            + '</tr></thead><tbody></tbody></table></div></div>'

            + '<div class="card p-3 mt-3"><div class="section-head"><h2>Manual action log</h2></div>'
            + '<p class="text-muted" style="font-size:.8rem">'
            + 'Every bypass of the automated rail, permanently attributed. This is the log you '
            + 'read when something goes wrong — and the one you read weekly so it does not.</p>'
            + '<div id="fullLog"></div></div>'
        );

        var dt = null;

        function riskOf(a) {
            var ratio = a.manualActions / Math.max(1, a.approvals);
            return ratio > 0.10 ? 'high' : ratio > 0.04 ? 'watch' : 'normal';
        }

        function permChips(a) {
            if (!a.perms || !a.perms.length) return '<span class="text-muted" style="font-size:.75rem">None</span>';
            var shown = a.perms.slice(0, 3).map(function (k) {
                var p = PERMS.filter(function (x) { return x.key === k; })[0];
                return '<span class="pill pill-neutral">' + (p ? p.label : k) + '</span>';
            }).join(' ');
            var extra = a.perms.length - 3;
            return shown + (extra > 0 ? ' <span class="pill pill-neutral">+' + extra + '</span>' : '');
        }

        function paintStats() {
            var list = D.agents();
            var active = list.filter(function (a) { return a.status === 'active'; }).length;
            var invited = list.filter(function (a) { return a.status === 'invited'; }).length;
            var suspended = list.filter(function (a) { return a.status === 'suspended'; }).length;
            var morning = list.filter(function (a) { return a.shift === 'morning'; }).length;
            var flagged = list.filter(function (a) { return riskOf(a) !== 'normal'; }).length;
            var manual = list.reduce(function (s, a) { return s + a.manualActions; }, 0);

            $('#agStats').html(
                BO.statTile({ label: 'Agents', value: list.length, icon: 'fa-user-tie', tone: 'blue', note: 'on the platform' })
                + BO.statTile({ label: 'Active', value: active, icon: 'fa-circle-check', tone: 'green', note: 'able to approve' })
                + BO.statTile({ label: 'Awaiting setup', value: invited, icon: 'fa-envelope', tone: 'amber', note: 'invited, not signed in' })
                + BO.statTile({ label: 'Suspended', value: suspended, icon: 'fa-ban', tone: 'red', note: 'access revoked' })
                + BO.statTile({ label: 'Shift split', value: morning + ' / ' + (list.length - morning), icon: 'fa-clock', tone: 'purple', note: 'morning / night' })
                + BO.statTile({ label: 'Manual actions', value: manual, icon: 'fa-hand', tone: 'amber',
                    note: flagged ? flagged + ' agent' + (flagged === 1 ? '' : 's') + ' above tolerance' : 'all within tolerance' })
            );
            BO.stripDots('#agStats');
        }

        function paint() {
            paintStats();
            var data = D.agents().map(function (a) {
                var risk = riskOf(a);
                var riskPill = risk === 'high' ? 'pill-failed' : risk === 'watch' ? 'pill-pending' : 'pill-success';
                var ratio = a.manualActions / Math.max(1, a.approvals);
                return [
                    '<div class="d-flex align-items-center gap-2">'
                        + '<img src="../images/' + a.avatar + '" class="rounded-circle" width="30" height="30" alt="">'
                        + '<div style="line-height:1.25"><div class="t-strong">' + a.name + '</div>'
                        + '<div class="t-mono">' + a.id + ' · ' + a.email + '</div></div></div>',
                    '<span class="pill pill-neutral"><i class="fas fa-'
                        + (a.shift === 'morning' ? 'sun' : 'moon') + '"></i>' + a.shift + '</span>',
                    permChips(a),
                    '<span class="t-strong">' + a.approvals + '</span>',
                    '<span class="t-strong">' + a.manualActions
                        + ' <span class="t-mono">(' + (ratio * 100).toFixed(1) + '%)</span></span>',
                    '<span class="pill ' + riskPill + '">' + risk + '</span>',
                    BO.pill(a.status),
                    '<div class="dropdown" data-ref="' + a.id + '">'
                        + '<button class="icon-btn" data-bs-toggle="dropdown"><i class="fas fa-ellipsis"></i></button>'
                        + '<ul class="dropdown-menu dropdown-menu-end p-2">'
                        + '<li><a class="dropdown-item ag-edit" href="#"><i class="fas fa-pen me-2"></i>Edit agent</a></li>'
                        + '<li><a class="dropdown-item ag-shift" href="#"><i class="fas fa-clock me-2"></i>Switch to '
                        + (a.shift === 'morning' ? 'night' : 'morning') + ' shift</a></li>'
                        + '<li><a class="dropdown-item ag-log" href="#"><i class="fas fa-list me-2"></i>Action log</a></li>'
                        + (a.status === 'invited'
                            ? '<li><a class="dropdown-item ag-resend" href="#"><i class="fas fa-paper-plane me-2"></i>Resend invite</a></li>'
                            : '')
                        + '<li><hr class="dropdown-divider"></li>'
                        + '<li><a class="dropdown-item ' + (a.status === 'suspended' ? '' : 'text-danger') + ' ag-toggle" href="#">'
                        + '<i class="fas fa-' + (a.status === 'suspended' ? 'circle-check' : 'ban') + ' me-2"></i>'
                        + (a.status === 'suspended' ? 'Reinstate' : 'Suspend') + '</a></li>'
                        + '<li><a class="dropdown-item text-danger ag-remove" href="#">'
                        + '<i class="fas fa-trash me-2"></i>Remove</a></li>'
                        + '</ul></div>'
                ];
            });

            if (dt) { dt.clear(); dt.rows.add(data); dt.draw(false); return; }
            dt = $('#agTable').DataTable({
                data: data, autoWidth: false, responsive: true, order: [], pageLength: 10,
                lengthChange: false,
                columnDefs: [
                    { targets: [3, 4, 7], className: 'text-end' },
                    { targets: 7, orderable: false },
                    { targets: 0, responsivePriority: 1 },
                    { targets: 6, responsivePriority: 2 },
                    { targets: 7, responsivePriority: 3 }
                ],
                language: {
                    search: '', searchPlaceholder: 'Search agents…',
                    info: '_START_–_END_ of _TOTAL_', infoEmpty: 'No agents',
                    emptyTable: '<div class="empty-state"><i class="fas fa-user-tie"></i>'
                        + '<p>No agents yet. Add one to start clearing queues.</p></div>',
                    paginate: { previous: '<i class="fas fa-chevron-left"></i>', next: '<i class="fas fa-chevron-right"></i>' }
                }
            });
        }

        function agentOf(el) {
            var id = $(el).closest('[data-ref]').data('ref');
            return D.agents().filter(function (a) { return a.id === id; })[0];
        }

        /* ---------------- create / edit form ---------------- */

        function formHtml(a) {
            var perms = a ? a.perms : D.AGENT_PERMISSIONS
                .filter(function (p) { return ['kyc', 'deposits', 'withdrawals', 'support'].indexOf(p.key) > -1; })
                .map(function (p) { return p.key; });
            return '<div class="row g-2">'
                + '<div class="col-sm-6"><label class="form-label">Full name <span class="text-danger">*</span></label>'
                + '<input class="form-control" id="agName" value="' + (a ? a.name : '') + '" placeholder="Amaka Chinwe"></div>'
                + '<div class="col-sm-6"><label class="form-label">Work email <span class="text-danger">*</span></label>'
                + '<input type="email" class="form-control" id="agEmail" value="' + (a ? a.email : '') + '" '
                + 'placeholder="amaka@kaastropay.com"></div></div>'

                + '<label class="form-label mt-3">Phone number</label>'
                + '<input class="form-control" id="agPhone" value="' + (a ? (a.phone || '') : '') + '" placeholder="+234 803 000 0000">'

                + '<label class="form-label mt-3">Shift</label>'
                + '<div class="seg w-100 mb-1" id="agShift" style="display:flex">'
                + '<button class="flex-grow-1' + (!a || a.shift === 'morning' ? ' active' : '') + '" data-s="morning">'
                + '<i class="fas fa-sun me-1"></i>Morning · 8AM–8PM</button>'
                + '<button class="flex-grow-1' + (a && a.shift === 'night' ? ' active' : '') + '" data-s="night">'
                + '<i class="fas fa-moon me-1"></i>Night · 8PM–8AM</button></div>'
                + '<div class="form-text mb-3">Approvals are disabled outside the assigned window.</div>'

                + '<label class="form-label">Permissions</label>'
                + '<div class="d-grid gap-1 mb-2">'
                + PERMS.map(function (p) {
                    return '<label class="perm-row">'
                        + '<input class="form-check-input mt-0 ag-perm" type="checkbox" value="' + p.key + '"'
                        + (perms.indexOf(p.key) > -1 ? ' checked' : '') + '>'
                        + '<span class="min-w-0"><span class="perm-label">' + p.label + '</span>'
                        + '<span class="perm-desc">' + p.desc + '</span></span></label>';
                }).join('')
                + '</div>'
                + '<div class="k-alert k-warn mb-3"><i class="fas fa-triangle-exclamation"></i><div>'
                + '<b class="hd">Manual confirmation is the sensitive one.</b>It lets an agent credit a balance '
                + 'without the automated rail. Grant it only to people you would trust with a cash drawer.</div></div>'

                + '<label class="form-label">Daily manual-action cap</label>'
                + '<div class="input-group mb-1" style="max-width:200px">'
                + '<input type="number" class="form-control" id="agCap" min="0" value="' + (a ? a.dailyCap : 10) + '">'
                + '<span class="input-group-text">per shift</span></div>'
                + '<div class="form-text">Hard stop on how many times this agent can bypass the rail in one shift.</div>';
        }

        function openForm(a) {
            var editing = !!a;
            KP.showModal(editing ? 'Edit agent' : 'Add an agent',
                formHtml(a)
                + (editing ? '' :
                    '<div class="k-alert k-info mt-3"><i class="fas fa-envelope"></i><div>'
                    + '<b class="hd">They get an invitation by email.</b>The account stays in <b>Awaiting setup</b> '
                    + 'until they set a password and enrol two-factor. Nothing can be approved before that.</div></div>')
                + '<div class="d-flex gap-2 mt-3">'
                + '<button class="btn btn-soft flex-grow-1" data-bs-dismiss="modal">Cancel</button>'
                + '<button class="btn btn-primary flex-grow-1" id="agSave">'
                + '<i class="fas fa-' + (editing ? 'floppy-disk' : 'paper-plane') + ' me-1"></i>'
                + (editing ? 'Save changes' : 'Send invitation') + '</button></div>',
                'modal-lg');

            $('#boModal').data('editing', editing ? a.id : null);
        }

        $(document).on('click', '#agShift button', function (e) {
            e.preventDefault();
            $('#agShift button').removeClass('active');
            $(this).addClass('active');
        });

        $(document).on('click', '#agSave', function () {
            var name = ($('#agName').val() || '').trim();
            var email = ($('#agEmail').val() || '').trim();
            var perms = $('.ag-perm:checked').map(function () { return this.value; }).get();
            var id = $('#boModal').data('editing');

            if (name.length < 3) { KP.rails.toast('Enter the agent\'s full name.', 'danger'); return; }
            if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
                KP.rails.toast('Enter a valid work email address.', 'danger'); return;
            }
            var clash = D.agents().filter(function (a) {
                return a.email.toLowerCase() === email.toLowerCase() && a.id !== id;
            })[0];
            if (clash) { KP.rails.toast('That email already belongs to ' + clash.name + '.', 'danger'); return; }
            if (!perms.length) { KP.rails.toast('Give the agent at least one permission.', 'danger'); return; }

            var spec = {
                name: name, email: email,
                phone: ($('#agPhone').val() || '').trim(),
                shift: $('#agShift button.active').data('s') || 'morning',
                perms: perms,
                dailyCap: parseInt($('#agCap').val(), 10) || 0,
                addedBy: 'Admin User'
            };

            if (id) {
                D.updateAgent(id, spec);
                KP.rails.toast('Saved changes to ' + name + '.');
            } else {
                var created = D.addAgent(spec);
                KP.rails.toast('Invitation sent to ' + email + '. ' + created.id + ' is awaiting setup.');
            }
            bootstrap.Modal.getInstance(document.getElementById('boModal')).hide();
            paint();
        });

        $('#addAgent').on('click', function () { openForm(null); });

        $('#agTable').on('click', '.ag-edit', function (e) {
            e.preventDefault();
            openForm(agentOf(this));
        });

        $('#agTable').on('click', '.ag-shift', function (e) {
            e.preventDefault();
            var a = agentOf(this); if (!a) return;
            var next = a.shift === 'morning' ? 'night' : 'morning';
            D.updateAgent(a.id, { shift: next });
            KP.rails.toast(a.name + ' moved to the ' + next + ' shift.');
            paint();
        });

        $('#agTable').on('click', '.ag-toggle', function (e) {
            e.preventDefault();
            var a = agentOf(this); if (!a) return;
            var next = a.status === 'suspended' ? 'active' : 'suspended';
            D.updateAgent(a.id, { status: next });
            KP.rails.toast(next === 'suspended'
                ? a.name + ' is suspended. They cannot approve anything.'
                : a.name + ' is reinstated.', next === 'suspended' ? 'warning' : 'dark');
            paint();
        });

        $('#agTable').on('click', '.ag-resend', function (e) {
            e.preventDefault();
            var a = agentOf(this); if (!a) return;
            KP.rails.toast('Invitation resent to ' + a.email + '.');
        });

        $('#agTable').on('click', '.ag-remove', function (e) {
            e.preventDefault();
            var a = agentOf(this); if (!a) return;
            KP.showModal('Remove agent',
                '<div class="k-alert k-danger mb-3"><i class="fas fa-triangle-exclamation"></i><div>'
                + '<b class="hd">This revokes access immediately.</b>' + a.name + ' will be signed out of every '
                + 'session. Their past approvals and manual actions stay in the log — those records '
                + 'are never removed.</div></div>'
                + '<div class="summary-rows mb-3">'
                + '<div class="sr"><span>Agent</span><span>' + a.name + '</span></div>'
                + '<div class="sr"><span>ID</span><span>' + a.id + '</span></div>'
                + '<div class="sr"><span>Approvals on record</span><span>' + a.approvals + '</span></div>'
                + '<div class="sr total"><span>Manual actions</span><span>' + a.manualActions + '</span></div></div>'
                + '<div class="d-flex gap-2">'
                + '<button class="btn btn-soft flex-grow-1" data-bs-dismiss="modal">Cancel</button>'
                + '<button class="btn btn-primary flex-grow-1" id="agConfirmRemove" '
                + 'style="background:#dc2626;border-color:#dc2626" data-id="' + a.id + '">'
                + 'Remove ' + a.name + '</button></div>');
        });

        $(document).on('click', '#agConfirmRemove', function () {
            var id = $(this).data('id');
            var a = D.agents().filter(function (x) { return x.id === id; })[0];
            D.removeAgent(id);
            bootstrap.Modal.getInstance(document.getElementById('boModal')).hide();
            KP.rails.toast((a ? a.name : 'Agent') + ' removed. Access revoked.', 'warning');
            paint();
        });

        $('#agTable').on('click', '.ag-log', function (e) {
            e.preventDefault();
            var a = agentOf(this); if (!a) return;
            var mine = KP.rails.manual.log().filter(function (l) { return l.actor === a.name; });
            KP.showModal(a.name + ' · action log',
                '<div class="rv-group">'
                + KP.review.field('Agent', a.name)
                + KP.review.field('ID', a.id, { mono: true })
                + KP.review.field('Email', a.email)
                + KP.review.field('Shift', a.shift, { nocopy: true })
                + KP.review.field('Approvals', String(a.approvals), { nocopy: true })
                + KP.review.field('Manual actions', String(a.manualActions), { nocopy: true })
                + KP.review.field('Daily cap', a.dailyCap + ' per shift', { nocopy: true })
                + KP.review.field('Added', a.added + ' by ' + a.addedBy, { nocopy: true })
                + '</div>'
                + '<div class="rv-title mt-3">Permissions</div>'
                + '<div class="d-flex flex-wrap gap-1 mb-3">'
                + (a.perms || []).map(function (k) {
                    var p = PERMS.filter(function (x) { return x.key === k; })[0];
                    return '<span class="pill pill-success">' + (p ? p.label : k) + '</span>';
                }).join('')
                + '</div>'
                + '<div class="rv-title">Manual confirmations in this browser</div>'
                + (mine.length
                    ? '<div class="table-wrap"><table class="k-table" style="min-width:0"><thead><tr>'
                      + '<th>Reference</th><th>Action</th><th>Amount</th><th class="text-end">When</th>'
                      + '</tr></thead><tbody>'
                      + mine.map(function (l) {
                          return '<tr><td class="t-strong">' + l.ref + '</td><td>' + l.what + '</td>'
                              + '<td class="t-strong">' + l.amount + '</td>'
                              + '<td class="text-end t-mono">' + l.at + '</td></tr>';
                        }).join('') + '</tbody></table></div>'
                    : '<div class="empty-state py-3"><i class="fas fa-hand"></i>'
                      + '<p>No manual confirmations recorded for this agent yet.</p></div>'),
                'modal-lg');
        });

        $('#resetAgents').on('click', function () {
            D.resetAgents();
            KP.rails.toast('Agent list restored to the seeded four.');
            paint();
        });

        function paintLog() {
            var log = KP.rails.manual.log();
            $('#fullLog').html(log.length
                ? '<div class="table-wrap"><table class="k-table"><thead><tr>'
                  + '<th>Reference</th><th>Action</th><th>Amount</th><th>Agent</th>'
                  + '<th>Co-signed by</th><th>Reason</th><th class="text-end">When</th></tr></thead><tbody>'
                  + log.map(function (e) {
                      return '<tr><td class="t-strong">' + e.ref + '</td><td>' + e.what + '</td>'
                          + '<td class="t-strong">' + e.amount + '</td><td>' + e.actor + '</td>'
                          + '<td>' + (e.approver || '<span class="text-muted">—</span>') + '</td>'
                          + '<td class="t-mono" style="max-width:220px">' + e.reason + '</td>'
                          + '<td class="text-end t-mono">' + e.at + '</td></tr>';
                  }).join('') + '</tbody></table></div>'
                : '<div class="empty-state"><i class="fas fa-hand"></i>'
                  + '<p>No manual confirmations yet. Confirm one from a queue to see it here.</p></div>');
        }

        paint();
        paintLog();
    };

    /* ============================= Reports ============================= */

    A.reports = function ($el) {
        var F = KP.fmt, BO = KP.bo, D = KP.data;

        /* One flat, date-stamped set so the range filter has something real
           to work against. daysAgo is relative to the fixed reference date. */
        var REF = D.REF;
        function dateOf(daysAgo) {
            var d = new Date(REF.getTime());
            d.setDate(d.getDate() - daysAgo);
            return d;
        }
        function iso(d) { return d.toISOString().slice(0, 10); }

        var ALL = [];
        D.CRYPTO_DEPOSITS.forEach(function (r) { ALL.push({ ref: r.ref, type: 'Crypto deposit', group: 'deposit', user: r.user, detail: F.crypto(r.amount, r.asset) + ' · ' + r.network, usd: r.usdValue, status: r.status, d: dateOf(r.daysAgo), date: r.date }); });
        D.FIAT_DEPOSITS.forEach(function (r) { ALL.push({ ref: r.ref, type: 'Cash deposit', group: 'deposit', user: r.user, detail: F.fiat(r.amount, r.currency) + ' · ' + r.source, usd: r.amount / (KP.USD_RATE[r.currency] || 1), status: r.status, d: dateOf(r.daysAgo), date: r.date }); });
        D.TRADES.forEach(function (r) { ALL.push({ ref: r.ref, type: r.kind.charAt(0).toUpperCase() + r.kind.slice(1), group: r.kind, user: r.user, detail: r.from + ' → ' + r.to, usd: r.usdValue, status: r.status, d: dateOf(r.daysAgo), date: r.date, margin: r.marginEarnedUsd }); });
        D.FIAT_WITHDRAWALS.forEach(function (r) { ALL.push({ ref: r.ref, type: 'Cash payout', group: 'withdrawal', user: r.user, detail: F.fiat(r.amount, r.currency) + ' → ' + r.destination, usd: r.amount / (KP.USD_RATE[r.currency] || 1), status: r.status, d: dateOf(r.daysAgo), date: r.date }); });
        D.CRYPTO_WITHDRAWALS.forEach(function (r) { ALL.push({ ref: r.ref, type: 'Crypto send', group: 'withdrawal', user: r.user, detail: F.crypto(r.amount, r.asset) + ' · ' + r.network, usd: r.usdValue, status: r.status, d: dateOf(r.daysAgo), date: r.date }); });

        var TYPES = [
            ['deposit', 'Deposits'], ['buy', 'Buys'], ['sell', 'Sells'],
            ['swap', 'Swaps'], ['withdrawal', 'Withdrawals']
        ];

        var oldest = ALL.reduce(function (m, r) { return r.d < m ? r.d : m; }, ALL[0].d);

        $el.html(
            '<div class="card p-3 p-md-4 mb-3">'
            + '<div class="section-head"><h2>Report period</h2>'
            + '<div class="seg" id="quickRange">'
            + '<button data-d="7">7d</button><button class="active" data-d="30">30d</button>'
            + '<button data-d="90">90d</button><button data-d="0">All</button></div></div>'
            + '<div class="range-bar mb-3">'
            + '<div class="rb-field"><label>From</label>'
            + '<input type="date" class="form-control" id="fromDate"></div>'
            + '<div class="rb-field"><label>To</label>'
            + '<input type="date" class="form-control" id="toDate"></div>'
            + '<div class="rb-field"><label>Status</label>'
            + '<select class="form-select" id="statusSel">'
            + '<option value="">All statuses</option><option>successful</option>'
            + '<option>pending</option><option>processing</option><option>failed</option>'
            + '<option>rejected</option><option>confirming</option></select></div>'
            + '<div class="rb-field"><label>Country</label>'
            + '<select class="form-select" id="countrySel"><option value="">All countries</option>'
            + KP.COUNTRY_LIST.map(function (c) { return '<option value="' + c.code + '">' + c.flag + ' ' + c.name + '</option>'; }).join('')
            + '</select></div></div>'
            + '<label class="form-label">Transaction types</label>'
            + '<div class="filterbar mb-3" id="typePicks"></div>'
            + '<div class="d-flex flex-wrap gap-2">'
            + '<button class="btn btn-primary" id="runBtn"><i class="fas fa-filter me-1"></i>Apply</button>'
            + '<button class="btn btn-soft" id="csvBtn"><i class="fas fa-file-csv me-1"></i>Export CSV</button>'
            + '<button class="btn btn-soft" id="jsonBtn"><i class="fas fa-file-code me-1"></i>Export JSON</button>'
            + '<span class="ms-auto align-self-center small text-muted" id="matchCount"></span>'
            + '</div></div>'

            + '<div class="stat-strip mb-3" id="rStats"></div>'
            + '<div class="strip-dots" data-for="rStats"></div>'

            + '<div class="row g-3 mt-0">'
            + '<div class="col-lg-8"><div class="card p-3 p-md-4">'
            + '<div class="section-head"><h2>Volume over the period</h2></div>'
            + '<canvas id="repChart" height="200"></canvas></div></div>'
            + '<div class="col-lg-4"><div class="card p-3 p-md-4 h-100">'
            + '<div class="section-head"><h2>By type</h2></div><div id="byType"></div></div></div>'
            + '</div>'

            + '<div class="card p-3 mt-3">'
            + '<div class="section-head"><h2>Matching transactions</h2>'
            + '<span class="small text-muted">exported exactly as filtered</span></div>'
            + '<div class="table-responsive"><table id="repTable" class="table w-100 dt-nowrap"><thead><tr>'
            + '<th>Reference</th><th>Type</th><th>User</th><th>Detail</th>'
            + '<th class="text-end">USD</th><th>Status</th><th>Date</th></tr></thead><tbody></tbody></table></div>'
            + '</div>'
        );

        var picked = TYPES.map(function (t) { return t[0]; });
        function paintTypes() {
            $('#typePicks').html(
                '<button class="chip-btn' + (picked.length === TYPES.length ? ' active' : '') + '" data-all="1">All types</button>'
                + TYPES.map(function (t) {
                    return '<button class="chip-btn' + (picked.indexOf(t[0]) > -1 ? ' active' : '') + '" data-t="' + t[0] + '">' + t[1] + '</button>';
                }).join(''));
        }
        paintTypes();

        $('#typePicks').on('click', '.chip-btn', function () {
            if ($(this).data('all')) {
                picked = picked.length === TYPES.length ? [] : TYPES.map(function (t) { return t[0]; });
            } else {
                var t = $(this).data('t');
                var i = picked.indexOf(t);
                if (i > -1) picked.splice(i, 1); else picked.push(t);
            }
            paintTypes(); run();
        });

        function setRange(days) {
            var to = new Date(REF.getTime());
            var from = days ? new Date(REF.getTime() - days * 86400000) : new Date(oldest.getTime());
            $('#fromDate').val(iso(from));
            $('#toDate').val(iso(to));
        }
        setRange(30);

        $('#quickRange button').on('click', function () {
            $('#quickRange button').removeClass('active');
            $(this).addClass('active');
            setRange(+$(this).data('d'));
            run();
        });
        $('#fromDate, #toDate, #statusSel, #countrySel').on('change', function () {
            $('#quickRange button').removeClass('active');
            run();
        });
        $('#runBtn').on('click', run);

        var dt = null;
        var rows = [];

        function filtered() {
            var from = new Date($('#fromDate').val() + 'T00:00:00');
            var to = new Date($('#toDate').val() + 'T23:59:59');
            var st = $('#statusSel').val();
            var cc = $('#countrySel').val();
            return ALL.filter(function (r) {
                if (picked.indexOf(r.group) === -1) return false;
                if (r.d < from || r.d > to) return false;
                if (st && r.status !== st) return false;
                if (cc && r.user.country !== cc) return false;
                return true;
            }).sort(function (a, b) { return b.d - a.d; });
        }

        function run() {
            rows = filtered();
            $('#matchCount').text(rows.length + ' transaction' + (rows.length === 1 ? '' : 's') + ' match');

            var vol = rows.reduce(function (s, r) { return s + r.usd; }, 0);
            var margin = rows.reduce(function (s, r) { return s + (r.margin || 0); }, 0);
            var ok = rows.filter(function (r) { return r.status === 'successful'; }).length;
            var users = {};
            rows.forEach(function (r) { users[r.user.id] = 1; });

            $('#rStats').html(
                BO.statTile({ label: 'Transactions', value: rows.length, icon: 'fa-list', tone: 'blue', note: 'in this period' })
                + BO.statTile({ label: 'Volume', value: '$' + F.compact(vol), icon: 'fa-chart-simple', tone: 'green', note: 'USD equivalent' })
                + BO.statTile({ label: 'Margin', value: '$' + F.compact(margin), icon: 'fa-sack-dollar', tone: 'amber', note: 'realised on trades' })
                + BO.statTile({ label: 'Success rate', value: rows.length ? (ok / rows.length * 100).toFixed(1) + '%' : '—', icon: 'fa-circle-check', tone: 'green', note: 'settled first time' })
                + BO.statTile({ label: 'Unique users', value: Object.keys(users).length, icon: 'fa-users', tone: 'purple', note: 'transacted at least once' })
                + BO.statTile({ label: 'Average size', value: rows.length ? F.usd(vol / rows.length) : '—', icon: 'fa-scale-balanced', tone: 'blue', note: 'per transaction' })
            );
            BO.stripDots('#rStats');

            /* by type */
            var byT = {};
            rows.forEach(function (r) { byT[r.type] = (byT[r.type] || 0) + r.usd; });
            var maxT = Math.max.apply(null, Object.keys(byT).map(function (k) { return byT[k]; })) || 1;
            $('#byType').html(Object.keys(byT).length
                ? Object.keys(byT).sort(function (a, b) { return byT[b] - byT[a]; }).map(function (k) {
                    return '<div class="py-2"><div class="d-flex justify-content-between mb-1">'
                        + '<span style="font-size:.83rem;font-weight:700">' + k + '</span>'
                        + '<span class="t-mono">' + F.usd(byT[k]) + '</span></div>'
                        + '<div class="progress" style="height:5px"><div class="progress-bar" style="width:'
                        + (byT[k] / maxT * 100) + '%;background:var(--primary-color)"></div></div></div>';
                }).join('')
                : '<div class="empty-state py-3"><i class="fas fa-chart-pie"></i><p>Nothing in this period.</p></div>');

            /* daily volume chart */
            var days = {}, labels = [], values = [];
            rows.forEach(function (r) {
                var k = iso(r.d);
                days[k] = (days[k] || 0) + r.usd;
            });
            Object.keys(days).sort().forEach(function (k) {
                labels.push(k.slice(5));
                values.push(Math.round(days[k]));
            });
            if (!labels.length) { labels = ['—']; values = [0]; }
            BO.barChart(document.getElementById('repChart'), labels.slice(-14), values.slice(-14), '#10b981');

            /* table */
            var data = rows.map(function (r) {
                return ['<span class="t-strong">' + r.ref + '</span>', r.type,
                    '<span class="t-strong">' + r.user.name + '</span>',
                    '<span class="t-mono">' + r.detail + '</span>',
                    '<span class="t-strong">' + F.usd(r.usd) + '</span>',
                    BO.pill(r.status), '<span class="t-mono">' + r.date + '</span>'];
            });
            if (dt) { dt.clear(); dt.rows.add(data); dt.draw(false); return; }
            dt = $('#repTable').DataTable({
                data: data, autoWidth: false, responsive: true, order: [], pageLength: 10,
                lengthMenu: [10, 25, 50, 100],
                columnDefs: [{ targets: 4, className: 'text-end' }],
                language: {
                    search: '', searchPlaceholder: 'Search results…',
                    lengthMenu: '_MENU_ per page', info: '_START_–_END_ of _TOTAL_',
                    infoEmpty: 'Nothing here',
                    zeroRecords: '<div class="empty-state"><i class="fas fa-filter"></i><p>No transactions match these filters.</p></div>',
                    emptyTable: '<div class="empty-state"><i class="fas fa-filter"></i><p>No transactions match these filters.</p></div>',
                    paginate: { previous: '<i class="fas fa-chevron-left"></i>', next: '<i class="fas fa-chevron-right"></i>' }
                }
            });
        }

        function download(name, text, mime) {
            var blob = new Blob([text], { type: mime });
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url; a.download = name;
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            setTimeout(function () { URL.revokeObjectURL(url); }, 3000);
            KP.rails.toast('Exported ' + rows.length + ' transactions as ' + name);
        }

        function stamp() {
            return $('#fromDate').val() + '_to_' + $('#toDate').val();
        }

        $('#csvBtn').on('click', function () {
            var head = ['Reference', 'Type', 'User', 'User ID', 'Country', 'Detail', 'USD value', 'Status', 'Date'];
            var lines = [head.join(',')].concat(rows.map(function (r) {
                return [r.ref, r.type, r.user.name, r.user.id, r.user.country, r.detail,
                        r.usd.toFixed(2), r.status, r.date]
                    .map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(',');
            }));
            download('kaastro-report_' + stamp() + '.csv', lines.join('\n'), 'text/csv;charset=utf-8');
        });

        $('#jsonBtn').on('click', function () {
            var out = {
                generated: new Date().toISOString(),
                period: { from: $('#fromDate').val(), to: $('#toDate').val() },
                filters: { types: picked, status: $('#statusSel').val() || 'all', country: $('#countrySel').val() || 'all' },
                count: rows.length,
                transactions: rows.map(function (r) {
                    return { ref: r.ref, type: r.type, user: r.user.name, userId: r.user.id,
                        country: r.user.country, detail: r.detail, usdValue: +r.usd.toFixed(2),
                        status: r.status, date: r.date };
                })
            };
            download('kaastro-report_' + stamp() + '.json', JSON.stringify(out, null, 2), 'application/json');
        });

        run();
        $(window).on('resize', function () { if (rows.length) run(); });
    };

    /* ============================= Settings ============================= */

    /* ===================== Escalations (admin only) =====================
       The other end of an agent's escalate button. An admin sees what was
       raised, by whom, what evidence came with it, and decides. Approving is
       the admin doing the manual confirmation the agent would not; declining
       sends it back with a reason. */

    A.escalations = function ($el) {
        function tone(p) {
            return p === 'urgent' ? 'pill-danger' : p === 'high' ? 'pill-manual' : 'pill-neutral';
        }

        function paint() {
            var all = KP.rails.escalation.all();
            var open = all.filter(function (e) { return e.status === 'open'; });
            var done = all.filter(function (e) { return e.status !== 'open'; });

            $el.html(
                '<div class="section-head"><h2>Escalations from agents</h2>'
                + '<span class="small text-muted">' + open.length + ' open</span></div>'
                + (open.length
                    ? open.map(function (e) {
                        return '<div class="asset-row align-items-start" style="gap:.7rem">'
                            + '<div class="qa-icon qa-amber qa-warn sm"><i class="fas fa-arrow-up-right-dots"></i></div>'
                            + '<div class="flex-grow-1 min-w-0">'
                            + '<div class="ar-name">' + e.what + ' &middot; ' + e.amount
                                + (e.amountOriginal ? ' <span class="pill pill-warn" title="Originally ' + e.amountOriginal + '">corrected</span>' : '') + '</div>'
                            + '<div class="ar-sub">' + e.id + ' &middot; ' + e.ref
                            + ' &middot; ' + e.who + '</div>'
                            + '<div class="ar-sub mt-1"><b>' + e.reason + '</b></div>'
                            + '<div class="ar-sub">' + e.notes + '</div>'
                            + '<div class="ar-sub mt-1">Raised by ' + e.raisedBy + ' &middot; ' + e.raisedAt
                            + (e.evidence && e.evidence.length
                                ? ' &middot; <i class="fas fa-paperclip"></i> ' + e.evidence.length
                                  + ' file' + (e.evidence.length > 1 ? 's' : '')
                                : ' &middot; no evidence attached') + '</div>'
                            + '<div class="mt-2 d-flex gap-1 flex-wrap">'
                            + '<button class="btn btn-sm btn-primary esc-ok" data-id="' + e.id + '">'
                            + 'Approve &amp; credit</button>'
                            + '<button class="btn btn-sm btn-soft text-danger esc-no" data-id="' + e.id + '">'
                            + 'Decline</button>'
                            /* Only deposits. A deposit amount is what actually
                               arrived and is the thing that gets mis-recorded;
                               a withdrawal amount is what the user asked for,
                               and quietly changing that is a different act. */
                            + (/deposit/.test(e.kind || '')
                                ? '<button class="btn btn-sm btn-soft esc-amt" data-id="' + e.id + '">'
                                  + '<i class="fas fa-pen me-1"></i>Edit amount</button>' : '')
                            + '</div></div>'
                            + '<span class="pill ' + tone(e.priority) + '">' + e.priority + '</span>'
                            + '</div>';
                    }).join('')
                    : '<div class="empty-state"><i class="fas fa-inbox"></i>'
                      + '<p>No escalations waiting. Agents are deciding on their own.</p></div>')

                + (done.length
                    ? '<div class="section-head mt-3"><h2>Recently decided</h2></div>'
                      + done.slice(0, 5).map(function (e) {
                        return '<div class="asset-row">'
                            + '<div class="qa-icon ' + (e.status === 'approved' ? 'qa-green' : 'qa-red') + ' sm">'
                            + '<i class="fas ' + (e.status === 'approved' ? 'fa-check' : 'fa-xmark') + '"></i></div>'
                            + '<div class="flex-grow-1 min-w-0"><div class="ar-name">'
                            + e.what + ' &middot; ' + e.amount + '</div>'
                            + '<div class="ar-sub">' + e.id + ' &middot; ' + e.status + ' by '
                            + e.decidedBy + ' &middot; ' + e.decidedAt + '</div></div></div>';
                    }).join('')
                    : '')
            );
        }

        /* Correcting the recorded amount before deciding. The original is kept
           and shown, so an approval never looks like it was for a figure the
           agent raised when it was not. */
        $el.off('click.escamt').on('click.escamt', '.esc-amt', function () {
            var id = $(this).data('id');
            var e = KP.rails.escalation.all().filter(function (x) { return x.id === id; })[0];
            if (!e) return;
            var p = KP.rails.escalation.amountParts(e.amount);
            if (!p) { KP.rails.toast('That amount cannot be parsed.', 'danger'); return; }

            KP.rails.sheet('Correct the deposit amount',
                '<div class="summary-rows mb-3">'
                + '<div class="sr"><span>Reference</span><span>' + e.ref + '</span></div>'
                + '<div class="sr"><span>User</span><span>' + e.who + '</span></div>'
                + '<div class="sr total"><span>' + (e.amountOriginal ? 'Originally raised as' : 'Raised as')
                + '</span><span>' + (e.amountOriginal || e.amount) + '</span></div></div>'
                + (e.amountOriginal
                    ? '<div class="k-alert k-warn mb-3"><i class="fas fa-clock-rotate-left"></i><div>'
                      + 'Already corrected to <b>' + e.amount + '</b> by ' + e.amountEditedBy
                      + ' on ' + e.amountEditedAt + '.</div></div>' : '')
                + '<label class="form-label">Amount that actually arrived</label>'
                + '<div class="input-group mb-1">'
                + (p.prefix ? '<span class="input-group-text">' + p.prefix + '</span>' : '')
                + '<input class="form-control" id="escAmtV" inputmode="decimal" value="' + p.value + '">'
                + (p.suffix ? '<span class="input-group-text">' + p.suffix.trim() + '</span>' : '')
                + '</div>'
                + '<div class="form-text mb-3">What the statement or explorer shows, not what was reported.</div>'
                + '<label class="form-label">What are you correcting it against?</label>'
                + '<textarea class="form-control mb-3" id="escAmtNote" rows="2" '
                + 'placeholder="e.g. bank statement line, explorer transaction value"></textarea>'
                + '<button class="btn btn-primary w-100" data-escamt="' + id + '">Save corrected amount</button>');
        });

        $(document).off('click.escamtsave').on('click.escamtsave', '[data-escamt]', function () {
            var v = parseFloat(($('#escAmtV').val() || '').replace(/,/g, ''));
            var note = ($('#escAmtNote').val() || '').trim();
            if (isNaN(v) || v <= 0) { KP.rails.toast('Enter the amount that arrived.', 'danger'); return; }
            if (!note) { KP.rails.toast('Say what you are correcting it against.', 'danger'); return; }
            var e = KP.rails.escalation.setAmount($(this).data('escamt'), v, 'Admin User', note);
            KP.rails.closeSheet();
            KP.rails.toast('Amount corrected to ' + (e ? e.amount : v) + '.', 'success');
            paint();
        });

        $el.off('click.esc').on('click.esc', '.esc-ok, .esc-no', function () {
            var id = $(this).data('id');
            var ok = $(this).hasClass('esc-ok');
            KP.rails.sheet(ok ? 'Approve this escalation?' : 'Decline this escalation?',
                '<p class="text-muted" style="font-size:.83rem">'
                + (ok ? 'You are confirming the movement the agent would not. It is logged '
                      + 'against your name, not theirs.'
                      : 'It goes back to the agent with your reason. Nothing is credited.')
                + '</p>'
                + '<label class="form-label">Note to the agent</label>'
                + '<textarea class="form-control mb-3" id="escNote" rows="2" '
                + 'placeholder="' + (ok ? 'What convinced you.' : 'What is still missing.') + '"></textarea>'
                + '<button class="btn ' + (ok ? 'btn-primary' : 'btn-danger') + ' w-100" '
                + 'data-escdo="' + id + '" data-escok="' + (ok ? '1' : '') + '">'
                + (ok ? 'Approve and credit' : 'Decline') + '</button>');
        });

        $(document).off('click.escdo').on('click.escdo', '[data-escdo]', function () {
            var ok = $(this).data('escok') === 1 || $(this).data('escok') === '1';
            KP.rails.escalation.resolve($(this).data('escdo'),
                ok ? 'approved' : 'declined', 'Admin User', ($('#escNote').val() || '').trim());
            KP.rails.closeSheet();
            KP.rails.toast(ok ? 'Approved and credited. Logged against your name.'
                              : 'Declined and sent back to the agent.', ok ? 'success' : 'warning');
            paint();
        });

        paint();
    };

    A.settings = function ($el, role) {
        var actor = role === 'admin' ? 'Admin User' : 'James Bond';
        /* The signed-in agent's own record, so this page shows a real profile
           instead of a hardcoded name. Admins have no agent record. */
        var agent = role === 'agent' ? KP.rails.myAgent() : null;
        if (agent) actor = agent.name;

        $el.html('<div class="row g-3">'
            + '<div class="col-lg-7">'
            + '<div class="card p-3 p-md-4">'
            + '<div class="d-flex align-items-start gap-2 mb-2">'
            + '<div class="qa-icon qa-red"><i class="fas fa-power-off"></i></div>'
            + '<div class="flex-grow-1 min-w-0"><h2 class="card-title mb-1">Platform freeze</h2>'
            + '<p class="text-muted mb-0" style="font-size:.82rem">'
            + 'Halts every withdrawal, buy, sell and swap immediately. Deposits keep working — '
            + 'stopping money coming in helps nobody. Use it when a provider is down or a rate '
            + 'feed is unreliable.</p></div></div>'
            + '<div id="panicBox"></div></div>'

            + '<div class="card p-3 p-md-4 mt-3">'
            + '<div class="section-head"><h2>Maintenance notice</h2></div>'
            + '<p class="text-muted" style="font-size:.82rem">Shown as a banner on every user page.</p>'
            + '<textarea class="form-control mb-2" rows="2" id="maintMsg" '
            + 'placeholder="e.g. Bank payouts are delayed while our provider recovers."></textarea>'
            + '<div class="d-flex gap-2"><button class="btn btn-primary btn-sm" id="setMaint">'
            + '<i class="fas fa-floppy-disk me-1"></i>Publish notice</button>'
            + '<button class="btn btn-soft btn-sm" id="clearMaint">Clear</button></div></div>'

            + (role === 'admin' ? '<div class="card p-3 p-md-4 mt-3">'
                + '<div class="section-head"><h2>Manual confirmation policy</h2></div>'
                + '<p class="text-muted" style="font-size:.82rem">'
                + 'The controls on the fallback rail. Loosening these is the fastest way to create '
                + 'an internal fraud problem.</p>'
                + '<div class="asset-row"><div class="flex-grow-1 min-w-0">'
                + '<div class="ar-name">Second approver threshold</div>'
                + '<div class="ar-sub">Above this, a supervisor must co-sign</div></div>'
                + '<div class="input-group" style="width:150px"><span class="input-group-text">$</span>'
                + '<input class="form-control" value="1000" id="thresh"></div></div>'
                + '<div class="asset-row"><div class="flex-grow-1 min-w-0">'
                + '<div class="ar-name">Evidence required</div>'
                + '<div class="ar-sub">Blocks confirmation without an attachment</div></div>'
                + '<div class="form-check form-switch m-0"><input class="form-check-input" type="checkbox" checked disabled></div></div>'
                + '<div class="asset-row"><div class="flex-grow-1 min-w-0">'
                + '<div class="ar-name">Daily cap per agent</div>'
                + '<div class="ar-sub">Manual actions allowed in one shift</div></div>'
                + '<div class="input-group" style="width:150px"><input class="form-control" value="10"></div></div>'
                + '<button class="btn btn-primary w-100 mt-3" id="savePolicy">'
                + '<i class="fas fa-floppy-disk me-1"></i>Save policy</button>'
                + '</div>' : '')
            + '</div>'

            + '<div class="col-lg-5">'

            /* An agent has a real record behind them — permissions, a shift, a
               manual-action count someone will audit. Show it, rather than the
               two-line placeholder that used to be here. */
            + '<div class="card p-3 p-md-4">'
            + '<div class="section-head"><h2>Your profile</h2></div>'
            + '<div class="d-flex align-items-center gap-3 mb-3">'
            + '<span class="kp-avatar lg ring">'
            + (agent ? '<img src="../images/' + agent.avatar + '" alt="">'
                     : actor.slice(0, 2).toUpperCase())
            + '<span class="av-check"><i class="fas fa-check"></i></span></span>'
            + '<div class="min-w-0"><div class="fw-bold text-truncate" style="font-size:1rem">'
            + (agent ? agent.name : actor) + '</div>'
            + '<div class="text-muted text-truncate" style="font-size:.78rem">'
            + (role === 'admin' ? 'Super admin'
                : 'Support agent' + (agent ? ' · ' + agent.id : '')) + '</div>'
            + (agent ? '<span class="pill ' + (agent.status === 'active' ? 'pill-success' : 'pill-danger')
                + ' mt-1">' + agent.status + '</span>' : '') + '</div></div>'

            + '<div class="summary-rows mb-3">'
            + '<div class="sr"><span>Full name</span><span>' + (agent ? agent.name : actor) + '</span></div>'
            + (agent ? '<div class="sr"><span>Agent ID</span><span>' + agent.id + '</span></div>'
                + '<div class="sr"><span>Email</span><span>' + agent.email + '</span></div>'
                + '<div class="sr"><span>Phone</span><span>' + agent.phone + '</span></div>' : '')
            + '<div class="sr"><span>Role</span><span>'
            + (role === 'admin' ? 'Super admin' : 'Agent') + '</span></div>'
            + (role === 'agent' ? '<div class="sr"><span>Assigned shift</span><span>'
                + KP.rails.shift.LABELS[KP.rails.shift.ASSIGNED] + '</span></div>' : '')
            + (agent ? '<div class="sr"><span>Added</span><span>' + agent.added
                + ' by ' + agent.addedBy + '</span></div>' : '')
            + '<div class="sr total"><span>Two-factor</span><span class="text-up">Enabled</span></div></div>'

            + (agent ? '<div class="row g-2 mb-3">'
                + '<div class="col-4"><div class="card figure-tile">'
                + '<span class="qa-icon qa-green sm"><i class="fas fa-circle-check"></i></span>'
                + '<span class="ft-label">Approvals</span>'
                + '<b class="ft-value">' + agent.approvals + '</b></div></div>'
                + '<div class="col-4"><div class="card figure-tile">'
                + '<span class="qa-icon qa-amber qa-warn sm"><i class="fas fa-hand"></i></span>'
                + '<span class="ft-label">Manual</span>'
                + '<b class="ft-value">' + agent.manualActions + '</b></div></div>'
                + '<div class="col-4"><div class="card figure-tile">'
                + '<span class="qa-icon qa-green sm"><i class="fas fa-gauge-high"></i></span>'
                + '<span class="ft-label">Daily cap</span>'
                + '<b class="ft-value">' + agent.dailyCap + '</b></div></div></div>' : '')

            + '<button class="btn btn-soft w-100" id="editProfile">'
            + '<i class="fas fa-user-pen me-1"></i>Edit contact details</button>'
            + '<button class="btn btn-soft w-100 mt-2">Change password</button></div>'

            + (agent ? '<div class="card p-3 p-md-4 mt-3">'
                + '<div class="section-head"><h2>What you can do</h2></div>'
                + '<p class="text-muted" style="font-size:.8rem">Permissions are set by an '
                + 'admin. Ask one to change them.</p>'
                + KP.data.AGENT_PERMISSIONS.map(function (p) {
                    var on = agent.perms.indexOf(p.key) > -1;
                    return '<div class="asset-row">'
                        + '<div class="qa-icon ' + (on ? 'qa-green' : 'qa-slate') + ' sm">'
                        + '<i class="fas ' + (on ? 'fa-check' : 'fa-xmark') + '"></i></div>'
                        + '<div class="flex-grow-1 min-w-0"><div class="ar-name">' + p.label + '</div>'
                        + '<div class="ar-sub">' + p.desc + '</div></div>'
                        + '<span class="pill ' + (on ? 'pill-success' : 'pill-neutral') + '">'
                        + (on ? 'Allowed' : 'Not allowed') + '</span></div>';
                }).join('') + '</div>' : '')

            + '<div class="card p-3 p-md-4 mt-3"><div class="section-head"><h2>Appearance</h2></div>'
            + '<div class="asset-row"><div class="flex-grow-1 min-w-0">'
            + '<div class="ar-name">Dark mode</div>'
            + '<div class="ar-sub">Follows your choice on every page</div></div>'
            + '<div class="form-check form-switch m-0">'
            + '<input class="form-check-input" type="checkbox" id="themeSwitch"></div></div></div>'
            + '</div></div>');

        $('#editProfile').on('click', function () {
            if (!agent) { KP.rails.toast('Admin contact details are managed in the directory.'); return; }
            KP.rails.sheet('Edit contact details',
                '<p class="text-muted" style="font-size:.83rem">Your name and permissions are '
                + 'set by an admin. You can keep your own contact details current.</p>'
                + '<label class="form-label">Email</label>'
                + '<input class="form-control mb-2" id="apEmail" value="' + agent.email + '">'
                + '<label class="form-label">Phone</label>'
                + '<input class="form-control mb-3" id="apPhone" value="' + agent.phone + '">'
                + '<button class="btn btn-primary w-100" id="apSave">Save details</button>');
        });

        $(document).off('click.apSave').on('click.apSave', '#apSave', function () {
            var email = ($('#apEmail').val() || '').trim();
            var phone = ($('#apPhone').val() || '').trim();
            if (!email || !phone) { KP.rails.toast('Both fields are required.', 'danger'); return; }
            KP.data.updateAgent(agent.id, { email: email, phone: phone });
            KP.rails.closeSheet();
            KP.rails.toast('Contact details updated.');
            A.settings($el, role);
        });

        $('#themeSwitch').prop('checked', KP.rails.theme.current() === 'dark')
            .on('change', function () {
                KP.rails.theme.apply($(this).is(':checked') ? 'dark' : 'light');
            });

        function paintPanic() {
            var active = KP.rails.panic.isActive();
            $('#panicBox').html(
                (active
                    ? '<div class="k-alert k-danger mb-3"><i class="fas fa-triangle-exclamation"></i><div>'
                      + '<b class="hd">Freeze is currently ON.</b>Activated by ' + KP.rails.panic.by()
                      + ' on ' + KP.rails.panic.at() + '.</div></div>'
                    : '<div class="k-alert k-ok mb-3"><i class="fas fa-circle-check"></i><div>'
                      + '<b class="hd">Everything is running normally.</b>Users can withdraw and trade.</div></div>')
                + '<button class="btn ' + (active ? 'btn-soft' : 'btn-primary') + ' w-100" id="panicBtn" '
                + 'style="' + (active ? '' : 'background:#dc2626;border-color:#dc2626') + '">'
                + (active ? 'Lift the freeze' : 'Freeze the platform') + '</button>'
            );
        }
        paintPanic();

        $el.on('click', '#panicBtn', function () {
            var next = !KP.rails.panic.isActive();
            KP.rails.panic.set(next, actor);
            KP.rails.toast(next ? 'Platform frozen. Withdrawals and trading are halted.'
                : 'Freeze lifted. Normal service resumed.', next ? 'danger' : 'dark');
            paintPanic();
        });
        $el.on('click', '#setMaint', function () {
            var v = $('#maintMsg').val().trim();
            KP.rails.toast(v ? 'Notice published to every user page.' : 'Write the notice first.',
                v ? 'dark' : 'danger');
        });
        $el.on('click', '#clearMaint', function () {
            $('#maintMsg').val(''); KP.rails.toast('Notice cleared.');
        });
        $el.on('click', '#savePolicy', function () {
            KP.rails.toast('Manual confirmation policy saved.');
        });
    };

    global.KP = global.KP || {};
    global.KP.adminPages = A;

})(window, jQuery);
