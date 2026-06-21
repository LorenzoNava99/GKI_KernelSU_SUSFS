# Hashish — A History: Visual Design Upgrade

**Target:** Android WebView, Pixel 9 Pro XL, logical viewport ≈ 448px  
**Aesthetic:** Museum exhibit × fine-spirits apothecary label  
**Palette:** Warm resin/amber/gold on near-black, tactile grain, editorial typography

---

## 1. Color System

```css
:root {
  /* Backgrounds — deeper, more layered */
  --bg:    #0A0704;
  --bg2:   #110C07;
  --panel: #18110A;
  --panel2:#201809;
  --panel3:#251E0E;

  /* Gold spectrum — richer gradient range */
  --gold:    #C4924A;
  --gold-hi: #EAC57A;
  --gold-lo: #7B5A24;
  --ember:   #C45F28;
  --ember-hi:#E07A40;

  /* Text */
  --ink:    #F0E4CC;
  --ink2:   #DDD0B4;
  --muted:  #9E8E75;
  --faint:  #6A5C48;

  /* Theme tags */
  --faith:   #C9A24B;
  --science: #6EB3A3;
  --law:     #C4602A;
  --culture: #B788C4;

  /* Structural */
  --line:    rgba(196,146,74,.20);
  --line-hi: rgba(234,197,122,.30);
  --rail:    rgba(196,146,74,.28);
}
```

---

## 2. Background System

Three techniques stacked:
1. **Radial "forge glow"** — warm amber at top-center, ember at top-right, fading to the near-black base
2. **Vignette overlay** — fixed radial gradient, deep black at all four corners
3. **Film grain** — SVG feTurbulence tile, fixed, ~6% opacity — the key texture element that makes it feel printed/tactile

```css
body {
  background:
    radial-gradient(ellipse 160% 70% at 50% -5%, rgba(196,146,74,.14) 0%, transparent 55%),
    radial-gradient(ellipse 90%  50% at 90% 10%, rgba(196,96,40,.08)  0%, transparent 55%),
    radial-gradient(ellipse 60%  40% at 8%  85%, rgba(100,60,15,.06)  0%, transparent 60%),
    var(--bg);
  background-attachment: fixed;
}

/* Vignette — dark corners */
body::after {
  content: "";
  position: fixed; inset: 0; pointer-events: none; z-index: 2;
  background: radial-gradient(ellipse 100% 100% at 50% 50%,
    transparent 40%, rgba(4,3,2,.55) 85%, rgba(2,1,0,.85) 100%);
}

/* Film grain */
body::before {
  content: "";
  position: fixed; inset: 0; pointer-events: none; z-index: 3; opacity: .058;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.72 .75' numOctaves='4' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>");
  background-size: 200px 200px;
}
```

---

## 3. Hero Section

### 3a. HASHISH Title Treatment

Issues with current: `font-size: clamp(56px,21vw,104px)` is too large at 448px (≈94px) and clips edges. Fix: reduce the clamp upper range, tighten tracking, add a richer gradient and layered text-shadow that simulates emboss.

```css
#hero h1 {
  font-family: var(--serif);
  font-weight: 700;
  font-size: clamp(48px, 17.5vw, 88px);   /* was 21vw / 104px — prevent clipping */
  line-height: .9;
  margin: 0;
  letter-spacing: .04em;                   /* slightly wider — feels engraved */
  padding: 0 4px;                          /* stop edge clip */
  background: linear-gradient(
    175deg,
    #FBF0D2  0%,
    #EAC57A 30%,
    #C4924A 60%,
    #7B5A24 85%,
    #4A360F 100%
  );
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  /* Emboss: bright highlight above, deep shadow below */
  filter: drop-shadow(0 1px 0 rgba(255,230,150,.18)) drop-shadow(0 4px 18px rgba(0,0,0,.7));
  animation: rise 1.1s .1s both;
}
```

### 3b. Hero background haze

A soft smoke/haze behind the coin and title — a second radial that's local to the hero, not fixed.

```css
#hero::before {
  content: "";
  position: absolute; inset: 0; pointer-events: none;
  background:
    radial-gradient(ellipse 75% 55% at 50% 32%,
      rgba(196,146,74,.09) 0%,
      rgba(130,80,20,.06) 40%,
      transparent 70%),
    radial-gradient(ellipse 55% 40% at 50% 25%,
      rgba(240,200,100,.04) 0%,
      transparent 60%);
  z-index: 0;
}
#hero > * { position: relative; z-index: 1; }
```

### 3c. Upgraded Coin SVG

Design: a "pressed hashish wax seal" look.
- Outer ring: thin chamfered border, dark
- Second ring: concentric stamp ridge, slightly inset
- Third ring: another lighter ridge
- Center field: subtle radial gradient giving the resin/wax color
- Center glyph: a stylized cannabis leaf silhouette in linework (not filled), engraved
- Specular highlight: a small elliptical white-ish bloom at upper-left
- Emboss shadows: dark arcs at bottom-right of the rings

