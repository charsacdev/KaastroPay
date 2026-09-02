# Kaastro Pay

A crypto exchange front-end prototype for Africa. Crypto in, local currency out —
Nigeria, Ghana, Kenya, Tanzania and Uganda.

Design language and operational rails taken from `CheapNariaDesigns`, refocused
on crypto only. No bill payments, no Deriv, no supplier payments, no vouchers.

## Running it

No build step. Serve the folder:

```
python -m http.server 8899
```

Then visit <http://localhost:8899/>.

**Three separate doors.** Customers and staff do not share a login, and there is
no portal switcher:

| Who | URL | Lands on |
| --- | --- | --- |
| Customer | `/login.html` | `dashboard/` |
| Agent | `/agent-login.html` | `agent/` |
| Admin | `/admin-login.html` | `admin/` |

Staff sign-in pages are `noindex` and are not linked from the marketing site.
Any credentials work in the prototype. **The transaction PIN is `1234`.**

## Structure

```
index.html          landing page — photography-led hero (real trader photo with
                    the live-rates phone overlaid), face stacks, photo sections,
                    trust bar, security, markets, testimonial slider
about.html          who we are, how we make money, team, contact
terms.html · privacy.html · aml.html    legal, with a sticky contents rail
login · agent-login · admin-login · register · forgot-password
verify-code · verify-identity

dashboard/          user portal   (16 pages)
agent/              agent portal  (9 pages)
admin/              admin portal  (16 pages)

css/kaastro.css     design system — tokens, components, dark mode
css/public.css      landing and auth pages

js/boot.js          one-line loader; every page's <head> is two lines
js/config.js        country map, asset catalogue, money formatting
js/rates-engine.js  prices, spreads, quotes, the 30-second tick
js/mock-data.js     deterministic datasets shared by all three portals
js/rails.js         theme, panic mode, shift lock, block, PIN, manual confirm
js/shell.js         sidebar, top bar, mobile nav — built from one nav definition
js/trade.js         the buy / sell / swap ticket
js/backoffice.js    queue tables, stat tiles, charts
js/pages.js         queue pages shared by agent and admin
js/admin-pages.js   admin-only pages
js/legal.js         nav, footer and contents rail for the public content pages
js/receipt.js       branded receipt sheet, downloadable as PNG
```

## How it is put together

**Country drives everything.** `js/config.js` holds one entry per market with
its currency, decimals, identity check, funding rail and payout rail. Nothing
in the UI hardcodes a currency symbol. A Ghanaian session shows Cedis
everywhere and funds by mobile money; a Nigerian session shows Naira and gets a
dedicated virtual account. Switch between them with the flag control in the
user portal's top bar.

**One rates engine.** Prices drift deterministically — no `Math.random`, so the
admin and agent portals always agree. The rates page, every balance valuation
and the buy/sell/swap quote countdown all read from it. Margins set in
Admin → Rates take effect on the next quote.

**Admin is a superset of agent.** The queue pages are written once in
`js/pages.js` and mounted by both portals. `role` is the only difference.

**Operational rails, ported from the reference:**

| Rail | What it does |
| --- | --- |
| Panic mode | Platform-wide freeze on withdrawals *and* trading. Set from either back-office Settings page. |
| Shift lock | Agents can only approve inside their assigned window. Simulate the other shift from the agent top bar. |
| Block / unblock | Agents block; only admins unblock. An agent cannot quietly undo their own restriction. |
| Transaction PIN | Four-digit gate on every debit — sell, swap, and both withdrawal types. |
| Manual confirmation | The provider-down fallback. Reason, notes and evidence are all mandatory; over $1,000 needs a second approver. Every action is attributed permanently and surfaces in Admin → Agents. |

## Photography

The landing page is built around people, not just UI shots. The hero layers a
photograph of a trader with the live-rates phone tucked into its corner and a
"₦150,000 paid out" proof card over the top. Overlapping face stacks with a
star rating sit under the hero CTA, beside the testimonials heading and in the
closing band. "Built by traders" and "No more waiting games" each carry a
full-bleed photo with a caption and stat badges pinned to it.

