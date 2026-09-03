/* ==========================================================================
   Kaastro Pay — the money flows
   Deposit and Withdraw each have one entry point. You choose the rail first,
   and only then does the page ask for anything specific to that rail.

   The platform never holds crypto. A crypto deposit is credited in Naira at
   the deposit rate once the network confirms; a crypto withdrawal sells your
   Naira at the withdrawal rate at the moment you send. Nothing sits in a coin.
   ========================================================================== */
(function (global, $) {
    'use strict';

    var BANK = { name: 'Providus Bank', short: 'Providus' };

    function C() { return KP.currentCountry(); }
    function F() { return KP.fmt; }

    function myBalance() {
        var me = KP.data.ME, c = C();
        return c.currency === 'NGN' ? me.fiatBalance
            : (me.fiatBalance / KP.USD_RATE.NGN) * KP.USD_RATE[c.currency];
    }

    /* A big tappable rail card — the shape both choosers use. */
    function railCard(o) {
        return '<button class="method-card" data-m="' + o.id + '"' + (o.locked ? ' data-locked="1"' : '') + '>'
            + '<span class="qa-icon ' + o.tone + '"><i class="fas ' + o.icon + '"></i></span>'
            + '<span class="mc-body">'
            + '<span class="mc-title">' + o.title
            + (o.tag ? ' <span class="pill ' + (o.tagTone || 'pill-success') + '">' + o.tag + '</span>' : '')
            + '</span>'
            + '<span class="mc-desc">' + o.desc + '</span>'
            + '<span class="mc-meta">' + (o.meta || []).map(function (m) {
                return '<span class="pill ' + (m[2] || 'pill-neutral') + '"><i class="fas ' + m[0] + '"></i>' + m[1] + '</span>';
            }).join('') + '</span></span>'
            + '<i class="fas fa-chevron-right text-muted align-self-center"></i></button>';
    }

    function stepper(steps, at) {
        return '<div class="stepper mb-3">' + steps.map(function (s, i) {
            var n = i + 1;
            return (i ? '<div class="line"></div>' : '')
                + '<div class="stp ' + (n === at ? 'on' : n < at ? 'done' : '') + '">'
                + '<span class="n">' + (n < at ? '<i class="fas fa-check" style="font-size:.55rem"></i>' : n) + '</span>'
                + s + '</div>';
        }).join('') + '</div>';
    }

    function backBar(label) {
        return '<div class="d-flex align-items-center gap-2 mb-3">'
            + '<button class="icon-btn flow-back"><i class="fas fa-arrow-left"></i></button>'
            + '<span class="pill pill-neutral">' + label + '</span></div>';
    }

    /* ========================== D E P O S I T ========================== */

    function deposit($el) {
        var me = KP.data.ME;

        /* Everything the chain needs to remember between screens. A deposit is
           the one flow where the user leaves and comes back, so the state has
           to survive a re-render rather than live in the DOM. */
        var pick = { asset: null, network: null, address: null };
        var ctx = { rail: null, method: null, amount: 0, ref: null, confs: 0, need: 12 };
        var state = 'chooser';
        var timers = [];

        /* Every screen that ticks registers its interval here. Leaving a screen
           without clearing it leaves a timer writing into detached nodes. */
        function tick(fn, ms) { timers.push(setInterval(fn, ms)); }
        function stopTicking() {
            timers.forEach(clearInterval);
            timers = [];
        }
        function go(fn) {
            stopTicking();
            fn();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        function depositRef() {
            return 'KPD-' + String(Date.now()).slice(-6) + '-' + me.id.slice(-4);
        }

        /* ------------------------------ chooser ------------------------------ */

        function chooser() {
            state = 'chooser';
            $el.html(
                '<div id="guard"></div>'
                + '<div class="card p-3 p-md-4">'
                + '<h2 class="card-title mb-1">Deposit</h2>'
                + '<p class="text-muted mb-3" style="font-size:.83rem">Add money to your Kaastro Pay wallet.</p>'
                + '<div class="d-grid gap-2">'
                + railCard({
                    id: 'bank', icon: 'fa-building-columns', tone: 'qa-green',
                    title: 'Bank Transfer', tag: 'Instant',
                    desc: 'Fund your Naira wallet through a bank transfer to the account we issued you.',
                    meta: [['fa-bolt', 'Instant'], ['fa-coins', C().currency]]
                })
                + railCard({
                    id: 'crypto', icon: 'fa-bitcoin-sign', tone: 'qa-amber',
                    title: 'Crypto Deposit', tag: 'Auto-converted', tagTone: 'pill-manual',
                    desc: 'Send crypto and receive Naira automatically once the network confirms.',
                    meta: [['fa-arrows-rotate', 'Auto-converted'], ['fa-clock', '2–15 min']]
                })
                + '</div>'
                + '<div class="how-strip mt-3">'
                + '<div class="hs-title">How deposits work</div>'
                + '<div class="hs-row">'
                + [['fa-file-lines', 'Receive details'], ['fa-building-columns', 'Make payment'],
                   ['fa-circle-check', 'Balance updated']].map(function (x, i) {
                    return (i ? '<i class="fas fa-chevron-right hs-sep"></i>' : '')
                        + '<span class="hs-step"><i class="fas ' + x[0] + '"></i>' + x[1] + '</span>';
                }).join('')
                + '</div></div>'
                + '<button class="btn btn-soft btn-sm w-100 mt-3" id="missingDep">'
                + '<i class="fas fa-magnifying-glass me-1"></i>Sent crypto but cannot find it?</button>'
                + '</div>'
            );
            KP.rails.guardPanic($('#guard'), 'Deposits');
        }

        /* --------------------------- bank: method --------------------------- */

        function bankMethod() {
            state = 'bank-method';
            $el.html(
                backBar('<i class="fas fa-building-columns"></i>Bank Transfer')
                + stepper(['Method', 'Details', 'Done'], 1)
                + '<div class="card p-3 p-md-4">'
                + '<h2 class="card-title mb-1">Choose Bank Method</h2>'
                + '<p class="text-muted mb-3" style="font-size:.83rem">'
                + 'Your own account matches payments instantly. Use the alternative only '
                + 'when it is unavailable.</p>'
                + '<div class="d-grid gap-2">'
                + railCard({
                    id: 'direct', icon: 'fa-building-columns', tone: 'qa-green',
                    title: 'Direct Bank Transfer', tag: 'Recommended',
                    desc: 'Transfer to the account issued to you. It is permanent and matches automatically.',
                    meta: [['fa-bolt', 'Instant matching'], ['fa-infinity', 'Always yours']]
                })
                + railCard({
                    id: 'alt', icon: 'fa-arrow-right-arrow-left', tone: 'qa-amber',
                    title: 'Alternative Bank Transfer', tagTone: 'pill-manual',
                    desc: 'A temporary collection account. You must send an exact amount and quote a reference.',
                    meta: [['fa-clock', '30-minute window'], ['fa-hashtag', 'Reference required']]
                })
                + '</div>'
                + '<div class="k-alert k-info mt-3"><i class="fas fa-circle-info"></i><div>'
                + 'Either way, transfer from an account bearing your own verified name. '
                + 'Third-party transfers are returned.</div></div>'
                + '</div>'
            );
        }

        /* --------------------------- bank: direct --------------------------- */

        function bankFlow() {
            state = 'bank-direct';
            ctx.rail = 'bank';
            ctx.method = 'direct';
            var acc = me.virtualAccount;
            $el.html(
                backBar('<i class="fas fa-building-columns"></i>Direct Bank Transfer')
                + stepper(['Method', 'Details', 'Done'], 2)
                + '<div class="card p-3 p-md-4">'
                + '<h2 class="card-title mb-1">Bank Transfer</h2>'
                + '<p class="text-muted mb-3" style="font-size:.83rem">'
                + 'Transfer from any bank to the account below. It is yours permanently.</p>'

                + '<div class="acct-card">'
                + '<div class="ac-top"><span class="qa-icon qa-green sm"><i class="fas fa-building-columns"></i></span>'
                + '<b>' + BANK.name + '</b></div>'
                + '<div class="ac-field"><span>Account Number</span>'
                + '<span class="ac-val">' + acc.number
                + '<button class="btn btn-sm btn-soft py-0 px-2 ms-2 kp-copy" data-copy="' + acc.number + '">'
                + '<i class="fas fa-copy me-1"></i>Copy</button></span></div>'
                + '<div class="ac-field"><span>Account Name</span>'
                + '<span class="ac-val">' + acc.name + '</span></div>'
                + '<button class="btn btn-soft btn-sm w-100 mt-2 kp-copy" data-copy="'
                + BANK.name + ' · ' + acc.number + ' · ' + acc.name + '">'
                + '<i class="fas fa-share-nodes me-1"></i>Share details</button>'
                + '</div>'

                + '<label class="form-label mt-3">Amount you are sending <span class="text-muted">(optional)</span></label>'
                + '<div class="input-group"><span class="input-group-text">' + C().symbol + '</span>'
                + '<input class="form-control" id="depAmt" inputmode="decimal" placeholder="0.00"></div>'
                + '<div class="form-text">Telling us the amount lets us match your transfer faster.</div>'

                + '<div class="k-alert k-info mt-3"><i class="fas fa-circle-info"></i><div>'
                + 'Transfer from an account bearing your verified name. Transfers from a third '
                + 'party are returned.</div></div>'

                + '<div class="summary-rows mt-3">'
                + '<div class="sr"><span>Minimum deposit</span><span>' + F().fiat(1000, C().currency) + '</span></div>'
                + '<div class="sr"><span>Processing</span><span class="text-up">Instant</span></div>'
                + '<div class="sr total"><span>Fee</span><span>' + F().fiat(0, C().currency) + '</span></div>'
                + '</div>'

                + '<button class="btn btn-primary w-100 mt-3" id="madeTransfer">'
                + 'I’ve Made the Transfer</button>'
                + '<button class="btn btn-soft w-100 mt-2" id="bankManual">'
                + '<i class="fas fa-hand me-1"></i>Not showing up? Upload proof</button>'
                + '</div>'
            );
        }

        /* ------------------------ bank: alternative ------------------------ */

        function altFlow() {
            state = 'bank-alt';
            ctx.rail = 'bank';
            ctx.method = 'alt';
            ctx.ref = depositRef();

            $el.html(
                backBar('<i class="fas fa-arrow-right-arrow-left"></i>Alternative Transfer')
                + stepper(['Method', 'Details', 'Done'], 2)
                + '<div class="card p-3 p-md-4">'
                + '<h2 class="card-title mb-1">Alternative Bank Transfer</h2>'
                + '<p class="text-muted mb-3" style="font-size:.83rem">'
                + 'Use this temporary collection account when your own is unavailable.</p>'

                + '<label class="form-label">Amount</label>'
                + '<div class="input-group mb-3"><span class="input-group-text">' + C().symbol + '</span>'
                + '<input class="form-control" id="altAmt" inputmode="decimal" placeholder="0.00" value="100000"></div>'

                + '<div class="acct-card">'
                + '<div class="ac-top"><span class="qa-icon qa-amber sm"><i class="fas fa-building-columns"></i></span>'
                + '<b>SafeHaven MFB</b> <span class="pill pill-manual ms-auto">Temporary</span></div>'
                + '<div class="ac-field"><span>Account Number</span>'
                + '<span class="ac-val">2048167539'
                + '<button class="btn btn-sm btn-soft py-0 px-2 ms-2 kp-copy" data-copy="2048167539">'
                + '<i class="fas fa-copy me-1"></i>Copy</button></span></div>'
                + '<div class="ac-field"><span>Account Name</span>'
                + '<span class="ac-val">KAASTRO PAY COLLECTION</span></div>'
                + '<div class="ac-field"><span>Reference</span>'
                + '<span class="ac-val">' + ctx.ref
                + '<button class="btn btn-sm btn-soft py-0 px-2 ms-2 kp-copy" data-copy="' + ctx.ref + '">'
                + '<i class="fas fa-copy me-1"></i>Copy</button></span></div>'
                + '</div>'

                + '<div class="mt-3"><div class="text-muted mb-1" style="font-size:.78rem">'
                + 'Complete transfer within</div>'
                + '<div class="countdown" id="altClock"><i class="fas fa-clock"></i>'
                + '<span id="altClockT">30:00</span></div></div>'

                + '<div class="k-alert k-warn mt-3"><i class="fas fa-triangle-exclamation"></i><div>'
                + '<b class="hd">Use the exact reference.</b>A collection account is shared. Without '
                + '<b>' + ctx.ref + '</b> in the narration we cannot tell which payment is yours.</div></div>'

                + '<button class="btn btn-primary w-100 mt-3" id="altMade">I’ve Made the Transfer</button>'
                + '<button class="btn btn-soft w-100 mt-2" id="altOther">Choose another method</button>'
                + '<p class="text-muted text-center mt-2 mb-0" style="font-size:.72rem">'
                + '<i class="fas fa-circle-info me-1"></i>'
                + 'Confirmation may take longer than a dedicated account transfer.</p>'
                + '</div>'
            );

            var left = 30 * 60;
            tick(function () {
                left--;
                var m = Math.floor(left / 60), s = left % 60;
                $('#altClockT').text(m + ':' + (s < 10 ? '0' : '') + s);
                if (left <= 300) $('#altClock').addClass('is-out');
                if (left <= 0) {
                    stopTicking();
                    $('#altClockT').text('Expired');
                    $('#altMade').prop('disabled', true);
                    KP.rails.toast('The transfer window closed. Start again for a fresh reference.', 'danger');
                }
            }, 1000);
        }

        /* ----------------------- bank: waiting → credited ----------------------- */

        var BANK_STEPS = [
            ['Waiting for bank transfer', 'We are watching for your payment.'],
            ['Payment detected', 'Your transfer has been received.'],
            ['Account name check', 'We are verifying the sending account.'],
            ['Credit wallet', 'We will credit your Naira wallet.']
        ];

        function trackHtml(steps, at) {
            return '<div class="track">' + steps.map(function (s, i) {
                var cls = i < at ? 'done' : i === at ? 'on' : 'pending';
                return '<div class="tk ' + cls + '">'
                    + '<span class="tk-dot"><i class="fas fa-check"></i></span>'
                    + '<span class="tk-body"><span class="tk-title d-block">' + s[0] + '</span>'
                    + '<span class="tk-sub d-block">' + (i < at ? 'Completed' : i === at ? 'In progress' : s[1]) + '</span>'
                    + '</span></div>';
            }).join('') + '</div>';
        }

        function bankWaiting() {
            state = 'bank-wait';
            var at = 0;

            function render() {
                $el.html(
                    backBar('<i class="fas fa-building-columns"></i>Deposit')
                    + stepper(['Method', 'Details', 'Done'], 3)
                    + '<div class="card p-3 p-md-4">'
                    + '<div class="result-hero is-wait">'
                    + '<div class="rh-ico"><i class="fas ' + (at === 0 ? 'fa-building-columns' : 'fa-circle-notch fa-spin') + '"></i></div>'
                    + '<div class="text-muted" style="font-size:.8rem">Amount expected</div>'
                    + '<div class="rh-amt">' + (ctx.amount ? F().fiat(ctx.amount, C().currency) : 'Any amount') + '</div>'
                    + '<div class="rh-sub">'
                    + (ctx.method === 'alt' ? 'SafeHaven MFB · ' + ctx.ref
                        : BANK.name + ' · ••••' + me.virtualAccount.number.slice(-4)) + '</div>'
                    + '</div>'
                    + '<div class="mt-3">' + trackHtml(BANK_STEPS, at) + '</div>'
                    + '<button class="btn btn-soft w-100 mt-3" id="refreshDep">'
                    + '<i class="fas fa-rotate me-1"></i>Refresh status</button>'
                    + '<button class="btn btn-soft w-100 mt-2" id="cancelDep">Cancel deposit</button>'
                    + '<p class="text-muted text-center mt-2 mb-0" style="font-size:.72rem">'
                    + 'You can close this page. We will notify you when it lands.</p>'
                    + '</div>'
                );
            }

            render();
            /* The prototype has no bank feed behind it, so the stages advance on
               a timer. The screens and their order are the real deliverable. */
            tick(function () {
                at++;
                if (at >= BANK_STEPS.length) { go(bankCredited); return; }
                render();
            }, 2600);
        }

        function bankCredited() {
            state = 'bank-done';
            var amt = ctx.amount || 100000;
            var newBal = me.fiatBalance + amt;
            $el.html(
                '<div class="card p-3 p-md-4">'
                + '<div class="result-hero">'
                + '<div class="rh-ico"><i class="fas fa-check"></i></div>'
                + '<div class="rh-amt">' + F().fiat(amt, C().currency) + '</div>'
                + '<div class="rh-sub">Credited to your Naira wallet</div>'
                + '<div class="mt-2"><span class="pill pill-success">'
                + '<i class="fas fa-circle-check"></i>Completed</span></div>'
                + '</div>'

                + '<div class="summary-rows mt-3">'
                + '<div class="sr"><span>Deposit method</span><span>Bank Transfer</span></div>'
                + '<div class="sr"><span>From</span><span>'
                + (ctx.method === 'alt' ? 'SafeHaven MFB' : BANK.name) + '</span></div>'
                + '<div class="sr"><span>Reference</span><span>' + (ctx.ref || depositRef()) + '</span></div>'
                + '<div class="sr"><span>Fee</span><span>' + F().fiat(0, C().currency) + '</span></div>'
                + '<div class="sr total"><span>New balance</span>'
                + '<span class="text-up">' + F().fiat(newBal, C().currency) + '</span></div>'
                + '</div>'

                + '<button class="btn btn-primary w-100 mt-3" id="depReceipt">'
                + '<i class="fas fa-receipt me-1"></i>View receipt</button>'
                + '<a href="index.html" class="btn btn-soft w-100 mt-2">Back to home</a>'
                + '</div>'
            );
        }

        /* --------------------------- crypto: address --------------------------- */

        function cryptoStep(n) {
            state = 'crypto';
            var head = backBar('<i class="fas fa-bitcoin-sign"></i>Crypto Deposit')
                + stepper(['Asset', 'Network', 'Address'], n);

            if (n === 1) {
                $el.html(head + '<div class="card p-3 p-md-4">'
                    + '<h2 class="card-title mb-1">Select Asset</h2>'
                    + '<p class="text-muted mb-3" style="font-size:.83rem">Which coin are you sending?</p>'
                    + KP.ASSET_LIST.map(function (a) {
                        return '<button class="net-opt mb-2 pick-asset" data-sym="' + a.symbol + '">'
                            + '<span class="asset-icon" style="background:' + a.color + '">' + a.symbol.slice(0, 4) + '</span>'
                            + '<span><span class="no-name">' + a.symbol + ' · ' + a.name + '</span>'
                            + '<span class="no-sub">Minimum ' + F().crypto(a.minDeposit, a.symbol) + '</span></span>'
                            + '<i class="fas fa-chevron-right ms-auto text-muted"></i></button>';
                    }).join('') + '</div>');
                return;
            }

            var a = KP.ASSETS[pick.asset];

            if (n === 2) {
                $el.html(head + '<div class="card p-3 p-md-4">'
                    + '<h2 class="card-title mb-1">Select Network</h2>'
                    + '<p class="text-muted mb-3" style="font-size:.83rem">'
                    + 'Choose the network you will send ' + a.symbol + ' on.</p>'
                    + '<div class="d-grid gap-2">'
                    + a.networks.map(function (nw) {
                        return '<button class="net-opt pick-net" data-net="' + nw.id + '">'
                            + '<span class="asset-icon sm" style="background:' + a.color + '">' + nw.id.slice(0, 3) + '</span>'
                            + '<span><span class="no-name">' + nw.name + '</span>'
                            + '<span class="no-sub">' + nw.note + ' · ' + nw.conf + ' confirmations</span></span>'
                            + '<i class="fas fa-circle-check no-check"></i></button>';
                    }).join('') + '</div>'
                    + '<div class="k-alert k-warn mt-3"><i class="fas fa-triangle-exclamation"></i><div>'
                    + '<b class="hd">The network must match.</b>Sending on a different network means the funds '
                    + 'cannot be recovered automatically.</div></div>'
                    + '<button class="btn btn-primary w-100 mt-3" id="toAddr" disabled>Continue</button>'
                    + '</div>');
                return;
            }

            var nw = a.networks.filter(function (x) { return x.id === pick.network; })[0];
            var rate = KP.rates.depositRate(pick.asset, C().currency);
            var seed = me.id.length + pick.asset.length * 7 + pick.network.length * 13;
            pick.address = pick.asset === 'BTC' ? KP.data.hashAddr('bc1q', seed, 42)
                : pick.network === 'TRC20' ? KP.data.hashAddr('T', seed, 34)
                : KP.data.hashAddr('0x', seed, 42);

            ctx.need = nw.conf;
            var est = a.minDeposit * 10;

            $el.html(head + '<div class="card p-3 p-md-4">'
                + '<div class="d-flex gap-2 mb-3">'
                + '<div class="pill-select flex-grow-1"><span class="asset-icon sm" style="background:' + a.color + '">'
                + a.symbol.slice(0, 3) + '</span><b>' + a.symbol + '</b>'
                + '<span class="text-muted">· ' + a.name + '</span></div>'
                + '<div class="pill-select flex-grow-1"><b>' + nw.id + '</b>'
                + '<span class="text-muted">· ' + nw.name.replace(/\s*\(.*\)/, '') + '</span></div></div>'

                + '<div class="text-center"><div class="qr-box" id="qrBox"></div></div>'

                + '<div class="address-box mt-3" id="addrText">' + pick.address + '</div>'
                + '<div class="d-flex gap-2 mt-2">'
                + '<button class="btn btn-soft flex-grow-1 kp-copy" data-copy="' + pick.address + '">'
                + '<i class="fas fa-copy me-1"></i>Copy</button>'
                + '<button class="btn btn-soft flex-grow-1" id="shareAddr">'
                + '<i class="fas fa-share-nodes me-1"></i>Share</button></div>'

                + '<div class="summary-rows mt-3">'
                + '<div class="sr"><span>Minimum</span><span>' + F().crypto(a.minDeposit, a.symbol) + '</span></div>'
                + '<div class="sr"><span>Confirmations</span><span>' + nw.conf + '</span></div>'
                + '<div class="sr"><span>Rate</span><span>' + F().fiat(rate, C().currency) + ' / ' + a.symbol + '</span></div>'
                + '<div class="sr total"><span>Estimated on ' + F().crypto(est, a.symbol) + '</span>'
                + '<span class="text-up">' + F().fiat(est * rate, C().currency) + '</span></div></div>'

                + '<div class="k-alert k-warn mt-3"><i class="fas fa-triangle-exclamation"></i><div>'
                + 'Send only <b>' + a.symbol + '</b> through the <b>' + nw.id + '</b> network.</div></div>'
                + '<div class="k-alert k-ok mt-2"><i class="fas fa-shield-halved"></i><div>'
                + 'Crypto is converted to ' + C().currency + ' automatically after confirmation. '
                + 'Kaastro Pay does not store cryptocurrency.</div></div>'

                + '<button class="btn btn-primary w-100 mt-3" id="sentCrypto">I’ve Sent the Crypto</button>'
                + '</div>');

            $('#qrBox').empty();
            if (typeof QRCode === 'function') {
                new QRCode(document.getElementById('qrBox'), {
                    text: pick.address, width: 168, height: 168,
                    colorDark: '#0f172a', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M
                });
            }
        }

        /* --------------------- crypto: confirming → credited --------------------- */

        var CRYPTO_STEPS = [
            ['Payment detected', 'We will spot the incoming transaction.'],
            ['Blockchain confirmation', 'Waiting for network confirmations.'],
            ['Convert to Naira', 'Converted once confirmations complete.'],
            ['Credit your wallet', 'Your Naira balance is updated.']
        ];

        function cryptoWaiting() {
            state = 'crypto-wait';
            var a = KP.ASSETS[pick.asset];
            var amt = a.minDeposit * 10;
            ctx.confs = 0;

            function at() {
                if (ctx.confs === 0) return 0;
                if (ctx.confs < ctx.need) return 1;
                return 2;
            }

            function render() {
                var pct = Math.round((ctx.confs / ctx.need) * 100);
                $el.html(
                    backBar('<i class="fas fa-bitcoin-sign"></i>Crypto Deposit')
                    + '<div class="card p-3 p-md-4">'
                    + '<div class="result-hero is-wait">'
                    + '<div class="rh-ico"><i class="fas fa-circle-notch fa-spin"></i></div>'
                    + '<div class="rh-amt">' + F().crypto(amt, a.symbol) + '</div>'
                    + '<div class="rh-sub">on ' + pick.network + ' · waiting for the network</div>'
                    + '</div>'

                    + '<div class="conf-meter">'
                    + '<div class="cm-top"><span class="text-muted">Confirmations</span>'
                    + '<span class="cm-n">' + ctx.confs + ' of ' + ctx.need + '</span></div>'
                    + '<div class="cm-bar"><div class="cm-fill" style="width:' + pct + '%"></div></div></div>'

                    + '<div class="mt-3">' + trackHtml(CRYPTO_STEPS, at()) + '</div>'

                    + '<div class="k-alert k-ok mt-3"><i class="fas fa-shield-halved"></i><div>'
                    + 'Nothing is held in coin. The moment the network confirms, your '
                    + a.symbol + ' is sold and your Naira balance updates.</div></div>'

                    + '<button class="btn btn-soft w-100 mt-3" id="viewChain">'
                    + '<i class="fas fa-arrow-up-right-from-square me-1"></i>View on blockchain</button>'
                    + '<a href="index.html" class="btn btn-soft w-100 mt-2">Back to home</a>'
                    + '</div>'
                );
            }

            render();
            tick(function () {
                ctx.confs++;
                if (ctx.confs > ctx.need) { go(function () { cryptoCredited(amt); }); return; }
                render();
            }, 700);
        }

        function cryptoCredited(amt) {
            state = 'crypto-done';
            var a = KP.ASSETS[pick.asset];
            var rate = KP.rates.depositRate(pick.asset, C().currency);
            var naira = amt * rate;

            $el.html(
                '<div class="card p-3 p-md-4">'
                + '<div class="result-hero">'
                + '<div class="rh-ico"><i class="fas fa-check"></i></div>'
                + '<div class="rh-amt">' + F().fiat(naira, C().currency) + '</div>'
                + '<div class="rh-sub">' + F().crypto(amt, a.symbol)
                + ' confirmed and automatically converted to ' + C().currency + '</div>'
                + '<div class="mt-2"><span class="pill pill-success">'
                + '<i class="fas fa-circle-check"></i>Completed</span></div>'
                + '</div>'

                + '<div class="summary-rows mt-3">'
                + '<div class="sr"><span>Asset</span><span>' + a.symbol + '</span></div>'
                + '<div class="sr"><span>Network</span><span>' + pick.network + '</span></div>'
                + '<div class="sr"><span>Amount received</span><span>' + F().crypto(amt, a.symbol) + '</span></div>'
                + '<div class="sr"><span>Confirmations</span><span>' + ctx.need + '/' + ctx.need + '</span></div>'
                + '<div class="sr"><span>Rate</span><span>' + F().fiat(rate, C().currency) + ' / ' + a.symbol + '</span></div>'
                + '<div class="sr total"><span>' + C().currency + ' credited</span>'
                + '<span class="text-up">' + F().fiat(naira, C().currency) + '</span></div>'
                + '</div>'

                + '<div class="k-alert k-ok mt-3"><i class="fas fa-shield-halved"></i><div>'
                + 'Kaastro Pay does not store cryptocurrency. Your balance is held in '
                + C().currency + ' only.</div></div>'

                + '<button class="btn btn-primary w-100 mt-3" id="cryptoReceipt">'
                + '<i class="fas fa-receipt me-1"></i>View receipt</button>'
                + '<a href="index.html" class="btn btn-soft w-100 mt-2">Back to home</a>'
                + '</div>'
            );
        }

        /* ------------------------ missing deposit recovery ------------------------ */

        function missingDeposit() {
            state = 'missing';
            $el.html(
                backBar('<i class="fas fa-magnifying-glass"></i>Find a Deposit')
                + '<div class="card p-3 p-md-4">'
                + '<h2 class="card-title mb-1">Can’t find your deposit?</h2>'
                + '<p class="text-muted mb-3" style="font-size:.83rem">'
                + 'Kaastro Pay does not custody crypto. Deposits are converted to Naira only '
                + 'after confirmation and validation, so recovery is not guaranteed.</p>'

                + '<div class="summary-rows mb-3">'
                + [['Check the required confirmations have been reached'],
                   ['Confirm you used the network shown on the deposit screen'],
                   ['Verify the destination address matches exactly'],
                   ['Allow time for network processing at peak']].map(function (r) {
                    return '<div class="sr"><span><i class="fas fa-circle-check text-primary-k me-2"></i>'
                        + r[0] + '</span><span></span></div>';
                }).join('')
                + '</div>'

                + '<label class="form-label">Transaction hash</label>'
                + '<input class="form-control mb-1" id="mdHash" placeholder="Paste the hash from the blockchain">'
                + '<div class="form-text mb-3">Copy it from the wallet or exchange you sent from.</div>'

                + '<div class="row g-2">'
                + '<div class="col-7"><label class="form-label">Amount sent</label>'
                + '<input class="form-control" id="mdAmt" inputmode="decimal" placeholder="0.00"></div>'
                + '<div class="col-5"><label class="form-label">Asset</label>'
                + '<select class="form-select" id="mdAsset">'
                + KP.ASSET_LIST.map(function (a) {
                    return '<option value="' + a.symbol + '">' + a.symbol + '</option>';
                }).join('') + '</select></div></div>'

                + '<div class="k-alert k-warn mt-3"><i class="fas fa-triangle-exclamation"></i><div>'
                + 'Transactions sent on an unsupported network may not be recoverable.</div></div>'

                + '<button class="btn btn-primary w-100 mt-3" id="mdGo">Submit for review</button>'
                + '</div>'
            );
        }

        function recoverySubmitted() {
            state = 'missing-done';
            var caseId = '#KPD-' + Math.floor(10000 + Math.random() * 89999);
            $el.html(
                '<div class="card p-3 p-md-4">'
                + '<div class="result-hero is-wait">'
                + '<div class="rh-ico"><i class="fas fa-magnifying-glass"></i></div>'
                + '<div class="rh-amt" style="font-size:1.15rem">We’re reviewing your deposit</div>'
                + '<div class="rh-sub">We will verify the transaction on the blockchain '
                + 'and validate it against our records.</div>'
                + '<div class="mt-2"><span class="pill pill-manual">Case ' + caseId + '</span></div>'
                + '</div>'
                + '<div class="mt-3">' + trackHtml([
                    ['Case submitted', ''],
                    ['Blockchain check', 'We trace the hash you gave us.'],
                    ['Account validation', 'We match it to your account.'],
                    ['Resolution', 'You are told the outcome.']
                ], 1) + '</div>'
                + '<div class="k-alert k-info mt-3"><i class="fas fa-circle-info"></i><div>'
                + 'We will notify you when there is an update. Most cases are resolved '
                + 'within 24 hours.</div></div>'
                + '<a href="support.html" class="btn btn-primary w-100 mt-3">'
                + '<i class="fas fa-headset me-1"></i>Contact support</a>'
                + '<a href="index.html" class="btn btn-soft w-100 mt-2">Back to home</a>'
                + '</div>'
            );
        }

        /* ------------------------------- wiring ------------------------------- */

        chooser();

        $el.on('click', '.method-card', function () {
            var m = $(this).data('m');
            if (m === 'bank') go(bankMethod);
            else if (m === 'crypto') { pick.asset = null; go(function () { cryptoStep(1); }); }
            else if (m === 'direct') go(bankFlow);
            else if (m === 'alt') go(altFlow);
        });

        /* Back walks the chain rather than always dropping to the chooser, so a
           user correcting one field does not lose the whole flow. */
        $el.on('click', '.flow-back', function () {
            if (state === 'crypto' && pick.network) { pick.network = null; go(function () { cryptoStep(2); }); return; }
            if (state === 'crypto' && pick.asset) { pick.asset = null; go(function () { cryptoStep(1); }); return; }
            if (state === 'bank-direct' || state === 'bank-alt') { go(bankMethod); return; }
            if (state === 'bank-wait') { go(ctx.method === 'alt' ? altFlow : bankFlow); return; }
            if (state === 'crypto-wait') { go(function () { cryptoStep(3); }); return; }
            go(chooser);
        });

        $el.on('click', '.pick-asset', function () { pick.asset = $(this).data('sym'); go(function () { cryptoStep(2); }); });
        $el.on('click', '.pick-net', function () {
            $('.pick-net').removeClass('selected');
            $(this).addClass('selected');
            pick.network = $(this).data('net');
            $('#toAddr').prop('disabled', false);
        });
        $el.on('click', '#toAddr', function () { go(function () { cryptoStep(3); }); });

        $el.on('click', '#shareAddr', function () {
            if (navigator.share) navigator.share({ title: 'My Kaastro ' + pick.asset + ' address', text: pick.address });
            else { navigator.clipboard.writeText(pick.address); KP.rails.toast('Address copied'); }
        });

        $el.on('click', '#madeTransfer', function () {
            ctx.amount = parseFloat(($('#depAmt').val() || '').replace(/,/g, '')) || 0;
            ctx.ref = depositRef();
            go(bankWaiting);
        });

        $el.on('click', '#altMade', function () {
            var v = parseFloat(($('#altAmt').val() || '').replace(/,/g, '')) || 0;
            if (v < 1000) { KP.rails.toast('Enter the amount you transferred.', 'danger'); return; }
            ctx.amount = v;
            go(bankWaiting);
        });
        $el.on('click', '#altOther', function () { go(bankMethod); });

        $el.on('click', '#sentCrypto', function () { go(cryptoWaiting); });
        $el.on('click', '#refreshDep', function () { KP.rails.toast('Still watching for your transfer.'); });
        $el.on('click', '#cancelDep', function () { go(chooser); });
        $el.on('click', '#viewChain', function () {
            KP.rails.toast('A block explorer would open here with your transaction hash.');
        });

        $el.on('click', '#depReceipt', function () {
            var amt = ctx.amount || 100000;
            KP.receipt.show({
                title: 'Deposit receipt',
                amount: F().fiat(amt, C().currency),
                sub: 'Bank transfer to your Naira wallet',
                status: 'successful',
                rows: [
                    ['Method', ctx.method === 'alt' ? 'Alternative bank transfer' : 'Direct bank transfer'],
                    ['Bank', ctx.method === 'alt' ? 'SafeHaven MFB' : BANK.name],
                    ['Reference', ctx.ref || '—'],
                    ['Fee', F().fiat(0, C().currency)],
                    ['Date', new Date().toLocaleString()]
                ],
                note: 'Deposits are credited in ' + C().currency + ' only.'
            });
        });

        $el.on('click', '#cryptoReceipt', function () {
            var a = KP.ASSETS[pick.asset];
            var amt = a.minDeposit * 10;
            var rate = KP.rates.depositRate(pick.asset, C().currency);
            KP.receipt.show({
                title: 'Deposit receipt',
                amount: F().fiat(amt * rate, C().currency),
                sub: F().crypto(amt, a.symbol) + ' converted to ' + C().currency,
                status: 'successful',
                rows: [
                    ['Asset', a.symbol],
                    ['Network', pick.network],
                    ['Amount received', F().crypto(amt, a.symbol)],
                    ['Rate', F().fiat(rate, C().currency) + ' / ' + a.symbol],
                    ['Confirmations', ctx.need + '/' + ctx.need],
                    ['Date', new Date().toLocaleString()]
                ],
                note: 'Kaastro Pay does not store cryptocurrency.'
            });
        });

        $el.on('click', '#missingDep', function () { go(missingDeposit); });
        $el.on('click', '#mdGo', function () {
            if (!$('#mdHash').val() || !$('#mdAmt').val()) {
                KP.rails.toast('Give us the transaction hash and the amount.', 'danger'); return;
            }
            go(recoverySubmitted);
        });

        /* Proof-of-payment escape hatch, for when the provider is misbehaving. */
        $el.on('click', '#bankManual', function () {
            KP.rails.sheet('Upload proof of payment',
                '<p class="text-muted" style="font-size:.85rem">If our provider is having issues, '
                + 'send us the receipt and an agent will credit you by hand.</p>'
                + '<label class="form-label">Amount sent</label>'
                + '<div class="input-group mb-3"><span class="input-group-text">' + C().symbol + '</span>'
                + '<input class="form-control" id="pfAmt" inputmode="decimal" placeholder="0.00"></div>'
                + '<label class="form-label">Proof of payment</label>'
                + '<input type="file" class="form-control mb-3" id="pfFile">'
                + '<button class="btn btn-primary w-100" id="pfGo">Submit for review</button>');
        });
        $(document).on('click', '#pfGo', function () {
            if (!$('#pfAmt').val() || !$('#pfFile').val()) {
                KP.rails.toast('Enter the amount and attach your receipt.', 'danger'); return;
            }
            KP.rails.closeSheet();
            KP.rails.toast('Sent to an agent. You will hear back shortly.');
        });
    }

    /* ========================= W I T H D R A W ========================= */

    function withdraw($el) {
        var me = KP.data.ME;

        function chooser() {
            var t3 = me.tier >= 3;
            $el.html(
                '<div id="guard"></div>'
                + '<div class="card p-3 p-md-4">'
                + '<h2 class="card-title mb-1">Withdraw</h2>'
                + '<p class="text-muted mb-3" style="font-size:.83rem">Choose how you want to receive your money.</p>'

                + '<div class="bal-strip mb-3">'
                + '<span>Available Balance</span>'
                + '<b>' + F().fiat(myBalance(), C().currency) + '</b>'
                + '<span class="pill pill-neutral">' + C().currency + '</span></div>'

                + '<div class="d-grid gap-2">'
                + railCard({
                    id: 'bank', icon: 'fa-building-columns', tone: 'qa-green',
                    title: 'Withdraw to Bank',
                    desc: 'Send ' + C().currency + ' to a bank account in your own name.',
                    meta: [['fa-clock', '1–5 minutes']]
                })
                + railCard({
                    id: 'crypto', icon: 'fa-wallet', tone: t3 ? 'qa-amber' : 'qa-slate',
                    title: 'Withdraw to Crypto Wallet',
                    tag: t3 ? 'Tier 3' : 'Locked', tagTone: t3 ? 'pill-success' : 'pill-pending',
                    desc: 'Pay with ' + C().currency + ' and receive crypto at the wallet you choose.',
                    meta: t3 ? [['fa-arrows-rotate', 'Automatic conversion']]
                             : [['fa-lock', 'Tier 3 required', 'pill-pending']],
                    locked: !t3
                })
                + '</div>'
                + '<div class="k-alert k-ok mt-3"><i class="fas fa-shield-halved"></i><div>'
                + 'Withdrawals are processed automatically within minutes.</div></div>'
                + '</div>'
            );
            KP.rails.guardPanic($('#guard'), 'Withdrawals');
        }

        function bankFlow() {
            var acc = me.bankAccounts[0];
            var fee = C().dp === 0 ? 500 : (C().currency === 'NGN' ? 100 : 2);
            $el.html(
                backBar('<i class="fas fa-building-columns"></i>Withdraw to Bank')
                + '<div class="card p-3 p-md-4">'
                + '<h2 class="card-title mb-1">Withdraw to Bank</h2>'
                + '<div class="bal-strip my-3"><span>Available Balance</span>'
                + '<b>' + F().fiat(myBalance(), C().currency) + '</b>'
                + '<span class="pill pill-neutral">' + C().currency + '</span></div>'

                + '<div class="seg w-100 mb-3" id="benSeg" style="display:flex">'
                + '<button class="flex-grow-1 active" data-b="saved">Saved Beneficiary</button>'
                + '<button class="flex-grow-1" data-b="new">New Bank Account</button></div>'

                + '<div class="acct-card mb-3">'
                + '<div class="ac-top"><span class="qa-icon qa-blue sm"><i class="fas fa-building-columns"></i></span>'
                + '<b>' + acc.bank + '</b>'
                + '<span class="pill pill-success ms-auto"><i class="fas fa-circle-check"></i>Verified</span></div>'
                + '<div class="ac-field"><span>' + acc.name + '</span>'
                + '<span class="ac-val">•••• ' + acc.number.slice(-4) + '</span></div></div>'

                + '<label class="form-label">Amount</label>'
                + '<div class="amount-box mb-3">'
                + '<div class="d-flex align-items-center gap-2">'
                + '<input type="text" inputmode="decimal" id="wAmt" placeholder="0.00">'
                + '<span class="ab-side" style="cursor:default">' + C().currency + '</span></div>'
                + '<div class="mt-2"><button class="btn btn-sm btn-soft py-0 px-2" id="wMax" style="font-size:.68rem">Max</button></div>'
                + '</div>'

                + '<div class="summary-rows mb-3" id="wSum"></div>'
                + '<label class="form-label">Note (optional)</label>'
                + '<textarea class="form-control mb-3" rows="2" placeholder="Add a note for this withdrawal"></textarea>'
                + '<button class="btn btn-primary w-100 kp-submit" id="wGo" disabled>Review Withdrawal</button>'
                + '<p class="text-muted text-center mt-2 mb-0" style="font-size:.72rem">'
                + '<i class="fas fa-clock me-1"></i>Usually completed within 1–5 minutes</p>'
                + '</div>'
            );

            function paint() {
                var v = parseFloat(($('#wAmt').val() || '').replace(/,/g, '')) || 0;
                $('#wSum').html(
                    '<div class="sr"><span>Withdrawal Fee</span><span>' + F().fiat(fee, C().currency) + '</span></div>'
                    + '<div class="sr total"><span>You Receive</span><span class="text-up">'
                    + F().fiat(Math.max(0, v - fee), C().currency) + '</span></div>');
                $('#wGo').prop('disabled', !(v > fee && v <= myBalance()))
                    .text(v > myBalance() ? 'Insufficient balance' : 'Review Withdrawal');
            }
            $el.off('input.w').on('input.w', '#wAmt', paint);
            $el.off('click.wm').on('click.wm', '#wMax', function () {
                $('#wAmt').val(myBalance().toFixed(C().dp)); paint();
            });
            paint();

            $el.off('click.wg').on('click.wg', '#wGo', function () {
                var v = parseFloat(($('#wAmt').val() || '').replace(/,/g, '')) || 0;
                KP.rails.requirePin('Withdraw ' + F().fiat(v, C().currency)).then(function (ok) {
                    if (!ok) return;
                    var ref = 'WDR-F' + Math.floor(52400 + v % 900);
                    KP.receipt.show({
                        title: 'Withdrawal submitted', ref: ref,
                        amount: F().fiat(v - fee, C().currency),
                        sub: 'to ' + acc.bank + ' •••• ' + acc.number.slice(-4),
                        status: 'processing',
                        rows: [['Reference', ref], ['Bank', acc.bank], ['Account', acc.number],
                               ['Account name', acc.name], ['Amount', F().fiat(v, C().currency)],
                               ['Fee', F().fiat(fee, C().currency)],
                               ['You receive', F().fiat(v - fee, C().currency)],
                               ['Date', new Date().toLocaleString()]],
                        note: 'Usually completed within 1–5 minutes.'
                    });
                });
            });
        }

        function locked() {
            var checks = [
                ['BVN verification', true], ['Government-issued ID', true],
                ['Selfie verification', false], ['Address verification', false]
            ];
            $el.html(
                backBar('<i class="fas fa-wallet"></i>Withdraw to Crypto Wallet')
                + '<div class="card p-3 p-md-4 text-center">'
                + '<div class="tier-lock"><i class="fas fa-lock"></i><span>TIER 3</span></div>'
                + '<h2 class="card-title mt-3 mb-1" style="font-size:1.1rem">Tier 3 verification required</h2>'
                + '<p class="text-muted" style="font-size:.85rem">'
                + 'Complete your identity verification to withdraw through a crypto wallet.</p>'
                + '<div class="text-start mt-3">'
                + checks.map(function (c) {
                    return '<div class="chk-row"><i class="fas fa-' + (c[1] ? 'circle-check done' : 'circle') + '"></i>'
                        + '<span>' + c[0] + '</span>'
                        + '<span class="ms-auto ' + (c[1] ? 'text-up' : 'text-muted')
                        + '" style="font-size:.78rem;font-weight:700">' + (c[1] ? 'Verified' : 'Pending') + '</span></div>';
                }).join('')
                + '</div>'
                + '<div class="k-alert k-info mt-3 text-start"><i class="fas fa-shield-halved"></i><div>'
                + 'Crypto withdrawals are available only to fully verified customers.</div></div>'
                + '<a href="profile.html#verification" class="btn btn-primary w-100 mt-3">Complete Verification</a>'
                + '<button class="btn btn-soft w-100 mt-2 flow-back">Not Now</button>'
                + '</div>'
            );
        }

        function cryptoFlow() {
            var sel = { asset: 'USDT', network: 'TRC20', mode: 'NGN' };

            function render() {
                var a = KP.ASSETS[sel.asset];
                var rate = KP.rates.withdrawalRate(sel.asset, C().currency);
                var netFee = a.withdrawFee[sel.network] || 0;
                $el.html(
                    backBar('<i class="fas fa-wallet"></i>Withdraw to Crypto Wallet')
                    + '<div class="card p-3 p-md-4">'
                    + '<span class="pill pill-success mb-2"><i class="fas fa-shield-halved"></i>Tier 3 · Fully Verified</span>'
                    + '<div class="bal-strip mb-3"><span>Available Balance</span>'
                    + '<b>' + F().fiat(myBalance(), C().currency) + '</b></div>'

                    + '<label class="form-label">Asset</label>'
                    + '<select class="form-select mb-3" id="cwAsset">'
                    + KP.ASSET_LIST.map(function (x) {
                        return '<option value="' + x.symbol + '"' + (x.symbol === sel.asset ? ' selected' : '') + '>'
                            + x.symbol + ' · ' + x.name + '</option>';
                    }).join('') + '</select>'

                    + '<label class="form-label">Network</label>'
                    + '<select class="form-select mb-3" id="cwNet">'
                    + a.networks.map(function (n) {
                        return '<option value="' + n.id + '"' + (n.id === sel.network ? ' selected' : '') + '>'
                            + n.name + '</option>';
                    }).join('') + '</select>'

                    + '<label class="form-label">Wallet Address</label>'
                    + '<div class="input-group mb-3">'
                    + '<input class="form-control" id="cwAddr" placeholder="Enter wallet address">'
                    + '<button class="btn btn-soft" id="cwPaste"><i class="fas fa-paste"></i></button>'
                    + '<button class="btn btn-soft" id="cwScan"><i class="fas fa-qrcode"></i></button></div>'

                    + '<label class="form-label">Amount</label>'
                    + '<div class="seg w-100 mb-2" id="cwMode" style="display:flex">'
                    + '<button class="flex-grow-1' + (sel.mode === 'NGN' ? ' active' : '') + '" data-m="NGN">Enter ' + C().currency + '</button>'
                    + '<button class="flex-grow-1' + (sel.mode === 'ASSET' ? ' active' : '') + '" data-m="ASSET">Enter ' + sel.asset + '</button></div>'
                    + '<div class="amount-box mb-3">'
                    + '<div class="d-flex align-items-center gap-2">'
                    + '<input type="text" inputmode="decimal" id="cwAmt" placeholder="0.00">'
                    + '<span class="ab-side" style="cursor:default">'
                    + (sel.mode === 'NGN' ? C().currency : sel.asset) + '</span></div></div>'

                    + '<div class="summary-rows mb-3" id="cwSum"></div>'
                    + '<div class="k-alert k-warn mb-3"><i class="fas fa-triangle-exclamation"></i><div>'
                    + 'Check the wallet address and network. Crypto withdrawals cannot be reversed.</div></div>'
                    + '<button class="btn btn-primary w-100 kp-submit" id="cwGo" disabled>Review Withdrawal</button>'
                    + '<p class="text-muted text-center mt-2 mb-0" style="font-size:.72rem">'
                    + '<i class="fas fa-lock me-1"></i>Protected with PIN or biometrics</p>'
                    + '</div>'
                );
                paint();
            }

            function paint() {
                var a = KP.ASSETS[sel.asset];
                var rate = KP.rates.withdrawalRate(sel.asset, C().currency);
                var netFee = a.withdrawFee[sel.network] || 0;
                var svcFee = C().dp === 0 ? 500 : (C().currency === 'NGN' ? 1000 : 5);
                var raw = parseFloat(($('#cwAmt').val() || '').replace(/,/g, '')) || 0;

                var payFiat = sel.mode === 'NGN' ? raw : raw * rate;
                var gets = Math.max(0, (payFiat - svcFee) / rate - netFee);

                $('#cwSum').html(
                    '<div class="sr"><span>Rate</span><span>' + F().fiat(rate, C().currency) + ' / ' + sel.asset + '</span></div>'
                    + '<div class="sr"><span>Network Fee</span><span>' + F().crypto(netFee, sel.asset) + '</span></div>'
                    + '<div class="sr"><span>Service Fee</span><span>' + F().fiat(svcFee, C().currency) + '</span></div>'
                    + '<div class="sr total"><span>Recipient Gets</span><span class="text-up">'
                    + F().crypto(gets, sel.asset) + '</span></div>');

                var addrOk = ($('#cwAddr').val() || '').trim().length >= 26;
                $('#cwGo').prop('disabled', !(payFiat > svcFee && payFiat <= myBalance() && addrOk))
                    .text(payFiat > myBalance() ? 'Insufficient balance'
                        : !addrOk && payFiat > 0 ? 'Enter a wallet address' : 'Review Withdrawal');
            }

            render();

            $el.on('change', '#cwAsset', function () {
                sel.asset = this.value;
                var a = KP.ASSETS[sel.asset];
                if (!a.networks.some(function (n) { return n.id === sel.network; })) sel.network = a.networks[0].id;
                render();
            });
            $el.on('change', '#cwNet', function () { sel.network = this.value; paint(); });
            $el.on('click', '#cwMode button', function () { sel.mode = $(this).data('m'); render(); });
            $el.on('input', '#cwAmt, #cwAddr', paint);
            $el.on('click', '#cwPaste', function () {
                navigator.clipboard.readText().then(function (t) { $('#cwAddr').val(t.trim()); paint(); },
                    function () { KP.rails.toast('Clipboard blocked — paste manually.', 'warning'); });
            });
            $el.on('click', '#cwScan', function () { location.href = 'scan.html'; });

            $el.on('click', '#cwGo', function () {
                var a = KP.ASSETS[sel.asset];
                var rate = KP.rates.withdrawalRate(sel.asset, C().currency);
                var svcFee = C().dp === 0 ? 500 : (C().currency === 'NGN' ? 1000 : 5);
                var raw = parseFloat(($('#cwAmt').val() || '').replace(/,/g, '')) || 0;
                var payFiat = sel.mode === 'NGN' ? raw : raw * rate;
                var gets = Math.max(0, (payFiat - svcFee) / rate - (a.withdrawFee[sel.network] || 0));

                KP.rails.requirePin('Send ' + F().crypto(gets, sel.asset)).then(function (ok) {
                    if (!ok) return;
                    var ref = 'WDR-C' + Math.floor(61200 + payFiat % 900);
                    KP.receipt.show({
                        title: 'Crypto withdrawal', ref: ref,
                        amount: F().crypto(gets, sel.asset),
                        sub: sel.asset + ' · ' + sel.network, status: 'processing',
                        rows: [['Reference', ref], ['Asset', sel.asset], ['Network', sel.network],
                               ['You paid', F().fiat(payFiat, C().currency)],
                               ['Rate', F().fiat(rate, C().currency) + ' / ' + sel.asset],
                               ['To address', ($('#cwAddr').val() || '').slice(0, 24) + '…'],
                               ['Recipient gets', F().crypto(gets, sel.asset)],
                               ['Date', new Date().toLocaleString()]],
                        note: 'On-chain sends are irreversible once broadcast.'
                    });
                });
            });
        }

        var mode = 'chooser';
        chooser();

        $el.on('click', '.method-card', function () {
            mode = $(this).data('m');
            if (mode === 'bank') bankFlow();
            else if (me.tier >= 3) cryptoFlow();
            else locked();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        $el.on('click', '.flow-back', function () { mode = 'chooser'; chooser(); });
        $el.on('click', '#benSeg button', function () {
            $('#benSeg button').removeClass('active'); $(this).addClass('active');
        });
    }

    global.KP = global.KP || {};
    global.KP.flows = { deposit: deposit, withdraw: withdraw, railCard: railCard, stepper: stepper, backBar: backBar };

})(window, jQuery);