```svg
<svg class="coin" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <!-- Main resin gradient: upper-left light, lower-right dark -->
    <radialGradient id="cg" cx="38%" cy="35%" r="72%">
      <stop offset="0%"   stop-color="#F2D98A"/>
      <stop offset="28%"  stop-color="#D4A84E"/>
      <stop offset="62%"  stop-color="#9A6D2A"/>
      <stop offset="100%" stop-color="#4E3610"/>
    </radialGradient>
    <!-- Edge chamfer: dark inner stroke for the outer ring -->
    <radialGradient id="eg" cx="50%" cy="50%" r="50%">
      <stop offset="85%"  stop-color="transparent"/>
      <stop offset="100%" stop-color="rgba(0,0,0,.55)"/>
    </radialGradient>
    <!-- Specular bloom -->
    <radialGradient id="sp" cx="38%" cy="30%" r="40%">
      <stop offset="0%"   stop-color="rgba(255,245,200,.55)"/>
      <stop offset="100%" stop-color="transparent"/>
    </radialGradient>
    <!-- Emboss highlight on ring edges -->
    <filter id="emboss" x="-5%" y="-5%" width="110%" height="110%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="1.2" result="blur"/>
      <feOffset dx=".6" dy="1.2" result="offset"/>
      <feComposite in="SourceGraphic" in2="offset" operator="over"/>
    </filter>
    <!-- Soft inner shadow on outer disc -->
    <filter id="inner" x="-10%" y="-10%" width="120%" height="120%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="2.5" result="b"/>
      <feOffset dx="1" dy="2" result="o"/>
      <feFlood flood-color="rgba(0,0,0,.6)" result="c"/>
      <feComposite in="c" in2="o" operator="in" result="i"/>
      <feMerge><feMergeNode in="i"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <!-- Drop shadow beneath coin -->
  <ellipse cx="60" cy="107" rx="28" ry="5" fill="black" opacity=".35"/>

  <!-- === OUTER RIM === -->
  <!-- Outer dark border (raised edge, chamfered look) -->
  <circle cx="60" cy="60" r="54" fill="#2A1D09"/>
  <!-- Outer rim highlight at top-left -->
  <circle cx="60" cy="60" r="54" fill="none"
    stroke="rgba(220,175,90,.35)" stroke-width="1.2"/>
  <!-- Outer rim shadow at bottom-right -->
  <circle cx="60" cy="60" r="54" fill="none"
    stroke="rgba(0,0,0,.7)" stroke-width="1.5"
    stroke-dasharray="170 340" stroke-dashoffset="-85"/>

  <!-- === FIRST CONCENTRIC GROOVE === -->
  <circle cx="60" cy="60" r="50" fill="none"
    stroke="#1A1107" stroke-width="3"/>
  <circle cx="60" cy="60" r="50" fill="none"
    stroke="rgba(210,160,70,.22)" stroke-width=".8"/>

  <!-- === COIN FACE (main disc) === -->
  <circle cx="60" cy="60" r="47" fill="url(#cg)"/>

  <!-- === SECOND CONCENTRIC GROOVE (inner stamp ring) === -->
  <circle cx="60" cy="60" r="43" fill="none"
    stroke="rgba(40,24,6,.75)" stroke-width="2.5"/>
  <circle cx="60" cy="60" r="43" fill="none"
    stroke="rgba(240,195,100,.20)" stroke-width=".7"/>

  <!-- === THIRD FINE RING (inner detail) === -->
  <circle cx="60" cy="60" r="39" fill="none"
    stroke="rgba(40,24,6,.55)" stroke-width="1.2"/>
  <circle cx="60" cy="60" r="39" fill="none"
    stroke="rgba(240,195,100,.15)" stroke-width=".5"/>

  <!-- === INNER FIELD (slightly darker recess) === -->
  <circle cx="60" cy="60" r="37"
    fill="rgba(0,0,0,.12)"/>

  <!-- === CANNABIS LEAF GLYPH (engraved linework, 5-point stylised) === -->
  <!-- Centered at 60,60; total height ~26px; thin stroke = engraved feel -->
  <g transform="translate(60,62)" opacity=".82" stroke="rgba(30,18,5,.9)" stroke-width="1.1" fill="rgba(60,35,8,.55)" stroke-linejoin="round">
    <!-- Centre stem -->
    <line x1="0" y1="-20" x2="0" y2="12" stroke="rgba(30,18,5,.8)" stroke-width="1.0"/>
    <!-- Main (top) leaf pair -->
    <path d="M0,-18 C-2,-14 -9,-12 -12,-7 C-8,-9 -4,-9 0,-7 C4,-9 8,-9 12,-7 C9,-12 2,-14 0,-18Z"/>
    <!-- Mid-left leaf -->
    <path d="M0,-10 C-3,-8 -12,-6 -14,-1 C-10,-4 -6,-5 0,-4 C-1,-6 -1,-8 0,-10Z"/>
    <!-- Mid-right leaf -->
    <path d="M0,-10 C3,-8 12,-6 14,-1 C10,-4 6,-5 0,-4 C1,-6 1,-8 0,-10Z"/>
    <!-- Lower-left leaf -->
    <path d="M0,-2 C-2,-1 -9,2 -10,7 C-7,4 -4,3 0,4 C-1,1 -1,-1 0,-2Z"/>
    <!-- Lower-right leaf -->
    <path d="M0,-2 C2,-1 9,2 10,7 C7,4 4,3 0,4 C1,1 1,-1 0,-2Z"/>
    <!-- Root base -->
    <path d="M-2,12 C-2,14 2,14 2,12 C2,10 1,8 0,6 C-1,8 -2,10 -2,12Z"/>
  </g>

  <!-- === SPECULAR HIGHLIGHT === -->
  <circle cx="60" cy="60" r="47" fill="url(#sp)" opacity=".7"/>

  <!-- === OUTER EDGE INNER SHADOW (deepens the rim) === -->
  <circle cx="60" cy="60" r="47" fill="url(#eg)"/>
</svg>
```

### 3d. Hero stats — frosted amber tiles

```css
.heroStats .hs {
  flex: 1;
  background: linear-gradient(160deg, rgba(40,28,12,.72), rgba(20,14,6,.72));
  border: 1px solid rgba(196,146,74,.22);
  border-top-color: rgba(234,197,122,.30);
  border-radius: 14px;
  padding: 14px 8px 12px;
  backdrop-filter: blur(4px);
  box-shadow: inset 0 1px 0 rgba(234,197,122,.12), 0 4px 20px rgba(0,0,0,.35);
}
.heroStats .n {
  font-family: var(--serif);
  font-size: 23px;
  color: var(--gold-hi);
  line-height: 1;
  letter-spacing: .01em;
}
.heroStats .l {
  font-size: 10px;
  color: var(--muted);
  margin-top: 6px;
  letter-spacing: .03em;
  line-height: 1.4;
}
```

### 3e. Begin button

```css
.begin {
  margin-top: 36px;
  display: inline-flex;
  align-items: center;
  gap: 9px;
  border: 1px solid rgba(196,146,74,.30);
  border-top-color: rgba(234,197,122,.45);
  background: linear-gradient(180deg, rgba(196,146,74,.10), rgba(196,146,74,.04));
  color: var(--ink);
  padding: 14px 26px;
  border-radius: 999px;
  font-size: 14px;
  letter-spacing: .06em;
  text-transform: uppercase;
  cursor: pointer;
  box-shadow: 0 2px 20px rgba(196,146,74,.08), inset 0 1px 0 rgba(255,230,130,.08);
  transition: background .2s, box-shadow .2s, transform .12s;
}
.begin:active {
  transform: scale(.97);
  background: linear-gradient(180deg, rgba(196,146,74,.16), rgba(196,146,74,.08));
}
```

---

## 4. Era Navigation Bar

```css
#eraNav {
  position: sticky; top: 0; z-index: 50;
  background: linear-gradient(180deg, rgba(10,7,4,.97) 0%, rgba(10,7,4,.82) 100%);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--line);
  padding: calc(var(--safe-t) + 9px) 0 9px;
  box-shadow: 0 4px 24px rgba(0,0,0,.45);
}

.navChip {
  flex: 0 0 auto;
  font-size: 12px;
  padding: 8px 14px;
  border-radius: 999px;
  border: 1px solid rgba(196,146,74,.18);
  color: var(--muted);
  background: transparent;
  white-space: nowrap;
  cursor: pointer;
  transition: color .2s, background .2s, border-color .2s, box-shadow .2s;
  letter-spacing: .04em;
}
.navChip.on {
  color: #1a1004;
  background: linear-gradient(180deg, #EAC57A, #C4924A);
  border-color: transparent;
  font-weight: 700;
  box-shadow: 0 2px 12px rgba(196,146,74,.35);
}
```

---

## 5. Filter Chips

