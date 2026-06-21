# GREYMARKET — DESIGN BIBLE
## Direction: "SUMI-E TERMINAL" (墨市)
*Locked final visual system. Lead = Sumi-e Terminal (judged 8.4, sole "lead"). Two critiqued risks fixed; best ideas grafted from the other three directions.*

---

### 0. THE ONE IDEA
The interface is a single sheet of wet sumi-e paper stretched over a cold data terminal. **Ink is the only ink.** Congestion = ink saturation; a crowded port is a stain that **dries to dead black and stops paying**. Liquidity is wetness; opportunity is the dry quadrant about to bloom. The player learns to read the **negative space** of the market like a calligrapher reads the unpainted page. The AMM-congestion edge and the sumi-e principle of *notan* (the unpainted page) are **the same object** — that is why this wins. Restraint IS the design: ~90% of every screen is still ink on still paper.

**Tagline:** *The empty page pays. Read the dry quadrant.*

---

### 1. TYPOGRAPHY (all free, all verified live on Google Fonts)
- **Display / headlines / reveal numbers — GENOS (800/900).** Sharp knife/flared terminals = genuine mecha/anime title-card tension. Explicitly NOT Orbitron, NOT Zen Dots, NOT Anton (SIEGE). Hero glyphs get the baked sumi-bleed mask on arrival.
- **Wordmark — BESPOKE inline SVG** (paths, not a font). Knife-terminal custom glyphs on a shared ink-bleed baseline; a -7° brushed **墨市** chop stamps in last.
- **Workhorse / body — INTER TIGHT (400/500/600).** -1% to -2% tracking, 1.5 leading.
- **Data / HUD — MARTIAN MONO (300/500/700, tabular-nums).**
- **Japanese identity — YUJI SYUKU** (brushed mincho); **ZEN KAKU GOTHIC NEW** for clean inline kana labels.

Font load:
```
Genos:wght@800;900 (+ ital 800)
Inter+Tight:wght@400;500;600
Martian+Mono:wght@300;500;700
Yuji+Syuku
Zen+Kaku+Gothic+New:wght@400;500;700
```

---

### 2. COLOR — strict 4-layer monochrome, ZERO chroma
| Role | Hex |
|---|---|
| paper-base (deep ground) | `#0B0B0C` |
| panel-ink | `#141416` |
| panel-ink-2 | `#1B1B1E` |
| hairline-grid | `rgba(244,241,234,0.08)` |
| dried-recede (dead/congested) | `#26262A` |
| muted-info | `#5A5A5E` |
| wet-live (active) | `#C9C7C0` |
| paper-knockout (inversion/CTA/reveal) | `#F4F1EA` |

**Accent = INVERSION, not a hue.** The 10-layer (60-30-10) is a paper-white knockout out of solid ink, reserved for CTA / active / reveal only.

**Value-hierarchy rule:** dead/congested ports **recede toward panel-black** (lose contrast, sink into the page). Only **wet/live/about-to-bloom** gains high contrast. High contrast = opportunity & payout; low contrast = choked, paying nothing. The one signal hairline is a 1px paper-white line tracing the live under-exploited route.

---

### 3. SIGNATURE COMPONENTS (bespoke shapes only — zero rounded rects)
1. **Wordmark** — inline SVG, drawn via stroke-dashoffset then filled; 墨市 chop presses in last.
2. **COMMIT SELL CTA** — torn-paper deckle `clip-path:polygon(0 0,100% 0,100% calc(100% - 9px),94% 100%,38% 96%,12% 100%,0 92%)` with a wax-seal node; hover = short live feTurbulence bloom from the torn edge; commit = full inversion + one wet-bloom ring + STAMP.
3. **THE MANIFOLD** — 24 hairline ticks, height = congestion; a paper yield-curve `<path>` that **droops into a valley over the crowded ticks**; the selected dry tick is the only inverted element, standing proud.
4. **Route scroll-strip** — hanko L-bracket corner ticks (no radius), 3% grain, vertical katakana spine; congestion = baked ink-saturation mask flooding the strip, yield number recedes.
5. **Ink-meter** — wet column behind a baked sumi meniscus mask; odometer count-ups + CSS wobble (no per-frame filter).
6. **SEALED panel** — on commit goes fully dark, 封印 + countdown; you literally cannot watch the batch resolve.
7. **Section chrome** — no boxes; a single tapered brushed-ink RULE + corner registration crosshairs. Negative space frames.
8. **PORT GRID** — 6-quadrant contact sheet of ink-blot ports (one baked feTurbulence displacement texture); the dry quadrant carries the signal hairline; a ghost pre-stamp (30%) forecasts the next port to crowd.

---

### 4. MOTION
- **Signature = SUMI BLEED arrival** (baked alpha-mask sprite/WebM, ~600ms, sharp-in/viscous-settle). Live feTurbulence ONLY for the reveal bloom + CTA hover (perf).
- **Three dry verbs:** STAMP (90–120ms scale-snap) · REDACT (180ms clip wipe) · DECLASSIFY/BLOOM (220ms inversion).
- Brush rules draw via stroke-dashoffset; hanko ticks flick in; tabular count-ups with odometer hard-stop.
- Lenis + GSAP ScrollTrigger; left katakana gutter parallax 0.85x.
- Restraint: ~90% still; idle = 2s signal-hairline pulse + occasional 60ms glyph glitch. Full-screen inversion flash fires ONLY on sell-resolve.

---

### 5. THE EDGE-UI MOMENT — DRY-QUADRANT REVEAL
1. **READ** — Manifold + drooping yield curve + ghost pre-stamp tell which dry cell is about to crowd.
2. **COMMIT** — torn-paper CTA → STAMP → panel folds → bid goes BLACK under 封 → countdown.
3. **RESOLVE** — every soaked port DRIES and RECEDES (yield drops, sinks) → then ONE ~280ms full-screen **INVERSION FLASH** (ink↔paper, grain inverts, 60ms snap / 220ms ease-out).
4. **PAYOFF** — your dry cell BLOOMS (live feTurbulence radial), inverts to a solid ink block with realized-yield punched out in paper-white, count-up firing, its Manifold tick now tallest against the receded crowd.

One-second lesson: **heaviest ink dried to nothing; the empty page paid.**

---

### 6. ASSETS (lean: 4 stills + 1 loop; strictly B&W, film-grain, no text/logos/UI, clean overlay zones)
1. `greymarket_hero_inkdrop_loop_1080p.mp4` — Seedance 2.0 — macro ink-drop bloom; hero bg + bleed-mask source.
2. `greymarket_fog_port_quiet_plate_4k.png` — GPT Image 2 (4k) — 4am fog-drowned port; emptiness = opportunity.
3. `greymarket_dried_cracked_ink_texture_4k.png` — GPT Image 2 — dried cracked ink; congested states + 3% grain.
4. `greymarket_calligraphy_brushstroke_4k.png` — GPT Image 2 — vector-traced into RULEs, wordmark baseline, hanko ticks.

All chrome is bespoke HTML/CSS/SVG. Generated imagery is atmosphere only.

---

### 7. DISTINCT FROM SIEGE
| Axis | SIEGE | GREYMARKET |
|---|---|---|
| Color | black + GOLD | strictly monochrome; accent = paper INVERSION |
| Display | Anton | Genos + bespoke SVG + Yuji Syuku katakana |
| Body/Mono | Inter / JetBrains | Inter Tight / Martian Mono |
| World | velvet vault, heist-luxe | sumi-e ink on bone paper, fog-port austerity |
| Juice | gold heist reveals | ink-bleed physics + inversion flash |
