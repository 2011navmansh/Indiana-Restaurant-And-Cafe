/* ============================================================
   Indiana Restaurant & Cafe — Image Protection Layer (deterrent)
   ------------------------------------------------------------
   Blocks: right-click save, drag-save, long-press save (mobile),
   copy-image, and common DevTools shortcuts.
   NOTE: No website can 100% stop a determined user (network tab
   always shows files). This is a strong deterrent layer only.
   ============================================================ */
(function () {
  'use strict';
  var d = document;

  /* ---------- 1. CSS hardening ---------- */
  var style = d.createElement('style');
  style.id = 'indiana-protect-css';
  style.textContent =
    'img, picture, video, canvas {' +
    ' -webkit-user-drag: none !important;' +
    ' user-drag: none !important;' +
    ' user-select: none !important;' +
    ' -webkit-user-select: none !important;' +
    ' -webkit-touch-callout: none !important;' +
    ' pointer-events: auto;' +
    '}' +
    '::selection { background: rgba(250,204,21,.35); }';
  (d.head || d.documentElement).appendChild(style);

  /* ---------- 2. Right-click block (on images + logo badges) ---------- */
  d.addEventListener('contextmenu', function (e) {
    var t = e.target;
    if (t && (t.tagName === 'IMG' || t.tagName === 'PICTURE' || t.tagName === 'VIDEO' || (t.closest && t.closest('.logo-badge')))) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
  }, true);

  /* ---------- 3. Drag-save block ---------- */
  d.addEventListener('dragstart', function (e) {
    var t = e.target;
    if (t && (t.tagName === 'IMG' || t.tagName === 'PICTURE')) {
      e.preventDefault();
      return false;
    }
  }, true);

  /* ---------- 4. Copy block (Ctrl+C on image selections) ---------- */
  d.addEventListener('copy', function (e) {
    var sel = window.getSelection();
    if (sel && sel.anchorNode) {
      var node = sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement;
      if (node && node.closest && node.closest('img, picture, .logo-badge, figure')) {
        e.preventDefault();
        return false;
      }
    }
  }, true);

  /* ---------- 5. Long-press save block (iOS/Android callout) ---------- */
  d.addEventListener('touchstart', function (e) {
    var t = e.target;
    if (t && t.tagName === 'IMG' && e.touches && e.touches.length > 1) {
      /* pinch-zoom allowed; long-press handled by -webkit-touch-callout:none */
    }
  }, { passive: true });

  /* ---------- 6. DevTools / view-source shortcut deterrent ---------- */
  d.addEventListener('keydown', function (e) {
    var k = e.key || '';
    var ctrl = e.ctrlKey || e.metaKey;
    var blocked =
      k === 'F12' ||
      (ctrl && e.shiftKey && (k === 'I' || k === 'J' || k === 'C' || k === 'i' || k === 'j' || k === 'c')) ||
      (ctrl && (k === 'U' || k === 'u') && !e.shiftKey && !e.altKey);
    if (blocked) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
  }, true);

  /* ---------- 7. Set draggable=false on all current + future images ---------- */
  function harden(img) {
    if (!img || img.dataset.indianaLocked) return;
    img.dataset.indianaLocked = '1';
    img.setAttribute('draggable', 'false');
    img.addEventListener('contextmenu', function (e) { e.preventDefault(); }, false);
    img.addEventListener('dragstart', function (e) { e.preventDefault(); }, false);
  }

  function hardenAll(root) {
    var list = (root || d).querySelectorAll('img');
    for (var i = 0; i < list.length; i++) harden(list[i]);
  }

  if (d.readyState === 'loading') {
    d.addEventListener('DOMContentLoaded', function () { hardenAll(); });
  } else {
    hardenAll();
  }

  /* ---------- 8. Watch dynamic images (cart thumbs, gallery renders) ---------- */
  if (window.MutationObserver) {
    new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var added = muts[i].addedNodes;
        for (var j = 0; j < added.length; j++) {
          var n = added[j];
          if (n.nodeType === 1) {
            if (n.tagName === 'IMG') harden(n);
            else if (n.querySelectorAll) hardenAll(n);
          }
        }
      }
    }).observe(d.documentElement, { childList: true, subtree: true });
  }

  /* ---------- 9. Console warning ---------- */
  try {
    console.log(
      '%c⛔ INDIANA RESTAURANT & CAFE%c\nAll photos & graphics on this site are original work of Indiana Restaurant & Cafe, Jhalawar.\nCopying, downloading or reusing them without written permission is strictly prohibited.',
      'background:#FACC15;color:#0A0A0A;font-weight:800;padding:6px 12px;border-radius:6px;font-size:13px;',
      'color:#FACC15;font-size:11px;line-height:1.6;'
    );
  } catch (e) { /* ignore */ }
})();