```css
.fchip {
  font-size: 12px;
  padding: 8px 14px;
  border-radius: 999px;
  border: 1px solid rgba(196,146,74,.18);
  color: var(--ink2);
  background: rgba(24,17,10,.55);
  cursor: pointer;
  transition: .2s;
  display: flex;
  align-items: center;
  gap: 7px;
  letter-spacing: .025em;
  box-shadow: inset 0 1px 0 rgba(255,230,130,.04);
}
.fchip.on {
  border-color: rgba(196,146,74,.50);
  background: rgba(196,146,74,.15);
  box-shadow: 0 0 12px rgba(196,146,74,.12), inset 0 1px 0 rgba(255,230,130,.08);
}
.fchip .dot {
  width: 7px; height: 7px; border-radius: 50%;
  box-shadow: 0 0 5px currentColor;
  opacity: .85;
}
```

---

## 6. Timeline

### 6a. Rail and nodes

The rail needs to be more elaborate — a thin amber line that fades to nothing, and nodes that glow.

```css
.track::before {
  content: "";
  position: absolute;
  left: 8px; top: 8px; bottom: 14px;
  width: 1.5px;
  background: linear-gradient(180deg,
    var(--gold) 0%,
    rgba(196,146,74,.35) 40%,
    rgba(196,146,74,.08) 80%,
    transparent 100%
  );
  border-radius: 1px;
}

.card::before {
  content: "";
  position: absolute;
  left: -27px; top: 22px;
  width: 12px; height: 12px;
  border-radius: 50%;
  background: var(--bg);
  border: 2px solid var(--gold);
  box-shadow:
    0 0 0 3px var(--bg),
    0 0 0 4.5px rgba(196,146,74,.20),
    0 0 14px rgba(196,146,74,.55);
  transition: box-shadow .3s;
}
.card.in::before {
  box-shadow:
    0 0 0 3px var(--bg),
    0 0 0 4.5px rgba(196,146,74,.28),
    0 0 18px rgba(196,146,74,.7);
}
```

### 6b. Card depth

```css
.card {
  position: relative;
  margin: 0 0 14px;
  background: linear-gradient(175deg, #201809 0%, #130D06 100%);
  border: 1px solid rgba(196,146,74,.16);
  border-top-color: rgba(234,197,122,.22);
  border-radius: 16px;
  padding: 16px 17px 15px;
  opacity: 0;
  transform: translateY(20px);
  transition: opacity .55s, transform .55s, box-shadow .25s;
  will-change: transform, opacity;
  box-shadow:
    inset 0 1px 0 rgba(234,197,122,.08),
    0 2px 16px rgba(0,0,0,.40),
    0 1px 2px rgba(0,0,0,.50);
}
.card.in {
  opacity: 1;
  transform: none;
  box-shadow:
    inset 0 1px 0 rgba(234,197,122,.10),
    0 4px 24px rgba(0,0,0,.45),
    0 1px 2px rgba(0,0,0,.50);
}
.card:active {
  box-shadow:
    inset 0 1px 0 rgba(234,197,122,.06),
    0 1px 8px rgba(0,0,0,.40);
  transform: scale(.993) translateY(1px);
}
```

### 6c. Year label, heading, body

```css
.card .yr {
  font-family: var(--serif);
  font-size: 13px;
  color: var(--gold);
  letter-spacing: .06em;
  margin-bottom: 4px;
  opacity: .88;
}
.card h3 {
  font-family: var(--serif);
  font-size: 17px;
  line-height: 1.3;
  margin: 3px 0 8px;
  color: var(--ink);
  font-weight: 600;
  letter-spacing: .005em;
}
.card p {
  font-size: 14px;
  line-height: 1.65;
  color: var(--ink2);
  margin: 0;
}
```

### 6d. Era Headers

```css
.eraHead {
  position: sticky;
  top: 52px;
  z-index: 30;
  backdrop-filter: blur(10px);
  background: linear-gradient(180deg,
    rgba(10,7,4,.95) 0%,
    rgba(10,7,4,.72) 70%,
    transparent 100%
  );
  padding: 14px 0 16px;
  margin-bottom: 4px;
}
.eraHead .ix {
  font-family: var(--sans);
  font-size: 10.5px;
  color: var(--ember);
  letter-spacing: .26em;
  text-transform: uppercase;
  opacity: .85;
}
.eraHead h2 {
  font-family: var(--serif);
  font-weight: 700;
  font-size: 26px;
  margin: 5px 0 2px;
  color: var(--gold-hi);
  letter-spacing: .01em;
}
.eraHead .rg {
  font-size: 11.5px;
  color: var(--faint);
  letter-spacing: .09em;
  text-transform: uppercase;
}
.eraHead .bl {
  font-size: 13px;
  color: var(--muted);
  margin-top: 8px;
  line-height: 1.58;
  max-width: 42ch;
  font-style: italic;
}
```

### 6e. Tags

```css
.tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
.tag {
  font-size: 10px;
  letter-spacing: .07em;
  text-transform: uppercase;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid var(--line);
  color: var(--muted);
  font-weight: 500;
}
.tag.faith   { color: var(--faith);   border-color: rgba(201,162,75,.35);  background: rgba(201,162,75,.07);  }
.tag.science { color: var(--science); border-color: rgba(110,179,163,.35); background: rgba(110,179,163,.07); }
.tag.law     { color: var(--law);     border-color: rgba(196,96,40,.35);   background: rgba(196,96,40,.07);   }
.tag.culture { color: var(--culture); border-color: rgba(183,136,196,.35); background: rgba(183,136,196,.07); }
```

### 6f. Flag / Dispute block

```css
.flag {
  display: block;
  margin-top: 12px;
  font-size: 11.5px;
  color: #EBCA94;
  background: linear-gradient(135deg, rgba(196,96,40,.10), rgba(196,96,40,.06));
  border: 1px solid rgba(196,96,40,.28);
  border-left: 3px solid var(--ember);
  padding: 9px 12px;
  border-radius: 0 10px 10px 0;
  line-height: 1.55;
}
.flag b { color: var(--ember-hi); }
```

### 6g. Source line

```css
.src {
  margin-top: 10px;
  font-size: 11px;
  color: var(--faint);
  font-style: italic;
  letter-spacing: .01em;
}
.src::before { content: "— "; opacity: .5; }
```

---

## 7. Banner (milestone stat callouts)

