/**
 * Indiana Restaurant & Cafe — Booking & Orders Backend
 * ----------------------------------------------------
 * Zero-dependency Node.js server (Node 18+). No npm install required.
 *
 *   node server.js
 *
 * Features
 *  - Static hosting for the whole site (index / menu / reserve / gallery / admin)
 *  - Secure admin auth: scrypt password hash + HttpOnly session cookies
 *  - Public booking + order intake with strict validation and rate limiting
 *  - Owner notifications: console alert, notifications.log, optional webhook
 *  - Admin API: list / filter / update / delete bookings & orders, live stats
 *  - Live SSE stream so the admin dashboard updates instantly
 */

'use strict';

const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

/* ------------------------------------------------------------------ *
 * Config
 * ------------------------------------------------------------------ */
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '127.0.0.1';
const SESSION_HOURS = Number(process.env.SESSION_HOURS || 12);
const NOTIFY_WEBHOOK = process.env.NOTIFY_WEBHOOK || '';
const TIME_SLOTS = (() => {
  const out = [];
  for (let m = 11 * 60; m <= 22 * 60 + 30; m += 30) {
    const h24 = Math.floor(m / 60), mm = m % 60;
    out.push(`${h24 % 12 === 0 ? 12 : h24 % 12}:${String(mm).padStart(2, '0')} ${h24 >= 12 ? 'PM' : 'AM'}`);
  }
  return out;
})();

const FILES = {
  bookings: path.join(DATA_DIR, 'bookings.json'),
  orders: path.join(DATA_DIR, 'orders.json'),
  auth: path.join(DATA_DIR, 'auth.json'),
  sessions: path.join(DATA_DIR, 'sessions.json'),
  log: path.join(DATA_DIR, 'notifications.log'),
};

/* ------------------------------------------------------------------ *
 * Tiny helpers
 * ------------------------------------------------------------------ */
const nowIso = () => new Date().toISOString();
const clip = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, n);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function readJson(file, fallback) {
  try {
    const txt = await fsp.readFile(file, 'utf8');
    const val = JSON.parse(txt);
    return val == null ? fallback : val;
  } catch {
    return fallback;
  }
}

let writeChain = Promise.resolve();
function writeJson(file, value) {
  writeChain = writeChain.then(async () => {
    const tmp = `${file}.${process.pid}.tmp`;
    await fsp.writeFile(tmp, JSON.stringify(value, null, 2), 'utf8');
    await fsp.rename(tmp, file);
  }).catch((err) => console.error('[data] write failed', err.message));
  return writeChain;
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function scryptHash(password, salt = crypto.randomBytes(16).toString('hex')) {
  const key = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 }).toString('hex');
  return { salt, key };
}

function scryptVerify(password, salt, key) {
  const candidate = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  const expected = Buffer.from(key, 'hex');
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

/* ------------------------------------------------------------------ *
 * Auth + rate limiting
 * ------------------------------------------------------------------ */
let authRecord = null;
let sessions = {};

async function initAuth() {
  await fsp.mkdir(DATA_DIR, { recursive: true });
  authRecord = await readJson(FILES.auth, null);
  if (!authRecord || !authRecord.key) {
    const password = process.env.ADMIN_PASSWORD || crypto.randomBytes(6).toString('base64url');
    const { salt, key } = scryptHash(password);
    authRecord = { salt, key, createdAt: nowIso(), rotatedAt: nowIso() };
    await writeJson(FILES.auth, authRecord);
    console.log('\n' + '='.repeat(66));
    if (process.env.ADMIN_PASSWORD) {
      console.log('  ADMIN PASSWORD set from environment variable.');
    } else {
      console.log('  FIRST RUN — a random admin password was generated:');
      console.log('      >>>  ' + password + '  <<<');
      console.log('  Save it now. Set ADMIN_PASSWORD=... to use your own.');
    }
    console.log('='.repeat(66) + '\n');
  }
  sessions = await readJson(FILES.sessions, {});
  await pruneSessions();
}

async function pruneSessions() {
  const now = Date.now();
  let dirty = false;
  for (const [token, s] of Object.entries(sessions)) {
    if (!s || s.exp < now) { delete sessions[token]; dirty = true; }
  }
  if (dirty) await writeJson(FILES.sessions, sessions);
}

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}

