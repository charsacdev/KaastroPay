/* Shared chrome for the public content pages — nav, footer and the sticky
   contents rail. Each page supplies only its own <section> content. */
(function (global, $) {
    'use strict';

    function nav(active) {
        return '<nav class="pub-nav"><div class="container d-flex align-items-center justify-content-between gap-2">'
            + '<a href="index.html" class="brand-logo">'
            + '<img src="images/logo.png" alt="Kaastro Pay" class="brand-img"></a>'
            + '<div class="d-none d-lg-flex align-items-center gap-1">'
            + [['index.html#how', 'How it works'], ['index.html#markets', 'Markets'],
               ['index.html#security', 'Security'], ['about.html', 'About']]
                .map(function (l) {
                    return '<a href="' + l[0] + '" class="nav-link-pub'
                        + (l[1].toLowerCase() === active ? ' text-primary-k' : '') + '">' + l[1] + '</a>';
                }).join('')
            + '</div><div class="d-flex align-items-center gap-2">'
            + '<button class="icon-btn" id="themeBtn" aria-label="Toggle dark mode"><i class="fas fa-moon"></i></button>'
            + '<a href="login.html" class="btn btn-soft btn-sm d-none d-sm-inline-block">Log in</a>'
            + '<a href="register.html" class="btn btn-primary btn-sm">Get started</a>'
            + '</div></div></nav>';
    }

    function footer() {
        return '<footer class="pub-footer"><div class="container"><div class="row g-4">'
            + '<div class="col-lg-4"><a href="index.html" class="brand-logo mb-3 ps-0">'
            + '<img src="images/logo.png" alt="Kaastro Pay" class="brand-img"></a>'
            + '<p style="max-width:36ch">Crypto to local currency across Africa. Built by traders, for traders.</p>'
            + '<p class="mb-0" style="font-size:.78rem">Prototype build — no real funds move on this site.</p></div>'
            + '<div class="col-6 col-lg-2"><h4>Product</h4>'
            + '<a href="register.html">Create account</a><a href="login.html">Log in</a>'
            + '<a href="index.html#how">How it works</a><a href="index.html#markets">Markets</a>'
            + '<a href="index.html#security">Security</a></div>'
            + '<div class="col-6 col-lg-2"><h4>Company</h4>'
            + '<a href="about.html">About us</a><a href="about.html#story">Our story</a>'
            + '<a href="about.html#contact">Contact</a><a href="aml.html">Compliance</a></div>'
            + '<div class="col-6 col-lg-2"><h4>Legal</h4>'
            + '<a href="terms.html">Terms of service</a><a href="privacy.html">Privacy policy</a>'
            + '<a href="aml.html">AML compliance</a><a href="aml.html#kyc">KYC policy</a></div>'
            + '<div class="col-6 col-lg-2"><h4>Support</h4>'
            + '<a href="about.html#contact">Contact us</a><a href="login.html">Help centre</a>'
            + '<a href="aml.html#report">Report an issue</a></div>'
            + '</div><hr class="my-4">'
            + '<div class="d-flex flex-wrap justify-content-between gap-2">'
            + '<span>© 2026 Kaastro Pay. All rights reserved.</span>'
            + '<span>Nigeria · Ghana · Kenya · Tanzania · Uganda</span></div></div></footer>';
    }

    /* Builds the contents rail from the h2 headings already on the page, so
       the two can never drift apart. */
    function buildToc(sel) {
        var items = $('.doc-body h2').map(function () {
            return '<a href="#' + this.id + '">' + $(this).text() + '</a>';
        }).get().join('');
        $(sel).html('<h4 class="mb-2" style="font-size:.7rem;text-transform:uppercase;'
            + 'letter-spacing:.11em;font-weight:800;color:var(--text-muted)">On this page</h4>' + items);
    }

    $(function () {
        var active = ($('body').data('active') || '').toLowerCase();
        $('body').prepend(nav(active));
        $('body').append(footer());
        $('#themeBtn').on('click', function () {
            KP.rails.theme.apply(KP.rails.theme.current() === 'dark' ? 'light' : 'dark');
        });
        if ($('.doc-toc').length) buildToc('.doc-toc');
    });

    global.KP = global.KP || {};
    global.KP.legal = { nav: nav, footer: footer };

})(window, jQuery);