```css
.banner {
  margin: 28px 0;
  padding: 30px 22px 26px;
  border-radius: 20px;
  text-align: center;
  position: relative;
  overflow: hidden;
  background:
    radial-gradient(ellipse 100% 90% at 50% 0%, rgba(196,96,40,.18) 0%, transparent 55%),
    linear-gradient(180deg, var(--panel3) 0%, var(--bg2) 100%);
  border: 1px solid rgba(196,146,74,.20);
  border-top-color: rgba(234,197,122,.28);
  box-shadow: inset 0 1px 0 rgba(234,197,122,.08), 0 6px 28px rgba(0,0,0,.45);
}
/* Faint horizontal rule dividers inside the banner */
.banner::before {
  content: "";
  position: absolute;
  left: 14%; right: 14%; top: 0; height: 1px;
  background: linear-gradient(90deg, transparent, rgba(234,197,122,.3), transparent);
}
.banner .bn {
  font-family: var(--serif);
  font-size: clamp(44px, 16vw, 68px);
  line-height: 1;
  letter-spacing: .02em;
  background: linear-gradient(180deg, #FBF0D2, #EAC57A 50%, #9A6D2A);
  -webkit-background-clip: text; background-clip: text; color: transparent;
  filter: drop-shadow(0 2px 12px rgba(196,146,74,.3));
}
.banner .bl {
  font-family: var(--serif);
  font-style: italic;
  font-size: 14.5px;
  color: var(--ink2);
  margin-top: 10px;
  line-height: 1.55;
  max-width: 30ch;
  margin-inline: auto;
}
.banner .bs {
  font-size: 10.5px;
  color: var(--faint);
  margin-top: 10px;
  font-style: italic;
  letter-spacing: .02em;
}
```

---

## 8. By the Numbers — Stat Grid

```css
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

.stat {
  position: relative;
  overflow: hidden;
  background: linear-gradient(175deg, #201809 0%, #130D06 100%);
  border: 1px solid rgba(196,146,74,.16);
  border-top-color: rgba(234,197,122,.22);
  border-radius: 18px;
  padding: 20px 14px 16px;
  text-align: center;
  box-shadow: inset 0 1px 0 rgba(234,197,122,.08), 0 4px 20px rgba(0,0,0,.4);
}
/* Very subtle radial amber glow at top */
.stat::before {
  content: "";
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse 80% 50% at 50% -10%, rgba(196,146,74,.10), transparent 55%);
  pointer-events: none;
}
.stat .n {
  font-family: var(--serif);
  font-size: 32px;
  line-height: 1;
  letter-spacing: .01em;
  background: linear-gradient(180deg, #FBF0D2 0%, #EAC57A 50%, #9A6D2A 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
  filter: drop-shadow(0 1px 8px rgba(196,146,74,.25));
}
.stat .l {
  font-size: 11.5px;
  color: var(--ink2);
  margin-top: 9px;
  line-height: 1.5;
}
.stat .s {
  font-size: 10px;
  color: var(--faint);
  margin-top: 7px;
  font-style: italic;
}
```

---

## 9. Myth & Fact Cards

```css
.myth {
  background: linear-gradient(175deg, #1E1409 0%, #120D06 100%);
  border: 1px solid rgba(196,146,74,.16);
  border-top-color: rgba(234,197,122,.20);
  border-radius: 16px;
  padding: 16px 16px 15px;
  margin-bottom: 10px;
  cursor: pointer;
  transition: border-color .2s, box-shadow .2s;
  box-shadow: inset 0 1px 0 rgba(234,197,122,.07), 0 3px 14px rgba(0,0,0,.38);
}
.myth:active {
  box-shadow: inset 0 1px 0 rgba(234,197,122,.05), 0 1px 6px rgba(0,0,0,.40);
  transform: scale(.993);
}
.myth.open {
  border-color: rgba(196,146,74,.30);
  box-shadow: inset 0 1px 0 rgba(234,197,122,.10), 0 6px 28px rgba(0,0,0,.45);
}

.myth .m { display: flex; gap: 10px; align-items: flex-start; }
.myth .badge {
  flex: 0 0 auto;
  font-size: 9.5px;
  letter-spacing: .14em;
  text-transform: uppercase;
  color: var(--ember-hi);
  border: 1px solid rgba(196,96,40,.45);
  border-radius: 6px;
  padding: 4px 8px;
  margin-top: 2px;
  background: rgba(196,96,40,.08);
  font-weight: 600;
}
.myth h3 {
  font-family: var(--serif);
  font-size: 15px;
  line-height: 1.45;
  margin: 0;
  color: var(--ink);
  font-style: italic;
}
.myth .chev {
  margin-left: auto;
  color: var(--gold);
  transition: transform .3s cubic-bezier(.2,.9,.3,1);
  flex: 0 0 auto;
  opacity: .7;
  font-size: 13px;
}
.myth.open .chev { transform: rotate(180deg); opacity: 1; }

.myth .fact {
  max-height: 0; overflow: hidden;
  transition: max-height .42s cubic-bezier(.4,0,.2,1), margin .3s, opacity .3s;
  opacity: 0;
}
.myth.open .fact { max-height: 300px; margin-top: 13px; opacity: 1; }

.myth .fact .fl {
  display: inline-block;
  font-size: 9.5px;
  letter-spacing: .14em;
  text-transform: uppercase;
  color: var(--science);
  margin-bottom: 6px;
  opacity: .85;
}
.myth .fact p {
  font-size: 13.5px;
  line-height: 1.62;
  color: var(--ink2);
  margin: 0;
}
```

---

## 10. Section Heads

```css
.sechead { text-align: center; margin-bottom: 24px; }
.sechead .k {
  font-size: 10px;
  letter-spacing: .32em;
  text-transform: uppercase;
  color: var(--ember);
  opacity: .85;
}
.sechead h2 {
  font-family: var(--serif);
  font-size: 28px;
  margin: 9px 0 0;
  color: var(--gold-hi);
  font-weight: 700;
  letter-spacing: .01em;
}
```

---

## 11. Sources

```css
#sources li {
  font-size: 12px;
  color: var(--muted);
  line-height: 1.65;
  margin-bottom: 10px;
  list-style: none;
  padding-left: 18px;
  position: relative;
}
#sources li::before {
  content: "§";
  position: absolute;
  left: 0;
  color: var(--gold);
  opacity: .45;
  font-family: var(--serif);
}
```

---

## 12. Kicker & Sub

```css
.kicker {
  font-family: var(--sans);
  letter-spacing: .50em;
  text-transform: uppercase;
  font-size: 11px;
  color: var(--gold);
  opacity: .75;
  margin: 0 0 16px;
  animation: fade 1.2s .15s both;
}
/* Decorative rule either side of kicker text */
.kicker::before, .kicker::after {
  content: "";
  display: inline-block;
  vertical-align: middle;
  width: 22px; height: 1px;
  background: var(--gold);
  opacity: .4;
  margin: 0 10px;
}

#hero .sub {
  font-family: var(--serif);
  font-style: italic;
  font-size: clamp(16px, 4.8vw, 22px);
  color: var(--ink);
  opacity: .85;
  margin: 16px 0 6px;
  letter-spacing: .01em;
  animation: fade 1.2s .35s both;
}
```

---

## 13. Progress Bar

```css
#progress {
  position: fixed; top: 0; left: 0; height: 2px; width: 0; z-index: 60;
  background: linear-gradient(90deg, var(--ember), var(--gold-hi), #FBF0D2);
  box-shadow: 0 0 10px rgba(234,197,122,.6), 0 0 3px rgba(234,197,122,.4);
  transition: width .06s linear;
}
```

---

## 14. Footer

