# UI Responsiveness QA — Pixel 9 Pro XL / 448 px CSS viewport

**Device:** Google Pixel 9 Pro XL  
**Physical px:** 1344 × 2992, dPR ≈ 3.0  
**CSS viewport:** 448 × 997 px (20:9, edge-to-edge, gesture nav, centre punch-hole)  
**File audited:** `/home/user/hashish-history/app/assets/index.html`  
**Screenshot evidence:** clipping of the `HASHISH` `<h1>` on both left and right edges visible in 2c2d862e-8696.png

---

## P0 — Critical

### Issue 1 · H1 "HASHISH" clips on both edges

**Root cause.**  
The current rule is:

```css
#hero h1 { font-size: clamp(56px, 21vw, 104px); letter-spacing: .01em; }
```

At 448 px viewport: `21 × 4.48 = 94.08 px`.  
The `#hero` container has horizontal padding of `22 px` each side, leaving **404 px** of inner width.  
A seven-letter all-caps serif word at 94 px is roughly `7 × 94 × 0.64 ≈ 421 px` wide — overflowing by **~17–24 px**. The screenshot confirms this; the "H" is cut at the left edge.

Additional problem: `#hero h1` has no `overflow:hidden`, no `max-width`, and no `width:100%` constraint, so the text simply bleeds past the padding box.

**Fix A — CSS-only (clamp re-tune + negative letter-spacing).**  
Reduce the viewport-relative coefficient and add a small negative letter-spacing at the narrow end:

```css
#hero h1 {
  font-size: clamp(44px, 17.5vw, 104px);   /* 17.5 × 4.48 = 78.4 px at 448 px */
  letter-spacing: -0.01em;                  /* tighten at all sizes */
  width: 100%;                              /* hard-constrain to hero padding box */
  overflow: hidden;                         /* safety net */
}
```

At 448 px this yields `~78 px`, giving estimated text width `7 × 78 × 0.64 ≈ 349 px` — well inside the 404 px budget. On a 1280 px desktop viewport `17.5vw = 224 px`, but the `104 px` clamp max keeps it in check.

**Fix B — JS auto-fit (bulletproof, fonts-aware).**  
Run this once after the page is fully painted (after any font-load and animation delay) so the browser's actual metrics drive the shrink:

```js
(function fitH1() {
  const h1 = document.querySelector('#hero h1');
  if (!h1) return;

  /* 1. Measure the element without wrapping */
  const savedWS = h1.style.whiteSpace;
  h1.style.whiteSpace = 'nowrap';

  let fs = parseFloat(getComputedStyle(h1).fontSize);
  const maxFs = fs;

  /* 2. Binary-search downward until text fits its padding box */
  while (h1.scrollWidth > h1.offsetWidth && fs > 32) {
    fs -= 1;
    h1.style.fontSize = fs + 'px';
  }

  /* 3. Restore wrapping; add proportional negative tracking */
  h1.style.whiteSpace = savedWS;
  if (fs < maxFs) {
    const reduction = maxFs - fs;                       /* px shrunk */
    const ls = Math.max(-0.04, -0.004 * reduction);     /* max -0.04em */
    h1.style.letterSpacing = ls + 'em';
  }
})();
```

Call this in the `init()` function (already present in the script), or inside a `fonts.ready` promise if system fonts differ:

```js
function init() {
  fitH1();
  setupReveal(); setupCounters(); setupActiveNav(); setupProgress();
}
```

**Recommendation:** Apply Fix A (CSS) as the primary guard — it prevents the overflow at parse time — and add Fix B (JS) as a belt-and-suspenders runtime pass to handle font substitutions and future text changes.

---

### Issue 2 · `.eraHead` sticky `top` does not account for safe-area-inset-top

**Root cause.**  
`#eraNav` correctly grows taller when a non-zero `safe-area-inset-top` is present:

```css
#eraNav { padding: calc(var(--safe-t) + 8px) 0 8px; }
```

On Pixel 9 Pro XL the status bar is ~24 dp, so `--safe-t ≈ 24px`. The total rendered nav height is approximately:

| Component | Height |
|---|---|
| `padding-top` | `safe-t + 8 px` = `32 px` |
| navChip content (font + padding) | `≈ 29 px` |
| `padding-bottom` | `8 px` |
| **Total** | **`safe-t + 45 px`** |

