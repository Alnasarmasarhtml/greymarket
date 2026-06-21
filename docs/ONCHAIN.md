# GREYMARKET 墨市 — On-chain readiness & launch checklist

## TL;DR
The **client** is contract-ready (`js/config.js` + `js/chain.js`): connect wallet, the **Berth Seal**
activation, the server-authoritative claim, token sinks, and demo/live gating all flip from one config
object. **But real on-chain earning needs a custody-grade backend** — not just the contract. Until that
backend exists and passes the devnet failure suite, leave `token.api = ""` (or `priceOracle = ""`) and
the game stays an **honest free DEMO**: every $GREY number is a *practice score*, never a token.

## Anti-drain model (identical to GRINDHOUSE, themed)
Gameplay does **not** mint claimable token (client is untrusted). Claimable $GREY is a **server time-drip**
`f(seal_timestamp, elapsed, tier)` clamped by: per-wallet epoch cap (60 $GREY × tier), a **value peg**
(claimable value/epoch ≤ 0.5 × seal fee value, via the price oracle), a **fixed global epoch faucet**
(30,000 $GREY split across all sealed runners, halving each season → sybil-proof), a lifetime cap (≈90),
diminishing returns, min account age, cooldown, and a per-day outflow cap. **Botting EV ≤ 0 at any price.**

## The "account tax" — Berth Seal 封印 — PAID IN $GREY, BURNED
Recurring **per-epoch** (1 week). Cost denominated in **SOL-value** (`feeSolValue: 0.08`) but **paid in
$GREY** (`payIn:"token"`) and **burned** — the backend prices it from the oracle each epoch. Maximum token
utility: every runner must **buy $GREY to seal a berth** (buy pressure) and the seal is **burned**
(deflation). Tiers `runner / fixer / syndicate` raise the cap proportionally. Earnings stay value-pegged
to ≤ 0.5 × the fee value, so botting is net-negative while the token gets bought + burned every season.

## Token value in-game
$GREY is spent on the edge: **INTEL** (the forecast — de-facto required to compete; raise max 4→6) plus
planned Discretion Dossier / Forecast Window sinks, routed through `GMChain.spendToken` when live. Sinks > faucet.

## Trust boundary
Client = UI + free demo (untrusted). Server/contract = authoritative for accrual + claim. Claim is
server-built + partial-signed from a capped hot wallet; client never asserts an amount.

## Required backend (multi-week build)
Endpoints: `/api/activate · /api/nonce · /api/accrual · /api/status · /api/claim · /api/spend · /api/price`
plus the time-drip worker, price-oracle reader (value peg), HSM claim signer, server-watch-and-debit
(replay-proof), buyback cron, and CORS for the Pages origin. **No gameplay-accrual endpoint by design.**

## Launch checklist
Same as GRINDHOUSE (`../GRINDHOUSE/docs/ONCHAIN.md`):
1. **Devnet dry-run** — fill devnet config, stand up the 7 endpoints + drip worker, run the failure suite
   (forged balance, reused nonce, replayed tx, cap/peg/faucet/outflow clamps, age/cooldown/license checks)
   with curl, independent of client guards.
2. **Mainnet flip** — config only on the client: paid RPC, paste mint/treasury/treasuryAta/claimHotWallet/
   programId/priceOracle (confirm decimals), `token.api` = prod (CORS ok), mint+freeze revoked, LP burned,
   claimHotWallet funded with ~1–2 epochs float (cold pool 2-of-N), smoke-test, then `claimEnabled:true`.
3. **Before announce** — secrets server/HSM-only, outflow cap + alerts, demo labels gone, buyback dashboard
   live, localStorage demo scores discarded.

**GO/NO-GO:** no backend (or no oracle) ⇒ stays honest DEMO. No half-live state.

## What I need from you at launch
mint · treasury · treasury ATA · claimHotWallet · decimals · programId · priceOracle · cluster ·
backend base URL — and who builds/operates the backend (separate multi-week custody build).