```css
footer {
  padding: 36px 0 calc(var(--safe-b) + 44px);
  text-align: center;
  color: var(--faint);
  font-size: 12px;
  line-height: 1.7;
  letter-spacing: .02em;
}
footer .disc {
  font-size: 10.5px;
  opacity: .7;
  max-width: 40ch;
  margin: 12px auto 0;
  line-height: 1.7;
  color: var(--faint);
}
.hr {
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--line) 30%, var(--line) 70%, transparent);
  margin: 28px 0;
}
```

---

## 15. Animations

```css
@keyframes rise  { from { opacity: 0; transform: translateY(28px); } to { opacity: 1; transform: none; } }
@keyframes fade  { from { opacity: 0; } to { opacity: 1; } }
@keyframes bob   { 0%,100% { transform: translateY(0); } 55% { transform: translateY(6px); } }
/* New: subtle pulse on the coin glow */
@keyframes coinGlow {
  0%, 100% { filter: drop-shadow(0 6px 20px rgba(196,146,74,.32)); }
  50%       { filter: drop-shadow(0 6px 30px rgba(196,146,74,.55)); }
}
.coin { animation: rise 1.1s cubic-bezier(.2,.7,.2,1) both, coinGlow 4s 1.2s ease-in-out infinite; }
```

---

## 16. Full `<style>` Block (Paste-Ready)

