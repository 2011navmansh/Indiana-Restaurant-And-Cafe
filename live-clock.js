/* ============================================================
   Indiana Restaurant & Cafe — LIVE India time strip (all pages)
   Sits just above the credit bar. Time is always real IST:
   1) synced from our backend (/api/health),
   2) else from free world time API,
   3) else device clock. Plus live OPEN / CLOSED (11:00-22:45 IST).
   ============================================================ */
(function () {
  'use strict';
  var OPEN_MIN = 11 * 60, CLOSE_MIN = 22 * 60 + 45;
  var DOW = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  var MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  var offset = 0;           /* device-clock correction (ms) */
  var synced = false;
  var doorOverride = null;  /* owner console OPEN/CLOSED override */

  var CSS = ''
    + '.in-live{position:relative;z-index:5;background:#0A0A0A;border-top:1px solid rgba(255,255,255,.07);'
    + 'background-image:radial-gradient(130% 160% at 50% 0%,rgba(250,204,21,.10),transparent 60%)}'
    + '.in-live-in{max-width:1240px;margin:0 auto;padding:17px 18px;display:flex;flex-wrap:wrap;align-items:center;'
    + 'justify-content:center;gap:10px 26px;text-align:center}'
    + '.in-live-kicker{display:inline-flex;align-items:center;gap:9px;font-size:10px;font-weight:800;'
    + 'letter-spacing:.22em;color:rgba(255,251,235,.55)}'
    + '.in-live-dot{width:7px;height:7px;border-radius:99px;background:#4ADE80;animation:inLivePulse 2.2s infinite}'
    + '@keyframes inLivePulse{0%{box-shadow:0 0 0 0 rgba(74,222,128,.55)}70%{box-shadow:0 0 0 10px rgba(74,222,128,0)}100%{box-shadow:0 0 0 0 rgba(74,222,128,0)}}'
    + '.in-live-clock{display:inline-flex;align-items:baseline;gap:10px;flex-wrap:wrap;justify-content:center}'
    + '.in-live-time{font-variant-numeric:tabular-nums;font-weight:800;font-size:16px;letter-spacing:.03em;color:#FFFBEB}'
    + '.in-live-time b{color:#FACC15;font-weight:800;font-size:11px;letter-spacing:.16em;margin-left:2px}'
    + '.in-live-day{font-size:10.5px;font-weight:700;letter-spacing:.16em;color:rgba(255,251,235,.5)}'
    + '.in-live-pill{display:inline-flex;align-items:center;gap:8px;font-size:10px;font-weight:800;letter-spacing:.15em;'
    + 'padding:8px 15px;border-radius:999px;color:#4ADE80;border:1px solid rgba(74,222,128,.35);background:rgba(74,222,128,.08);'
    + 'transition:color .4s,border-color .4s,background .4s}'
    + '.in-live-pill i{width:6px;height:6px;border-radius:99px;background:currentColor;flex:0 0 auto}'
    + '.in-live-pill.closed{color:#FACC15;border-color:rgba(250,204,21,.35);background:rgba(250,204,21,.08)}'
    + '.in-live-cta{display:inline-flex;align-items:center;gap:8px;font-size:10px;font-weight:800;letter-spacing:.16em;'
    + 'padding:9px 17px;border-radius:999px;background:linear-gradient(135deg,#FACC15,#EAB308);color:#0A0A0A;'
    + 'text-decoration:none;box-shadow:0 10px 22px -12px rgba(250,204,21,.95);transition:transform .3s,box-shadow .3s}'
    + '.in-live-cta:hover{transform:translateY(-1px);box-shadow:0 14px 26px -12px rgba(250,204,21,1)}'
    + 'html.light .in-live{background:#FFFBEB;border-top:1px solid rgba(10,10,10,.08);'
    + 'background-image:radial-gradient(130% 160% at 50% 0%,rgba(234,179,8,.10),transparent 60%)}'
    + 'html.light .in-live-kicker{color:rgba(10,10,10,.55)}'
    + 'html.light .in-live-dot{background:#15803D}'
    + 'html.light .in-live-time{color:#0A0A0A}'
    + 'html.light .in-live-time b{color:#A16207}'
    + 'html.light .in-live-day{color:rgba(10,10,10,.5)}'
    + 'html.light .in-live-pill{color:#15803D;border-color:rgba(21,128,61,.3);background:rgba(21,128,61,.08)}'
    + 'html.light .in-live-pill.closed{color:#A16207;border-color:rgba(161,98,7,.3);background:#FEF3C7}'
    + 'html.light .in-live-cta{color:#0A0A0A}'
    + '@media (max-width:640px){.in-live-in{padding:15px 14px;gap:9px 16px}.in-live-time{font-size:15px}}';

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  /* India time — independent of visitor device timezone AND clock */
  function istNow() { return new Date(Date.now() + offset + 330 * 60000); }

  var timeEl, dayEl, pillEl, txtEl;

  function tick() {
    var d = istNow();
    var h = d.getUTCHours(), m = d.getUTCMinutes(), s = d.getUTCSeconds();
    if (!timeEl) return;
    timeEl.innerHTML = String(h % 12 || 12).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0')
      + ' <b>' + (h >= 12 ? 'PM' : 'AM') + '</b>';
    dayEl.textContent = DOW[d.getUTCDay()] + ', ' + d.getUTCDate() + ' ' + MON[d.getUTCMonth()] + ' ' + d.getUTCFullYear();

    var nowM = h * 60 + m;
    var timeOpen = nowM >= OPEN_MIN && nowM <= CLOSE_MIN;
    var open = doorOverride === null ? timeOpen : doorOverride;
    var txt;
    if (open && timeOpen && nowM >= CLOSE_MIN - 60) txt = 'OPEN — LAST ORDERS SOON';
    else if (open && timeOpen) txt = 'OPEN NOW — TILL 10:45 PM';
    else if (open) txt = 'OPEN NOW';
    else if (doorOverride === false) txt = 'TEMPORARILY CLOSED';
    else if (nowM >= OPEN_MIN - 60 && nowM < OPEN_MIN) txt = 'OPENING SOON — 11:00 AM';
    else txt = 'CLOSED — OPENS 11:00 AM DAILY';
    txtEl.textContent = txt;
    pillEl.classList.toggle('closed', !open);
  }

  function setOffset(t) { if (t) { offset = t - Date.now(); synced = true; tick(); } }

  /* free world-time fallbacks (no key, no card) */
  function syncNet() {
    fetch('https://worldtimeapi.org/api/timezone/Asia/Kolkata', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j && j.unixtime) setOffset(j.unixtime * 1000);
        else if (j && j.datetime) setOffset(new Date(j.datetime).getTime());
      })
      .catch(function () {
        fetch('https://timeapi.io/api/Time/current/zone?timeZone=Asia/Kolkata', { cache: 'no-store' })
          .then(function (r) { return r.json(); })
          .then(function (j) { if (j && j.dateTime) setOffset(new Date(j.dateTime).getTime()); })
          .catch(function () { /* device clock as last resort */ });
      });
  }

  function sync() {
    try {
      fetch('/api/health', { cache: 'no-store' }).then(function (r) {
        var dt = r.headers.get('date');
        if (dt) setOffset(new Date(dt).getTime());
        return r.json().catch(function () { return null; });
      }).then(function (j) {
        if (j && j.time) setOffset(new Date(j.time).getTime());
      }).catch(syncNet);
      fetch('/api/status', { cache: 'no-store' }).then(function (r) { return r.json(); })
        .then(function (j) { if (j && typeof j.open === 'boolean') { doorOverride = j.open; tick(); } })
        .catch(function () {});
    } catch (e) { syncNet(); }
    setTimeout(function () { if (!synced) syncNet(); }, 2500);
    setInterval(function () { if (!synced) syncNet(); }, 300000);
  }

  ready(function () {
    if (document.querySelector('.in-live')) return;
    var s = document.createElement('style');
    s.textContent = CSS;
    document.head.appendChild(s);
    var el = document.createElement('section');
    el.className = 'in-live';
    el.setAttribute('aria-label', 'Live India time and opening status');
    el.innerHTML = '<div class="in-live-in">'
      + '<span class="in-live-kicker"><i class="in-live-dot"></i>LIVE FROM JHALAWAR, RAJASTHAN</span>'
      + '<span class="in-live-clock"><span class="in-live-time">--:--:--</span><span class="in-live-day">—</span></span>'
      + '<span class="in-live-pill closed"><i></i><span>CHECKING…</span></span>'
      + '<a class="in-live-cta" href="reserve.html">RESERVE A TABLE ↗</a>'
      + '</div>';
    var cb = document.querySelector('.credit-bar');
    if (cb && cb.parentNode) cb.parentNode.insertBefore(el, cb);
    else document.body.appendChild(el);
    timeEl = el.querySelector('.in-live-time');
    dayEl = el.querySelector('.in-live-day');
    pillEl = el.querySelector('.in-live-pill');
    txtEl = el.querySelector('.in-live-pill span');
    tick();
    setInterval(tick, 1000);
    sync();
  });
})();
