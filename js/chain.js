/* =====================================================================
   GREYMARKET 墨市 — Solana wallet + token layer (mirror of GRINDHOUSE)
   Works TODAY for wallet connect. Berth Seal (activation) / claim / spend
   are wired but gated on config: DEMO until the mint + backend + oracle are
   bound. Client is UNTRUSTED — accrual/claim are server-authoritative.
   ===================================================================== */
import { GM, isLive, canClaim, isActivated, apiBase, currentEpoch } from "./config.js";

const $ = (s) => document.querySelector(s);
const shortKey = (k, n = 4) => k ? `${k.slice(0, n)}…${k.slice(-n)}` : "";
const fmtTok = (n) => { n = +n || 0; return n < 1000 ? n.toFixed(n < 10 ? 3 : 0) : (n / 1000).toFixed(2) + "K"; };

/* ---------- provider detection ---------- */
function getProvider() {
  if (window.phantom?.solana?.isPhantom) return { p: window.phantom.solana, name: "Phantom" };
  if (window.solana?.isPhantom) return { p: window.solana, name: "Phantom" };
  if (window.solflare?.isSolflare) return { p: window.solflare, name: "Solflare" };
  if (window.backpack?.isBackpack) return { p: window.backpack, name: "Backpack" };
  if (window.solana) return { p: window.solana, name: "Wallet" };
  return null;
}
let provider = null;

export async function connectWallet(game) {
  if (!game) return;
  const found = getProvider();
  if (!found) { openSimple("NO SOLANA WALLET FOUND", "Install a Solana wallet (Phantom / Solflare / Backpack) to seal a berth at launch. You don't need one to play the demo — only to earn real $GREY once it's live."); return; }
  provider = found.p;
  try {
    const res = await provider.connect();
    const pk = (res?.publicKey || provider.publicKey)?.toString();
    if (!pk) throw new Error("no pubkey");
    game.state.wallet = pk; game.save?.();
    refreshWalletUI(game.state);
    if (isLive()) getBalances(pk).then(() => {});
    else openSimple("WALLET LINKED", `Linked to <b>${found.name}</b> · <span class="mono">${shortKey(pk, 5)}</span>. Earning is a <b>free demo</b> until launch — your number is a practice score, not $GREY.`);
  } catch (e) { console.warn("[greymarket] connect failed", e); }
}
export async function disconnect(game) {
  try { await provider?.disconnect?.(); } catch (_) {}
  game.state.wallet = null; game.save?.(); refreshWalletUI(game.state);
}

/* ---------- balances ---------- */
export async function getBalances(pk) {
  if (!isLive()) return { sol: 0, token: 0 };
  try {
    const web3 = await loadWeb3();
    const conn = new web3.Connection(GM.token.rpc, "confirmed");
    const owner = new web3.PublicKey(pk);
    const sol = (await conn.getBalance(owner)) / web3.LAMPORTS_PER_SOL;
    const mint = new web3.PublicKey(GM.token.mint);
    const accs = await conn.getParsedTokenAccountsByOwner(owner, { mint });
    const token = accs.value[0]?.account?.data?.parsed?.info?.tokenAmount?.uiAmount || 0;
    const ob = $("#onchainBal"); if (ob) ob.textContent = fmtTok(token) + " $GREY";
    return { sol, token };
  } catch (_) { return { sol: 0, token: 0 }; }
}

/* ---------- status (server-authoritative drip/caps/cooldown) ---------- */
export async function getStatus(pk) {
  if (!isLive()) return null;
  try { const r = await fetch(apiBase() + GM.chain.api.status + "?wallet=" + pk); return r.ok ? await r.json() : null; }
  catch (_) { return null; }
}

