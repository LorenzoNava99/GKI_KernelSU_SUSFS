/* illustrations.js — offline SVG illustrations + Gallery component
   Injects its own CSS. No external deps. Safe for Android WebView.
   Globals: window.Illo (name→SVG string), window.Gallery ({render}) */

(function (W) {
  'use strict';

  /* ─── INJECT CSS ──────────────────────────────────────────────── */
  (function () {
    var s = document.createElement('style');
    s.textContent = [
      /* gallery grid lives in outer CSS; we own the card internals */
      '.gitem{',
        'position:relative;',
        'background:#1a1000;',
        'border:1px solid #7a5c1e;',
        'border-radius:6px;',
        'overflow:hidden;',
        'display:flex;',
        'flex-direction:column;',
      '}',
      /* aspect-ratio box prevents layout shift */
      '.gitem .img-wrap{',
        'position:relative;',
        'width:100%;',
        'aspect-ratio:4/3;',
        'background:#120d00;',
        'overflow:hidden;',
      '}',
      '.gitem img{',
        'position:absolute;',
        'inset:0;',
        'width:100%;',
        'height:100%;',
        'object-fit:cover;',
        'display:block;',
      '}',
      /* placeholder block */
      '.gitem .ph{',
        'position:absolute;',
        'inset:0;',
        'display:flex;',
        'flex-direction:column;',
        'align-items:center;',
        'justify-content:center;',
        'gap:8px;',
        'padding:12px;',
        'background:#120d00;',
        'color:#c8922a;',
      '}',
      '.gitem .ph svg{',
        'width:64px;',
        'height:64px;',
        'opacity:0.85;',
        'flex-shrink:0;',
      '}',
      '.gitem .ph .ph-hint{',
        'font-size:10px;',
        'color:#7a5c1e;',
        'text-align:center;',
        'line-height:1.3;',
        'max-width:140px;',
      '}',
      '.gitem figcaption{',
        'padding:8px 10px 10px;',
        'font-size:12px;',
        'line-height:1.45;',
        'color:#d4a84b;',
        'flex:1;',
      '}',
      '.gitem .credit{',
        'display:block;',
        'margin-top:4px;',
        'font-size:10px;',
        'color:#7a5c1e;',
        'word-break:break-word;',
      '}',
    ].join('');
    var head = document.head || document.documentElement;
    head.appendChild(s);
  }());

  /* ─── COLOUR PALETTE CONSTANTS ────────────────────────────────── */
  // amber/gold palette used across all SVGs
  // Primary gold:  #d4a84b
  // Deep amber:    #c8922a
  // Dark gold:     #7a5c1e
  // Near-black bg: #120d00
  // Rich brown:    #3d2800
  // Smoke/mist:    #8a7040  (semi-transparent)
  // Highlight:     #f0c85a
  // Green-leaf:    #4a7a2a (cannabis green with amber tint)
  // Leaf dark:     #2d5018

  /* ─── SVG ILLUSTRATIONS ───────────────────────────────────────── */
  var Illo = {};

  /* 1 ── LEAF — cannabis leaf, 7-fingered, detailed venation */
  Illo.leaf = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" fill="none">'
    + '<g transform="translate(100,108)">'
    /* central stem */
    + '<line x1="0" y1="80" x2="0" y2="-80" stroke="#4a7a2a" stroke-width="2.5" stroke-linecap="round"/>'
    /* central large leaflet pair */
    + '<path d="M0,-12 C-6,-28 -22,-52 -18,-72 C-12,-62 -8,-40 0,-30 C8,-40 12,-62 18,-72 C22,-52 6,-28 0,-12Z" fill="#4a7a2a"/>'
    + '<line x1="0" y1="-12" x2="0" y2="-68" stroke="#2d5018" stroke-width="1"/>'
    /* veins left */
    + '<line x1="0" y1="-30" x2="-10" y2="-45" stroke="#2d5018" stroke-width="0.8"/>'
    + '<line x1="0" y1="-45" x2="-9" y2="-58" stroke="#2d5018" stroke-width="0.8"/>'
    /* veins right */
    + '<line x1="0" y1="-30" x2="10" y2="-45" stroke="#2d5018" stroke-width="0.8"/>'
    + '<line x1="0" y1="-45" x2="9" y2="-58" stroke="#2d5018" stroke-width="0.8"/>'
    /* left upper-middle leaflets */
    + '<g transform="rotate(-38,0,0)">'
      + '<path d="M0,-10 C-5,-22 -18,-40 -14,-56 C-9,-48 -6,-30 0,-22 C6,-30 9,-48 14,-56 C18,-40 5,-22 0,-10Z" fill="#4a7a2a"/>'
      + '<line x1="0" y1="-10" x2="0" y2="-52" stroke="#2d5018" stroke-width="0.8"/>'
    + '</g>'
    /* right upper-middle leaflets */
    + '<g transform="rotate(38,0,0)">'
      + '<path d="M0,-10 C-5,-22 -18,-40 -14,-56 C-9,-48 -6,-30 0,-22 C6,-30 9,-48 14,-56 C18,-40 5,-22 0,-10Z" fill="#4a7a2a"/>'
      + '<line x1="0" y1="-10" x2="0" y2="-52" stroke="#2d5018" stroke-width="0.8"/>'
    + '</g>'
    /* left lower leaflets */
    + '<g transform="rotate(-72,0,0)">'
      + '<path d="M0,-8 C-4,-18 -14,-32 -10,-44 C-7,-38 -4,-24 0,-17 C4,-24 7,-38 10,-44 C14,-32 4,-18 0,-8Z" fill="#3d6820"/>'
      + '<line x1="0" y1="-8" x2="0" y2="-40" stroke="#2d5018" stroke-width="0.7"/>'
    + '</g>'
    + '<g transform="rotate(72,0,0)">'
      + '<path d="M0,-8 C-4,-18 -14,-32 -10,-44 C-7,-38 -4,-24 0,-17 C4,-24 7,-38 10,-44 C14,-32 4,-18 0,-8Z" fill="#3d6820"/>'
      + '<line x1="0" y1="-8" x2="0" y2="-40" stroke="#2d5018" stroke-width="0.7"/>'
    + '</g>'
    /* bottom stub leaflets */
    + '<g transform="rotate(-105,0,0)">'
      + '<path d="M0,-6 C-3,-13 -10,-22 -7,-30 C-4,-25 -2,-16 0,-11 C2,-16 4,-25 7,-30 C10,-22 3,-13 0,-6Z" fill="#2d5018"/>'
    + '</g>'
    + '<g transform="rotate(105,0,0)">'
      + '<path d="M0,-6 C-3,-13 -10,-22 -7,-30 C-4,-25 -2,-16 0,-11 C2,-16 4,-25 7,-30 C10,-22 3,-13 0,-6Z" fill="#2d5018"/>'
    + '</g>'
    /* serrated base lobes */
    + '<path d="M0,80 C-14,65 -28,50 -22,30 C-15,42 -8,55 0,55 C8,55 15,42 22,30 C28,50 14,65 0,80Z" fill="#2d5018"/>'
    /* golden resin shimmer dots */
    + '<circle cx="-5" cy="-50" r="1.5" fill="#d4a84b" opacity="0.7"/>'
    + '<circle cx="7" cy="-42" r="1" fill="#f0c85a" opacity="0.6"/>'
    + '<circle cx="-3" cy="-35" r="1.2" fill="#d4a84b" opacity="0.5"/>'
    + '</g>'
  + '</svg>';

  /* 2 ── COIN — wax seal / pressed-resin medallion */
  Illo.coin = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" fill="none">'
    /* outer ring with notched edge */
    + '<circle cx="100" cy="100" r="88" fill="#3d2800" stroke="#d4a84b" stroke-width="3"/>'
    + '<circle cx="100" cy="100" r="80" fill="none" stroke="#c8922a" stroke-width="1.5" stroke-dasharray="6 4"/>'
    + '<circle cx="100" cy="100" r="74" fill="#2a1c00" stroke="#7a5c1e" stroke-width="1"/>'
    /* wax texture */
    + '<radialGradient id="wax" cx="42%" cy="38%" r="58%" gradientUnits="userSpaceOnUse">'
      + '<stop offset="0%" stop-color="#c8922a" stop-opacity="0.35"/>'
      + '<stop offset="100%" stop-color="#120d00" stop-opacity="0"/>'
    + '</radialGradient>'
    + '<circle cx="100" cy="100" r="74" fill="url(#wax)"/>'
    /* central cannabis leaf embossed */
    + '<g transform="translate(100,108) scale(0.52)">'
      + '<line x1="0" y1="75" x2="0" y2="-75" stroke="#7a5c1e" stroke-width="3"/>'
      + '<path d="M0,-15 C-8,-32 -26,-60 -20,-82 C-13,-70 -8,-46 0,-34 C8,-46 13,-70 20,-82 C26,-60 8,-32 0,-15Z" fill="#c8922a"/>'
      + '<g transform="rotate(-40,0,0)">'
        + '<path d="M0,-12 C-6,-26 -20,-46 -15,-62 C-10,-54 -6,-34 0,-25 C6,-34 10,-54 15,-62 C20,-46 6,-26 0,-12Z" fill="#c8922a"/>'
      + '</g>'
      + '<g transform="rotate(40,0,0)">'
        + '<path d="M0,-12 C-6,-26 -20,-46 -15,-62 C-10,-54 -6,-34 0,-25 C6,-34 10,-54 15,-62 C20,-46 6,-26 0,-12Z" fill="#c8922a"/>'
      + '</g>'
      + '<g transform="rotate(-75,0,0)">'
        + '<path d="M0,-9 C-4,-20 -14,-36 -10,-48 C-7,-42 -4,-27 0,-20 C4,-27 7,-42 10,-48 C14,-36 4,-20 0,-9Z" fill="#7a5c1e"/>'
      + '</g>'
      + '<g transform="rotate(75,0,0)">'
        + '<path d="M0,-9 C-4,-20 -14,-36 -10,-48 C-7,-42 -4,-27 0,-20 C4,-27 7,-42 10,-48 C14,-36 4,-20 0,-9Z" fill="#7a5c1e"/>'
      + '</g>'
    + '</g>'
    /* text arc around edge */
    + '<path id="arc-top" d="M30,100 A70,70 0 0,1 170,100" fill="none"/>'
    + '<text font-size="9.5" fill="#d4a84b" font-family="serif" letter-spacing="2">'
      + '<textPath href="#arc-top" startOffset="16%">· CANNABIS · RESIN · SEAL ·</textPath>'
    + '</text>'
    /* year */
    + '<text x="100" y="155" text-anchor="middle" font-size="11" fill="#7a5c1e" font-family="serif">MMXXV</text>'
  + '</svg>';

  /* 3 ── PLANT — full cannabis plant in pot */
  Illo.plant = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 220" fill="none">'
    /* pot */
    + '<path d="M68,180 Q65,215 135,215 Q135,215 132,180Z" fill="#3d2800" stroke="#7a5c1e" stroke-width="1.5"/>'
    + '<rect x="62" y="172" width="76" height="12" rx="3" fill="#4a3000" stroke="#7a5c1e" stroke-width="1.5"/>'
    /* soil */
    + '<path d="M64,178 Q100,170 136,178" stroke="#2d1800" stroke-width="4" fill="none"/>'
    /* main stem */
    + '<line x1="100" y1="175" x2="100" y2="40" stroke="#4a7a2a" stroke-width="3" stroke-linecap="round"/>'
    /* lateral branches */
    + '<line x1="100" y1="140" x2="65" y2="110" stroke="#4a7a2a" stroke-width="2"/>'
    + '<line x1="100" y1="140" x2="135" y2="110" stroke="#4a7a2a" stroke-width="2"/>'
    + '<line x1="100" y1="105" x2="70" y2="82" stroke="#4a7a2a" stroke-width="1.8"/>'
    + '<line x1="100" y1="105" x2="130" y2="82" stroke="#4a7a2a" stroke-width="1.8"/>'
    + '<line x1="100" y1="75" x2="78" y2="58" stroke="#3d6820" stroke-width="1.5"/>'
    + '<line x1="100" y1="75" x2="122" y2="58" stroke="#3d6820" stroke-width="1.5"/>'
    /* leaf clusters — reusable mini leaf shape */
    + '<g transform="translate(65,100) rotate(-15) scale(0.45)">'
      + '<line x1="0" y1="30" x2="0" y2="-55" stroke="#4a7a2a" stroke-width="3"/>'
      + '<path d="M0,-10 C-7,-26 -24,-54 -18,-72 C-12,-60 -6,-38 0,-28 C6,-38 12,-60 18,-72 C24,-54 7,-26 0,-10Z" fill="#4a7a2a"/>'
      + '<g transform="rotate(-40,0,0)"><path d="M0,-8 C-5,-20 -16,-40 -12,-54 C-8,-46 -4,-28 0,-20 C4,-28 8,-46 12,-54 C16,-40 5,-20 0,-8Z" fill="#4a7a2a"/></g>'
      + '<g transform="rotate(40,0,0)"><path d="M0,-8 C-5,-20 -16,-40 -12,-54 C-8,-46 -4,-28 0,-20 C4,-28 8,-46 12,-54 C16,-40 5,-20 0,-8Z" fill="#4a7a2a"/></g>'
    + '</g>'
    + '<g transform="translate(135,100) rotate(15) scale(0.45)">'
      + '<line x1="0" y1="30" x2="0" y2="-55" stroke="#4a7a2a" stroke-width="3"/>'
      + '<path d="M0,-10 C-7,-26 -24,-54 -18,-72 C-12,-60 -6,-38 0,-28 C6,-38 12,-60 18,-72 C24,-54 7,-26 0,-10Z" fill="#4a7a2a"/>'
      + '<g transform="rotate(-40,0,0)"><path d="M0,-8 C-5,-20 -16,-40 -12,-54 C-8,-46 -4,-28 0,-20 C4,-28 8,-46 12,-54 C16,-40 5,-20 0,-8Z" fill="#4a7a2a"/></g>'
      + '<g transform="rotate(40,0,0)"><path d="M0,-8 C-5,-20 -16,-40 -12,-54 C-8,-46 -4,-28 0,-20 C4,-28 8,-46 12,-54 C16,-40 5,-20 0,-8Z" fill="#4a7a2a"/></g>'
    + '</g>'
    + '<g transform="translate(70,74) rotate(-10) scale(0.38)">'
      + '<path d="M0,-10 C-7,-26 -24,-54 -18,-72 C-12,-60 -6,-38 0,-28 C6,-38 12,-60 18,-72 C24,-54 7,-26 0,-10Z" fill="#3d6820"/>'
      + '<g transform="rotate(-40,0,0)"><path d="M0,-8 C-5,-20 -16,-40 -12,-54 C-8,-46 -4,-28 0,-20 C4,-28 8,-46 12,-54 C16,-40 5,-20 0,-8Z" fill="#3d6820"/></g>'
      + '<g transform="rotate(40,0,0)"><path d="M0,-8 C-5,-20 -16,-40 -12,-54 C-8,-46 -4,-28 0,-20 C4,-28 8,-46 12,-54 C16,-40 5,-20 0,-8Z" fill="#3d6820"/></g>'
    + '</g>'
    + '<g transform="translate(130,74) rotate(10) scale(0.38)">'
      + '<path d="M0,-10 C-7,-26 -24,-54 -18,-72 C-12,-60 -6,-38 0,-28 C6,-38 12,-60 18,-72 C24,-54 7,-26 0,-10Z" fill="#3d6820"/>'
      + '<g transform="rotate(-40,0,0)"><path d="M0,-8 C-5,-20 -16,-40 -12,-54 C-8,-46 -4,-28 0,-20 C4,-28 8,-46 12,-54 C16,-40 5,-20 0,-8Z" fill="#3d6820"/></g>'
      + '<g transform="rotate(40,0,0)"><path d="M0,-8 C-5,-20 -16,-40 -12,-54 C-8,-46 -4,-28 0,-20 C4,-28 8,-46 12,-54 C16,-40 5,-20 0,-8Z" fill="#3d6820"/></g>'
    + '</g>'
    /* terminal bud cluster */
    + '<ellipse cx="100" cy="42" rx="12" ry="18" fill="#2d5018" stroke="#4a7a2a" stroke-width="1"/>'
    + '<ellipse cx="100" cy="38" rx="8" ry="12" fill="#3d6820"/>'
    /* golden trichome glow on buds */
    + '<ellipse cx="100" cy="40" rx="12" ry="18" fill="#d4a84b" opacity="0.12"/>'
    + '<circle cx="96" cy="35" r="1.5" fill="#f0c85a" opacity="0.8"/>'
    + '<circle cx="104" cy="38" r="1" fill="#f0c85a" opacity="0.7"/>'
    + '<circle cx="100" cy="32" r="1.2" fill="#d4a84b" opacity="0.9"/>'
  + '</svg>';

  /* 4 ── BRAZIER — Scythian/Pamir ritual brazier with smoke */
  Illo.brazier = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 220" fill="none">'
    /* smoke wisps */
    + '<path d="M80,55 C75,45 85,35 80,25 C75,15 85,8 82,2" stroke="#8a7040" stroke-width="2.5" stroke-linecap="round" fill="none" opacity="0.7"/>'
    + '<path d="M100,50 C95,38 107,28 102,16 C97,6 104,0 101,-5" stroke="#8a7040" stroke-width="2" stroke-linecap="round" fill="none" opacity="0.6"/>'
    + '<path d="M120,55 C125,44 115,34 121,23 C126,13 118,6 121,0" stroke="#7a5c1e" stroke-width="2" stroke-linecap="round" fill="none" opacity="0.5"/>'
    /* glow from coals */
    + '<ellipse cx="100" cy="105" rx="38" ry="8" fill="#c8922a" opacity="0.2"/>'
    /* brazier bowl */
    + '<path d="M58,105 Q62,75 100,72 Q138,75 142,105Z" fill="#3d2800" stroke="#c8922a" stroke-width="2"/>'
    /* decorative band on bowl */
    + '<path d="M60,98 Q100,88 140,98" stroke="#d4a84b" stroke-width="1.5" fill="none"/>'
    /* Scythian animal-style ornament on bowl front */
    + '<path d="M78,92 C82,86 88,84 92,88 C88,90 84,92 78,92Z" fill="#d4a84b" opacity="0.7"/>'
    + '<path d="M108,92 C112,86 118,84 122,88 C118,90 114,92 108,92Z" fill="#d4a84b" opacity="0.7"/>'
    /* coals / embers inside */
    + '<ellipse cx="100" cy="104" rx="30" ry="10" fill="#7a2a00"/>'
    + '<ellipse cx="100" cy="104" rx="20" ry="7" fill="#c84000" opacity="0.8"/>'
    + '<circle cx="92" cy="103" r="3" fill="#ff6600" opacity="0.9"/>'
    + '<circle cx="100" cy="101" r="4" fill="#ff8800" opacity="0.9"/>'
    + '<circle cx="108" cy="104" r="3" fill="#ff6600" opacity="0.8"/>'
    /* cannabis material on coals */
    + '<path d="M86,100 L88,96 L92,100Z" fill="#4a7a2a" opacity="0.6"/>'
    + '<path d="M108,100 L110,95 L114,100Z" fill="#4a7a2a" opacity="0.5"/>'
    /* tripod legs */
    + '<line x1="100" y1="112" x2="68" y2="165" stroke="#7a5c1e" stroke-width="4" stroke-linecap="round"/>'
    + '<line x1="100" y1="112" x2="132" y2="165" stroke="#7a5c1e" stroke-width="4" stroke-linecap="round"/>'
    + '<line x1="100" y1="112" x2="100" y2="168" stroke="#7a5c1e" stroke-width="4" stroke-linecap="round"/>'
    /* leg feet / sabots */
    + '<path d="M60,165 Q68,170 76,165" stroke="#c8922a" stroke-width="2.5" fill="none" stroke-linecap="round"/>'
    + '<path d="M124,165 Q132,170 140,165" stroke="#c8922a" stroke-width="2.5" fill="none" stroke-linecap="round"/>'
    + '<path d="M92,168 Q100,173 108,168" stroke="#c8922a" stroke-width="2.5" fill="none" stroke-linecap="round"/>'
    /* ground ring */
    + '<ellipse cx="100" cy="175" rx="46" ry="5" fill="#3d2800" stroke="#7a5c1e" stroke-width="1"/>'
    /* decorative animal head at top of bowl edge */
    + '<circle cx="62" cy="107" r="4" fill="#c8922a" stroke="#d4a84b" stroke-width="1"/>'
    + '<circle cx="138" cy="107" r="4" fill="#c8922a" stroke="#d4a84b" stroke-width="1"/>'
  + '</svg>';

  /* 5 ── MANUSCRIPT — old page with script lines and illuminated border */
  Illo.manuscript = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 240" fill="none">'
    /* parchment page with torn/aged edge */
    + '<path d="M20,10 Q22,8 30,12 Q35,8 40,12 Q50,7 55,11 L170,11 Q178,10 180,18 L182,222 Q180,232 172,230 L28,230 Q18,228 18,220Z" fill="#c8a05a"/>'
    /* aged texture overlay */
    + '<path d="M20,10 Q22,8 30,12 Q35,8 40,12 Q50,7 55,11 L170,11 Q178,10 180,18 L182,222 Q180,232 172,230 L28,230 Q18,228 18,220Z" fill="#120d00" opacity="0.18"/>'
    /* inner margin rule */
    + '<rect x="30" y="22" width="140" height="196" rx="2" fill="none" stroke="#7a5c1e" stroke-width="1.5"/>'
    /* illuminated header band */
    + '<rect x="30" y="22" width="140" height="22" rx="2" fill="#3d2800" opacity="0.5"/>'
    /* ornamental arabesque in header */
    + '<path d="M45,33 Q60,26 75,33 Q90,40 105,33 Q120,26 135,33 Q150,40 160,33" stroke="#d4a84b" stroke-width="1.5" fill="none"/>'
    + '<circle cx="100" cy="33" r="4" fill="#d4a84b"/>'
    + '<circle cx="75" cy="33" r="2.5" fill="#c8922a"/>'
    + '<circle cx="125" cy="33" r="2.5" fill="#c8922a"/>'
    /* text lines — varying lengths for realism */
    + '<line x1="40" y1="58" x2="162" y2="58" stroke="#3d2800" stroke-width="1.8"/>'
    + '<line x1="40" y1="67" x2="155" y2="67" stroke="#3d2800" stroke-width="1.5"/>'
    + '<line x1="40" y1="76" x2="158" y2="76" stroke="#3d2800" stroke-width="1.5"/>'
    + '<line x1="40" y1="85" x2="148" y2="85" stroke="#3d2800" stroke-width="1.5"/>'
    + '<line x1="40" y1="94" x2="162" y2="94" stroke="#3d2800" stroke-width="1.5"/>'
    /* dropcap */
    + '<rect x="40" y="100" width="18" height="22" rx="2" fill="#c8922a" opacity="0.3"/>'
    + '<text x="49" y="116" text-anchor="middle" font-size="17" fill="#7a5c1e" font-family="serif" font-style="italic">A</text>'
    + '<line x1="62" y1="106" x2="162" y2="106" stroke="#3d2800" stroke-width="1.5"/>'
    + '<line x1="62" y1="115" x2="162" y2="115" stroke="#3d2800" stroke-width="1.5"/>'
    + '<line x1="40" y1="124" x2="157" y2="124" stroke="#3d2800" stroke-width="1.5"/>'
    + '<line x1="40" y1="133" x2="162" y2="133" stroke="#3d2800" stroke-width="1.5"/>'
    + '<line x1="40" y1="142" x2="150" y2="142" stroke="#3d2800" stroke-width="1.5"/>'
    + '<line x1="40" y1="151" x2="162" y2="151" stroke="#3d2800" stroke-width="1.5"/>'
    + '<line x1="40" y1="160" x2="155" y2="160" stroke="#3d2800" stroke-width="1.5"/>'
    /* marginal illustration — small leaf */
    + '<g transform="translate(170,125) scale(0.22)">'
      + '<path d="M0,-10 C-7,-26 -24,-54 -18,-72 C-12,-60 -6,-38 0,-28 C6,-38 12,-60 18,-72 C24,-54 7,-26 0,-10Z" fill="#4a7a2a"/>'
      + '<g transform="rotate(-40,0,0)"><path d="M0,-8 C-5,-20 -16,-40 -12,-54 C-8,-46 -4,-28 0,-20 C4,-28 8,-46 12,-54 C16,-40 5,-20 0,-8Z" fill="#4a7a2a"/></g>'
      + '<g transform="rotate(40,0,0)"><path d="M0,-8 C-5,-20 -16,-40 -12,-54 C-8,-46 -4,-28 0,-20 C4,-28 8,-46 12,-54 C16,-40 5,-20 0,-8Z" fill="#4a7a2a"/></g>'
    + '</g>'
    + '<line x1="40" y1="170" x2="160" y2="170" stroke="#3d2800" stroke-width="1.5"/>'
    + '<line x1="40" y1="179" x2="154" y2="179" stroke="#3d2800" stroke-width="1.5"/>'
    /* footer rule */
    + '<line x1="30" y1="200" x2="170" y2="200" stroke="#7a5c1e" stroke-width="1"/>'
    + '<text x="100" y="215" text-anchor="middle" font-size="8" fill="#7a5c1e" font-family="serif">·  ·  ·</text>'
    /* worm-hole aging spots */
    + '<circle cx="155" cy="80" r="1.5" fill="#7a5c1e" opacity="0.5"/>'
    + '<circle cx="42" cy="145" r="1" fill="#7a5c1e" opacity="0.4"/>'
    + '<circle cx="162" cy="158" r="1.2" fill="#7a5c1e" opacity="0.4"/>'
  + '</svg>';

  /* 6 ── HOOKAH — ornate water pipe */
  Illo.hookah = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 260" fill="none">'
    /* smoke */
    + '<path d="M72,28 C68,18 78,10 74,2" stroke="#8a7040" stroke-width="2" fill="none" opacity="0.7" stroke-linecap="round"/>'
    + '<path d="M80,25 C76,14 86,6 82,-1" stroke="#7a5c1e" stroke-width="1.5" fill="none" opacity="0.5" stroke-linecap="round"/>'
    /* hose */
    + '<path d="M80,135 Q50,138 40,152 Q30,168 45,178 Q56,185 62,195" stroke="#7a5c1e" stroke-width="4" fill="none" stroke-linecap="round"/>'
    /* hose mouthpiece */
    + '<path d="M58,192 Q62,200 68,198 Q74,196 72,190 Q68,185 62,188Z" fill="#c8922a" stroke="#d4a84b" stroke-width="1"/>'
    /* bowl on top */
    + '<path d="M62,60 Q65,40 80,35 Q88,32 80,30 Q66,30 60,45 Q55,55 62,60Z" fill="#4a3000" stroke="#c8922a" stroke-width="1.5"/>'
    + '<ellipse cx="72" cy="58" rx="10" ry="6" fill="#3d2800" stroke="#c8922a" stroke-width="1.5"/>'
    /* bowl opening with glow */
    + '<ellipse cx="72" cy="56" rx="7" ry="4" fill="#7a2a00"/>'
    + '<ellipse cx="72" cy="56" rx="4" ry="2.5" fill="#ff6600" opacity="0.8"/>'
    /* neck — slender decorated shaft */
    + '<path d="M62,60 L68,135 L76,135 L80,60Z" fill="#3d2800" stroke="#c8922a" stroke-width="1.5"/>'
    /* neck decorations */
    + '<line x1="63" y1="75" x2="79" y2="75" stroke="#d4a84b" stroke-width="1"/>'
    + '<line x1="64" y1="90" x2="78" y2="90" stroke="#d4a84b" stroke-width="1"/>'
    + '<line x1="65" y1="105" x2="77" y2="105" stroke="#d4a84b" stroke-width="1"/>'
    + '<line x1="65" y1="120" x2="77" y2="120" stroke="#d4a84b" stroke-width="1"/>'
    /* neck lozenge motif */
    + '<path d="M71,82 L74,88 L71,94 L68,88Z" fill="none" stroke="#c8922a" stroke-width="0.8"/>'
    /* connector knob */
    + '<ellipse cx="72" cy="135" rx="14" ry="6" fill="#4a3000" stroke="#d4a84b" stroke-width="1.5"/>'
    /* vase / water base */
    + '<path d="M44,220 Q40,185 50,168 Q58,155 72,152 Q86,149 92,162 Q102,178 100,220Z" fill="#2a1c00" stroke="#c8922a" stroke-width="2"/>'
    /* vase ribbing / gilded bands */
    + '<path d="M46,210 Q72,204 98,210" stroke="#d4a84b" stroke-width="1" fill="none"/>'
    + '<path d="M44,195 Q72,188 100,195" stroke="#c8922a" stroke-width="0.8" fill="none"/>'
    + '<path d="M45,178 Q72,172 99,178" stroke="#7a5c1e" stroke-width="0.8" fill="none"/>'
    /* vase floral medallion */
    + '<circle cx="72" cy="192" r="12" fill="none" stroke="#7a5c1e" stroke-width="1"/>'
    + '<circle cx="72" cy="192" r="5" fill="#c8922a" opacity="0.5"/>'
    + '<path d="M72,180 L73.5,188 L72,180Z M80,186 L73,189 L80,186Z M80,198 L73,195 L80,198Z M72,204 L70.5,196 L72,204Z M64,198 L71,195 L64,198Z M64,186 L71,189 L64,186Z" stroke="#d4a84b" stroke-width="1.5" fill="none"/>'
    /* base foot */
    + '<path d="M44,220 Q72,228 100,220 L100,225 Q72,234 44,225Z" fill="#3d2800" stroke="#7a5c1e" stroke-width="1"/>'
    /* water shimmer inside vase */
    + '<path d="M52,185 Q72,180 92,185" stroke="#7a5c1e" stroke-width="1" fill="none" opacity="0.5"/>'
  + '</svg>';

  /* 7 ── SEBSI — Moroccan long-stemmed clay pipe */
  Illo.sebsi = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 120" fill="none">'
    /* smoke wisps from bowl end */
    + '<path d="M32,22 C28,14 36,8 33,2" stroke="#8a7040" stroke-width="1.8" fill="none" opacity="0.7" stroke-linecap="round"/>'
    + '<path d="M40,20 C37,12 44,7 41,1" stroke="#7a5c1e" stroke-width="1.5" fill="none" opacity="0.5" stroke-linecap="round"/>'
    /* long reed stem */
    + '<rect x="55" y="57" width="160" height="7" rx="3.5" fill="#7a5c1e" stroke="#c8922a" stroke-width="1"/>'
    /* stem knuckle joints */
    + '<rect x="90" y="55" width="5" height="11" rx="2" fill="#4a3000" stroke="#c8922a" stroke-width="0.8"/>'
    + '<rect x="150" y="55" width="5" height="11" rx="2" fill="#4a3000" stroke="#c8922a" stroke-width="0.8"/>'
    + '<rect x="200" y="55" width="5" height="11" rx="2" fill="#4a3000" stroke="#c8922a" stroke-width="0.8"/>'
    /* mouthpiece end (right) */
    + '<path d="M215,57 Q232,58 235,60.5 Q232,63 215,64Z" fill="#c8922a" stroke="#d4a84b" stroke-width="1"/>'
    /* bowl end connection (left) */
    + '<ellipse cx="58" cy="60.5" rx="6" ry="8" fill="#4a3000" stroke="#c8922a" stroke-width="1.5"/>'
    /* clay bowl — small, conical */
    + '<path d="M20,28 Q22,20 32,18 Q44,16 48,28 Q52,40 48,52 Q40,58 32,58 Q20,58 18,48 Q16,36 20,28Z" fill="#8a5a2a" stroke="#c8922a" stroke-width="1.5"/>'
    /* bowl interior — tobacco/kif */
    + '<ellipse cx="34" cy="30" rx="9" ry="7" fill="#3d2800"/>'
    + '<ellipse cx="34" cy="30" rx="5" ry="4" fill="#2d1800"/>'
    /* bowl thumb-ring indent */
    + '<path d="M18,42 Q15,45 18,48" stroke="#c8922a" stroke-width="1.5" fill="none"/>'
    /* stem string-wrap decorations (typical Moroccan craft) */
    + '<g stroke="#d4a84b" stroke-width="1.5">'
      + '<line x1="63" y1="55" x2="63" y2="66"/>'
      + '<line x1="66" y1="55" x2="66" y2="66"/>'
      + '<line x1="69" y1="55" x2="69" y2="66"/>'
    + '</g>'
    + '<g stroke="#c8922a" stroke-width="1">'
      + '<line x1="160" y1="55" x2="160" y2="66"/>'
      + '<line x1="163" y1="55" x2="163" y2="66"/>'
    + '</g>'
    /* label */
    + '<text x="120" y="88" text-anchor="middle" font-size="9" fill="#7a5c1e" font-family="serif" font-style="italic">sebsi</text>'
  + '</svg>';

  /* 8 ── MORTAR — pestle & resin block */
  Illo.mortar = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" fill="none">'
    /* pestle */
    + '<path d="M128,48 Q136,52 132,70 Q128,88 122,92" stroke="#7a5c1e" stroke-width="7" stroke-linecap="round" fill="none"/>'
    + '<ellipse cx="132" cy="46" rx="9" ry="6" fill="#4a3000" stroke="#c8922a" stroke-width="1.5" transform="rotate(-15,132,46)"/>'
    /* pestle head */
    + '<ellipse cx="122" cy="92" rx="7" ry="5" fill="#3d2800" stroke="#c8922a" stroke-width="1.5" transform="rotate(-15,122,92)"/>'
    /* mortar bowl */
    + '<path d="M42,108 Q40,150 100,158 Q160,150 158,108Z" fill="#3d2800" stroke="#c8922a" stroke-width="2"/>'
    /* bowl rim */
    + '<ellipse cx="100" cy="108" rx="58" ry="14" fill="#4a3000" stroke="#d4a84b" stroke-width="2"/>'
    /* bowl interior shadow */
    + '<ellipse cx="100" cy="108" rx="50" ry="10" fill="#2a1c00"/>'
    /* resin block (hashish) inside */
    + '<rect x="72" y="100" width="36" height="16" rx="3" fill="#5a3800" stroke="#c8922a" stroke-width="1.5" transform="rotate(-8,90,108)"/>'
    /* resin surface texture lines */
    + '<line x1="76" y1="104" x2="100" y2="102" stroke="#7a5c1e" stroke-width="0.8" transform="rotate(-8,90,108)"/>'
    + '<line x1="76" y1="109" x2="104" y2="107" stroke="#7a5c1e" stroke-width="0.8" transform="rotate(-8,90,108)"/>'
    /* resin gold-dusted surface */
    + '<rect x="72" y="100" width="36" height="8" rx="2" fill="#c8922a" opacity="0.15" transform="rotate(-8,90,108)"/>'
    /* powder/ground material */
    + '<ellipse cx="100" cy="140" rx="35" ry="6" fill="#5a3800" opacity="0.7"/>'
    /* mortar outer decoration */
    + '<path d="M42,114 Q100,120 158,114" stroke="#d4a84b" stroke-width="1" fill="none"/>'
    /* mortar base */
    + '<path d="M55,152 Q100,162 145,152 L142,165 Q100,172 58,165Z" fill="#3d2800" stroke="#7a5c1e" stroke-width="1"/>'
    /* small leaf fragment near resin */
    + '<path d="M88,118 C87,115 84,113 86,111 C88,112 89,114 88,118Z" fill="#4a7a2a" opacity="0.7"/>'
  + '</svg>';

  /* 9 ── MICROSCOPE — science illustration */
  Illo.microscope = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 240" fill="none">'
    /* base */
    + '<path d="M50,215 L150,215 L145,225 L55,225Z" fill="#3d2800" stroke="#c8922a" stroke-width="1.5"/>'
    /* arm / pillar */
    + '<rect x="90" y="115" width="20" height="100" rx="3" fill="#4a3000" stroke="#c8922a" stroke-width="1.5"/>'
    /* coarse/fine focus knobs */
    + '<ellipse cx="85" cy="165" rx="12" ry="6" fill="#7a5c1e" stroke="#d4a84b" stroke-width="1" transform="rotate(-90,85,165)"/>'
    + '<ellipse cx="85" cy="185" rx="10" ry="5" fill="#7a5c1e" stroke="#d4a84b" stroke-width="1" transform="rotate(-90,85,185)"/>'
    + '<ellipse cx="115" cy="165" rx="12" ry="6" fill="#7a5c1e" stroke="#d4a84b" stroke-width="1" transform="rotate(90,115,165)"/>'
    + '<ellipse cx="115" cy="185" rx="10" ry="5" fill="#7a5c1e" stroke="#d4a84b" stroke-width="1" transform="rotate(90,115,185)"/>'
    /* stage */
    + '<rect x="60" y="150" width="80" height="10" rx="2" fill="#4a3000" stroke="#d4a84b" stroke-width="1.5"/>'
    /* slide on stage */
    + '<rect x="68" y="145" width="64" height="5" rx="1" fill="#c8a05a" opacity="0.8" stroke="#c8922a" stroke-width="0.8"/>'
    /* slide specimen — cannabis cell / trichome */
    + '<circle cx="100" cy="147" r="4" fill="none" stroke="#4a7a2a" stroke-width="1"/>'
    + '<circle cx="100" cy="147" r="2" fill="#4a7a2a" opacity="0.5"/>'
    /* arm curve */
    + '<path d="M100,115 Q98,90 90,75" stroke="#4a3000" stroke-width="14" stroke-linecap="round" fill="none"/>'
    + '<path d="M100,115 Q98,90 90,75" stroke="#c8922a" stroke-width="1.5" fill="none"/>'
    /* nosepiece */
    + '<circle cx="90" cy="75" r="10" fill="#3d2800" stroke="#d4a84b" stroke-width="2"/>'
    /* objective lenses */
    + '<line x1="90" y1="85" x2="90" y2="105" stroke="#7a5c1e" stroke-width="5" stroke-linecap="round"/>'
    + '<line x1="82" y1="85" x2="76" y2="102" stroke="#4a3000" stroke-width="4" stroke-linecap="round"/>'
    + '<ellipse cx="90" cy="106" rx="5" ry="3" fill="#c8922a" stroke="#d4a84b" stroke-width="1"/>'
    /* eyepiece tube */
    + '<rect x="85" y="25" width="14" height="40" rx="4" fill="#4a3000" stroke="#c8922a" stroke-width="1.5"/>'
    /* eyepiece lens */
    + '<ellipse cx="92" cy="26" rx="7" ry="4" fill="#2a1c00" stroke="#d4a84b" stroke-width="1.5"/>'
    /* lens gleam */
    + '<ellipse cx="90" cy="25" rx="3" ry="2" fill="#d4a84b" opacity="0.3"/>'
    /* cannabis specimen label */
    + '<rect x="62" y="205" width="76" height="12" rx="2" fill="#2a1c00" stroke="#7a5c1e" stroke-width="1"/>'
    + '<text x="100" y="215" text-anchor="middle" font-size="7.5" fill="#c8922a" font-family="serif" font-style="italic">Cannabis sativa</text>'
  + '</svg>';

  /* 10 ── SCROLL — unfurled parchment scroll */
  Illo.scroll = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 160" fill="none">'
    /* left roll end */
    + '<ellipse cx="28" cy="80" rx="18" ry="70" fill="#8a6a30" stroke="#c8922a" stroke-width="2"/>'
    + '<ellipse cx="28" cy="80" rx="12" ry="62" fill="#7a5a28"/>'
    + '<ellipse cx="28" cy="80" rx="6" ry="54" fill="#6a4a20"/>'
    + '<ellipse cx="28" cy="80" rx="3" ry="46" fill="#5a3818"/>'
    /* right roll end */
    + '<ellipse cx="192" cy="80" rx="18" ry="70" fill="#8a6a30" stroke="#c8922a" stroke-width="2"/>'
    + '<ellipse cx="192" cy="80" rx="12" ry="62" fill="#7a5a28"/>'
    + '<ellipse cx="192" cy="80" rx="6" ry="54" fill="#6a4a20"/>'
    + '<ellipse cx="192" cy="80" rx="3" ry="46" fill="#5a3818"/>'
    /* parchment sheet */
    + '<rect x="28" y="10" width="164" height="140" fill="#c8a05a"/>'
    /* inner shadow on folds */
    + '<rect x="28" y="10" width="12" height="140" fill="#3d2800" opacity="0.25"/>'
    + '<rect x="180" y="10" width="12" height="140" fill="#3d2800" opacity="0.25"/>'
    /* parchment aging */
    + '<rect x="28" y="10" width="164" height="140" fill="#120d00" opacity="0.12"/>'
    /* text lines on scroll */
    + '<line x1="52" y1="35" x2="168" y2="35" stroke="#3d2800" stroke-width="1.8"/>'
    + '<line x1="52" y1="46" x2="163" y2="46" stroke="#3d2800" stroke-width="1.5"/>'
    + '<line x1="52" y1="57" x2="168" y2="57" stroke="#3d2800" stroke-width="1.5"/>'
    + '<line x1="52" y1="68" x2="155" y2="68" stroke="#3d2800" stroke-width="1.5"/>'
    + '<line x1="52" y1="79" x2="168" y2="79" stroke="#3d2800" stroke-width="1.5"/>'
    + '<line x1="52" y1="90" x2="161" y2="90" stroke="#3d2800" stroke-width="1.5"/>'
    + '<line x1="52" y1="101" x2="168" y2="101" stroke="#3d2800" stroke-width="1.5"/>'
    + '<line x1="52" y1="112" x2="158" y2="112" stroke="#3d2800" stroke-width="1.5"/>'
    + '<line x1="52" y1="123" x2="165" y2="123" stroke="#3d2800" stroke-width="1.5"/>'
    /* decorative header cartouche */
    + '<rect x="75" y="16" width="70" height="14" rx="3" fill="none" stroke="#7a5c1e" stroke-width="1"/>'
    + '<text x="110" y="26.5" text-anchor="middle" font-size="8" fill="#7a5c1e" font-family="serif" letter-spacing="1">✦  ✦  ✦</text>'
    /* red wax seal at bottom */
    + '<circle cx="110" cy="136" r="9" fill="#7a0000" stroke="#c8922a" stroke-width="1.5"/>'
    + '<text x="110" y="139.5" text-anchor="middle" font-size="8" fill="#d4a84b" font-family="serif">✦</text>'
  + '</svg>';

  /* 11 ── CARAVAN / SHIP — trade route, camel caravan on dunes */
  Illo.caravan = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 160" fill="none">'
    /* sky gradient suggestion */
    + '<rect x="0" y="0" width="260" height="100" fill="#1a0d00"/>'
    /* stars */
    + '<circle cx="30" cy="15" r="1" fill="#d4a84b" opacity="0.8"/>'
    + '<circle cx="80" cy="8" r="1.2" fill="#f0c85a" opacity="0.7"/>'
    + '<circle cx="140" cy="20" r="1" fill="#d4a84b" opacity="0.6"/>'
    + '<circle cx="200" cy="12" r="0.8" fill="#c8922a" opacity="0.7"/>'
    + '<circle cx="240" cy="22" r="1" fill="#d4a84b" opacity="0.5"/>'
    /* crescent moon */
    + '<circle cx="220" cy="22" r="12" fill="#1a0d00"/>'
    + '<circle cx="215" cy="20" r="10" fill="#c8922a" opacity="0.9"/>'
    + '<circle cx="210" cy="20" r="10" fill="#1a0d00"/>'
    /* dunes */
    + '<path d="M0,100 Q40,80 80,95 Q120,110 160,88 Q200,68 260,90 L260,160 L0,160Z" fill="#3d2800"/>'
    + '<path d="M0,110 Q50,100 100,108 Q150,116 200,100 Q230,92 260,102 L260,160 L0,160Z" fill="#2a1c00"/>'
    /* camel 1 — leading */
    + '<g transform="translate(60,90)">'
      /* body */
      + '<ellipse cx="0" cy="0" rx="22" ry="12" fill="#7a5c1e"/>'
      /* hump */
      + '<ellipse cx="6" cy="-12" rx="9" ry="8" fill="#7a5c1e"/>'
      /* neck */
      + '<path d="M-12,-2 Q-18,-14 -16,-22" stroke="#7a5c1e" stroke-width="7" stroke-linecap="round" fill="none"/>'
      /* head */
      + '<ellipse cx="-17" cy="-24" rx="7" ry="5" fill="#7a5c1e"/>'
      /* ear */
      + '<path d="M-13,-27 L-11,-32 L-9,-27" fill="#c8922a" opacity="0.7"/>'
      /* eye */
      + '<circle cx="-20" cy="-25" r="1.5" fill="#120d00"/>'
      /* legs */
      + '<line x1="-14" y1="10" x2="-16" y2="28" stroke="#7a5c1e" stroke-width="4" stroke-linecap="round"/>'
      + '<line x1="-6" y1="10" x2="-5" y2="28" stroke="#7a5c1e" stroke-width="4" stroke-linecap="round"/>'
      + '<line x1="6" y1="10" x2="5" y2="28" stroke="#7a5c1e" stroke-width="4" stroke-linecap="round"/>'
      + '<line x1="14" y1="10" x2="16" y2="28" stroke="#7a5c1e" stroke-width="4" stroke-linecap="round"/>'
      /* load sacks */
      + '<rect x="-5" y="-10" width="22" height="14" rx="3" fill="#4a3000" stroke="#c8922a" stroke-width="1"/>'
    + '</g>'
    /* camel 2 — behind */
    + '<g transform="translate(130,95)" opacity="0.8">'
      + '<ellipse cx="0" cy="0" rx="20" ry="11" fill="#5a4018"/>'
      + '<ellipse cx="5" cy="-11" rx="8" ry="7" fill="#5a4018"/>'
      + '<path d="M-11,-2 Q-16,-12 -15,-20" stroke="#5a4018" stroke-width="6" stroke-linecap="round" fill="none"/>'
      + '<ellipse cx="-16" cy="-22" rx="6" ry="4.5" fill="#5a4018"/>'
      + '<line x1="-12" y1="9" x2="-14" y2="26" stroke="#5a4018" stroke-width="4" stroke-linecap="round"/>'
      + '<line x1="-4" y1="9" x2="-3" y2="26" stroke="#5a4018" stroke-width="4" stroke-linecap="round"/>'
      + '<line x1="6" y1="9" x2="5" y2="26" stroke="#5a4018" stroke-width="4" stroke-linecap="round"/>'
      + '<line x1="14" y1="9" x2="15" y2="26" stroke="#5a4018" stroke-width="4" stroke-linecap="round"/>'
      + '<rect x="-4" y="-9" width="20" height="12" rx="3" fill="#3d2800" stroke="#7a5c1e" stroke-width="1"/>'
    + '</g>'
    /* distant camel silhouette */
    + '<g transform="translate(195,98)" opacity="0.5">'
      + '<ellipse cx="0" cy="0" rx="14" ry="8" fill="#3d2800"/>'
      + '<ellipse cx="4" cy="-8" rx="5" ry="5" fill="#3d2800"/>'
      + '<path d="M-8,-1 Q-11,-8 -10,-14" stroke="#3d2800" stroke-width="5" stroke-linecap="round" fill="none"/>'
      + '<ellipse cx="-11" cy="-15" rx="4.5" ry="3.5" fill="#3d2800"/>'
      + '<line x1="-7" y1="6" x2="-9" y2="18" stroke="#3d2800" stroke-width="3" stroke-linecap="round"/>'
      + '<line x1="5" y1="6" x2="5" y2="18" stroke="#3d2800" stroke-width="3" stroke-linecap="round"/>'
    + '</g>'
    /* guide figure */
    + '<g transform="translate(40,82)">'
      + '<circle cx="0" cy="-20" r="5" fill="#7a5c1e"/>'
      + '<rect x="-3" y="-15" width="6" height="16" rx="2" fill="#4a3000"/>'
      + '<line x1="-3" y1="-14" x2="-10" y2="-4" stroke="#4a3000" stroke-width="3" stroke-linecap="round"/>'
      + '<line x1="3" y1="-14" x2="8" y2="0" stroke="#4a3000" stroke-width="3" stroke-linecap="round"/>'
      + '<line x1="-1" y1="0" x2="-3" y2="18" stroke="#4a3000" stroke-width="3" stroke-linecap="round"/>'
      + '<line x1="1" y1="0" x2="3" y2="18" stroke="#4a3000" stroke-width="3" stroke-linecap="round"/>'
      /* walking staff */
      + '<line x1="8" y1="0" x2="10" y2="20" stroke="#7a5c1e" stroke-width="2" stroke-linecap="round"/>'
    + '</g>'
  + '</svg>';

  /* 12 ── SCALE-OF-JUSTICE — law / balance */
  Illo['scale-of-justice'] = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 220" fill="none">'
    /* central pillar */
    + '<rect x="97" y="50" width="6" height="150" rx="3" fill="#7a5c1e" stroke="#c8922a" stroke-width="1"/>'
    /* base */
    + '<path d="M60,200 L140,200 L135,215 L65,215Z" fill="#3d2800" stroke="#c8922a" stroke-width="1.5"/>'
    + '<rect x="55" y="195" width="90" height="8" rx="3" fill="#4a3000" stroke="#d4a84b" stroke-width="1.5"/>'
    /* crossbar */
    + '<rect x="30" y="48" width="140" height="5" rx="2.5" fill="#c8922a" stroke="#d4a84b" stroke-width="1"/>'
    /* centre pivot ornament */
    + '<circle cx="100" cy="50" r="7" fill="#d4a84b" stroke="#f0c85a" stroke-width="1.5"/>'
    + '<circle cx="100" cy="50" r="3.5" fill="#c8922a"/>'
    /* left chain */
    + '<path d="M35,53 L30,85 Q30,90 35,90" stroke="#c8922a" stroke-width="1.5" fill="none"/>'
    + '<g stroke="#c8922a" stroke-width="1" fill="none">'
      + '<ellipse cx="32" cy="62" rx="2" ry="3" transform="rotate(-15,32,62)"/>'
      + '<ellipse cx="31" cy="70" rx="2" ry="3" transform="rotate(15,31,70)"/>'
      + '<ellipse cx="31" cy="78" rx="2" ry="3" transform="rotate(-10,31,78)"/>'
    + '</g>'
    /* right chain (slightly lower — tilted balance) */
    + '<path d="M165,53 L170,90 Q170,96 165,96" stroke="#c8922a" stroke-width="1.5" fill="none"/>'
    + '<g stroke="#c8922a" stroke-width="1" fill="none">'
      + '<ellipse cx="168" cy="65" rx="2" ry="3" transform="rotate(15,168,65)"/>'
      + '<ellipse cx="169" cy="73" rx="2" ry="3" transform="rotate(-15,169,73)"/>'
      + '<ellipse cx="169" cy="81" rx="2" ry="3" transform="rotate(10,169,81)"/>'
    + '</g>'
    /* left pan */
    + '<path d="M10,90 Q35,100 60,90" stroke="#d4a84b" stroke-width="2" fill="none" stroke-linecap="round"/>'
    + '<path d="M10,90 Q35,105 60,90" fill="#3d2800" stroke="#c8922a" stroke-width="1.5"/>'
    /* left pan contents — cannabis leaf */
    + '<g transform="translate(35,95) scale(0.25)">'
      + '<path d="M0,-10 C-7,-26 -24,-54 -18,-72 C-12,-60 -6,-38 0,-28 C6,-38 12,-60 18,-72 C24,-54 7,-26 0,-10Z" fill="#4a7a2a"/>'
    + '</g>'
    /* right pan */
    + '<path d="M140,96 Q165,106 190,96" stroke="#d4a84b" stroke-width="2" fill="none" stroke-linecap="round"/>'
    + '<path d="M140,96 Q165,112 190,96" fill="#3d2800" stroke="#c8922a" stroke-width="1.5"/>'
    /* right pan contents — resin block */
    + '<rect x="158" y="101" width="14" height="8" rx="2" fill="#5a3800" stroke="#c8922a" stroke-width="1"/>'
    /* top finial */
    + '<circle cx="100" cy="30" r="6" fill="#d4a84b" stroke="#f0c85a" stroke-width="1"/>'
    + '<path d="M100,24 L100,14" stroke="#d4a84b" stroke-width="2"/>'
    + '<path d="M96,16 L100,10 L104,16" fill="#d4a84b"/>'
  + '</svg>';

  /* 13 ── MOSQUE-ARCH — Islamic pointed arch with geometric tile work */
  Illo['mosque-arch'] = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 240" fill="none">'
    /* outer arch outline */
    + '<path d="M20,230 L20,120 Q20,20 100,20 Q180,20 180,120 L180,230Z" fill="#2a1c00" stroke="#c8922a" stroke-width="3"/>'
    /* inner arch */
    + '<path d="M34,230 L34,125 Q34,40 100,40 Q166,40 166,125 L166,230Z" fill="#1a1000" stroke="#7a5c1e" stroke-width="1.5"/>'
    /* geometric tile band at top of arch - Islamic star pattern */
    + '<path d="M34,125 Q34,40 100,40 Q166,40 166,125 L150,125 Q150,56 100,56 Q50,56 50,125Z" fill="#3d2800"/>'
    /* star pattern in arch head */
    + '<g transform="translate(100,82)" fill="none" stroke="#d4a84b" stroke-width="1">'
      /* 8-pointed star */
      + '<polygon points="0,-24 5.5,-5.5 24,0 5.5,5.5 0,24 -5.5,5.5 -24,0 -5.5,-5.5" fill="#3d2800" stroke="#d4a84b" stroke-width="1.5"/>'
      + '<polygon points="0,-17 4,-4 17,0 4,4 0,17 -4,4 -17,0 -4,-4" fill="#c8922a" opacity="0.4"/>'
      + '<circle cx="0" cy="0" r="5" fill="#d4a84b" opacity="0.7"/>'
      /* surrounding small stars */
      + '<g transform="translate(0,-36)">'
        + '<polygon points="0,-8 2,-2 8,0 2,2 0,8 -2,2 -8,0 -2,-2" fill="#c8922a" opacity="0.6"/>'
      + '</g>'
      + '<g transform="translate(36,0)">'
        + '<polygon points="0,-8 2,-2 8,0 2,2 0,8 -2,2 -8,0 -2,-2" fill="#c8922a" opacity="0.6"/>'
      + '</g>'
      + '<g transform="translate(-36,0)">'
        + '<polygon points="0,-8 2,-2 8,0 2,2 0,8 -2,2 -8,0 -2,-2" fill="#c8922a" opacity="0.6"/>'
      + '</g>'
    + '</g>'
    /* muqarnas / stalactite frieze below arch head */
    + '<path d="M50,125 Q55,118 60,125 Q65,118 70,125 Q75,118 80,125 Q85,118 90,125 Q95,118 100,125 Q105,118 110,125 Q115,118 120,125 Q125,118 130,125 Q135,118 140,125 Q145,118 150,125" stroke="#c8922a" stroke-width="1.5" fill="none"/>'
    /* column shafts */
    + '<rect x="34" y="125" width="16" height="105" fill="#3d2800" stroke="#7a5c1e" stroke-width="1"/>'
    + '<rect x="150" y="125" width="16" height="105" fill="#3d2800" stroke="#7a5c1e" stroke-width="1"/>'
    /* column capitals */
    + '<rect x="30" y="122" width="24" height="8" rx="2" fill="#c8922a" stroke="#d4a84b" stroke-width="1"/>'
    + '<rect x="146" y="122" width="24" height="8" rx="2" fill="#c8922a" stroke="#d4a84b" stroke-width="1"/>'
    /* column bases */
    + '<rect x="30" y="225" width="24" height="8" rx="2" fill="#c8922a" stroke="#d4a84b" stroke-width="1"/>'
    + '<rect x="146" y="225" width="24" height="8" rx="2" fill="#c8922a" stroke="#d4a84b" stroke-width="1"/>'
    /* tile dado on interior walls */
    + '<rect x="50" y="160" width="100" height="40" fill="none" stroke="#7a5c1e" stroke-width="1"/>'
    + '<line x1="50" y1="178" x2="150" y2="178" stroke="#7a5c1e" stroke-width="0.8"/>'
    + '<line x1="75" y1="160" x2="75" y2="200" stroke="#7a5c1e" stroke-width="0.8"/>'
    + '<line x1="100" y1="160" x2="100" y2="200" stroke="#7a5c1e" stroke-width="0.8"/>'
    + '<line x1="125" y1="160" x2="125" y2="200" stroke="#7a5c1e" stroke-width="0.8"/>'
  + '</svg>';

  /* 14 ── TEMPLE-OM — Indian temple with Om symbol */
  Illo['temple-om'] = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 240" fill="none">'
    /* sky */
    + '<rect x="0" y="0" width="200" height="240" fill="#120d00"/>'
    /* temple shikhara (spire) - stepped pyramid tower */
    + '<path d="M100,15 L112,35 L120,55 L126,75 L130,95 L70,95 L74,75 L80,55 L88,35Z" fill="#3d2800" stroke="#c8922a" stroke-width="1.5"/>'
    /* spire bands */
    + '<line x1="88" y1="35" x2="112" y2="35" stroke="#c8922a" stroke-width="1" opacity="0.6"/>'
    + '<line x1="84" y1="55" x2="116" y2="55" stroke="#c8922a" stroke-width="1" opacity="0.6"/>'
    + '<line x1="80" y1="75" x2="120" y2="75" stroke="#c8922a" stroke-width="1" opacity="0.6"/>'
    /* kalasha finial at top */
    + '<ellipse cx="100" cy="18" rx="6" ry="8" fill="#d4a84b" stroke="#f0c85a" stroke-width="1"/>'
    + '<circle cx="100" cy="10" r="3" fill="#f0c85a"/>'
    /* temple body */
    + '<rect x="55" y="95" width="90" height="80" fill="#3d2800" stroke="#c8922a" stroke-width="2"/>'
    /* Om symbol on temple front */
    + '<text x="100" y="148" text-anchor="middle" font-size="40" fill="#d4a84b" font-family="serif" opacity="0.85">ॐ</text>'
    /* doorway arch */
    + '<path d="M80,175 L80,145 Q80,130 100,130 Q120,130 120,145 L120,175Z" fill="#1a1000" stroke="#c8922a" stroke-width="1.5"/>'
    /* door flame torches */
    + '<line x1="78" y1="160" x2="78" y2="178" stroke="#7a5c1e" stroke-width="3" stroke-linecap="round"/>'
    + '<line x1="122" y1="160" x2="122" y2="178" stroke="#7a5c1e" stroke-width="3" stroke-linecap="round"/>'
    + '<ellipse cx="78" cy="158" rx="4" ry="5" fill="#c84000" opacity="0.8"/>'
    + '<ellipse cx="122" cy="158" rx="4" ry="5" fill="#c84000" opacity="0.8"/>'
    + '<ellipse cx="78" cy="156" rx="2.5" ry="3" fill="#ff8800"/>'
    + '<ellipse cx="122" cy="156" rx="2.5" ry="3" fill="#ff8800"/>'
    /* platform steps */
    + '<rect x="45" y="175" width="110" height="10" rx="1" fill="#4a3000" stroke="#7a5c1e" stroke-width="1"/>'
    + '<rect x="38" y="185" width="124" height="10" rx="1" fill="#3d2800" stroke="#7a5c1e" stroke-width="1"/>'
    + '<rect x="30" y="195" width="140" height="12" rx="1" fill="#2a1c00" stroke="#7a5c1e" stroke-width="1"/>'
    /* side columns */
    + '<rect x="55" y="95" width="12" height="80" fill="#4a3000" stroke="#c8922a" stroke-width="1"/>'
    + '<rect x="133" y="95" width="12" height="80" fill="#4a3000" stroke="#c8922a" stroke-width="1"/>'
    /* carved decorative band */
    + '<path d="M55,110 Q100,105 145,110" stroke="#d4a84b" stroke-width="1.5" fill="none"/>'
  + '</svg>';

  /* 15 ── AMPHORA — Greek/Hellenistic storage vessel */
  Illo.amphora = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 240" fill="none">'
    /* vessel body */
    + '<path d="M70,50 Q40,80 38,130 Q36,180 70,205 Q100,218 130,205 Q164,180 162,130 Q160,80 130,50Z" fill="#4a3000" stroke="#c8922a" stroke-width="2"/>'
    /* slip/glaze highlight */
    + '<path d="M80,60 Q58,90 57,135 Q57,160 70,185" stroke="#7a5c1e" stroke-width="8" stroke-linecap="round" fill="none" opacity="0.2"/>'
    /* painted band — geometric meander (Greek key) */
    + '<path d="M52,100 L148,100" stroke="#d4a84b" stroke-width="1" fill="none"/>'
    + '<path d="M50,160 L150,160" stroke="#d4a84b" stroke-width="1" fill="none"/>'
    /* Greek meander pattern between bands */
    + '<g stroke="#d4a84b" stroke-width="1.2" fill="none" transform="translate(52,100)">'
      + '<polyline points="0,0 0,8 8,8 8,16 16,16 16,8 24,8 24,0 32,0 32,8 40,8 40,16 48,16 48,8 56,8 56,0 64,0 64,8 72,8 72,16 80,16 80,8 88,8 88,0 96,0"/>'
    + '</g>'
    /* painted figure on amphora — cannabis plant silhouette */
    + '<g transform="translate(100,138) scale(0.3)">'
      + '<line x1="0" y1="40" x2="0" y2="-60" stroke="#c8922a" stroke-width="4"/>'
      + '<path d="M0,-15 C-9,-35 -30,-68 -22,-88 C-14,-76 -8,-50 0,-38 C8,-50 14,-76 22,-88 C30,-68 9,-35 0,-15Z" fill="#c8922a"/>'
      + '<g transform="rotate(-42,0,0)"><path d="M0,-12 C-7,-28 -22,-50 -16,-66 C-10,-58 -5,-36 0,-26 C5,-36 10,-58 16,-66 C22,-50 7,-28 0,-12Z" fill="#c8922a"/></g>'
      + '<g transform="rotate(42,0,0)"><path d="M0,-12 C-7,-28 -22,-50 -16,-66 C-10,-58 -5,-36 0,-26 C5,-36 10,-58 16,-66 C22,-50 7,-28 0,-12Z" fill="#c8922a"/></g>'
    + '</g>'
    /* neck */
    + '<path d="M78,50 Q72,28 80,18 L120,18 Q128,28 122,50Z" fill="#3d2800" stroke="#c8922a" stroke-width="2"/>'
    /* lip / rim */
    + '<ellipse cx="100" cy="18" rx="22" ry="7" fill="#4a3000" stroke="#d4a84b" stroke-width="2"/>'
    /* mouth opening */
    + '<ellipse cx="100" cy="17" rx="16" ry="4" fill="#1a1000"/>'
    /* handles */
    + '<path d="M78,50 Q52,55 55,82 Q58,98 70,98" stroke="#7a5c1e" stroke-width="8" stroke-linecap="round" fill="none"/>'
    + '<path d="M122,50 Q148,55 145,82 Q142,98 130,98" stroke="#7a5c1e" stroke-width="8" stroke-linecap="round" fill="none"/>'
    /* base foot ring */
    + '<ellipse cx="100" cy="208" rx="30" ry="8" fill="#3d2800" stroke="#c8922a" stroke-width="1.5"/>'
    + '<ellipse cx="100" cy="210" rx="18" ry="5" fill="#2a1c00" stroke="#7a5c1e" stroke-width="1"/>'
  + '</svg>';

  /* 16 ── SMOKE — decorative wisp / arabesque smoke curl */
  Illo.smoke = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 240" fill="none">'
    /* background glow */
    + '<radialGradient id="sglow" cx="50%" cy="70%" r="50%" gradientUnits="userSpaceOnUse">'
      + '<stop offset="0%" stop-color="#c8922a" stop-opacity="0.12"/>'
      + '<stop offset="100%" stop-color="#120d00" stop-opacity="0"/>'
    + '</radialGradient>'
    + '<rect x="0" y="0" width="200" height="240" fill="url(#sglow)"/>'
    /* main smoke column — sinuous path */
    + '<path d="M100,220 C95,200 115,180 105,158 C95,136 75,126 90,104 C105,82 125,78 115,56 C105,34 80,24 92,8" stroke="#8a7040" stroke-width="14" stroke-linecap="round" fill="none" opacity="0.5"/>'
    + '<path d="M100,220 C95,200 115,180 105,158 C95,136 75,126 90,104 C105,82 125,78 115,56 C105,34 80,24 92,8" stroke="#c8922a" stroke-width="6" stroke-linecap="round" fill="none" opacity="0.3"/>'
    + '<path d="M100,220 C95,200 115,180 105,158 C95,136 75,126 90,104 C105,82 125,78 115,56 C105,34 80,24 92,8" stroke="#f0c85a" stroke-width="2" stroke-linecap="round" fill="none" opacity="0.25"/>'
    /* side wisps */
    + '<path d="M105,200 C115,185 128,178 120,162 C112,146 98,142 108,128" stroke="#8a7040" stroke-width="7" stroke-linecap="round" fill="none" opacity="0.35"/>'
    + '<path d="M95,180 C82,168 70,162 78,146 C86,130 100,126 90,110" stroke="#7a5c1e" stroke-width="6" stroke-linecap="round" fill="none" opacity="0.3"/>'
    + '<path d="M108,155 C120,142 130,132 122,118" stroke="#8a7040" stroke-width="5" stroke-linecap="round" fill="none" opacity="0.25"/>'
    /* micro tendrils */
    + '<path d="M90,105 C82,96 75,90 82,80" stroke="#c8922a" stroke-width="3" stroke-linecap="round" fill="none" opacity="0.35"/>'
    + '<path d="M115,72 C124,62 128,52 120,42" stroke="#c8922a" stroke-width="3" stroke-linecap="round" fill="none" opacity="0.3"/>'
    /* circular puff rings — top area */
    + '<ellipse cx="92" cy="18" rx="18" ry="9" fill="none" stroke="#7a5c1e" stroke-width="1.5" opacity="0.5"/>'
    + '<ellipse cx="92" cy="18" rx="30" ry="14" fill="none" stroke="#7a5c1e" stroke-width="1" opacity="0.25"/>'
    + '<ellipse cx="92" cy="18" rx="42" ry="19" fill="none" stroke="#7a5c1e" stroke-width="0.8" opacity="0.15"/>'
    /* ember source at base */
    + '<circle cx="100" cy="228" r="8" fill="#7a2a00"/>'
    + '<circle cx="100" cy="227" r="5" fill="#c84000" opacity="0.9"/>'
    + '<circle cx="100" cy="225" r="3" fill="#ff6600"/>'
    /* decorative dots suggesting particles */
    + '<circle cx="78" cy="135" r="2" fill="#d4a84b" opacity="0.5"/>'
    + '<circle cx="118" cy="95" r="1.5" fill="#f0c85a" opacity="0.45"/>'
    + '<circle cx="85" cy="62" r="1.8" fill="#d4a84b" opacity="0.4"/>'
    + '<circle cx="108" cy="42" r="1.2" fill="#c8922a" opacity="0.5"/>'
  + '</svg>';

  /* ── expose globally ─────────────────────────────────────────── */
  W.Illo = Illo;

  /* ─── TAG → ILLO MAPPING ──────────────────────────────────────── */
  // tags seen in content.json:
  //   painting, photo, artifact, map, orientalist-painting,
  //   botanical-illustration, manuscript (+ empty string)
  var TAG_ILLO = {
    'painting'              : 'manuscript',      // old-master canvas feel
    'orientalist-painting'  : 'hookah',          // typical orientalist subject
    'photo'                 : 'smoke',           // archival/documentary
    'artifact'              : 'mortar',          // physical object
    'map'                   : 'caravan',         // trade-route geography
    'manuscript'            : 'scroll',          // written document
    'botanical-illustration': 'leaf',            // plant science
    'botanical'             : 'leaf',
    'science'               : 'microscope',
    'law'                   : 'scale-of-justice',
    'religion'              : 'temple-om',
    'islam'                 : 'mosque-arch',
    'trade'                 : 'caravan',
    'ritual'                : 'brazier',
    'pipe'                  : 'sebsi',
    'coin'                  : 'coin',
    'plant'                 : 'plant',
    ''                      : 'smoke',           // unknown → decorative default
  };

  function illoForTag(tag) {
    var key = (tag || '').toLowerCase().trim();
    var name = TAG_ILLO[key] || 'smoke';
    return W.Illo[name] || W.Illo.smoke || '';
  }

  /* ─── GALLERY ──────────────────────────────────────────────────── */
  W.Gallery = (function () {

    /* Build a single <figure> element for one gallery item */
    function buildFigure(item) {
      var url     = (item && item.url)     || '';
      var caption = (item && item.caption) || '';
      var credit  = (item && item.credit)  || '';
      var license = (item && item.license) || '';
      var tag     = (item && item.tag)     || '';

      /* outer figure */
      var fig = document.createElement('figure');
      fig.className = 'gitem';

      /* aspect-ratio wrapper — prevents layout shift before load */
      var wrap = document.createElement('div');
      wrap.className = 'img-wrap';

      if (url) {
        var img = document.createElement('img');
        img.loading = 'lazy';
        img.decoding = 'async';
        img.referrerPolicy = 'no-referrer';
        img.alt = caption || '';

        /* graceful fallback on error */
        img.addEventListener('error', function () {
          try {
            /* remove broken img */
            if (img.parentNode) img.parentNode.removeChild(img);
            insertPlaceholder(wrap, tag, caption);
          } catch (e) { /* swallow */ }
        });

        /* also decode async and catch decoding errors */
        img.src = url;
        if (img.decode) {
          img.decode().catch(function () {
            try {
              if (img.parentNode) img.parentNode.removeChild(img);
              insertPlaceholder(wrap, tag, caption);
            } catch (e) { /* swallow */ }
          });
        }

        wrap.appendChild(img);
      } else {
        /* no URL at all — show placeholder immediately */
        insertPlaceholder(wrap, tag, caption);
      }

      fig.appendChild(wrap);

      /* figcaption */
      var fc = document.createElement('figcaption');
      fc.textContent = caption;

      if (credit || license) {
        var span = document.createElement('span');
        span.className = 'credit';
        var creditText = [credit, license].filter(Boolean).join(' · ');
        span.textContent = creditText;
        fc.appendChild(span);
      }

      fig.appendChild(fc);
      return fig;
    }

    /* Insert SVG placeholder block into a wrapper div */
    function insertPlaceholder(wrap, tag, caption) {
      try {
        /* avoid double placeholder */
        if (wrap.querySelector('.ph')) return;

        var ph = document.createElement('div');
        ph.className = 'ph';
        ph.setAttribute('aria-label', 'Image unavailable — ' + (caption || 'illustration'));

        /* svg markup string → DOM node */
        var svgStr = illoForTag(tag);
        if (svgStr) {
          var tmp = document.createElement('div');
          tmp.innerHTML = svgStr;
          var svgEl = tmp.firstElementChild;
          if (svgEl) ph.appendChild(svgEl);
        }

        /* hint text */
        var hint = document.createElement('span');
        hint.className = 'ph-hint';
        hint.textContent = 'image unavailable offline';
        ph.appendChild(hint);

        wrap.appendChild(ph);
      } catch (e) { /* never throw */ }
    }

    /* Public render function */
    function render(container, items) {
      try {
        if (!container) return;
        if (!Array.isArray(items)) return;

        /* Clear container safely */
        while (container.firstChild) {
          container.removeChild(container.firstChild);
        }

        for (var i = 0; i < items.length; i++) {
          try {
            var fig = buildFigure(items[i]);
            container.appendChild(fig);
          } catch (itemErr) { /* skip broken item, never throw */ }
        }
      } catch (e) { /* never throw */ }
    }

    return { render: render };
  }());

}(window));
