# GREYMARKET 墨市

**An idle smuggling terminal.** Your haulers run the routes while you sleep — but the crowd drowns the price. Sell into a soaked port and the ink dries to nothing. The yield is in the negative space. *Read the dry quadrant.*

Direction: **"SUMI-E TERMINAL"** — strict monochrome (accent = inversion, zero chroma), Genos + bespoke SVG wordmark + Yuji Syuku katakana, ink-on-bone-paper. See `DESIGN_BIBLE.md`.

## Run locally
```bash
./serve.sh            # → http://localhost:8848
# or: uv run python3 -m http.server 8848
```
Then open **http://localhost:8848**.

## The game
- **Haulers** produce goods every second (idle — online or asleep).
- **Six ports** are one shared pool. Your own volume craters the price (price impact). Crowded = low yield.
- **Sealed commit-reveal:** pick a berth, COMMIT SELL → the order seals → resolves at the next batch.
- **The edge:** congestion updates *at resolution*. Buy **Intel** to forecast which dry berth is about to flood (the ghost pre-stamp). The skill is betting where the crowd *isn't going*. There are hidden per-port demand windows to discover.
- **Standing Order:** auto-sells the quietest berth each batch — runs while you sleep, but has no foresight, so active play beats it.
- Progress saves to `localStorage`; offline earnings on return.

## Stack
Vanilla HTML/CSS/JS · GSAP + Lenis (vendored, offline-safe) · no build step.

## Assets
Generated with **GPT Image 2** (4K stills) + **Seedance 2.0** (hero ink-drop loop), strictly B&W, composited under bespoke HTML/CSS/SVG. Sources in `assets/`, web-optimized in `assets/web/`.

*Prototype — off-chain simulation. $GREY, ports & yields are illustrative game state.*