But `.eraHead` has a hardcoded:

```css
.eraHead { top: 54px; }
```

Without safe-area (WebView full-screen mock): `54 px > 45 px` — slightly over the nav, mostly fine.  
With `safe-t = 24 px`: nav height = **69 px**, but eraHead still starts at 54 px — **the era heading slides 15 px behind the sticky nav**.

**Fix:**

```css
.eraHead {
  top: calc(var(--safe-t) + 45px);
}
```

If the navChip padding is also changed (see tap-target fix below), recalculate: `safe-t + 8 + 36 + 8 = safe-t + 52px` would be the updated value.

---

## P1 — High (Tap targets below 44 px)

Apple HIG and Material You both require a minimum 44 × 44 dp / px tap target. Three interactive elements fail this test.

### Issue 3 · `.navChip` tap target too small

Current height: `font-size(12.5px) + padding-top(8px) + padding-bottom(8px)` = **28.5 px**.

```css
.navChip {
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  padding: 0 16px;           /* horizontal only; vertical handled by min-height + flex */
}
```

Note: if you change the vertical padding structure, update `.eraHead { top: calc(var(--safe-t) + 52px) }` accordingly (see Issue 2).

### Issue 4 · `.fchip` tap target too small

Same problem as `.navChip`: current height ≈ **28.5 px**.

```css
.fchip {
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  padding: 0 13px;
}
```

### Issue 5 · `.begin` button tap target slightly short

Current: `font-size(14px) + padding(13px × 2)` = **40 px**.

```css
.begin {
  min-height: 44px;
  padding: 0 22px;           /* let min-height drive the vertical */
}
```

---

## P2 — Medium

### Issue 6 · Hero bottom padding ignores `safe-area-inset-bottom`

The bottom of `#hero` has a hardcoded `40px` bottom padding. On a device with gesture navigation the gesture handle sits inside `safe-area-inset-bottom` (≈ 20–34 px on Pixel 9 Pro XL). The "Begin the journey" button can therefore land inside the gesture interception zone.

```css
#hero {
  padding: calc(var(--safe-t) + 40px) 22px calc(var(--safe-b) + 40px);
}
```

### Issue 7 · `.navScroll` missing `padding-right` — last era chip clipped

```css
#eraNav .navScroll { padding: 0 16px 0 16px; }
```

Currently only `padding-left:16px` is set. On overflow-scroll containers, the browser does not add trailing space after the last child — the final "Science & …" or longest era chip is cut flush at the right edge of the viewport.

```css
.navScroll {
  padding: 0 16px;    /* shorthand sets both left and right */
}
```

### Issue 8 · Hero vertical rhythm feels floaty

At 997 px tall viewport, all hero content stacks to roughly **556 px**. With `justify-content: center`, the browser places ~168 px of dead space above the coin and below the button. On a 20:9 display this creates a visually imbalanced hero where the content floats in the middle with too much breathing room above.

The fix is to shift the optical centre upward slightly by changing `justify-content` and using asymmetric padding that pulls content toward the upper-middle third:

```css
#hero {
  /* replace justify-content:center */
  justify-content: flex-start;
  /* add enough top push to reach ~35% of viewport height before content starts */
  padding-top: max(calc(var(--safe-t) + 56px), 15svh);
  padding-bottom: calc(var(--safe-b) + 40px);
}
```

This anchors the coin at roughly 15% down the screen and lets the hero "breathe" toward the bottom — more natural on a very tall display. Tweak `15svh` to `13svh`–`18svh` to taste.

---

## P3 — Low / Polish

### Issue 9 · No `:active` feedback on interactive elements

On Android WebView, `:hover` never fires on touch. `.navChip`, `.fchip`, `.begin`, `.myth`, and `.card` all lack an `:active` state. Add at minimum:

```css
.navChip:active, .fchip:active, .begin:active {
  opacity: 0.7;
  transition: opacity 0.08s;
}
.myth:active {
  background: linear-gradient(180deg, var(--panel2), var(--bg2));
}
```

### Issue 10 · `#progress` bar renders above safe-area

The 3 px progress bar is `position:fixed; top:0`. On edge-to-edge it draws in the status bar area. This is usually acceptable since it's purely decorative, but if the status bar icons have a light background they can obscure the bar. Optionally:

```css
#progress {
  top: var(--safe-t);   /* push below status bar */
}
```

