/* ==========================================================================
   Kaastro Pay — shared trade ticket
   Buy, sell and swap are the same interaction with different legs, so they
   share one implementation: amount entry both ways, a live quote with a
   countdown, a fee line, PIN confirmation, and a receipt.

   A displayed rate and a dealable rate are different things. The rate on
   screen is indicative; committing issues a quote that pins rate, margin and
   fee for 30 seconds. The receipt records the quote, not today's price.
   ========================================================================== */
(function (global, $) {
    'use strict';

    function assetOptions(exclude) {
        return KP.ASSET_LIST.filter(function (a) { return a.symbol !== exclude; })
            .map(function (a) {
                return '<li><a class="dropdown-item d-flex align-items-center gap-2 tr-asset" href="#" data-sym="' + a.symbol + '">'
                    + '<span class="asset-icon sm" style="background:' + a.color + '">' + a.symbol.slice(0, 3) + '</span>'
                    + '<span class="flex-grow-1"><b>' + a.symbol + '</b><br><small class="text-muted">' + a.name + '</small></span></a></li>';
            }).join('');
    }

    function sideChip(sym, side, locked) {
        if (sym === '__FIAT__') {
            var C = KP.currentCountry();
            return '<div class="ab-side" style="cursor:default"><span style="font-size:1rem">' + C.flag + '</span>'
                + '<span>' + C.currency + '</span></div>';
        }
        var a = KP.ASSETS[sym];
        return '<div class="dropdown">'
            + '<div class="ab-side" ' + (locked ? 'style="cursor:default"' : 'data-bs-toggle="dropdown"') + ' data-side="' + side + '">'
            + '<span class="asset-icon sm" style="background:' + a.color + '">' + a.symbol.slice(0, 3) + '</span>'
            + '<span>' + a.symbol + '</span>'
            + (locked ? '' : '<i class="fas fa-chevron-down" style="font-size:.55rem"></i>') + '</div>'
            + (locked ? '' : '<ul class="dropdown-menu dropdown-menu-end p-2" data-side="' + side + '" style="max-height:280px;overflow:auto">'
                + assetOptions(null) + '</ul>')
            + '</div>';
    }

    /* mount: jQuery container. kind: 'buy' | 'sell' | 'swap' */
    function mount($el, kind) {
        var C = KP.currentCountry(), F = KP.fmt;

        var state = {
            kind: kind,
            payAsset: kind === 'buy' ? '__FIAT__' : 'USDT',
            getAsset: kind === 'buy' ? 'USDT' : (kind === 'sell' ? '__FIAT__' : 'BTC'),
            payAmount: '',
            lastEdited: 'pay',
            quote: null
        };

        var labels = {
            buy: { pay: 'You pay', get: 'You get', cta: 'Buy', verb: 'Bought' },
            sell: { pay: 'You sell', get: 'You receive', cta: 'Sell', verb: 'Sold' },
            swap: { pay: 'From', get: 'To', cta: 'Swap', verb: 'Swapped' }
        }[kind];

        $el.html(
            '<div class="card p-3 p-md-4">'
            + '<div class="amount-box">'
            + '<div class="d-flex justify-content-between align-items-center">'
            + '<span class="ab-label">' + labels.pay + '</span>'
            + '<span class="small text-muted tr-avail"></span></div>'
            + '<div class="d-flex align-items-center gap-2 mt-1">'
            + '<input type="text" inputmode="decimal" id="trPay" placeholder="0.00" autocomplete="off">'
            + '<span id="trPaySide"></span></div>'
            + '<div class="mt-2"><button class="btn btn-sm btn-soft py-0 px-2 tr-max" style="font-size:.68rem">Max</button></div>'
            + '</div>'
            + '<div class="d-flex justify-content-center" style="margin:-10px 0 -10px">'
            + '<div class="swap-flip" id="trFlip" title="' + (kind === 'swap' ? 'Reverse' : 'Switch direction') + '"><i class="fas fa-arrow-down"></i></div></div>'
            + '<div class="amount-box">'
            + '<div class="d-flex justify-content-between align-items-center">'
            + '<span class="ab-label">' + labels.get + '</span>'
            + '<span class="small text-muted" id="trQuoteTimer"></span></div>'
            + '<div class="d-flex align-items-center gap-2 mt-1">'
            + '<input type="text" inputmode="decimal" id="trGet" placeholder="0.00" autocomplete="off">'
            + '<span id="trGetSide"></span></div></div>'
            + '<div class="summary-rows mt-3" id="trSummary"></div>'
            + '<div id="trGuard" class="mt-3"></div>'
            + '<button class="btn btn-primary w-100 mt-3 kp-submit" id="trGo" disabled>' + labels.cta + '</button>'
            + '<p class="text-muted text-center mt-2 mb-0" style="font-size:.72rem">'
            + '<i class="fas fa-lock me-1"></i>Confirmed with your transaction PIN</p>'
            + '</div>'
        );

        function isFiat(s) { return s === '__FIAT__'; }

        /* One unit of pay asset, expressed in get asset, after margin. */
        function unitRate() {
            if (state.kind === 'buy') return 1 / KP.rates.buyRate(state.getAsset, C.currency);
            if (state.kind === 'sell') return KP.rates.sellRate(state.payAsset, C.currency);
            return KP.rates.swapRate(state.payAsset, state.getAsset, C.currency);
        }

        function available() {
            if (isFiat(state.payAsset)) {
                var me = KP.data.ME;
                return C.currency === 'NGN' ? me.fiatBalance
                    : (me.fiatBalance / KP.USD_RATE.NGN) * KP.USD_RATE[C.currency];
            }
            var w = KP.data.MY_WALLETS.filter(function (x) { return x.asset === state.payAsset; })[0];
            return w ? w.amount : 0;
        }

        function fmtSide(v, sym) {
            return isFiat(sym) ? F.fiat(v, C.currency) : F.crypto(v, sym);
        }

        function paintSides() {
            $('#trPaySide').html(sideChip(state.payAsset, 'pay', state.kind === 'buy'));
            $('#trGetSide').html(sideChip(state.getAsset, 'get', state.kind === 'sell'));
            $('.tr-avail').text('Available ' + fmtSide(available(), state.payAsset));
        }

        function recompute() {
            var pay = parseFloat(String(state.payAmount).replace(/,/g, '')) || 0;
            var r = unitRate();
            var gross = pay * r;

            var feeRate = state.kind === 'swap' ? 0 : 0;   // margin is in the rate, no separate fee
            var get = gross * (1 - feeRate);

            $('#trGet').val(get ? get.toFixed(isFiat(state.getAsset) ? C.dp : (KP.ASSETS[state.getAsset].displayDp)) : '');

            var rows = '';
            if (state.kind === 'buy') {
                rows += row('Rate', '1 ' + state.getAsset + ' = ' + F.fiat(KP.rates.buyRate(state.getAsset, C.currency), C.currency));
            } else if (state.kind === 'sell') {
                rows += row('Rate', '1 ' + state.payAsset + ' = ' + F.fiat(KP.rates.sellRate(state.payAsset, C.currency), C.currency));
            } else {
                rows += row('Rate', '1 ' + state.payAsset + ' = ' + F.crypto(unitRate(), state.getAsset));
            }
            rows += row('Spread', spreadBps() / 100 + '%');
            rows += row('Network fee', state.kind === 'swap' ? 'None — internal' : 'None');
            rows += row(labels.get, fmtSide(get, state.getAsset), true);
            $('#trSummary').html(rows);

            var ok = pay > 0 && pay <= available() + 1e-9;
            $('#trGo').prop('disabled', !ok || KP.rails.panic.isActive());
            $('#trGo').text(pay > available() ? 'Insufficient balance' : labels.cta
                + (pay > 0 ? ' ' + fmtSide(pay, state.payAsset) : ''));
        }

        /* The spread in force for this user's market. */
        function spreadBps() {
            var e = KP.rates.effective(C.currency);
            return state.kind === 'swap' ? e.swap : state.kind === 'buy' ? e.buy : e.sell;
        }

        function row(k, v, total) {
            return '<div class="sr' + (total ? ' total' : '') + '"><span>' + k + '</span><span>' + v + '</span></div>';
        }

        /* ------------------------------ events ------------------------------ */

        $el.on('input', '#trPay', function () {
            state.payAmount = $(this).val();
            state.lastEdited = 'pay';
            recompute();
        });

        $el.on('input', '#trGet', function () {
            var get = parseFloat($(this).val().replace(/,/g, '')) || 0;
            var r = unitRate();
            var pay = r ? get / r : 0;
            state.payAmount = pay ? pay.toFixed(isFiat(state.payAsset) ? C.dp : KP.ASSETS[state.payAsset].displayDp) : '';
            $('#trPay').val(state.payAmount);
            state.lastEdited = 'get';
            // recompute would overwrite what the user is typing, so only refresh
            // the summary rows and the button here.
            var summaryOnly = true;
            recomputeSummaryOnly(get, pay);
        });

        function recomputeSummaryOnly(get, pay) {
            var rows = '';
            if (state.kind === 'buy') rows += row('Rate', '1 ' + state.getAsset + ' = ' + F.fiat(KP.rates.buyRate(state.getAsset, C.currency), C.currency));
            else if (state.kind === 'sell') rows += row('Rate', '1 ' + state.payAsset + ' = ' + F.fiat(KP.rates.sellRate(state.payAsset, C.currency), C.currency));
            else rows += row('Rate', '1 ' + state.payAsset + ' = ' + F.crypto(unitRate(), state.getAsset));
            rows += row('Spread', spreadBps() / 100 + '%');
            rows += row('Network fee', state.kind === 'swap' ? 'None — internal' : 'None');
            rows += row(labels.get, fmtSide(get, state.getAsset), true);
            $('#trSummary').html(rows);
            var ok = pay > 0 && pay <= available() + 1e-9;
            $('#trGo').prop('disabled', !ok || KP.rails.panic.isActive())
                .text(pay > available() ? 'Insufficient balance' : labels.cta);
        }

        $el.on('click', '.tr-max', function () {
            var a = available();
            state.payAmount = isFiat(state.payAsset) ? a.toFixed(C.dp) : a.toFixed(KP.ASSETS[state.payAsset].displayDp);
            $('#trPay').val(state.payAmount);
            recompute();
        });

        $el.on('click', '.tr-asset', function (e) {
            e.preventDefault();
            var side = $(this).closest('.dropdown-menu').data('side');
            var sym = $(this).data('sym');
            if (side === 'pay') {
                if (sym === state.getAsset) state.getAsset = state.payAsset;
                state.payAsset = sym;
            } else {
                if (sym === state.payAsset) state.payAsset = state.getAsset;
                state.getAsset = sym;
            }
            paintSides(); recompute();
        });

        $el.on('click', '#trFlip', function () {
            if (state.kind === 'swap') {
                var t = state.payAsset; state.payAsset = state.getAsset; state.getAsset = t;
                paintSides(); recompute();
            } else {
                // Buy ⇄ sell are two pages; send the user to the other one.
                location.href = state.kind === 'buy' ? 'sell.html' : 'buy.html';
            }
        });

        $el.on('click', '#trGo', function () {
            var pay = parseFloat(String(state.payAmount).replace(/,/g, '')) || 0;
            if (!pay) return;
            var get = pay * unitRate();

            var q = KP.rates.issueQuote({
                kind: state.kind,
                from: state.payAsset, to: state.getAsset,
                fromAmount: pay, toAmount: get,
                rate: unitRate(),
                marginBps: spreadBps()
            });

            KP.rails.requirePin(labels.cta + ' ' + fmtSide(pay, state.payAsset)).then(function (ok) {
                if (!ok) return;
                if (KP.rates.quoteSecondsLeft(q) <= 0) {
                    KP.rails.toast('That quote expired. Check the new rate and try again.', 'warning');
                    return;
                }
                showReceipt(q, pay, get);
            });
        });

        function showReceipt(q, pay, get) {
            var id = 'trReceipt';
            $('#' + id).remove();
            $('body').append(
                '<div class="modal fade" id="' + id + '" tabindex="-1"><div class="modal-dialog modal-dialog-centered">'
                + '<div class="modal-content"><div class="modal-body p-4 text-center">'
                + '<div class="qa-icon qa-green mx-auto mb-3" style="width:56px;height:56px;font-size:1.4rem"><i class="fas fa-check"></i></div>'
                + '<h5 class="fw-bold mb-1">' + labels.verb + ' successfully</h5>'
                + '<p class="text-muted mb-3" style="font-size:.82rem">Your balances have been updated.</p>'
                + '<div class="receipt text-start">'
                + '<div class="text-center mb-3"><div class="rc-amt">' + fmtSide(get, state.getAsset) + '</div>'
                + '<div class="small text-muted">' + labels.get.toLowerCase() + '</div></div>'
                + '<div class="sr d-flex justify-content-between" style="font-size:.8rem"><span class="text-muted">Reference</span><span class="fw-bold">' + q.id + '</span></div>'
                + '<div class="sr d-flex justify-content-between mt-1" style="font-size:.8rem"><span class="text-muted">' + labels.pay + '</span><span class="fw-bold">' + fmtSide(pay, state.payAsset) + '</span></div>'
                + '<div class="sr d-flex justify-content-between mt-1" style="font-size:.8rem"><span class="text-muted">Rate applied</span><span class="fw-bold">'
                + (state.kind === 'swap' ? '1 ' + state.payAsset + ' = ' + F.crypto(q.rate, state.getAsset)
                    : state.kind === 'buy' ? '1 ' + state.getAsset + ' = ' + F.fiat(1 / q.rate, C.currency)
                        : '1 ' + state.payAsset + ' = ' + F.fiat(q.rate, C.currency)) + '</span></div>'
                + '<div class="sr d-flex justify-content-between mt-1" style="font-size:.8rem"><span class="text-muted">Date</span><span class="fw-bold">' + new Date().toLocaleString() + '</span></div>'
                + '</div>'
                + '<div class="d-flex gap-2 mt-3">'
                + '<button class="btn btn-soft flex-grow-1" data-bs-dismiss="modal">Done</button>'
                + '<a href="transactions.html" class="btn btn-primary flex-grow-1">View history</a></div>'
                + '</div></div></div></div>'
            );
            new bootstrap.Modal(document.getElementById(id)).show();
        }

        /* ----------------------------- lifecycle ----------------------------- */

        KP.rails.guardPanic($('#trGuard'), state.kind === 'swap' ? 'Swaps' : 'Trades');

        paintSides();
        recompute();

        KP.rates.onTick(function () {
            paintSides();
            if (state.lastEdited === 'pay') recompute();
        });

        setInterval(function () {
            $('#trQuoteTimer').text('rate refreshes in ' + KP.rates.secondsToTick() + 's');
        }, 1000);
    }

    global.KP = global.KP || {};
    global.KP.trade = { mount: mount };

})(window, jQuery);
