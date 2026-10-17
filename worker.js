/* ============================================================
   INDIANA RESTAURANT & CAFE — CLOUDFLARE WORKER BACKEND
   ------------------------------------------------------------
   Free plan friendly. Runs at: yourdomain.com/api/*
   Bindings needed (Cloudflare Dashboard):
     - D1 database  → variable name: DB
     - Secret       → ADMIN_PASSWORD
   Optional:
     - Secret NOTIFY_WEBHOOK  (POST json on each new booking)

   Endpoints
     GET    /api/health
     POST   /api/auth/login     { password }        → session cookie
     POST   /api/auth/logout
     GET    /api/status                              → { open }
     POST   /api/status         { open }             (admin)
     POST   /api/bookings       { name, phone, ... } (public)
     GET    /api/bookings?limit=200&status=          (admin)
     PATCH  /api/bookings/:id   { status }           (admin)
     DELETE /api/bookings/:id                        (admin)
     POST   /api/orders         { name, phone, items }
     GET    /api/orders?limit=200                    (admin)
     PATCH  /api/orders/:id     { status }           (admin)
     GET    /api/stats                               (admin)
     GET    /api/export/bookings.csv                 (admin)
   ============================================================ */

const SLOTS = (() => {
  const out = [];
  for (let m = 11 * 60; m <= 22 * 60 + 30; m += 30) {
    const h = Math.floor(m / 60), mm = m % 60, ampm = h >= 12 ? 'PM' : 'AM';
    out.push((h % 12 === 0 ? 12 : h % 12) + ':' + String(mm).padStart(2, '0') + ' ' + ampm);
  }
  return out;
})();

const BOOKING_STATUS = ['pending', 'confirmed', 'seated', 'cancelled', 'no_show'];
const ORDER_STATUS = ['new', 'preparing', 'served', 'paid', 'cancelled'];
const COOKIE = 'ind_session';
const SESSION_HOURS = 12;
const MAX_AHEAD_DAYS = 120;
const OPEN_MIN = 11 * 60, CLOSE_MIN = 22 * 60 + 45;
const enc = new TextEncoder();
const rl = new Map(); // best-effort rate limit (per isolate)

/* ---------- helpers ---------- */
const clean = (v, max) => String(v == null ? '' : v).replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max || 120);
const phoneOk = (p) => /^[+\d][\d\s-]{7,17}$/.test(p);

function cors(req) {
  return {
    'Access-Control-Allow-Origin': req.headers.get('Origin') || '*',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type, x-admin-pw',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Vary': 'Origin',
  };
}
function J(status, body, extra) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...(extra || {}) },
  });
}
const ok = (body, extra) => J(200, { ok: true, ...(body || {}) }, extra);
const fail = (status, error, extra) => J(status, { ok: false, error }, extra);

function limited(key, max, windowMs) {
  const now = Date.now(), hit = rl.get(key) || [];
  const fresh = hit.filter((t) => now - t < windowMs);
  fresh.push(now); rl.set(key, fresh);
  return fresh.length > max;
}

/* ---------- IST time (independent of visitor/device) ---------- */
const istNow = () => new Date(Date.now() + 330 * 60000);
function istDate() {
  const d = istNow();
  return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
}
const istMinutes = () => { const d = istNow(); return d.getUTCHours() * 60 + d.getUTCMinutes(); };
function slotMinutes(slot) {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(String(slot || ''));
  if (!m) return -1;
  let h = parseInt(m[1], 10) % 12;
  if (/pm/i.test(m[3])) h += 12;
  return h * 60 + parseInt(m[2], 10);
}

/* ---------- auth ---------- */
async function sha256hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(str));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
function cookieVal(req, name) {
  const m = (req.headers.get('Cookie') || '').match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return m ? decodeURIComponent(m[1]) : '';
}
async function isAdmin(req, env) {
  const pw = req.headers.get('x-admin-pw');
  if (pw && env.ADMIN_PASSWORD && pw === env.ADMIN_PASSWORD) return true;
  const token = cookieVal(req, COOKIE);
  if (!token) return false;
  const hash = await sha256hex(token);
  const row = await env.DB.prepare('SELECT expiresAt FROM sessions WHERE token_hash = ?').bind(hash).first();
  if (!row) return false;
  if (new Date(row.expiresAt).getTime() < Date.now()) {
    await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(hash).run();
    return false;
  }
  return true;
}