### Issue 11 · `.lede` `max-width: 30ch` is generous at 448 px

`30ch ≈ 240 px` at 15 px font — comfortable, but `26ch` would produce a slightly better line-measure on a narrow screen (optimal prose width 55–75 chars ≈ 27.5–37.5ch for this font size).

```css
#hero .lede {
  max-width: 26ch;
}
```

### Issue 12 · `.eraHead .bl` `max-width: 42ch` may be tight

The era blurb allows `42ch ≈ 336 px` at 13.5 px. The `.wrap` provides 408 px — so 42ch never overflows. No fix needed.

---

## Consolidated Fix Checklist (paste-ready)

```css
/* === P0: H1 overflow fix === */
#hero h1 {
  font-size: clamp(44px, 17.5vw, 104px);
  letter-spacing: -0.01em;
  width: 100%;
  overflow: hidden;
}

/* === P0/P2: Safe-area — hero === */
#hero {
  justify-content: flex-start;
  padding-top: max(calc(var(--safe-t) + 56px), 15svh);
  padding-bottom: calc(var(--safe-b) + 40px);
  padding-left: 22px;
  padding-right: 22px;
}

/* === P0: eraHead sticky top accounts for nav height + safe-area === */
/* (use this value when navChip vertical padding is unchanged) */
.eraHead {
  top: calc(var(--safe-t) + 45px);
}
/* (use this value if navChip min-height fix below is also applied) */
/* .eraHead { top: calc(var(--safe-t) + 52px); } */

/* === P1: Tap targets === */
.navChip {
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  padding: 0 16px;
}

.fchip {
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  padding: 0 13px;
}

.begin {
  min-height: 44px;
  padding: 0 22px;
}

/* === P2: navScroll trailing padding === */
.navScroll {
  padding: 0 16px;
}

/* === P3: Active states for touch === */
.navChip:active, .fchip:active, .begin:active {
  opacity: 0.7;
  transition: opacity 0.08s;
}
.myth:active {
  background: linear-gradient(180deg, var(--panel2), var(--bg2));
}

/* === P3: Progress bar below status bar === */
#progress {
  top: var(--safe-t);
}

/* === P3: Lede max-width tighten === */
#hero .lede {
  max-width: 26ch;
}
```

```js
/* === P0: JS H1 auto-fit — paste inside init() === */
(function fitH1() {
  const h1 = document.querySelector('#hero h1');
  if (!h1) return;
  const savedWS = h1.style.whiteSpace;
  h1.style.whiteSpace = 'nowrap';
  let fs = parseFloat(getComputedStyle(h1).fontSize);
  const maxFs = fs;
  while (h1.scrollWidth > h1.offsetWidth && fs > 32) {
    fs -= 1;
    h1.style.fontSize = fs + 'px';
  }
  h1.style.whiteSpace = savedWS;
  if (fs < maxFs) {
    h1.style.letterSpacing = Math.max(-0.04, -0.004 * (maxFs - fs)) + 'em';
  }
})();
```

---

## Issue Priority Table

| # | Severity | Element | Problem | Fix |
|---|---|---|---|---|
| 1 | P0 | `#hero h1` | Clips ~20 px on each side at 448 px | CSS clamp re-tune + JS fit |
| 2 | P0 | `.eraHead` | `top:54px` ignores safe-area nav growth | `top: calc(var(--safe-t) + 45px)` |
| 3 | P1 | `.navChip` | 28.5 px tap target | `min-height:44px` + flex |
| 4 | P1 | `.fchip` | 28.5 px tap target | `min-height:44px` + flex |
| 5 | P1 | `.begin` | 40 px tap target | `min-height:44px` |
| 6 | P2 | `#hero` | Bottom padding ignores gesture bar | Add `safe-b` to bottom padding |
| 7 | P2 | `.navScroll` | No `padding-right`, last chip clipped | `padding: 0 16px` |
| 8 | P2 | `#hero` | Content floats in 997 px viewport | `flex-start` + asymmetric padding |
| 9 | P3 | Interactive els | No `:active` state on touch | Add `:active` CSS |
| 10 | P3 | `#progress` | Renders behind status bar | `top: var(--safe-t)` |
| 11 | P3 | `.lede` | 30ch slightly wide for 448 px | `max-width: 26ch` |