Images live in `images/` — `hero-trader.png`, `team-collaboration.png`,
`payout-success.png` and eight portrait avatars. Swap those files and the page
picks the new ones up; nothing is hardcoded beyond the filenames.

## Deposits have two routes

Both crypto and cash deposits open on a **method chooser** before anything else:

- **Fast network** — the automatic rail. Chain watchers or the payment provider
  credit you on their own.
- **Alternative transfer** — for when a provider is down. You copy the deposit
  address or the settlement account, send, then upload the hash or the proof of
  payment. An agent verifies it and credits by hand, through the manual
  confirmation rail with all its controls.

Either screen can switch to the other mid-flow, because "it has not shown up
yet" is exactly when people need the fallback.

## Bills

Airtime, data and electricity, paid from the local cash balance. The biller
catalogue, denominations and data bundles are all per country, same as every
other amount in the app. Electricity returns a prepaid token on the receipt.

## Receipts

One branded receipt sheet (`js/receipt.js`) with the Kaastro logo on it, used by
transactions, bills and every trade confirmation. Downloads as a real PNG via
html2canvas, with a print fallback if the library does not load.

## Back-office review

Nothing is approved from a table row. Every queue row opens the **review
drawer** (`js/review.js`) first: the full record, every field copiable with one
tap, the user behind it, and approve / reject / manual confirm in one place —
plus the branded receipt. Deposits, withdrawals, trades and all-transactions
all use it, on both the agent and admin sides.

KYC is different again: it has its **own page** (`kyc-review.html`), because
documents need room. Four document panels, a six-point verification checklist,
canned rejection reasons, and a decision that carries the operator's name.

`user-details.html` is the full account record — lifetime volume, balances per
asset, every transaction, devices with IP addresses, security posture, risk
score, KYC history, and block/unblock.

## Admin controls

| Page | What it does |
| --- | --- |
| Rates & margins | Reference rate **and** buy/sell/swap spread **per country**. A market can be quoted off a manual rate instead of the feed. Rows left on Default follow the global spread. |
| Fee manager | Cash withdrawal fee and minimum per country, crypto fee per asset × network. Sticky save bar; nothing commits on keystroke. |
| Tiers & limits | Daily and per-transaction caps per tier, with a save bar. |
| Reports | From/to date range plus quick 7/30/90/all, filter by transaction type, status and country, then export the exact result set as CSV or JSON. |
| Agents | **Create, edit, suspend and remove agents.** Name, email, phone, shift, six granular permissions and a daily manual-action cap. New agents start as *Awaiting setup* until they enrol 2FA. Created agents persist in `localStorage`; the reset button restores the seeded four. |
| Countries · Treasury | Market config, and hot/warm/cold custody. |

Every editable page uses the same sticky commit bar: it counts unsaved changes,
and Discard puts everything back.

## Agent permissions

What an admin grants on the Agents page actually gates the agent portal. Six
permissions — review KYC, approve deposits, approve withdrawals, manual
confirmation, block users, answer support — and the agent side reads them at
render time. Revoke *approve deposits* and that queue locks with the reason
stated; suspend the account and nothing can be approved at all. Manual
confirmation is called out in the form as the sensitive one, because it is.

An agent can be stopped three ways: outside their shift, missing the
permission, or suspended. Each shows a different banner saying which.

## Tables

Every list of any length is a Bootstrap DataTable — search, sort, pagination
and responsive collapse. That covers the user's transaction history, the
payout-account, address and device tables on Profile, and all eight
back-office queues, which share one renderer in `js/backoffice.js`.

## Responsive

Checked in a real browser at 375, 768 and 1280 px: no element spills past the
viewport and the body never scrolls sideways on any page. The user portal gets
a five-tab bottom bar on mobile; agent and admin do not, and only the portal
that has one reserves room for it.

## State

Everything lives in `localStorage`, prefixed `kaastro-`. Reset it all from the
button at the bottom of `portals.html`.

## What this is not

A front-end prototype. There is no backend, no real custody, no real money.
The ledger, saga orchestration and provider abstractions described in the
architecture document are not implemented here — this is the surface those
would sit behind.