/* ---------- Berth Seal — per-epoch activation, PAID IN $GREY (burned) → token utility ---------- */
export async function payActivation(game, tierId = "runner") {
  const a = GM.chain.activation;
  const tier = a.tiers.find(t => t.id === tierId) || a.tiers[0];
  if (!isLive()) { openSealAtLaunch(tier); return { ok: false, reason: "demo" }; }
  if (!game.state.wallet) { await connectWallet(game); if (!game.state.wallet) return { ok: false, reason: "no-wallet" }; }
  try {
    // server prices the seal in $GREY from the oracle (feeSolValue ÷ token price) and builds the BURN tx
    const resp = await fetch(apiBase() + GM.chain.api.activate, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ wallet: game.state.wallet, tier: tier.id, epoch: currentEpoch() }),
    });
    if (!resp.ok) throw new Error("seal not built");
    const { txBase64, tokenAmount } = await resp.json();
    const web3 = await loadWeb3();
    const tx = web3.Transaction.from(Uint8Array.from(atob(txBase64), c => c.charCodeAt(0)));
    const signed = await provider.signTransaction(tx);
    const conn = new web3.Connection(GM.token.rpc, "confirmed");
    const sig = await conn.sendRawTransaction(signed.serialize());
    await conn.confirmTransaction(sig, "confirmed");
    game.state.license = { active: true, tier: tier.id, sig, epoch: currentEpoch(), ts: Date.now() };
    game.save?.(); refreshWalletUI(game.state);
    return { ok: true, sig, tokenAmount, epoch: currentEpoch() };
  } catch (e) { console.warn("[greymarket] seal failed", e); openSealAtLaunch(tier); return { ok: false, reason: String(e) }; }
}

/* ---------- claim — server-authoritative time-drip ---------- */
export async function claim(game) {
  if (!canClaim()) { openClaimAtLaunch(); return; }
  if (!game.state.wallet) { await connectWallet(game); if (!game.state.wallet) return; }
  if (!isActivated(game.state)) { openSealAtLaunch(GM.chain.activation.tiers[0]); return; }
  try {
    const nres = await fetch(apiBase() + GM.chain.api.nonce + "?wallet=" + game.state.wallet);
    if (!nres.ok) throw new Error("nonce endpoint not live");
    const { nonce } = await nres.json();
    const resp = await fetch(apiBase() + GM.chain.api.claim, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ wallet: game.state.wallet, nonce }),   // NO amount — server decides
    });
    if (!resp.ok) throw new Error("claim endpoint not live");
    const { txBase64, amount, burned } = await resp.json();
    const web3 = await loadWeb3();
    const tx = web3.Transaction.from(Uint8Array.from(atob(txBase64), c => c.charCodeAt(0)));
    try { await provider.signMessage?.(new TextEncoder().encode(`claim:${GM.ticker}:${game.state.wallet}:${nonce}`)); } catch (_) {}
    const signed = await provider.signTransaction(tx);
    const conn = new web3.Connection(GM.token.rpc, "confirmed");
    const sig = await conn.sendRawTransaction(signed.serialize());
    await conn.confirmTransaction(sig, "confirmed");
    game.state.lastClaimTs = Date.now();
    game.state.lifetimeClaimed = (game.state.lifetimeClaimed || 0) + (amount || 0);
    game.save?.(); refreshWalletUI(game.state);
    openSimple("CLAIMED 受領", `+${fmtTok(amount || 0)} $GREY to your wallet · ${fmtTok(burned || 0)} burned (3%).`);
  } catch (e) { console.warn("[greymarket] claim not live yet", e); openClaimAtLaunch(); }
}

/* ---------- token sink ---------- */
export async function spendToken(game, sinkId, amount) {
  if (!isLive()) return { ok: true, demo: true };
  if (!game.state.wallet) { await connectWallet(game); if (!game.state.wallet) return { ok: false, reason: "no-wallet" }; }
  try {
    const resp = await fetch(apiBase() + GM.chain.api.spend, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ wallet: game.state.wallet, sink: sinkId, amount }),
    });
    if (!resp.ok) throw new Error("spend not built");
    const { txBase64 } = await resp.json();
    const web3 = await loadWeb3();
    const tx = web3.Transaction.from(Uint8Array.from(atob(txBase64), c => c.charCodeAt(0)));
    const signed = await provider.signTransaction(tx);
    const conn = new web3.Connection(GM.token.rpc, "confirmed");
    const sig = await conn.sendRawTransaction(signed.serialize());
    await conn.confirmTransaction(sig, "confirmed");
    return { ok: true, sig };
  } catch (e) { console.warn("[greymarket] spend failed", e); return { ok: false, reason: String(e) }; }
}