/* ---------- notifications (optional) ---------- */
async function notify(env, payload) {
  if (!env.NOTIFY_WEBHOOK) return;
  try {
    await fetch(env.NOTIFY_WEBHOOK, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
  } catch (e) { /* notification never blocks a booking */ }
}

/* ---------- worker ---------- */
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const p = url.pathname.replace(/\/+$/, '') || '/';
    const m = req.method.toUpperCase();
    const C = cors(req);

    if (m === 'OPTIONS') return new Response(null, { status: 204, headers: C });
    if (p === '/api/health') return ok({ service: 'indiana-api', time: new Date().toISOString() }, C);
    if (p === '/' || p === '/api') return ok({ service: 'indiana-api', docs: '/api/health' }, C);

    const ip = req.headers.get('CF-Connecting-IP') || 'unknown';

    /* ---------- AUTH ---------- */
    if (p === '/api/auth/login' && m === 'POST') {
      if (limited('login:' + ip, 8, 10 * 60000)) return fail(429, 'Too many attempts — try again in 10 minutes', C);
      const body = await req.json().catch(() => null);
      const pw = body && body.password ? String(body.password) : '';
      if (!env.ADMIN_PASSWORD) return fail(500, 'ADMIN_PASSWORD secret is not set on this Worker', C);
      if (!pw || pw !== env.ADMIN_PASSWORD) return fail(401, 'Wrong password', C);
      const token = crypto.randomUUID() + '.' + crypto.randomUUID();
      const expiresAt = new Date(Date.now() + SESSION_HOURS * 3600e3).toISOString();
      await env.DB.prepare('INSERT INTO sessions (token_hash, createdAt, expiresAt) VALUES (?,?,?)')
        .bind(await sha256hex(token), new Date().toISOString(), expiresAt).run();
      return ok({ expiresAt }, {
        ...C,
        'Set-Cookie': COOKIE + '=' + encodeURIComponent(token) + '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=' + SESSION_HOURS * 3600,
      });
    }
    if (p === '/api/auth/logout' && m === 'POST') {
      const token = cookieVal(req, COOKIE);
      if (token) await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256hex(token)).run();
      return ok({}, { ...C, 'Set-Cookie': COOKIE + '=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0' });
    }

    /* ---------- DOOR STATUS ---------- */
    if (p === '/api/status' && m === 'GET') {
      const row = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind('door_open').first();
      return ok({ open: !row || row.value !== '0' }, C);
    }
    if (p === '/api/status' && m === 'POST') {
      if (!(await isAdmin(req, env))) return fail(401, 'Admin only', C);
      const body = await req.json().catch(() => ({}));
      const open = !(body && body.open === false);
      await env.DB.prepare('INSERT INTO settings (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
        .bind('door_open', open ? '1' : '0').run();
      return ok({ open }, C);
    }

    /* ---------- BOOKINGS ---------- */
    if (p === '/api/bookings' && m === 'POST') {
      if (limited('book:' + ip, 6, 10 * 60000)) return fail(429, 'Too many requests — please call us instead', C);
      const body = await req.json().catch(() => null);
      if (!body) return fail(400, 'Invalid request', C);

      const name = clean(body.name, 80);
      const phone = clean(body.phone, 20);
      const email = clean(body.email, 90);
      const date = clean(body.date, 10);
      const time = clean(body.time, 12);
      const guests = Math.min(30, Math.max(1, parseInt(body.guests, 10) || 2));
      const seating = clean(body.seating, 20);
      const occasion = clean(body.occasion, 30);
      const notes = clean(body.notes, 300);

      if (name.length < 2) return fail(400, 'Please enter your name', C);
      if (!phoneOk(phone)) return fail(400, 'Please enter a valid phone number', C);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail(400, 'Please pick a valid date', C);
      if (!SLOTS.includes(time)) return fail(400, 'Please pick a valid time slot', C);

      const today = istDate();
      const maxDate = new Date(Date.now() + MAX_AHEAD_DAYS * 864e5).toISOString().slice(0, 10);
      if (date < today) return fail(400, 'That date has already passed', C);
      if (date > maxDate) return fail(400, 'We take bookings up to 120 days ahead', C);
      if (date === today) {
        const slotM = slotMinutes(time);
        if (istMinutes() > slotM - 30) return fail(400, 'That slot is too close — pick a later time or call us', C);
      }

      const id = 'IND-' + Math.random().toString(36).slice(2, 8).toUpperCase();
      const createdAt = new Date().toISOString();
      await env.DB.prepare(
        'INSERT INTO bookings (id,name,phone,email,date,time,guests,seating,occasion,notes,status,createdAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)'
      ).bind(id, name, phone, email, date, time, guests, seating, occasion, notes, 'pending', createdAt).run();

      const booking = { id, name, phone, email, date, time, guests, seating, occasion, notes, status: 'pending', createdAt };
      await notify(env, { type: 'booking', booking });
      const text = encodeURIComponent(
        'Hi Indiana! Booking ' + id + ' — ' + name + ', ' + date + ' at ' + time + ', ' + guests + ' guests.'
      );
      return ok({ booking, whatsapp: 'https://wa.me/919876543210?text=' + text }, C);
    }

    if (p === '/api/bookings' && m === 'GET') {
      if (!(await isAdmin(req, env))) return fail(401, 'Admin only', C);
      const limit = Math.min(500, Math.max(1, parseInt(url.searchParams.get('limit'), 10) || 200));
      const status = url.searchParams.get('status');
      const rows = status && BOOKING_STATUS.includes(status)
        ? await env.DB.prepare('SELECT * FROM bookings WHERE status = ? ORDER BY createdAt DESC LIMIT ?').bind(status, limit).all()
        : await env.DB.prepare('SELECT * FROM bookings ORDER BY createdAt DESC LIMIT ?').bind(limit).all();
      return ok({ data: rows.results || [], total: (rows.results || []).length }, C);
    }

    const bkMatch = /^\/api\/bookings\/([A-Za-z0-9-]+)$/.exec(p);
    if (bkMatch) {
      if (!(await isAdmin(req, env))) return fail(401, 'Admin only', C);
      const id = bkMatch[1];
      if (m === 'PATCH') {
        const body = await req.json().catch(() => ({}));
        const status = clean(body.status, 20);
        if (!BOOKING_STATUS.includes(status)) return fail(400, 'Unknown status', C);
        const before = await env.DB.prepare('SELECT * FROM bookings WHERE id = ?').bind(id).first();
        await env.DB.prepare('UPDATE bookings SET status = ?, updatedAt = ? WHERE id = ?')
          .bind(status, new Date().toISOString(), id).run();
        const row = await env.DB.prepare('SELECT * FROM bookings WHERE id = ?').bind(id).first();
        // Owner ne CONFIRM / CANCEL dabaya -> guest ko email jaye (Apps Script webhook)
        if (before && before.status !== status && (status === 'confirmed' || status === 'cancelled')) {
          await notify(env, { type: 'status', booking: row });
        }
        return ok({ booking: row }, C);
      }
      if (m === 'DELETE') {
        await env.DB.prepare('DELETE FROM bookings WHERE id = ?').bind(id).run();
        return ok({ deleted: id }, C);
      }
    }

    /* ---------- ORDERS ---------- */
    if (p === '/api/orders' && m === 'POST') {
      if (limited('order:' + ip, 8, 10 * 60000)) return fail(429, 'Too many requests — please call us', C);
      const body = await req.json().catch(() => null);
      if (!body) return fail(400, 'Invalid request', C);
      const name = clean(body.name, 80);
      const phone = clean(body.phone, 20);
      const items = Array.isArray(body.items) ? body.items.slice(0, 40).map((i) => ({
        name: clean(i && i.name, 60),
        qty: Math.min(20, Math.max(1, parseInt(i && i.qty, 10) || 1)),
        price: Math.max(0, parseInt(i && i.price, 10) || 0),
      })) : [];
      if (!name) return fail(400, 'Please enter your name', C);
      if (!phoneOk(phone)) return fail(400, 'Please enter a valid phone number', C);
      if (!items.length) return fail(400, 'Your cart is empty', C);

      const total = items.reduce((s, i) => s + i.qty * i.price, 0);
      const id = 'ORD-' + Math.random().toString(36).slice(2, 8).toUpperCase();
      const createdAt = new Date().toISOString();
      await env.DB.prepare('INSERT INTO orders (id,name,phone,items,total,status,createdAt) VALUES (?,?,?,?,?,?,?)')
        .bind(id, name, phone, JSON.stringify(items), total, 'new', createdAt).run();

      const order = { id, name, phone, items, total, status: 'new', createdAt };
      await notify(env, { type: 'order', order });
      const lines = items.map((i) => i.qty + 'x ' + i.name).join(', ');
      const text = encodeURIComponent('Hi Indiana! Order ' + id + ' — ' + lines + '. Total Rs ' + total + '. Name: ' + name);
      return ok({ order, whatsapp: 'https://wa.me/919876543210?text=' + text }, C);
    }

    if (p === '/api/orders' && m === 'GET') {
      if (!(await isAdmin(req, env))) return fail(401, 'Admin only', C);
      const limit = Math.min(500, Math.max(1, parseInt(url.searchParams.get('limit'), 10) || 200));
      const rows = await env.DB.prepare('SELECT * FROM orders ORDER BY createdAt DESC LIMIT ?').bind(limit).all();
      const list = (rows.results || []).map((o) => ({ ...o, items: safeJson(o.items) }));
      return ok({ data: list, total: list.length }, C);
    }

    const orMatch = /^\/api\/orders\/([A-Za-z0-9-]+)$/.exec(p);
    if (orMatch && m === 'PATCH') {
      if (!(await isAdmin(req, env))) return fail(401, 'Admin only', C);
      const body = await req.json().catch(() => ({}));
      const status = clean(body.status, 20);
      if (!ORDER_STATUS.includes(status)) return fail(400, 'Unknown status', C);
      await env.DB.prepare('UPDATE orders SET status = ?, updatedAt = ? WHERE id = ?')
        .bind(status, new Date().toISOString(), orMatch[1]).run();
      return ok({ updated: orMatch[1], status }, C);
    }

    /* ---------- STATS ---------- */
    if (p === '/api/stats' && m === 'GET') {
      if (!(await isAdmin(req, env))) return fail(401, 'Admin only', C);
      const today = istDate();
      const one = async (sql, ...args) => (await env.DB.prepare(sql).bind(...args).first()) || {};
      const t = await one('SELECT COUNT(*) AS n FROM bookings WHERE date = ? AND status != ?', today, 'cancelled');
      const p_ = await one("SELECT COUNT(*) AS n FROM bookings WHERE status = 'pending'");
      const g = await one('SELECT COALESCE(SUM(guests),0) AS n FROM bookings WHERE date = ? AND status != ?', today, 'cancelled');
      const o = await one('SELECT COUNT(*) AS n, COALESCE(SUM(total),0) AS v FROM orders WHERE substr(createdAt,1,10) = ?', today);
      const l = await one("SELECT value FROM settings WHERE key = 'door_open'");
      return ok({
        stats: {
          todayCount: t.n || 0, pending: p_.n || 0, todayGuests: g.n || 0,
          todayOrders: o.n || 0, todayRevenue: o.v || 0,
          open: !l || l.value !== '0', timezone: 'Asia/Kolkata', serverTime: new Date().toISOString(),
        },
      }, C);
    }

    /* ---------- CSV EXPORT ---------- */
    if (p === '/api/export/bookings.csv' && m === 'GET') {
      if (!(await isAdmin(req, env))) return fail(401, 'Admin only', C);
      const rows = await env.DB.prepare('SELECT * FROM bookings ORDER BY createdAt DESC').all();
      const cols = ['id', 'createdAt', 'status', 'date', 'time', 'name', 'phone', 'email', 'guests', 'seating', 'occasion', 'notes'];
      const q = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""').replace(/[\r\n]+/g, ' ') + '"';
      const csv = [cols.join(',')].concat((rows.results || []).map((r) => cols.map((c) => q(r[c])).join(','))).join('\r\n');
      return new Response('\ufeff' + csv, {
        headers: {
          ...C,
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="indiana-bookings-' + istDate() + '.csv"',
        },
      });
    }

    /* ---------- fallback ---------- */
    return fail(404, 'Unknown API route: ' + p, C);
  },
};

function safeJson(s) {
  try { return JSON.parse(s); } catch (e) { return []; }
}
