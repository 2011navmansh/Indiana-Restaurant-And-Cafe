/* ============================================================
   Indiana Restaurant & Cafe — Premium Cookie Consent (bottom-left)
   - Glass card with logo, mustard accents, dark/light aware
   - Remembers choice in localStorage: 'indiana-cookie-consent'
   - On mobile it sits above the sticky CTA bar (.mcta)
   ============================================================ */
(function () {
  'use strict';
  var KEY = 'indiana-cookie-consent';
  try { if (localStorage.getItem(KEY)) return; } catch (e) { /* private mode */ }

  var CSS = ''
    + '.ind-cookie{position:fixed;left:18px;bottom:18px;z-index:120;width:min(362px,calc(100vw - 36px));'
    + 'background:linear-gradient(160deg,rgba(20,20,20,.94),rgba(10,10,10,.96));'
    + 'border:1px solid rgba(250,204,21,.28);border-radius:22px;padding:16px 16px 12px;color:#FFFBEB;'
    + 'font-family:"Plus Jakarta Sans",system-ui,sans-serif;'
    + 'box-shadow:0 30px 70px -20px rgba(0,0,0,.78),inset 0 1px 0 rgba(255,255,255,.08);'
    + 'backdrop-filter:blur(22px);-webkit-backdrop-filter:blur(22px);'
    + 'transform:translateY(150%) scale(.96);opacity:0;overflow:hidden;'
    + 'transition:transform .75s cubic-bezier(.2,.85,.2,1),opacity .5s;will-change:transform}'
    + '.ind-cookie.show{transform:translateY(0) scale(1);opacity:1}'
    + '.ind-cookie::before{content:"";position:absolute;top:-64px;right:-64px;width:160px;height:160px;border-radius:50%;'
    + 'background:radial-gradient(circle,rgba(250,204,21,.4),transparent 70%);pointer-events:none}'
    + '.ic-head{display:flex;align-items:center;gap:9px;margin-bottom:9px;position:relative}'
    + '.ic-logo{width:30px;height:30px;border-radius:50%;overflow:hidden;background:#0A0A0A;border:1px solid rgba(250,204,21,.55);'
    + 'display:grid;place-items:center;flex:0 0 auto}'
    + '.ic-logo img{width:100%;height:100%;object-fit:cover;transform:scale(1.14)}'
    + '.ic-eyebrow{font-size:9.5px;font-weight:800;letter-spacing:.22em;text-transform:uppercase;color:#FACC15}'
    + '.ic-title{font-family:"Bebas Neue",sans-serif;font-size:24px;line-height:.95;letter-spacing:.03em;position:relative}'
    + '.ic-title em{font-family:"Cormorant Garamond",serif;font-style:italic;font-weight:400;color:#FACC15}'
    + '.ic-text{font-size:11.5px;line-height:1.65;opacity:.72;margin:7px 0 12px;position:relative}'
    + '.ic-actions{display:flex;gap:8px;position:relative}'
    + '.ic-accept{flex:1.35;display:inline-flex;align-items:center;justify-content:center;gap:7px;'
    + 'background:linear-gradient(135deg,#FACC15,#EAB308);color:#0A0A0A;border:0;border-radius:999px;padding:10.5px 14px;'
    + 'font-weight:800;font-size:11.5px;letter-spacing:.05em;cursor:pointer;font-family:inherit;'
    + 'box-shadow:0 12px 26px -12px rgba(250,204,21,.8);transition:transform .3s,box-shadow .3s}'
    + '.ic-accept:hover{transform:translateY(-1px);box-shadow:0 16px 30px -12px rgba(250,204,21,.9)}'
    + '.ic-accept i{width:20px;height:20px;border-radius:50%;background:#0A0A0A;color:#FACC15;display:grid;place-items:center;'
    + 'font-size:10px;font-style:normal}'
    + '.ic-ess{flex:1;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.16);color:#FFFBEB;border-radius:999px;'
    + 'padding:10.5px 12px;font-weight:700;font-size:10.5px;letter-spacing:.05em;cursor:pointer;font-family:inherit;transition:background .3s}'
    + '.ic-ess:hover{background:rgba(255,255,255,.13)}'
    + '.ic-foot{margin-top:10px;padding-top:9px;border-top:1px solid rgba(255,255,255,.08);font-size:8.5px;font-weight:700;'
    + 'letter-spacing:.18em;opacity:.5;text-transform:uppercase;display:flex;justify-content:space-between;gap:8px;position:relative}'
    + 'html.light .ind-cookie{background:linear-gradient(160deg,rgba(255,255,255,.97),rgba(255,251,235,.99));color:#0A0A0A;'
    + 'border-color:rgba(202,138,4,.35);box-shadow:0 30px 70px -24px rgba(120,90,0,.5),inset 0 1px 0 rgba(255,255,255,.9)}'
    + 'html.light .ic-eyebrow,html.light .ic-title em{color:#A16207}'
    + 'html.light .ic-ess{background:rgba(10,10,10,.05);border-color:rgba(10,10,10,.14);color:#0A0A0A}'
    + 'html.light .ic-ess:hover{background:rgba(10,10,10,.1)}'
    + 'html.light .ic-foot{border-color:rgba(10,10,10,.08)}'
    + '@media (max-width:640px){'
    + '.ind-cookie{left:12px;right:12px;width:auto;bottom:12px;border-radius:20px;padding:14px 14px 11px}'
    + '.ind-cookie.has-mcta{bottom:84px}'
    + '.ic-title{font-size:21px}'
    + '}';

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  ready(function () {
    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    var box = document.createElement('div');
    box.className = 'ind-cookie';
    box.id = 'indCookie';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', 'Cookie preferences');
    box.innerHTML = ''
      + '<div class="ic-head">'
      + '  <span class="ic-logo"><img src="https://i.postimg.cc/2j4wTB2c/image.png" alt="Indiana logo" draggable="false"></span>'
      + '  <span class="ic-eyebrow">Cookie Preferences</span>'
      + '</div>'
      + '<div class="ic-title">WE BAKE MORE THAN <em>Pizza</em></div>'
      + '<p class="ic-text">A few crumbs of data help us remember your theme, your cart and your table \u2014 that\u2019s all. No shady tracking, promise.</p>'
      + '<div class="ic-actions">'
      + '  <button type="button" class="ic-accept" id="indCookieAll">ACCEPT ALL <i>\u2197</i></button>'
      + '  <button type="button" class="ic-ess" id="indCookieEss">ESSENTIAL ONLY</button>'
      + '</div>'
      + '<div class="ic-foot"><span>Indiana \u2022 Jhalawar</span><span>Saved on this device</span></div>';
    document.body.appendChild(box);

    /* keep clear of the mobile sticky CTA bar */
    function position() {
      var m = document.querySelector('.mcta');
      var visible = m && window.innerWidth < 1024 && getComputedStyle(m).display !== 'none';
      box.classList.toggle('has-mcta', !!visible);
    }
    position();
    window.addEventListener('resize', position);

    setTimeout(function () { box.classList.add('show'); }, 1100);

    function close(choice) {
      try { localStorage.setItem(KEY, choice); } catch (e) { /* ignore */ }
      box.classList.remove('show');
      setTimeout(function () { if (box.parentNode) box.parentNode.removeChild(box); }, 650);
    }
    box.querySelector('#indCookieAll').addEventListener('click', function () { close('all'); });
    box.querySelector('#indCookieEss').addEventListener('click', function () { close('essential'); });
  });
})();