const buckets = new Map();
function rateLimit(key, limit, windowMs) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) { buckets.set(key, { count: 1, reset: now + windowMs }); return { ok: true, left: limit - 1 }; }
  b.count += 1;
  if (b.count > limit) return { ok: false, retryAfter: Math.ceil((b.reset - now) / 1000) };
  return { ok: true, left: limit - b.count };
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

const SESSION_COOKIE = 'indiana_admin';
async function currentAdmin(req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token) return null;
  const rec = sessions[hashToken(token)];
  if (!rec || rec.exp < Date.now()) return null;
  return { token, ip: rec.ip, exp: rec.exp };
}

/* ------------------------------------------------------------------ *
 * HTTP plumbing
 * ------------------------------------------------------------------ */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.csv': 'text/csv; charset=utf-8',
};

function securityHeaders(res, isHtml) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(self), camera=(), microphone=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  if (isHtml) {
    res.setHeader('Content-Security-Policy', [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://unpkg.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https:",
      "connect-src 'self'",
      "frame-src https://maps.google.com https://www.google.com",
      "form-action 'self'",
      "base-uri 'self'",
      "object-src 'none'",
    ].join('; '));
  }
}

function send(res, status, body, headers = {}) {
  const payload = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, { 'Cache-Control': 'no-store', ...headers });
  res.end(payload);
}

const ok = (res, data = {}) => send(res, 200, { ok: true, ...data }, { 'Content-Type': 'application/json; charset=utf-8' });
const fail = (res, status, error, extra = {}) => send(res, status, { ok: false, error, ...extra }, { 'Content-Type': 'application/json; charset=utf-8' });

function readBody(req, limit = 16384) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new Error('payload too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch { reject(new Error('invalid json')); }
    });
    req.on('error', reject);
  });
}

/* ------------------------------------------------------------------ *
 * Live stream (SSE)
 * ------------------------------------------------------------------ */
const streams = new Set();
function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of streams) {
    try { res.write(payload); } catch { streams.delete(res); }
  }
}

/* ------------------------------------------------------------------ *
 * Notifications for the owner
 * ------------------------------------------------------------------ */
async function notifyOwner(kind, record) {
  const line = `[${nowIso()}] ${kind.toUpperCase()} — ${JSON.stringify(record)}`;
  const banner = [
    '',
    '🔔  ' + '─'.repeat(58),
    `    NEW ${kind.toUpperCase()}: ${record.name || 'Guest'} • ${record.phone || ''}`,
    `    ${record.date || ''} ${record.time || ''} • ${record.guests || ''}`,
    record.notes ? `    note: ${record.notes}` : '',
    `    id: ${record.id}`,
    '🔔  ' + '─'.repeat(58),
    '',
  ].filter(Boolean).join('\n');
  console.log(banner);
  try { await fsp.appendFile(FILES.log, line + '\n', 'utf8'); } catch { /* ignore */ }
  if (NOTIFY_WEBHOOK) {
    try {
      await fetch(NOTIFY_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, ...record }),
      });
    } catch (err) {
      console.warn('[notify] webhook failed:', err.message);
    }
  }
}

/* ------------------------------------------------------------------ *
 * Validation
 * ------------------------------------------------------------------ */
const PHONE_RE = /^[+]?[\d\s\-()]{8,18}$/;

