/* ============================================================
   Indiana Restaurant & Cafe — Premium skeleton loader
   YouTube/Instagram style shimmer while the site loads.
   Loaded with a plain <script> right after <body> on each page.
   ============================================================ */
(function () {
  'use strict';
  try {
    var CSS = ''
      + '#indSkeleton{position:fixed;inset:0;z-index:99999;background:#0A0A0A;display:flex;align-items:flex-start;'
      + 'justify-content:center;transition:opacity .6s ease,visibility .6s}'
      + '#indSkeleton.off{opacity:0;visibility:hidden;pointer-events:none}'
      + 'html.sk-lock,html.sk-lock body{overflow:hidden!important}'
      + '#indSkeleton .sk-in{width:100%;max-width:1040px;padding:26px 22px 40px;display:flex;flex-direction:column;gap:34px}'
      + '#indSkeleton .sk-bar,#indSkeleton .sk-card,#indSkeleton .sk-cta{border-radius:14px;'
      + 'background:linear-gradient(90deg,rgba(255,255,255,.05) 25%,rgba(255,255,255,.13) 37%,rgba(255,255,255,.05) 63%);'
      + 'background-size:400% 100%;animation:skShine 1.5s ease-in-out infinite}'
      + '@keyframes skShine{0%{background-position:100% 0}100%{background-position:0 0}}'
      + '#indSkeleton .sk-nav .sk-bar{height:52px;width:100%;border-radius:18px}'
      + '#indSkeleton .sk-hero{display:flex;flex-direction:column;align-items:center;gap:16px;padding:30px 0 6px;text-align:center}'
      + '#indSkeleton .sk-logo{width:76px;height:76px;border-radius:999px;overflow:hidden;'
      + 'background:linear-gradient(135deg,#FACC15,#EAB308);box-shadow:0 18px 44px -18px rgba(250,204,21,.95);'
      + 'animation:skPulse 1.8s ease-in-out infinite}'
      + '#indSkeleton .sk-logo img{width:100%;height:100%;object-fit:cover;display:block}'
      + '@keyframes skPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.07)}}'
      + '#indSkeleton .sk-brand{font-weight:800;font-size:13px;letter-spacing:.44em;color:rgba(255,251,235,.82);font-family:Arial,sans-serif}'
      + '#indSkeleton .sk-hero .sk-bar{height:30px}'
      + '#indSkeleton .sk-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}'
      + '#indSkeleton .sk-card{height:190px;border-radius:20px}'
      + '#indSkeleton .sk-foot{display:flex;justify-content:center}'
      + '#indSkeleton .sk-foot .sk-bar{height:14px;width:230px}'
      + 'html.light #indSkeleton{background:#FFFBEB}'
      + 'html.light #indSkeleton .sk-bar,html.light #indSkeleton .sk-card{'
      + 'background:linear-gradient(90deg,rgba(10,10,10,.05) 25%,rgba(10,10,10,.12) 37%,rgba(10,10,10,.05) 63%);'
      + 'background-size:400% 100%}'
      + 'html.light #indSkeleton .sk-brand{color:rgba(10,10,10,.72)}'
      + '@media (max-width:760px){#indSkeleton .sk-grid{grid-template-columns:repeat(2,1fr)}'
      + '#indSkeleton .sk-card{height:130px}#indSkeleton .sk-in{gap:24px}}';

    var s = document.createElement('style');
    s.textContent = CSS;
    document.head.appendChild(s);

    var el = document.createElement('div');
    el.id = 'indSkeleton';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = ''
      + '<div class="sk-in">'
      + '  <div class="sk-nav"><span class="sk-bar"></span></div>'
      + '  <div class="sk-hero">'
      + '    <span class="sk-logo"><img src="https://i.postimg.cc/2j4wTB2c/image.png" alt=""></span>'
      + '    <span class="sk-brand">INDIANA</span>'
      + '    <span class="sk-bar" style="width:min(580px,80%)"></span>'
      + '    <span class="sk-bar" style="width:min(420px,58%)"></span>'
      + '    <span class="sk-bar" style="width:min(300px,42%);height:13px;border-radius:8px"></span>'
      + '    <span class="sk-cta" style="width:196px;height:48px;border-radius:999px;margin-top:8px"></span>'
      + '  </div>'
      + '  <div class="sk-grid"><span class="sk-card"></span><span class="sk-card"></span>'
      + '<span class="sk-card"></span><span class="sk-card"></span></div>'
      + '  <div class="sk-foot"><span class="sk-bar"></span></div>'
      + '</div>';

    document.body.appendChild(el);
    document.documentElement.classList.add('sk-lock');

    var t0 = Date.now(), MIN = 700, done = false;
    function hide() {
      if (done) return;
      done = true;
      var wait = Math.max(0, MIN - (Date.now() - t0));
      setTimeout(function () {
        el.classList.add('off');
        document.documentElement.classList.remove('sk-lock');
        setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 720);
      }, wait);
    }
    if (document.readyState === 'complete') hide();
    else window.addEventListener('load', hide);
    setTimeout(hide, 10000); /* failsafe: skeleton kabhi stuck na rahe */
  } catch (e) { /* skeleton must never block the site */ }
})();
