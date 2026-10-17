/* ============================================================
   Indiana Restaurant & Cafe — Site Credit (every page, bottom)
   Website by Navmansh Sen • [call icon] +91-7014198045 for work
   ============================================================ */
(function () {
  'use strict';
  var CSS = ''
    + '.credit-bar{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:7px 12px;'
    + 'padding:15px 18px 17px;font-size:11px;font-weight:700;letter-spacing:.09em;'
    + 'background:#0A0A0A;color:rgba(255,251,235,.62);border-top:1px solid rgba(255,255,255,.07);'
    + 'text-align:center;position:relative;z-index:5}'
    + '.credit-bar b{color:#FACC15;font-weight:800}'
    + '.credit-bar .cb-dot{color:rgba(250,204,21,.5)}'
    + '.credit-bar .cb-for{color:rgba(255,251,235,.62)}'
    + '.credit-bar .cb-call{display:inline-flex;align-items:center;gap:8px;text-decoration:none;border:0;transition:transform .3s}'
    + '.credit-bar .cb-call:hover{transform:translateY(-1px)}'
    + '.credit-bar .cb-ic{width:21px;height:21px;border-radius:999px;flex:0 0 auto;display:grid;place-items:center;'
    + 'background:linear-gradient(135deg,#FACC15,#EAB308);color:#0A0A0A;'
    + 'box-shadow:0 8px 16px -8px rgba(250,204,21,.9),inset 0 1px 0 rgba(255,255,255,.5);transition:box-shadow .3s}'
    + '.credit-bar .cb-call:hover .cb-ic{box-shadow:0 10px 20px -8px rgba(250,204,21,1),inset 0 1px 0 rgba(255,255,255,.6)}'
    + '.credit-bar .cb-ic svg{width:11px;height:11px;display:block}'
    + '.credit-bar .cb-num{color:#FFFBEB;font-weight:800;letter-spacing:.02em;'
    + 'border-bottom:1px dotted rgba(250,204,21,.55);transition:color .25s,border-color .25s}'
    + '.credit-bar .cb-call:hover .cb-num{color:#FACC15;border-bottom-color:#FACC15}'
    + 'html.light .credit-bar{background:#FFFBEB;color:rgba(10,10,10,.62);border-top:1px solid rgba(10,10,10,.08)}'
    + 'html.light .credit-bar b{color:#A16207}'
    + 'html.light .credit-bar .cb-for{color:rgba(10,10,10,.62)}'
    + 'html.light .credit-bar .cb-num{color:#0A0A0A;border-bottom-color:rgba(161,98,7,.5)}'
    + 'html.light .credit-bar .cb-call:hover .cb-num{color:#A16207;border-bottom-color:#A16207}'
    + '@media (max-width:640px){.credit-bar{padding-bottom:calc(17px + env(safe-area-inset-bottom))}}';

  var PHONE_SVG = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">'
    + '<path d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.02-.24c1.12.37 2.33.57 3.57.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1C10.61 21 3 13.39 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.24.2 2.45.57 3.57a1 1 0 0 1-.25 1.02l-2.2 2.2Z"/>'
    + '</svg>';

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  ready(function () {
    if (document.querySelector('.credit-bar')) return;
    var s = document.createElement('style');
    s.textContent = CSS;
    document.head.appendChild(s);
    var d = document.createElement('div');
    d.className = 'credit-bar';
    d.innerHTML = ''
      + '<span>Website by <b>Navmansh Sen</b></span>'
      + '<span class="cb-dot">\u2022</span>'
      + '<span class="cb-for">'
      + '  <a class="cb-call" href="tel:+917014198045" title="Call Navmansh Sen for work" aria-label="Call +91-7014198045 for work">'
      + '    <i class="cb-ic">' + PHONE_SVG + '</i>'
      + '    <span class="cb-num">+91-7014198045</span>'
      + '  </a>'
      + '  for work</span>';
    document.body.appendChild(d);
  });
})();
