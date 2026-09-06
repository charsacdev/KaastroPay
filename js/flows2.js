/* ==========================================================================
   Kaastro Pay — transfer, request, send abroad, scan, insights, verification
   ========================================================================== */
(function (global, $) {
    'use strict';

    function C() { return KP.currentCountry(); }
    function F() { return KP.fmt; }
    function bal() {
        var me = KP.data.ME, c = C();
        return c.currency === 'NGN' ? me.fiatBalance
            : (me.fiatBalance / KP.USD_RATE.NGN) * KP.USD_RATE[c.currency];
    }
    function balStrip() {
        return '<div class="bal-strip mb-3"><span>Available Balance</span>'
            + '<b>' + F().fiat(bal(), C().currency) + '</b>'
            + '<span class="pill pill-neutral">' + C().currency + '</span></div>';
    }
    /* A handful of Kaastro users to send to. */
    function people(n) {
        return KP.data.USERS.slice(1, 1 + n).map(function (u) {
            return { u: u, handle: '@' + u.name.toLowerCase().split(' ')[0] };
        });
    }

    /* ========================== T R A N S F E R ========================== */

    function transfer($el) {
        var picked = null;

        function list() {
            var favs = people(3), recents = people(6).slice(3);
            $el.html(
                '<div id="guard"></div>'
                + '<div class="card p-3 p-md-4">'
                + '<h2 class="card-title mb-1">Transfer</h2>'
                + '<p class="text-muted mb-3" style="font-size:.83rem">'
                + 'Send ' + C().currency + ' to another Kaastro Pay user. Instant and free.</p>'

                + '<div class="input-group mb-3">'
                + '<span class="input-group-text"><i class="fas fa-magnifying-glass"></i></span>'
                + '<input class="form-control" id="tSearch" placeholder="Name, phone number or Kaastro ID"></div>'

                + '<div class="section-head"><h2>Favourites</h2><a href="#" class="text-primary-k">See all</a></div>'
                + '<div class="fav-row mb-3">'
                + favs.map(function (p) {
                    return '<button class="fav-chip pick-user" data-id="' + p.u.id + '">'
                        + '<span class="fav-av"><img src="../images/' + p.u.avatar + '" alt="">'
                        + '<i class="fas fa-circle-check"></i></span>'
                        + '<span>' + p.u.name.split(' ')[0] + '</span></button>';
                }).join('') + '</div>'

                + '<div class="section-head"><h2>Recent Kaastro Users</h2></div>'
                + recents.map(function (p) {
                    return '<button class="asset-row w-100 text-start pick-user" data-id="' + p.u.id + '" '
                        + 'style="background:none;border:none;border-bottom:1px solid var(--border-color)">'
                        + '<img src="../images/' + p.u.avatar + '" class="rounded-circle" width="38" height="38" alt="">'
                        + '<span class="flex-grow-1 min-w-0"><span class="ar-name d-block">' + p.u.name + '</span>'
                        + '<span class="ar-sub">' + p.handle + '</span></span>'
                        + '<i class="fas fa-chevron-right text-muted"></i></button>';
                }).join('')

                + '<a href="scan.html" class="btn btn-soft w-100 mt-3">'
                + '<i class="fas fa-qrcode me-2"></i>Scan Kaastro QR</a>'
                + '<div class="k-alert k-ok mt-3"><i class="fas fa-bolt"></i><div>'
                + 'Instant, free transfers to other Kaastro Pay users.</div></div>'
                + '</div>'
            );
            KP.rails.guardPanic($('#guard'), 'Transfers');
        }

        function amountStep(u) {
            var handle = '@' + u.name.toLowerCase().split(' ')[0];
            $el.html(
                KP.flows.backBar('<i class="fas fa-paper-plane"></i>Transfer')
                + '<div class="card p-3 p-md-4">'
                + '<div class="rv-user mb-3">'
                + '<img src="../images/' + u.avatar + '" class="rounded-circle" width="46" height="46" alt="">'
                + '<div class="min-w-0"><div class="rv-user-name">' + u.name + '</div>'
                + '<div class="rv-user-sub">' + handle + ' · Kaastro Pay</div></div>'
                + '<span class="pill pill-success ms-auto"><i class="fas fa-circle-check"></i>Verified</span></div>'
                + balStrip()
                + '<label class="form-label">Amount to send</label>'
                + '<div class="amount-box mb-3"><div class="d-flex align-items-center gap-2">'
                + '<input type="text" inputmode="decimal" id="trAmt" placeholder="0.00">'
                + '<span class="ab-side" style="cursor:default">' + C().currency + '</span></div></div>'
                + '<label class="form-label">Note (optional)</label>'
                + '<textarea class="form-control mb-1" id="trNote" rows="2" maxlength="50" placeholder="What’s this for?"></textarea>'
                + '<div class="form-text mb-3 text-end"><span id="trCount">0</span>/50</div>'
                + '<div class="summary-rows mb-3" id="trSum"></div>'
                + '<button class="btn btn-primary w-100 kp-submit" id="trGo" disabled>Continue</button>'
                + '</div>'
            );
            function paint() {
                var v = parseFloat(($('#trAmt').val() || '').replace(/,/g, '')) || 0;
                $('#trSum').html(
                    '<div class="sr"><span>Transfer fee</span><span class="text-up">Free</span></div>'
                    + '<div class="sr total"><span>' + u.name.split(' ')[0] + ' receives</span>'
                    + '<span>' + F().fiat(v, C().currency) + '</span></div>');
                $('#trGo').prop('disabled', !(v > 0 && v <= bal()))
                    .text(v > bal() ? 'Insufficient balance' : v ? 'Send ' + F().fiat(v, C().currency) : 'Continue');
            }
            $el.on('input', '#trAmt', paint);
            $el.on('input', '#trNote', function () { $('#trCount').text(this.value.length); });
            paint();

            $el.on('click', '#trGo', function () {
                var v = parseFloat(($('#trAmt').val() || '').replace(/,/g, '')) || 0;
                KP.rails.requirePin('Send ' + F().fiat(v, C().currency) + ' to ' + u.name).then(function (ok) {
                    if (!ok) return;
                    var ref = 'TRF-' + Math.floor(64300 + v % 900);
                    KP.receipt.show({
                        title: 'Money sent', ref: ref, amount: F().fiat(v, C().currency),
                        sub: 'to ' + u.name + ' · ' + handle, status: 'successful',
                        rows: [['Reference', ref], ['Recipient', u.name], ['Handle', handle],
                               ['Amount', F().fiat(v, C().currency)], ['Fee', 'Free'],
                               ['Note', $('#trNote').val() || '—'], ['Date', new Date().toLocaleString()]],
                        note: 'Instant transfer between Kaastro Pay accounts.'
                    });
                });
            });
        }

        list();
        $el.on('click', '.pick-user', function () {
            picked = KP.data.USERS.filter(function (u) { return u.id === $(this).data('id'); }.bind(this))[0];
            if (picked) { amountStep(picked); window.scrollTo({ top: 0, behavior: 'smooth' }); }
        });
        $el.on('click', '.flow-back', list);
    }

    /* ============================ R E Q U E S T ============================
       Two shapes of request. From another Kaastro user, which is a notification
       they approve in-app. Or a crypto payment link, which is a public page
       anyone can open — they see who is asking, send crypto to the address on
       it, and the requester is credited in Naira. The payer needs no account,
       so everything that page renders travels in the link itself. */

    function request($el) {
        var me = KP.data.ME;

        function handle() {
            return '@' + me.name.toLowerCase().split(' ')[0];
        }

        function chooser() {
            $el.html(
                '<div class="card p-3 p-md-4">'
                + '<h2 class="card-title mb-1">Request Payment</h2>'
                + '<p class="text-muted mb-3" style="font-size:.83rem">Choose how you want to request payment.</p>'
                + '<div class="d-grid gap-2">'
                + KP.flows.railCard({
                    id: 'user', icon: 'fa-user-plus', tone: 'qa-green',
                    title: 'Request from Kaastro User',
                    desc: 'Request ' + C().currency + ' directly from a Kaastro Pay contact.',
                    meta: [['fa-bolt', 'Instant notification']]
                })
                + KP.flows.railCard({
                    id: 'link', icon: 'fa-link', tone: 'qa-amber',
                    title: 'Request Crypto Payment',
                    desc: 'Create a link, send it to your client, and receive the '
                        + C().currency + ' equivalent.',
                    meta: [['fa-arrows-rotate', 'Converts automatically', 'pill-manual']]
                })
                + '</div>'
                + '<div class="how-strip mt-3"><div class="hs-title">How crypto requests work</div>'
                + '<div class="hs-row">'
                + [['fa-pen-to-square', 'Enter amount'], ['fa-link', 'Share link'],
                   ['fa-wallet', 'Receive ' + C().currency]]
                    .map(function (x, i) {
                        return (i ? '<i class="fas fa-chevron-right hs-sep"></i>' : '')
                            + '<span class="hs-step"><i class="fas ' + x[0] + '"></i>' + x[1] + '</span>';
                    }).join('') + '</div></div>'
                + '<div class="k-alert k-ok mt-3"><i class="fas fa-shield-halved"></i><div>'
                + 'Kaastro Pay does not store cryptocurrency.</div></div>'
                + '</div>'
            );
        }

        /* ---------------------- request from a Kaastro user ---------------------- */

        function userForm() {
            var contacts = KP.data.contacts('kaastro');
            $el.html(
                KP.flows.backBar('<i class="fas fa-hand-holding-dollar"></i>Request from Kaastro User')
                + '<div class="card p-3 p-md-4">'
                + '<label class="form-label">Request from</label>'
                + '<select class="form-select mb-3" id="rqWho">'
                + contacts.map(function (c) {
                    return '<option value="' + c.id + '">' + c.name + ' · ' + c.handle + '</option>';
                }).join('') + '</select>'
                + '<label class="form-label">Amount</label>'
                + '<div class="amount-box mb-3"><div class="d-flex align-items-center gap-2">'
                + '<input type="text" inputmode="decimal" id="rqAmt" placeholder="0.00">'
                + '<span class="ab-side" style="cursor:default">' + C().currency + '</span></div></div>'
                + '<label class="form-label">What is it for?</label>'
                + '<input class="form-control mb-3" id="rqWhy" placeholder="Invoice 0042, rent, materials…">'
                + '<button class="btn btn-primary w-100" id="rqSend">Send request</button>'
                + '<p class="text-muted text-center mt-2 mb-0" style="font-size:.75rem">'
                + 'Your balance is not affected until they pay.</p></div>'
            );
        }

        /* ------------------------- crypto payment link ------------------------- */

        /* kind decides the whole link: 'crypto' collects into a wallet address,
           'bank' into a dedicated collection account. Both end on the same
           public page and share one status vocabulary. */
        var link = { kind: 'crypto', asset: 'USDT', network: 'TRC20', amount: 0,
                     why: '', expiry: '24 hours', ref: null };

        function linkForm() {
            var a = KP.ASSETS[link.asset];
            var rate = KP.rates.depositRate(link.asset, C().currency);
            var isBank = link.kind === 'bank';

            $el.html(
                KP.flows.backBar('<i class="fas fa-' + (isBank ? 'building-columns' : 'link') + '"></i>'
                    + (isBank ? 'Bank Payment Link' : 'Crypto Payment Link'))
                + '<div class="card p-3 p-md-4">'
                + '<h2 class="card-title mb-1">'
                + (isBank ? 'Request Bank Payment' : 'Request Crypto Payment') + '</h2>'
                + '<p class="text-muted mb-3" style="font-size:.83rem">'
                + (isBank
                    ? 'Your client transfers ' + C().currency + ' from any bank. No crypto, and no account with us.'
                    : 'Your client pays in crypto. You are credited in ' + C().currency + '.') + '</p>'

                + '<div class="summary-rows mb-3">'
                + '<div class="sr"><span>Requested by</span><span>' + me.name + '</span></div>'
                + '<div class="sr total"><span>Your handle</span><span>' + handle() + '</span></div></div>'

                + '<label class="form-label">Expected amount</label>'
                + '<div class="amount-box mb-3"><div class="d-flex align-items-center gap-2">'
                + '<input type="text" inputmode="decimal" id="lkAmt" placeholder="0.00">'
                + '<span class="ab-side" style="cursor:default">' + C().currency + '</span></div></div>'

                + (isBank ? '' :
                  '<div class="row g-2 mb-3">'
                + '<div class="col-6"><label class="form-label">Asset</label>'
                + '<select class="form-select" id="lkAsset">'
                + KP.ASSET_LIST.map(function (x) {
                    return '<option value="' + x.symbol + '"' + (x.symbol === link.asset ? ' selected' : '') + '>'
                        + x.symbol + ' · ' + x.name + '</option>';
                }).join('') + '</select></div>'
                + '<div class="col-6"><label class="form-label">Network</label>'
                + '<select class="form-select" id="lkNet">'
                + a.networks.map(function (n) {
                    return '<option value="' + n.id + '"' + (n.id === link.network ? ' selected' : '') + '>'
                        + n.id + '</option>';
                }).join('') + '</select></div></div>')

                + '<label class="form-label">Description <span class="text-muted">(optional)</span></label>'
                + '<input class="form-control mb-3" id="lkWhy" placeholder="Website design, Invoice #104…">'

                + '<label class="form-label">Link expires in</label>'
                + '<div class="seg mb-3" id="lkExp">'
                + ['1 hour', '24 hours', '3 days', 'No expiry'].map(function (e) {
                    return '<button class="' + (e === link.expiry ? 'active' : '') + '" data-e="' + e + '">'
                        + e + '</button>';
                }).join('') + '</div>'

                + '<div class="summary-rows mb-3" id="lkQuote">'
                + (isBank
                    ? '<div class="sr"><span>Rail</span><span>Bank transfer</span></div>'
                      + '<div class="sr"><span>Payer sends</span><span id="lkSends">—</span></div>'
                    : '<div class="sr"><span>Rate</span><span>' + F().fiat(rate, C().currency)
                      + ' / ' + link.asset + '</span></div>'
                      + '<div class="sr"><span>Payer sends</span><span id="lkSends">—</span></div>')
                + '<div class="sr total"><span>You receive</span>'
                + '<span class="text-up" id="lkGets">' + F().fiat(0, C().currency) + '</span></div></div>'

                + '<div class="k-alert k-info mb-3"><i class="fas fa-circle-info"></i><div>'
                + 'Whoever opens the link sees your verified name, the amount and what it is for. '
                + (isBank
                    ? 'They transfer from any bank quoting the reference on the page, and you are credited on arrival.'
                    : 'They choose a network, send crypto, and you receive ' + C().currency
                      + ' at the deposit rate the moment it confirms.')
                + ' No account is needed to pay.</div></div>'

                + '<button class="btn btn-primary w-100" id="lkGo">Create payment link</button></div>'
            );
            quote();
        }

        function quote() {
            var v = parseFloat(($('#lkAmt').val() || '').replace(/,/g, '')) || 0;
            var rate = KP.rates.depositRate(link.asset, C().currency);
            $('#lkSends').text(!v ? '—'
                : link.kind === 'bank' ? F().fiat(v, C().currency)
                : F().crypto(v / rate, link.asset));
            $('#lkGets').text(F().fiat(v, C().currency));
        }

        /* The public URL. Everything the payer page renders is in the query, so
           it works for someone with no account and no session. */
        function payUrl() {
            var q = [
                'r=' + link.ref,
                'n=' + encodeURIComponent(me.name),
                'h=' + encodeURIComponent(handle()),
                'a=' + link.amount,
                'c=' + C().currency,
                'k=' + link.kind,
                'as=' + link.asset,
                'nw=' + link.network,
                'd=' + encodeURIComponent(link.why || ''),
                'x=' + encodeURIComponent(link.expiry)
            ].join('&');
            return location.origin + location.pathname.replace(/dashboard\/.*$/, '') + 'pay.html?' + q;
        }

        function created() {
            var url = payUrl();
            var rate = KP.rates.depositRate(link.asset, C().currency);
            var isBank = link.kind === 'bank';
            var sends = link.amount / rate;

            $el.html(
                KP.flows.backBar('<i class="fas fa-link"></i>Payment Link')
                + '<div class="card p-3 p-md-4">'
                + '<div class="result-hero">'
                + '<div class="rh-ico"><i class="fas fa-check"></i></div>'
                + '<div class="rh-amt">' + F().fiat(link.amount, C().currency) + '</div>'
                + '<div class="rh-sub">'
                + (isBank ? 'Payer transfers ' + F().fiat(link.amount, C().currency) + ' from any bank'
                          : 'Payer sends ' + F().crypto(sends, link.asset) + ' · ' + link.network)
                + '</div>'
                + '<div class="mt-2"><span class="pill pill-manual">'
                + (link.expiry === 'No expiry' ? 'Never expires' : 'Expires in ' + link.expiry)
                + '</span></div></div>'

                + '<div class="text-center mt-3"><div class="qr-box" id="lkQr"></div></div>'

                + '<div class="address-box mt-3" style="font-size:.72rem">' + url + '</div>'
                + '<div class="d-flex gap-2 mt-2">'
                + '<button class="btn btn-primary flex-grow-1 kp-copy" data-copy="' + url + '">'
                + '<i class="fas fa-copy me-1"></i>Copy link</button>'
                + '<button class="btn btn-soft flex-grow-1" id="lkShare">'
                + '<i class="fas fa-share-nodes me-1"></i>Share</button></div>'
                + '<a class="btn btn-soft w-100 mt-2" href="' + url + '" target="_blank" rel="noopener">'
                + '<i class="fas fa-arrow-up-right-from-square me-1"></i>Preview what your client sees</a>'

                + '<div class="summary-rows mt-3">'
                + '<div class="sr"><span>Reference</span><span>' + link.ref + '</span></div>'
                + '<div class="sr"><span>Requested by</span><span>' + me.name + '</span></div>'
                + '<div class="sr"><span>Rail</span><span>'
                + (isBank ? 'Bank transfer · ' + C().currency : link.asset + ' · ' + link.network) + '</span></div>'
                + '<div class="sr"><span>Description</span><span>' + (link.why || '—') + '</span></div>'
                + '<div class="sr total"><span>You receive</span><span class="text-up">'
                + F().fiat(link.amount, C().currency) + '</span></div></div>'

                + '<div class="k-alert k-warn mt-3" id="lkWait"><i class="fas fa-clock"></i><div>'
                + '<b class="hd">Waiting for payment.</b>'
                + 'We will notify you the moment your client’s payment confirms.</div></div>'

                + '<button class="btn btn-soft w-100 mt-1" id="lkCancel">Cancel request</button>'
                + '<p class="text-muted text-center mt-2 mb-0" style="font-size:.74rem">'
                + '<i class="fas fa-shield-halved me-1"></i>'
                + 'Crypto received is converted to ' + C().currency + ' automatically.</p>'
                + '</div>'
            );

            $('#lkQr').empty();
            if (typeof QRCode === 'function') {
                new QRCode(document.getElementById('lkQr'), {
                    text: url, width: 178, height: 178,
                    colorDark: '#0f172a', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M
                });
            }
        }

        /* ------------------------------- wiring ------------------------------- */

        chooser();

        $el.on('click', '.method-card', function () {
            var m = $(this).data('m');
            if (m === 'link') linkForm();
            else userForm();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        $el.on('click', '.flow-back', function () { chooser(); });

        $el.on('input', '#lkAmt', quote);
        $el.on('change', '#lkAsset', function () {
            link.asset = $(this).val();
            link.network = KP.ASSETS[link.asset].networks[0].id;
            linkForm();
        });
        $el.on('change', '#lkNet', function () { link.network = $(this).val(); quote(); });
        $el.on('click', '#lkExp button', function () {
            $('#lkExp button').removeClass('active');
            $(this).addClass('active');
            link.expiry = $(this).data('e');
        });

        $el.on('click', '#lkGo', function () {
            var v = parseFloat(($('#lkAmt').val() || '').replace(/,/g, '')) || 0;
            if (!v) { KP.rails.toast('Enter the amount you are requesting.', 'danger'); return; }
            link.amount = v;
            link.why = ($('#lkWhy').val() || '').trim();
            link.ref = 'KPR-' + Math.floor(200000 + Math.random() * 799999);
            created();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });

        $el.on('click', '#lkShare', function () {
            var url = payUrl();
            if (navigator.share) {
                navigator.share({
                    title: 'Payment request from ' + me.name,
                    text: me.name + ' is requesting ' + F().fiat(link.amount, C().currency),
                    url: url
                });
            } else {
                navigator.clipboard.writeText(url);
                KP.rails.toast('Payment link copied.');
            }
        });

        $el.on('click', '#lkCancel', function () {
            KP.rails.sheet('Cancel this request?',
                '<p class="text-muted" style="font-size:.83rem">The link stops working immediately. '
                + 'Anyone who opens it afterwards sees that it was cancelled.</p>'
                + '<div class="d-grid gap-2">'
                + '<button class="btn btn-danger" id="lkCancelYes">Cancel request</button>'
                + '<button class="btn btn-soft" data-bs-dismiss="modal">Keep it active</button></div>');
        });
        $(document).on('click', '#lkCancelYes', function () {
            KP.rails.closeSheet();
            KP.rails.toast('Payment request cancelled.');
            chooser();
        });

        $el.on('click', '#rqSend', function () {
            var v = parseFloat(($('#rqAmt').val() || '').replace(/,/g, '')) || 0;
            if (!v) { KP.rails.toast('Enter an amount.', 'danger'); return; }
            var who = KP.data.findContact($('#rqWho').val());
            var ref = 'KPR-' + Math.floor(200000 + Math.random() * 799999);
            KP.receipt.show({
                title: 'Request sent', amount: F().fiat(v, C().currency),
                sub: 'Requested from ' + (who ? who.name : ''), status: 'pending',
                rows: [['Reference', ref], ['From', who ? who.name + ' · ' + who.handle : ''],
                       ['Amount', F().fiat(v, C().currency)],
                       ['Reason', $('#rqWhy').val() || '—'], ['Date', new Date().toLocaleString()]],
                note: 'They get a notification straight away.'
            });
        });
    }

    /* ======================== S E N D  A B R O A D ======================== */

    function sendAbroad($el) {
        var sel = null;

        function list() {
            $el.html(
                '<div id="guard"></div>'
                + '<div class="card p-3 p-md-4">'
                + '<h2 class="card-title mb-1">Send Abroad</h2>'
                + '<p class="text-muted mb-3" style="font-size:.83rem">'
                + 'Send money from your ' + C().currency + ' balance to family and friends across Africa.</p>'
                + balStrip()
                + '<div class="section-head"><h2>Where to?</h2></div>'
                + '<div class="d-grid gap-2">'
                + KP.data.CORRIDORS.map(function (c) {
                    return '<button class="net-opt pick-corr" data-to="' + c.to + '">'
                        + '<span style="font-size:1.5rem">' + c.flag + '</span>'
                        + '<span><span class="no-name">' + c.name + ' · ' + c.ccy + '</span>'
                        + '<span class="no-sub">' + c.rail + '</span></span>'
                        + '<span class="ms-auto text-end flex-shrink-0">'
                        + '<span class="pill pill-neutral"><i class="fas fa-clock"></i>' + c.eta + '</span></span>'
                        + '</button>';
                }).join('') + '</div></div>'
            );
            KP.rails.guardPanic($('#guard'), 'Transfers');
        }

        function form(c) {
            var fee = 500;
            var rate = KP.rates.remitRate(C().currency, c.ccy);
            $el.html(
                KP.flows.backBar(c.flag + ' ' + c.name)
                + '<div class="card p-3 p-md-4">'
                + '<h2 class="card-title mb-1">Send to ' + c.name + '</h2>'
                + '<p class="text-muted mb-3" style="font-size:.83rem">'
                + 'Paid out through ' + c.rail + '.</p>'
                + balStrip()
                + '<label class="form-label">You send</label>'
                + '<div class="amount-box mb-2"><div class="d-flex align-items-center gap-2">'
                + '<input type="text" inputmode="decimal" id="saAmt" placeholder="0.00">'
                + '<span class="ab-side" style="cursor:default">' + C().currency + '</span></div></div>'
                + '<div class="d-flex justify-content-center" style="margin:-6px 0"><div class="swap-flip">'
                + '<i class="fas fa-arrow-down"></i></div></div>'
                + '<label class="form-label">They receive (estimated)</label>'
                + '<div class="amount-box mb-3"><div class="d-flex align-items-center gap-2">'
                + '<input type="text" id="saGet" readonly placeholder="0.00">'
                + '<span class="ab-side" style="cursor:default">' + c.flag + ' ' + c.ccy + '</span></div></div>'

                + '<label class="form-label">Recipient name</label>'
                + '<input class="form-control mb-3" id="saName" placeholder="As it appears on their account">'
                + '<label class="form-label">Payout method</label>'
                + '<select class="form-select mb-3" id="saRail">'
                + c.rail.split(' · ').map(function (r) { return '<option>' + r + '</option>'; }).join('')
                + '</select>'
                + '<label class="form-label">Account or phone number</label>'
                + '<input class="form-control mb-3" id="saAcct" placeholder="Where the money lands">'

                + '<div class="summary-rows mb-3" id="saSum"></div>'
                + '<button class="btn btn-primary w-100 kp-submit" id="saGo" disabled>Continue</button>'
                + '<p class="text-muted text-center mt-2 mb-0" style="font-size:.72rem">'
                + '<i class="fas fa-clock me-1"></i>Arrives in ' + c.eta.toLowerCase() + '</p></div>'
            );

            function paint() {
                var v = parseFloat(($('#saAmt').val() || '').replace(/,/g, '')) || 0;
                var out = Math.max(0, v - fee) * rate;
                $('#saGet').val(out ? F().fiat(out, c.ccy, { noSymbol: true }) : '');
                $('#saSum').html(
                    '<div class="sr"><span>Exchange rate</span><span>1 ' + C().currency + ' = '
                    + rate.toFixed(4) + ' ' + c.ccy + '</span></div>'
                    + '<div class="sr"><span>Fee</span><span>' + F().fiat(fee, C().currency) + '</span></div>'
                    + '<div class="sr total"><span>They receive</span><span class="text-up">'
                    + F().fiat(out, c.ccy) + '</span></div>');
                var ok = v > fee && v <= bal() && ($('#saName').val() || '').trim().length > 2
                    && ($('#saAcct').val() || '').trim().length >= 6;
                $('#saGo').prop('disabled', !ok)
                    .text(v > bal() ? 'Insufficient balance' : 'Continue');
            }
            $el.on('input', '#saAmt, #saName, #saAcct', paint);
            paint();

            $el.on('click', '#saGo', function () {
                var v = parseFloat(($('#saAmt').val() || '').replace(/,/g, '')) || 0;
                var out = Math.max(0, v - fee) * rate;
                KP.rails.requirePin('Send ' + F().fiat(v, C().currency) + ' to ' + c.name).then(function (ok) {
                    if (!ok) return;
                    var ref = 'ABR-' + Math.floor(71400 + v % 900);
                    KP.receipt.show({
                        title: 'Money sent abroad', ref: ref, amount: F().fiat(out, c.ccy),
                        sub: 'to ' + $('#saName').val() + ' · ' + c.name, status: 'processing',
                        rows: [['Reference', ref], ['Destination', c.name],
                               ['Recipient', $('#saName').val()], ['Payout', $('#saRail').val()],
                               ['Account', $('#saAcct').val()],
                               ['You sent', F().fiat(v, C().currency)],
                               ['Fee', F().fiat(fee, C().currency)],
                               ['Rate', '1 ' + C().currency + ' = ' + rate.toFixed(4) + ' ' + c.ccy],
                               ['They receive', F().fiat(out, c.ccy)],
                               ['Date', new Date().toLocaleString()]],
                        note: 'Arrives in ' + c.eta.toLowerCase() + '.'
                    });
                });
            });
        }

        list();
        $el.on('click', '.pick-corr', function () {
            sel = KP.data.CORRIDORS.filter(function (c) { return c.to === $(this).data('to'); }.bind(this))[0];
            if (sel) { form(sel); window.scrollTo({ top: 0, behavior: 'smooth' }); }
        });
        $el.on('click', '.flow-back', list);
    }

    /* ============================== S C A N ==============================
       Kaastro-to-Kaastro only. There is no merchant acquiring product here:
       a QR always resolves to another Kaastro Pay user, so the whole flow can
       assume a handle on the other end and skip merchant-ID handling. */

    function scan($el) {
        var me = KP.data.ME;
        var target = null;

        function contactCard(c, sub) {
            return '<div class="d-flex align-items-center gap-3 p-3 rounded-3"'
                + ' style="background:var(--bg-sunk);border:1px solid var(--border-color)">'
                + '<span class="kp-avatar ring">'
                + (c.avatar ? '<img src="../images/' + c.avatar + '" alt="">'
                            : c.name.slice(0, 2).toUpperCase())
                + '<span class="av-check"><i class="fas fa-check"></i></span></span>'
                + '<div class="min-w-0"><div class="fw-bold text-truncate">' + c.name + '</div>'
                + '<div class="text-muted text-truncate" style="font-size:.76rem">'
                + (sub || c.handle + ' · Kaastro Pay user') + '</div></div></div>';
        }

        function scanner() {
            target = null;
            var recent = KP.data.contacts('kaastro').slice(0, 3);
            $el.html(
                '<div class="card p-3 p-md-4">'
                + '<p class="text-center text-muted mb-3" style="font-size:.85rem">'
                + 'Scan another Kaastro Pay user’s QR code</p>'
                + '<div class="scanner"><div class="sc-frame">'
                + '<span class="c tl"></span><span class="c tr"></span><span class="c bl"></span><span class="c br"></span>'
                + '<span class="sc-line"></span></div>'
                + '<div class="sc-hint"><i class="fas fa-camera"></i>Camera preview</div></div>'
                + '<p class="text-center text-muted mt-3 mb-2" style="font-size:.83rem">'
                + 'Point your camera at a Kaastro Pay user’s code or a payment request</p>'
                + '<p class="text-center mb-3" style="font-size:.78rem">'
                + '<i class="fas fa-shield-halved text-primary-k me-1"></i>'
                + 'Always confirm the recipient before paying</p>'
                + '<div class="row g-2 mb-3">'
                + [['fa-image', 'Upload QR'], ['fa-qrcode', 'My QR'], ['fa-keyboard', 'Enter Code']]
                    .map(function (x) {
                        return '<div class="col-4"><button class="biller-tile sc-act" data-a="' + x[1] + '">'
                            + '<span class="qa-icon qa-green"><i class="fas ' + x[0] + '"></i></span>'
                            + '<span>' + x[1] + '</span></button></div>';
                    }).join('') + '</div>'
                + '<button class="btn btn-soft w-100 text-primary-k mb-2" id="torch">'
                + '<i class="fas fa-lightbulb me-2"></i>Turn on flashlight</button>'
                + '<button class="btn btn-primary w-100" id="simScan">'
                + '<i class="fas fa-qrcode me-1"></i>Simulate a scan</button>'
                + '</div>'

                + '<div class="card p-3 mt-3">'
                + '<div class="section-head"><h2>Scan someone you know</h2>'
                + '<a href="contacts.html" class="text-primary-k">All contacts</a></div>'
                + recent.map(function (c) {
                    return '<button class="contact-row sc-pick" data-id="' + c.id + '">'
                        + '<span class="kp-avatar sm ring">'
                        + '<img src="../images/' + c.avatar + '" alt="">'
                        + '<span class="av-check"><i class="fas fa-check"></i></span></span>'
                        + '<span class="flex-grow-1 min-w-0">'
                        + '<span class="cr-name d-block text-truncate">' + c.name + '</span>'
                        + '<span class="cr-sub d-block text-truncate">' + c.handle + '</span></span>'
                        + '<i class="fas fa-chevron-right text-muted"></i></button>';
                }).join('') + '</div>'

                + '<div class="card p-3 mt-3">'
                + '<div class="section-head"><h2>Recent QR Payments</h2>'
                + '<a href="insights.html" class="text-primary-k">See all</a></div>'
                + KP.data.contacts('kaastro').slice(0, 2).map(function (c, i) {
                    return '<div class="tx-row"><div class="tx-icon tx-out"><i class="fas fa-qrcode"></i></div>'
                        + '<div class="tx-meta"><b>' + c.name + '</b>'
                        + '<small>Paid · ' + c.handle + '</small></div>'
                        + '<div class="tx-amt-col"><span class="amt">'
                        + F().fiat(i ? 25000 : 8500, C().currency) + '</span></div></div>';
                }).join('') + '</div>'
            );
        }

        /* --- the code resolved to a user --- */
        function result(c) {
            target = c;
            $el.html(
                KP.flows.backBar('<i class="fas fa-qrcode"></i>Scan Result')
                + '<div class="card p-3 p-md-4">'
                + contactCard(c)
                + '<label class="form-label mt-3">Amount</label>'
                + '<div class="amount-box mb-2"><div class="d-flex align-items-center gap-2">'
                + '<input type="text" inputmode="decimal" id="scAmt" placeholder="0.00">'
                + '<span class="ab-side" style="cursor:default">' + C().currency + '</span></div></div>'
                + '<div class="d-flex gap-2 mb-3">'
                + [1000, 5000, 10000].map(function (v) {
                    return '<button class="btn btn-soft btn-sm flex-grow-1 sc-quick" data-v="' + v + '">'
                        + F().fiat(v, C().currency) + '</button>';
                }).join('') + '</div>'
                + '<label class="form-label">Note <span class="text-muted">(optional)</span></label>'
                + '<input class="form-control mb-3" id="scNote" placeholder="What is this for?">'
                + '<div class="summary-rows mb-3">'
                + '<div class="sr"><span>Available balance</span><span>'
                + F().fiat(me.fiatBalance, C().currency) + '</span></div>'
                + '<div class="sr total"><span>Fee</span><span class="text-up">'
                + F().fiat(0, C().currency) + '</span></div></div>'
                + '<button class="btn btn-primary w-100" id="scNext">Continue</button>'
                + '<p class="text-muted text-center mt-2 mb-0" style="font-size:.75rem">'
                + '<i class="fas fa-shield-halved me-1"></i>Confirm the name before you pay.</p>'
                + '</div>'
            );
        }

        function confirm(amount, note) {
            $el.html(
                KP.flows.backBar('<i class="fas fa-qrcode"></i>Confirm Payment')
                + '<div class="card p-3 p-md-4">'
                + '<div class="result-hero">'
                + '<div class="text-muted" style="font-size:.8rem">You are paying</div>'
                + '<div class="rh-amt">' + F().fiat(amount, C().currency) + '</div>'
                + '</div>'
                + '<div class="mt-3">' + contactCard(target) + '</div>'
                + '<div class="summary-rows mt-3">'
                + '<div class="sr"><span>Amount</span><span>' + F().fiat(amount, C().currency) + '</span></div>'
                + '<div class="sr"><span>Fee</span><span class="text-up">' + F().fiat(0, C().currency) + '</span></div>'
                + '<div class="sr"><span>Note</span><span>' + (note || '—') + '</span></div>'
                + '<div class="sr total"><span>Balance after payment</span><span>'
                + F().fiat(me.fiatBalance - amount, C().currency) + '</span></div></div>'
                + '<button class="btn btn-primary w-100 mt-3" id="scPay">Confirm payment</button>'
                + '<button class="btn btn-soft w-100 mt-2" id="scCancel">Cancel</button>'
                + '<p class="text-muted text-center mt-2 mb-0" style="font-size:.75rem">'
                + '<i class="fas fa-lock me-1"></i>Protected with PIN or biometrics</p>'
                + '</div>'
            );
        }

        function done(amount, note) {
            var ref = 'KPT-' + Math.floor(200000 + Math.random() * 799999);
            $el.html(
                '<div class="card p-3 p-md-4">'
                + '<div class="result-hero">'
                + '<div class="rh-ico"><i class="fas fa-check"></i></div>'
                + '<div class="rh-amt">' + F().fiat(amount, C().currency) + '</div>'
                + '<div class="rh-sub">Paid to ' + target.name + '</div>'
                + '<div class="mt-2"><span class="pill pill-success">'
                + '<i class="fas fa-circle-check"></i>Completed</span></div></div>'
                + '<div class="summary-rows mt-3">'
                + '<div class="sr"><span>To</span><span>' + target.handle + '</span></div>'
                + '<div class="sr"><span>Reference</span><span>' + ref + '</span></div>'
                + '<div class="sr"><span>Note</span><span>' + (note || '—') + '</span></div>'
                + '<div class="sr"><span>Date</span><span>' + new Date().toLocaleString() + '</span></div>'
                + '<div class="sr total"><span>New balance</span><span class="text-up">'
                + F().fiat(me.fiatBalance - amount, C().currency) + '</span></div></div>'
                + '<button class="btn btn-primary w-100 mt-3" id="scReceipt">'
                + '<i class="fas fa-receipt me-1"></i>Share receipt</button>'
                + '<button class="btn btn-soft w-100 mt-2" id="scAgain">Scan again</button>'
                + '<a href="index.html" class="btn btn-soft w-100 mt-2">Back to home</a>'
                + '</div>'
            );

            $el.data('lastPay', { ref: ref, amount: amount, note: note });
        }

        scanner();

        $el.on('click', '.flow-back, #scAgain, #scCancel', function () {
            scanner();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });

        /* No camera in a prototype, so a scan resolves to a saved contact. */
        $el.on('click', '#simScan', function () {
            var pool = KP.data.contacts('kaastro');
            result(pool[Math.floor(Math.random() * pool.length)]);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        $el.on('click', '.sc-pick', function () {
            result(KP.data.findContact($(this).data('id')));
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });

        $el.on('click', '.sc-quick', function () { $('#scAmt').val($(this).data('v')); });

        $el.on('click', '#scNext', function () {
            var v = parseFloat(($('#scAmt').val() || '').replace(/,/g, '')) || 0;
            if (!v) { KP.rails.toast('Enter an amount.', 'danger'); return; }
            if (v > me.fiatBalance) { KP.rails.toast('That is more than your balance.', 'danger'); return; }
            confirm(v, $('#scNote').val().trim());
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });

        $el.on('click', '#scPay', function () {
            var amt = parseFloat(($('.rh-amt').text() || '').replace(/[^0-9.]/g, '')) || 0;
            var note = $('.summary-rows .sr:nth-child(3) span:last-child').text();
            KP.rails.requirePin('Pay ' + F().fiat(amt, C().currency) + ' to ' + target.name)
                .then(function (ok) {
                    if (!ok) return;
                    done(amt, note === '—' ? '' : note);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                });
        });

        $el.on('click', '#scReceipt', function () {
            var d = $el.data('lastPay') || {};
            KP.receipt.show({
                title: 'Payment receipt',
                amount: F().fiat(d.amount, C().currency),
                sub: 'Paid to ' + target.name,
                status: 'successful',
                rows: [
                    ['To', target.name], ['Handle', target.handle],
                    ['Reference', d.ref], ['Note', d.note || '—'],
                    ['Fee', F().fiat(0, C().currency)],
                    ['Date', new Date().toLocaleString()]
                ],
                note: 'Kaastro to Kaastro payments are instant and free.'
            });
        });

        $el.on('click', '.sc-act', function () {
            var a = $(this).data('a');
            if (a === 'My QR') {
                var handle = '@' + me.name.toLowerCase().split(' ')[0];
                KP.rails.sheet('My Kaastro QR',
                    '<div class="text-center"><div class="qr-box" id="myQr"></div>'
                    + '<p class="fw-bold mt-3 mb-0">' + me.name + '</p>'
                    + '<p class="text-muted" style="font-size:.82rem">' + handle + ' · ' + me.id + '</p>'
                    + '<button class="btn btn-soft w-100 mt-2 kp-copy" data-copy="' + me.id + '">'
                    + '<i class="fas fa-copy me-1"></i>Copy my Kaastro ID</button>'
                    + '<p class="text-muted mt-2 mb-0" style="font-size:.74rem">'
                    + 'Any Kaastro Pay user can scan this to pay you.</p></div>');
                if (typeof QRCode === 'function') {
                    new QRCode(document.getElementById('myQr'), {
                        text: 'kaastropay://pay/' + me.id, width: 190, height: 190,
                        colorDark: '#0f172a', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M
                    });
                }
            } else if (a === 'Enter Code') {
                KP.rails.sheet('Enter a Kaastro ID',
                    '<p class="text-muted" style="font-size:.83rem">'
                    + 'Type the handle or Kaastro ID of the person you want to pay.</p>'
                    + '<input class="form-control mb-3" id="scCode" placeholder="@handle or KP-10240">'
                    + '<button class="btn btn-primary w-100" id="scLookup">Look up</button>');
            } else {
                KP.rails.toast('Choose a QR image from your gallery.');
            }
        });

        $(document).on('click', '#scLookup', function () {
            var v = ($('#scCode').val() || '').trim().toLowerCase();
            if (!v) { KP.rails.toast('Enter a handle or Kaastro ID.', 'danger'); return; }
            var hit = KP.data.contacts('kaastro').filter(function (c) {
                return c.handle.toLowerCase() === (v[0] === '@' ? v : '@' + v)
                    || c.name.toLowerCase().indexOf(v) > -1;
            })[0];
            if (!hit) { KP.rails.toast('No Kaastro Pay user matches that.', 'danger'); return; }
            KP.rails.closeSheet();
            result(hit);
        });

        $el.on('click', '#torch', function () {
            var on = $(this).hasClass('btn-primary');
            $(this).toggleClass('btn-primary', !on).toggleClass('btn-soft text-primary-k', on)
                .html('<i class="fas fa-lightbulb me-2"></i>Turn ' + (on ? 'on' : 'off') + ' flashlight');
        });
    }

    /* =========================== I N S I G H T S =========================== */

    function insights($el) {
        var D = KP.data, BO = KP.bo;
        var tx = D.myTransactions();
        var inSum = tx.filter(function (t) { return t.dir === 'in' && t.fiat; })
            .reduce(function (s, t) { return s + t.fiat; }, 0);
        var outSum = tx.filter(function (t) { return t.dir === 'out' && t.fiat; })
            .reduce(function (s, t) { return s + t.fiat; }, 0);
        var fees = 2450;

        $el.html(
            '<div class="seg mb-3" id="inRange">'
            + ['Week', 'Month', '3 Months', 'Custom'].map(function (r, i) {
                return '<button class="' + (i === 1 ? 'active' : '') + '">' + r + '</button>';
            }).join('') + '</div>'

            + '<div class="card p-3 p-md-4 mb-3">'
            + '<div class="section-head"><h2>Money Overview</h2>'
            + '<i class="fas fa-eye text-muted"></i></div>'
            + '<div class="flow-stack">'
            + '<div><span>Money In</span><b class="text-up">' + F().fiat(inSum, C().currency) + '</b></div>'
            + '<div><span>Money Out</span><b class="text-down">' + F().fiat(outSum, C().currency) + '</b></div>'
            + '<div><span>Net Flow</span><b class="' + (inSum - outSum >= 0 ? 'text-up' : 'text-down') + '">'
            + (inSum - outSum >= 0 ? '+' : '') + F().fiat(inSum - outSum, C().currency) + '</b></div>'
            + '</div>'
            + '<canvas id="flowChart" height="150" class="mt-3"></canvas></div>'

            + '<div class="row g-2 mb-3">'
            + '<div class="col-6"><div class="card figure-tile">'
            + '<span class="qa-icon qa-green sm"><i class="fas fa-receipt"></i></span>'
            + '<span class="ft-label">Fees Paid</span>'
            + '<b class="ft-value">' + F().fiat(fees, C().currency) + '</b></div></div>'
            + '<div class="col-6"><div class="card figure-tile">'
            + '<span class="qa-icon qa-green sm"><i class="fas fa-chart-simple"></i></span>'
            + '<span class="ft-label">Transactions</span>'
            + '<b class="ft-value">' + tx.length + '</b></div></div></div>'

            + '<div class="card p-3 p-md-4 mb-3">'
            + '<div class="section-head"><h2>Spending Breakdown</h2></div>'
            + '<div class="row g-3 align-items-center">'
            + '<div class="col-5"><canvas id="spendChart" height="150"></canvas></div>'
            + '<div class="col-7" id="spendLegend"></div></div></div>'

            + '<div class="card p-3 p-md-4 mb-3">'
            + '<div class="section-head"><h2>Conversion Summary</h2></div>'
            + '<div class="flow-3">'
            + '<div><span>Crypto Deposited</span><b>$4,500</b></div>'
            + '<div><span>' + C().currency + ' Received</span><b class="text-up">'
            + F().fiat(6750000 / (C().currency === 'NGN' ? 1 : KP.USD_RATE.NGN / KP.USD_RATE[C().currency]), C().currency) + '</b></div>'
            + '<div><span>Average Rate</span><b>' + F().fiat(1500 * KP.USD_RATE[C().currency] / KP.USD_RATE.NGN, C().currency) + '</b></div>'
            + '</div>'
            + '<p class="text-muted mt-2 mb-0" style="font-size:.78rem">'
            + 'Crypto is converted automatically and is not stored.</p></div>'

            + '<div class="k-alert k-ok mb-3"><i class="fas fa-arrow-trend-up"></i><div>'
            + '<b class="hd">You received 15% more this month.</b>Your inflows are up compared to last month.</div></div>'

            + '<button class="btn btn-primary w-100 mb-3" id="dlStatement">'
            + '<i class="fas fa-download me-2"></i>Download Statement</button>'

            + '<div class="card p-3">'
            + '<div class="section-head"><h2>Transaction History</h2></div>'
            + '<div class="filterbar mb-3">'
            + ['all', 'deposit', 'withdrawal', 'transfer', 'bill'].map(function (f, i) {
                return '<button class="chip-btn' + (i === 0 ? ' active' : '') + '" data-f="' + f + '">'
                    + (f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1) + 's') + '</button>';
            }).join('') + '</div>'
            + '<div class="table-responsive"><table id="txTable" class="table w-100 dt-nowrap"><thead><tr>'
            + '<th>Transaction</th><th>Reference</th><th>Type</th><th class="text-end">Amount</th>'
            + '<th>Status</th><th>Date</th><th class="text-end"></th></tr></thead><tbody></tbody></table></div>'
            + '</div>'
        );

        /* --- charts --- */
        var pts = [];
        for (var i = 0; i < 22; i++) {
            pts.push(1 + Math.sin(i / 3.1) * 0.28 + Math.sin(i / 7.4) * 0.18 + i * 0.03);
        }
        (function line() {
            var cv = document.getElementById('flowChart');
            var ctx = cv.getContext('2d'), dpr = window.devicePixelRatio || 1;
            var w = cv.clientWidth, h = 150;
            cv.width = w * dpr; cv.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            var min = Math.min.apply(null, pts), max = Math.max.apply(null, pts);
            var pad = (max - min) * 0.2;
            function x(i) { return (i / (pts.length - 1)) * w; }
            function y(v) { return h - ((v - min + pad) / (max - min + pad * 2)) * h; }
            var g = ctx.createLinearGradient(0, 0, 0, h);
            g.addColorStop(0, 'rgba(178,251,12,.32)'); g.addColorStop(1, 'rgba(178,251,12,0)');
            ctx.beginPath(); ctx.moveTo(0, h);
            pts.forEach(function (v, i) { ctx.lineTo(x(i), y(v)); });
            ctx.lineTo(w, h); ctx.closePath(); ctx.fillStyle = g; ctx.fill();
            ctx.beginPath();
            pts.forEach(function (v, i) { i ? ctx.lineTo(x(i), y(v)) : ctx.moveTo(x(i), y(v)); });
            ctx.strokeStyle = '#B2FB0C'; ctx.lineWidth = 2.4; ctx.lineJoin = 'round'; ctx.stroke();
            pts.forEach(function (v, i) {
                if (i % 3) return;
                ctx.beginPath(); ctx.arc(x(i), y(v), 3, 0, Math.PI * 2);
                ctx.fillStyle = '#B2FB0C'; ctx.fill();
            });
        })();

        var SPEND = [
            ['Transfers', 45, '#B2FB0C'], ['Bills', 25, '#7FD40A'],
            ['Crypto Withdrawals', 20, '#00BE3A'], ['Other', 10, '#64748b']
        ];
        BO.donut(document.getElementById('spendChart'),
            SPEND.map(function (s) { return { k: s[0], v: s[1], c: s[2] }; }));
        $('#spendLegend').html(SPEND.map(function (s) {
            return '<div class="d-flex align-items-center gap-2 py-1" style="font-size:.82rem">'
                + '<span style="width:9px;height:9px;border-radius:3px;background:' + s[2] + ';flex:none"></span>'
                + '<span class="fw-bold flex-grow-1">' + s[0] + '</span>'
                + '<span class="text-muted">' + s[1] + '%</span></div>';
        }).join(''));

        /* --- table --- */
        var filter = 'all', dt = null;
        function pill(s) {
            var m = { successful: 'pill-success', failed: 'pill-failed', processing: 'pill-processing',
                      pending: 'pill-pending', confirming: 'pill-confirming' };
            return '<span class="pill ' + (m[s] || 'pill-neutral') + '">' + s + '</span>';
        }
        function build() {
            var rows = tx.filter(function (t) { return filter === 'all' || t.type === filter; });
            var data = rows.map(function (t) {
                var cls = t.dir === 'in' ? 'tx-in' : 'tx-out';
                var ic = t.type === 'bill' ? 'fa-bolt' : t.dir === 'in' ? 'fa-arrow-down' : 'fa-arrow-up';
                var amt = (t.dir === 'in' ? '+' : '−')
                    + (t.fiat != null ? F().fiat(t.fiat, 'NGN') : F().crypto(t.amount, t.asset));
                return ['<div class="d-flex align-items-center gap-2">'
                        + '<span class="tx-icon ' + cls + '" style="width:28px;height:28px;font-size:.62rem">'
                        + '<i class="fas ' + ic + '"></i></span><span class="t-strong">' + t.label + '</span></div>',
                    '<span class="t-mono">' + t.ref + '</span>',
                    '<span class="text-capitalize">' + t.type + '</span>',
                    '<span class="t-strong ' + (t.dir === 'in' ? 'text-up' : '') + '">' + amt + '</span>',
                    pill(t.status), '<span class="t-mono">' + t.date + '</span>',
                    '<button class="btn btn-sm btn-soft rx" data-ref="' + t.ref + '"><i class="fas fa-receipt"></i></button>'];
            });
            if (dt) { dt.clear(); dt.rows.add(data); dt.draw(false); return; }
            dt = $('#txTable').DataTable({
                data: data, autoWidth: false, responsive: true, order: [], pageLength: 10,
                lengthChange: false,
                columnDefs: [{ targets: [3, 6], className: 'text-end' }, { targets: 6, orderable: false }],
                language: {
                    search: '', searchPlaceholder: 'Search…', info: '_START_–_END_ of _TOTAL_',
                    emptyTable: '<div class="empty-state"><i class="fas fa-receipt"></i><p>Nothing here yet.</p></div>',
                    paginate: { previous: '<i class="fas fa-chevron-left"></i>', next: '<i class="fas fa-chevron-right"></i>' }
                }
            });
        }
        build();

        $el.on('click', '.chip-btn', function () {
            $('.chip-btn').removeClass('active'); $(this).addClass('active');
            filter = $(this).data('f'); build();
        });
        $el.on('click', '#inRange button', function () {
            $('#inRange button').removeClass('active'); $(this).addClass('active');
        });
        $el.on('click', '#dlStatement', function () { KP.rails.toast('Statement saved as PDF.'); });
        $el.on('click', '.rx', function () {
            var t = tx.filter(function (x) { return x.ref === $(this).data('ref'); }.bind(this))[0];
            if (!t) return;
            KP.receipt.show({
                title: 'Transaction receipt', ref: t.ref,
                amount: (t.dir === 'in' ? '+' : '−')
                    + (t.fiat != null ? F().fiat(t.fiat, 'NGN') : F().crypto(t.amount, t.asset)),
                sub: t.label, status: t.status,
                rows: [['Reference', t.ref], ['Type', t.type], ['Detail', t.sub],
                       ['Date', t.date]],
                note: 'Keep this receipt for your records.'
            });
        });
    }

    /* ======================== V E R I F I C A T I O N ======================== */

    function verification($el) {
        var me = KP.data.ME, c = C();
        var steps = [
            { t: 'Email & phone', d: 'Confirm the code we send you', tier: 0, done: true },
            { t: c.idLabel, d: 'Your government identity number', tier: 1, done: me.tier >= 1 },
            { t: 'Government-issued ID', d: 'Photo of your ID document', tier: 2, done: me.tier >= 2 },
            { t: 'Selfie verification', d: 'A live selfie matched to your ID', tier: 3, done: me.tier >= 3 },
            { t: 'Address verification', d: 'A utility bill or statement under 3 months', tier: 3, done: me.tier >= 3 }
        ];
        var next = KP.TIERS[Math.min(3, me.tier + 1)];

        $el.html(
            '<div class="card p-3 p-md-4 mb-3 text-center">'
            + '<div class="tier-lock" style="' + (me.tier >= 3 ? '' : 'border-color:var(--border-color);box-shadow:none') + '">'
            + '<i class="fas fa-' + (me.tier >= 3 ? 'shield-halved' : 'shield') + '"'
            + (me.tier >= 3 ? '' : ' style="color:var(--text-muted)"') + '></i>'
            + '<span' + (me.tier >= 3 ? '' : ' style="color:var(--text-muted)"') + '>TIER ' + me.tier + '</span></div>'
            + '<h2 class="card-title mt-3 mb-1" style="font-size:1.15rem">' + KP.TIERS[me.tier].name
            + (me.tier >= 3 ? ' · Fully Verified' : '') + '</h2>'
            + '<p class="text-muted mb-0" style="font-size:.85rem">' + KP.TIERS[me.tier].needs + '</p>'
            + '<div class="summary-rows text-start mt-3">'
            + '<div class="sr"><span>Daily limit</span><span>' + F().usd(KP.TIERS[me.tier].dailyUsd) + '</span></div>'
            + '<div class="sr"><span>Per transaction</span><span>' + F().usd(KP.TIERS[me.tier].perTxUsd) + '</span></div>'
            + '<div class="sr total"><span>Crypto withdrawal</span><span class="'
            + (me.tier >= 3 ? 'text-up' : 'text-muted') + '">'
            + (me.tier >= 3 ? 'Unlocked' : 'Tier 3 only') + '</span></div></div>'
            + (me.tier < 3
                ? '<button class="btn btn-primary w-100 mt-3" id="upTier">Complete Verification</button>' : '')
            + '</div>'

            + '<div class="card p-3 p-md-4 mb-3">'
            + '<div class="section-head"><h2>Verification steps</h2></div>'
            + steps.map(function (s) {
                return '<div class="chk-row">'
                    + '<i class="fas fa-' + (s.done ? 'circle-check done' : 'circle') + '"></i>'
                    + '<span class="min-w-0"><span class="d-block fw-bold" style="font-size:.86rem">' + s.t + '</span>'
                    + '<span class="ar-sub">' + s.d + '</span></span>'
                    + '<span class="ms-auto flex-shrink-0">' + (s.done
                        ? '<span class="pill pill-success">Verified</span>'
                        : '<button class="btn btn-sm btn-primary do-step">Start</button>') + '</span></div>';
            }).join('') + '</div>'

            + '<div class="card p-3 p-md-4">'
            + '<div class="section-head"><h2>All tiers</h2></div>'
            + '<div class="table-wrap"><table class="k-table" style="min-width:0"><thead><tr>'
            + '<th>Tier</th><th>Unlocked by</th><th class="text-end">Daily</th></tr></thead><tbody>'
            + KP.TIERS.map(function (t) {
                return '<tr' + (t.id === me.tier ? ' style="background:var(--lemon-soft)"' : '') + '>'
                    + '<td><span class="tier-badge tier-' + t.id + '">' + t.name + '</span>'
                    + (t.id === me.tier ? ' <span class="pill pill-success">you</span>' : '') + '</td>'
                    + '<td class="text-muted">' + t.needs + '</td>'
                    + '<td class="text-end t-strong">' + (t.dailyUsd ? F().usd(t.dailyUsd) : '—') + '</td></tr>';
            }).join('') + '</tbody></table></div></div>'
        );

        $el.on('click', '#upTier, .do-step', function () {
            KP.rails.toast('Document capture opens here — a native step in the app.');
        });
    }

    global.KP = global.KP || {};
    global.KP.flows2 = {
        transfer: transfer, request: request, sendAbroad: sendAbroad,
        scan: scan, insights: insights, verification: verification
    };

})(window, jQuery);