```html
<style>
  :root{
    --bg:#0A0704; --bg2:#110C07; --panel:#18110A; --panel2:#201809; --panel3:#251E0E;
    --gold:#C4924A; --gold-hi:#EAC57A; --gold-lo:#7B5A24;
    --ember:#C45F28; --ember-hi:#E07A40;
    --ink:#F0E4CC; --ink2:#DDD0B4; --muted:#9E8E75; --faint:#6A5C48;
    --faith:#C9A24B; --science:#6EB3A3; --law:#C45F28; --culture:#B788C4;
    --line:rgba(196,146,74,.20); --line-hi:rgba(234,197,122,.30); --rail:rgba(196,146,74,.28);
    --serif:"Iowan Old Style","Palatino Linotype",Palatino,Georgia,"Times New Roman",serif;
    --sans:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,system-ui,sans-serif;
    --safe-t:env(safe-area-inset-top,0px); --safe-b:env(safe-area-inset-bottom,0px);
  }
  *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
  html,body{margin:0;padding:0;background:var(--bg);color:var(--ink);font-family:var(--sans);
    -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;overflow-x:hidden}

  body{
    background:
      radial-gradient(ellipse 160% 70% at 50% -5%, rgba(196,146,74,.14) 0%, transparent 55%),
      radial-gradient(ellipse 90%  50% at 90% 10%, rgba(196,96,40,.08)  0%, transparent 55%),
      radial-gradient(ellipse 60%  40% at 8%  85%, rgba(100,60,15,.06)  0%, transparent 60%),
      var(--bg);
    background-attachment:fixed;
  }

  /* Vignette */
  body::after{
    content:"";position:fixed;inset:0;pointer-events:none;z-index:2;
    background:radial-gradient(ellipse 100% 100% at 50% 50%,
      transparent 40%, rgba(4,3,2,.55) 85%, rgba(2,1,0,.85) 100%);
  }

  /* Film grain */
  body::before{
    content:"";position:fixed;inset:0;pointer-events:none;z-index:3;opacity:.058;
    background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.72 .75' numOctaves='4' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>");
    background-size:200px 200px;
  }

  a{color:var(--gold-hi);text-decoration:none}

  #progress{position:fixed;top:0;left:0;height:2px;width:0;z-index:60;
    background:linear-gradient(90deg,var(--ember),var(--gold-hi),#FBF0D2);
    box-shadow:0 0 10px rgba(234,197,122,.6),0 0 3px rgba(234,197,122,.4);
    transition:width .06s linear}

  .wrap{max-width:560px;margin:0 auto;padding:0 20px}

  /* ── HERO ── */
  #hero{min-height:100svh;min-height:100dvh;display:flex;flex-direction:column;justify-content:center;
    align-items:center;text-align:center;position:relative;padding:calc(var(--safe-t)+44px) 22px 44px}
  #hero::before{
    content:"";position:absolute;inset:0;pointer-events:none;z-index:0;
    background:
      radial-gradient(ellipse 75% 55% at 50% 32%, rgba(196,146,74,.09) 0%, rgba(130,80,20,.06) 40%, transparent 70%),
      radial-gradient(ellipse 55% 40% at 50% 25%, rgba(240,200,100,.04) 0%, transparent 60%);
  }
  #hero>*{position:relative;z-index:1}

  .coin{width:104px;height:104px;margin-bottom:20px;
    animation:rise 1.1s cubic-bezier(.2,.7,.2,1) both, coinGlow 4s 1.2s ease-in-out infinite}
  @keyframes coinGlow{
    0%,100%{filter:drop-shadow(0 6px 22px rgba(196,146,74,.35))}
    50%     {filter:drop-shadow(0 8px 32px rgba(196,146,74,.60))}
  }

  .kicker{font-family:var(--sans);letter-spacing:.50em;text-transform:uppercase;font-size:11px;
    color:var(--gold);opacity:.75;margin:0 0 16px;animation:fade 1.2s .15s both;display:flex;align-items:center;justify-content:center;gap:0}
  .kicker::before,.kicker::after{content:"";display:inline-block;width:22px;height:1px;
    background:var(--gold);opacity:.4;margin:0 10px;vertical-align:middle}

  #hero h1{font-family:var(--serif);font-weight:700;
    font-size:clamp(48px,17.5vw,88px);
    line-height:.9;margin:0;letter-spacing:.04em;padding:0 4px;
    background:linear-gradient(175deg,#FBF0D2 0%,#EAC57A 30%,#C4924A 60%,#7B5A24 85%,#4A360F 100%);
    -webkit-background-clip:text;background-clip:text;color:transparent;
    filter:drop-shadow(0 1px 0 rgba(255,230,150,.18)) drop-shadow(0 4px 18px rgba(0,0,0,.7));
    animation:rise 1.1s .1s both}

  #hero .sub{font-family:var(--serif);font-style:italic;font-size:clamp(16px,4.8vw,22px);
    color:var(--ink);opacity:.85;margin:16px 0 6px;letter-spacing:.01em;animation:fade 1.2s .35s both}
  #hero .lede{max-width:30ch;font-size:14.5px;line-height:1.65;color:var(--muted);margin:8px auto 0;animation:fade 1.2s .5s both}

  .heroStats{display:flex;gap:8px;margin-top:30px;width:100%;max-width:420px;animation:fade 1.4s .7s both}
  .heroStats .hs{flex:1;
    background:linear-gradient(160deg,rgba(40,28,12,.72),rgba(20,14,6,.72));
    border:1px solid rgba(196,146,74,.22);
    border-top-color:rgba(234,197,122,.30);
    border-radius:14px;padding:14px 8px 12px;backdrop-filter:blur(4px);
    box-shadow:inset 0 1px 0 rgba(234,197,122,.12),0 4px 20px rgba(0,0,0,.35)}
  .heroStats .n{font-family:var(--serif);font-size:23px;color:var(--gold-hi);line-height:1;letter-spacing:.01em}
  .heroStats .l{font-size:10px;color:var(--muted);margin-top:6px;letter-spacing:.03em;line-height:1.4}

  .begin{margin-top:36px;display:inline-flex;align-items:center;gap:9px;
    border:1px solid rgba(196,146,74,.30);
    border-top-color:rgba(234,197,122,.45);
    background:linear-gradient(180deg,rgba(196,146,74,.10),rgba(196,146,74,.04));
    color:var(--ink);padding:14px 26px;border-radius:999px;font-size:13.5px;
    letter-spacing:.07em;text-transform:uppercase;cursor:pointer;
    box-shadow:0 2px 20px rgba(196,146,74,.08),inset 0 1px 0 rgba(255,230,130,.08);
    transition:background .2s,box-shadow .2s,transform .12s;animation:fade 1.4s .9s both}
  .begin:active{transform:scale(.97);background:linear-gradient(180deg,rgba(196,146,74,.16),rgba(196,146,74,.08))}
  .begin .arr{display:inline-block;animation:bob 1.9s ease-in-out infinite}

  /* ── ERA NAV ── */
  #eraNav{position:sticky;top:0;z-index:50;
    background:linear-gradient(180deg,rgba(10,7,4,.97),rgba(10,7,4,.82));
    backdrop-filter:blur(12px);border-bottom:1px solid var(--line);
    padding:calc(var(--safe-t)+9px) 0 9px;
    box-shadow:0 4px 24px rgba(0,0,0,.45)}
  .navScroll{display:flex;gap:8px;overflow-x:auto;padding:0 16px;scrollbar-width:none}
  .navScroll::-webkit-scrollbar{display:none}
  .navChip{flex:0 0 auto;font-size:12px;padding:8px 14px;border-radius:999px;
    border:1px solid rgba(196,146,74,.18);color:var(--muted);background:transparent;
    white-space:nowrap;cursor:pointer;letter-spacing:.04em;
    transition:color .2s,background .2s,border-color .2s,box-shadow .2s}
  .navChip.on{color:#1a1004;background:linear-gradient(180deg,#EAC57A,#C4924A);
    border-color:transparent;font-weight:700;box-shadow:0 2px 12px rgba(196,146,74,.35)}

  /* ── FILTERS ── */
  #filters{padding:18px 0 4px}
  #filters .ftitle{font-size:10.5px;letter-spacing:.30em;text-transform:uppercase;color:var(--gold);opacity:.75;margin:0 0 10px}
  .fchips{display:flex;flex-wrap:wrap;gap:8px}
  .fchip{font-size:12px;padding:8px 14px;border-radius:999px;
    border:1px solid rgba(196,146,74,.18);color:var(--ink2);
    background:rgba(24,17,10,.55);cursor:pointer;letter-spacing:.025em;
    transition:.2s;display:flex;align-items:center;gap:7px;
    box-shadow:inset 0 1px 0 rgba(255,230,130,.04)}
  .fchip.on{border-color:rgba(196,146,74,.50);background:rgba(196,146,74,.15);
    box-shadow:0 0 12px rgba(196,146,74,.12),inset 0 1px 0 rgba(255,230,130,.08)}
  .fchip .dot{width:7px;height:7px;border-radius:50%;box-shadow:0 0 5px currentColor;opacity:.85}

  /* ── TIMELINE ── */
  #timeline{padding:14px 0 10px}
  .era{margin-top:30px}
  .eraHead{position:sticky;top:52px;z-index:30;backdrop-filter:blur(10px);
    background:linear-gradient(180deg,rgba(10,7,4,.95) 0%,rgba(10,7,4,.72) 70%,transparent 100%);
    padding:14px 0 16px;margin-bottom:4px}
  .eraHead .ix{font-family:var(--sans);font-size:10.5px;color:var(--ember);letter-spacing:.26em;text-transform:uppercase;opacity:.85}
  .eraHead h2{font-family:var(--serif);font-weight:700;font-size:26px;margin:5px 0 2px;color:var(--gold-hi);letter-spacing:.01em}
  .eraHead .rg{font-size:11.5px;color:var(--faint);letter-spacing:.09em;text-transform:uppercase}
  .eraHead .bl{font-size:13px;color:var(--muted);margin-top:8px;line-height:1.58;max-width:42ch;font-style:italic}

  .track{position:relative;padding-left:30px}
  .track::before{content:"";position:absolute;left:8px;top:8px;bottom:14px;width:1.5px;
    background:linear-gradient(180deg,var(--gold) 0%,rgba(196,146,74,.35) 40%,rgba(196,146,74,.08) 80%,transparent 100%);
    border-radius:1px}

  .card{position:relative;margin:0 0 14px;
    background:linear-gradient(175deg,#201809 0%,#130D06 100%);
    border:1px solid rgba(196,146,74,.16);
    border-top-color:rgba(234,197,122,.22);
    border-radius:16px;padding:16px 17px 15px;
    opacity:0;transform:translateY(20px);
    transition:opacity .55s,transform .55s,box-shadow .25s;
    will-change:transform,opacity;
    box-shadow:inset 0 1px 0 rgba(234,197,122,.08),0 2px 16px rgba(0,0,0,.40),0 1px 2px rgba(0,0,0,.50)}
  .card.in{opacity:1;transform:none;
    box-shadow:inset 0 1px 0 rgba(234,197,122,.10),0 4px 24px rgba(0,0,0,.45),0 1px 2px rgba(0,0,0,.50)}
  .card:active{box-shadow:inset 0 1px 0 rgba(234,197,122,.06),0 1px 8px rgba(0,0,0,.40);transform:scale(.993) translateY(1px)}

  .card::before{content:"";position:absolute;left:-27px;top:22px;width:12px;height:12px;border-radius:50%;
    background:var(--bg);border:2px solid var(--gold);
    box-shadow:0 0 0 3px var(--bg),0 0 0 4.5px rgba(196,146,74,.20),0 0 14px rgba(196,146,74,.55);
    transition:box-shadow .3s}
  .card.in::before{box-shadow:0 0 0 3px var(--bg),0 0 0 4.5px rgba(196,146,74,.28),0 0 18px rgba(196,146,74,.7)}

  .card .yr{font-family:var(--serif);font-size:13px;color:var(--gold);letter-spacing:.06em;margin-bottom:4px;opacity:.88}
  .card h3{font-family:var(--serif);font-size:17px;line-height:1.3;margin:3px 0 8px;color:var(--ink);font-weight:600;letter-spacing:.005em}
  .card p{font-size:14px;line-height:1.65;color:var(--ink2);margin:0}
  .card.dim{opacity:.10!important;filter:grayscale(.7);transform:scale(.99)}

  .tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}
  .tag{font-size:10px;letter-spacing:.07em;text-transform:uppercase;padding:4px 10px;border-radius:999px;
    border:1px solid var(--line);color:var(--muted);font-weight:500}
  .tag.faith  {color:var(--faith);  border-color:rgba(201,162,75,.35); background:rgba(201,162,75,.07)}
  .tag.science{color:var(--science);border-color:rgba(110,179,163,.35);background:rgba(110,179,163,.07)}
  .tag.law    {color:var(--law);    border-color:rgba(196,96,40,.35);  background:rgba(196,96,40,.07)}
  .tag.culture{color:var(--culture);border-color:rgba(183,136,196,.35);background:rgba(183,136,196,.07)}

  .flag{display:block;margin-top:12px;font-size:11.5px;color:#EBCA94;
    background:linear-gradient(135deg,rgba(196,96,40,.10),rgba(196,96,40,.06));
    border:1px solid rgba(196,96,40,.28);border-left:3px solid var(--ember);
    padding:9px 12px;border-radius:0 10px 10px 0;line-height:1.55}
  .flag b{color:var(--ember-hi)}

  .src{margin-top:10px;font-size:11px;color:var(--faint);font-style:italic;letter-spacing:.01em}
  .src::before{content:"— ";opacity:.5}

  /* ── BANNERS ── */
  .banner{margin:28px 0;padding:30px 22px 26px;border-radius:20px;text-align:center;
    position:relative;overflow:hidden;
    background:
      radial-gradient(ellipse 100% 90% at 50% 0%,rgba(196,96,40,.18) 0%,transparent 55%),
      linear-gradient(180deg,var(--panel3) 0%,var(--bg2) 100%);
    border:1px solid rgba(196,146,74,.20);
    border-top-color:rgba(234,197,122,.28);
    box-shadow:inset 0 1px 0 rgba(234,197,122,.08),0 6px 28px rgba(0,0,0,.45)}
  .banner::before{content:"";position:absolute;left:14%;right:14%;top:0;height:1px;
    background:linear-gradient(90deg,transparent,rgba(234,197,122,.3),transparent)}
  .banner .bn{font-family:var(--serif);font-size:clamp(44px,16vw,68px);line-height:1;letter-spacing:.02em;
    background:linear-gradient(180deg,#FBF0D2,#EAC57A 50%,#9A6D2A);
    -webkit-background-clip:text;background-clip:text;color:transparent;
    filter:drop-shadow(0 2px 12px rgba(196,146,74,.3))}
  .banner .bl{font-family:var(--serif);font-style:italic;font-size:14.5px;color:var(--ink2);
    margin-top:10px;line-height:1.55;max-width:30ch;margin-inline:auto}
  .banner .bs{font-size:10.5px;color:var(--faint);margin-top:10px;font-style:italic;letter-spacing:.02em}

  /* ── BY THE NUMBERS ── */
  .section{padding:40px 0 8px}
  .sechead{text-align:center;margin-bottom:24px}
  .sechead .k{font-size:10px;letter-spacing:.32em;text-transform:uppercase;color:var(--ember);opacity:.85}
  .sechead h2{font-family:var(--serif);font-size:28px;margin:9px 0 0;color:var(--gold-hi);font-weight:700;letter-spacing:.01em}

  .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .stat{position:relative;overflow:hidden;
    background:linear-gradient(175deg,#201809 0%,#130D06 100%);
    border:1px solid rgba(196,146,74,.16);border-top-color:rgba(234,197,122,.22);
    border-radius:18px;padding:20px 14px 16px;text-align:center;
    box-shadow:inset 0 1px 0 rgba(234,197,122,.08),0 4px 20px rgba(0,0,0,.4)}
  .stat::before{content:"";position:absolute;inset:0;
    background:radial-gradient(ellipse 80% 50% at 50% -10%,rgba(196,146,74,.10),transparent 55%);
    pointer-events:none}
  .stat .n{font-family:var(--serif);font-size:32px;line-height:1;letter-spacing:.01em;
    background:linear-gradient(180deg,#FBF0D2 0%,#EAC57A 50%,#9A6D2A 100%);
    -webkit-background-clip:text;background-clip:text;color:transparent;
    filter:drop-shadow(0 1px 8px rgba(196,146,74,.25))}
  .stat .l{font-size:11.5px;color:var(--ink2);margin-top:9px;line-height:1.5}
  .stat .s{font-size:10px;color:var(--faint);margin-top:7px;font-style:italic}

  /* ── MYTHS ── */
  .myth{background:linear-gradient(175deg,#1E1409 0%,#120D06 100%);
    border:1px solid rgba(196,146,74,.16);border-top-color:rgba(234,197,122,.20);
    border-radius:16px;padding:16px 16px 15px;margin-bottom:10px;cursor:pointer;
    transition:border-color .2s,box-shadow .2s,transform .12s;
    box-shadow:inset 0 1px 0 rgba(234,197,122,.07),0 3px 14px rgba(0,0,0,.38)}
  .myth:active{box-shadow:inset 0 1px 0 rgba(234,197,122,.05),0 1px 6px rgba(0,0,0,.40);transform:scale(.993)}
  .myth.open{border-color:rgba(196,146,74,.30);
    box-shadow:inset 0 1px 0 rgba(234,197,122,.10),0 6px 28px rgba(0,0,0,.45)}
  .myth .m{display:flex;gap:10px;align-items:flex-start}
  .myth .badge{flex:0 0 auto;font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;
    color:var(--ember-hi);border:1px solid rgba(196,96,40,.45);border-radius:6px;
    padding:4px 8px;margin-top:2px;background:rgba(196,96,40,.08);font-weight:600}
  .myth h3{font-family:var(--serif);font-size:15px;line-height:1.45;margin:0;color:var(--ink);font-style:italic}
  .myth .chev{margin-left:auto;color:var(--gold);transition:transform .3s cubic-bezier(.2,.9,.3,1);flex:0 0 auto;opacity:.7;font-size:13px}
  .myth.open .chev{transform:rotate(180deg);opacity:1}
  .myth .fact{max-height:0;overflow:hidden;
    transition:max-height .42s cubic-bezier(.4,0,.2,1),margin .3s,opacity .3s;opacity:0}
  .myth.open .fact{max-height:300px;margin-top:13px;opacity:1}
  .myth .fact .fl{display:inline-block;font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;
    color:var(--science);margin-bottom:6px;opacity:.85}
  .myth .fact p{font-size:13.5px;line-height:1.62;color:var(--ink2);margin:0}

  /* ── SOURCES ── */
  #sources ul{padding:0;margin:0}
  #sources li{font-size:12px;color:var(--muted);line-height:1.65;margin-bottom:10px;
    list-style:none;padding-left:18px;position:relative}
  #sources li::before{content:"§";position:absolute;left:0;color:var(--gold);opacity:.45;font-family:var(--serif)}

  /* ── FOOTER ── */
  footer{padding:36px 0 calc(var(--safe-b)+44px);text-align:center;color:var(--faint);
    font-size:12px;line-height:1.7;letter-spacing:.02em}
  footer .disc{font-size:10.5px;opacity:.7;max-width:40ch;margin:12px auto 0;line-height:1.7;color:var(--faint)}
  .hr{height:1px;background:linear-gradient(90deg,transparent,var(--line) 30%,var(--line) 70%,transparent);margin:28px 0}

  /* ── KEYFRAMES ── */
  @keyframes rise{from{opacity:0;transform:translateY(28px)}to{opacity:1;transform:none}}
  @keyframes fade{from{opacity:0}to{opacity:1}}
  @keyframes bob {0%,100%{transform:translateY(0)}55%{transform:translateY(6px)}}
  @media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}.card{opacity:1;transform:none}}
</style>
```