/* ---------- UI ---------- */
export function refreshWalletUI(state) {
  const wb = $("#walletBtn"); const wl = wb?.querySelector(".btn__label");
  if (wb) { (wl || wb).textContent = state?.wallet ? shortKey(state.wallet, 4) : "CONNECT WALLET"; wb.classList.toggle("is-on", !!state?.wallet); }
  const bw = $("#bankWallet"); if (bw) bw.textContent = state?.wallet ? shortKey(state.wallet, 5) : "not connected";
  const bb = $("#bankBalance"); if (bb) bb.textContent = fmtTok(state?.grey || 0);
  const lb = $("#licenseBadge"); if (lb) lb.textContent = isActivated(state) ? `sealed · ${state.license.tier}` : "— opens at launch";
  const st = $("#bankStatus"); if (st) st.textContent = isLive()
    ? "live · sealed berths earn a capped weekly drip"
    : "free demo · score, not a token";
  const cb = $("#claimBtn"); const cl = cb?.querySelector(".btn__label");
  if (cb) { if (!canClaim()) { (cl || cb).textContent = "CLAIM AT LAUNCH"; cb.disabled = true; } else { (cl || cb).textContent = "CLAIM $GREY"; cb.disabled = false; } }
  const badge = $("#chainBadge");
  if (badge) { const live = isLive(); badge.textContent = live ? (canClaim() ? "LIVE" : "LIVE·NO CLAIM") : (GM.token.network === "devnet" ? "DEVNET" : "DEMO"); badge.classList.toggle("live", live); }
  if (isLive()) $("#demoBanner")?.remove();
}
export const refreshLicenseUI = refreshWalletUI;

/* ---------- modals (B&W, honest) ---------- */
function openSimple(title, bodyHtml, btn = "KEEP PLAYING") {
  const root = $("#modalRoot"); if (!root) return;
  const wrap = document.createElement("div"); wrap.className = "modal show gm-modal";
  wrap.innerHTML = `<div class="modal__card panel"><div class="panel__corners"></div>
    <h3 class="modal__title">${title}</h3>
    <p class="gm-modal__body">${bodyHtml}</p>
    <button class="btn btn--primary x"><span class="btn__face"><span class="btn__label">${btn}</span></span><span class="btn__seal"></span></button></div>`;
  wrap.addEventListener("click", (e) => { if (e.target === wrap || e.target.closest(".x")) { wrap.classList.remove("show"); setTimeout(() => wrap.remove(), 200); } });
  root.appendChild(wrap);
}
export function openSealAtLaunch(tier) {
  const a = GM.chain.activation;
  const fee = tier?.feeSolValue ?? a.feeSolValue;
  openSimple(`${a.licenseName.toUpperCase()} 封印 — STAMPED AT LAUNCH`,
    `At launch, a per-season <b>${a.licenseName}</b> — sealed in <b>$GREY worth ≈${fee} SOL</b> and <b>burned</b> — unlocks a <b>real, capped weekly drip</b> of $GREY. Sealing in $GREY is the point: it gives the token real utility (buy &amp; burn to earn) and keeps the crowd from draining the pool, since every runner must buy in first. <b>Right now nothing here is real money</b> — it's a free demo.`);
}
export function openClaimAtLaunch() {
  openSimple("THE PORT ISN'T OPEN YET — THAT'S YOUR EDGE.",
    `Today's number is a <b>demo score</b>, not a $GREY entitlement, and it resets at launch. At launch a sealed berth earns a <b>real, capped weekly drip</b> of $GREY (the season faucet halves each week — the earliest sealed runners drip deepest). No pool drained, no printer, no rug.`);
}

/* ---------- web3 on demand ---------- */
let _web3 = null;
async function loadWeb3() {
  if (_web3) return _web3;
  try { _web3 = await import("../vendor/solana-web3.min.js"); }
  catch (_) { _web3 = await import("https://esm.sh/@solana/web3.js@1.95.3"); }
  return _web3;
}

/* ---------- expose for inline handlers ---------- */
window.GM_connect  = (g) => connectWallet(g);
window.GM_activate = (g, t) => payActivation(g, t);
window.GM_claim    = (g) => claim(g);
window.GM_spend    = (g, id, n) => spendToken(g, id, n);
