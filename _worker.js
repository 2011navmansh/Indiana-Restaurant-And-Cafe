// ============================================================
//  Indiana Restaurant & Cafe — Cloudflare Pages (Advanced Mode)
//  File: _worker.js
// ------------------------------------------------------------
//  Ye file 2 kaam karti hai:
//   1) Poori website (index.html, menu.html, ...) serve karti hai
//   2) /api/... wali requests ko backend Worker ko bhej deti hai
//      (proxy karti hai) — isliye website ke andar jo relative
//      fetch('/api/bookings') etc. hai wo bina kuch badle chal
//      jaata hai, chahe site pages.dev pe ho ya aapke domain pe.
//
//  IMPORTANT: agar aapka backend Worker URL badle, to sirf
//  neeche wali API_ORIGIN line badalni hai.
// ============================================================

const API_ORIGIN = 'https://indiana-api.2011navmansh.workers.dev';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ---- /api/*  ->  backend Worker ----
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      const headers = new Headers(request.headers);
      headers.delete('host'); // URL se host set hoga

      const init = {
        method: request.method,
        headers,
        redirect: 'manual'
      };

      // GET/HEAD me body nahi hoti
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        init.body = request.body;
      }

      return fetch(API_ORIGIN + url.pathname + url.search, init);
    }

    // ---- baaki sab: static website files ----
    return env.ASSETS.fetch(request);
  }
};