function validateBooking(input) {
  const errors = {};
  const name = clip(input.name, 60);
  const phone = clip(input.phone, 20);
  const date = clip(input.date, 10);
  const time = clip(input.time, 12);
  const guests = clip(input.guests, 24) || '2 Guests';
  const occasion = clip(input.occasion, 40);
  const seating = clip(input.seating, 20) || 'Any';
  const notes = clip(input.notes, 240);

  if (name.length < 2) errors.name = 'Please enter your full name.';
  if (!PHONE_RE.test(phone) || phone.replace(/\D/g, '').length < 8) errors.phone = 'Please enter a valid phone number.';

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(date + 'T12:00:00') : null;
  if (!parsed || Number.isNaN(parsed.getTime())) {
    errors.date = 'Please choose a date.';
  } else {
    const max = new Date(today); max.setDate(max.getDate() + 120);
    if (parsed < today) errors.date = 'That date has already passed.';
    else if (parsed > max) errors.date = 'We accept bookings up to 120 days ahead.';
  }
  if (!TIME_SLOTS.includes(time)) errors.time = 'Please pick a service slot between 11:00 AM and 10:30 PM.';

  const guestCount = parseInt(String(guests).replace(/\D/g, ''), 10);
  if (!guestCount || guestCount < 1 || guestCount > 30) errors.guests = 'Party size should be between 1 and 30.';

  return {
    errors,
    value: { name, phone, date, time, guests, occasion, seating, notes, partySize: guestCount || 2 },
  };
}

/* ------------------------------------------------------------------ *
 * API routes
 * ------------------------------------------------------------------ */
async function requireAdmin(req, res) {
  const admin = await currentAdmin(req);
  if (!admin) { fail(res, 401, 'Please sign in to continue.'); return null; }
  return admin;
}