---

## 17. Upgraded Coin SVG (Drop-in Replacement)

Replace the existing `<svg class="coin" ...>` in `#hero` with:

```html
<svg class="coin" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <radialGradient id="cg" cx="38%" cy="35%" r="72%">
      <stop offset="0%"   stop-color="#F2D98A"/>
      <stop offset="28%"  stop-color="#D4A84E"/>
      <stop offset="62%"  stop-color="#9A6D2A"/>
      <stop offset="100%" stop-color="#4E3610"/>
    </radialGradient>
    <radialGradient id="eg" cx="50%" cy="50%" r="50%">
      <stop offset="82%"  stop-color="transparent"/>
      <stop offset="100%" stop-color="rgba(0,0,0,.55)"/>
    </radialGradient>
    <radialGradient id="sp" cx="35%" cy="28%" r="42%">
      <stop offset="0%"   stop-color="rgba(255,248,210,.52)"/>
      <stop offset="100%" stop-color="transparent"/>
    </radialGradient>
  </defs>

  <!-- Ground shadow -->
  <ellipse cx="60" cy="109" rx="28" ry="4.5" fill="black" opacity=".30"/>

  <!-- Outer dark base (rim) -->
  <circle cx="60" cy="60" r="54" fill="#25190A"/>
  <!-- Rim: top-left highlight -->
  <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(220,178,90,.32)" stroke-width="1.2"/>
  <!-- Rim: bottom-right shadow -->
  <path d="M60,6 A54,54 0 0 1 114,60" fill="none" stroke="rgba(0,0,0,.7)" stroke-width="2"/>

  <!-- Groove 1 (chamfer between rim and face) -->
  <circle cx="60" cy="60" r="50" fill="#1A1208"/>
  <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(200,155,70,.20)" stroke-width=".8"/>

  <!-- Main coin face -->
  <circle cx="60" cy="60" r="47" fill="url(#cg)"/>

  <!-- Inner ring 1 (stamped groove) -->
  <circle cx="60" cy="60" r="43" fill="none" stroke="rgba(35,20,5,.80)" stroke-width="2.5"/>
  <circle cx="60" cy="60" r="43" fill="none" stroke="rgba(240,200,100,.18)" stroke-width=".7"/>

  <!-- Inner ring 2 (fine detail ring) -->
  <circle cx="60" cy="60" r="38.5" fill="none" stroke="rgba(35,20,5,.55)" stroke-width="1.2"/>
  <circle cx="60" cy="60" r="38.5" fill="none" stroke="rgba(240,200,100,.13)" stroke-width=".5"/>

  <!-- Recessed centre field -->
  <circle cx="60" cy="60" r="36" fill="rgba(0,0,0,.14)"/>

  <!-- Cannabis leaf glyph — engraved linework -->
  <g transform="translate(60,63)">
    <!-- Stem -->
    <line x1="0" y1="-21" x2="0" y2="13"
      stroke="rgba(28,16,4,.85)" stroke-width="1.15" stroke-linecap="round"/>
    <!-- Top centre leaf pair -->
    <path d="M0,-19 C-1.5,-15 -8,-13 -11,-7.5 C-7.5,-9.5 -4,-10 0,-7.5 C4,-10 7.5,-9.5 11,-7.5 C8,-13 1.5,-15 0,-19Z"
      fill="rgba(55,30,6,.60)" stroke="rgba(28,16,4,.80)" stroke-width=".9" stroke-linejoin="round"/>
    <!-- Mid left leaf -->
    <path d="M0,-11 C-2,-9.5 -11,-7 -13,-1.5 C-9.5,-4 -5.5,-5.5 0,-4.5 C-0.5,-6.5 -0.8,-9 0,-11Z"
      fill="rgba(55,30,6,.55)" stroke="rgba(28,16,4,.75)" stroke-width=".85" stroke-linejoin="round"/>
    <!-- Mid right leaf -->
    <path d="M0,-11 C2,-9.5 11,-7 13,-1.5 C9.5,-4 5.5,-5.5 0,-4.5 C0.5,-6.5 0.8,-9 0,-11Z"
      fill="rgba(55,30,6,.55)" stroke="rgba(28,16,4,.75)" stroke-width=".85" stroke-linejoin="round"/>
    <!-- Lower left leaf -->
    <path d="M0,-3 C-1.5,-2 -8.5,1.5 -9.5,7 C-7,4 -4,2.5 0,3.5 C-0.3,1 -0.5,-1 0,-3Z"
      fill="rgba(55,30,6,.50)" stroke="rgba(28,16,4,.70)" stroke-width=".80" stroke-linejoin="round"/>
    <!-- Lower right leaf -->
    <path d="M0,-3 C1.5,-2 8.5,1.5 9.5,7 C7,4 4,2.5 0,3.5 C0.3,1 0.5,-1 0,-3Z"
      fill="rgba(55,30,6,.50)" stroke="rgba(28,16,4,.70)" stroke-width=".80" stroke-linejoin="round"/>
    <!-- Root nub -->
    <path d="M-1.8,13 C-2,15 2,15 1.8,13 C1.5,11 0.5,9 0,7 C-0.5,9 -1.5,11 -1.8,13Z"
      fill="rgba(55,30,6,.50)" stroke="rgba(28,16,4,.70)" stroke-width=".80" stroke-linejoin="round"/>
  </g>

  <!-- Specular bloom (upper-left shine on the wax) -->
  <circle cx="60" cy="60" r="47" fill="url(#sp)" opacity=".65"/>

  <!-- Inner edge shadow (deepens the rim) -->
  <circle cx="60" cy="60" r="47" fill="url(#eg)"/>
</svg>
```

---

## Implementation Notes

1. **DO NOT edit index.html** — all CSS goes into the `<style>` tag replacement, SVG replaces the `.coin` SVG only if desired.
2. The film-grain tile is 200×200 and `background-size` matches, so the pattern is fine-grained and non-repeating at viewport scale.
3. The vignette uses `body::after` (z-index:2) so it overlays content subtly but does not intercept touch events (`pointer-events:none`).
4. `coinGlow` animation uses only `filter: drop-shadow` — GPU composited, no layout cost.
5. `.card:active` transform uses `scale(.993) translateY(1px)` — barely perceptible but adds tactile feel to touch.
6. All colours are WCAG AA-compliant for body text (dark bg, light text ≈ 8:1+).
