/* MOTO.UI — STUB (DOM overlay). Upgraded by UI agent. */
(function () {
  "use strict";
  var MOTO = (window.MOTO = window.MOTO || {});
  var root, cb = {}, screens = {}, els = {};
  var settings = { renderScale: "balanced", controlMode: "tilt", muted: false, shadows: true };

  function h(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function btn(txt, onclick, cls) { var b = h("button", "btn " + (cls || ""), txt); b.addEventListener("click", function () { try { MOTO.Audio.click(); } catch (e) {} onclick(); }); return b; }

  function init(callbacks) {
    cb = callbacks || {};
    root = document.getElementById("overlay");
    root.innerHTML = "";

    // loading
    screens.loading = h("div", "screen"); screens.loading.appendChild(h("div", "title", "SPEED MOTO")); root.appendChild(screens.loading);

    // menu
    screens.menu = h("div", "screen center");
    screens.menu.appendChild(h("div", "title", "SPEED MOTO"));
    screens.menu.appendChild(h("div", "subtitle", "Tilt to steer • dodge the traffic"));
    var play = btn("PLAY", function () { cb.onStart && cb.onStart(); }, "primary");
    screens.menu.appendChild(play);
    screens.menu.appendChild(btn("GARAGE", function () { cb.onOpenGarage && cb.onOpenGarage(); }));
    screens.menu.appendChild(btn("CALIBRATE TILT", function () { cb.onCalibrate && cb.onCalibrate(); }));
    els.settingsBox = buildSettings(); screens.menu.appendChild(els.settingsBox);
    root.appendChild(screens.menu);

    // garage
    screens.garage = h("div", "screen center");
    screens.garage.appendChild(h("div", "title small", "GARAGE"));
    els.coinLabel = h("div", "coins", "0 coins"); screens.garage.appendChild(els.coinLabel);
    els.bikeList = h("div", "bikelist"); screens.garage.appendChild(els.bikeList);
    screens.garage.appendChild(btn("BACK", function () { cb.onBackToMenu && cb.onBackToMenu(); }));
    root.appendChild(screens.garage);

    // hud
    screens.hud = h("div", "screen hud");
    els.hudSpeed = h("div", "hud-speed", "0"); els.hudSpeedU = h("span", "unit", " km/h"); els.hudSpeed.appendChild(els.hudSpeedU);
    els.hudDist = h("div", "hud-dist", "0 m");
    els.hudCoins = h("div", "hud-coins", "0");
    var pause = btn("II", function () { cb.onPause && cb.onPause(); }, "pausebtn");
    var topbar = h("div", "hud-top"); topbar.appendChild(els.hudDist); topbar.appendChild(els.hudCoins); topbar.appendChild(pause);
    screens.hud.appendChild(topbar); screens.hud.appendChild(els.hudSpeed);
    root.appendChild(screens.hud);

    // paused
    screens.paused = h("div", "screen center dim");
    screens.paused.appendChild(h("div", "title small", "PAUSED"));
    screens.paused.appendChild(btn("RESUME", function () { cb.onResume && cb.onResume(); }, "primary"));
    screens.paused.appendChild(btn("RESTART", function () { cb.onRestart && cb.onRestart(); }));
    screens.paused.appendChild(btn("MENU", function () { cb.onBackToMenu && cb.onBackToMenu(); }));
    root.appendChild(screens.paused);

    // gameover
    screens.gameover = h("div", "screen center dim");
    screens.gameover.appendChild(h("div", "title small", "CRASHED"));
    els.goStats = h("div", "gostats"); screens.gameover.appendChild(els.goStats);
    screens.gameover.appendChild(btn("RETRY", function () { cb.onRestart && cb.onRestart(); }, "primary"));
    screens.gameover.appendChild(btn("GARAGE", function () { cb.onOpenGarage && cb.onOpenGarage(); }));
    screens.gameover.appendChild(btn("MENU", function () { cb.onBackToMenu && cb.onBackToMenu(); }));
    root.appendChild(screens.gameover);

    els.toast = h("div", "toast"); root.appendChild(els.toast);
    show("menu");
  }

  function buildSettings() {
    var box = h("div", "settings");
    function sel(label, key, opts) {
      var row = h("div", "srow"); row.appendChild(h("span", "slabel", label));
      var s = document.createElement("select");
      opts.forEach(function (o) { var op = document.createElement("option"); op.value = o[0]; op.textContent = o[1]; s.appendChild(op); });
      s.value = settings[key];
      s.addEventListener("change", function () { settings[key] = s.value; cb.onSettingsChange && cb.onSettingsChange(settings); });
      row.appendChild(s); box.appendChild(row); return s;
    }
    sel("Quality", "renderScale", [["perf", "Performance"], ["balanced", "Native"], ["ultra", "4K Ultra"]]);
    sel("Control", "controlMode", [["tilt", "Tilt"], ["touch", "Touch"]]);
    var row = h("div", "srow"); row.appendChild(h("span", "slabel", "Mute"));
    var chk = document.createElement("input"); chk.type = "checkbox"; chk.checked = settings.muted;
    chk.addEventListener("change", function () { settings.muted = chk.checked; cb.onSettingsChange && cb.onSettingsChange(settings); });
    row.appendChild(chk); box.appendChild(row);
    return box;
  }

  function show(name) {
    for (var k in screens) if (screens[k]) screens[k].style.display = (k === name) ? "flex" : "none";
  }

  function setHUD(d) {
    if (!els.hudSpeed) return;
    els.hudSpeed.firstChild.nodeValue = String(d.speedKmh);
    els.hudDist.textContent = d.distance + " m";
    els.hudCoins.textContent = "◉ " + d.coins;
  }
  function showGameOver(d) {
    els.goStats.innerHTML = "";
    els.goStats.appendChild(h("div", "bigstat", d.distance + " m"));
    els.goStats.appendChild(h("div", "substat", "+" + d.earned + " coins" + (d.isNewBest ? "  •  NEW BEST!" : "  •  best " + d.best + " m")));
  }
  function setBikes(catalog, owned, selectedId, coinBalance) {
    if (!els.bikeList) return;
    if (coinBalance != null && els.coinLabel) els.coinLabel.textContent = coinBalance + " coins";
    els.bikeList.innerHTML = "";
    catalog.forEach(function (b) {
      var card = h("div", "bikecard" + (b.id === selectedId ? " sel" : ""));
      card.appendChild(h("div", "bname", b.name));
      card.appendChild(h("div", "bdesc", b.desc || ""));
      card.appendChild(h("div", "bstats", "Top " + b.topSpeed + " • Acc " + Math.round(b.accel * 100) + " • Hdl " + Math.round(b.handling * 100)));
      var isOwned = owned.indexOf(b.id) >= 0;
      if (isOwned) card.appendChild(btn(b.id === selectedId ? "SELECTED" : "SELECT", function () { cb.onSelectBike && cb.onSelectBike(b.id); }, "small"));
      else card.appendChild(btn("BUY " + b.price, function () { cb.onBuyBike && cb.onBuyBike(b.id); }, "small buy"));
      els.bikeList.appendChild(card);
    });
  }

  var toastTimer = null;
  MOTO.UI = {
    init: init, show: show, setHUD: setHUD, showGameOver: showGameOver, setBikes: setBikes,
    setCoins: function (n) { if (els.coinLabel) els.coinLabel.textContent = n + " coins"; },
    setSettings: function (s) { settings = Object.assign(settings, s); },
    toast: function (msg) {
      if (!els.toast) return; els.toast.textContent = msg; els.toast.classList.add("on");
      clearTimeout(toastTimer); toastTimer = setTimeout(function () { els.toast.classList.remove("on"); }, 1600);
    }
  };
})();
