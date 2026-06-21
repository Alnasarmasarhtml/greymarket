/* =====================================================================
   GREYMARKET 墨市 — global / on-chain config
   ---------------------------------------------------------------------
   Everything launch-related lives here. To go LIVE at launch:
     1. set token.launched = true
     2. paste token.mint / treasury / treasuryAta / claimHotWallet / programId
     3. set token.api (backend base URL) + token.priceOracle (value-peg)
     4. devnet-verify the backend (see DESIGN_BIBLE chain note), then claimEnabled = true
   REAL earning needs that backend (signer + drip ledger + oracle) — NOT just
   the contract. No api / no oracle => the game stays an honest free DEMO.
   ===================================================================== */
export const GM = {
  name: "GREYMARKET", kanji: "墨市", ticker: "$GREY",

  token: {
    launched: false,              // <<< flip true at launch
    mint: "", symbol: "GREY", decimals: 9,
    treasury: "", treasuryAta: "", claimHotWallet: "",
    programId: "",                // <<< Berth-Seal PDA + claim ceiling program
    api: "",                      // <<< backend base URL (https). "" => DEMO
    priceOracle: "",              // <<< DEX/TWAP oracle for the value-peg. "" => keep claimEnabled false
    network: "mainnet-beta",
    rpc: "https://api.mainnet-beta.solana.com",
    claimEnabled: false,
    burnAddress: "1nc1nerator11111111111111111111111111111111",
    links: { dexscreener: "", pumpfun: "", raydium: "", x: "", telegram: "", docs: "#manifest" },
  },

  /* ---- on-chain economy (anti-drain). Token enters only via server time-drip
     → claim, only for a wallet that paid a per-epoch Berth Seal. Gameplay does
     NOT mint claimable token. Botting EV ≤ 0 at any price. ---- */
  chain: {
    activation: {
      enabled: true, licenseName: "Berth Seal", recurring: true,
      feeSol: 0.04, feeToken: 0, feeTokenBurn: true,
      tiers: [
        { id: "runner",    feeSol: 0.04, epochCapMult: 1.0, claimCooldownH: 24 },
        { id: "fixer",     feeSol: 0.20, epochCapMult: 1.8, claimCooldownH: 12 },
        { id: "syndicate", feeSol: 0.80, epochCapMult: 3.0, claimCooldownH: 6  },
      ],
      refundable: false, receiver: "",
    },
    earn: {
      mode: "time-drip", epochHours: 168,
      epochCapTokens: 60, valuePegMarginFactor: 0.5,
      globalEpochFaucet: 30000, globalFaucetHalfLifeEpochs: 1,
      perAccountLifetimeCap: 90, diminishingAfterPct: 60, minAccountAgeH: 24,
    },
    claim: { burnBps: 300, minClaimTokens: 1, vestHours: 0, perDayTreasuryOutflowCap: 1500 },
    buyback: { pctOfRevenue: 70 },
    api: { activate: "/api/activate", nonce: "/api/nonce", accrual: "/api/accrual",
           claim: "/api/claim", spend: "/api/spend", status: "/api/status", price: "/api/price" },
  },

  supply: {
    total: 1_000_000_000,
    allocation: [
      { label: "Sealed-Batch Reward Pool", pct: 40, note: "The global epoch faucet. Halves every season." },
      { label: "Liquidity (burned)",       pct: 20, note: "LP burned at launch." },
      { label: "Treasury / Buyback",       pct: 15, note: "Seal fees + fees → buyback-and-burn." },
      { label: "Community / Connect",      pct: 10, note: "Server-attested sessions only — never localStorage." },
      { label: "Team (vested)",            pct: 10, note: "12-mo linear vest." },
      { label: "Prizes",                   pct:  5, note: "Leaderboard / events." },
    ],
    taxBurnPct: 3, buybackPctOfRevenue: 70,
  },

  save: { key: "greymarket.save.v1" },   // must match the in-file CFG.SAVE_KEY in game.js
};

export const isLive       = () => GM.token.launched === true && !!GM.token.mint && !!GM.token.api && !!GM.token.priceOracle;
export const canClaim     = () => isLive() && GM.token.claimEnabled === true;
export const apiBase      = () => (GM.token.api || "").replace(/\/$/, "");
export const currentEpoch = () => Math.floor((Date.now() / 3600000) / GM.chain.earn.epochHours);
export const isActivated  = (s) => !!s?.license?.active && !!s?.license?.sig && (s?.license?.epoch === currentEpoch());