async function api(req, res, url) {
  const route = url.pathname;
  const method = req.method.toUpperCase();
  const ip = clientIp(req);

  /* ---------- health ---------- */
  if (route === '/api/health') return ok(res, { time: nowIso(), uptime: process.uptime() });

  /* ---------- auth ---------- */
  if (route === '/api/auth/login' && method === 'POST') {
    const limit = rateLimit(`login:${ip}`, 6, 10 * 60 * 1000);
    if (!limit.ok) return fail(res, 429, `Too many attempts. Try again in ${limit.retryAfter}s.`);
    const body = await readBody(req).catch(() => null);
    if (!body || typeof body.password !== 'string') return fail(res, 400, 'Password required.');
    await sleep(120);
    if (!scryptVerify(body.password, authRecord.salt, authRecord.key)) {
      console.warn(`[auth] failed login from ${ip}`);
      return fail(res, 401, 'Incorrect password.');
    }
    const token = crypto.randomBytes(32).toString('base64url');
    const exp = Date.now() + SESSION_HOURS * 3600 * 1000;
    sessions[hashToken(token)] = { exp, ip, ua: clip(req.headers['user-agent'], 120), created: nowIso() };
    await writeJson(FILES.sessions, sessions);
    res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_HOURS * 3600}`);
    console.log(`[auth] admin signed in from ${ip}`);
    return ok(res, { expiresAt: exp });
  }

  if (route === '/api/auth/logout' && method === 'POST') {
    const token = parseCookies(req)[SESSION_COOKIE];
    if (token) { delete sessions[hashToken(token)]; await writeJson(FILES.sessions, sessions); }
    res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`);
    return ok(res);
  }

  if (route === '/api/auth/session') {
    const admin = await currentAdmin(req);
    return ok(res, { signedIn: !!admin, expiresAt: admin ? admin.exp : null });
  }

  /* ---------- public: create booking ---------- */
  if (route === '/api/bookings' && method === 'POST') {
    const limit = rateLimit(`book:${ip}`, 8, 60 * 60 * 1000);
    if (!limit.ok) return fail(res, 429, `Too many requests. Please call us directly or try again in ${Math.ceil(limit.retryAfter / 60)} minutes.`);
    const body = await readBody(req).catch(() => null);
    if (!body) return fail(res, 400, 'Could not read the request.');

    const { errors, value } = validateBooking(body);
    if (Object.keys(errors).length) return fail(res, 422, 'Please check the highlighted fields.', { fields: errors });

    const bookings = await readJson(FILES.bookings, []);
    const id = 'IND-' + crypto.randomBytes(3).toString('hex').toUpperCase();
    const record = {
      id,
      createdAt: nowIso(),
      status: 'pending',
      ...value,
      source: clip(body.source, 24) || 'website',
      ip: hashToken(ip).slice(0, 12),
      history: [{ at: nowIso(), status: 'pending', by: 'guest' }],
    };
    bookings.push(record);
    await writeJson(FILES.bookings, bookings);

    await notifyOwner('booking', record);
    broadcast('booking', record);
    return ok(res, { id, booking: publicView(record) });
  }

  /* ---------- public: create order (menu cart) ---------- */
  if (route === '/api/orders' && method === 'POST') {
    const limit = rateLimit(`order:${ip}`, 12, 60 * 60 * 1000);
    if (!limit.ok) return fail(res, 429, 'Too many orders from this device. Please call us.');
    const body = await readBody(req).catch(() => null);
    if (!body) return fail(res, 400, 'Could not read the request.');

    const items = Array.isArray(body.items) ? body.items.slice(0, 60).map((it) => ({
      name: clip(it.name, 80),
      price: Math.max(0, Math.min(100000, Number(it.price) || 0)),
      qty: Math.max(1, Math.min(99, Number(it.qty) || 1)),
    })).filter((it) => it.name) : [];
    if (!items.length) return fail(res, 422, 'Your cart is empty.');

    const total = items.reduce((sum, it) => sum + it.price * it.qty, 0);
    const orders = await readJson(FILES.orders, []);
    const record = {
      id: 'ORD-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
      createdAt: nowIso(),
      status: 'new',
      name: clip(body.name, 60) || 'Guest',
      phone: clip(body.phone, 20),
      mode: clip(body.mode, 20) || 'Dine-in',
      note: clip(body.note, 240),
      items, total,
      ip: hashToken(ip).slice(0, 12),
    };
    orders.push(record);
    await writeJson(FILES.orders, orders);
    await notifyOwner('order', { ...record, guests: `${items.length} items • ₹${total}` });
    broadcast('order', record);
    return ok(res, { id: record.id, total });
  }

  /* ---------- admin: live stream ---------- */
  if (route === '/api/stream') {
    if (!(await requireAdmin(req, res))) return;
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write('retry: 5000\n\n');
    streams.add(res);
    const ping = setInterval(() => { try { res.write(': ping\n\n'); } catch { /* ignore */ } }, 25000);
    req.on('close', () => { clearInterval(ping); streams.delete(res); });
    return;
  }

  /* ---------- admin: bookings ---------- */
  if (route === '/api/bookings' && method === 'GET') {
    if (!(await requireAdmin(req, res))) return;
    const bookings = await readJson(FILES.bookings, []);
    const status = url.searchParams.get('status');
    const q = (url.searchParams.get('q') || '').toLowerCase();
    const day = url.searchParams.get('date');
    let list = bookings.slice().sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    if (status && status !== 'all') list = list.filter((b) => b.status === status);
    if (day) list = list.filter((b) => b.date === day);
    if (q) list = list.filter((b) => [b.name, b.phone, b.id, b.occasion, b.notes].join(' ').toLowerCase().includes(q));
    return ok(res, { bookings: list, total: bookings.length });
  }

  const bookingMatch = route.match(/^\/api\/bookings\/([A-Za-z0-9-]+)$/);
  if (bookingMatch && (method === 'PATCH' || method === 'DELETE')) {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const bookings = await readJson(FILES.bookings, []);
    const idx = bookings.findIndex((b) => b.id === bookingMatch[1]);
    if (idx < 0) return fail(res, 404, 'Booking not found.');
    if (method === 'DELETE') {
      const [removed] = bookings.splice(idx, 1);
      await writeJson(FILES.bookings, bookings);
      broadcast('removed', { id: removed.id });
      return ok(res, { removed: removed.id });
    }
    const body = await readBody(req).catch(() => ({}));
    const allowed = ['pending', 'confirmed', 'seated', 'cancelled', 'no_show'];
    const status = clip(body.status, 20);
    if (status && !allowed.includes(status)) return fail(res, 422, 'Unknown status.');
    if (status) bookings[idx].status = status;
    if (body.note !== undefined) bookings[idx].staffNote = clip(body.note, 240);
    bookings[idx].updatedAt = nowIso();
    bookings[idx].history = bookings[idx].history || [];
    bookings[idx].history.push({ at: nowIso(), status: bookings[idx].status, by: 'admin' });
    await writeJson(FILES.bookings, bookings);
    broadcast('updated', bookings[idx]);
    return ok(res, { booking: bookings[idx] });
  }

  /* ---------- admin: orders ---------- */
  if (route === '/api/orders' && method === 'GET') {
    if (!(await requireAdmin(req, res))) return;
    const orders = await readJson(FILES.orders, []);
    return ok(res, { orders: orders.slice().reverse(), total: orders.length });
  }
  const orderMatch = route.match(/^\/api\/orders\/([A-Za-z0-9-]+)$/);
  if (orderMatch && (method === 'PATCH' || method === 'DELETE')) {
    if (!(await requireAdmin(req, res))) return;
    const orders = await readJson(FILES.orders, []);
    const idx = orders.findIndex((o) => o.id === orderMatch[1]);
    if (idx < 0) return fail(res, 404, 'Order not found.');
    if (method === 'DELETE') {
      const [removed] = orders.splice(idx, 1);
      await writeJson(FILES.orders, orders);
      return ok(res, { removed: removed.id });
    }
    const body = await readBody(req).catch(() => ({}));
    const allowed = ['new', 'preparing', 'served', 'paid', 'cancelled'];
    const status = clip(body.status, 20);
    if (status && !allowed.includes(status)) return fail(res, 422, 'Unknown status.');
    if (status) orders[idx].status = status;
    orders[idx].updatedAt = nowIso();
    await writeJson(FILES.orders, orders);
    broadcast('order-updated', orders[idx]);
    return ok(res, { order: orders[idx] });
  }

  /* ---------- door status (open / closed) ---------- */
  if (route === '/api/status' && method === 'GET') {
    const settings = await readJson(path.join(DATA_DIR, 'settings.json'), { open: true });
    return ok(res, { open: settings.open !== false, updatedAt: settings.updatedAt || null });
  }
  if (route === '/api/status' && method === 'POST') {
    if (!(await requireAdmin(req, res))) return;
    const body = await readBody(req).catch(() => ({}));
    const open = !(body && body.open === false);
    await writeJson(path.join(DATA_DIR, 'settings.json'), { open, updatedAt: nowIso() });
    broadcast('status-updated', { open });
    return ok(res, { open });
  }

  /* ---------- admin: stats ---------- */
  if (route === '/api/stats') {
    if (!(await requireAdmin(req, res))) return;
    const [bookings, orders] = await Promise.all([readJson(FILES.bookings, []), readJson(FILES.orders, [])]);
    const today = new Date().toISOString().slice(0, 10);
    const upcoming = bookings.filter((b) => b.date >= today && b.status !== 'cancelled');
    const byStatus = bookings.reduce((acc, b) => { acc[b.status] = (acc[b.status] || 0) + 1; return acc; }, {});
    const days = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(); d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      days[key] = bookings.filter((b) => b.date === key && b.status !== 'cancelled').length;
    }
    const revenue = orders.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + (o.total || 0), 0);
    return ok(res, {
      stats: {
        total: bookings.length,
        todayCount: bookings.filter((b) => b.date === today && b.status !== 'cancelled').length,
        upcoming: upcoming.length,
        upcomingGuests: upcoming.reduce((s, b) => s + (b.partySize || 0), 0),
        pending: byStatus.pending || 0,
        confirmed: byStatus.confirmed || 0,
        seated: byStatus.seated || 0,
        cancelled: byStatus.cancelled || 0,
        orders: orders.length,
        revenue,
        week: days,
      },
    });
  }

  /* ---------- admin: CSV export ---------- */
  if (route === '/api/export/bookings.csv') {
    if (!(await requireAdmin(req, res))) return;
    const bookings = await readJson(FILES.bookings, []);
    const head = ['id', 'createdAt', 'status', 'date', 'time', 'name', 'phone', 'guests', 'occasion', 'seating', 'notes', 'staffNote'];
    const esc = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
    const csv = [head.join(','), ...bookings.map((b) => head.map((h) => esc(b[h])).join(','))].join('\r\n');
    return send(res, 200, csv, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="indiana-bookings-${new Date().toISOString().slice(0, 10)}.csv"`,
    });
  }

  return fail(res, 404, 'Unknown API route.');
}

function publicView(record) {
  return {
    id: record.id, date: record.date, time: record.time, guests: record.guests,
    seating: record.seating, occasion: record.occasion, status: record.status, createdAt: record.createdAt,
  };
}

/* ------------------------------------------------------------------ *
 * Static files
 * ------------------------------------------------------------------ */
const ROUTE_ALIASES = {
  '/': 'index.html',
  '/home': 'index.html',
  '/reserve': 'reserve.html',
  '/booking': 'reserve.html',
  '/admin': 'admin.html',
  '/dashboard': 'admin.html',
  '/menu': 'menu.html',
  '/gallery': 'gallery.html',
};

async function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (ROUTE_ALIASES[rel]) rel = '/' + ROUTE_ALIASES[rel];
  if (rel.endsWith('/')) rel += 'index.html';

  const safe = path.normalize(rel).replace(/^([/\\])+/, '');
  const target = path.join(ROOT, safe);
  if (!target.startsWith(ROOT)) return send(res, 403, 'Forbidden');

  const ext = path.extname(target).toLowerCase();
  if (!MIME[ext]) return send(res, 404, 'Not found');
  if (path.basename(target).startsWith('_')) return send(res, 404, 'Not found');
  if (safe.startsWith('data' + path.sep) || safe.startsWith('data/')) return send(res, 403, 'Forbidden');

  try {
    const stat = await fsp.stat(target);
    if (!stat.isFile()) return send(res, 404, 'Not found');
    securityHeaders(res, ext === '.html');
    res.setHeader('Content-Type', MIME[ext]);
    res.setHeader('Cache-Control', ext === '.html' ? 'no-cache' : 'public, max-age=3600');
    res.setHeader('ETag', `W/"${stat.size}-${Number(stat.mtimeMs).toString(36)}"`);
    res.writeHead(200);
    fs.createReadStream(target).pipe(res);
  } catch {
    securityHeaders(res, true);
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1 style="font:700 24px system-ui;padding:40px">404 — Not found</h1>');
  }
}

/* ------------------------------------------------------------------ *
 * Server
 * ------------------------------------------------------------------ */
const server = http.createServer(async (req, res) => {
  const started = Date.now();
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (url.pathname.startsWith('/api/')) {
      await api(req, res, url);
    } else if (req.method === 'GET' || req.method === 'HEAD') {
      await serveStatic(req, res, url);
    } else {
      send(res, 405, 'Method not allowed');
    }
  } catch (err) {
    console.error('[error]', req.method, url.pathname, err);
    if (!res.headersSent) fail(res, 500, 'Something went wrong on our side.');
    else res.end();
  } finally {
    const ms = Date.now() - started;
    if (!url.pathname.startsWith('/api/stream')) {
      console.log(`${req.method} ${url.pathname} → ${res.statusCode} (${ms}ms)`);
    }
  }
});

initAuth().then(() => {
  server.listen(PORT, HOST, () => {
    console.log('\n  Indiana Restaurant & Cafe — backend running');
    console.log(`  Site      : http://${HOST}:${PORT}/`);
    console.log(`  Reserve   : http://${HOST}:${PORT}/reserve`);
    console.log(`  Admin     : http://${HOST}:${PORT}/admin`);
    console.log(`  Data dir  : ${DATA_DIR}`);
    console.log(`  Webhook   : ${NOTIFY_WEBHOOK ? 'enabled' : 'disabled (set NOTIFY_WEBHOOK to enable)'}\n`);
  });
}).catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});

process.on('SIGINT', () => { console.log('\nShutting down…'); server.close(() => process.exit(0)); });
